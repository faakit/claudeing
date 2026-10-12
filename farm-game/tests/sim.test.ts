import { describe, expect, it, vi } from 'vitest';

// Year-long sims take seconds each; never fail on vitest's 5 s default under load (critique 11, F8).
vi.setConfig({ testTimeout: 60_000 });
import { crops, game, items, jobs as jobDefs, plots, projects, shops } from '../src/data';
import {
  JOBS_PER_DAY,
  jobProgress,
  jobReward,
  openJobs,
  takeJob,
  welcomeFactor,
} from '../src/systems/jobs';
import { performAction, type TileInfo } from '../src/systems/actions';
import { craft } from '../src/systems/crafting';
import { collect, feed, moveIn } from '../src/systems/animals';
import { levelOf } from '../src/systems/skills';
import { endDay } from '../src/systems/day';
import { buyItem, buyUpgrade, shipStack, stockFor, upgradeLevel } from '../src/systems/economy';
import { maxEnergy } from '../src/systems/energy';
import { getSoil, isMature } from '../src/systems/farming';
import { addStat, goalProgress } from '../src/systems/goals';
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
import {
  boardWants,
  deliverOrder,
  ensureOrders,
  haveFor,
  keepForRequests,
} from '../src/systems/orders';
import { giveToSpecial } from '../src/systems/specials';
import { interactWith, objectsOn } from '../src/systems/placeables';
import { buyPlot, ownsPlot, ownsTile } from '../src/systems/plots';
import { jarContents, loadJar, preserveOf } from '../src/systems/preserves';
import { createInitialState, type GameState } from '../src/state/GameState';
import { gameEvents } from '../src/systems/events';
import { hasBait, resolveCatch } from '../src/systems/fishing';
import { random } from '../src/systems/rng';

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

/** Casts a fisher makes an evening (a few minutes at the reel for a person). */
const FISHER_CASTS = 4;

/**
 * The fisher's evening: a few casts at the farm pond while more than 20 energy is left, landing three bites in
 * four (a fair player at the reel). The cast is a real Action; the reel is skipped.
 */
function fishEvening(s: GameState): void {
  const bite: { fish: string | null; bait: string | null } = { fish: null, bait: null };
  const off = gameEvents.on('startFishing', ({ fish, bait }) =>
    Object.assign(bite, { fish, bait }),
  );
  for (let i = 0; i < FISHER_CASTS && s.energy > 20; i++) {
    bite.fish = null;
    // Every cast takes a bait (bait round): beyond the worms the hoe digs up, a fisher buys Bait Mix at 6g.
    if (!hasBait(s) && buyItem(s, STORE, 'bait', 10) !== 'ok') break;
    if (!equipItem(s, 'fishing_rod') || !act(s, POND).ok || !bite.fish) break;
    resolveCatch(s, bite.fish, { caught: random(s) < 0.75, perfect: false }, bite.bait);
  }
  off();
}

/** Job stats the sim credits for a bot that does its jobs (`playDay`'s `jobs` option). */
const ERRANDS = new Set(['caught', 'mined', 'foraged', 'talked', 'likedGifts', 'cleared']);

/** Where the gold came from, for the log and the bounds. */
interface Ledger {
  shipped: number;
  orders: number;
  jarsLoaded: number;
  eggs: number;
}

/**
 * A competent but not obsessive player: waters daily, harvests, fills the board requests it can, keeps up to
 * six preserve jars busy and a coop of three hens, ships the rest, buys land and upgrades when comfortably
 * affordable. It does not fish, mine, do jobs on purpose or fund projects (except in the two-year run).
 * With `keepForBoard` it keeps back what the open requests want when it ships (as the bin's "Ship all
 * produce" does since critique 9, F2), instead of shipping everything.
 */
function playDay(
  s: GameState,
  ledger: Ledger,
  budget = Infinity,
  opts: { keepForBoard?: boolean; fish?: boolean; jobs?: boolean } = {},
): void {
  actions.left = budget;
  // It fills board requests every day, so it is at the town board: it takes the day's jobs there (the board
  // round). Finished ones it never turns in are paid by post at night.
  s.jobs.list.forEach((_, i) => takeJob(s, i));
  // A player who does the day's errands (fish, rocks, wild goods, a chat, a gift, weeds): credited, at ten
  // presses each. Shipping, harvest and board jobs happen through the farm work itself.
  if (opts.jobs)
    for (const job of openJobs(s))
      if (ERRANDS.has(job.stat) && actions.left >= 10) {
        addStat(s, job.stat, job.n - jobProgress(s, job));
        actions.left -= 10;
      }
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
  // 2b. a board-minded farmer also hands the special what the requests do not need
  if (opts.keepForBoard && s.special) giveToSpecial(s, keepForRequests(s, s.special.item));
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
    if (
      st &&
      ['crop', 'preserve', 'material', 'forage', 'product', 'fish'].includes(items[st.item]!.type)
    )
      kinds.set(keyOf(st), refOf(st));
  const keep = opts.keepForBoard ? boardWants(s) : new Map<string, number>();
  for (const ref of [...kinds.values()].sort((a, b) => (a.q ?? 0) - (b.q ?? 0))) {
    const kind = `${ref.item}|${ref.of ?? ''}`;
    const have = countStack(s, ref);
    const hold = Math.min(have, keep.get(kind) ?? 0);
    keep.set(kind, (keep.get(kind) ?? 0) - hold);
    if (have - hold > 0) shipStack(s, ref, have - hold);
  }
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
    ledger.eggs += collect(s, coop);
    if (countItem(s, 'chicken_feed') < 3) buyItem(s, STORE, 'chicken_feed', 9);
    feed(s, coop);
  }
  // 6b. a board-minded farmer looks at the board again with the eggs in hand (before the rival's hour)
  if (opts.keepForBoard)
    for (const o of s.orders.list)
      if (!o.done && haveFor(s, o) >= o.qty) {
        const before = s.money;
        if (deliverOrder(s, o.id) === 'ok') ledger.orders += s.money - before;
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
  if (opts.fish && s.energy < 40) return void fishEvening(s);
  // Calibrated against play (round 4, critique 11 F1): the starting seeds go in first, and while gold cannot
  // fill the free tiles with the best crop per tile, the bot buys what pays back fastest per gold (parsnips
  // in early spring), as a person does. Before, it bought six cauliflower seeds on day 1 and kept its
  // parsnips: no income until day 11, 1.5k earned by day 14 where a played farmer had 3.6k.
  const free = FIELD.filter(([x, y]) => !getSoil(s, x, y)?.crop).length;
  const scored = stockFor(STORE, s.time.season, s)
    .filter((id) => items[id]?.type === 'seed')
    .map((id) => ({ id, sc: score(s, id), roi: score(s, id) / items[id]!.buyPrice! }))
    .filter((e) => e.sc > 0);
  let best = [...scored].sort((a, b) => b.sc - a.sc)[0];
  if (best && s.money < free * items[best.id]!.buyPrice!)
    best = [...scored].sort((a, b) => b.roi - a.roi)[0];
  const inBag = s.inventory.slots
    .filter(
      (st): st is NonNullable<typeof st> =>
        !!st && items[st.item]?.type === 'seed' && score(s, st.item) > -1,
    )
    .map((st) => st.item);
  if (!best && inBag.length === 0) return;
  for (const [x, y] of FIELD) {
    if (s.energy < 3) break;
    const soil = getSoil(s, x, y);
    if (soil?.crop) continue;
    let seed = inBag.find((id) => countItem(s, id) > 0);
    if (!seed) {
      if (!best) break;
      if (
        countItem(s, best.id) === 0 &&
        buyItem(
          s,
          STORE,
          best.id,
          Math.min(20, Math.floor(s.money / items[best.id]!.buyPrice!)),
        ) !== 'ok' &&
        buyItem(s, STORE, best.id, 1) !== 'ok'
      )
        break;
      seed = best.id;
    }
    if (!soil) {
      equipItem(s, 'hoe');
      if (!act(s, tile(s, x, y)).ok) continue;
    }
    equipItem(s, seed);
    if (!act(s, tile(s, x, y)).ok) continue;
    refill();
    equipItem(s, 'watering_can');
    act(s, tile(s, x, y));
  }
  // 9. a fisher casts at the pond with the energy left (keeping 20 back), like a player's evening
  if (opts.fish) fishEvening(s);
}

/**
 * The bot's median full year over five seeds when the band was last set. Depth round 4: the bot plants its
 * starting seeds and, while gold is short, the seed that pays back fastest per gold (it had bought six
 * cauliflower seeds on day 1 and earned nothing until day 11): calibrated against a played farmer (3.6k
 * earned by day 14; the bot now 3.3k, was 1.5k). Seeds 238,200 / 263,596 / 261,631 / 272,894 / 226,522
 * (round 3: 175k to 252k, median 213,730). Year one was very sensitive to early gold (critique 10, F7);
 * with the calibrated start it is far less so (see 'balance: the first week'). A balance change that moves
 * the median by a fifth down or a quarter up fails the five-seed test and needs a DECISIONS.md note.
 */
const SIM_EARNED = 261_631;

describe('balance simulation (decent player, full year)', () => {
  it('a competent farmer earns a satisfying amount from crops, orders and jars, without a runaway', () => {
    const s = createInitialState();
    s.rng = 42;
    const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
    const log: string[] = [];
    for (let day = 1; day <= 112; day++) {
      playDay(s, ledger);
      endDay(s, { passedOut: false, weedCandidates: [] });
      ledger.shipped += s.lastSummary?.total ?? 0;
      if (day % 14 === 0)
        log.push(
          `day ${day} (${s.time.season} ${s.time.day}): gold ${s.money}, earned ${s.stats['earned'] ?? 0}, ` +
            `shipped ${ledger.shipped}, orders ${ledger.orders}, jars ${ledger.jarsLoaded}, ` +
            `plots ${s.plots.length}, energy ${maxEnergy(s)}, eggs ${ledger.eggs}, ` +
            `goal ${goalProgress(s)?.goal.id ?? 'done'}`,
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
      const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
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
      const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
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
        const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
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
    let jobsGold = 0;
    for (let day = 2; day <= 14; day++) jobsGold += JOBS_PER_DAY * mean * welcomeFactor(day);
    console.log(`farm by day 14 (median): ${farm}; jobs days 2-14: ${Math.round(jobsGold)}`);
    expect(jobsGold).toBeLessThan(farm * 0.75);
    // ...but still worth doing: a day of jobs buys a row of seeds.
    expect(JOBS_PER_DAY * mean).toBeGreaterThan(60);
  });
});

/**
 * The first week (owner, round 4): the human-paced bot, doing its jobs. Nothing ripens before day 5, so the
 * settling-in pay on days 3 and 4 is the only income then; it must stay small, and early gold must not swing
 * the year (the round-3 "+18% to +76% for 500g on day 7" came from a bot that kept its starting seeds and
 * waited for cauliflower: no income until day 11).
 */
describe('balance: the first week', () => {
  const run = (seed: number, opts: { welcome: boolean; lump?: number }) => {
    const saved = game.welcomeJobs;
    if (!opts.welcome) game.welcomeJobs = undefined;
    try {
      const s = createInitialState();
      s.rng = seed;
      const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
      const earned: number[] = [0];
      let firstPlot = 0;
      for (let day = 1; day <= 112; day++) {
        if (day === 7) s.money += opts.lump ?? 0;
        playDay(s, ledger, 150, { jobs: true });
        endDay(s, { passedOut: false, weedCandidates: [] });
        earned.push(s.stats['earned'] ?? 0);
        if (!firstPlot && s.plots.length > 1) firstPlot = day;
      }
      return { earned, firstPlot };
    } finally {
      game.welcomeJobs = saved;
    }
  };
  it('days 3 and 4 earn a little, the week earns more, and a 500g lump on day 7 barely moves the year', () => {
    const log: string[] = [];
    const lifts: number[] = [];
    for (const seed of [42, 7, 99, 1234, 2026]) {
      const before = run(seed, { welcome: false });
      const after = run(seed, { welcome: true });
      const lump = run(seed, { welcome: true, lump: 500 });
      const days34 = (r: typeof after) => r.earned[4]! - r.earned[2]!;
      const lift = lump.earned[112]! / after.earned[112]! - 1;
      lifts.push(lift);
      log.push(
        `seed ${seed}: days 3-4 ${days34(before)} -> ${days34(after)}, day 7 ${before.earned[7]} -> ${after.earned[7]}, ` +
          `day 14 ${before.earned[14]} -> ${after.earned[14]}, first plot day ${before.firstPlot} -> ${after.firstPlot}, ` +
          `year ${before.earned[112]} -> ${after.earned[112]} (+500g on day 7: ${(lift * 100).toFixed(0)}%)`,
      );
      expect(days34(after)).toBeGreaterThan(days34(before));
      expect(days34(after) - days34(before)).toBeLessThan(400); // a nudge, not a living
      expect(after.earned[4]!).toBeLessThan(after.earned[7]! / 2); // the harvest still makes the week
    }
    console.log(log.join(String.fromCharCode(10)));
    const median = [...lifts].sort((a, b) => a - b)[2]!;
    console.log(`+500g on day 7, median lift ${(median * 100).toFixed(1)}%`);
    expect(Math.abs(median)).toBeLessThan(0.15);
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
    const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
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
    // board projects only: a place's fund is opened from its site and counts at the opening (systems/valley.ts)
    expect(s.stats['projectsDone']).toBe(
      Object.values(projects).filter((p) => !p.repeat && !p.place).length,
    );
  });
});

/**
 * The board race against Clay for a farmer who never fishes or forages (critique 9, F1): he scores only on
 * farm goods, so a farmer who keeps what the requests want wins most seasons, and one who ships everything
 * still wins some. Two years, three seeds, from spring of year one (Clay starts on day 8).
 */
describe('balance simulation: the board race for a pure farmer', () => {
  const run = (opts: { keepForBoard?: boolean; fish?: boolean }, seed: number) => {
    const s = createInitialState();
    s.rng = seed;
    const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
    let yearOne = 0;
    for (let day = 1; day <= 224; day++) {
      playDay(s, ledger, Infinity, opts);
      endDay(s, { passedOut: false, weedCandidates: [] });
      if (day === 112) yearOne = s.stats['earned'] ?? 0;
    }
    const out: { you: number; rival: number }[] = [];
    for (let i = 0; i < 8; i++)
      out.push({ you: s.stats[`board.s${i}.you`] ?? 0, rival: s.stats[`board.s${i}.rival`] ?? 0 });
    return { out, wins: s.stats['boardWins'] ?? 0, yearOne, caught: s.stats['caught'] ?? 0 };
  };
  const line = (r: ReturnType<typeof run>) => r.out.map((t) => `${t.you}-${t.rival}`).join(' ');
  it('a farmer who keeps goods for the board wins most seasons; shipping everything wins fewer', () => {
    const log: string[] = [];
    let keepWins = 0;
    let shipWins = 0;
    for (const seed of [42, 7, 99]) {
      const keep = run({ keepForBoard: true }, seed);
      const ship = run({}, seed);
      keepWins += keep.wins;
      shipWins += ship.wins;
      log.push(`seed ${seed}: keep ${line(keep)} | ship ${line(ship)}`);
    }
    console.log(log.join(String.fromCharCode(10)));
    // Of 24 seasons. Critique 9: 0 of 72. Round 3 first fix: keep 23, ship 13 (a formality, critique 10 F2).
    // Now Clay takes farm rows first and ships crates (weekly, every 3rd day while you lead by 4): keep 19, ship 1.
    // Round 4, with the calibrated start (more spring crop rows filled, as in play): keep 21, ship 4; then
    // crates counted from the last one and daily while you lead by 5 (critique 12, F1): keep 20 (margins of 1
    // to 6, mostly 2 to 4), ship 3.
    expect(keepWins).toBeGreaterThanOrEqual(12);
    expect(keepWins).toBeLessThanOrEqual(22); // a race, not a walkover
    expect(shipWins).toBeLessThan(keepWins / 2); // keeping goods for the board is what wins it
  });

  it('fishing in the evening adds board points and some gold, never a runaway (sim fidelity, round 3)', () => {
    const log: string[] = [];
    for (const seed of [42, 7, 99]) {
      const farmer = run({ keepForBoard: true }, seed);
      const fisher = run({ keepForBoard: true, fish: true }, seed);
      log.push(
        `seed ${seed}: farmer y1 ${farmer.yearOne} ${line(farmer)} | fisher y1 ${fisher.yearOne} caught ${fisher.caught} ${line(fisher)}`,
      );
      const you = (r: ReturnType<typeof run>) => r.out.reduce((n, t) => n + t.you, 0);
      expect(fisher.caught).toBeGreaterThan(100);
      expect(you(fisher)).toBeGreaterThan(you(farmer) * 0.8); // fishing costs no board points
      // A few fish an evening are only about 2k by day 14, but early gold compounds: seeds, then land on day 28
      // instead of later (round 3: 379k to 407k for the year against a 250k median). So sensitive is year one to
      // early gold (critique 10, F7: one 300g board prize moved a seed by 60k) that the bound is against the
      // pinned median, not one farmer.
      expect(fisher.yearOne).toBeLessThan(SIM_EARNED * 2);
    }
    console.log(log.join(String.fromCharCode(10)));
  });
});

/**
 * Once all the land is bought, give gold (keeping a 30,000g float for a field of seeds) and the goods to the first open
 * project. Returns the gold given.
 */
function fundProjects(s: GameState): number {
  if (Object.entries(plots).some(([id, p]) => !p.project && !ownsPlot(s, id))) return 0;
  let given = 0;
  // A farmer this far along has restored the Old Spring (300g and three days): its site upgrade (the warm pool)
  // is funded like a board project. Restoring places on schedule is the second sim run's job (WORLD-PLAN 9.2).
  s.stats['place.spring'] = Math.max(3, s.stats['place.spring'] ?? 0);
  // and the Weir (2,500g, four days): its site upgrade is the Fish Ladder, which the Fair Hall follows
  s.stats['place.weir'] = Math.max(3, s.stats['place.weir'] ?? 0);
  const ids = [
    ...visibleProjects(s),
    ...Object.keys(projects).filter((id) => projects[id]?.site && isProjectOpen(s, id)),
  ];
  for (const id of ids) {
    if (!isProjectOpen(s, id)) continue; // a repeatable one (the statue) stays open
    for (const n of itemNeeds(s, id)) if (n.given < n.need) addItem(s, n.item, n.need - n.given);
    donateItems(s, id);
    const res = donateGold(s, id, s.money - 30000);
    if (res.ok) given += res.given;
    break;
  }
  return given;
}
