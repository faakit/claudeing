import { fmt } from './format';

/** The line under the cart's title. */
export const CART_INTRO = 'Here today only. Five of each.';

/** A cart row's second line: "300g  5 left". Pure, so a test can fit it. */
export const cartSub = (price: number, left: number): string =>
  left > 0 ? `${fmt(price)}g  ${left} left` : 'Sold out';
