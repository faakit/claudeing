import type { GameState } from '../../state/GameState';
import { valleyRows } from '../../systems/valley';
import { fitRow } from '../fontMetrics';

/** THE VALLEY's rows in Menu > Goal ("Old Spring: work day 2 of 3"). Pure, so a test proves they fit 184 px. */
export const valleyLines = (s: GameState): string[] =>
  valleyRows(s).map((r) => fitRow(`${r.name}: ${r.next}`, 184));
