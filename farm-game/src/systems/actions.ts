import { crops, items, tools } from '../data';
import type { GameState } from '../state/GameState';
import { game } from '../data';
import { spendEnergy } from './energy';
import { gameEvents, toast } from './events';
import { addStat } from './goals';
import { getSoil, harvest, isMature, plant, till, tileKey, water } from './farming';
import { addItem, removeFromSlot, roomFor, selectedStack } from './inventory';

/** What the facing tile looks like, as computed by the scene from the map. */
export interface TileInfo {
  tx: number;
  ty: number;
  /** Ground kind from the tileset ("grass", "water", ...). */
  kind: string;
  tillable: boolean;
  /** An object or solid tile occupies it (bed, bin, wall...). */
  blocked: boolean;
}

export type ActionKind = 'till' | 'water' | 'refill' | 'clear' | 'plant' | 'harvest';
export type ActionResult =
  | { ok: true; kind: ActionKind; tx: number; ty: number; item?: string; qty?: number }
  | { ok: false; message: string };

const refuse = (message: string): ActionResult => {
  toast(message, 'warn');
  return { ok: false, message };
};

export const waterCapacity = (state: GameState): number =>
  game.canCapacity[state.upgrades.can] ?? game.canCapacity[0] ?? 20;

/**
 * The single entry point for "use the equipped item on the facing tile".
 * Harvesting a mature crop always wins, whatever is equipped.
 */
export function performAction(state: GameState, tile: TileInfo): ActionResult {
  const { tx, ty } = tile;
  const soil = getSoil(state, tx, ty);

  if (soil?.crop && isMature(soil.crop)) {
    const res = harvest(state, tx, ty);
    if (!res.ok) return refuse('Inventory full!');
    addStat(state, 'harvested', res.qty);
    return { ok: true, kind: 'harvest', tx, ty, item: res.item, qty: res.qty };
  }

  const stack = selectedStack(state);
  if (!stack) return refuse('Nothing equipped.');
  const def = items[stack.item];
  if (!def) throw new Error(`Unknown item "${stack.item}"`);

  if (def.type === 'seed') {
    const cropId = def.plants as string;
    const res = plant(state, tx, ty, cropId);
    if (res === 'no_soil') return refuse('Till the soil first.');
    if (res === 'occupied') return refuse('Something is already growing here.');
    if (res === 'out_of_season') {
      const when = (crops[cropId]?.seasons ?? []).join(' or ');
      return refuse(`Won't grow in ${state.time.season}. Plant in ${when}.`);
    }
    removeFromSlot(state, state.inventory.selected, 1);
    addStat(state, 'planted');
    return { ok: true, kind: 'plant', tx, ty };
  }

  if (def.type !== 'tool' || !def.tool) return refuse(`Can't use ${def.name} here.`);
  const tool = tools[def.tool];
  if (!tool) throw new Error(`Tool "${def.tool}" missing from tools.json`);

  if (tool.action === 'till') {
    if (state.farm.tiles[tileKey(tx, ty)]) return refuse('Already tilled.');
    if (!tile.tillable || tile.blocked) return refuse("Can't till here.");
    if (!spendEnergy(state, tool.energyCost)) return refuse('Too tired! Go to bed.');
    till(state, tx, ty);
    addStat(state, 'tilled');
    return { ok: true, kind: 'till', tx, ty };
  }

  if (tool.action === 'water') {
    if (tile.kind === 'water') {
      const cap = waterCapacity(state);
      if (state.water >= cap) return refuse('The can is already full.');
      state.water = cap;
      gameEvents.emit('energyChanged', undefined);
      return { ok: true, kind: 'refill', tx, ty };
    }
    if (!soil) return refuse('Nothing to water here.');
    if (soil.watered) return refuse('Already watered.');
    if (state.water <= 0) return refuse('Can is empty. Refill at the pond.');
    if (!spendEnergy(state, tool.energyCost)) return refuse('Too tired! Go to bed.');
    state.water -= 1;
    water(state, tx, ty);
    addStat(state, 'watered');
    return { ok: true, kind: 'water', tx, ty };
  }

  // clear weeds
  const key = tileKey(tx, ty);
  if (!state.farm.weeds[key]) return refuse('Nothing to cut.');
  if (roomFor(state, 'fiber', 1) < 1) return refuse('Inventory full!');
  if (!spendEnergy(state, tool.energyCost)) return refuse('Too tired! Go to bed.');
  delete state.farm.weeds[key];
  addItem(state, 'fiber', 1);
  gameEvents.emit('farmChanged', undefined);
  addStat(state, 'cleared');
  return { ok: true, kind: 'clear', tx, ty, item: 'fiber', qty: 1 };
}
