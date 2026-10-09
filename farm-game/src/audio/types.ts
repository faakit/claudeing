/**
 * Types for the audio data: the generated asset manifest (src/audio/manifest.json, written by
 * audio-src/tools/build.py) and the hand-written music (src/audio/music.json).
 * Everything here is plain data so it can be validated and unit tested without Web Audio.
 */

/** One sample of a pitched instrument. Times are seconds from the start of the file. */
export interface Zone {
  file: string;
  /** Measured pitch of the sample as a (fractional) MIDI note. */
  root?: number;
  /** Where the attack starts in the source (decoders may add a few ms of priming silence before it). */
  onset: number;
  dur: number;
  /** Seconds a slow (bowed, blown) attack needs to speak; the note is started this much early. */
  lag?: number;
  /** True peak of the encoded file, dBTP (sound effects; tests check the output peak at default volume). */
  tp?: number;
  /** Sustain loop [start, end]; the region after `end` repeats the loop start, so small shifts stay seamless. */
  loop?: [number, number];
}

export interface InstrumentAsset {
  kind: 'decay' | 'sustain' | 'perc';
  zones?: Zone[];
  hits?: Zone[];
}

/** A sound effect cue: several takes of the same sound, chosen at random, with small variations. */
export interface SfxAsset {
  files: Zone[];
  /** Linear gain applied at playback (loudness was already matched at build time). */
  gain: number;
  /** Random pitch spread, +- semitones. */
  pitch: number;
  /** Random volume spread, +- dB. */
  vol: number;
  /** At most this many copies of the cue sound at once; the oldest is faded out to make room. */
  voices: number;
  /** Level change (dB) for a repeat within 350 ms of the last one (held tools). Default -4; steps 0. */
  repeatDb?: number;
  /** Repeats closer than this (seconds) are dropped: a fast drag over a row ticks at most this often. */
  minGap?: number;
  /** Cues this one silences for `maskFor` seconds after it plays (a row tick hides the footstep on that tile). */
  masks?: string[];
  maskFor?: number;
}

/** A looping ambience bed or a pool of one-shots (birds, drips). */
export interface AmbienceAsset {
  files: Zone[];
  gain: number;
  /** 'loop' plays files[0] as a seamless bed; 'shots' scatters the files at random times. */
  mode: 'loop' | 'shots';
  /** For shots: mean seconds between two shots at full intensity. */
  every?: number;
}

export interface AudioManifest {
  instruments: Record<string, InstrumentAsset>;
  sfx: Record<string, SfxAsset>;
  ambience: Record<string, AmbienceAsset>;
}

/** Mixer defaults for an instrument when used in music. */
export interface InstrumentMix {
  /** Linear gain at velocity 1. */
  gain: number;
  pan?: number;
  /** Reverb send, 0..1. */
  reverb?: number;
  /** Release time in seconds after the note ends. */
  release?: number;
  /** Attack time in seconds (sustained instruments fade in). */
  attack?: number;
}

/** [beat, chord tone index (or several), duration in beats, velocity 0..1] */
export type PatternStep = [number, number | number[], number, number];

export type LayerTime = 'day' | 'night' | 'both';

export interface Layer {
  id: string;
  inst: string;
  time: LayerTime;
  /** Accompaniment: a named pattern played on the current chord. */
  pattern?: string;
  /** MIDI note the chord voicing starts from (lowest chord tone at or above it). */
  anchor?: number;
  /** Bass line: pattern tones are 0 root (or slash bass), 1 fifth, 2 octave, 3 third. */
  bass?: boolean;
  /**
   * Melody: per section, a list of phrase slots that fill the section in order; each slot is a pool
   * of composed phrases of equal length, one picked at random (never the same twice in a row).
   */
  phrases?: Record<string, string[][]>;
  /** Chance (0..1) that the melody sits a section out. */
  rest?: number;
  gain?: number;
  /** Not played indoors (percussion, busy parts). */
  outdoorOnly?: boolean;
  /** Sections where this layer is silent (e.g. the breathing section R). */
  tacet?: string[];
}

export interface Section {
  /** Chord symbols, bars separated by '|', up to two chords per bar. */
  chords: string;
}

export interface Piece {
  /** Declared key and mode ("D mixolydian"), for the analysis tools and tests; not used at runtime. */
  key?: string;
  /** Transposition (semitones from C major) for event jingles so they sit in this piece's key. */
  jingleKey: number;
  /** Mix level of the whole piece, dB (pieces are balanced against each other from offline renders). */
  level?: number;
  /** Extra level for the night layers, dB (night arrangements are sparser). */
  nightLevel?: number;
  bpm: number;
  meter: number;
  /** Swing amount for off-beat eighths, 0..0.3 of an eighth. */
  swing?: number;
  sections: Record<string, Section>;
  /** Sections played once, the first time the piece starts (a sting), before the form loops. */
  intro?: string[];
  form: string[];
  /** The form from year two on (variation sections), so the second year does not repeat the first. */
  form2?: string[];
  layers: Layer[];
  /** Melody phrases in note:beats tokens, bars separated by '|'. */
  phrases: Record<string, string>;
}

/** A short fanfare played by the sampler for a game event (level up, goal...). Written in C major. */
export interface Jingle {
  bpm: number;
  /** Playback level (default 1): motifs and flourishes sit under the event fanfares. */
  volume?: number;
  /** Default 1. A jingle silences or drops a lower-priority one within a second of it. */
  priority?: number;
  parts: { inst: string; notes: string; gain?: number }[];
}

export interface MusicData {
  instruments: Record<string, InstrumentMix>;
  patterns: Record<string, PatternStep[]>;
  jingles: Record<string, Jingle>;
  /** Musical moments the engine plays itself (villager motifs, dawn and dusk, season and festival stings). */
  stings: Record<string, Jingle>;
  pieces: Record<string, Piece>;
}

/** Where music can be: one piece per slot. */
export type MusicSlot =
  | 'title'
  | 'spring'
  | 'summer'
  | 'fall'
  | 'winter'
  | 'mine'
  | 'festival'
  | 'shop'
  | 'lullaby';

export const MUSIC_SLOTS: readonly MusicSlot[] = [
  'title',
  'spring',
  'summer',
  'fall',
  'winter',
  'mine',
  'festival',
  'shop',
  'lullaby',
];
