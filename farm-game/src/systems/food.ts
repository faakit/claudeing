import { items } from '../data';
import type { GameState } from '../state/GameState';
import { maxEnergy } from './energy';
import { gameEvents, toast } from './events';
import { addStat } from './goals';
import { removeFromSlot } from './inventory';

/** Energy a food item gives back (0 for anything you cannot eat). */
export const foodEnergy = (item: string | undefined): number =>
  items[item ?? '']?.type === 'food' ? (items[item ?? '']?.energy ?? 0) : 0;

export type EatResult = 'ok' | 'not_food' | 'full';

/**
 * Eat one of the stack in `slot`: energy back, up to the maximum. A full player is refused, so a dish is
 * never wasted. Cooking is how a long day gets longer (the kitchen is a Home upgrade).
 */
export function eat(state: GameState, slot: number): EatResult {
  const stack = state.inventory.slots[slot];
  const gain = foodEnergy(stack?.item);
  if (!stack || gain <= 0) return 'not_food';
  const room = maxEnergy(state) - state.energy;
  if (room <= 0) return 'full';
  const name = items[stack.item]?.name ?? stack.item;
  removeFromSlot(state, slot, 1);
  state.energy += Math.min(gain, room);
  gameEvents.emit('energyChanged', undefined);
  addStat(state, 'ate');
  toast(`${name}: +${Math.min(gain, room)} energy.`, 'good');
  return 'ok';
}
