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

/** The short line beside the Gift button. Pure, so a test proves both widths fit. */
export const giftNote = (can: boolean, narrow: boolean): string =>
  t(can ? (narrow ? 'gift.oneADayShort' : 'gift.oneADay') : narrow ? 'gift.tomorrow' : 'common.backTomorrow');
