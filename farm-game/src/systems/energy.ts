import { game } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents } from './events';
import { perk } from './skills';

export const maxEnergy = (state: GameState): number =>
  game.baseEnergy + state.upgrades.stamina * game.energyPerUpgrade + perk(state, 'maxEnergy');

export const canAfford = (state: GameState, cost: number): boolean => state.energy >= cost;

/** Spend energy; refuses (returns false, changes nothing) when there isn't enough. */
export function spendEnergy(state: GameState, cost: number): boolean {
  if (cost <= 0) return true;
  if (state.energy < cost) return false;
  state.energy -= cost;
  gameEvents.emit('energyChanged', undefined);
  return true;
}

/** Set energy to `fraction` of max (1 = full rest, 0.5 = passed out). */
export function restoreEnergy(state: GameState, fraction: number): void {
  state.energy = Math.round(maxEnergy(state) * fraction);
  gameEvents.emit('energyChanged', undefined);
}
