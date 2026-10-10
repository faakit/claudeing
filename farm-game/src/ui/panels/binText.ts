import { displayName, parseKey, type ItemRef } from '../../systems/itemRef';

/**
 * A wanted bin row's second line: "Board 4  have 9" (said in words, not only a colour: critique 10, F1), with
 * "bin 2" only once some are in the bin.
 */
export const binWantedSub = (want: number, have: number, inBin: number): string =>
  `Board ${want}  have ${have}${inBin ? `  bin ${inBin}` : ''}`;

/** "The board wants 4 Potato.": the bin's warning when you ship what an open request asks for. */
export const boardWantsLine = (want: number, ref: ItemRef): string =>
  `The board wants ${want} ${displayName({ item: ref.item, ...(ref.of ? { of: ref.of } : {}) })}.`;

/**
 * "Kept 4 Potato for the board.": what "Ship all produce" left in the bag for open requests, by "item|of".
 * Two kinds are named; more are counted. Null when nothing was kept.
 */
export function keptLine(kept: ReadonlyMap<string, number>): string | null {
  const parts = [...kept.entries()].filter(([, n]) => n > 0);
  if (parts.length === 0) return null;
  const named = parts.map(([k, n]) => {
    const [item = '', of = ''] = k.split('|');
    return `${n} ${displayName(parseKey(`${item}|0|${of}`))}`;
  });
  // Three kinds or more: name two and count the rest (critique 10, F6).
  if (named.length > 2) return `Kept ${named.slice(0, 2).join(', ')} and more for the board.`;
  return `Kept ${named.join(' and ')} for the board.`;
}
