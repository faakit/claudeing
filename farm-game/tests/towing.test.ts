import { describe, expect, it } from 'vitest';
import {
  atSlip,
  atSlipBank,
  bankFor,
  drift,
  follow,
  haul,
  hookStand,
  inReach,
  land,
  makeLog,
  placeAt,
  ROPE_PX,
  TILE,
  tug,
  type TowWorld,
} from '../src/systems/towing';

// A river: water rows 29-32 for x 1-24, the bank (walkable) at row 28 and above, a rock at (17, 29).
const water = (tx: number, ty: number): boolean => tx >= 1 && tx <= 24 && ty >= 29 && ty <= 32;
const walkable = (tx: number, ty: number): boolean => tx >= 1 && tx <= 24 && ty >= 20 && ty <= 28;
const world: TowWorld = { water, snag: (tx, ty) => tx === 17 && ty === 29 };
const centre = (tx: number, ty: number) => ({ x: tx * TILE + 8, y: ty * TILE + 8 });
/** The farmer's hands standing on a tile (feet near the tile's bottom, hands 6 px up). */
const handsOn = (tx: number, ty: number) => ({ x: tx * TILE + 8, y: ty * TILE + 11 - 6 });

/** The same river without the rock. */
const open: TowWorld = { water, snag: () => false };

function tow(
  log: ReturnType<typeof makeLog>,
  hands: { x: number; y: number },
  frames = 120,
  w: TowWorld = world,
) {
  let s = 'free';
  for (let i = 0; i < frames; i++) s = follow(w, log, hands, 1000 / 60);
  return s;
}

describe('towing: the log stays on the water', () => {
  it('lies only on open water, never on the bank or a snag tile', () => {
    const log = makeLog(0, 0);
    const c = centre(20, 30);
    expect(placeAt(world, log, c.x, c.y)).toEqual({ ok: true });
    const bank = centre(20, 28);
    expect(placeAt(world, log, bank.x, bank.y)).toEqual({ ok: false, snag: null });
    const rock = centre(17, 29);
    expect(placeAt(world, log, rock.x, rock.y)).toEqual({ ok: false, snag: [17, 29] });
  });

  it('drifts with the current and stops at the end of the water', () => {
    const c = centre(3, 30);
    const log = makeLog(c.x, c.y);
    drift(world, log, { x: -6, y: 0 }, 1000);
    expect(log.x).toBe(c.x - 6);
    for (let i = 0; i < 40; i++) drift(world, log, { x: -6, y: 0 }, 1000);
    expect(placeAt(world, log, log.x, log.y).ok).toBe(true);
    expect(log.x).toBeGreaterThanOrEqual(TILE + 7); // its west end still on the first water tile
  });

  it('never drifts while hooked', () => {
    const c = centre(20, 30);
    const log = makeLog(c.x, c.y);
    log.hooked = true;
    expect(drift(world, log, { x: -6, y: 0 }, 1000)).toBe('blocked');
    expect(log.x).toBe(c.x);
  });
});

describe('towing: the rope', () => {
  it('reaches 3 tiles from the hands', () => {
    const h = handsOn(20, 28);
    expect(ROPE_PX).toBe(48);
    expect(inReach(h, makeLog(h.x, h.y + 40))).toBe(true);
    expect(inReach(h, makeLog(h.x, h.y + 50))).toBe(false);
  });

  it('leaves a log alone while slack, and pulls it along the bank when walked past the rope', () => {
    const c = centre(20, 30);
    const log = makeLog(c.x, c.y);
    log.hooked = true;
    expect(follow(world, log, handsOn(20, 28), 16)).toBe('slack');
    expect(log.x).toBe(c.x);
    // walk four tiles west along the bank: the log follows, lagging, and stays on the water
    expect(tow(log, handsOn(16, 28), 2, open)).toBe('taut');
    tow(log, handsOn(14, 28), 120, open);
    expect(log.x).toBeLessThan(c.x - 3 * TILE);
    expect(placeAt(open, log, log.x, log.y).ok).toBe(true);
    expect(Math.hypot(log.x - handsOn(14, 28).x, log.y - handsOn(14, 28).y)).toBeLessThanOrEqual(
      ROPE_PX + 1,
    );
  });

  it('eases (lags) the same at 30, 60 and 144 Hz', () => {
    const run = (hz: number) => {
      const c = centre(22, 31);
      const log = makeLog(c.x, c.y);
      log.hooked = true;
      for (let t = 0; t < 500; t += 1000 / hz) follow(open, log, handsOn(12, 28), 1000 / hz);
      return log.x;
    };
    // within a few px after half a second of pulling (the chased point moves with the log)
    expect(Math.abs(run(30) - run(144))).toBeLessThan(6);
    expect(Math.abs(run(60) - run(144))).toBeLessThan(3);
  });
});

describe('towing: snags and tugs', () => {
  it('catches on the rock beside the bank, and one tug pops a short log past it', () => {
    const c = centre(20, 29);
    const log = makeLog(c.x, c.y);
    log.hooked = true;
    expect(tow(log, handsOn(12, 28), 300)).toBe('snagged');
    expect(log.snag).toMatchObject({ tx: 17, ty: 29, dx: -1 });
    expect(log.x).toBeGreaterThan(18 * TILE); // held on the rock's east side
    const r = tug(world, log);
    expect(r).toMatchObject({ freed: true });
    expect(log.snag).toBeNull();
    expect(log.x).toBeLessThan(17 * TILE); // past the rock
    expect(placeAt(world, log, log.x, log.y).ok).toBe(true);
  });

  it('a long log holds on the first tug and comes free on the second', () => {
    const c = centre(21, 29);
    const log = makeLog(c.x, c.y, true);
    log.hooked = true;
    expect(tow(log, handsOn(12, 28), 300)).toBe('snagged');
    expect(tug(world, log)).toMatchObject({ freed: false });
    expect(log.snag).not.toBeNull();
    expect(tug(world, log)).toMatchObject({ freed: true });
    expect(log.snag).toBeNull();
    expect(placeAt(world, log, log.x, log.y).ok).toBe(true);
  });

  it('a tug on a log that is not caught does nothing', () => {
    const c = centre(20, 30);
    const log = makeLog(c.x, c.y);
    expect(tug(world, log)).toBeNull();
    expect(log.x).toBe(c.x);
  });
});

describe('towing: the slip', () => {
  it('hauls a hooked log in to the slip water and lands it for 1 timber (3 for a long log)', () => {
    const c = centre(15, 30);
    const log = makeLog(c.x, c.y);
    log.hooked = true;
    expect(atSlipBank({ tx: 14, ty: 28 }, { tx: 13, ty: 28 })).toBe(true);
    expect(atSlipBank({ tx: 11, ty: 28 }, { tx: 13, ty: 28 })).toBe(false);
    let r = 'moved';
    for (let i = 0; i < 120 && r !== 'arrived'; i++) r = haul(world, log, { tx: 13, ty: 29 }, 16);
    expect(r).toBe('arrived');
    expect(atSlip(log, { tx: 13, ty: 29 })).toBe(true);
    expect(land(log)).toBe(1);
    expect(log).toMatchObject({ landed: true, hooked: false });
    expect(land(makeLog(0, 0, true))).toBe(3);
  });
});

describe('towing: reading taps', () => {
  it('a tap on the water walks to the bank beside it; a tap on the bank walks there', () => {
    expect(bankFor(15, 31, walkable, water)).toEqual({ tx: 15, ty: 28 });
    expect(bankFor(15, 25, walkable, water)).toEqual({ tx: 15, ty: 25 });
    expect(bankFor(30, 30, walkable, water)).toBeNull(); // nothing there
  });

  it('a tap on the log walks to the nearest bank tile that reaches it', () => {
    const c = centre(19, 30);
    const from = { tx: 13, ty: 27 };
    const stand = hookStand(makeLog(c.x, c.y), from, walkable)!;
    expect(walkable(stand.tx, stand.ty)).toBe(true);
    expect(inReach(handsOn(stand.tx, stand.ty), makeLog(c.x, c.y))).toBe(true);
    // on the farmer's side of the log, never past it
    expect(stand.tx).toBeLessThanOrEqual(19);
    expect(Math.abs(stand.ty - 28)).toBeLessThanOrEqual(1);
    expect(hookStand(makeLog(c.x, c.y), from, () => false)).toBeNull();
  });
});
