import { bassNote, chordAt, parseChords, parsePhrase, voiceTone, voicing } from './theory';
import type { Chord, ChordAt, PhraseNote } from './theory';
import type { Layer, LayerTime, Piece, PatternStep } from './types';

/** Deterministic PRNG (mulberry32) so renders and tests repeat exactly. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One note to play, relative to the start of its bar. */
export interface NoteEvent {
  layer: string;
  inst: string;
  time: LayerTime;
  /** Beat offset inside the bar (swing applied). */
  beat: number;
  /** Extra timing offset in seconds (humanisation). */
  jitter: number;
  /** MIDI note; for percussion the hit index instead. */
  midi: number;
  perc: boolean;
  beats: number;
  vel: number;
}

export interface BarOut {
  section: string;
  /** Bar number inside the section, from 0. */
  bar: number;
  events: NoteEvent[];
}

export interface BarOptions {
  indoor: boolean;
  /** Which day/night layers are worth generating (the other bus is silent). */
  day: boolean;
  night: boolean;
  /** Number of hits per percussion instrument (round robin pool size). */
  percHits: (inst: string) => number;
  /** A rainy day: no percussion, accompaniment on the main beats only, melodies rest more. */
  rain?: boolean;
  /** Game year: from year two a piece plays its `form2` (variation sections) if it has one. */
  year?: number;
}

/** Extra chance that a melody sits a section out on a rainy day. */
export const RAIN_REST = 0.25;

const PERC = new Set(['shaker', 'tamb', 'sleigh', 'triangle']);

interface ParsedSection {
  bars: number;
  chords: ChordAt[];
}

/**
 * Plays a Piece bar by bar: walks the form, picks a composed phrase for each melody layer when a
 * phrase starts (never the same one twice in a row), lets melodies rest sometimes, and expands
 * accompaniment patterns on the current chord. Pure: all randomness comes from the rng passed in.
 */
export class PiecePlayer {
  private sections = new Map<string, ParsedSection>();
  private phrases = new Map<string, { bars: number; notes: PhraseNote[] }>();
  private formIndex = 0;
  private introIndex = 0;
  private barInSection = 0;
  /** layer id -> phrase currently playing (null = resting) and the bar it started. */
  private current = new Map<string, { id: string | null; start: number }>();
  private last = new Map<string, string>();
  private resting = new Map<string, boolean>();

  constructor(
    readonly piece: Piece,
    private patterns: Record<string, PatternStep[]>,
  ) {
    for (const [id, s] of Object.entries(piece.sections)) this.sections.set(id, parseChords(s.chords, piece.meter));
    for (const [id, p] of Object.entries(piece.phrases)) this.phrases.set(id, parsePhrase(p, piece.meter));
  }

  get beatsPerBar(): number {
    return this.piece.meter;
  }

  secondsPerBar(): number {
    return (60 / this.piece.bpm) * this.piece.meter;
  }

  /** Where the form is, so leaving and coming back can resume instead of restarting. */
  get position(): { formIndex: number; bar: number } {
    return { formIndex: this.formIndex, bar: this.barInSection };
  }

  private formFor(opt: BarOptions): string[] {
    return (opt.year ?? 1) >= 2 && this.piece.form2 ? this.piece.form2 : this.piece.form;
  }

  /** The section and bar `k` bars after the next one to be generated (k = 0 is the next one). */
  peek(k: number, opt: Pick<BarOptions, 'year'>): { section: string; bar: number } {
    const introLen = this.piece.intro?.length ?? 0;
    const form = this.formFor(opt as BarOptions);
    let intro = this.introIndex;
    let f = this.formIndex;
    let b = this.barInSection;
    for (let i = 0; i < k; i++) {
      const sid = intro < introLen ? this.piece.intro![intro]! : form[f % form.length]!;
      b++;
      if (b >= this.sections.get(sid)!.bars) {
        b = 0;
        if (intro < introLen) intro++;
        else f = (f + 1) % form.length;
      }
    }
    return { section: intro < introLen ? this.piece.intro![intro]! : form[f % form.length]!, bar: b };
  }

  /** The chord at a beat of a bar of a section. */
  chordOf(section: string, bar: number, beat: number): Chord {
    return chordAt(this.sections.get(section)!.chords, bar * this.piece.meter + beat).chord;
  }

  nextBar(rng: () => number, opt: BarOptions): BarOut {
    const inIntro = this.introIndex < (this.piece.intro?.length ?? 0);
    const form = this.formFor(opt);
    const sectionId = inIntro ? this.piece.intro![this.introIndex]! : form[this.formIndex % form.length]!;
    const section = this.sections.get(sectionId)!;
    const bar = this.barInSection;
    const events: NoteEvent[] = [];
    for (const layer of this.piece.layers) {
      // Always advance phrase choice so the rng sequence does not depend on day/night.
      const melody = layer.phrases ? this.melodyFor(layer, sectionId, bar, rng, inIntro, opt.rain) : null;
      if (layer.tacet?.includes(sectionId)) continue;
      if (opt.rain && PERC.has(layer.inst)) continue;
      if (opt.indoor && layer.outdoorOnly) continue;
      if (layer.time === 'day' && !opt.day) continue;
      if (layer.time === 'night' && !opt.night) continue;
      if (melody) events.push(...melody);
      else if (layer.pattern) events.push(...this.patternFor(layer, section, bar, rng, opt));
    }
    for (const e of events) e.jitter = (rng() + rng() - 1) * 0.008;
    this.barInSection += 1;
    if (this.barInSection >= section.bars) {
      this.barInSection = 0;
      if (inIntro) this.introIndex += 1;
      else this.formIndex = (this.formIndex + 1) % form.length;
    }
    return { section: sectionId, bar, events };
  }

  private melodyFor(
    layer: Layer,
    sectionId: string,
    bar: number,
    rng: () => number,
    always = false,
    rain = false,
  ): NoteEvent[] | null {
    const slots = layer.phrases![sectionId];
    if (!slots || slots.length === 0) return [];
    // Decide once per section whether this melody rests, then pick a phrase at each slot start.
    if (bar === 0 || !this.current.has(layer.id)) {
      // An intro (the title sting) always plays; the rng is still drawn so the sequence stays the same.
      this.resting.set(layer.id, rng() < (layer.rest ?? 0) + (rain ? RAIN_REST : 0) && !always);
      this.current.delete(layer.id);
    }
    let start = 0;
    let slot = -1;
    for (let i = 0; i < slots.length; i++) {
      const len = this.phrases.get(slots[i]![0]!)!.bars;
      if (bar < start + len) {
        slot = i;
        break;
      }
      start += len;
    }
    if (slot < 0) return [];
    let cur = this.current.get(layer.id);
    if (!cur || cur.start !== start) {
      const pool = slots[slot]!;
      const key = `${layer.id}:${sectionId}:${slot}`;
      const options = pool.length > 1 ? pool.filter((p) => p !== this.last.get(key)) : pool;
      const id = options[Math.floor(rng() * options.length)]!;
      this.last.set(key, id);
      cur = { id: this.resting.get(layer.id) ? null : id, start };
      this.current.set(layer.id, cur);
    }
    if (!cur.id) return [];
    const phrase = this.phrases.get(cur.id)!;
    const meter = this.piece.meter;
    const from = (bar - cur.start) * meter;
    const out: NoteEvent[] = [];
    for (const n of phrase.notes) {
      if (n.midi === null || n.beat < from || n.beat >= from + meter) continue;
      const beat = this.swing(n.beat - from);
      const vel = Math.min(1, (0.72 + rng() * 0.12) * n.accent * (layer.gain ?? 1));
      out.push({ layer: layer.id, inst: layer.inst, time: layer.time, beat, jitter: 0, midi: n.midi, perc: false, beats: n.beats, vel });
    }
    return out;
  }

  private patternFor(layer: Layer, section: ParsedSection, bar: number, rng: () => number, opt: BarOptions): NoteEvent[] {
    const steps = this.patterns[layer.pattern!]!;
    const meter = this.piece.meter;
    const patBars = Math.floor(Math.max(...steps.map((s) => s[0])) / meter) + 1;
    const from = (bar % patBars) * meter;
    const out: NoteEvent[] = [];
    const perc = PERC.has(layer.inst);
    const isBass = !!layer.bass;
    for (const [b, tones, beats, vel] of steps) {
      if (vel <= 0 || b < from || b >= from + meter) continue;
      const beatInBar = b - from;
      // Rain thins the accompaniment to the main beats (1 and 3, or the downbeat in 3/4).
      if (opt.rain && !isBass && (Math.abs(beatInBar - Math.round(beatInBar)) > 1e-6 || Math.round(beatInBar) % 2 === 1))
        continue;
      const chord = chordAt(section.chords, bar * meter + beatInBar).chord;
      const v = Math.min(1, vel * (0.9 + rng() * 0.2) * (layer.gain ?? 1));
      const list = Array.isArray(tones) ? tones : [tones];
      // Spread chord tones a little, like a hand on a harp or piano (tiny strum).
      list.forEach((t, k) => {
        let midi: number;
        if (perc) midi = Math.floor(rng() * Math.max(1, opt.percHits(layer.inst)));
        else if (isBass) {
          const root = bassNote(chord, layer.anchor ?? 36);
          const fifth = chord.tones.includes(7) ? 7 : chord.tones.includes(6) ? 6 : 7;
          const third = chord.tones.find((x) => x === 3 || x === 4) ?? 4;
          midi = [root, root + fifth, root + 12, root + third][t] ?? root;
        } else midi = voiceTone(voicing(chord, layer.anchor ?? 60), t);
        out.push({
          layer: layer.id,
          inst: layer.inst,
          time: layer.time,
          beat: this.swing(beatInBar) + k * 0.03,
          jitter: 0,
          midi,
          perc,
          beats,
          vel: v,
        });
      });
    }
    return out;
  }

  private swing(beat: number): number {
    const s = this.piece.swing ?? 0;
    const frac = beat - Math.floor(beat);
    return Math.abs(frac - 0.5) < 1e-6 ? beat + s * 0.5 : beat;
  }
}

/**
 * Scheduler catch-up: if the next bar is already late (a GC pause, a stalled tab), skip to the next
 * bar boundary on the same grid instead of firing a burst of past notes.
 */
export function catchUp(nextBar: number, now: number, barLen: number, tolerance = 0.05): number {
  if (nextBar >= now - tolerance) return nextBar;
  const missed = Math.ceil((now - nextBar) / barLen);
  return nextBar + missed * barLen;
}
