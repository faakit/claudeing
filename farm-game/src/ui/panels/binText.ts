import { displayName, parseKey, type ItemRef } from '../../systems/itemRef';
import { t } from '../../i18n';

/**
 * A wanted bin row's second line: "Board 4  have 9" (said in words, not only a colour: critique 10, F1), with
 * "bin 2" only once some are in the bin.
 */
export const binWantedSub = (want: number, have: number, inBin: number): string =>
  // fits the row, three buttons (critique 11, F5)
  inBin ? t('bin.wantedInBin', { want, inBin }) : t('bin.wanted', { want, have });

/** "The board wants 4 Potato.": the bin's warning when you ship what an open request asks for. */
export const boardWantsLine = (want: number, ref: ItemRef): string =>
  t('bin.boardWants', {
    n: want,
    item: displayName({ item: ref.item, ...(ref.of ? { of: ref.of } : {}) }),
  });

/**
 * "Kept 4 Potato for the board.": what "Ship all produce" left in the bag for open requests, by "item|of".
 * Two kinds are named; more are counted. Null when nothing was kept.
 */
export function keptLine(
  kept: ReadonlyMap<string, number>,
  special?: { kind: string; giver: string; requests: number },
): string | null {
  const parts = [...kept.entries()].filter(([, n]) => n > 0);
  if (parts.length === 0) return null;
  // One good kept for both the requests and the special: say each part (critique 11, F5).
  const sp = special ? (kept.get(special.kind) ?? 0) : 0;
  if (special && parts.length === 1 && sp > special.requests) {
    const [item = '', of = ''] = special.kind.split('|');
    const name = displayName(parseKey(`${item}|0|${of}`));
    const forSpecial = sp - special.requests;
    return special.requests > 0
      ? t('bin.keptBoth', { n: special.requests, item: name, m: forSpecial, giver: special.giver })
      : t('bin.keptSpecial', { n: forSpecial, item: name, giver: special.giver });
  }
  const named = parts.map(([k, n]) => {
    const [item = '', of = ''] = k.split('|');
    return `${n} ${displayName(parseKey(`${item}|0|${of}`))}`;
  });
  // Three kinds or more: name two and count the rest (critique 10, F6).
  if (named.length > 2) return t('bin.keptMore', { items: named.slice(0, 2).join(', ') });
  return t('bin.kept', { items: named.join(t('common.and')) });
}
