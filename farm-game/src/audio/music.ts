import {
  MANIFEST,
  MUSIC,
  instrumentFiles,
  jingleOrSting,
  sampleFor,
  slotInstruments,
} from './assets';
import { SAMPLED_MUSIC_GAIN } from './graph';
import type { SampleBank } from './bank';
import { PiecePlayer, catchUp, makeRng } from './sequencer';
import type { NoteEvent } from './sequencer';
import { fitToChord, parseNotes } from './theory';
import type { Chord } from './theory';
import { playableRange } from './zones';
import type { LayerTime, MusicSlot } from './types';
import { glide, playSample } from './voice';
import type { Voice } from './voice';

/** The engine's music buses: dry and reverb-send pairs for day, night and time-independent layers. */
export interface MusicBuses {
  dry: Record<LayerTime, AudioNode>;
  wet: Record<LayerTime, AudioNode>;
  /** Jingles go to the sound-effect bus, not the music bus. */
  sfx: AudioNode;
}

/** Fallback for one note when its instrument cannot play (missing or failed file). */
export type SynthNote = (
  midi: number,
  when: number,
  dur: number,
  vel: number,
  dest: AudioNode,
) => void;

/** How far ahead bars are generated and nodes created (seconds). Short, so mute and fades act fast. */
const BAR_LOOKAHEAD = 0.5;
const NODE_LOOKAHEAD = 0.25;
/** Notes later than this are dropped instead of played late. */
const LATE = 0.03;
const MAX_VOICES = 40;
/** How long a piece waits for its samples before starting with whatever it has. */
const MAX_WAIT = 6;
const FADE_OUT = 1.6;
/** Jingles of different priority this close together (seconds): the lesser one gives way. */
export const JINGLE_PRIORITY_WINDOW = 1;
/** Light instruments a villager motif may move to when the piece already uses its own. */
const LEAD_CANDIDATES = ['vibes', 'glock', 'marimba', 'harp'];

/** A rainy day plays the piece softer (on top of the thinner arrangement). */
const RAIN_DB = -2.5;

interface Strip {
  gain: GainNode;
  nodes: AudioNode[];
}

interface Scheduled {
  t: number;
  dur: number;
  ev: NoteEvent;
}

const TIMES: LayerTime[] = ['day', 'night', 'both'];

class ActivePiece {
  out: Record<LayerTime, { dry: GainNode; wet: GainNode }>;
  strips = new Map<string, Strip>();
  queue: Scheduled[] = [];
  /** Recently generated bars (start time, section, bar), so jingles can follow the chords. */
  history: { t0: number; section: string; bar: number }[] = [];
  nextBar = 0;
  started = false;
  stopAt = Infinity;
  readonly createdAt: number;

  constructor(
    private ctx: BaseAudioContext,
    readonly slot: MusicSlot,
    readonly player: PiecePlayer,
    buses: MusicBuses,
    now: number,
  ) {
    this.createdAt = now;
    const mk = (dest: AudioNode) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(dest);
      return g;
    };
    this.out = {
      day: { dry: mk(buses.dry.day), wet: mk(buses.wet.day) },
      night: { dry: mk(buses.dry.night), wet: mk(buses.wet.night) },
      both: { dry: mk(buses.dry.both), wet: mk(buses.wet.both) },
    };
  }

  /** Fade the whole piece to `value` (0..1) of its mix level. */
  setLevel(value: number, now: number, tau: number): void {
    const piece = this.player.piece;
    const base = SAMPLED_MUSIC_GAIN * Math.pow(10, (piece.level ?? 0) / 20);
    for (const t of TIMES) {
      const lvl = value * base * (t === 'night' ? Math.pow(10, (piece.nightLevel ?? 0) / 20) : 1);
      glide(this.out[t].dry.gain, lvl, now, tau);
      glide(this.out[t].wet.gain, lvl, now, tau);
    }
  }

  strip(layer: string, inst: string, time: LayerTime): Strip {
    let s = this.strips.get(layer);
    if (s) return s;
    const mix = MUSIC.instruments[inst] ?? { gain: 0.5 };
    const gain = this.ctx.createGain();
    gain.gain.value = mix.gain;
    const nodes: AudioNode[] = [gain];
    let tail: AudioNode = gain;
    if (mix.pan && typeof this.ctx.createStereoPanner === 'function') {
      const p = this.ctx.createStereoPanner();
      p.pan.value = mix.pan;
      gain.connect(p);
      nodes.push(p);
      tail = p;
    }
    tail.connect(this.out[time].dry);
    if (mix.reverb) {
      const send = this.ctx.createGain();
      send.gain.value = mix.reverb;
      tail.connect(send).connect(this.out[time].wet);
      nodes.push(send);
    }
    s = { gain, nodes };
    this.strips.set(layer, s);
    return s;
  }

  dispose(): void {
    for (const s of this.strips.values()) s.nodes.forEach((n) => n.disconnect());
    for (const t of TIMES) {
      this.out[t].dry.disconnect();
      this.out[t].wet.disconnect();
    }
  }
}

/** Perceived loudness grows faster than linear velocity. */
const velGain = (v: number) => Math.pow(Math.max(0, Math.min(1, v)), 1.6);

/**
 * Plays the composed pieces on sampled instruments: one piece per music slot, crossfaded when the
 * slot changes, each piece resuming where it left off (leaving the mine does not restart the farm
 * music). Day and night layers share the bar clock and go to separate buses so the engine's
 * day/night crossfade stays musical.
 */
export class MusicPlayer {
  private players = new Map<MusicSlot, PiecePlayer>();
  private active: ActivePiece | null = null;
  private fading: ActivePiece[] = [];
  private indoor = false;
  private rain = false;
  private year = 1;
  private rng = makeRng(0x7a11ac3e);
  private voices: Voice[] = [];
  private recentJingles: { priority: number; start: number; voices: Voice[] }[] = [];
  /** Notes played from samples / by the synth fallback / skipped, for tests and the report. */
  readonly stats = { sampled: 0, synth: 0, dropped: 0, bars: 0 };

  constructor(
    private ctx: BaseAudioContext,
    private bank: SampleBank,
    private buses: MusicBuses,
    private synthNote: SynthNote,
  ) {}

  get slot(): MusicSlot | null {
    return this.active?.slot ?? null;
  }

  /** Start decoding everything a slot needs. */
  preload(slot: MusicSlot): Promise<unknown> {
    return Promise.all(
      slotInstruments(slot).flatMap((i) =>
        instrumentFiles(i).map((z) => this.bank.load(this.ctx, z.file, z.onset)),
      ),
    );
  }

  /** 'ready' when every sample of the slot is decoded or known to fail; 'none' when nothing can play. */
  status(slot: MusicSlot): 'ready' | 'loading' | 'none' {
    const files = slotInstruments(slot).flatMap(instrumentFiles);
    let ok = 0;
    let pending = 0;
    for (const z of files) {
      if (this.bank.has(z.file)) ok++;
      else if (!this.bank.failed(z.file)) pending++;
    }
    if (pending > 0) return 'loading';
    return ok > 0 ? 'ready' : 'none';
  }

  setSlot(slot: MusicSlot, indoor: boolean, now: number): void {
    this.indoor = indoor;
    if (this.active?.slot === slot) return;
    if (this.active) this.retire(this.active, now);
    let player = this.players.get(slot);
    if (!player) {
      const piece = MUSIC.pieces[slot];
      if (!piece) {
        this.active = null;
        return;
      }
      player = new PiecePlayer(piece, MUSIC.patterns);
      this.players.set(slot, player);
    }
    this.active = new ActivePiece(this.ctx, slot, player, this.buses, now);
    void this.preload(slot);
  }

  /**
   * Weather and year: rain thins the arrangement (no percussion, main beats only, more rests) and plays
   * it 2.5 dB softer; from year two pieces with variation sections play their second form.
   */
  setMood(m: { rain?: boolean; year?: number }, now: number): void {
    const rain = !!m.rain;
    this.year = m.year ?? this.year;
    if (rain === this.rain) return;
    this.rain = rain;
    if (this.active?.started) this.active.setLevel(this.levelValue(), now, 2);
  }

  private levelValue(): number {
    return this.rain ? Math.pow(10, RAIN_DB / 20) : 1;
  }

  /** Fade everything out (title -> silence, music switched off). */
  stop(now: number): void {
    if (this.active) this.retire(this.active, now);
    this.active = null;
  }

  private retire(p: ActivePiece, now: number): void {
    p.setLevel(0, now, FADE_OUT / 4);
    p.queue = [];
    p.stopAt = now + FADE_OUT * 2;
    this.fading.push(p);
  }

  /**
   * Generate and schedule notes. `enabled` false (muted, music volume 0, suspended) schedules
   * nothing but keeps the bar grid moving, so turning music back on joins in time.
   */
  tick(now: number, o: { enabled: boolean; day: boolean; night: boolean }): void {
    this.fading = this.fading.filter((p) => {
      if (now < p.stopAt) return true;
      p.dispose();
      return false;
    });
    this.voices = this.voices.filter((v) => v.end > now);
    const a = this.active;
    if (!a) return;
    if (!a.started) {
      const st = this.status(a.slot);
      if (st === 'loading' && now - a.createdAt < MAX_WAIT) return;
      a.started = true;
      a.nextBar = now + 0.12;
      a.setLevel(this.levelValue(), now, 0.25);
    }
    const barLen = a.player.secondsPerBar();
    a.nextBar = catchUp(a.nextBar, now, barLen);
    if (!o.enabled) {
      a.queue = [];
      while (a.nextBar < now) a.nextBar += barLen;
      return;
    }
    const spb = 60 / a.player.piece.bpm;
    while (a.nextBar < now + BAR_LOOKAHEAD) {
      const bar = a.player.nextBar(this.rng, {
        indoor: this.indoor,
        day: o.day,
        night: o.night,
        percHits: (inst) => sampleHitsCount(inst),
        rain: this.rain,
        year: this.year,
      });
      this.stats.bars++;
      a.history.push({ t0: a.nextBar, section: bar.section, bar: bar.bar });
      if (a.history.length > 16) a.history.shift();
      for (const ev of bar.events)
        a.queue.push({ t: a.nextBar + ev.beat * spb + ev.jitter, dur: ev.beats * spb, ev });
      a.nextBar += barLen;
    }
    a.queue.sort((x, y) => x.t - y.t);
    while (a.queue.length && a.queue[0]!.t < now + NODE_LOOKAHEAD) {
      const s = a.queue.shift()!;
      if (s.t < now - LATE || this.voices.length >= MAX_VOICES) {
        this.stats.dropped++;
        continue;
      }
      this.playNote(a, s, now);
    }
  }

  private playNote(a: ActivePiece, s: Scheduled, now: number): void {
    const { ev } = s;
    const strip = a.strip(ev.layer, ev.inst, ev.time);
    const mix = MUSIC.instruments[ev.inst];
    const pick = sampleFor(ev.inst, ev.midi, ev.perc);
    // Slow attacks start a little early so they speak on the beat.
    const when = Math.max(now, s.t - (pick?.zone.lag ?? 0));
    const d = pick ? this.bank.get(pick.zone.file, when) : undefined;
    const gain = velGain(ev.vel);
    if (pick && d) {
      const rate = ev.perc ? pick.rate * (0.985 + this.rng() * 0.03) : pick.rate;
      // Sustained instruments play legato: each note holds a little past the next one's start, so
      // a pad's new chord fades in under the old one instead of leaving a gap at the bar line.
      const legato = pick.zone.loop ? Math.min(0.5, (mix?.attack ?? 0) + 0.15) : 0;
      this.voices.push(
        playSample(this.ctx, d, pick.zone, strip.gain, {
          when,
          rate,
          gain,
          dur: ev.perc ? undefined : s.dur + legato,
          attack: mix?.attack,
          release: mix?.release,
        }),
      );
      this.stats.sampled++;
    } else if (!ev.perc) {
      this.synthNote(ev.midi, when, s.dur, gain, strip.gain);
      this.stats.synth++;
    }
  }

  /** The chord the playing piece sounds at time `t` (past, present or coming), or null if none. */
  chordAt(t: number): Chord | null {
    const a = this.active;
    if (!a?.started || a.history.length === 0) return null;
    const barLen = a.player.secondsPerBar();
    const spb = 60 / a.player.piece.bpm;
    let at: { t0: number; section: string; bar: number } | undefined;
    if (t < a.nextBar) at = [...a.history].reverse().find((h) => h.t0 <= t + 1e-6);
    else {
      const k = Math.floor((t - a.nextBar) / barLen);
      at = { t0: a.nextBar + k * barLen, ...a.player.peek(k, { year: this.year }) };
    }
    if (!at) return null;
    return a.player.chordOf(at.section, at.bar, Math.max(0, (t - at.t0) / spb));
  }

  /** The key (semitones from C) jingles are transposed to: the playing piece's, or a given slot's. */
  jingleKey(slot?: MusicSlot): number {
    const piece = MUSIC.pieces[slot ?? this.active?.slot ?? ''];
    return piece?.jingleKey ?? 0;
  }

  /**
   * Play a jingle on the sampler (into the sfx bus), transposed into the current piece's key (or `key`),
   * starting `delay` seconds from now. Returns false if none of its instruments can play yet, so the
   * caller uses the synth instead.
   */
  jingle(
    cue: string,
    now: number,
    volume = 1,
    o: { key?: number; delay?: number; lead?: boolean } = {},
  ): boolean {
    const j = jingleOrSting(cue);
    if (!j) return false;
    const tr = o.key ?? this.jingleKey();
    volume *= j.volume ?? 1;
    const start = now + (o.delay ?? 0);
    // Priority: a more important fanfare (special order) silences a lesser jingle within a second of
    // it, whichever was asked for first; the lesser one is dropped (reported as played).
    const prio = j.priority ?? 1;
    this.recentJingles = this.recentJingles.filter((r) => r.start > now - 5);
    if (
      this.recentJingles.some(
        (r) => r.priority > prio && Math.abs(r.start - start) < JINGLE_PRIORITY_WINDOW,
      )
    )
      return true;
    for (const r of this.recentJingles)
      if (r.priority < prio && Math.abs(r.start - start) < JINGLE_PRIORITY_WINDOW)
        r.voices.forEach((v) => v.stop(start, 0.06));
    // Chord-aware only in the playing piece's own key (a sting for the next season is in its key).
    const follow = tr === this.jingleKey();
    const spb = 60 / j.bpm;
    const notes: { inst: string; midi: number; t: number; dur: number; gain: number }[] = [];
    j.parts.forEach((part, pi) => {
      const inst = o.lead && pi === 0 ? this.leadFor(part.inst, part.notes, tr) : part.inst;
      for (const n of parseNotes(part.notes)) {
        if (n.midi === null) continue;
        let midi = n.midi + tr;
        // Held notes (a beat or more) move off a semitone clash with the chord sounding under them.
        const chord = follow && n.beats >= 1 ? this.chordAt(start + 0.01 + n.beat * spb) : null;
        if (chord) midi = fitToChord(midi, chord);
        notes.push({ inst, midi, t: n.beat * spb, dur: n.beats * spb, gain: part.gain ?? 1 });
      }
    });
    const playable = notes.filter((n) => {
      const p = sampleFor(n.inst, n.midi, false);
      return p && this.bank.get(p.zone.file, now);
    });
    if (playable.length === 0) return false;
    const voices: Voice[] = [];
    for (const n of playable) {
      const p = sampleFor(n.inst, n.midi, false)!;
      const d = this.bank.get(p.zone.file, now)!;
      const mix = MUSIC.instruments[n.inst];
      voices.push(
        playSample(this.ctx, d, p.zone, this.buses.sfx, {
          when: start + 0.01 + n.t,
          rate: p.rate,
          gain: volume * n.gain * (mix?.gain ?? 0.6) * 0.9,
          dur: n.dur,
          release: Math.max(0.3, mix?.release ?? 0.3),
        }),
      );
    }
    this.recentJingles.push({ priority: prio, start, voices });
    return true;
  }

  /**
   * The lead instrument for a motif: its own unless the playing piece already uses it, then the first
   * of the light jingle instruments the piece does not use and that can play every note.
   */
  leadFor(inst: string, notes: string, tr: number): string {
    const used = this.active ? new Set(slotInstruments(this.active.slot)) : new Set<string>();
    if (!used.has(inst)) return inst;
    const midis = parseNotes(notes).flatMap((n) => (n.midi === null ? [] : [n.midi + tr]));
    for (const alt of LEAD_CANDIDATES) {
      if (used.has(alt)) continue;
      const a = MANIFEST.instruments[alt];
      if (!a) continue;
      const [lo, hi] = playableRange(alt, a);
      // A chord fit can move a note by up to 3 semitones.
      if (midis.every((m) => m - 3 >= lo && m + 3 <= hi)) return alt;
    }
    return inst;
  }
}

function sampleHitsCount(inst: string): number {
  return instrumentFiles(inst).length;
}
