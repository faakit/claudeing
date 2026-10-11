import type { GameState, Order } from '../../state/GameState';
import { daysLeft } from '../../systems/orders';
import { measureText } from '../fontMetrics';
import { fmtGold, t } from '../../i18n';
import { rivalName } from '../../systems/rival';

/** "2 days" or "last day": how long a request stays on the board. */
export const daysText = (left: number): string =>
  left <= 1 ? t('board.lastDay') : t('board.days', { n: left });

/**
 * An open request's second line: "Have 1/3  120g  2 days", or "... Clay's!" when the rival is after it
 * today. Pure, so a test proves it fits.
 */
export function orderSub(state: GameState, order: Order, have: number, eyed = false): string {
  const when = eyed ? t('board.eyed', { name: rivalName() }) : daysText(daysLeft(state, order));
  const tail = `${Math.min(have, order.qty)}/${order.qty}  ${fmtGold(order.reward)}  ${when}`;
  // A four-digit reward would cut "last day" off the row: drop the word "Have" instead (critique 10, F6).
  const full = t('board.have', { tail });
  return measureText(full) <= ORDER_SUB_PX ? full : tail;
}

/** Text room on a board request row (200 px sheet, a 36 px Give button). */
export const ORDER_SUB_PX = 123;
