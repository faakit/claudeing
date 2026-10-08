import type { GameState, Order } from '../../state/GameState';
import { daysLeft } from '../../systems/orders';
import { fmt } from './format';

/** "2 days" or "last day": how long a request stays on the board. */
export const daysText = (left: number): string => (left <= 1 ? 'last day' : `${left} days`);

/**
 * An open request's second line: "Have 1/3  120g  2 days", or "... Clay's!" when the rival is after it
 * today. Pure, so a test proves it fits.
 */
export const orderSub = (state: GameState, order: Order, have: number, eyed = false): string =>
  `Have ${Math.min(have, order.qty)}/${order.qty}  ${fmt(order.reward)}g  ${eyed ? "Clay's!" : daysText(daysLeft(state, order))}`;
