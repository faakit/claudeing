import { describe, expect, it } from 'vitest';
import { MUSIC, instrumentFiles } from '../src/audio/assets';
import { SampleBank } from '../src/audio/bank';
import { STORM_WATER, chooseAmbience, chooseMusic, type Scene } from '../src/audio/director';
import { MusicPlayer } from '../src/audio/music';
import { PiecePlayer, makeRng, type BarOptions } from '../src/audio/sequencer';
import {
  STAGE_AUDIO,
  WATER_FLOOR,
  stageAudio,
  stageThin,
  tilesTo,
  waterBeds,
  waterLevel,
} from '../src/audio/stages';
import { mapsData } from '../src/data';
import { mapVariants } from '../src/systems/valley';
import { FakeAudioContext, FakeGain, GOOD_BYTES, asCtx } from './fakeAudio';

const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
const DAY: BarOptions = { indoor: false, day: true, night: false, percHits: () => 3 };

/** Stages M6 adds (town dry/river, Wendhead gorge/restored), keyed here already so they play when they land. */
const PENDING: Record<string, string[]> = {
  town: ['dry', 'river'],
  wendhead: ['gorge', 'restored'],
};

describe('map stage audio (src/audio/stages.json)', () => {
  it('names only real maps, and variants that exist or that M6 is adding', () => {
    for (const [map, stages] of Object.entries(STAGE_AUDIO)) {
      expect(mapsData.maps[map], map).toBeDefined();
      for (const v of Object.keys(stages)) {
        const known =
          v === 'default' || mapVariants(map).includes(v) || (PENDING[map] ?? []).includes(v);
        expect(known, `${map}@${v}`).toBe(true);
        for (const w of stages[v]!.water ?? []) expect(['creek', 'river']).toContain(w.bed);
      }
    }
  });

  it('thins every dry-palette stage, and only those (unless a stage says so)', () => {
    expect(stageThin('farm', 'dry', 'dry')).toBe(true);
    expect(stageThin('farm', 'waking')).toBe(false);
    expect(stageThin('farm', 'restored')).toBe(false);
    expect(stageThin('wendhead', 'dry', 'dry')).toBe(true);
    expect(stageThin('town', 'dry', 'dry')).toBe(true);
    expect(stageThin('town', 'river')).toBe(false);
    expect(stageThin('town', null)).toBe(false);
    // a dry stage nobody listed yet still plays thinned
    expect(stageThin('woods', 'dry', 'dry')).toBe(true);
  });

  it('runs the creek on the restored farm only after its first morning, louder near the bed', () => {
    const stats = { 'valley.creekSeen': 1 };
    expect(waterBeds('farm', 'waking', stats, 27, 10).creek).toBe(0);
    expect(waterBeds('farm', 'restored', {}, 27, 10).creek, 'waits for the reveal').toBe(0);
    expect(waterBeds('farm', 'restored', stats, 27, 10).creek).toBe(1);
    const far = waterBeds('farm', 'restored', stats, 4, 10).creek;
    expect(far).toBe(WATER_FLOOR);
    const mid = waterBeds('farm', 'restored', stats, 18, 10).creek;
    expect(mid).toBeGreaterThan(far);
    expect(mid).toBeLessThan(1);
    expect(waterBeds('farm', 'restored', stats, 27, 10).river).toBe(0);
  });

  it('gives Wendhead the creek everywhere once the spring runs, and the town its river (a trickle while dry)', () => {
    expect(waterBeds('wendhead', 'dry', {}, 5, 5)).toEqual({ creek: 0, river: 0 });
    expect(waterBeds('wendhead', 'spring', {}, 1, 1).creek).toBe(1);
    expect(waterBeds('wendhead', 'spring', {}, 20, 26).creek).toBe(1);
    expect(waterBeds('town', 'river', {}, 19, 25).river).toBe(1);
    expect(waterBeds('town', null, {}, 19, 25).river, 'the town before M6 has its river').toBe(1);
    const trickle = waterBeds('town', 'dry', {}, 21, 25);
    expect(trickle.river).toBe(0);
    expect(trickle.creek).toBeGreaterThan(0);
    expect(trickle.creek).toBeLessThan(0.5);
  });

  it('measures tiles to the nearest rect, 0 inside', () => {
    expect(tilesTo([[26, 3, 2, 29]], 26, 10)).toBe(0);
    expect(tilesTo([[26, 3, 2, 29]], 24, 10)).toBe(2);
    expect(tilesTo([[26, 3, 2, 29]], 30, 1)).toBeCloseTo(Math.hypot(3, 2));
    expect(waterLevel({ bed: 'creek' }, 0, 0)).toBe(1);
    expect(waterLevel({ bed: 'creek', gain: 0.35 }, 0, 0)).toBe(0.35);
    expect(stageAudio('mine', null)).toEqual({});
  });
});

describe('director on Dry Year stages', () => {
  const base: Scene = {
    inGame: true,
    map: 'farm',
    outdoor: true,
    season: 'spring',
    night: 0,
    weather: 'sunny',
    festival: false,
  };
  it('plays the thinned piece outdoors on a dry stage only', () => {
    expect(chooseMusic({ ...base, thin: true }).thin).toBe(true);
    expect(chooseMusic({ ...base, thin: false }).thin).toBe(false);
    expect(chooseMusic({ ...base, thin: true, map: 'house', outdoor: false }).thin).toBe(false);
    expect(chooseMusic({ ...base, thin: true, inGame: false }).thin).toBe(false);
  });

  it('runs the water beds day and night, the creek with its burbles, under a storm softer', () => {
    const water = { creek: 0.8, river: 0.5 };
    const a = chooseAmbience({ ...base, water });
    expect(a.creek).toBe(0.8);
    expect(a.burble).toBe(0.8);
    expect(a.river).toBe(0.5);
    expect(chooseAmbience({ ...base, water, night: 1 }).creek).toBe(0.8);
    expect(chooseAmbience({ ...base, water, season: 'winter' }).creek).toBe(0.8);
    expect(chooseAmbience({ ...base, water, weather: 'storm' }).creek).toBeCloseTo(
      0.8 * STORM_WATER,
    );
    expect(chooseAmbience({ ...base, water, map: 'house', outdoor: false }).creek).toBe(0);
    expect(chooseAmbience(base).creek).toBe(0);
  });
});

describe('the thinned arrangement', () => {
  const bars = (slot: string, n: number, opt: BarOptions, seed = 7) => {
    const p = new PiecePlayer(MUSIC.pieces[slot]!, MUSIC.patterns);
    const rng = makeRng(seed);
    return Array.from({ length: n }, () => p.nextBar(rng, opt)).flatMap((b) => b.events);
  };

  it('every season piece has one; it drops its percussion and bass and keeps the tune', () => {
    for (const s of SEASONS) {
      const piece = MUSIC.pieces[s]!;
      const thin = piece.thin!;
      expect(thin, s).toBeDefined();
      for (const l of piece.layers) {
        if (
          ['shaker', 'tamb', 'sleigh', 'triangle'].includes(l.inst) ||
          (l.bass && l.time !== 'night')
        )
          expect(thin.drop, `${s} drops ${l.id}`).toContain(l.id);
        if (l.phrases) expect(thin.drop, `${s} keeps ${l.id}`).not.toContain(l.id);
      }
      for (const id of [...thin.drop, ...Object.keys(thin.swap ?? {})])
        expect(
          piece.layers.some((l) => l.id === id),
          `${s}: ${id}`,
        ).toBe(true);
      for (const p of Object.values(thin.swap ?? {})) expect(MUSIC.patterns[p], p).toBeDefined();
    }
  });

  it("plays at most 70 % of the full day arrangement's notes per beat", () => {
    for (const s of SEASONS) {
      const full = bars(s, 96, DAY).length;
      const thin = bars(s, 96, { ...DAY, thin: true });
      expect(thin.length / full, s).toBeLessThanOrEqual(0.7);
      const dropped = new Set(MUSIC.pieces[s]!.thin!.drop);
      expect(
        thin.some((e) => dropped.has(e.layer)),
        s,
      ).toBe(false);
      expect(
        thin.some((e) => e.layer === 'tune'),
        s,
      ).toBe(true);
    }
  });

  it('keeps generating the dropped layers while they fade out', () => {
    const fading = bars('spring', 16, { ...DAY, thin: true, thinFading: true });
    expect(fading.some((e) => e.layer === 'bass')).toBe(true);
  });

  it('fades the dropped layers out and back on the same clock, without restarting the piece', async () => {
    const ctx = new FakeAudioContext();
    const g = () => new FakeGain(ctx, 'gain') as unknown as AudioNode;
    const buses = {
      dry: { day: g(), night: g(), both: g() },
      wet: { day: g(), night: g(), both: g() },
      sfx: g(),
    };
    const m = new MusicPlayer(
      asCtx(ctx),
      new SampleBank('x/', async () => GOOD_BYTES()),
      buses,
      () => undefined,
    );
    m.setSlot('spring', false, 0);
    await m.preload('spring');
    const run = (from: number, to: number) => {
      for (let t = from; t < to; t += 0.1) {
        ctx.currentTime = t;
        m.tick(t, { enabled: true, day: true, night: false });
      }
    };
    run(0, 20);
    const bars0 = m.stats.bars;
    expect(m.layerGains()['bass']).toBeGreaterThan(0);
    m.setMood({ thin: true }, 20);
    expect(m.thinned).toBe(true);
    expect(m.layerGains()['bass'], 'faded out').toBe(0);
    expect(m.layerGains()['comp']).toBeGreaterThan(0);
    run(20, 40); // past THIN_FADE_S: the dropped layers are no longer generated
    m.setMood({ thin: false }, 40);
    expect(m.layerGains()['bass'], 'back').toBeGreaterThan(0);
    run(40, 50);
    // the bar clock ran on through both changes (about 30 s of bars at 74 bpm), never reset
    expect(m.stats.bars - bars0).toBeGreaterThan(30 / ((60 / 74) * 4) - 1);
    expect(m.slot).toBe('spring');
  });

  it('a piece that starts thinned swells its dropped layers in when the stage greens', async () => {
    const ctx = new FakeAudioContext();
    const g = () => new FakeGain(ctx, 'gain') as unknown as AudioNode;
    const buses = {
      dry: { day: g(), night: g(), both: g() },
      wet: { day: g(), night: g(), both: g() },
      sfx: g(),
    };
    const m = new MusicPlayer(
      asCtx(ctx),
      new SampleBank('x/', async () => GOOD_BYTES()),
      buses,
      () => undefined,
    );
    m.setMood({ thin: true }, 0);
    m.setSlot('spring', false, 0);
    await m.preload('spring');
    for (let t = 0; t < 10; t += 0.1) m.tick(t, { enabled: true, day: true, night: false });
    expect(m.layerGains()['bass']).toBeUndefined();
    m.setMood({ thin: false }, 10);
    expect(m.layerGains()['bass']).toBeGreaterThan(0);
  });

  it('a rainy dry day plays the rainy arrangement, not thinned twice', async () => {
    const ctx = new FakeAudioContext();
    const g = () => new FakeGain(ctx, 'gain') as unknown as AudioNode;
    const buses = {
      dry: { day: g(), night: g(), both: g() },
      wet: { day: g(), night: g(), both: g() },
      sfx: g(),
    };
    const m = new MusicPlayer(
      asCtx(ctx),
      new SampleBank('x/', async () => GOOD_BYTES()),
      buses,
      () => undefined,
    );
    m.setSlot('spring', false, 0);
    await m.preload('spring');
    for (let t = 0; t < 10; t += 0.1) m.tick(t, { enabled: true, day: true, night: false });
    m.setMood({ thin: true, rain: true }, 10);
    expect(m.layerGains()['bass'], 'rain keeps its bass').toBeGreaterThan(0);
    m.setMood({ thin: true, rain: false }, 20);
    expect(m.layerGains()['bass'], 'the rain stops: thinned').toBe(0);
  });

  it('the first-green jingle is its own cue, 2-4 s, in the jingle system, outranking the event fanfares', () => {
    const j = MUSIC.jingles['green']!;
    expect(j).toBeDefined();
    const special = MUSIC.jingles['special']!;
    expect(j.parts[0]!.notes).not.toBe(special.parts[0]!.notes);
    expect(j.priority).toBeGreaterThan(special.priority ?? 1);
    const beats = Math.max(
      ...j.parts.map((p) => p.notes.split(/\s+/).reduce((a, t) => a + Number(t.split(':')[1]), 0)),
    );
    const secs = (beats * 60) / j.bpm;
    expect(secs).toBeGreaterThanOrEqual(2);
    expect(secs).toBeLessThanOrEqual(4);
    for (const p of j.parts) expect(instrumentFiles(p.inst).length, p.inst).toBeGreaterThan(0);
  });
});
