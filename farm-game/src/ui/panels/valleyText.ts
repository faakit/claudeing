import type { GameState } from '../../state/GameState';
import { houseRows } from '../../systems/houses';
import { valleyRows } from '../../systems/valley';
import { fitRow, measureText } from '../fontMetrics';
import { t } from '../../i18n';

/** THE VALLEY's rows in Menu > Goal ("Old Spring: work day 2 of 3"). Pure, so a test proves they fit 184 px. */
export const valleyLines = (s: GameState): string[] =>
  [...valleyRows(s), ...houseRows(s)].map((r) => {
    const row = `${r.name}: ${r.next}`;
    // a long fund ("Weir: 2500g, 60 stone, sluice gate") drops its verb before anything is cut
    const fund = `: ${t('valley.rowFund', { parts: '' })}`; // ": fund " in the current language
    const short = measureText(row) > 184 ? row.replace(fund, ': ') : row;
    return fitRow(short, 184);
  });
