import { fmt } from './format';

/** The line under the cart's title. */
export const CART_INTRO = 'Here today only. Five of each.';

/**
 * A cart row's second line: "900g  Market Road" (what it is for, before you pay: critique 9, F7), or
 * "300g  5 left" for a good with no tag. Pure, so a test can fit it.
 */
export const cartSub = (price: number, left: number, tag?: string, limit = 5): string =>
  left <= 0
    ? 'Sold out'
    : tag && left >= limit
      ? `${fmt(price)}g  ${tag}`
      : `${fmt(price)}g  ${left} left`; // once you bought some, how many remain matters more

/** The toast after a buy: what it was, and what it is for. */
export const cartBought = (name: string, use?: string): string =>
  use ? `Bought ${name}. ${use}` : `Bought ${name}.`;
