import { fish } from '../../data';
import type { GameState } from '../../state/GameState';

/** "Legends 1/4" for the Book's Fish page. Pure, so a test can fit it. */
export function legendsLine(state: GameState): string {
  const legends = fish.filter((f) => f.legend);
  const caught = legends.filter((f) => state.stats[`legend.${f.item}`]).length;
  return `Legends ${caught}/${legends.length}`;
}
