import { describe, expect, it } from 'vitest';
import { MANIFEST, MUSIC, sampleFor } from '../src/audio/assets';
import { PiecePlayer, catchUp, makeRng } from '../src/audio/sequencer';
import type { BarOptions } from '../src/audio/sequencer';
import {
  bassNote,
  noteToMidi,
  parseChord,
  parseChords,
  parseNotes,
  parsePhrase,
  voiceTone,
  voicing,
} from '../src/audio/theory';
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
      for (const s of p.form) expect(bars[s], `${name} form ${s}`).toBeDefined();
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
      expect(new Set(out.map((b) => b.section)), slot).toEqual(new Set(piece.form));
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

  it('skips ahead to the next bar boundary after a stall instead of bursting late notes', () => {
    expect(catchUp(10, 10.02, 2)).toBe(10);
    expect(catchUp(10, 15.5, 2)).toBe(16);
    expect(catchUp(10, 16, 2)).toBe(16);
  });
});
