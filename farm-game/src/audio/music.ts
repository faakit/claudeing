import { MUSIC, instrumentFiles, sampleFor, slotInstruments } from './assets';
import { SAMPLED_MUSIC_GAIN } from './graph';
import type { SampleBank } from './bank';
import { PiecePlayer, catchUp, makeRng } from './sequencer';
import type { NoteEvent } from './sequencer';
import { parseNotes } from './theory';
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
export type SynthNote = (midi: number, when: number, dur: number, vel: number, dest: AudioNode) => void;

/** How far ahead bars are generated and nodes created (seconds). Short, so mute and fades act fast. */
const BAR_LOOKAHEAD = 0.5;
const NODE_LOOKAHEAD = 0.25;
/** Notes later than this are dropped instead of played late. */
const LATE = 0.03;
const MAX_VOICES = 40;
/** How long a piece waits for its samples before starting with whatever it has. */
const MAX_WAIT = 6;
const FADE_OUT = 1.6;

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
  private rng = makeRng(0x7a11ac3e);
  private voices: Voice[] = [];
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
      slotInstruments(slot).flatMap((i) => instrumentFiles(i).map((z) => this.bank.load(this.ctx, z.file, z.onset))),
    );
  }

  /** 'ready' when every sample of the slot is decoded or known to fail; 'none' when nothing can play. */
  status(slot: MusicSlot): 'ready' | 'loading' | 'none' {
    const files = slotInstruments(slot).flatMap(instrumentFiles);
    let ok = 0;
    let pending = 0;
    for (const z of files) {
      if (this.bank.get(z.file)) ok++;
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
      a.setLevel(1, now, 0.25);
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
      });
      this.stats.bars++;
      for (const ev of bar.events) a.queue.push({ t: a.nextBar + ev.beat * spb + ev.jitter, dur: ev.beats * spb, ev });
      a.nextBar += barLen;
    }
    a.queue.sort((x, y) => x.t - y.t);
    while (a.queue.length && a.queue[0]!.t < now + NODE_LOOKAHEAD) {
      const s = a.queue.shift()!;
      if (s.t < now - LATE || this.voices.length >= MAX_VOICES) {
        this.stats.dropped++;
        continue;
      }
      this.playNote(a, s, Math.max(s.t, now));
    }
  }

  private playNote(a: ActivePiece, s: Scheduled, when: number): void {
    const { ev } = s;
    const strip = a.strip(ev.layer, ev.inst, ev.time);
    const mix = MUSIC.instruments[ev.inst];
    const pick = sampleFor(ev.inst, ev.midi, ev.perc);
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

  /**
   * Play a jingle on the sampler (into the sfx bus), transposed into the current piece's key.
   * Returns false if none of its instruments can play yet, so the caller uses the synth instead.
   */
  jingle(cue: string, now: number, volume = 1): boolean {
    const j = MUSIC.jingles[cue];
    if (!j) return false;
    const piece = this.active ? MUSIC.pieces[this.active.slot] : undefined;
    const tr = piece?.jingleKey ?? 0;
    const spb = 60 / j.bpm;
    const notes: { inst: string; midi: number; t: number; dur: number; gain: number }[] = [];
    for (const part of j.parts) {
      for (const n of parseNotes(part.notes)) {
        if (n.midi === null) continue;
        notes.push({ inst: part.inst, midi: n.midi + tr, t: n.beat * spb, dur: n.beats * spb, gain: part.gain ?? 1 });
      }
    }
    const playable = notes.filter((n) => {
      const p = sampleFor(n.inst, n.midi, false);
      return p && this.bank.get(p.zone.file, now);
    });
    if (playable.length === 0) return false;
    for (const n of playable) {
      const p = sampleFor(n.inst, n.midi, false)!;
      const d = this.bank.get(p.zone.file, now)!;
      const mix = MUSIC.instruments[n.inst];
      playSample(this.ctx, d, p.zone, this.buses.sfx, {
        when: now + 0.01 + n.t,
        rate: p.rate,
        gain: volume * n.gain * (mix?.gain ?? 0.6) * 0.9,
        dur: n.dur,
        release: Math.max(0.3, mix?.release ?? 0.3),
      });
    }
    return true;
  }
}

function sampleHitsCount(inst: string): number {
  return instrumentFiles(inst).length;
}
