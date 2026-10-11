import { items, npcs, UNSIGNED } from '../../data';
import type { Letter } from '../../state/GameState';
import { t } from '../../i18n';
import { relocalize } from '../../i18n/dataText';

/** The list line under a letter. Pure so a test can prove it fits. */
export function letterSub(l: Letter, date: string): string {
  const flags = [!l.read ? t('mail.new') : '', l.gift && !l.taken ? t('mail.giftFlag') : ''].filter(
    Boolean,
  );
  return [date, ...flags].join('  ');
}

export const letterTitle = (l: Letter): string =>
  `${npcs[l.from]?.name ?? (l.from === UNSIGNED ? t('mail.noName') : l.from)}: ${relocalize(l.title)}`;

/** What a letter encloses: "3 Potato Seeds", or a key item by name with what comes with it. */
export function giftWhat(gift: { item: string; qty: number }): string {
  const def = items[gift.item];
  return def?.type === 'key'
    ? [def.name, ...(def.comesWith ?? []).map((w) => items[w.item]?.name ?? w.item)].join(
        t('common.and'),
      )
    : `${gift.qty} ${def?.name ?? gift.item}`;
}

export const giftLine = (l: Letter): string =>
  l.gift ? t(l.taken ? 'mail.wasEnclosed' : 'mail.enclosed', { what: giftWhat(l.gift) }) : '';
