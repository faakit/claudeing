import { game } from '../src/data';
import { createInitialState, type GameState } from '../src/state/GameState';
import type { TileInfo } from '../src/systems/actions';

export const newState = (): GameState => {
  const s = createInitialState();
  s.rng = 12345;
  return s;
};

export const grass = (tx: number, ty: number): TileInfo => ({
  map: 'farm',
  tx,
  ty,
  kind: 'grass',
  tillable: true,
  blocked: false,
  farmland: true,
});
export const pond = (tx: number, ty: number): TileInfo => ({
  map: 'farm',
  tx,
  ty,
  kind: 'water',
  tillable: false,
  blocked: true,
  farmland: true,
});

/** Equip the first inventory slot holding `itemId` (must be on the hotbar). */
export function equip(s: GameState, itemId: string): void {
  const i = s.inventory.slots.findIndex((x) => x?.item === itemId);
  if (i < 0 || i > 7) throw new Error(`${itemId} is not on the hotbar`);
  s.inventory.selected = i;
}

/** Number of fixed tool slots, and the first slot a regular item lands in. */
export const TOOL_SLOTS = game.toolSlots;
/** How many items of one kind fill every non-tool slot, leaving none free. */
export const FULL_INVENTORY = (game.inventorySlots - game.toolSlots) * game.stackLimit;
