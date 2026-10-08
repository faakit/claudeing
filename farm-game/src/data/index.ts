import cropsRaw from './crops.json';
import gameRaw from './game.json';
import goalsRaw from './goals.json';
import itemsRaw from './items.json';
import mapsRaw from './maps.json';
import shopsRaw from './shops.json';
import toolsRaw from './tools.json';
import skillsRaw from './skills.json';
import recipesRaw from './recipes.json';
import placeablesRaw from './placeables.json';
import forageRaw from './forage.json';
import fishRaw from './fish.json';
import ordersRaw from './orders.json';
import animalsRaw from './animals.json';
import npcsRaw from './npcs.json';
import tipsRaw from './tips.json';
import plotsRaw from './plots.json';
import machinesRaw from './machines.json';
import treesRaw from './trees.json';
import collectionsRaw from './collections.json';
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

export type ItemType =
  | 'tool'
  | 'seed'
  | 'crop'
  | 'material'
  | 'forage'
  | 'fish'
  | 'fertilizer'
  | 'bait'
  | 'placeable'
  | 'preserve'
  | 'animal'
  | 'sapling'
  | 'feed'
  | 'product';
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
  /** Derived goods (jam, pickles) are made from another item: value = base + input value x multiplier. */
  /** What a preserve jar makes of it: fruit -> jam, veg -> pickles. Flowers cannot be preserved. */
  family?: 'fruit' | 'veg' | 'flower';
  fertilizer?: { quality: number; growth: number };
  /** True for items that are put down in the world (see placeables.json). */
  placeable?: boolean;
  derived?: boolean;
  sellMultiplier?: number;
  /** Display name template; `{of}` is replaced by the source item's name. */
  nameTemplate?: string;
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
  /** Key in the tool-action registry (code). Open-ended so new tools need no type change. */
  action: string;
  icon: string;
}
export interface UpgradeDef {
  /** 'can', 'stamina', 'hoe', 'rod': the keys of `state.upgrades`. */
  id: string;
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
  /** One line telling a stuck player what to do next. */
  hint: string;
  /** Where to look, per map id ([tx, ty]); an arrow points there when the player stalls. */
  where?: Record<string, [number, number]>;
}
export interface TipDef {
  id: string;
  stat: string;
  min: number;
  text: string;
}
export interface SkillDef {
  name: string;
  /** Total XP needed to reach level n+1 is xpTable[n]; level 1 needs 0. */
  xpTable: number[];
  /** Perk values gained on reaching a level (levels are 1-based). Summed across levels reached. */
  perks: Record<string, Record<string, number>>;
  blurb: string;
}
export interface RecipeDef {
  name: string;
  output: { item: string; qty: number };
  ingredients: { item: string; qty: number }[];
  gold: number;
  unlock: { skill: string; level: number } | null;
}
export interface PlaceableDef {
  name: string;
  /** Key in the placeable behavior registry (code), e.g. "sprinkler" or "jar". */
  behavior: string;
  /** Solid placeables block movement. */
  solid: boolean;
  sprite: string;
  params: Record<string, number | boolean | string>;
}
export interface ForageDef {
  perDay: Record<string, number>;
  cap: Record<string, number>;
  table: { item: string; seasons: Season[]; maps?: string[]; weight: number }[];
}
export interface FishDef {
  item: string;
  maps: string[];
  seasons: Season[];
  /** Needs wet weather (rain or storm). */
  weather?: 'sunny' | 'rain';
  weight: number;
  /** 0..1: how hard the reel mini-game is. */
  difficulty: number;
}
export interface OrdersDef {
  perDay: number;
  rewardMultiplier: [number, number];
  /** No single order pays more than this. */
  maxReward: number;
  tiers: { maxValue: number; qty: [number, number] }[];
  xpPerValue: number;
}
export interface AnimalDef {
  name: string;
  /** The item you buy and put in a house. */
  item: string;
  feed: string;
  product: string;
  capacity: number;
  sprite: string;
  perDay: number;
}
export interface NpcDef {
  name: string;
  role: 'shop' | 'friend';
  map: string;
  tx: number;
  ty: number;
  facing: Direction;
  tint: string;
  blurb: string;
  loves: string[];
  likes: string[];
  dislikes: string[];
  /** Lines by friendship tier (stranger 0-1 hearts, friend 2-3, close 4-5) plus rainy-day lines. */
  lines: Record<'stranger' | 'friend' | 'close' | 'rain', string[]>;
  /** Handed over after the first chat of a day once friendship reaches `giftHearts`. */
  gifts: { item: string; qty: number }[];
  giftHearts: number;
  /** Perks at heart levels, summed into `perk(state, key)` like skill perks. */
  perks: Record<string, Record<string, number>>;
}
export interface CollectionDef {
  name: string;
  /** Gold for finding every item on the page. */
  reward: number;
  items: string[];
}
export interface TreeDef {
  name: string;
  fruit: string;
  season: Season;
  /** Mornings until it bears fruit. */
  growDays: number;
  /** One fruit every this many mornings while in season. */
  every: number;
  /** Fruit that can wait on the tree. */
  cap: number;
  leaf: string;
  trunk: string;
}
export interface MachineDef {
  /** Mornings until the output is ready. */
  days: number;
  xp: number;
  /** Item family ("fruit", "veg") -> the derived good this machine makes of it. */
  recipes: Record<string, string>;
}
export interface PlotDef {
  name: string;
  /** [tx, ty, width, height] on the farm map. */
  rect: [number, number, number, number];
  /** 0 = yours from the start. */
  price: number;
  /** Tile where the "for sale" sign stands (null for free plots). */
  sign: [number, number] | null;
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
  /** Sell-price multiplier per quality tier (0 normal, 1 silver, 2 gold). */
  qualityMultipliers: number[];
  rainChance: Record<Season, number>;
  /** Chance (0-1) that a new day is a storm (rain plus wind), by season. Checked before rain. */
  stormChance: Record<Season, number>;
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
export const skills = skillsRaw as unknown as Record<string, SkillDef>;
export const recipes = recipesRaw as unknown as Record<string, RecipeDef>;
export const placeables = placeablesRaw as unknown as Record<string, PlaceableDef>;
export const forage = forageRaw as unknown as ForageDef;
export const fish = fishRaw as unknown as FishDef[];
export const orders = ordersRaw as unknown as OrdersDef;
export const animals = animalsRaw as unknown as Record<string, AnimalDef>;
export const collections = collectionsRaw as unknown as Record<string, CollectionDef>;
export const trees = treesRaw as unknown as Record<string, TreeDef>;
export const machines = machinesRaw as unknown as Record<string, MachineDef>;
export const plots = plotsRaw as unknown as Record<string, PlotDef>;
export const tips = tipsRaw as unknown as TipDef[];
export const npcs = npcsRaw as unknown as Record<string, NpcDef>;

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
  for (const g of goals) {
    if (!g.id || !g.stat || g.target < 1) fail('goals', `bad goal "${g.id}"`);
    if (!g.hint) fail('goals', `goal "${g.id}" needs a hint`);
    for (const m of Object.keys(g.where ?? {}))
      if (!mapsData.maps[m]) fail('goals', `goal "${g.id}" points at unknown map "${m}"`);
  }
  for (const t of tips) if (!t.id || !t.stat || !t.text) fail('tips', `bad tip "${t.id}"`);
  const mapIds = Object.keys(mapsData.maps);
  for (const [id, sk] of Object.entries(skills)) {
    if (sk.xpTable[0] !== 0 || sk.xpTable.some((v, i) => i > 0 && v <= (sk.xpTable[i - 1] ?? 0))) {
      fail('skills', `"${id}" xpTable must start at 0 and strictly increase`);
    }
    for (const lvl of Object.keys(sk.perks)) {
      if (Number(lvl) < 2 || Number(lvl) > sk.xpTable.length)
        fail('skills', `"${id}" has a perk at invalid level ${lvl}`);
    }
  }
  for (const [id, r] of Object.entries(recipes)) {
    if (!items[r.output.item]) fail('recipes', `"${id}" outputs unknown item "${r.output.item}"`);
    for (const ing of r.ingredients)
      if (!items[ing.item]) fail('recipes', `"${id}" needs unknown item "${ing.item}"`);
    if (r.unlock && !skills[r.unlock.skill])
      fail('recipes', `"${id}" unlocks with unknown skill "${r.unlock.skill}"`);
    if (r.output.qty < 1 || r.gold < 0) fail('recipes', `"${id}" has a bad quantity or price`);
  }
  for (const [id, pl] of Object.entries(placeables)) {
    if (!items[id]?.placeable)
      fail('placeables', `"${id}" must also be an item with "placeable": true`);
    if (!pl.behavior || !pl.sprite) fail('placeables', `"${id}" needs behavior and sprite`);
  }
  for (const [id, it] of Object.entries(items)) {
    if (it.placeable && !placeables[id])
      fail('items', `placeable item "${id}" has no entry in placeables.json`);
    if (it.type === 'fertilizer' && !it.fertilizer)
      fail('items', `fertilizer "${id}" needs a "fertilizer" block`);
  }
  for (const e of forage.table) {
    if (items[e.item]?.type !== 'forage') fail('forage', `"${e.item}" is not a forage item`);
    for (const m of e.maps ?? []) if (!mapIds.includes(m)) fail('forage', `unknown map "${m}"`);
  }
  for (const m of [...Object.keys(forage.perDay), ...Object.keys(forage.cap)]) {
    if (!mapIds.includes(m)) fail('forage', `unknown map "${m}"`);
  }
  for (const f of fish) {
    if (items[f.item]?.type !== 'fish') fail('fish', `"${f.item}" is not a fish item`);
    if (f.difficulty < 0 || f.difficulty > 1) fail('fish', `"${f.item}" difficulty must be 0..1`);
    for (const m of f.maps) if (!mapIds.includes(m)) fail('fish', `unknown map "${m}"`);
  }
  if (orders.tiers.length === 0 || orders.perDay < 1) fail('orders', 'needs tiers and perDay >= 1');
  for (const [id, a] of Object.entries(animals)) {
    for (const ref of [a.item, a.feed, a.product])
      if (!items[ref]) fail('animals', `"${id}" references unknown item "${ref}"`);
    if (items[a.item]?.type !== 'animal') fail('animals', `"${a.item}" must be an animal item`);
    if (a.capacity < 1 || a.perDay < 1) fail('animals', `"${id}" needs capacity and perDay >= 1`);
  }
  for (const [id, pl] of Object.entries(placeables))
    if (pl.behavior === 'animalHouse' && !animals[String(pl.params['species'])])
      fail('placeables', `"${id}" houses unknown species "${pl.params['species']}"`);
  for (const [id, n] of Object.entries(npcs)) {
    if (!mapIds.includes(n.map)) fail('npcs', `"${id}" lives on unknown map "${n.map}"`);
    if (!/^#[0-9a-f]{6}$/i.test(n.tint)) fail('npcs', `"${id}" needs a #rrggbb tint`);
    for (const ref of [...n.loves, ...n.likes, ...n.dislikes, ...n.gifts.map((g) => g.item)])
      if (!items[ref]) fail('npcs', `"${id}" mentions unknown item "${ref}"`);
    for (const tier of ['stranger', 'friend', 'close', 'rain'] as const)
      if (n.lines[tier].length === 0) fail('npcs', `"${id}" needs "${tier}" lines`);
    for (const lvl of Object.keys(n.perks))
      if (Number(lvl) < 1 || Number(lvl) > 5) fail('npcs', `"${id}" perk at invalid hearts ${lvl}`);
  }
  for (const [id, m] of Object.entries(machines)) {
    if (!placeables[id]) fail('machines', `"${id}" is not a placeable`);
    if (m.days < 1) fail('machines', `"${id}" needs days >= 1`);
    for (const out of Object.values(m.recipes))
      if (!items[out]?.derived)
        fail('machines', `"${id}" makes "${out}", which is not a derived item`);
  }
  for (const [id, t] of Object.entries(trees)) {
    if (items[id]?.type !== 'sapling' || !placeables[id])
      fail('trees', `"${id}" needs a sapling item and a placeable`);
    if (items[t.fruit]?.family !== 'fruit')
      fail('trees', `"${id}" fruit "${t.fruit}" must be a fruit item`);
    if (t.growDays < 1 || t.every < 1 || t.cap < 1) fail('trees', `"${id}" has a bad number`);
  }
  for (const [id, c] of Object.entries(collections)) {
    if (c.items.length === 0) fail('collections', `"${id}" is empty`);
    for (const it of c.items)
      if (!items[it]) fail('collections', `"${id}" lists unknown item "${it}"`);
  }
  const claimed = new Set<string>();
  for (const [id, pl] of Object.entries(plots)) {
    const [x, y, w, h] = pl.rect;
    if (w < 1 || h < 1) fail('plots', `"${id}" has an empty rect`);
    if ((pl.price === 0) !== (pl.sign === null))
      fail('plots', `"${id}": free plots have no sign, paid ones need one`);
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const k = `${i},${j}`;
        if (claimed.has(k)) fail('plots', `"${id}" overlaps another plot at ${k}`);
        claimed.add(k);
      }
  }
  if (!Object.values(plots).some((p) => p.price === 0)) fail('plots', 'needs a free starter plot');
  for (const [id, pl] of Object.entries(plots))
    if (pl.sign && claimed.has(pl.sign.join(',')))
      fail('plots', `"${id}" sign stands inside a plot`);
  const toolItems = Object.values(items).filter((i) => i.type === 'tool');
  if (toolItems.length !== game.toolSlots)
    fail('game', 'toolSlots must equal the number of tool items');
}
validateContent();
