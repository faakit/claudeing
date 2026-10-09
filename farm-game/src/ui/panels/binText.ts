import { displayName, parseKey, type ItemRef } from '../../systems/itemRef';

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
  if (parts.length > 2) return `Kept ${parts.reduce((t, [, n]) => t + n, 0)} goods for the board.`;
  const named = parts.map(([k, n]) => {
    const [item = '', of = ''] = k.split('|');
    return `${n} ${displayName(parseKey(`${item}|0|${of}`))}`;
  });
  return `Kept ${named.join(' and ')} for the board.`;
}
