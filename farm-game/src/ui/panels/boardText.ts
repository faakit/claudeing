import type { GameState, Order } from '../../state/GameState';
import { daysLeft } from '../../systems/orders';
import { fmt } from './format';
import { measureText } from '../fontMetrics';

/** "2 days" or "last day": how long a request stays on the board. */
export const daysText = (left: number): string => (left <= 1 ? 'last day' : `${left} days`);

/**
 * An open request's second line: "Have 1/3  120g  2 days", or "... Clay's!" when the rival is after it
 * today. Pure, so a test proves it fits.
 */
export function orderSub(state: GameState, order: Order, have: number, eyed = false): string {
  const tail = `${Math.min(have, order.qty)}/${order.qty}  ${fmt(order.reward)}g  ${eyed ? "Clay's!" : daysText(daysLeft(state, order))}`;
  // A four-digit reward would cut "last day" off the row: drop the word "Have" instead (critique 10, F6).
  return measureText(`Have ${tail}`) <= ORDER_SUB_PX ? `Have ${tail}` : tail;
}

/** Text room on a board request row (200 px sheet, a 36 px Give button). */
export const ORDER_SUB_PX = 123;
