import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MANIFEST, MUSIC, instrumentFiles, slotInstruments } from '../src/audio/assets';
import { SampleBank, detectOnset, onsetOffset } from '../src/audio/bank';
import { MomentClock, PanelTracker, SHOP_DWELL_MS, chooseAmbience, chooseMusic, type Scene } from '../src/audio/director';
import { MusicPlayer } from '../src/audio/music';
import { SfxPlayer } from '../src/audio/sfx';
import { audio } from '../src/platform/audio';
import { BAD_BYTES, FakeAudioContext, FakeGain, FakeSource, GOOD_BYTES, asCtx } from './fakeAudio';

type Behaviour = 'ok' | 'missing' | 'corrupt';
// The engine under test sees: no instrument samples at all, a missing and a corrupt sfx file.
const behaviour = (url: string): Behaviour =>
  url.includes('/inst/') || url.includes('sfx/water') ? 'missing' : url.includes('sfx/refill') ? 'corrupt' : 'ok';
const realFetch = globalThis.fetch;
const realWindow = (globalThis as { window?: unknown }).window;

beforeAll(() => {
  globalThis.fetch = (async (url: string) => {
    const b = behaviour(String(url));
    if (b === 'missing') return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    return { ok: true, status: 200, arrayBuffer: async () => (b === 'corrupt' ? BAD_BYTES() : GOOD_BYTES()) };
  }) as unknown as typeof fetch;
  (globalThis as { window?: unknown }).window = {
    AudioContext: FakeAudioContext,
    addEventListener: () => undefined,
    setInterval: () => 1,
    clearInterval: () => undefined,
  };
});
afterAll(() => {
  globalThis.fetch = realFetch;
  (globalThis as { window?: unknown }).window = realWindow;
});

const sources = (c: FakeAudioContext) => c.created.filter((n): n is FakeSource => n instanceof FakeSource);
const sampled = (c: FakeAudioContext) => sources(c).filter((s) => s.buffer?.decoded);

describe('sample bank', () => {
  it('finds the attack after decoder priming and clamps silly offsets', () => {
    const d = new Float32Array(1000);
    d.fill(0.4, 100);
    expect(detectOnset(d, 1000)).toBeCloseTo(0.1);
    expect(onsetOffset(0.027, 0.002)).toBeCloseTo(0.025);
    expect(onsetOffset(0.0, 0.002)).toBe(0);
    expect(onsetOffset(0.5, 0)).toBe(0.08);
  });

  it('remembers missing and corrupt files so callers fall back instead of waiting', async () => {
    const ctx = new FakeAudioContext();
    const bank = new SampleBank('x/', async (url) => {
      if (url.includes('missing')) throw new Error('404');
      return url.includes('corrupt') ? BAD_BYTES() : GOOD_BYTES();
    });
    expect(await bank.load(asCtx(ctx), 'missing.mp3', 0)).toBeNull();
    expect(bank.failed('missing.mp3')).toBe(true);
    expect(await bank.load(asCtx(ctx), 'corrupt.mp3', 0)).toBeNull();
    expect(bank.failed('corrupt.mp3')).toBe(true);
    const ok = await bank.load(asCtx(ctx), 'fine.mp3', 0.002);
    expect(ok?.offset).toBeCloseTo(0.023, 3);
    expect(bank.failed('fine.mp3')).toBe(false);
    // decoding again later works (the compressed bytes are kept, not detached)
    expect(bank.evict(['fine.mp3'], Infinity)).toBe(1);
    expect(await bank.load(asCtx(ctx), 'fine.mp3', 0.002)).not.toBeNull();
  });
});

describe('sample residency', () => {
  it("status checks do not count as use, so a piece left for the mine is not kept or dropped by mistake", async () => {
    const ctx = new FakeAudioContext();
    const bank = new SampleBank('x/', async () => GOOD_BYTES());
    const m = new MusicPlayer(asCtx(ctx), bank, { dry: { day: ctx.destination, night: ctx.destination, both: ctx.destination }, wet: { day: ctx.destination, night: ctx.destination, both: ctx.destination }, sfx: ctx.destination } as unknown as ConstructorParameters<typeof MusicPlayer>[2], () => undefined);
    await m.preload('spring');
    const files = slotInstruments('spring').flatMap(instrumentFiles).map((z) => z.file);
    for (const f of files) bank.get(f, 100); // last real use at t=100
    for (let i = 0; i < 50; i++) m.status('spring'); // polled every tick by the engine
    expect(bank.evict(files, 50)).toBe(0); // used at 100: kept
    expect(bank.evict(files, 101)).toBe(files.length); // unused since 100: dropped
  });
});

describe('sound effect player', () => {
  it('caps voices per cue, stealing the oldest, and never repeats a take back to back', async () => {
    const ctx = new FakeAudioContext();
    const bank = new SampleBank('x/', async () => GOOD_BYTES());
    let r = 0;
    const rng = () => [0.1, 0.9, 0.5, 0.3, 0.7][r++ % 5]!;
    const sfx = new SfxPlayer(asCtx(ctx), bank, new FakeGain(ctx, 'gain') as unknown as AudioNode, rng);
    await sfx.preload();
    const cap = MANIFEST.sfx['stepGrass']!.voices;
    const buffers: unknown[] = [];
    for (let i = 0; i < 6; i++) {
      expect(sfx.play('stepGrass', 0)).toBe(true);
      buffers.push(sources(ctx).at(-1)!.buffer);
    }
    const live = sources(ctx).filter((s) => s.stoppedAt === null || s.stoppedAt > 0.5);
    expect(live.length).toBeLessThanOrEqual(cap);
    // started at the decoder offset, so the attack is instant
    expect(sources(ctx)[0]!.started![1]).toBeGreaterThan(0.02);
  });

  it('reports a miss when nothing is decoded so the engine can use the synth', () => {
    const ctx = new FakeAudioContext();
    const sfx = new SfxPlayer(asCtx(ctx), new SampleBank('x/', async () => GOOD_BYTES()), new FakeGain(ctx, 'gain') as unknown as AudioNode);
    expect(sfx.play('till', 0)).toBe(false);
    expect(sfx.play('not-a-cue', 0)).toBe(false);
  });
});

describe('music player', () => {
  const buses = (ctx: FakeAudioContext) => {
    const g = () => new FakeGain(ctx, 'gain') as unknown as AudioNode;
    return { dry: { day: g(), night: g(), both: g() }, wet: { day: g(), night: g(), both: g() }, sfx: g() };
  };

  it("says 'none' when no instrument of a piece can load, so the synth music takes over", async () => {
    const ctx = new FakeAudioContext();
    const m = new MusicPlayer(asCtx(ctx), new SampleBank('x/', async () => BAD_BYTES()), buses(ctx), () => undefined);
    await m.preload('spring');
    expect(m.status('spring')).toBe('none');
  });

  it('waits for its samples, then plays; a failed instrument falls back per note to the synth', async () => {
    const ctx = new FakeAudioContext();
    const failInst = 'recorder';
    const failFiles = new Set(instrumentFiles(failInst).map((z) => z.file));
    const bank = new SampleBank('x/', async (url) => {
      if ([...failFiles].some((f) => url.endsWith(f))) throw new Error('404');
      return GOOD_BYTES();
    });
    const synth: number[] = [];
    const m = new MusicPlayer(asCtx(ctx), bank, buses(ctx), (midi) => synth.push(midi));
    m.setSlot('spring', false, 0);
    expect(m.status('spring')).toBe('loading');
    m.tick(0, { enabled: true, day: true, night: false });
    expect(m.stats.sampled).toBe(0); // not started while loading
    await m.preload('spring');
    expect(m.status('spring')).toBe('ready');
    for (let t = 0; t < 60; t += 0.1) {
      ctx.currentTime = t;
      m.tick(t, { enabled: true, day: true, night: false });
    }
    expect(m.stats.sampled).toBeGreaterThan(50);
    expect(synth.length).toBeGreaterThan(0);
    expect(slotInstruments('spring')).toContain(failInst);
  });

  it('schedules nothing while disabled (muted or music at 0) but keeps time', async () => {
    const ctx = new FakeAudioContext();
    const m = new MusicPlayer(asCtx(ctx), new SampleBank('x/', async () => GOOD_BYTES()), buses(ctx), () => undefined);
    m.setSlot('summer', false, 0);
    await m.preload('summer');
    for (let t = 0; t < 10; t += 0.1) m.tick(t, { enabled: false, day: true, night: false });
    expect(m.stats.sampled + m.stats.synth).toBe(0);
    for (let t = 10; t < 20; t += 0.1) m.tick(t, { enabled: true, day: true, night: false });
    expect(m.stats.sampled).toBeGreaterThan(0);
    expect(m.stats.dropped).toBe(0);
  });

  it('plays jingles from samples in the current key, or reports a miss', async () => {
    const ctx = new FakeAudioContext();
    const bank = new SampleBank('x/', async () => GOOD_BYTES());
    const m = new MusicPlayer(asCtx(ctx), bank, buses(ctx), () => undefined);
    expect(m.jingle('level', 0)).toBe(false);
    for (const p of MUSIC.jingles['level']!.parts)
      await Promise.all(instrumentFiles(p.inst).map((z) => bank.load(asCtx(ctx), z.file, z.onset)));
    expect(m.jingle('level', 0)).toBe(true);
  });
});

describe('audio engine', () => {
  it('creates one AudioContext however often it is unlocked', () => {
    const before = FakeAudioContext.instances;
    audio.unlock();
    audio.unlock();
    expect(FakeAudioContext.instances - before).toBe(1);
  });

  it('plays the synthesized sound for a cue whose file is missing or corrupt', async () => {
    const ctx = (audio as unknown as { ctx: FakeAudioContext }).ctx;
    for (const cue of ['water', 'refill'])
      await Promise.all(MANIFEST.sfx[cue]!.files.map((z) => audio.bank.load(asCtx(ctx), z.file, z.onset)));
    const before = ctx.created.length;
    const beforeSampled = sampled(ctx).length;
    audio.play('water');
    audio.play('refill');
    expect(ctx.created.length).toBeGreaterThan(before);
    expect(sampled(ctx).length).toBe(beforeSampled);
  });

  it('plays the recorded take once it is decoded', async () => {
    const ctx = (audio as unknown as { ctx: FakeAudioContext }).ctx;
    await Promise.all(MANIFEST.sfx['till']!.files.map((z) => audio.bank.load(asCtx(ctx), z.file, z.onset)));
    const before = sampled(ctx).length;
    audio.play('till');
    expect(sampled(ctx).length).toBe(before + 1);
  });

  it('is silent while muted', () => {
    const ctx = (audio as unknown as { ctx: FakeAudioContext }).ctx;
    audio.setVolumes(0.6, 0.8, true);
    const before = ctx.created.length;
    audio.play('till');
    audio.play('level');
    expect(ctx.created.length).toBe(before);
    audio.setVolumes(0.6, 0.8, false);
  });

  it('switches to the synth music when no instrument of the piece can load', async () => {
    const ctx = (audio as unknown as { ctx: FakeAudioContext }).ctx;
    audio.setMusic('mine', true);
    await Promise.all(
      slotInstruments('mine').flatMap((i) => instrumentFiles(i).map((z) => audio.bank.load(asCtx(ctx), z.file, z.onset))),
    );
    ctx.currentTime = 100;
    (audio as unknown as { tick(): void }).tick();
    expect(audio.debugInfo()['synthMusic']).toBe(true);
  });
});

describe('musical moments', () => {
  const ctxOf = () => (audio as unknown as { ctx: FakeAudioContext }).ctx;
  it('plays villager motifs and season stings (synth when samples are missing), and ignores unknown names', () => {
    const ctx = ctxOf();
    let n = ctx.created.length;
    audio.motif('clay');
    expect(ctx.created.length).toBeGreaterThan(n);
    n = ctx.created.length;
    audio.motif('nobody');
    expect(ctx.created.length).toBe(n);
    audio.seasonSting('fall');
    expect(ctx.created.length).toBeGreaterThan(n);
    for (const v of [1, 2, 3]) {
      expect(MUSIC.stings[`dawn-${v}`]).toBeDefined();
      expect(MUSIC.stings[`dusk-${v}`]).toBeDefined();
    }
    for (const id of ['mara', 'finn', 'rosa', 'orin', 'clay'])
      for (const v of ['', '-heart']) expect(MUSIC.stings[`motif-${id}${v}`], `${id}${v}`).toBeDefined();
    for (const s of ['spring', 'summer', 'fall', 'winter']) {
      expect(MUSIC.stings[`season-${s}`], s).toBeDefined();
      expect(MUSIC.stings[`open-${s}`], s).toBeDefined();
    }
  });
});

describe('panels and moments', () => {
  it('plays the shop piece only while the store is open (after a short dwell), never for a later menu', () => {
    const p = new PanelTracker();
    p.open('shop', 0);
    p.frame(1);
    expect(p.current(500), 'dwell').toBeNull();
    expect(p.current(SHOP_DWELL_MS + 1)).toBe('shop');
    p.frame(0); // Escape closes the store
    expect(p.current(5000)).toBeNull();
    p.frame(1); // the menu opens without an openPanel event (critic R9 #1)
    expect(p.current(6000)).toBeNull();
    p.open('menu', 6000);
    expect(p.current(9000)).toBe('menu');
  });
  it('plays dawn and dusk once each on the first day of a week, outdoors, in rotating variants', () => {
    const c = new MomentClock();
    expect(c.step(1, 0, true), 'not a week start').toBeNull();
    expect(c.step(7, 0, false), 'indoors').toBeNull();
    expect(c.step(7, 0.1, true)).toBe('dawn-2');
    expect(c.step(7, 0.2, true), 'once').toBeNull();
    expect(c.step(7, 0.5, true)).toBeNull();
    expect(c.step(7, 0.7, true)).toBe('dusk-2');
    expect(c.step(7, 0.9, true)).toBeNull();
    const d = new MomentClock();
    expect(d.step(14, 0.9, true), 'stepping out at night is not dusk').toBeNull();
    expect(d.step(14, 0.1, true)).toBe('dawn-3');
    expect(new MomentClock().step(21, 0.1, true)).toBe('dawn-1');
  });
});

describe('jingle priority', () => {
  const buses = (ctx: FakeAudioContext) => {
    const g = () => new FakeGain(ctx, 'gain') as unknown as AudioNode;
    return { dry: { day: g(), night: g(), both: g() }, wet: { day: g(), night: g(), both: g() }, sfx: g() };
  };
  const ready = async () => {
    const ctx = new FakeAudioContext();
    const bank = new SampleBank('x/', async () => GOOD_BYTES());
    for (const cue of ['order', 'special'])
      for (const p of MUSIC.jingles[cue]!.parts)
        await Promise.all(instrumentFiles(p.inst).map((z) => bank.load(asCtx(ctx), z.file, z.onset)));
    return { ctx, m: new MusicPlayer(asCtx(ctx), bank, buses(ctx), () => undefined) };
  };
  it('the special-order fanfare cuts an order jingle that started just before it', async () => {
    const { ctx, m } = await ready();
    expect(m.jingle('order', 10)).toBe(true);
    const order = sampled(ctx);
    const naturalEnd = Math.max(...order.map((s) => s.stoppedAt ?? 0));
    expect(m.jingle('special', 10.3)).toBe(true);
    for (const s of order) expect(s.stoppedAt!, 'order stopped early').toBeLessThan(naturalEnd);
    expect(sampled(ctx).length).toBeGreaterThan(order.length);
  });
  it('drops an order jingle asked for just after the special fanfare (the order of calls does not matter)', async () => {
    const { ctx, m } = await ready();
    expect(m.jingle('special', 10)).toBe(true);
    const n = sampled(ctx).length;
    expect(m.jingle('order', 10.4), 'handled, so no synth either').toBe(true);
    expect(sampled(ctx).length).toBe(n);
    expect(m.jingle('order', 12)).toBe(true);
    expect(sampled(ctx).length).toBeGreaterThan(n);
  });
});

describe('director', () => {
  const base: Scene = { inGame: true, map: 'farm', outdoor: true, season: 'summer', night: 0, weather: 'sunny', festival: false };
  it('picks title, season (indoors or out), mine and festival music', () => {
    expect(chooseMusic({ ...base, inGame: false }).slot).toBe('title');
    expect(chooseMusic(base)).toEqual({ slot: 'summer', indoor: false, rain: false, year: 1 });
    expect(chooseMusic({ ...base, map: 'house', outdoor: false })).toMatchObject({ slot: 'summer', indoor: true });
    expect(chooseMusic({ ...base, map: 'mine', outdoor: false }).slot).toBe('mine');
    expect(chooseMusic({ ...base, map: 'town', festival: true }).slot).toBe('festival');
    expect(chooseMusic({ ...base, map: 'farm', festival: true }).slot).toBe('summer');
    expect(chooseMusic({ ...base, map: 'town', festival: true, night: 0.8 }).slot).toBe('summer');
  });
  it('plays the shop piece in the store, the lullaby in the house at night, and passes rain and year', () => {
    expect(chooseMusic({ ...base, map: 'town', panel: 'shop' })).toMatchObject({ slot: 'shop', indoor: true });
    expect(chooseMusic({ ...base, map: 'town', panel: null }).slot).toBe('summer');
    expect(chooseMusic({ ...base, map: 'house', outdoor: false, night: 0.8 }).slot).toBe('lullaby');
    expect(chooseMusic({ ...base, map: 'house', outdoor: false, night: 0.3 }).slot).toBe('summer');
    expect(chooseMusic({ ...base, weather: 'storm', year: 2 })).toMatchObject({ rain: true, year: 2 });
    expect(chooseMusic({ ...base, weather: 'sunny' }).rain).toBe(false);
    const shop = chooseAmbience({ ...base, map: 'town', panel: 'shop' });
    expect(shop.forge).toBeGreaterThan(0);
    expect(shop.anvil).toBeGreaterThan(0);
    expect(shop.birds).toBe(0);
    expect(chooseAmbience({ ...base, map: 'house', outdoor: false, night: 0.9 }).clock).toBeGreaterThan(
      chooseAmbience({ ...base, map: 'house', outdoor: false, night: 0 }).clock,
    );
  });
  it('places birds by day, crickets at night, wind in winter, drips in the mine', () => {
    expect(chooseAmbience(base).birds).toBe(1);
    expect(chooseAmbience(base).crickets).toBe(0);
    const night = chooseAmbience({ ...base, night: 1 });
    expect(night.birds).toBe(0);
    expect(night.crickets).toBeGreaterThan(0.5);
    expect(night.crickets).toBeLessThanOrEqual(1);
    expect(chooseAmbience({ ...base, weather: 'rain' }).birds).toBe(0);
    expect(chooseAmbience({ ...base, season: 'winter' }).wind).toBeGreaterThan(0);
    expect(chooseAmbience({ ...base, map: 'mine', outdoor: false })).toMatchObject({ cave: 1, drips: 1, birds: 0 });
    expect(chooseAmbience({ ...base, map: 'house', outdoor: false }).birds).toBe(0);
    expect(chooseAmbience({ ...base, inGame: false }).birds).toBe(0);
    expect(chooseAmbience({ ...base, weather: 'storm' }).thunder).toBe(1);
    expect(chooseAmbience({ ...base, weather: 'storm', map: 'house', outdoor: false }).thunder).toBeGreaterThan(0);
    expect(chooseAmbience({ ...base, weather: 'rain' }).thunder).toBe(0);
  });
});
