import { collections } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents, toast } from './events';
import { checkGoals } from './goals';

/**
 * The almanac records every kind of good the player has ever held. Discoveries live in `stats` as `got.<item>`
 * and finished pages as `page.<id>`, so it saves with no new state and migrates for free.
 */
export const discovered = (state: GameState, item: string): boolean => !!state.stats[`got.${item}`];

export const pageDone = (state: GameState, id: string): boolean => !!state.stats[`page.${id}`];

export function pageProgress(state: GameState, id: string): { have: number; total: number } {
  const items = collections[id]?.items ?? [];
  return { have: items.filter((i) => discovered(state, i)).length, total: items.length };
}

export const pagesDone = (state: GameState): number =>
  Object.keys(collections).filter((id) => pageDone(state, id)).length;

/** Record that the player now holds `item`. Returns true if it was new. Completing a page pays its reward. */
export function discover(state: GameState, item: string): boolean {
  const key = `got.${item}`;
  if (state.stats[key]) return false;
  state.stats[key] = 1;
  state.stats['discoveries'] = (state.stats['discoveries'] ?? 0) + 1;
  for (const [id, page] of Object.entries(collections)) {
    if (!page.items.includes(item)) continue;
    const { have, total } = pageProgress(state, id);
    if (have < total || pageDone(state, id)) continue;
    state.stats[`page.${id}`] = 1;
    state.stats['pagesDone'] = pagesDone(state);
    state.money += page.reward;
    gameEvents.emit('moneyChanged', { delta: page.reward });
    toast(`Almanac page done: ${page.name}! +${page.reward}g`, 'good');
    checkGoals(state);
  }
  return true;
}
