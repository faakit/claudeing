import { describe, expect, it } from 'vitest';
import { MANIFEST, MUSIC, sampleFor } from '../src/audio/assets';
import { PiecePlayer, catchUp, makeRng } from '../src/audio/sequencer';
import type { BarOptions } from '../src/audio/sequencer';
import {
  bassNote,
  chordAt,
  noteToMidi,
  parseChord,
  parseChords,
  parseNotes,
  parsePhrase,
  voiceTone,
  voicing,
} from '../src/audio/theory';
import type { PhraseNote } from '../src/audio/theory';
import { MUSIC_SLOTS } from '../src/audio/types';
import { maxShift, pickZone } from '../src/audio/zones';
import { SEASONS } from '../src/state/GameState';

const ALL: BarOptions = { indoor: false, day: true, night: true, percHits: () => 3 };

describe('music theory helpers', () => {
  it('reads notes and chords', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('F#3')).toBe(54);
    expect(noteToMidi('Bb2')).toBe(46);
    expect(() => noteToMidi('H2')).toThrow();
    expect(parseChord('Am7').tones).toEqual([0, 3, 7, 10]);
    expect(parseChord('F/C').bass).toBe(0);
    expect(() => parseChord('Cfoo')).toThrow();
  });
  it('voices chords upward from an anchor and finds the bass note', () => {
    expect(voicing(parseChord('C'), 55)).toEqual([55, 60, 64]);
    expect(voiceTone(voicing(parseChord('C'), 60), 3)).toBe(72);
    expect(bassNote(parseChord('G'), 40)).toBe(43);
  });
  it('rejects a phrase bar that does not add up', () => {
    expect(() => parsePhrase('C5:1 D5:1 | E5:4', 4)).toThrow(/bar 1/);
    expect(parsePhrase('C5:2 r:2 | E5:4', 4).notes.filter((n) => n.midi !== null)).toHaveLength(2);
  });
});

describe('composed music data', () => {
  it('has a piece for every music slot and every season', () => {
    for (const s of MUSIC_SLOTS) expect(MUSIC.pieces[s], s).toBeDefined();
    for (const s of SEASONS) expect(MUSIC.pieces[s], s).toBeDefined();
  });

  it('every piece is well formed: sections, form, patterns, phrases and instruments exist', () => {
    for (const [name, p] of Object.entries(MUSIC.pieces)) {
      expect(p.bpm, name).toBeGreaterThan(40);
      expect(p.bpm, name).toBeLessThan(130);
      const bars: Record<string, number> = {};
      for (const [id, sec] of Object.entries(p.sections)) bars[id] = parseChords(sec.chords, p.meter).bars;
      for (const s of [...(p.intro ?? []), ...p.form]) expect(bars[s], `${name} form ${s}`).toBeDefined();
      for (const l of p.layers) {
        expect(MANIFEST.instruments[l.inst], `${name}.${l.id} ${l.inst}`).toBeDefined();
        expect(MUSIC.instruments[l.inst], `${name}.${l.id} mix`).toBeDefined();
        expect(!!l.pattern !== !!l.phrases, `${name}.${l.id} needs a pattern or phrases`).toBe(true);
        if (l.pattern) {
          const steps = MUSIC.patterns[l.pattern];
          expect(steps, `${name}.${l.id} ${l.pattern}`).toBeDefined();
          const span = Math.floor(Math.max(...steps!.map((s) => s[0])) / p.meter) + 1;
          for (const sec of Object.values(bars)) expect(sec % span, `${name}.${l.id} pattern bars`).toBe(0);
        }
        for (const [sec, slots] of Object.entries(l.phrases ?? {})) {
          expect(bars[sec], `${name}.${l.id} section ${sec}`).toBeDefined();
          let total = 0;
          for (const pool of slots) {
            const lens = pool.map((id) => {
              expect(p.phrases[id], `${name} phrase ${id}`).toBeDefined();
              return parsePhrase(p.phrases[id]!, p.meter).bars;
            });
            expect(new Set(lens).size, `${name}.${l.id} ${sec} slot lengths`).toBe(1);
            total += lens[0]!;
          }
          expect(total, `${name}.${l.id} ${sec} fills the section`).toBe(bars[sec]);
        }
      }
    }
  });

  it('never asks a sample to shift further than it can sound right (4 st, mallets/plucks 6 st)', () => {
    const check = (inst: string, midi: number, where: string) => {
      const a = MANIFEST.instruments[inst]!;
      if (a.kind === 'perc') return;
      const { shift } = pickZone(a.zones!, midi);
      expect(Math.abs(shift), `${where}: ${inst} note ${midi} shifts ${shift.toFixed(2)} st`).toBeLessThanOrEqual(
        maxShift(inst, a) + 1e-9,
      );
    };
    for (const [name, p] of Object.entries(MUSIC.pieces)) {
      for (const l of p.layers) {
        if (l.phrases)
          for (const slots of Object.values(l.phrases))
            for (const pool of slots)
              for (const id of pool)
                for (const n of parsePhrase(p.phrases[id]!, p.meter).notes) if (n.midi !== null) check(l.inst, n.midi, `${name}.${id}`);
        if (l.pattern) {
          for (const sec of Object.values(p.sections))
            for (const c of parseChords(sec.chords, p.meter).chords)
              for (const step of MUSIC.patterns[l.pattern]!) {
                const tones = Array.isArray(step[1]) ? step[1] : [step[1]];
                for (const t of tones) {
                  if (l.bass) {
                    const root = bassNote(c.chord, l.anchor ?? 36);
                    for (const m of [root, root + 7, root + 12, root + 4]) check(l.inst, m, `${name}.${l.id} bass`);
                  } else check(l.inst, voiceTone(voicing(c.chord, l.anchor ?? 60), t), `${name}.${l.id} ${c.chord.symbol}`);
                }
              }
        }
      }
    }
    // Jingles are written in C and transposed into the key of whatever piece is playing.
    for (const [cue, j] of Object.entries(MUSIC.jingles))
      for (const p of Object.values(MUSIC.pieces))
        for (const part of j.parts)
          for (const n of parseNotes(part.notes)) if (n.midi !== null) check(part.inst, n.midi + p.jingleKey, `jingle ${cue}`);
  });

  it('every jingle instrument has samples', () => {
    for (const [cue, j] of Object.entries(MUSIC.jingles))
      for (const p of j.parts) expect(sampleFor(p.inst, 72, false), `${cue} ${p.inst}`).not.toBeNull();
  });
});

describe('sequencer', () => {
  const bars = (slot: string, n: number, seed = 1, opt: BarOptions = ALL) => {
    const p = new PiecePlayer(MUSIC.pieces[slot]!, MUSIC.patterns);
    const rng = makeRng(seed);
    return Array.from({ length: n }, () => p.nextBar(rng, opt));
  };

  it('is deterministic for a seed and varies with it', () => {
    const a = JSON.stringify(bars('spring', 40, 5));
    expect(JSON.stringify(bars('spring', 40, 5))).toBe(a);
    expect(JSON.stringify(bars('spring', 40, 6))).not.toBe(a);
  });

  it('keeps every note inside its bar and walks the form', () => {
    for (const slot of MUSIC_SLOTS) {
      const piece = MUSIC.pieces[slot]!;
      const out = bars(slot, 80);
      for (const b of out)
        for (const e of b.events) {
          expect(e.beat, slot).toBeGreaterThanOrEqual(0);
          expect(e.beat, slot).toBeLessThan(piece.meter + 0.2);
          expect(e.vel, slot).toBeGreaterThan(0);
          expect(e.vel, slot).toBeLessThanOrEqual(1);
          expect(Math.abs(e.jitter), slot).toBeLessThanOrEqual(0.008);
        }
      expect(new Set(out.map((b) => b.section)), slot).toEqual(new Set([...(piece.intro ?? []), ...piece.form]));
    }
  });

  it('does not repeat a phrase back to back and lets melodies rest sometimes', () => {
    const p = new PiecePlayer(MUSIC.pieces['spring']!, MUSIC.patterns);
    const rng = makeRng(3);
    const firstNotes: string[] = [];
    let rested = 0;
    for (let i = 0; i < 36 * 12; i++) {
      const b = p.nextBar(rng, ALL);
      if (b.section === 'A' && (b.bar === 0 || b.bar === 4)) {
        const tune = b.events.filter((e) => e.layer === 'tune');
        if (tune.length === 0) rested++;
        firstNotes.push(`${b.bar}:${tune.map((e) => e.midi).join(',')}`);
      }
    }
    expect(rested).toBeGreaterThan(0);
    expect(rested).toBeLessThan(firstNotes.length / 2);
    expect(new Set(firstNotes).size).toBeGreaterThan(3);
  });

  it('drops outdoor-only layers indoors and the silent bus layers', () => {
    const count = (opt: BarOptions, layer: string) =>
      bars('spring', 16, 1, opt).flatMap((b) => b.events).filter((e) => e.layer === layer).length;
    expect(count(ALL, 'shaker')).toBeGreaterThan(0);
    expect(count({ ...ALL, indoor: true }, 'shaker')).toBe(0);
    expect(count({ ...ALL, night: false }, 'pad')).toBe(0);
    expect(count({ ...ALL, day: false }, 'comp')).toBe(0);
  });

  it('plays an intro once, with every melody layer, then loops the form', () => {
    const piece = MUSIC.pieces['title']!;
    expect(piece.intro, 'the title has a sting').toBeDefined();
    for (let seed = 1; seed < 12; seed++) {
      const out = bars('title', 60, seed);
      const introBars = piece.intro!.reduce((n, s) => n + parseChords(piece.sections[s]!.chords, piece.meter).bars, 0);
      expect(out.slice(0, introBars).map((b) => b.section)).toEqual(
        piece.intro!.flatMap((s) => Array(parseChords(piece.sections[s]!.chords, piece.meter).bars).fill(s)),
      );
      expect(out.slice(introBars).some((b) => piece.intro!.includes(b.section))).toBe(false);
      expect(out[0]!.events.some((e) => e.layer === 'tune'), `seed ${seed}`).toBe(true);
    }
  });

  it('skips ahead to the next bar boundary after a stall instead of bursting late notes', () => {
    expect(catchUp(10, 10.02, 2)).toBe(10);
    expect(catchUp(10, 15.5, 2)).toBe(16);
    expect(catchUp(10, 16, 2)).toBe(16);
  });
});

/**
 * The critic's round-2 finding F20: spring, summer, title and festival shared one progression and
 * cadence (summer was spring a tone up), fall and winter another. These checks keep the pieces apart.
 * audio-src/tools/seasons.py prints the same numbers as a table (and measures renders).
 */
describe('each piece has its own harmony and melodies', () => {
  const NAMES = ['spring', 'summer', 'fall', 'winter', 'title', 'festival'] as const;
  const SEASON_NAMES = ['spring', 'summer', 'fall', 'winter'] as const;
  type Note = PhraseNote & { midi: number };
  const piece = (n: string) => MUSIC.pieces[n]!;
  const tonicOf = (n: string) => {
    const k = piece(n).key;
    expect(k, `${n} declares its key`).toMatch(/^[A-G][#b]? (major|minor|mixolydian|dorian|lydian)$/);
    return parseChord(k!.split(' ')[0]!).root;
  };
  /** Triad class for bigrams: sus, dim, min or maj. */
  const triad = (q: number[]) =>
    !q.includes(3) && !q.includes(4) ? 'sus' : q.includes(3) && q.includes(6) ? 'dim' : q.includes(3) ? 'min' : 'maj';
  const chordsOf = (n: string, sec: string) => parseChords(piece(n).sections[sec]!.chords, piece(n).meter).chords;
  const deg = (n: string, pc: number, shift = 0) => (pc - tonicOf(n) + shift + 24) % 12;
  const token = (n: string, c: { root: number; tones: number[]; bass: number }) =>
    `${deg(n, c.root)}:${c.tones.join('.')}${c.bass !== c.root ? `/${deg(n, c.bass)}` : ''}`;
  const bigrams = (n: string, shift = 0) => {
    const seq = piece(n).form.flatMap((s) => chordsOf(n, s).map((c) => `${deg(n, c.chord.root, shift)}${triad(c.chord.tones)}`));
    seq.push(seq[0]!);
    const out = new Set<string>();
    for (let i = 0; i + 1 < seq.length; i++) if (seq[i] !== seq[i + 1]) out.add(`${seq[i]}>${seq[i + 1]}`);
    return out;
  };
  const phraseIds = (n: string, time?: string) => [
    ...new Set(
      piece(n)
        .layers.filter((l) => l.phrases && (!time || l.time === time || l.time === 'both'))
        .flatMap((l) => Object.values(l.phrases!).flat(2)),
    ),
  ];
  const notesOf = (n: string, id: string): Note[] =>
    parsePhrase(piece(n).phrases[id]!, piece(n).meter).notes.filter((x): x is Note => x.midi !== null);
  const trigrams = (n: string) => {
    const out = new Set<string>();
    for (const id of phraseIds(n)) {
      const m = notesOf(n, id).map((x) => x.midi);
      for (let i = 0; i + 3 < m.length; i++) out.add(`${m[i + 1]! - m[i]!},${m[i + 2]! - m[i + 1]!},${m[i + 3]! - m[i + 2]!}`);
    }
    return out;
  };
  const features = (n: string) => {
    const ids = phraseIds(n, 'day');
    const notes = ids.map((id) => notesOf(n, id));
    const beats = ids.reduce((s, id) => s + parsePhrase(piece(n).phrases[id]!, piece(n).meter).bars * piece(n).meter, 0);
    const flat = notes.flat();
    const ivs = notes.flatMap((ns) => ns.slice(1).map((x, i) => Math.abs(x.midi - ns[i]!.midi)));
    const mids = flat.map((x) => x.midi).sort((a, b) => a - b);
    const h = mids.length / 2;
    const median = mids.length % 2 ? mids[Math.floor(h)]! : (mids[h - 1]! + mids[h]!) / 2;
    return {
      npb: flat.length / beats,
      median,
      leap: ivs.filter((i) => i > 2).length / ivs.length,
      range: mids[mids.length - 1]! - mids[0]!,
      sync: flat.filter((x) => Math.abs(x.beat - Math.round(x.beat)) > 1e-6).length / flat.length,
    };
  };
  function pairs<T>(xs: readonly T[]): (readonly [T, T])[] {
    return xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as const));
  }

  it('no two pieces share an A-section progression or a cadence (Roman numerals)', () => {
    const progs = NAMES.map((n) => chordsOf(n, 'A').map((c) => token(n, c.chord)).join(' '));
    expect(new Set(progs).size).toBe(NAMES.length);
    const cadences = NAMES.map((n) => chordsOf(n, 'A').slice(-3).map((c) => token(n, c.chord)).join(' '));
    expect(new Set(cadences).size).toBe(NAMES.length);
  });

  it('chord-bigram overlap is at most 0.4 for every pair, in any key', () => {
    for (const [a, b] of pairs(NAMES)) {
      const A = bigrams(a);
      let worst = 0;
      for (let s = 0; s < 12; s++) {
        const B = bigrams(b, s);
        const inter = [...A].filter((x) => B.has(x)).length;
        worst = Math.max(worst, inter / new Set([...A, ...B]).size);
      }
      expect(worst, `${a}-${b}`).toBeLessThanOrEqual(0.4);
    }
  });

  it('melodies share at most 25% of their interval 3-grams, so none is another transposed', () => {
    for (const [a, b] of pairs(NAMES)) {
      const A = trigrams(a);
      const B = trigrams(b);
      const inter = [...A].filter((x) => B.has(x)).length;
      expect(inter / Math.min(A.size, B.size), `${a}-${b}`).toBeLessThanOrEqual(0.25);
    }
  });

  it('every season tune differs from every other in at least two melodic features', () => {
    const f = Object.fromEntries(SEASON_NAMES.map((n) => [n, features(n)]));
    for (const [a, b] of pairs(SEASON_NAMES)) {
      const x = f[a]!;
      const y = f[b]!;
      const diff = [
        Math.abs(x.npb - y.npb) > 0.2 * Math.max(x.npb, y.npb),
        Math.abs(x.median - y.median) > 3,
        Math.abs(x.leap - y.leap) > 0.1,
        Math.abs(x.range - y.range) > 4,
        Math.abs(x.sync - y.sync) > 0.1,
      ].filter(Boolean).length;
      expect(diff, `${a}-${b} ${JSON.stringify([x, y])}`).toBeGreaterThanOrEqual(2);
    }
    // Summer is the bright one; fall and winter are minor and slower than spring.
    expect(f.summer!.median - f.spring!.median).toBeGreaterThanOrEqual(2);
    for (const n of ['fall', 'winter']) {
      expect(piece(n).key).toMatch(/minor|dorian/);
      expect(piece(n).bpm).toBeLessThan(piece('spring').bpm);
    }
  });

  it('melody notes on a beat are chord tones, or resolve by step to the next note', () => {
    for (const [name, p] of Object.entries(MUSIC.pieces))
      for (const l of p.layers)
        for (const [sec, slots] of Object.entries(l.phrases ?? {})) {
          const chords = parseChords(p.sections[sec]!.chords, p.meter).chords;
          let start = 0;
          for (const pool of slots) {
            for (const id of pool) {
              const ns = notesOf(name, id);
              ns.forEach((n, k) => {
                if (Math.abs(n.beat - Math.round(n.beat)) > 1e-6) return;
                const c = chordAt(chords, start * p.meter + n.beat).chord;
                const tones = new Set([...c.tones.map((t) => (c.root + t) % 12), c.bass]);
                if (tones.has(n.midi % 12)) return;
                const next = ns[k + 1]?.midi;
                expect(next !== undefined && Math.abs(next - n.midi) <= 2, `${name}.${id} beat ${n.beat} over ${c.symbol}`).toBe(true);
              });
            }
            start += parsePhrase(p.phrases[pool[0]!]!, p.meter).bars;
          }
        }
  });

  it('voicings never stack two notes a semitone apart', () => {
    for (const p of Object.values(MUSIC.pieces))
      for (const l of p.layers)
        if (l.pattern && !l.bass)
          for (const sec of Object.values(p.sections))
            for (const c of parseChords(sec.chords, p.meter).chords) {
              const v = voicing(c.chord, l.anchor ?? 60);
              for (let i = 0; i + 1 < v.length; i++) expect(v[i + 1]! - v[i]!, c.chord.symbol).toBeGreaterThan(1);
            }
    expect(voicing(parseChord('Fmaj7'), 64)).toEqual([65, 69, 72, 76]);
  });
});
