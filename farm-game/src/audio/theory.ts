/** Tiny music theory for the sequencer: note names, chord symbols and phrase strings. Pure. */

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4" -> 60, "F#3" -> 54, "Bb2" -> 46. Throws on anything else (content typos must fail loudly). */
export function noteToMidi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return LETTERS[m[1]!]! + acc + (Number(m[3]) + 1) * 12;
}

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Chord qualities as semitones above the root. */
const QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  dim: [0, 3, 6],
  m7b5: [0, 3, 6, 10],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
};

export interface Chord {
  /** Pitch class of the root, 0..11. */
  root: number;
  /** Semitones above the root. */
  tones: number[];
  /** Pitch class of the bass note (slash chords), else the root. */
  bass: number;
  symbol: string;
}

/** "Am7", "F/C", "Gsus4", "Bbmaj7" -> chord. Throws on unknown symbols. */
export function parseChord(symbol: string): Chord {
  const m = /^([A-G])([#b]?)([a-z0-9]*)(?:\/([A-G])([#b]?))?$/.exec(symbol);
  if (!m) throw new Error(`bad chord "${symbol}"`);
  const pc = (l: string, a: string) => (LETTERS[l]! + (a === '#' ? 1 : a === 'b' ? -1 : 0) + 12) % 12;
  const tones = QUALITIES[m[3]!];
  if (!tones) throw new Error(`unknown chord quality "${m[3]}" in "${symbol}"`);
  const root = pc(m[1]!, m[2]!);
  return { root, tones, bass: m[4] ? pc(m[4], m[5] ?? '') : root, symbol };
}

/** A chord change at a beat offset inside a section. */
export interface ChordAt {
  beat: number;
  beats: number;
  chord: Chord;
}

/** "C | Am | Dm7 G7 | C" -> one entry per chord, with beat offsets (meter beats per bar). */
export function parseChords(line: string, meter: number): { bars: number; chords: ChordAt[] } {
  const bars = line.split('|').map((b) => b.trim());
  const chords: ChordAt[] = [];
  bars.forEach((bar, i) => {
    const syms = bar.split(/\s+/).filter(Boolean);
    if (syms.length === 0 || syms.length > 2) throw new Error(`bar ${i + 1} needs 1 or 2 chords: "${bar}"`);
    const each = meter / syms.length;
    syms.forEach((s, j) => chords.push({ beat: i * meter + j * each, beats: each, chord: parseChord(s) }));
  });
  return { bars: bars.length, chords };
}

/** The chord sounding at a beat (beats past the end wrap). */
export function chordAt(chords: ChordAt[], beat: number): ChordAt {
  let hit = chords[0]!;
  for (const c of chords) if (c.beat <= beat + 1e-9) hit = c;
  return hit;
}

/**
 * Voice a chord from an anchor: the chord tones (as pitches) starting at the lowest chord tone at
 * or above `anchor`, ascending. Index i>=n continues an octave up. Moving the anchor never jumps
 * more than a fourth or so between neighbouring chords, so this doubles as simple voice leading.
 */
export function voicing(chord: Chord, anchor: number): number[] {
  const pcs = [...new Set(chord.tones.map((t) => (chord.root + t) % 12))];
  const out = pcs.map((pc) => {
    let n = anchor - (((anchor % 12) + 12) % 12) + pc;
    if (n < anchor) n += 12;
    return n;
  });
  return out.sort((a, b) => a - b);
}

export function voiceTone(v: number[], index: number): number {
  const n = v.length;
  const oct = Math.floor(index / n);
  return v[((index % n) + n) % n]! + 12 * oct;
}

/** The bass note of a chord in the octave at or above `anchor`. */
export function bassNote(chord: Chord, anchor: number): number {
  let n = anchor - (((anchor % 12) + 12) % 12) + chord.bass;
  if (n < anchor) n += 12;
  return n;
}

export interface PhraseNote {
  beat: number;
  beats: number;
  /** MIDI note, or null for a rest. */
  midi: number | null;
  /** Accent from a trailing '!' (louder) or '~' (softer). */
  accent: number;
}

/**
 * "E5:1 D5:.5 C5:.5 | G5:2 r:2" -> notes with beat offsets. Every bar must add up to `meter`
 * beats (so a typo in a duration fails the content test instead of drifting the melody).
 */
export function parsePhrase(text: string, meter: number): { bars: number; notes: PhraseNote[] } {
  const bars = text.split('|').map((b) => b.trim());
  const notes: PhraseNote[] = [];
  bars.forEach((bar, i) => {
    let t = 0;
    for (const tok of bar.split(/\s+/).filter(Boolean)) {
      const m = /^(r|[A-G][#b]?-?\d):(\d*\.?\d+)([!~]?)$/.exec(tok);
      if (!m) throw new Error(`bad phrase token "${tok}" in bar ${i + 1}`);
      const beats = Number(m[2]);
      notes.push({
        beat: i * meter + t,
        beats,
        midi: m[1] === 'r' ? null : noteToMidi(m[1]!),
        accent: m[3] === '!' ? 1.2 : m[3] === '~' ? 0.75 : 1,
      });
      t += beats;
    }
    if (Math.abs(t - meter) > 1e-6) throw new Error(`bar ${i + 1} has ${t} beats, expected ${meter}: "${bar}"`);
  });
  return { bars: bars.length, notes };
}

/** Free-running note list without bar lines (jingles): "C5:.5 E5:.5 r:1 G5:2". */
export function parseNotes(text: string): PhraseNote[] {
  let t = 0;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const m = /^(r|[A-G][#b]?-?\d):(\d*\.?\d+)$/.exec(tok);
      if (!m) throw new Error(`bad note token "${tok}"`);
      const beats = Number(m[2]);
      const n: PhraseNote = { beat: t, beats, midi: m[1] === 'r' ? null : noteToMidi(m[1]!), accent: 1 };
      t += beats;
      return n;
    });
}
