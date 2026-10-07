import { crops, game } from '../data';
import type { CropDef } from '../data';
import type { CropState, GameState, SoilTile } from '../state/GameState';
import { gameEvents } from './events';
import { addItem, roomFor } from './inventory';
import { random } from './rng';

export const tileKey = (tx: number, ty: number): string => `${tx},${ty}`;
export const parseKey = (key: string): [number, number] => {
  const [x, y] = key.split(',').map(Number);
  return [x ?? 0, y ?? 0];
};

export const getSoil = (state: GameState, tx: number, ty: number): SoilTile | undefined =>
  state.farm.tiles[tileKey(tx, ty)];

export function cropDef(crop: CropState): CropDef {
  const def = crops[crop.cropId];
  if (!def) throw new Error(`Unknown crop "${crop.cropId}"`);
  return def;
}

export const isMature = (crop: CropState): boolean => crop.stage >= cropDef(crop).stageDays.length;

/** Days the crop needs to spend in its current stage before advancing. */
function stageLength(crop: CropState): number {
  const def = cropDef(crop);
  if (crop.regrow && def.regrowDays) return def.regrowDays;
  return def.stageDays[crop.stage] ?? 1;
}

export function till(state: GameState, tx: number, ty: number): boolean {
  const key = tileKey(tx, ty);
  if (state.farm.tiles[key]) return false;
  delete state.farm.weeds[key];
  state.farm.tiles[key] = { watered: false, crop: null };
  gameEvents.emit('farmChanged', undefined);
  return true;
}

export type PlantResult = 'ok' | 'no_soil' | 'occupied' | 'out_of_season';

export function plant(state: GameState, tx: number, ty: number, cropId: string): PlantResult {
  const soil = getSoil(state, tx, ty);
  const def = crops[cropId];
  if (!def) throw new Error(`Unknown crop "${cropId}"`);
  if (!soil) return 'no_soil';
  if (soil.crop) return 'occupied';
  if (!def.seasons.includes(state.time.season)) return 'out_of_season';
  soil.crop = { cropId, stage: 0, daysInStage: 0, regrow: false };
  gameEvents.emit('farmChanged', undefined);
  return 'ok';
}

export function water(state: GameState, tx: number, ty: number): boolean {
  const soil = getSoil(state, tx, ty);
  if (!soil || soil.watered) return false;
  soil.watered = true;
  gameEvents.emit('farmChanged', undefined);
  return true;
}

export type HarvestResult =
  { ok: true; item: string; qty: number } | { ok: false; reason: 'none' | 'immature' | 'full' };

/** Harvest a mature crop into the inventory. Regrowing crops reset; others are removed. */
export function harvest(state: GameState, tx: number, ty: number): HarvestResult {
  const soil = getSoil(state, tx, ty);
  const crop = soil?.crop;
  if (!soil || !crop) return { ok: false, reason: 'none' };
  if (!isMature(crop)) return { ok: false, reason: 'immature' };
  const def = cropDef(crop);
  if (roomFor(state, def.harvestItem, def.harvestQuantity) < def.harvestQuantity) {
    return { ok: false, reason: 'full' }; // never lose the harvest silently
  }
  addItem(state, def.harvestItem, def.harvestQuantity);
  if (def.regrowDays) {
    crop.stage = def.stageDays.length - 1;
    crop.daysInStage = 0;
    crop.regrow = true;
  } else {
    soil.crop = null;
  }
  gameEvents.emit('farmChanged', undefined);
  return { ok: true, item: def.harvestItem, qty: def.harvestQuantity };
}

/** Watered crops advance one day; then every tile dries. Unwatered crops do not grow. */
export function growCrops(state: GameState): void {
  for (const soil of Object.values(state.farm.tiles)) {
    const crop = soil.crop;
    if (crop && soil.watered && !isMature(crop)) {
      crop.daysInStage += 1;
      if (crop.daysInStage >= stageLength(crop)) {
        crop.stage += 1;
        crop.daysInStage = 0;
        crop.regrow = false;
      }
    }
    soil.watered = false;
  }
  gameEvents.emit('farmChanged', undefined);
}

/** Remove crops that can't survive the current season. Returns how many withered. */
export function killOutOfSeason(state: GameState): number {
  let dead = 0;
  for (const soil of Object.values(state.farm.tiles)) {
    if (soil.crop && !cropDef(soil.crop).seasons.includes(state.time.season)) {
      soil.crop = null;
      dead += 1;
    }
  }
  if (dead) gameEvents.emit('farmChanged', undefined);
  return dead;
}

/** Scatter a few weeds on untouched farmable tiles. */
export function spawnWeeds(state: GameState, candidates: readonly [number, number][]): void {
  const free = candidates.filter(([x, y]) => {
    const k = tileKey(x, y);
    return !state.farm.tiles[k] && !state.farm.weeds[k];
  });
  let room = game.maxWeeds - Object.keys(state.farm.weeds).length;
  for (let i = 0; i < game.weedsPerDay && room > 0 && free.length > 0; i++) {
    const [x, y] = free.splice(Math.floor(random(state) * free.length), 1)[0] as [number, number];
    state.farm.weeds[tileKey(x, y)] = true;
    room -= 1;
  }
  gameEvents.emit('farmChanged', undefined);
}
