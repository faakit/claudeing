import type { GameState } from '../state/GameState';
import { random } from './rng';
import { perk } from './skills';

/**
 * Roll a quality tier for a freshly harvested/caught/foraged good: 0 normal, 1 silver, 2 gold.
 * `extra` is a bonus from the situation (fertilizer, a perfect reel...), added to the farming perk.
 * Base odds are 2% gold / 10% silver; every +0.1 of bonus adds 5% gold and 10% silver.
 */
export function rollQuality(state: GameState, extra = 0, perkKey = 'qualityBonus'): number {
  const bonus = Math.max(0, perk(state, perkKey) + extra);
  const gold = Math.min(0.6, 0.02 + bonus * 0.5);
  const silver = Math.min(0.9 - gold, 0.1 + bonus);
  const r = random(state);
  if (r < gold) return 2;
  if (r < gold + silver) return 1;
  return 0;
}

/** The odds `rollQuality` uses for a bonus, for UI and tests. */
export function qualityOdds(bonus: number): { gold: number; silver: number } {
  const b = Math.max(0, bonus);
  const gold = Math.min(0.6, 0.02 + b * 0.5);
  return { gold, silver: Math.min(0.9 - gold, 0.1 + b) };
}
