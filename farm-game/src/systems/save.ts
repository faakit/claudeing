import {
  crops,
  game,
  goals,
  items,
  mapsData,
  nodes,
  npcs,
  placeables,
  plots,
  shops,
  skills,
} from '../data';
import { plotAtTile, starterPlots } from './plots';
import { maxEnergy as maxEnergyOf } from './energy';
import { isDirection } from './direction';
import { keyOf, parseKey } from './itemRef';
import type { SaveStore } from '../platform/SaveStore';
import { createInitialState, STATE_VERSION, type GameState } from '../state/GameState';

export const SAVE_KEY = 'farm.save';
export const BACKUP_KEY = 'farm.save.bak';

const SEASON_IDS = ['spring', 'summer', 'fall', 'winter'];

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

/** v1 (M1) kept day/season/money at the top level and had no farm, inventory or energy. */
function migrateV1(raw: Raw): Raw {
  const fresh = createInitialState() as unknown as Raw;
  const player = isObj(raw['player']) ? (raw['player'] as Raw) : null;
  const mapOk = player && typeof player['map'] === 'string' && mapsData.maps[player['map']];
  const time = { ...(fresh['time'] as Raw) };
  if (typeof raw['day'] === 'number') time['day'] = raw['day'];
  if (typeof raw['season'] === 'string') time['season'] = raw['season'];
  return {
    ...fresh,
    version: STATE_VERSION,
    time,
    money: typeof raw['money'] === 'number' ? raw['money'] : fresh['money'],
    player: mapOk ? player : fresh['player'],
  };
}

/**
 * v2 -> v3: a fourth tool (the fishing rod) now owns inventory slot 3, so everything that sat in
 * slot 3 and after shifts down one (trimming a spare empty slot), and the new mechanics' state is added.
 */
function migrateV2(raw: Raw): Raw {
  const inv = isObj(raw['inventory']) ? raw['inventory'] : {};
  const old = Array.isArray(inv['slots']) ? [...(inv['slots'] as unknown[])] : [];
  const oldTools = 3;
  const slots: unknown[] = [
    ...old.slice(0, oldTools),
    { item: 'fishing_rod', qty: 1 },
    ...old.slice(oldTools),
  ];
  while (slots.length > game.inventorySlots) {
    const spare = slots.lastIndexOf(null);
    slots.splice(spare > oldTools ? spare : slots.length - 1, 1);
  }
  const selected = typeof inv['selected'] === 'number' ? inv['selected'] : 0;
  return {
    ...raw,
    version: 3,
    inventory: { ...inv, slots, selected: selected >= oldTools ? selected + 1 : selected },
    placed: {},
    nextPlacedId: 1,
    skills: {},
    forage: {},
    orders: { day: 0, list: [] },
  };
}

/** v3 -> v4: villagers. Animals need no migration: their state lives in placed objects' data. */
function migrateV3(raw: Raw): Raw {
  return { ...raw, version: 4, friends: {} };
}

/**
 * v6 -> v7: the pickaxe becomes the fifth tool, so everything that sat in slot 4 and after shifts down one
 * (trimming a spare empty slot), exactly like the fishing rod did in v3. Mines start empty.
 */
function migrateV6(raw: Raw): Raw {
  const inv = isObj(raw['inventory']) ? raw['inventory'] : {};
  const old = Array.isArray(inv['slots']) ? [...(inv['slots'] as unknown[])] : [];
  const oldTools = 4;
  const slots: unknown[] = [
    ...old.slice(0, oldTools),
    { item: 'pickaxe', qty: 1 },
    ...old.slice(oldTools),
  ];
  while (slots.length > game.inventorySlots) {
    const spare = slots.lastIndexOf(null);
    slots.splice(spare > oldTools ? spare : slots.length - 1, 1);
  }
  const selected = typeof inv['selected'] === 'number' ? inv['selected'] : 0;
  return {
    ...raw,
    version: 7,
    inventory: { ...inv, slots, selected: selected >= oldTools ? selected + 1 : selected },
    nodes: {},
  };
}

/** v5 -> v6: tomorrow's forecast. Old saves simply get a calm forecast. */
function migrateV5(raw: Raw): Raw {
  return { ...raw, version: 6, forecast: 'sunny' };
}

const toWeather = (v: unknown): GameState['weather'] =>
  v === 'rain' || v === 'storm' ? v : 'sunny';

/**
 * v4 -> v5: land plots. Anyone who already farmed outside the starter plot keeps every plot they used
 * (tilled soil or placed objects), so nothing they built becomes unreachable.
 */
function migrateV4(raw: Raw): Raw {
  const obj = (v: unknown): Raw => (isObj(v) ? v : {});
  const owned = new Set<string>(starterPlots());
  const farm = obj(raw['farm']);
  for (const key of Object.keys(obj(farm['tiles']))) {
    const [tx, ty] = key.split(',').map(Number);
    const id = plotAtTile(tx ?? -1, ty ?? -1);
    if (id) owned.add(id);
  }
  for (const o of (obj(raw['placed'])['farm'] as unknown[]) ?? []) {
    if (!isObj(o)) continue;
    const id = plotAtTile(Number(o['tx']), Number(o['ty']));
    if (id) owned.add(id);
  }
  const up = obj(raw['upgrades']);
  return { ...raw, version: 5, plots: [...owned], upgrades: { ...up, hoe: 0, rod: 0 } };
}

/**
 * The goal chain is a list and the save keeps an index into it, so a release that inserts goals must
 * keep that index on the same goal. `oldIds` is the chain as the older release had it, `ids` the chain
 * of the version being migrated to (the current goals for the last step). Goals inserted
 * before the player's current one are skipped (they are easy early goals a veteran has outgrown);
 * a player who had finished every goal continues with the first goal added after the old last one.
 */
export function remapGoalIndex(
  raw: Raw,
  oldIds: readonly string[],
  ids: readonly string[] = goals.map((g) => g.id),
): Raw {
  const at = typeof raw['goalIndex'] === 'number' ? Math.max(0, Math.floor(raw['goalIndex'])) : 0;
  const current = oldIds[at];
  let next = current === undefined ? -1 : ids.indexOf(current);
  if (next < 0) {
    const last = oldIds[oldIds.length - 1];
    next = last === undefined ? 0 : ids.indexOf(last) + 1;
  }
  return { ...raw, goalIndex: Math.max(0, next) };
}

/** Goal ids of releases up to save version 7. */
const GOALS_V7 = [
  'till',
  'plant',
  'water',
  'sleep',
  'forage',
  'buy',
  'harvest',
  'ship',
  'fish',
  'order',
  'craft',
  'place',
  'preserve',
  'quality',
  'talk',
  'chicken',
  'eggs',
  'tree',
  'friend',
  'earn1k',
  'upgrade',
  'earn5k',
  'land',
  'jars',
  'fish20',
  'orders10',
  'heart5',
  'event',
  'craft10',
  'mine10',
  'smelt',
  'toolbar',
  'festival',
  'book3',
  'collect50',
  'earn20k',
  'earn50k',
  'earn100k',
  'collect200',
] as const;

/** v7 -> v8: town projects added goals to the chain (their progress lives in stats, no new state). */
function migrateV7(raw: Raw): Raw {
  return { ...remapGoalIndex(raw, GOALS_V7, GOALS_V8), version: 8 };
}

/** Goal ids of the save-version-8 release (town projects). */
// prettier-ignore
const GOALS_V8 = [
  'till', 'plant', 'water', 'sleep', 'forage', 'buy', 'harvest', 'ship', 'fish', 'order', 'craft',
  'place', 'preserve', 'quality', 'talk', 'chicken', 'eggs', 'tree', 'friend', 'earn1k', 'upgrade',
  'earn5k', 'land', 'project1', 'jars', 'fish20', 'orders10', 'heart5', 'event', 'craft10', 'mine10',
  'smelt', 'toolbar', 'festival', 'book3', 'collect50', 'earn20k', 'project3', 'earn50k', 'earn100k',
  'collect200', 'projectAll',
] as const;

/** v8 -> v9: the Bigger Bag upgrade (a level of 0 keeps the old slot count) and two home goals. */
function migrateV8(raw: Raw): Raw {
  const up = isObj(raw['upgrades']) ? raw['upgrades'] : {};
  return {
    ...remapGoalIndex(raw, GOALS_V8, GOALS_V9),
    version: 9,
    upgrades: { ...up, bag: 0 },
  };
}

/** Goal ids of the save-version-9 release (home upgrades). */
// prettier-ignore
const GOALS_V9 = [
  'till', 'plant', 'water', 'sleep', 'forage', 'buy', 'harvest', 'ship', 'fish', 'order', 'craft', 'place', 'preserve', 'quality', 'talk', 'chicken', 'eggs', 'tree', 'friend', 'earn1k', 'upgrade', 'bag', 'earn5k', 'land', 'project1', 'decor10', 'jars', 'fish20', 'orders10', 'heart5', 'event', 'craft10', 'mine10', 'smelt', 'toolbar', 'festival', 'book3', 'collect50', 'earn20k', 'project3', 'earn50k', 'earn100k', 'collect200', 'projectAll',
] as const;

/** v9 -> v10: daily jobs (posted from the next morning on) and two job goals. */
function migrateV9(raw: Raw): Raw {
  return {
    ...remapGoalIndex(raw, GOALS_V9, GOALS_V12.slice(0, -2)),
    version: 10,
    jobs: { day: 0, list: [] },
  };
}

/** v10 -> v11: the mailbox starts empty; letters whose time has passed arrive the next morning. */
function migrateV10(raw: Raw): Raw {
  return { ...raw, version: 11, mail: { next: 1, list: [] } };
}

/** v11 -> v12: orders may say the rival farmer took them (an optional flag; nothing to convert). */
function migrateV11(raw: Raw): Raw {
  return { ...raw, version: 12 };
}

/** Goal ids of the save-version-10 to 12 releases (jobs, mail, rival, greenhouse, pigs). */
// prettier-ignore
const GOALS_V12 = [
  'till', 'plant', 'water', 'sleep', 'forage', 'buy', 'job1', 'harvest', 'ship', 'fish', 'order', 'craft', 'place', 'preserve', 'quality', 'talk', 'chicken', 'eggs', 'tree', 'friend', 'earn1k', 'upgrade', 'bag', 'earn5k', 'land', 'project1', 'decor10', 'jars', 'fish20', 'jobs20', 'orders10', 'heart5', 'event', 'craft10', 'mine10', 'smelt', 'toolbar', 'festival', 'book3', 'collect50', 'earn20k', 'project3', 'earn50k', 'earn100k', 'collect200', 'projectAll', 'greenhouse20', 'truffles10',
] as const;

/** v12 -> v13: the order goal moved after the jar goals; keep each save on the goal it was on. */
function migrateV12(raw: Raw): Raw {
  return { ...remapGoalIndex(raw, GOALS_V12), version: 13 };
}

/** v13 -> v14: buildings can be moved with their contents (nothing is being moved in an old save). */
function migrateV13(raw: Raw): Raw {
  return { ...raw, version: 14, stored: {} };
}

const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  1: migrateV1,
  2: migrateV2,
  3: migrateV3,
  4: migrateV4,
  5: migrateV5,
  6: migrateV6,
  7: migrateV7,
  8: migrateV8,
  9: migrateV9,
  10: migrateV10,
  11: migrateV11,
  12: migrateV12,
  13: migrateV13,
};

/** Bring any saved shape up to the current version, then validate it. */
export function migrate(input: unknown): GameState {
  if (!isObj(input) || typeof input['version'] !== 'number') throw new Error('Save has no version');
  let raw: Raw = input;
  let v = raw['version'] as number;
  if (v > STATE_VERSION) throw new Error(`Save is from a newer version (${v})`);
  while (v < STATE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No migration from save version ${v}`);
    raw = step(raw);
    v = raw['version'] as number;
  }
  return validateState(raw);
}

/** Core structure must be present; anything recoverable is repaired by `sanitize`. */
function validateState(raw: Raw): GameState {
  const bad = (what: string): never => {
    throw new Error(`Invalid save: ${what}`);
  };
  const time = raw['time'];
  if (!isObj(time) || !SEASON_IDS.includes(time['season'] as string)) bad('time');
  if (!isFiniteNum((time as Raw)['day']) || !isFiniteNum((time as Raw)['minutes']))
    bad('time values');
  if (!isFiniteNum(raw['money']) || (raw['money'] as number) < 0) bad('money');
  const inv = raw['inventory'];
  if (!isObj(inv) || !Array.isArray(inv['slots'])) bad('inventory');
  if (!isObj(raw['farm']) || !isObj((raw['farm'] as Raw)['tiles'])) bad('farm');
  const p = raw['player'];
  if (!isObj(p) || typeof p['map'] !== 'string' || !mapsData.maps[p['map']]) bad('player map');
  return sanitize(raw);
}

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const int = (v: unknown, fallback: number, lo: number, hi: number): number =>
  isFiniteNum(v) ? clamp(Math.round(v), lo, hi) : fallback;
const TILE_KEY = /^\d{1,3},\d{1,3}$/;

/**
 * Rebuild a complete, internally consistent state from whatever was saved. Missing nested
 * fields get defaults, unknown items/crops (e.g. content renamed in an update) are dropped,
 * and numbers are clamped, so one bad field can never crash the game later.
 */
export function sanitize(raw: Raw): GameState {
  const fresh = createInitialState();
  const obj = (v: unknown): Raw => (isObj(v) ? v : {});

  const t = obj(raw['time']);
  const time: GameState['time'] = {
    year: int(t['year'], fresh.time.year, 1, 9999),
    season: t['season'] as GameState['time']['season'],
    day: int(t['day'], 1, 1, game.seasonLength),
    minutes: int(t['minutes'], game.dayStartMinutes, game.dayStartMinutes, game.dayEndMinutes),
    acc: isFiniteNum(t['acc']) ? Math.max(0, t['acc']) : 0,
  };

  const u = obj(raw['upgrades']);
  const staminaMax =
    shops['town_general_store']?.upgrades.find((x) => x.id === 'stamina')?.levels.length ?? 0;
  const upgradeMax = (id: string): number =>
    shops['town_general_store']?.upgrades.find((x) => x.id === id)?.levels.length ?? 0;
  const upgrades = {
    can: int(u['can'], 0, 0, game.canCapacity.length - 1),
    stamina: int(u['stamina'], 0, 0, staminaMax),
    hoe: int(u['hoe'], 0, 0, upgradeMax('hoe')),
    rod: int(u['rod'], 0, 0, upgradeMax('rod')),
    bag: int(u['bag'], 0, 0, upgradeMax('bag')),
  };
  const bagSlots = game.inventorySlots + upgrades.bag * game.bagSlotsPerLevel;
  const canCap = game.canCapacity[upgrades.can] ?? 20;

  // Inventory: fixed length, valid stacks only, tools always in their fixed slots.
  const rawSlots = (obj(raw['inventory'])['slots'] as unknown[]) ?? [];
  const toolIds = Object.entries(items)
    .filter(([, it]) => it.type === 'tool')
    .map(([id]) => id);
  const slots: GameState['inventory']['slots'] = Array.from({ length: bagSlots }, (_, i) => {
    if (i < toolIds.length) return { item: toolIds[i] as string, qty: 1 };
    const st = rawSlots[i];
    if (!isObj(st) || typeof st['item'] !== 'string') return null;
    const def = items[st['item']];
    if (!def || def.type === 'tool') return null;
    const stack: NonNullable<GameState['inventory']['slots'][number]> = {
      item: st['item'],
      qty: int(st['qty'], 1, 1, def.stackLimit ?? game.stackLimit),
    };
    const q = int(st['q'], 0, 0, game.qualityMultipliers.length - 1);
    if (q > 0) stack.q = q;
    if (def.derived && typeof st['of'] === 'string' && items[st['of']]) stack.of = st['of'];
    return stack;
  });

  const farmRaw = obj(raw['farm']);
  const tiles: GameState['farm']['tiles'] = {};
  for (const [key, soil] of Object.entries(obj(farmRaw['tiles']))) {
    if (!TILE_KEY.test(key) || !isObj(soil)) continue;
    let crop: GameState['farm']['tiles'][string]['crop'] = null;
    const c = soil['crop'];
    if (isObj(c) && typeof c['cropId'] === 'string' && crops[c['cropId']]) {
      const days = (crops[c['cropId']] as (typeof crops)[string]).stageDays.length;
      crop = {
        cropId: c['cropId'],
        stage: int(c['stage'], 0, 0, days),
        daysInStage: int(c['daysInStage'], 0, 0, 99),
        regrow: c['regrow'] === true,
      };
    }
    const fert =
      typeof soil['fert'] === 'string' && items[soil['fert']]?.type === 'fertilizer'
        ? soil['fert']
        : undefined;
    tiles[key] = { watered: soil['watered'] === true, crop, ...(fert ? { fert } : {}) };
  }
  const weeds: GameState['farm']['weeds'] = {};
  for (const key of Object.keys(obj(farmRaw['weeds']))) if (TILE_KEY.test(key)) weeds[key] = true;

  const shipping: GameState['shipping'] = {};
  for (const [key, qty] of Object.entries(obj(raw['shipping']))) {
    // Keys are stack identities ("tomato|2|"); a bare legacy item id ("parsnip") upgrades to "parsnip|0|".
    const ref = parseKey(key.includes('|') ? key : `${key}|0|`);
    if (items[ref.item] && items[ref.item]?.type !== 'tool' && isFiniteNum(qty) && qty > 0) {
      const k = keyOf(ref);
      shipping[k] = (shipping[k] ?? 0) + Math.floor(qty);
    }
  }

  const p = obj(raw['player']);
  const mapId = p['map'] as string;
  const player: GameState['player'] = {
    map: mapId,
    x: isFiniteNum(p['x']) ? p['x'] : fresh.player.x,
    y: isFiniteNum(p['y']) ? p['y'] : fresh.player.y,
    facing: isDirection(p['facing']) ? p['facing'] : 'down',
  };

  const stats: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(raw['stats'])))
    if (isFiniteNum(v) && v >= 0) stats[k] = v;

  const st = obj(raw['settings']);
  const settings = {
    music: isFiniteNum(st['music']) ? clamp(st['music'], 0, 1) : fresh.settings.music,
    sfx: isFiniteNum(st['sfx']) ? clamp(st['sfx'], 0, 1) : fresh.settings.sfx,
    muted: st['muted'] === true,
    vibrate: st['vibrate'] !== false, // default on, including for saves that predate the setting
    leftHanded: st['leftHanded'] === true,
    reduceMotion: st['reduceMotion'] === true,
  };

  // Placed objects: known types, real tiles, unique ids.
  const placed: GameState['placed'] = {};
  const usedIds = new Set<number>();
  let maxId = 0;
  for (const [mapId, list] of Object.entries(obj(raw['placed']))) {
    if (!mapsData.maps[mapId] || !Array.isArray(list)) continue;
    const out: GameState['placed'][string] = [];
    for (const o of list) {
      if (!isObj(o) || typeof o['type'] !== 'string' || !placeables[o['type']]) continue;
      const tx = int(o['tx'], -1, -1, 999);
      const ty = int(o['ty'], -1, -1, 999);
      let id = int(o['id'], 0, 0, 1e9);
      if (tx < 0 || ty < 0) continue;
      if (id === 0 || usedIds.has(id)) id = maxId + 1;
      usedIds.add(id);
      maxId = Math.max(maxId, id);
      out.push({ id, type: o['type'], tx, ty, data: isObj(o['data']) ? { ...o['data'] } : {} });
    }
    if (out.length) placed[mapId] = out;
  }

  // Parked state of buildings being moved: only for known placeables, never more than you carry.
  const stored: GameState['stored'] = {};
  for (const [type, list] of Object.entries(obj(raw['stored']))) {
    if (!placeables[type] || !Array.isArray(list)) continue;
    const carried = slots.reduce((n, st) => (st?.item === type ? n + st.qty : n), 0);
    const keep = list
      .filter(isObj)
      .slice(0, carried)
      .map((d) => ({ ...d }));
    if (keep.length) stored[type] = keep;
  }

  const skillXp: Record<string, number> = {};
  for (const [id, xp] of Object.entries(obj(raw['skills']))) {
    if (skills[id] && isFiniteNum(xp) && xp >= 0) skillXp[id] = Math.floor(xp);
  }

  const forageOut: GameState['forage'] = {};
  for (const [mapId, tilesRaw] of Object.entries(obj(raw['forage']))) {
    if (!mapsData.maps[mapId]) continue;
    const out: Record<string, string> = {};
    for (const [key, item] of Object.entries(obj(tilesRaw))) {
      if (TILE_KEY.test(key) && typeof item === 'string' && items[item]?.type === 'forage')
        out[key] = item;
    }
    if (Object.keys(out).length) forageOut[mapId] = out;
  }

  const nodesOut: GameState['nodes'] = {};
  for (const [mapId, tilesRaw] of Object.entries(obj(raw['nodes']))) {
    if (!mapsData.maps[mapId]) continue;
    const out: Record<string, string> = {};
    for (const [key, id] of Object.entries(obj(tilesRaw))) {
      if (TILE_KEY.test(key) && typeof id === 'string' && nodes[id]) out[key] = id;
    }
    if (Object.keys(out).length) nodesOut[mapId] = out;
  }

  const ordersRaw = obj(raw['orders']);
  const orderList: GameState['orders']['list'] = [];
  if (Array.isArray(ordersRaw['list'])) {
    for (const o of ordersRaw['list'].slice(0, 6)) {
      if (!isObj(o) || typeof o['item'] !== 'string') continue;
      const ref = parseKey(o['item']);
      if (!items[ref.item] || items[ref.item]?.type === 'tool') continue;
      orderList.push({
        id: int(o['id'], orderList.length + 1, 0, 1e9),
        item: keyOf(ref),
        qty: int(o['qty'], 1, 1, 999),
        reward: int(o['reward'], 0, 0, 1e7),
        xp: int(o['xp'], 0, 0, 1e5),
        done: o['done'] === true,
        ...(o['rival'] === true ? { rival: true } : {}),
      });
    }
  }

  const friends: GameState['friends'] = {};
  for (const [id, f] of Object.entries(obj(raw['friends']))) {
    if (!npcs[id] || !isObj(f)) continue;
    friends[id] = {
      points: int(f['points'], 0, 0, 250),
      talkedDay: int(f['talkedDay'], 0, 0, 1e7),
      giftedDay: int(f['giftedDay'], 0, 0, 1e7),
    };
  }

  const jobsRaw = obj(raw['jobs']);
  const jobList: GameState['jobs']['list'] = [];
  if (Array.isArray(jobsRaw['list']))
    for (const j of jobsRaw['list'].slice(0, 6)) {
      if (!isObj(j) || typeof j['id'] !== 'string' || typeof j['stat'] !== 'string') continue;
      if (typeof j['giver'] !== 'string' || !npcs[j['giver']]) continue;
      jobList.push({
        id: j['id'],
        giver: j['giver'],
        stat: j['stat'],
        base: int(j['base'], 0, 0, 1e9),
        n: int(j['n'], 1, 1, 999),
        reward: int(j['reward'], 0, 0, 1e5),
        done: j['done'] === true,
      });
    }

  const mailRaw = obj(raw['mail']);
  const letters: GameState['mail']['list'] = [];
  let maxLetter = 0;
  if (Array.isArray(mailRaw['list']))
    for (const l of mailRaw['list'].slice(-40)) {
      if (!isObj(l) || typeof l['title'] !== 'string' || typeof l['text'] !== 'string') continue;
      if (typeof l['from'] !== 'string' || !npcs[l['from']]) continue;
      const id = int(l['id'], 0, 0, 1e9);
      if (id === 0 || letters.some((x) => x.id === id)) continue;
      maxLetter = Math.max(maxLetter, id);
      const g = isObj(l['gift']) ? l['gift'] : null;
      const gift =
        g && typeof g['item'] === 'string' && items[g['item']]
          ? { item: g['item'], qty: int(g['qty'], 1, 1, 999) }
          : undefined;
      letters.push({
        id,
        from: l['from'],
        title: l['title'].slice(0, 80),
        text: l['text'].slice(0, 400),
        day: int(l['day'], 1, 1, 1e7),
        read: l['read'] === true,
        taken: l['taken'] === true,
        ...(gift ? { gift } : {}),
      });
    }

  const ownedPlots = Array.isArray(raw['plots'])
    ? [
        ...new Set(
          (raw['plots'] as unknown[]).filter(
            (p): p is string => typeof p === 'string' && p in plots,
          ),
        ),
      ]
    : [];
  for (const id of starterPlots()) if (!ownedPlots.includes(id)) ownedPlots.push(id);

  const out: GameState = {
    version: STATE_VERSION,
    time,
    money: Math.floor(raw['money'] as number),
    energy: 0, // set below, once perks can be read
    water: int(raw['water'], canCap, 0, canCap),
    upgrades,
    plots: ownedPlots,
    inventory: {
      slots,
      selected: int(obj(raw['inventory'])['selected'], 0, 0, game.hotbarSlots - 1),
    },
    farm: { tiles, weeds },
    shipping,
    player,
    stats,
    goalIndex: int(raw['goalIndex'], 0, 0, goals.length),
    settings,
    weather: toWeather(raw['weather']),
    forecast: toWeather(raw['forecast']),
    placed,
    stored,
    nextPlacedId: Math.max(int(raw['nextPlacedId'], 1, 1, 1e9), maxId + 1),
    skills: skillXp,
    forage: forageOut,
    nodes: nodesOut,
    orders: { day: int(ordersRaw['day'], 0, 0, 1e7), list: orderList },
    friends,
    jobs: { day: int(jobsRaw['day'], 0, 0, 1e7), list: jobList },
    mail: { next: Math.max(int(mailRaw['next'], 1, 1, 1e9), maxLetter + 1), list: letters },
    lastSummary: null, // transient: only meaningful right after a rollover
    rng: isFiniteNum(raw['rng']) ? raw['rng'] >>> 0 : fresh.rng,
  };
  // Energy is capped by everything that raises it (skills, hearts, town projects), which is only known
  // once the rest of the state is rebuilt. Clamping to the tonic level alone used to drop perks on load.
  const cap = maxEnergyOf(out);
  out.energy = int(raw['energy'], cap, 0, cap);
  return out;
}

export async function saveGame(store: SaveStore, state: GameState): Promise<void> {
  const previous = await store.read(SAVE_KEY);
  if (previous) {
    // Only promote a previous save to backup if it still loads, so a corrupt file can
    // never overwrite the last good one.
    try {
      migrate(JSON.parse(previous));
      await store.write(BACKUP_KEY, previous);
    } catch {
      /* keep the existing backup */
    }
  }
  await store.write(SAVE_KEY, JSON.stringify(state));
}

async function tryLoad(store: SaveStore, key: string): Promise<GameState | null> {
  const text = await store.read(key);
  if (!text) return null;
  try {
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Load the main save, falling back to the backup if it is missing or corrupt. */
/** True when the stored save was written by a newer version of the game than this one. */
export async function hasNewerSave(store: SaveStore): Promise<boolean> {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    const text = await store.read(key);
    if (!text) continue;
    try {
      const v = (JSON.parse(text) as { version?: unknown }).version;
      if (typeof v === 'number' && v > STATE_VERSION) return true;
    } catch {
      /* unreadable text is handled by loadGame */
    }
  }
  return false;
}

export async function loadGame(
  store: SaveStore,
): Promise<{ state: GameState; fromBackup: boolean } | null> {
  const main = await tryLoad(store, SAVE_KEY);
  if (main) return { state: main, fromBackup: false };
  const backup = await tryLoad(store, BACKUP_KEY);
  return backup ? { state: backup, fromBackup: true } : null;
}

export async function hasSave(store: SaveStore): Promise<boolean> {
  return (await loadGame(store)) !== null;
}
