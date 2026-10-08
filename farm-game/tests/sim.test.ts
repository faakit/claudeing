import { describe, expect, it } from 'vitest';
import { crops, items, jobs as jobDefs, plots, projects, shops } from '../src/data';
import { JOBS_PER_DAY, jobReward } from '../src/systems/jobs';
import { performAction, type TileInfo } from '../src/systems/actions';
import { craft } from '../src/systems/crafting';
import { collect, feed, moveIn } from '../src/systems/animals';
import { levelOf } from '../src/systems/skills';
import { endDay } from '../src/systems/day';
import { buyItem, buyUpgrade, shipStack, stockFor, upgradeLevel } from '../src/systems/economy';
import { maxEnergy } from '../src/systems/energy';
import { getSoil, isMature } from '../src/systems/farming';
import { goalProgress } from '../src/systems/goals';
import { addItem, countItem, countStack } from '../src/systems/inventory';
import {
  donateGold,
  donateItems,
  isProjectOpen,
  itemNeeds,
  projectLevel,
  visibleProjects,
} from '../src/systems/projects';
import { keyOf, refOf, sellValue, type ItemRef } from '../src/systems/itemRef';
import { deliverOrder, ensureOrders, haveFor } from '../src/systems/orders';
import { interactWith, objectsOn } from '../src/systems/placeables';
import { buyPlot, ownsPlot, ownsTile } from '../src/systems/plots';
import { jarContents, loadJar, preserveOf } from '../src/systems/preserves';
import { createInitialState, type GameState } from '../src/state/GameState';

const STORE = 'town_general_store';
/** Grass tiles outside every plot, beside the house, where the bot puts its jars. */
const JAR_SPOTS: [number, number][] = [5, 6, 7, 8, 9, 10].map((x) => [x, 14]);

const tile = (s: GameState, tx: number, ty: number): TileInfo => ({
  map: 'farm',
  tx,
  ty,
  kind: 'grass',
  tillable: true,
  blocked: false,
  farmland: true,
  owned: ownsTile(s, tx, ty),
});
const POND: TileInfo = {
  map: 'farm',
  tx: 0,
  ty: 0,
  kind: 'water',
  tillable: false,
  blocked: true,
  farmland: true,
};

/** Every tile of every plot the bot owns, the greenhouse too once it is built. */
function field(s: GameState): [number, number][] {
  const out: [number, number][] = [];
  for (const [id, p] of Object.entries(plots)) {
    if (!ownsPlot(s, id)) continue;
    const [x0, y0, w, h] = p.rect;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push([x, y]);
  }
  return out;
}

/** Where the bot stands its scarecrows: the middle of each 9x9 block of every plot it owns. */
function scarecrowSpots(s: GameState): [number, number][] {
  const out: [number, number][] = [];
  for (const [id, p] of Object.entries(plots)) {
    if (!ownsPlot(s, id) || p.greenhouse) continue;
    const [x0, y0, w, h] = p.rect;
    for (let y = y0 + Math.min(4, h - 1); y < y0 + h + 4; y += 9)
      for (let x = x0 + Math.min(4, w - 1); x < x0 + w + 4; x += 9)
        out.push([Math.min(x, x0 + w - 1), Math.min(y, y0 + h - 1)]);
  }
  return out;
}

/** Select an item, moving it onto the hotbar first if it sits in the bag. */
function equipItem(s: GameState, id: string): boolean {
  const i = s.inventory.slots.findIndex((x) => x?.item === id);
  if (i < 0) return false;
  if (i >= 8) {
    const tmp = s.inventory.slots[7] ?? null;
    s.inventory.slots[7] = s.inventory.slots[i] ?? null;
    s.inventory.slots[i] = tmp;
    s.inventory.selected = 7;
  } else s.inventory.selected = i;
  return true;
}

/** Profit per tile-day for a seed, if it can mature this season. */
function score(s: GameState, seedId: string): number {
  const crop = crops[items[seedId]!.plants!]!;
  // Outdoors only this season's crops grow (with a greenhouse the shop sells them all: critique 6, F5).
  if (!crop.seasons.includes(s.time.season)) return -1;
  const left = 28 - s.time.day;
  const grow = crop.stageDays.reduce((a, b) => a + b, 0);
  if (grow >= left) return -1;
  const harvests = crop.regrowDays ? 1 + Math.floor((left - grow) / crop.regrowDays) : 1;
  const revenue = items[crop.harvestItem]!.sellPrice! * harvests;
  const days = crop.regrowDays ? grow + (harvests - 1) * crop.regrowDays : grow;
  return (revenue - items[seedId]!.buyPrice!) / days;
}

/**
 * Tile actions left today. A tireless bot has no limit; the human-paced run gives it a fixed number of
 * Action presses a day (critique 5, F9: the sim had no clock).
 */
const actions = { left: Infinity };
function act(s: GameState, t: TileInfo): ReturnType<typeof performAction> {
  if (actions.left <= 0)
    return { ok: false, message: 'out of time' } as ReturnType<typeof performAction>;
  actions.left -= 1;
  return performAction(s, t);
}

/** Where the gold came from, for the log and the bounds. */
interface Ledger {
  shipped: number;
  orders: number;
  jarsLoaded: number;
}

/**
 * A competent but not obsessive player: waters daily, harvests, fills the board requests it can, keeps up to
 * six preserve jars busy and a coop of three hens, ships the rest, buys land and upgrades when comfortably
 * affordable. It does not fish, mine, do jobs on purpose or fund projects (except in the two-year run).
 */
function playDay(s: GameState, ledger: Ledger, budget = Infinity): void {
  actions.left = budget;
  const FIELD = field(s);
  const refill = () => {
    equipItem(s, 'watering_can');
    if (s.water < 3) act(s, POND);
  };
  // 1. harvest
  for (const [x, y] of FIELD) {
    const soil = getSoil(s, x, y);
    if (soil?.crop && isMature(soil.crop)) act(s, tile(s, x, y));
  }
  // 2. collect finished jars, then fill the board requests the bag can cover (before the rival comes)
  for (const obj of objectsOn(s, 'farm')) if (obj.type === 'preserve_jar') interactWith(s, obj);
  ensureOrders(s);
  for (const o of s.orders.list)
    if (!o.done && haveFor(s, o) >= o.qty) {
      const before = s.money;
      if (deliverOrder(s, o.id) === 'ok') ledger.orders += s.money - before;
    }
  // 3. keep jars busy with the most valuable fruit or vegetable on hand
  for (const obj of objectsOn(s, 'farm')) {
    if (obj.type !== 'preserve_jar' || jarContents(obj)) continue;
    const best = s.inventory.slots
      .filter((st): st is NonNullable<typeof st> => !!st && !!preserveOf(st))
      .map((st) => refOf(st))
      .sort((a, b) => sellValue(b) - sellValue(a))[0];
    if (best && loadJar(s, obj, best) === 'ok') ledger.jarsLoaded += 1;
  }
  // 4. ship everything sellable that is not a seed, tool or machine
  const kinds = new Map<string, ItemRef>();
  for (const st of s.inventory.slots)
    if (st && ['crop', 'preserve', 'material', 'forage', 'product'].includes(items[st.item]!.type))
      kinds.set(keyOf(st), refOf(st));
  for (const ref of kinds.values()) shipStack(s, ref, countStack(s, ref));
  // 5. a scarecrow in the middle of every block of 9x9 of each plot it owns (crows take the odd crop)
  for (const [x, y] of scarecrowSpots(s))
    if (!objectsOn(s, 'farm').some((o) => o.tx === x && o.ty === y) && !getSoil(s, x, y)?.crop) {
      if (countItem(s, 'scarecrow') === 0 && buyItem(s, STORE, 'scarecrow', 1) !== 'ok') break;
      if (getSoil(s, x, y)) delete s.farm.tiles[`${x},${y}`]; // an empty tilled tile gives way
      if (equipItem(s, 'scarecrow')) act(s, tile(s, x, y));
    }
  // 6a. a coop of three hens once Farming 3 allows it: collect and feed every day, ship the eggs
  const coop = objectsOn(s, 'farm').find((o) => o.type === 'coop');
  if (!coop && s.money > 3000 && levelOf(s, 'farming') >= 3) {
    buyItem(s, STORE, 'fiber', 20);
    if (craft(s, 'coop') === 'ok' && equipItem(s, 'coop')) act(s, tile(s, 12, 14));
    buyItem(s, STORE, 'chicken', 3);
  }
  if (coop) {
    moveIn(s, coop);
    collect(s, coop);
    if (countItem(s, 'chicken_feed') < 3) buyItem(s, STORE, 'chicken_feed', 9);
    feed(s, coop);
  }
  // 6. craft and place jars once unlocked (it buys the fiber), then land and upgrades when comfortable
  const jars = objectsOn(s, 'farm').filter((o) => o.type === 'preserve_jar').length;
  if (jars < JAR_SPOTS.length && s.money > 600) {
    buyItem(s, STORE, 'fiber', 10);
    if (craft(s, 'preserve_jar') === 'ok' && equipItem(s, 'preserve_jar')) {
      const [x, y] = JAR_SPOTS[jars]!;
      act(s, tile(s, x, y));
    }
  }
  const nextPlot = Object.entries(plots)
    .filter(([id, p]) => !ownsPlot(s, id) && !p.project)
    .sort((a, b) => a[1].price - b[1].price)[0];
  if (nextPlot && s.money > nextPlot[1].price * 1.8) buyPlot(s, nextPlot[0]);
  for (const up of shops[STORE]!.upgrades.filter((u) => u.id === 'can' || u.id === 'stamina')) {
    const price = up.levels[upgradeLevel(s, up)]?.price;
    if (price !== undefined && s.money > price * 1.6) buyUpgrade(s, up);
  }
  // 7. water existing crops
  for (const [x, y] of FIELD) {
    const soil = getSoil(s, x, y);
    if (soil?.crop && !isMature(soil.crop) && !soil.watered && s.energy > 0) {
      refill();
      equipItem(s, 'watering_can');
      act(s, tile(s, x, y));
    }
  }
  // 8. buy and plant the best in-season seed with spare energy
  const best = stockFor(STORE, s.time.season, s)
    .filter((id) => items[id]?.type === 'seed')
    .map((id) => ({ id, sc: score(s, id) }))
    .filter((e) => e.sc > 0)
    .sort((a, b) => b.sc - a.sc)[0];
  if (!best) return;
  for (const [x, y] of FIELD) {
    if (s.energy < 3) break;
    const soil = getSoil(s, x, y);
    if (soil?.crop) continue;
    if (
      countItem(s, best.id) === 0 &&
      buyItem(s, STORE, best.id, Math.min(20, Math.floor(s.money / items[best.id]!.buyPrice!))) !==
        'ok' &&
      buyItem(s, STORE, best.id, 1) !== 'ok'
    )
      break;
    if (!soil) {
      equipItem(s, 'hoe');
      if (!act(s, tile(s, x, y)).ok) continue;
    }
    equipItem(s, best.id);
    if (!act(s, tile(s, x, y)).ok) continue;
    refill();
    equipItem(s, 'watering_can');
    act(s, tile(s, x, y));
  }
}

/**
 * The bot's median full year over five seeds when the band was last set (depth round 2: multi-day requests,
 * animal goods on the board, crows and scarecrows, smaller jobs, crop requests only for crops you grow, and
 * a coop of three hens, Clay on last days only). Seed 42 alone earned 227,442. A balance change that
 * moves the median by a fifth down or a quarter up fails the five-seed test and needs a DECISIONS.md note.
 */
const SIM_EARNED = 227_442;

describe('balance simulation (decent player, full year)', () => {
  it('a competent farmer earns a satisfying amount from crops, orders and jars, without a runaway', () => {
    const s = createInitialState();
    s.rng = 42;
    const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0 };
    const log: string[] = [];
    for (let day = 1; day <= 112; day++) {
      playDay(s, ledger);
      endDay(s, { passedOut: false, weedCandidates: [] });
      ledger.shipped += s.lastSummary?.total ?? 0;
      if (day % 14 === 0)
        log.push(
          `day ${day} (${s.time.season} ${s.time.day}): gold ${s.money}, earned ${s.stats['earned'] ?? 0}, ` +
            `shipped ${ledger.shipped}, orders ${ledger.orders}, jars ${ledger.jarsLoaded}, ` +
            `plots ${s.plots.length}, energy ${maxEnergy(s)}, goal ${goalProgress(s)?.goal.id ?? 'done'}`,
        );
    }
    console.log(log.join('\n'));
    const earned = s.stats['earned'] ?? 0;
    expect(s.money).toBeGreaterThan(0);
    expect(earned).toBeGreaterThan(SIM_EARNED * 0.67);
    expect(earned).toBeLessThan(SIM_EARNED * 1.7);
    // Side income stays a side: requests are a bonus on top of the farm, not the farm.
    expect(ledger.orders).toBeLessThan(earned * 0.35);
    expect(ledger.jarsLoaded).toBeGreaterThan(20);
    // Gold has somewhere to go: the bot bought land.
    expect(s.plots.length).toBeGreaterThan(2);
    // Scarecrows over every plot: the crows get next to nothing.
    expect(s.stats['crowsAte'] ?? 0).toBeLessThan(10);
    // Clay takes one request a day, and only on its last day (critique 7, F2): what he takes, the bot had
    // its full days for. Logged, not bounded: most of what he takes would have expired anyway.
    const posted = Math.max(...s.orders.list.map((o) => o.id));
    console.log(`requests posted ${posted}, Clay took ${s.stats['rivalTook'] ?? 0}`);
    for (const o of s.orders.list.filter((x) => x.rival)) expect(o.takenOn).toBe(o.until);
  });

  // One seed is a tripwire, not evidence (critique 5, F9): the same bot on five seeds, judged on the median.
  it('five seeds agree: the median year sits near the pinned one and none runs away', () => {
    const years = [42, 7, 99, 1234, 2026].map((seed) => {
      const s = createInitialState();
      s.rng = seed;
      const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0 };
      for (let day = 1; day <= 112; day++) {
        playDay(s, ledger);
        endDay(s, { passedOut: false, weedCandidates: [] });
      }
      return s.stats['earned'] ?? 0;
    });
    const median = [...years].sort((a, b) => a - b)[2]!;
    console.log(`five seeds: ${years.join(', ')} (median ${median})`);
    expect(median).toBeGreaterThan(SIM_EARNED * 0.8);
    expect(median).toBeLessThan(SIM_EARNED * 1.25);
    for (const y of years) {
      expect(y).toBeGreaterThan(SIM_EARNED * 0.6);
      expect(y).toBeLessThan(SIM_EARNED * 1.6);
    }
  });
});

/**
 * Jobs are a nudge, not a living (owner, depth round 2): over the first two weeks, three average jobs a
 * day must pay less than the farm itself earns the tireless bot (median of five seeds).
 */
/**
 * A human-paced bot: 150 Action presses a day (about what a 15-minute session allows; the hoe, can and
 * seeds still cover several tiles per press once upgraded). Not pinned, but it must earn a real living
 * and reach the first statue level's price within its first year.
 */
describe('balance simulation (human-paced)', () => {
  it('earns a satisfying year without being a tireless bot', () => {
    const years = [42, 7, 99].map((seed) => {
      const s = createInitialState();
      s.rng = seed;
      const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0 };
      for (let day = 1; day <= 112; day++) {
        playDay(s, ledger, 150);
        endDay(s, { passedOut: false, weedCandidates: [] });
      }
      return s.stats['earned'] ?? 0;
    });
    const median = [...years].sort((a, b) => a - b)[1]!;
    console.log(`human-paced years: ${years.join(', ')} (median ${median})`);
    expect(median).toBeLessThan(SIM_EARNED);
    expect(median).toBeGreaterThan(projects['statue']!.gold);
  });
});

describe('balance: early jobs against early farming', () => {
  it('days 2 to 14 of jobs pay at most three quarters of what the farm earns by day 14', () => {
    const farm = [42, 7, 99, 1234, 2026]
      .map((seed) => {
        const s = createInitialState();
        s.rng = seed;
        const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0 };
        for (let day = 1; day <= 14; day++) {
          playDay(s, ledger);
          endDay(s, { passedOut: false, weedCandidates: [] });
        }
        return s.stats['earned'] ?? 0;
      })
      .sort((a, b) => a - b)[2]!;
    const early = jobDefs.filter((j) => !j.requires);
    const weight = early.reduce((n, j) => n + j.weight, 0);
    const mean =
      early.reduce((n, j) => n + j.weight * jobReward(j, (j.qty[0] + j.qty[1]) / 2, 1), 0) / weight;
    const jobsGold = 13 * JOBS_PER_DAY * mean;
    console.log(`farm by day 14 (median): ${farm}; jobs days 2-14: ${Math.round(jobsGold)}`);
    expect(jobsGold).toBeLessThan(farm * 0.75);
    // ...but still worth doing: a day of jobs buys a row of seeds.
    expect(JOBS_PER_DAY * mean).toBeGreaterThan(60);
  });
});

/**
 * The same bot over two years, also funding town projects as soon as it can (it is handed the goods a
 * project asks for, standing in for the mine and the machines it does not play). This measures whether the
 * late-game sinks absorb a tireless farmer's gold.
 */
describe('balance simulation (two years, funding projects)', () => {
  it("the late-game sinks absorb a tireless farmer's second year", () => {
    const s = createInitialState();
    s.rng = 42;
    const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0 };
    const log: string[] = [];
    let sunk = 0;
    for (let day = 1; day <= 224; day++) {
      playDay(s, ledger);
      sunk += fundProjects(s);
      endDay(s, { passedOut: false, weedCandidates: [] });
      if (day % 28 === 0)
        log.push(
          `day ${day} (y${s.time.year} ${s.time.season}): gold ${s.money}, earned ${s.stats['earned'] ?? 0}, ` +
            `sunk ${sunk}, projects ${s.stats['projectsDone'] ?? 0}, statue ${projectLevel(s, 'statue')}`,
        );
    }
    console.log(log.join('\n'));
    // Without the repeatable statue this bot ended year two holding about 280k with nothing to buy
    // (depth round 2). Now most of it goes into the statue (level 3 or more by the end of year two).
    expect(sunk).toBeGreaterThan(250_000);
    expect(s.money).toBeLessThan(100_000);
    expect(projectLevel(s, 'statue')).toBeGreaterThanOrEqual(3);
    expect(s.stats['projectsDone']).toBe(Object.values(projects).filter((p) => !p.repeat).length);
  });
});

/**
 * Once all the land is bought, give gold (keeping a 30,000g float for a field of seeds) and the goods to the first open
 * project. Returns the gold given.
 */
function fundProjects(s: GameState): number {
  if (Object.entries(plots).some(([id, p]) => !p.project && !ownsPlot(s, id))) return 0;
  let given = 0;
  for (const id of visibleProjects(s)) {
    if (!isProjectOpen(s, id)) continue; // a repeatable one (the statue) stays open
    for (const n of itemNeeds(s, id)) if (n.given < n.need) addItem(s, n.item, n.need - n.given);
    donateItems(s, id);
    const res = donateGold(s, id, s.money - 30000);
    if (res.ok) given += res.given;
    break;
  }
  return given;
}
