import { t } from '../i18n';

/**
 * One-time first-run tips that teach the one-thumb gestures in play (M7). Each shows once per game (a stat
 * flag), when the player is doing the slow version of what the gesture does faster. Tests check they fit a
 * toast (186 px, 3 lines). Getters, so each read is in the current language.
 */
export const TIPS = {
  /** After the third tile tilled one at a time with Action. */
  get paint(): string {
    return t('tips.paint');
  },
  /** After the third tool change by swipe or hotbar. */
  get ring(): string {
    return t('tips.ring');
  },
};
