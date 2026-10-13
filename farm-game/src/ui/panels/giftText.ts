import type { Reaction } from '../../systems/friendship';
import { t } from '../../i18n';

/** Gift list hint for a reaction the player has already seen (dictionary keys). */
const KNOWN_KEY = {
  love: 'gift.loves',
  like: 'gift.likes',
  neutral: 'gift.neutral',
  dislike: 'gift.dislikes',
} as const satisfies Record<Reaction, string>;
export const knownText = (r: Reaction): string => t(KNOWN_KEY[r]);

/** The line under an item in the gift list. Pure so a test can prove it fits. */
export const giftSub = (have: number, known: Reaction | null): string =>
  t('gift.sub', { n: have, known: known ? knownText(known) : t('gift.notTried') });

/**
 * The short line beside the Gift button: how many gifts the week still takes, or when the next one can be given
 * (QA round: two a week). Pure, so a test proves both widths fit.
 */
export const giftNote = (block: 'today' | 'week' | null, left: number, narrow: boolean): string => {
  if (block === 'today') return t(narrow ? 'gift.tomorrow' : 'common.backTomorrow');
  if (block === 'week') return t(narrow ? 'gift.nextWeekShort' : 'gift.nextWeek');
  if (left === 1) return t(narrow ? 'gift.oneLeftShort' : 'gift.oneLeft');
  return t(narrow ? 'gift.perWeekShort' : 'gift.perWeek');
};
