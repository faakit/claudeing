import { PLAYER_HITBOX, TILE_SIZE } from '../config';
import { game, items, mapsData } from '../data';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Weather = 'sunny' | 'rain';
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
}

/** Everything that must be saved lives here. Plain, serializable data only. */
export interface GameState {
  version: number;
  time: TimeState;
  money: number;
  energy: number;
  /** Charges left in the watering can. */
  water: number;
  upgrades: { can: number; stamina: number };
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
  lastSummary: DaySummary | null;
  rng: number;
}

export const STATE_VERSION = 2;

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
    upgrades: { can: 0, stamina: 0 },
    inventory: { slots, selected: 0 },
    farm: { tiles: {}, weeds: {} },
    shipping: {},
    player: { map, ...spawnPosition(tx, ty), facing },
    stats: {},
    goalIndex: 0,
    settings: { music: 0.6, sfx: 0.8, muted: false, vibrate: true, leftHanded: false },
    weather: 'sunny',
    lastSummary: null,
    rng: (Date.now() & 0x7fffffff) >>> 0,
  };
}
