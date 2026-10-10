import { items } from '../data';
import type { GameState } from '../state/GameState';
import { maxEnergy } from './energy';
import { gameEvents, toast } from './events';
import { addStat } from './goals';
import { removeFromSlot } from './inventory';
import { absoluteDay } from './time';

/**
 * Dishes a day at full strength. Later ones give a share of their energy (owner default, round 3: no hard cap,
 * but cooking cannot make a day endless). `LATER_DISH_SHARE` is for the 4th, 5th, ... dish (the last repeats).
 */
export const FULL_DISHES = 3;
export const LATER_DISH_SHARE = [0.5, 0.25];

/** Dishes eaten today (stats `ate.day` and `ate.today`). */
export const dishesToday = (state: GameState): number =>
  state.stats['ate.day'] === absoluteDay(state) ? (state.stats['ate.today'] ?? 0) : 0;

/** Share of its energy the next dish gives today. */
export function dishShare(state: GameState): number {
  const n = dishesToday(state);
  if (n < FULL_DISHES) return 1;
  return LATER_DISH_SHARE[Math.min(n - FULL_DISHES, LATER_DISH_SHARE.length - 1)] ?? 0.25;
}

/** Energy the next one of this dish gives today, before the energy cap. */
export const dishEnergy = (state: GameState, item: string | undefined): number =>
  Math.round(foodEnergy(item) * dishShare(state));

/**
 * The dish's card text: its description with today's energy in it. From the 4th dish of a day it says the
 * smaller number and why ("Restores 20 now: dish 4 today.").
 */
export function dishText(state: GameState, item: string): string {
  const desc = items[item]?.description ?? '';
  if (dishShare(state) >= 1) return desc;
  const now = `Restores ${dishEnergy(state, item)} now: dish ${dishesToday(state) + 1} today.`;
  const restores = /Restores \d+ energy\./;
  return restores.test(desc) ? desc.replace(restores, now) : `${desc} ${now}`;
}

/** Energy a food item gives back (0 for anything you cannot eat). */
export const foodEnergy = (item: string | undefined): number =>
  items[item ?? '']?.type === 'food' ? (items[item ?? '']?.energy ?? 0) : 0;

export type EatResult = 'ok' | 'not_food' | 'full';

/** Energy the dish in this slot would really give now (today's share, never past the maximum). */
export function eatGain(state: GameState, item: string | undefined): number {
  return Math.max(0, Math.min(dishEnergy(state, item), maxEnergy(state) - state.energy));
}

/**
 * Is eating it now a waste? A dish is kept when less than half of it would count (critique 7, F6: a 540g pie
 * for +5 energy).
 */
export const tooFullFor = (state: GameState, item: string | undefined): boolean =>
  eatGain(state, item) < dishEnergy(state, item) / 2;

/** The "out of energy" line: point at food when the bag holds some. */
export const tiredText = (state: GameState): string =>
  state.inventory.slots.some((s) => foodEnergy(s?.item) > 0)
    ? 'Too tired! Eat something or go to bed.'
    : 'Too tired! Go to bed.';

/**
 * Eat one of the stack in `slot`: energy back, up to the maximum. A full player is refused, so a dish is
 * never wasted. Cooking is how a long day gets longer (the kitchen is a Home upgrade).
 */
export function eat(state: GameState, slot: number): EatResult {
  const stack = state.inventory.slots[slot];
  if (!stack || foodEnergy(stack.item) <= 0) return 'not_food';
  const gain = dishEnergy(state, stack.item);
  const nth = dishesToday(state) + 1;
  const room = maxEnergy(state) - state.energy;
  if (room <= 0 || tooFullFor(state, stack.item)) return 'full';
  const name = items[stack.item]?.name ?? stack.item;
  removeFromSlot(state, slot, 1);
  state.energy += Math.min(gain, room);
  gameEvents.emit('energyChanged', undefined);
  addStat(state, 'ate');
  state.stats['ate.day'] = absoluteDay(state);
  state.stats['ate.today'] = nth;
  toast(
    nth > FULL_DISHES
      ? `${name}: +${Math.min(gain, room)} energy (dish ${nth} today).`
      : `${name}: +${Math.min(gain, room)} energy.`,
    'good',
  );
  return 'ok';
}
