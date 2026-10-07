import { mapsData } from '../data';
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

function validateState(raw: Raw): GameState {
  const bad = (what: string): never => {
    throw new Error(`Invalid save: ${what}`);
  };
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const time = raw['time'] as Raw | undefined;
  if (!isObj(time) || !SEASON_IDS.includes(time['season'] as string)) bad('time');
  if (!num((time as Raw)['day']) || !num((time as Raw)['minutes'])) bad('time values');
  if (!num(raw['money']) || (raw['money'] as number) < 0) bad('money');
  if (!num(raw['energy']) || !num(raw['water'])) bad('energy/water');
  const inv = raw['inventory'] as Raw | undefined;
  if (!isObj(inv) || !Array.isArray(inv['slots']) || !num(inv['selected'])) bad('inventory');
  if (!isObj(raw['farm']) || !isObj((raw['farm'] as Raw)['tiles'])) bad('farm');
  if (!isObj(raw['shipping']) || !isObj(raw['stats']) || !isObj(raw['upgrades'])) bad('tables');
  const p = raw['player'] as Raw | undefined;
  if (!isObj(p) || typeof p['map'] !== 'string' || !mapsData.maps[p['map']]) bad('player map');
  if (!num((p as Raw)['x']) || !num((p as Raw)['y'])) bad('player position');
  // Fill anything added after the save was written without a version bump.
  const fresh = createInitialState();
  return { ...fresh, ...(raw as unknown as GameState) };
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
