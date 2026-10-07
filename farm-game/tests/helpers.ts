import { createInitialState, type GameState } from '../src/state/GameState';
import type { TileInfo } from '../src/systems/actions';

export const newState = (): GameState => {
  const s = createInitialState();
  s.rng = 12345;
  return s;
};

export const grass = (tx: number, ty: number): TileInfo => ({
  tx,
  ty,
  kind: 'grass',
  tillable: true,
  blocked: false,
});
export const pond = (tx: number, ty: number): TileInfo => ({
  tx,
  ty,
  kind: 'water',
  tillable: false,
  blocked: true,
});

/** Equip the first inventory slot holding `itemId` (must be on the hotbar). */
export function equip(s: GameState, itemId: string): void {
  const i = s.inventory.slots.findIndex((x) => x?.item === itemId);
  if (i < 0 || i > 7) throw new Error(`${itemId} is not on the hotbar`);
  s.inventory.selected = i;
}
