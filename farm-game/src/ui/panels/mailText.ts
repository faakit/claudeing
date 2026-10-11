import { items, npcs } from '../../data';
import type { Letter } from '../../state/GameState';

/** The list line under a letter. Pure so a test can prove it fits. */
export function letterSub(l: Letter, date: string): string {
  const flags = [!l.read ? 'New' : '', l.gift && !l.taken ? 'Gift!' : ''].filter(Boolean);
  return [date, ...flags].join('  ');
}

export const letterTitle = (l: Letter): string => `${npcs[l.from]?.name ?? l.from}: ${l.title}`;

/** What a letter encloses: "3 Potato Seeds", or a key item by name with what comes with it. */
export function giftWhat(gift: { item: string; qty: number }): string {
  const def = items[gift.item];
  return def?.type === 'key'
    ? [def.name, ...(def.comesWith ?? []).map((w) => items[w.item]?.name ?? w.item)].join(' and ')
    : `${gift.qty} ${def?.name ?? gift.item}`;
}

export const giftLine = (l: Letter): string =>
  l.gift ? `${l.taken ? 'Was enclosed' : 'Enclosed'}: ${giftWhat(l.gift)}` : '';
