import { crops, game, goals, items, mapsData, shops } from '../data';
import { isDirection } from './direction';
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
    version: 2,
    time,
    money: typeof raw['money'] === 'number' ? raw['money'] : fresh['money'],
    player: mapOk ? player : fresh['player'],
  };
}

const MIGRATIONS: Record<number, (raw: Raw) => Raw> = { 1: migrateV1 };

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
  const upgrades = {
    can: int(u['can'], 0, 0, game.canCapacity.length - 1),
    stamina: int(u['stamina'], 0, 0, staminaMax),
  };
  const maxEnergy = game.baseEnergy + upgrades.stamina * game.energyPerUpgrade;
  const canCap = game.canCapacity[upgrades.can] ?? 20;

  // Inventory: fixed length, valid stacks only, tools always in their fixed slots.
  const rawSlots = (obj(raw['inventory'])['slots'] as unknown[]) ?? [];
  const toolIds = Object.entries(items)
    .filter(([, it]) => it.type === 'tool')
    .map(([id]) => id);
  const slots: GameState['inventory']['slots'] = Array.from(
    { length: game.inventorySlots },
    (_, i) => {
      if (i < toolIds.length) return { item: toolIds[i] as string, qty: 1 };
      const st = rawSlots[i];
      if (!isObj(st) || typeof st['item'] !== 'string') return null;
      const def = items[st['item']];
      if (!def || def.type === 'tool') return null;
      return { item: st['item'], qty: int(st['qty'], 1, 1, def.stackLimit ?? game.stackLimit) };
    },
  );

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
    tiles[key] = { watered: soil['watered'] === true, crop };
  }
  const weeds: GameState['farm']['weeds'] = {};
  for (const key of Object.keys(obj(farmRaw['weeds']))) if (TILE_KEY.test(key)) weeds[key] = true;

  const shipping: GameState['shipping'] = {};
  for (const [id, qty] of Object.entries(obj(raw['shipping']))) {
    if (items[id] && items[id]?.type !== 'tool' && isFiniteNum(qty) && qty > 0)
      shipping[id] = Math.floor(qty);
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
  };

  return {
    version: STATE_VERSION,
    time,
    money: Math.floor(raw['money'] as number),
    energy: int(raw['energy'], maxEnergy, 0, maxEnergy),
    water: int(raw['water'], canCap, 0, canCap),
    upgrades,
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
    weather: raw['weather'] === 'rain' ? 'rain' : 'sunny',
    lastSummary: null, // transient: only meaningful right after a rollover
    rng: isFiniteNum(raw['rng']) ? raw['rng'] >>> 0 : fresh.rng,
  };
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
