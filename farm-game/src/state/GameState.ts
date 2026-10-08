import { PLAYER_HITBOX, TILE_SIZE } from '../config';
import { game, items, mapsData } from '../data';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Weather = 'sunny' | 'rain' | 'storm';
export const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter'];

/** Player position is the feet-center in map pixels. */
export interface PlayerState {
  map: string;
  x: number;
  y: number;
  facing: Direction;
}

export interface TimeState {
  year: number;
  season: Season;
  day: number;
  /** Minutes since midnight; the game day runs dayStartMinutes..dayEndMinutes. */
  minutes: number;
  /** Real ms accumulated toward the next game minute. */
  acc: number;
}

export interface ItemStack {
  item: string;
  qty: number;
  /** Quality tier: 1 silver, 2 gold (omitted = normal). */
  q?: number;
  /** For derived goods: the item this was made from (e.g. jam made from tomato). */
  of?: string;
}

export interface CropState {
  cropId: string;
  stage: number;
  daysInStage: number;
  /** True after a regrowing crop was harvested; uses regrowDays as the stage length. */
  regrow: boolean;
}

export interface SoilTile {
  watered: boolean;
  crop: CropState | null;
  /** Fertilizer item id applied to this tile; consumed when the crop is harvested. */
  fert?: string;
}

/** Something the player put down in the world (a sprinkler, a jar...). Behaviour comes from the registry. */
export interface PlacedObject {
  id: number;
  /** Key in placeables.json (also the item id that places it). */
  type: string;
  tx: number;
  ty: number;
  /** Per-behaviour state, e.g. a jar's contents. Always plain JSON. */
  data: Record<string, unknown>;
}

/** A town order: deliver `qty` of a stack for gold and XP. `item` is a stack key (see itemRef). */
export interface Order {
  id: number;
  item: string;
  qty: number;
  reward: number;
  xp: number;
  done: boolean;
}

/** How a villager feels about the player. Days are absolute day numbers (0 = never). */
export interface Friendship {
  points: number;
  talkedDay: number;
  giftedDay: number;
}

export interface DaySummary {
  /** The day that just ended. */
  endedDay: number;
  endedSeason: Season;
  shipped: { item: string; qty: number; gold: number }[];
  total: number;
  withered: number;
  passedOut: boolean;
  /** Weather of the new day that just began. */
  weather: Weather;
  /** Set when Summer 28 ends: shows the results screen. */
  yearEnd: boolean;
  /** Extra morning news from mechanics (jars ready, new orders...). Each is one short line. */
  notes?: string[];
}

export interface Settings {
  music: number;
  sfx: number;
  muted: boolean;
  /** Haptic/vibration feedback on actions. */
  vibrate: boolean;
  /** Mirror the thumb controls to the left side of the dock. */
  leftHanded: boolean;
  /** Calmer visuals: no shaking, bobbing or wandering animation. */
  reduceMotion: boolean;
}

/** Everything that must be saved lives here. Plain, serializable data only. */
export interface GameState {
  version: number;
  time: TimeState;
  money: number;
  energy: number;
  /** Charges left in the watering can. */
  water: number;
  /** Levels of shop upgrades by id: can, stamina, hoe, rod. */
  upgrades: { can: number; stamina: number; hoe: number; rod: number };
  /** Ids of the farm plots you own (see plots.json). Tilling is only allowed on owned plots. */
  plots: string[];
  inventory: { slots: (ItemStack | null)[]; selected: number };
  farm: { tiles: Record<string, SoilTile>; weeds: Record<string, true> };
  /** Items in the shipping bin, paid out at the next rollover. */
  shipping: Record<string, number>;
  player: PlayerState;
  stats: Record<string, number>;
  /** Index into goals.json; equals goals.length when all are done. */
  goalIndex: number;
  settings: Settings;
  weather: Weather;
  /** Tomorrow's weather, known tonight so the player can plan (rain means no watering, a storm shakes fruit down). */
  forecast: Weather;
  /** Placed objects by map id. */
  placed: Record<string, PlacedObject[]>;
  nextPlacedId: number;
  /** Total XP per skill id (levels are derived from skills.json). */
  skills: Record<string, number>;
  /** Forageables lying on the ground: map id -> tile key -> item id. */
  forage: Record<string, Record<string, string>>;
  /** Today's orders. `day` is the absolute day number they were generated for. */
  orders: { day: number; list: Order[] };
  /** Friendship with villagers by npc id. */
  friends: Record<string, Friendship>;
  lastSummary: DaySummary | null;
  rng: number;
}

export const STATE_VERSION = 6;

/** Feet position that puts the hitbox center in the middle of tile (tx, ty). */
export function spawnPosition(tx: number, ty: number): { x: number; y: number } {
  return {
    x: tx * TILE_SIZE + TILE_SIZE / 2,
    y: ty * TILE_SIZE + TILE_SIZE / 2 + PLAYER_HITBOX.h / 2,
  };
}

export function createInitialState(): GameState {
  const { map, tx, ty, facing } = mapsData.start;
  const slots: (ItemStack | null)[] = Array.from({ length: game.inventorySlots }, () => null);
  const toolIds = Object.entries(items)
    .filter(([, it]) => it.type === 'tool')
    .map(([id]) => id);
  toolIds.forEach((id, i) => (slots[i] = { item: id, qty: 1 }));
  game.startingItems.forEach((s, i) => (slots[toolIds.length + i] = { item: s.item, qty: s.qty }));
  return {
    version: STATE_VERSION,
    time: { year: 1, season: 'spring', day: 1, minutes: game.dayStartMinutes, acc: 0 },
    money: game.startingMoney,
    energy: game.baseEnergy,
    water: game.canCapacity[0] ?? 20,
    upgrades: { can: 0, stamina: 0, hoe: 0, rod: 0 },
    plots: ['home'],
    inventory: { slots, selected: 0 },
    farm: { tiles: {}, weeds: {} },
    shipping: {},
    player: { map, ...spawnPosition(tx, ty), facing },
    stats: {},
    goalIndex: 0,
    settings: {
      music: 0.6,
      sfx: 0.8,
      muted: false,
      vibrate: true,
      leftHanded: false,
      reduceMotion: false,
    },
    weather: 'sunny',
    forecast: 'sunny',
    placed: {},
    nextPlacedId: 1,
    skills: {},
    forage: {},
    orders: { day: 0, list: [] },
    friends: {},
    lastSummary: null,
    rng: (Date.now() & 0x7fffffff) >>> 0,
  };
}
