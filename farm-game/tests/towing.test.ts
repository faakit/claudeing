import { describe, expect, it } from 'vitest';
import {
  actionVerb,
  alignAxis,
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
  meansSlip,
  NEAR_WATER,
  nearestBank,
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
    // within two tiles counts (a thumb taps near the slip while the camera scrolls: critic T1)
    expect(atSlipBank({ tx: 15, ty: 28 }, { tx: 13, ty: 28 })).toBe(true);
    expect(atSlipBank({ tx: 11, ty: 28 }, { tx: 13, ty: 28 })).toBe(true);
    expect(atSlipBank({ tx: 16, ty: 28 }, { tx: 13, ty: 28 })).toBe(false);
    let r = 'moved';
    for (let i = 0; i < 120 && r !== 'arrived'; i++) r = haul(world, log, { tx: 13, ty: 29 }, 16);
    expect(r).toBe('arrived');
    expect(atSlip(log, { tx: 13, ty: 29 })).toBe(true);
    expect(land(log)).toBe(1);
    expect(log).toMatchObject({ landed: true, hooked: false });
    expect(land(makeLog(0, 0, true))).toBe(3);
  });
});

describe('towing: a tap near the slip means the slip', () => {
  const slip = { bank: { tx: 13, ty: 28 }, water: { tx: 13, ty: 29 } };
  it('within two tiles of its bank or its water, on either side', () => {
    expect(meansSlip({ tx: 15, ty: 28 }, slip)).toBe(true); // the T1 tap, two tiles east, mid-scroll
    expect(meansSlip({ tx: 11, ty: 28 }, slip)).toBe(true);
    expect(meansSlip({ tx: 14, ty: 31 }, slip)).toBe(true); // the water beside it
    expect(meansSlip({ tx: 16, ty: 28 }, slip)).toBe(false);
    expect(meansSlip({ tx: 13, ty: 25 }, slip)).toBe(false);
  });
});

describe('towing: a slow frame', () => {
  it('never carries a log past a snag (a long step goes in pieces)', () => {
    // the log east of the rock (17,29) in the near-bank row, the farmer far west on the bank: one 500 ms frame
    const c = centre(19, 29);
    const log = makeLog(c.x, c.y);
    log.hooked = true;
    const s = follow(world, log, handsOn(10, 28), 500);
    expect(s).toBe('snagged');
    expect(log.snag).toMatchObject({ tx: 17, ty: 29 });
    expect(Math.floor((log.x - 7) / TILE)).toBeGreaterThanOrEqual(18); // still east of the rock
  });
});

describe('towing: a tap on the hedge while towing', () => {
  // a bank row (y 10, x 0-20) with hedge above it (y < 10) and the lane below
  const bank = (tx: number, ty: number): boolean => ty === 10 && tx >= 0 && tx <= 20;
  it('means the nearest walkable bank tile, never nothing', () => {
    expect(nearestBank(5, 8, bank)).toEqual({ tx: 5, ty: 10 }); // two tiles up in the hedge: straight down
    expect(nearestBank(5, 10, bank)).toEqual({ tx: 5, ty: 10 }); // the bank itself
    expect(nearestBank(5, 1, bank)).toBeNull(); // nothing within 8 tiles
  });
  it('of the nearest ring, the tile toward the slip (downstream)', () => {
    // a tap two tiles above the bank: the ring at 2 has x 3-7 on the bank; the slip lies west, or east
    expect(nearestBank(5, 8, bank, { tx: 0, ty: 10 })).toEqual({ tx: 3, ty: 10 });
    expect(nearestBank(5, 8, bank, { tx: 20, ty: 10 })).toEqual({ tx: 7, ty: 10 });
  });
});

describe('towing: a log turns with its lane', () => {
  // a lane running east-west (rows 29-32) that bends south (x 3-5, rows 29-40)
  const bendWater = (tx: number, ty: number): boolean =>
    (tx >= 3 && tx <= 24 && ty >= 29 && ty <= 32) || (tx >= 3 && tx <= 5 && ty >= 29 && ty <= 40);
  const bend: TowWorld = { water: bendWater, snag: () => false };

  it('lies along the way it clearly moves, when the turned log fits on the water', () => {
    const c = centre(4, 30);
    const log = makeLog(c.x, c.y, true);
    expect(alignAxis(bend, log, 1, 0)).toBe(false); // already east-west
    expect(alignAxis(bend, log, 2, 3)).toBe(false); // diagonal: no clear way
    expect(alignAxis(bend, log, 0.2, 3)).toBe(true);
    expect(log.axis).toBe('v');
    // in the narrow east-west part a long log cannot turn (it would stick into the bank)
    const narrow: TowWorld = {
      water: (tx, ty) => tx >= 3 && tx <= 24 && ty === 30,
      snag: () => false,
    };
    const n = makeLog(centre(10, 30).x, centre(10, 30).y, true);
    expect(alignAxis(narrow, n, 0, 3)).toBe(false);
    expect(n.axis).toBe('h');
  });

  it('a towed log follows round the bend and turns into the south leg, never leaving the water', () => {
    const c = centre(10, 30);
    const log = makeLog(c.x, c.y);
    log.hooked = true;
    // the farmer walks west along the north bank, then south down the inner bank beside the south leg (x 6): the
    // pull would hold the log against the inside of the bend, so it goes on downstream (west, then south)
    const along = (l: { x: number; y: number }) =>
      Math.floor(l.y / TILE) <= 32 && Math.floor(l.x / TILE) > 5 ? { x: -1, y: 0 } : { x: 0, y: 1 };
    const route: [number, number][] = [];
    for (let x = 9; x >= 7; x--) route.push([x, 28]);
    for (let y = 33; y <= 40; y++) route.push([6, y]);
    for (const [tx, ty] of route)
      for (let i = 0; i < 20; i++) {
        follow(bend, log, handsOn(tx, ty), 1000 / 60, along(log));
        expect(placeAt(bend, log, log.x, log.y).ok).toBe(true);
      }
    expect(log.axis).toBe('v');
    expect(Math.floor(log.y / TILE)).toBeGreaterThanOrEqual(34);
  });
});

describe('towing: what Action means', () => {
  const base = {
    hooked: false,
    snagged: false,
    homing: false,
    logInView: true,
    waterDist: 1,
    front: false,
  };
  it('tugs a snagged log, sends a free hooked log home, and does nothing else while it goes', () => {
    expect(actionVerb({ ...base, hooked: true, snagged: true })).toBe('tug');
    expect(actionVerb({ ...base, hooked: true })).toBe('home');
    expect(actionVerb({ ...base, hooked: true, homing: true })).toBe('busy');
    // hooked, the tow owns Action even with something in front
    expect(actionVerb({ ...base, hooked: true, front: true })).toBe('home');
  });

  it('hooks a log in view near the water, unless Action has something in front of the farmer', () => {
    expect(actionVerb(base)).toBe('hook');
    // a ripe crop or a forage good in front beats the tow while no log is hooked
    expect(actionVerb({ ...base, front: true })).toBeNull();
    expect(actionVerb({ ...base, logInView: false })).toBeNull();
    expect(actionVerb({ ...base, waterDist: NEAR_WATER + 1 })).toBeNull();
    expect(actionVerb({ ...base, waterDist: NEAR_WATER })).toBe('hook');
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
