import cropsRaw from './crops.json';
import gameRaw from './game.json';
import goalsRaw from './goals.json';
import itemsRaw from './items.json';
import mapsRaw from './maps.json';
import shopsRaw from './shops.json';
import toolsRaw from './tools.json';
import type { Direction, Season } from '../state/GameState';

export interface MapDef {
  scene: string;
  file: string;
  /** Tile gids (1-based tileset index) that the hoe can till. */
  tillable?: number[];
  /** Outdoor maps get the day/night tint and the season tint. */
  outdoor?: boolean;
  /** This map holds the farm's soil, crops and weeds. Farm actions are refused elsewhere. */
  farmland?: boolean;
}
export interface SpawnDef {
  map: string;
  tx: number;
  ty: number;
  facing: Direction;
}
export interface MapsData {
  start: SpawnDef;
  /** Where the player wakes up after sleeping. */
  wake: SpawnDef;
  maps: Record<string, MapDef>;
}

export type ItemType = 'tool' | 'seed' | 'crop' | 'material';
export interface ItemDef {
  name: string;
  type: ItemType;
  icon: string;
  /** Placeholder-art tint; real icons replace it in M7. */
  color: string;
  description: string;
  buyPrice?: number;
  sellPrice?: number;
  stackLimit?: number;
  plants?: string;
  tool?: string;
}
export interface CropDef {
  seasons: Season[];
  stageDays: number[];
  sprite: string;
  harvestItem: string;
  harvestQuantity: number;
  regrowDays: number | null;
  placeholder: { leaf: string; fruit: string };
}
export interface ToolDef {
  energyCost: number;
  action: 'till' | 'water' | 'clear';
  icon: string;
}
export interface UpgradeDef {
  id: 'can' | 'stamina';
  name: string;
  levels: { price: number; label: string }[];
}
export interface ShopDef {
  name: string;
  stock: { item: string; seasons: Season[] }[];
  upgrades: UpgradeDef[];
}
export interface GoalDef {
  id: string;
  text: string;
  stat: string;
  target: number;
  reward: number;
}
export interface GameData {
  startingMoney: number;
  startingItems: { item: string; qty: number }[];
  inventorySlots: number;
  hotbarSlots: number;
  toolSlots: number;
  stackLimit: number;
  baseEnergy: number;
  energyPerUpgrade: number;
  canCapacity: number[];
  dayStartMinutes: number;
  dayEndMinutes: number;
  seasonLength: number;
  passOutEnergyFraction: number;
  weedsPerDay: number;
  maxWeeds: number;
  ranks: { min: number; title: string }[];
  /** Chance (0-1) that a new day is rainy, by season. */
  rainChance: Record<Season, number>;
  /** Sunny days guaranteed at the very start of a new game. */
  calmDays: number;
}

const DIRS = ['up', 'down', 'left', 'right'];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];

function fail(file: string, msg: string): never {
  throw new Error(`${file}.json: ${msg}`);
}

function validateSpawn(s: SpawnDef | undefined, label: string, maps: Record<string, MapDef>): void {
  if (!s || !maps[s.map]) fail('maps', `"${label}.map" must name an existing map`);
  if (!Number.isInteger(s.tx) || !Number.isInteger(s.ty))
    fail('maps', `"${label}" needs integer tx/ty`);
  if (!DIRS.includes(s.facing)) fail('maps', `"${label}.facing" must be one of ${DIRS.join(', ')}`);
}

function validateMaps(data: unknown): MapsData {
  const d = data as MapsData;
  if (!d?.maps || Object.keys(d.maps).length === 0) fail('maps', 'missing "maps"');
  for (const [id, def] of Object.entries(d.maps)) {
    if (!def.scene || !def.file) fail('maps', `map "${id}" needs "scene" and "file"`);
  }
  validateSpawn(d.start, 'start', d.maps);
  validateSpawn(d.wake, 'wake', d.maps);
  return d;
}

export const mapsData: MapsData = validateMaps(mapsRaw);
export const items = itemsRaw as unknown as Record<string, ItemDef>;
export const crops = cropsRaw as unknown as Record<string, CropDef>;
export const tools = toolsRaw as unknown as Record<string, ToolDef>;
export const shops = shopsRaw as unknown as Record<string, ShopDef>;
export const goals = goalsRaw as unknown as GoalDef[];
export const game = gameRaw as unknown as GameData;

/** Cross-reference every data file so a typo fails loudly at load, not mid-game. */
export function validateContent(): void {
  for (const [id, it] of Object.entries(items)) {
    for (const f of ['name', 'type', 'icon', 'color', 'description'] as const) {
      if (!it[f]) fail('items', `"${id}" is missing "${f}"`);
    }
    if (it.type === 'seed' && !crops[it.plants ?? ''])
      fail('items', `seed "${id}" plants unknown crop "${it.plants}"`);
    if (it.type === 'tool' && !tools[it.tool ?? ''])
      fail('items', `tool "${id}" has no entry in tools.json`);
    if (it.type !== 'tool' && typeof it.sellPrice !== 'number')
      fail('items', `"${id}" needs sellPrice`);
    if (it.type === 'seed' && typeof it.buyPrice !== 'number')
      fail('items', `seed "${id}" needs buyPrice`);
  }
  for (const [id, c] of Object.entries(crops)) {
    if (!items[c.harvestItem]) fail('crops', `"${id}" harvests unknown item "${c.harvestItem}"`);
    if (c.stageDays.length < 2 || c.stageDays.some((n) => !Number.isInteger(n) || n < 1)) {
      fail('crops', `"${id}" needs at least 2 integer stageDays >= 1`);
    }
    if (c.seasons.some((s) => !SEASONS.includes(s))) fail('crops', `"${id}" has an invalid season`);
    if (c.regrowDays !== null && c.regrowDays < 1)
      fail('crops', `"${id}" regrowDays must be null or >= 1`);
    if (!Object.values(items).some((i) => i.plants === id))
      fail('crops', `"${id}" has no seed item`);
  }
  for (const [id, s] of Object.entries(shops)) {
    for (const e of s.stock) {
      if (!items[e.item]) fail('shops', `"${id}" stocks unknown item "${e.item}"`);
    }
    for (const u of s.upgrades) {
      if (u.id === 'can' && u.levels.length !== game.canCapacity.length - 1) {
        fail('shops', 'can upgrade levels must match game.canCapacity');
      }
    }
  }
  for (const si of game.startingItems)
    if (!items[si.item]) fail('game', `unknown starting item "${si.item}"`);
  for (const g of goals) if (!g.id || !g.stat || g.target < 1) fail('goals', `bad goal "${g.id}"`);
  const toolItems = Object.values(items).filter((i) => i.type === 'tool');
  if (toolItems.length !== game.toolSlots)
    fail('game', 'toolSlots must equal the number of tool items');
}
validateContent();
