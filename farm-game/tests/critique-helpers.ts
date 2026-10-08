import type { GameState } from '../src/state/GameState';
import { performAction } from '../src/systems/actions';
import { addItem } from '../src/systems/inventory';
import { equip, grass } from './helpers';

/** Till a tile, then try to plant the given seed on it. Returns the plant attempt's result. */
export function tillAndPlant(s: GameState, seed: string) {
  equip(s, 'hoe');
  performAction(s, grass(5, 5));
  addItem(s, seed, 1);
  const slot = s.inventory.slots.findIndex((x) => x?.item === seed);
  s.inventory.selected = slot < 8 ? slot : 4;
  return performAction(s, grass(5, 5));
}
