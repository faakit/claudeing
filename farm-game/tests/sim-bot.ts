// The balance bot shared by the sim tests (tests/sim*.test.ts): a tireless greedy farmer that plays whole days
// through the real rules. The sims are split over several files so vitest runs them side by side (one file of
// eight year-long sims was 24 s on its own, longer than the rest of the unit tests together).
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
export interface Ledger {
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
export function playDay(
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
export const SIM_EARNED = 261_631;

/**
 * Once all the land is bought, give gold (keeping a 30,000g float for a field of seeds) and the goods to the first open
 * project. Returns the gold given.
 */
export function fundProjects(s: GameState): number {
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

export {
  createInitialState,
  endDay,
  game,
  goalProgress,
  jobDefs,
  JOBS_PER_DAY,
  jobReward,
  maxEnergy,
  projectLevel,
  projects,
  welcomeFactor,
};

/** Two years from spring of year one with `opts` (the board race against Clay, critique 9 F1), on one seed. */
export const boardRun = (opts: { keepForBoard?: boolean; fish?: boolean }, seed: number) => {
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
export const boardLine = (r: ReturnType<typeof boardRun>) =>
  r.out.map((t) => `${t.you}-${t.rival}`).join(' ');
