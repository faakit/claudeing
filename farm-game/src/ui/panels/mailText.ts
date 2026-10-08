import { items, npcs } from '../../data';
import type { Letter } from '../../state/GameState';

/** The list line under a letter. Pure so a test can prove it fits. */
export function letterSub(l: Letter, date: string): string {
  const flags = [!l.read ? 'New' : '', l.gift && !l.taken ? 'Gift!' : ''].filter(Boolean);
  return [date, ...flags].join('  ');
}

export const letterTitle = (l: Letter): string => `${npcs[l.from]?.name ?? l.from}: ${l.title}`;

export const giftLine = (l: Letter): string =>
  l.gift
    ? `${l.taken ? 'Was enclosed' : 'Enclosed'}: ${l.gift.qty} ${items[l.gift.item]?.name ?? l.gift.item}`
    : '';
