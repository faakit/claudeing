import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { cart, items } from '../src/data';
import { buyFromCart, cartHere, cartLeft, cartPrice, cartStock } from '../src/systems/cart';
import { endDay } from '../src/systems/day';
import { countItem } from '../src/systems/inventory';
import { measureText } from '../src/ui/fontMetrics';
import { CART_INTRO, cartSub } from '../src/ui/panels/cartText';
import { newState } from './helpers';

describe('the traveling cart', () => {
  it('comes on its days only, with the same stock all day and different stock each visit', () => {
    const s = newState();
    s.time.day = 4;
    expect(cartHere(s)).toBe(false);
    expect(cartStock(s)).toEqual([]);
    s.time.day = cart.days[0]!;
    const a = cartStock(s);
    expect(a).toHaveLength(cart.slots);
    expect(cartStock(s)).toEqual(a);
    const visits = new Set<string>();
    for (const season of ['spring', 'summer', 'fall', 'winter'] as const)
      for (const d of cart.days) {
        s.time.season = season;
        s.time.day = d;
        visits.add(cartStock(s).join());
      }
    expect(visits.size).toBeGreaterThan(8);
  });

  it('never sells seeds that will not grow now, unless you have a greenhouse', () => {
    const s = newState();
    s.time.season = 'winter';
    for (const d of cart.days) {
      s.time.day = d;
      for (const id of cartStock(s)) if (items[id]?.plants) expect(id).toBe('snowpea_seed');
    }
  });

  it('sells at a premium, five of each a visit, and is announced in the morning', () => {
    const s = newState();
    s.time.day = cart.days[0]! - 1;
    const sum = endDay(s, { passedOut: false, weedCandidates: [] });
    expect(sum.notes).toContain('The traveling cart is in town today.');
    const id = cartStock(s)[0]!;
    const price = cartPrice(id);
    expect(price).toBeGreaterThanOrEqual(items[id]?.buyPrice ?? items[id]!.sellPrice!);
    s.money = price * 10;
    for (let i = 0; i < cart.limit; i++) expect(buyFromCart(s, id)).toBe('ok');
    expect(buyFromCart(s, id)).toBe('sold_out');
    expect(cartLeft(s, id)).toBe(0);
    expect(countItem(s, id)).toBe(cart.limit);
    expect(s.money).toBe(price * 10 - price * cart.limit);
  });

  it('bars and quartz cost far more than the bin pays (a shortcut, not a loop)', () => {
    for (const e of cart.stock)
      expect(cartPrice(e.item), e.item).toBeGreaterThan((items[e.item]?.sellPrice ?? 0) * 2);
  });

  it('its lines fit', () => {
    expect(measureText(CART_INTRO)).toBeLessThanOrEqual(184);
    expect(measureText(cartSub(9999, 5))).toBeLessThanOrEqual(200 - 8 - 28 - 43 - 2);
    expect(measureText('The traveling cart is here!')).toBeLessThanOrEqual(176);
  });
});

describe('the cart after critique 8 (F4)', () => {
  it('never sells what the store sells that day, nor seeds that cannot ripen in time', async () => {
    const { stockFor } = await import('../src/systems/economy');
    const { crops } = await import('../src/data');
    for (const greenhouse of [false, true])
      for (const season of ['spring', 'summer', 'fall', 'winter'] as const)
        for (const d of cart.days) {
          const s = newState();
          if (greenhouse) s.stats['project.greenhouse'] = 1;
          s.time.season = season;
          s.time.day = d;
          const store = stockFor('town_general_store', season, s);
          for (const id of cartStock(s)) {
            expect(store, `${id} ${season} ${d}`).not.toContain(id);
            const plants = items[id]?.plants;
            if (plants && !greenhouse) {
              const grow = crops[plants]!.stageDays.reduce((a, b) => a + b, 0);
              expect(grow).toBeLessThan(28 - d);
            }
          }
        }
  });

  it('a buy says what the good is for, in at most two lines', async () => {
    const { cartBought } = await import('../src/ui/panels/cartText');
    for (const e of cart.stock)
      expect(measureText(cartBought(items[e.item]!.name, e.use)), e.item).toBeLessThanOrEqual(
        186 * 2,
      );
  });
});
