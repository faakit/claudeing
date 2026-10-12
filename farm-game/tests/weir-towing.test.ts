import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { items, npcs, valley, type DriftDef } from '../src/data';
import type { GameState } from '../src/state/GameState';
import { autoItemFor } from '../src/systems/autoTool';
import { endDay } from '../src/systems/day';
import {
  arrivalsOn,
  driftDefaults,
  isLong,
  lanePath,
  laneRest,
  landLog,
  pickLane,
  riverWorld,
  spawnDrift,
  waitingLogs,
} from '../src/systems/drift';
import { isGiftable, friendPerk, npcsHome } from '../src/systems/friendship';
import {
  arrivals,
  deliverTimber,
  familyHome,
  houseAt,
  houseStage,
  homecomingDue,
  takeHouseLit,
  villagerHome,
} from '../src/systems/houses';
import { addItem, countItem } from '../src/systems/inventory';
import { npcLocation } from '../src/systems/npcs';
import { landmarksOn } from '../src/systems/projects';
import { migrate } from '../src/systems/save';
import { absoluteDay } from '../src/systems/time';
import {
  atSlip,
  atSlipBank,
  driftAlong,
  follow,
  haul,
  hookStand,
  inReach,
  land,
  makeLog,
  ROPE_PX,
  TILE,
  tug,
  type Log,
  type TowWorld,
} from '../src/systems/towing';
import { partOffer, valleyStage } from '../src/systems/valley';
import { measureText } from '../src/ui/fontMetrics';
import { FULL_INVENTORY, newState } from './helpers';

const D = valley.weir!.drift as DriftDef;
const sleep = (s: GameState) => endDay(s, { passedOut: false, weedCandidates: [] });
const lanes = Object.keys(D.lanes);
const code = (lane: string, long: boolean) => 1 + lanes.indexOf(lane) * 2 + (long ? 1 : 0);

/** A game with the river back (the weir restored by play), on absolute day `day`. */
function river(day = 28 + 20): GameState {
  const s = newState();
  const seasons = ['spring', 'summer', 'fall', 'winter'] as const;
  s.time.season = seasons[Math.floor((day - 1) / 28) % 4]!;
  s.time.day = ((day - 1) % 28) + 1;
  Object.assign(s.stats, {
    'valley.farmGreen': 1,
    'valley.greenSeen': 1,
    'place.spring': 3,
    'valley.creekSeen': 1,
    'place.weir': 3,
    'place.weir.opened': 47,
    'valley.riverSeen': 1,
    'mail.welcome': 1,
  });
  return s;
}

describe('drift timber: the morning queue', () => {
  it('1 or 2 logs a day, 1 in winter; about one in three long', () => {
    const counts = new Set<number>();
    let long = 0;
    for (let day = 1; day <= 300; day++) {
      counts.add(arrivalsOn(day, 'summer'));
      expect(arrivalsOn(day, 'winter')).toBe(1);
      if (isLong(day, 0)) long++;
    }
    expect([...counts].sort()).toEqual([1, 2]);
    expect(long / 300).toBeGreaterThan(0.25);
    expect(long / 300).toBeLessThan(0.42);
  });

  it('never the same lane twice in a row, and never the same snag: ten consecutive days', () => {
    const s = river(28 + 3);
    const seen: { lane: string; snag: string }[] = [];
    for (let i = 0; i < 10; i++) {
      for (const log of spawnDrift(s)) {
        seen.push({ lane: log.lane, snag: String(D.lanes[log.lane]!.snag ?? 'turn') });
        // landed the same day, so the queue never caps the next morning's
        addItem(s, 'timber', 0);
        delete s.stats[`drift.${log.slot}`];
      }
      s.time.day++;
    }
    expect(seen.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!.lane, `log ${i}`).not.toBe(seen[i - 1]!.lane);
      expect(seen[i]!.snag, `log ${i}`).not.toBe(seen[i - 1]!.snag);
    }
    expect(new Set(seen.map((x) => x.lane)).size).toBe(3);
  });

  it('picks any lane but the one before', () => {
    for (let day = 1; day < 60; day++)
      for (const prev of [0, 1, 2]) expect(pickLane(day, 0, prev)).not.toBe(prev);
  });

  it('at most three wait; nothing arrives before the river is back', () => {
    const dry = river();
    dry.stats['place.weir'] = 2;
    expect(spawnDrift(dry)).toEqual([]);
    const s = river();
    for (let i = 0; i < 6; i++) {
      spawnDrift(s);
      s.time.day++;
    }
    expect(waitingLogs(s).length).toBe(D.maxWaiting);
    expect(spawnDrift(s)).toEqual([]);
  });

  it('the morning hook sends the day’s logs (positions are not saved: only the queue)', () => {
    const s = river();
    sleep(s);
    expect(waitingLogs(s).length).toBe(arrivalsOn(absoluteDay(s), s.time.season));
    expect(Object.keys(s.stats).filter((k) => k.startsWith('drift.') && /x|y/.test(k))).toEqual([]);
  });

  it('landing gives 1 timber for a short log, 3 for a long one, and the log leaves the queue', () => {
    const s = river();
    s.stats['drift.0'] = code('west', false);
    s.stats['drift.1'] = code('middle', true);
    const a = landLog(s, 0);
    expect(a.ok && a.timber).toBe(1);
    const b = landLog(s, 1);
    expect(b.ok && b.timber).toBe(3);
    expect(countItem(s, 'timber')).toBe(4);
    expect(waitingLogs(s)).toEqual([]);
    expect(s.stats['towed']).toBe(2);
    expect(landLog(s, 1)).toEqual({ ok: false, reason: 'none' });
  });

  it('a full bag refuses the landing and nothing changes', () => {
    const s = river();
    addItem(s, 'stone', FULL_INVENTORY);
    s.stats['drift.0'] = code('east', true);
    const before = JSON.stringify(s);
    expect(landLog(s, 0)).toEqual({ ok: false, reason: 'bag' });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('a save made while towing keeps the log in the queue: it comes back at its lane’s north edge', () => {
    const s = river();
    s.stats['drift.0'] = code('middle', false);
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(waitingLogs(back)).toEqual([{ slot: 0, lane: 'middle', long: false }]);
    // where a waiting log enters: its lane's first waypoint, at the river's north edge
    for (const lane of lanes)
      for (const long of [false, true]) {
        const [, y] = lanePath(D, lane, long)[0]!;
        // the log's north end in the river's first rows (the east lane enters two rows down, out of the north bank's
        // reach: the spur must turn it before anyone can hook it)
        const top = Math.floor((y - (long ? 15 : 7)) / TILE) - D.river[1];
        expect(top, `${lane} ${long}`).toBe(lane === 'east' ? 2 : 0);
      }
  });

  it('sanitize drops a queue entry that names no lane', () => {
    expect(driftDefaults({ 'drift.0': 99, 'drift.1': 3, 'drift.7': 1 })).toEqual({ 'drift.1': 3 });
  });

  it('timber income stays under 20g a day over a year (5g each, every log landed)', () => {
    const s = river(1);
    s.stats['place.weir'] = 3;
    let timber = 0;
    for (let day = 0; day < 112; day++) {
      for (const log of spawnDrift(s)) {
        const r = landLog(s, log.slot);
        if (r.ok) timber += r.timber;
      }
      s.inventory.slots = s.inventory.slots.map((x) => (x?.item === 'timber' ? null : x));
      s.time.day++;
      if (s.time.day > 28) {
        s.time.day = 1;
        s.time.season = (['summer', 'fall', 'winter', 'spring'] as const)[
          ['spring', 'summer', 'fall', 'winter'].indexOf(s.time.season)
        ]!;
      }
    }
    expect(items['timber']!.sellPrice).toBe(5);
    expect((timber * 5) / 112).toBeLessThan(20);
    expect(timber).toBeGreaterThan(112); // and it is a real source: more than a timber a day on average
  });
});

/** The town river towed like a person: the farmer walks the banks; tug when caught (a pure sketch of the scene). */
function towTown(lane: string, long: boolean, from: [number, number]) {
  const world: TowWorld = riverWorld(D);
  const walkable = (x: number, y: number) =>
    (x === 16 && y >= 21 && y <= 32) ||
    (y === 21 && x >= 15 && x <= 22) ||
    (y === 32 && (x === 17 || x === 18)) ||
    (x === 15 && y >= 21 && y <= 32 && y !== 30);
  const path = lanePath(D, lane, long);
  const log: Log = makeLog(path[0]![0], path[0]![1], long, 'v');
  const offWater: string[] = [];
  const check = () => {
    const tx = Math.floor(log.x / TILE);
    const ty = Math.floor(log.y / TILE);
    if (!world.water(tx, ty)) offWater.push(`${tx},${ty}`);
  };
  // it drifts down its lane to rest (40 s)
  for (let t = 0; t < 40000; t += 16) {
    driftAlong(world, log, path, D.speed, 16);
    check();
  }
  const rested = { x: log.x, y: log.y, snag: log.snag ? `${log.snag.tx},${log.snag.ty}` : null };
  const p = { x: from[0] * TILE + 8, y: from[1] * TILE + 12 };
  const tile = () => ({ tx: Math.floor(p.x / TILE), ty: Math.floor((p.y - 3) / TILE) });
  const hands = () => ({ x: p.x, y: p.y - 6 });
  const bfs = (to: { tx: number; ty: number }) => {
    const key = (a: { tx: number; ty: number }) => `${a.tx},${a.ty}`;
    const prev = new Map<string, { tx: number; ty: number } | null>([[key(tile()), null]]);
    const q = [tile()];
    while (q.length) {
      const c = q.shift()!;
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ] as const) {
        const n = { tx: c.tx + dx, ty: c.ty + dy };
        if (!walkable(n.tx, n.ty) || prev.has(key(n))) continue;
        prev.set(key(n), c);
        q.push(n);
      }
    }
    const out: { tx: number; ty: number }[] = [];
    let c: { tx: number; ty: number } | null | undefined = to;
    while (c) {
      out.unshift(c);
      c = prev.get(key(c));
    }
    return out.slice(1);
  };
  const stand = hookStand(log, tile(), walkable, 6, -6);
  if (!stand) return { rested, stand: null, snags: [] as string[], landed: false, offWater };
  let route = bfs(stand);
  const walk = () => {
    const n = route[0];
    if (!n) return;
    const gx = n.tx * TILE + 8;
    const gy = n.ty * TILE + 12;
    const d = Math.hypot(gx - p.x, gy - p.y);
    if (d <= 64 * 0.016) {
      p.x = gx;
      p.y = gy;
      route.shift();
    } else {
      p.x += ((gx - p.x) / d) * 64 * 0.016;
      p.y += ((gy - p.y) / d) * 64 * 0.016;
    }
  };
  while (route.length) walk();
  expect(inReach(hands(), log, -6)).toBe(true);
  log.hooked = true;
  route = bfs({ tx: 18, ty: 32 });
  const snags: string[] = [];
  let caughtAt = -1;
  let slack = false;
  for (let t = 0; t < 30000; t += 16) {
    if (caughtAt < 0) walk();
    const h = hands();
    if (slack && h.y >= log.y - 4) slack = false;
    const along = Math.floor(log.y / TILE) >= D.turnRow ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const r = slack ? 'slack' : follow(world, log, h, 16, along);
    check();
    if (r === 'snagged') {
      if (caughtAt < 0) {
        caughtAt = t;
        snags.push(`${log.snag!.tx},${log.snag!.ty}`);
      }
      const d = Math.hypot(h.x - log.x, h.y - log.y);
      if (t - caughtAt >= 450 || d > ROPE_PX + 8) {
        const waited = !!log.snag?.drift;
        const res = tug(world, log, h);
        if (res?.freed) {
          caughtAt = -1;
          slack = waited;
        } else caughtAt = t - 200;
      }
    }
    if (atSlip(log, { tx: D.slip.water[0], ty: D.slip.water[1] })) return finish();
    if (!route.length && !log.snag && atSlipBank(tile(), { tx: 19, ty: 32 })) {
      for (let u = 0; u < 5000; u += 16) {
        const hr = haul(world, log, { tx: D.slip.water[0], ty: D.slip.water[1] }, 16);
        check();
        if (hr === 'arrived') return finish();
      }
    }
  }
  return { rested, stand, snags, landed: false, offWater };
  function finish() {
    land(log);
    return { rested, stand, snags, landed: true, offWater };
  }
}

describe('towing on the town river (lanes, snags, the slip)', () => {
  const froms: [number, number][] = [
    [16, 21],
    [14, 26],
    [16, 31],
  ];

  it('the west lane rests at the head and catches on the reed bed on the way down', () => {
    for (const long of [false, true]) {
      const r = towTown('west', long, [16, 21]);
      expect(r.rested.snag).toBeNull();
      expect(r.snags[0], `long ${long}`).toBe(D.lanes['west']!.snag!.join(','));
      expect(r.landed).toBe(true);
      expect(r.offWater).toEqual([]);
    }
  });

  it('the middle lane drifts onto the first spur and waits there, caught; one tug (two for a long log) frees it', () => {
    for (const long of [false, true])
      for (const from of froms) {
        const r = towTown('middle', long, from);
        expect(r.rested.snag, `${long} ${from}`).toBe(D.lanes['middle']!.snag!.join(','));
        expect(r.snags[0]).toBe(D.lanes['middle']!.snag!.join(','));
        expect(r.landed, `${long} ${from}`).toBe(true);
        expect(r.offWater).toEqual([]);
        // it rests where the scene meets it (laneRest)
        const rest = laneRest(D, 'middle', long)!;
        expect(Math.abs(rest.y - r.rested.y)).toBeLessThanOrEqual(1);
      }
  });

  it('the east lane is out of reach of the west bank until the spur turns it; it rests by the mill wheel', () => {
    const world = riverWorld(D);
    for (const long of [false, true]) {
      const path = lanePath(D, 'east', long);
      const log = makeLog(path[0]![0], path[0]![1], long, 'v');
      for (let t = 0; t < 40000; t += 16) {
        driftAlong(world, log, path, D.speed, 16);
        // never in reach from the west bank before it is turned (above the spur's row)
        if (log.y < D.snags[2]![1] * TILE) {
          // nor from the north bank
          for (let tx = 15; tx <= 22; tx++)
            expect(
              inReach({ x: tx * TILE + 8, y: 21 * TILE + 7 }, log),
              `${long} north ${tx}`,
            ).toBe(false);
          for (let ty = 21; ty <= 31; ty++)
            expect(inReach({ x: 16 * TILE + 8, y: ty * TILE + 7 }, log), `${long} ${ty}`).toBe(
              false,
            );
        }
      }
      expect(log.snag).toBeNull();
      expect(Math.floor(log.x / TILE)).toBe(20);
      expect(Math.floor(log.y / TILE)).toBeGreaterThanOrEqual(29); // against the mill wheel's corner
      const r = towTown('east', long, [16, 31]);
      expect(r.snags).toEqual([]);
      expect(r.landed).toBe(true);
    }
  });

  it('the slip is on the south bank, outside every zone and fixed spot; the snags are water tiles', () => {
    const [bx, by] = D.slip.bank;
    expect(by).toBe(D.river[1] + D.river[3]); // the row below the river
    expect(D.slip.water).toEqual([bx, by - 1]);
    for (const [x, y] of D.snags) expect(riverWorld(D).snag(x, y)).toBe(true);
    for (const [x, y] of D.snags)
      expect(x >= D.river[0] && x < D.river[0] + D.river[2] && y >= D.river[1]).toBe(true);
    const s = river();
    expect(
      landmarksOn(s, 'town').some((l) => l.kind === 'slip' && l.tx === bx && l.ty === by),
    ).toBe(true);
    s.stats['place.weir'] = 2;
    expect(landmarksOn(s, 'town').some((l) => l.kind === 'slip')).toBe(false);
  });
});

describe('the timber hook', () => {
  it('Orin sells it once the river is back and the bag holds none; it is a key item the auto tool never picks', () => {
    const s = river();
    expect(partOffer(s, 'orin')).toEqual({ item: 'timber_hook', price: 250 });
    addItem(s, 'timber_hook', 1);
    expect(partOffer(s, 'orin')).toBeNull();
    const dry = river();
    dry.stats['place.weir'] = 1;
    expect(partOffer(dry, 'orin')?.item ?? null).not.toBe('timber_hook');
    expect(items['timber_hook']!.type).toBe('key');
    expect(isGiftable({ item: 'timber_hook' })).toBe(false);
    expect(autoItemFor({ item: 'timber_hook', qty: 1 })).toBeNull();
  });

  it('Orin writes about drift timber the morning the river is back (an old save’s too)', () => {
    const s = river();
    sleep(s);
    expect(s.mail.list.some((l) => l.title === 'Drift timber')).toBe(true);
  });
});

describe('the Marls’ house and Senna coming home', () => {
  it('takes the timber you carry, up to what it needs; never before the weir; nothing changes on a refusal', () => {
    const dry = river();
    dry.stats['place.weir'] = 2;
    addItem(dry, 'timber', 3);
    const before = JSON.stringify(dry);
    expect(deliverTimber(dry, 'marls')).toEqual({ ok: false, reason: 'closed' });
    expect(JSON.stringify(dry)).toBe(before);
    const s = river();
    expect(deliverTimber(s, 'marls')).toEqual({ ok: false, reason: 'none' });
    addItem(s, 'timber', 4);
    expect(deliverTimber(s, 'marls')).toMatchObject({ ok: true, given: 4, total: 4, done: false });
    addItem(s, 'timber', 5);
    expect(deliverTimber(s, 'marls')).toMatchObject({ ok: true, given: 2, total: 6, done: true });
    expect(countItem(s, 'timber')).toBe(3);
    expect(deliverTimber(s, 'marls')).toEqual({ ok: false, reason: 'done' });
  });

  it('shows scaffolding by the share of timber, built at 6, nothing once the family is home', () => {
    const s = river();
    const at = (n: number) => {
      s.stats['house.marls'] = n;
      return houseStage(s, 'marls');
    };
    expect([0, 1, 2, 3, 4, 5, 6].map(at)).toEqual([null, 0, 0, 1, 1, 2, 3]);
    s.stats['arrived.marls'] = 60;
    expect(houseStage(s, 'marls')).toBeNull();
    expect(houseAt('town', 16, 6)).toBe('marls');
  });

  it('Senna arrives the morning after it is finished, not the same day; her letter comes at half', () => {
    const s = river();
    addItem(s, 'timber', 3);
    deliverTimber(s, 'marls');
    sleep(s);
    expect(s.mail.list.some((l) => l.title === 'Our old house')).toBe(true);
    addItem(s, 'timber', 3);
    deliverTimber(s, 'marls');
    expect(arrivals(s)).toEqual([]); // the same day
    sleep(s);
    expect(familyHome(s, 'marls')).toBe(true);
    expect(s.stats['arrived.marls']).toBe(absoluteDay(s));
    expect(homecomingDue(s, 'marls')).toBe(true);
    expect(valleyStage(s, 'town').variant).toBe('marls');
    expect(takeHouseLit(s, 'marls')).toBe(true);
    expect(takeHouseLit(s, 'marls')).toBe(false);
  });

  it('Senna is not drawn, scheduled or counted before she is home', () => {
    const s = river();
    s.friends['senna'] = { points: 400, talkedDay: 0, giftedDay: 0 };
    expect(villagerHome(s, 'senna')).toBe(false);
    for (let m = 0; m < 24 * 60; m += 30) expect(npcLocation('senna', m, s)).toBeNull();
    expect(npcsHome(s)).not.toContain('senna');
    expect(villagerHome(s, 'mara')).toBe(true);
    // no birthday letter for her while she is away
    s.time.season = 'spring';
    s.time.day = 22;
    sleep(s);
    expect(s.mail.list.some((l) => l.title.includes('Senna'))).toBe(false);
    s.stats['arrived.marls'] = 60;
    expect(npcLocation('senna', 9 * 60, s)).toEqual({ map: 'town', tx: 17, ty: 7 });
    expect(npcsHome(s)).toContain('senna');
    expect(friendPerk(s, 'none')).toBe(0);
  });

  it('her lines, the house texts and the hook fit', () => {
    const def = npcs['senna']!;
    for (const tier of ['stranger', 'friend', 'close', 'rain'] as const)
      for (const l of def.lines[tier]) {
        const text = typeof l === 'string' ? l : l.text;
        expect(measureText(`"${text}"`), text).toBeLessThanOrEqual(184 * 3);
      }
    const h = valley.houses!['marls']!;
    for (const t of [h.boarded!, h.built!, h.home!])
      expect(measureText(t), t).toBeLessThanOrEqual(184 * 2);
    expect(measureText(items['timber_hook']!.description)).toBeLessThanOrEqual(184 * 3);
  });
});

describe('saves from before M7 keep everything (no version bump)', () => {
  const m6 = (patch: (s: GameState) => void) => {
    const s = river(28 + 60);
    s.money = 1200;
    addItem(s, 'stone', 12);
    patch(s);
    return migrate(JSON.parse(JSON.stringify(s)));
  };

  it('a save from the M6 deploy (weir restored by play): nothing lost, nothing given; drift from the next morning', () => {
    const o = m6(() => {});
    expect(o.money).toBe(1200);
    expect(countItem(o, 'stone')).toBe(12);
    expect(waitingLogs(o)).toEqual([]);
    expect(countItem(o, 'timber')).toBe(0);
    expect(o.stats['house.marls'] ?? 0).toBe(0);
    expect(villagerHome(o, 'senna')).toBe(false);
    expect(valleyStage(o, 'town').variant).toBe('river');
    expect(partOffer(o, 'orin')?.item).toBe('timber_hook');
    sleep(o);
    expect(waitingLogs(o).length).toBeGreaterThan(0);
  });

  it('a save from before the weir existed (the river by the M6 default) gets drift and the houses too', () => {
    const s = newState();
    s.time.season = 'fall';
    s.time.day = 3;
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.stats['valley.weirOn'];
    const o = migrate(raw);
    expect(o.stats['place.weir']).toBe(3);
    expect(waitingLogs(o)).toEqual([]);
    expect(villagerHome(o, 'senna')).toBe(false);
    sleep(o);
    expect(waitingLogs(o).length).toBeGreaterThan(0);
    addItem(o, 'timber', 2);
    expect(deliverTimber(o, 'marls')).toMatchObject({ ok: true, total: 2 });
    expect(partOffer(o, 'orin')?.item).toBe('timber_hook');
  });
});

describe("Clay's turn at the weir (WORLD-PLAN 5.1 step 5)", () => {
  it('his rounds start late once the river is back, even below 2 hearts; never twice at 2 hearts', async () => {
    const { perk } = await import('../src/systems/skills');
    const { POINTS_PER_HEART } = await import('../src/systems/friendship');
    const s = river();
    s.stats['place.weir'] = 2;
    expect(perk(s, 'rivalLate')).toBe(0);
    s.stats['place.weir'] = 3;
    expect(perk(s, 'rivalLate')).toBe(180);
    s.friends['clay'] = { points: 2 * POINTS_PER_HEART, talkedDay: 0, giftedDay: 0 };
    expect(perk(s, 'rivalLate')).toBe(180);
  });
});
