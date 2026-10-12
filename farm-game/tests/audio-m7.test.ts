import { describe, expect, it } from 'vitest';
import { MANIFEST, MUSIC, instrumentFiles } from '../src/audio/assets';
import { SampleBank } from '../src/audio/bank';
import { MomentClock, chooseAmbience, type Scene } from '../src/audio/director';
import { LIMITER_MAKEUP_DB, K_SFX } from '../src/audio/graph';
import { SOFT_AFTER, SfxPlayer } from '../src/audio/sfx';
import { STAGE_AUDIO, waterBeds } from '../src/audio/stages';
import { parseNotes } from '../src/audio/theory';
import { SFX_IDS } from '../src/platform/audio';
import { createInitialState } from '../src/state/GameState';
import { FakeAudioContext, FakeGain, GOOD_BYTES, asCtx } from './fakeAudio';

const TOW = ['logHook', 'logTug', 'logKnock', 'logLand'] as const;

/** A player whose random spread is zero (rng 0.5), and the peak gain of the voice each play starts. */
async function player() {
  const ctx = new FakeAudioContext();
  const sfx = new SfxPlayer(
    asCtx(ctx),
    new SampleBank('x/', async () => GOOD_BYTES()),
    new FakeGain(ctx, 'gain') as unknown as AudioNode,
    () => 0.5,
  );
  await sfx.preload(0);
  const gainOf = (cue: string, at: number): number => {
    const n = ctx.created.length;
    expect(sfx.play(cue, at), cue).toBe(true);
    const env = ctx.created.slice(n).find((x) => x.kind === 'gain') as FakeGain | undefined;
    return env!.gain.value;
  };
  return { sfx, gainOf };
}
const db = (x: number) => 20 * Math.log10(x);

describe('M7 tow cues', () => {
  it('has the four tow cues as recorded takes (3 or more each) with a synth fallback id', () => {
    for (const c of TOW) {
      expect(SFX_IDS, c).toContain(c);
      expect(MANIFEST.sfx[c]!.files.length, c).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every tow take at or under -4.6 dBTP at the output, at its loudest spread (critic D8)', () => {
    const bus = createInitialState().settings.sfx * K_SFX;
    for (const c of TOW) {
      const a = MANIFEST.sfx[c]!;
      for (const z of a.files) {
        const out = z.tp! + 20 * Math.log10(a.gain * bus) + a.vol + LIMITER_MAKEUP_DB;
        expect(out, `${c} ${z.file}`).toBeLessThanOrEqual(-4.6);
      }
    }
  });

  it('keeps the hook short (250 ms) and the tug shorter than the quickest second tug (277 ms + its tail)', () => {
    for (const z of MANIFEST.sfx['logHook']!.files) expect(z.dur).toBeLessThanOrEqual(0.26);
    for (const z of MANIFEST.sfx['logTug']!.files) expect(z.dur).toBeLessThanOrEqual(0.31);
  });

  it('never softens a second tug: the freeing tug is the one that matters', async () => {
    const { gainOf } = await player();
    const first = gainOf('logTug', 1);
    expect(gainOf('logTug', 1.277)).toBeCloseTo(first, 6);
  });
});

describe('the water repeat window', () => {
  it('softens watering repeated within 0.5 s (a painted row, 0.45 s apart), but never drops it', async () => {
    const { gainOf } = await player();
    const one = gainOf('water', 1);
    const again = gainOf('water', 1.45);
    expect(db(one / again)).toBeCloseTo(4, 1);
    // a held can (0.2 s) still pours: every repeat plays
    for (let i = 1; i <= 10; i++) expect(gainOf('water', 1.45 + i * 0.2)).toBeGreaterThan(0);
    // and a can 0.6 s later is a fresh one
    expect(gainOf('water', 4)).toBeCloseTo(one, 6);
  });

  it('plays the water a wet channel cut lets in 9 dB under the cut (dig first, the same frame)', async () => {
    const { gainOf } = await player();
    gainOf('dig', 1);
    const wet = gainOf('water', 1);
    const { gainOf: fresh } = await player();
    const dry = fresh('water', 1);
    expect(db(dry / wet)).toBeCloseTo(9, 1);
    // only right after the cut
    const window = MANIFEST.sfx['water']!.softFor ?? SOFT_AFTER;
    const { gainOf: late } = await player();
    late('dig', 1);
    expect(late('water', 1 + window + 0.05)).toBeCloseTo(dry, 6);
  });

  it('plays the splash of a log freed by a tug (170 ms after it) 6 dB under the tug', async () => {
    const { gainOf } = await player();
    const { gainOf: fresh } = await player();
    const dry = fresh('water', 1);
    gainOf('logTug', 1);
    expect(db(dry / gainOf('water', 1.17))).toBeCloseTo(6, 1);
  });
});

/** Interval 3-grams of a jingle's lead line (its first part). */
const trigrams = (name: string): Set<string> => {
  const j = MUSIC.stings[name] ?? MUSIC.jingles[name]!;
  const m = parseNotes(j.parts[0]!.notes)
    .map((n) => n.midi)
    .filter((x): x is number => x !== null);
  const out = new Set<string>();
  for (let i = 0; i + 3 < m.length; i++)
    out.add(`${m[i + 1]! - m[i]!},${m[i + 2]! - m[i + 1]!},${m[i + 3]! - m[i + 2]!}`);
  return out;
};
const seconds = (name: string): number => {
  const j = MUSIC.stings[name] ?? MUSIC.jingles[name]!;
  const beats = Math.max(
    ...j.parts.map((p) => p.notes.split(/\s+/).reduce((a, t) => a + Number(t.split(':')[1]), 0)),
  );
  return (beats * 60) / j.bpm;
};

describe("Senna's homecoming", () => {
  it('gives Senna a motif and a warmer one, apart from every villager motif and the green jingle', () => {
    for (const v of ['', '-heart']) {
      const name = `motif-senna${v}`;
      expect(MUSIC.stings[name], name).toBeDefined();
      for (const p of MUSIC.stings[name]!.parts)
        expect(instrumentFiles(p.inst).length, p.inst).toBeGreaterThan(0);
      const mine = trigrams(name);
      for (const other of ['mara', 'finn', 'rosa', 'orin', 'clay']
        .flatMap((n) => [`motif-${n}`, `motif-${n}-heart`])
        .concat('green')) {
        const theirs = trigrams(other);
        const shared = [...mine].filter((x) => theirs.has(x)).length;
        expect(shared / Math.min(mine.size, theirs.size), `${name} - ${other}`).toBeLessThanOrEqual(
          0.25,
        );
      }
    }
  });

  it('plays the homecoming as a jingle cue, 2-4 s, outranking the green jingle and the fanfares', () => {
    expect(SFX_IDS).toContain('homecoming');
    const j = MUSIC.jingles['homecoming']!;
    expect(j).toBeDefined();
    for (const other of ['green', 'special', 'level', 'goal', 'heart', 'order'])
      expect(j.priority!, other).toBeGreaterThan(MUSIC.jingles[other]!.priority ?? 1);
    expect(seconds('homecoming')).toBeGreaterThanOrEqual(2);
    expect(seconds('homecoming')).toBeLessThanOrEqual(4);
  });

  it("has a soft lit-window sting that takes the place of that evening's dusk flourish", () => {
    const w = MUSIC.stings['window-lit']!;
    expect(w).toBeDefined();
    expect(w.volume!).toBeLessThanOrEqual(0.6);
    // day 7 is a week start: the dusk would play, unless the lit window spent it
    const c = new MomentClock();
    expect(c.step(7, 0, true)).toMatch(/^dawn/);
    c.spendDusk(7);
    expect(c.step(7, 0.5, true)).toBeNull();
    expect(c.step(7, 0.7, true)).toBeNull();
    const d = new MomentClock();
    d.step(7, 0, true);
    d.step(7, 0.5, true);
    expect(d.step(7, 0.7, true)).toMatch(/^dusk/);
  });
});

describe('the mill wheel', () => {
  const scene = (water: Scene['water']): Scene => ({
    inGame: true,
    map: 'town',
    outdoor: true,
    season: 'summer',
    night: 0,
    weather: 'sunny',
    festival: false,
    water,
  });

  it('turns only on the town stage with the Marls home, by the wheel, and fades to nothing away from it', () => {
    for (const [map, stages] of Object.entries(STAGE_AUDIO))
      for (const [v, a] of Object.entries(stages))
        if (map !== 'town' || v !== 'marls')
          expect(
            (a.water ?? []).some((w) => w.bed === 'mill'),
            `${map}@${v}`,
          ).toBe(false);
    expect(waterBeds('town', 'marls', {}, 21, 30).mill).toBe(1);
    expect(waterBeds('town', 'marls', {}, 22, 32).mill).toBeGreaterThan(0.9);
    expect(waterBeds('town', 'marls', {}, 21, 20).mill).toBe(0);
    expect(
      waterBeds('town', 'marls', {}, 19, 25).river,
      'the river runs as on the river stage',
    ).toBe(1);
    expect(waterBeds('town', 'river', {}, 21, 30).mill).toBe(0);
  });

  it('plays as an ambience bed day and night, softer under a storm, and is small', () => {
    expect(chooseAmbience(scene({ mill: 1 })).mill).toBe(1);
    expect(chooseAmbience({ ...scene({ mill: 1 }), night: 1 }).mill).toBe(1);
    expect(chooseAmbience({ ...scene({ mill: 1 }), weather: 'storm' }).mill).toBeLessThan(1);
    const a = MANIFEST.ambience['mill']!;
    expect(a.mode).toBe('loop');
    expect(a.files.length, 'two layers, so it is not sample-identical').toBeGreaterThanOrEqual(2);
  });
});

describe('fall rain (critic D9)', () => {
  it('cuts the fall rainy arrangement less than the others', () => {
    const fall = MUSIC.pieces['fall']!;
    expect(fall.rainDb).toBeDefined();
    expect(fall.rainDb!).toBeGreaterThan(-2.5);
  });
});
