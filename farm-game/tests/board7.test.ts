import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { items } from '../src/data';
import { CROP_WAIT, cropReadyIn, generateOrders, orderCandidates } from '../src/systems/orders';
import { absoluteDay } from '../src/systems/time';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';

const field = (s: GameState, cropId: string, stage: number, n = 4, row = 16) => {
  for (let i = 0; i < n; i++)
    s.farm.tiles[`${9 + i},${row}`] = {
      watered: false,
      crop: { cropId, stage, daysInStage: 0, regrow: false },
    };
};

describe('the board after critique 7', () => {
  it('F1: a crop planted yesterday is not asked for; one ripening soon is, and the request waits for it', () => {
    const s = newState();
    s.time.day = 2;
    field(s, 'cauliflower', 0); // 10 days to go
    expect(orderCandidates(s).some((r) => r.item === 'cauliflower')).toBe(false);
    const t = newState();
    field(t, 'potato', 3); // the last 2 days
    expect(cropReadyIn(t).get('potato')).toBe(2);
    expect(cropReadyIn(t).get('potato')).toBeLessThanOrEqual(CROP_WAIT);
    for (let seed = 1; seed < 30; seed++) {
      t.rng = seed;
      for (const o of generateOrders(t, 6))
        if (o.item.startsWith('potato|'))
          expect(o.until).toBeGreaterThanOrEqual(absoluteDay(t) + 3);
    }
  });

  it('F3: what you grow and make is asked for far more often than fish and forage', () => {
    let farm = 0;
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = newState();
      s.rng = seed;
      s.time.day = 10;
      field(s, 'potato', 4, 1); // ripe now
      field(s, 'parsnip', 3, 1, 17);
      for (const o of generateOrders(s)) {
        total += 1;
        if (items[o.item.split('|')[0]!]?.type === 'crop') farm += 1;
      }
    }
    // Two crops among a dozen fish and wild goods: weighted, they are about a third of requests.
    expect(farm / total).toBeGreaterThan(0.25);
  });
});

describe('specials after critique 7', () => {
  it('F4: the special keeps back what a same-item request needs, and never repeats at once', async () => {
    const { giveToSpecial, makeSpecial, specialCandidates, specialGiveCount } =
      await import('../src/systems/specials');
    const { specials } = await import('../src/data');
    const { addItem, countItem } = await import('../src/systems/inventory');
    const { measureText } = await import('../src/ui/fontMetrics');
    const s = newState();
    const def = specials.find((d) => d.item === 'cauliflower')!;
    s.special = makeSpecial(s, def);
    addItem(s, 'cauliflower', 5);
    expect(specialGiveCount(s, 3)).toBe(2);
    expect(specialGiveCount(s, 9)).toBe(5); // keeping everything would give nothing: give all
    giveToSpecial(s, 3);
    expect(countItem(s, 'cauliflower')).toBe(3);
    // Finish it: the same special is not posted again that season.
    addItem(s, 'cauliflower', 99);
    giveToSpecial(s);
    expect(s.special).toBeNull();
    s.time.season = 'spring';
    expect(specialCandidates(s).some((d) => d.id === def.id)).toBe(false);
    expect(measureText('Give 99')).toBeLessThanOrEqual(36);
  });
});

describe('critique 7 small fixes', () => {
  it('F7/F9: the legends tally and the statue line fit; bench lines say why there is no sit', async () => {
    const { measureText } = await import('../src/ui/fontMetrics');
    const { legendsLine } = await import('../src/ui/panels/bookText');
    const { repeatNow } = await import('../src/ui/panels/projectText');
    const { projects } = await import('../src/data');
    const s = newState();
    expect(legendsLine(s)).toBe('Legends 0/4');
    s.stats['legend.sun_carp'] = 1;
    expect(legendsLine(s)).toBe('Legends 1/4');
    expect(measureText(legendsLine(s))).toBeLessThanOrEqual(80);
    const p = projects['statue']!;
    expect(repeatNow(p, 2)).toBe('+2%');
    expect(repeatNow(p, 9)).toBe('+5%');
    expect(measureText(`When done: ${p.reward} Now +5%.`)).toBeLessThanOrEqual(184 * 2);
    const { interactWith, placeObject } = await import('../src/systems/placeables');
    const { maxEnergy } = await import('../src/systems/energy');
    s.energy = maxEnergy(s) - 5;
    const bench = placeObject(s, 'farm', 4, 4, 'garden_bench');
    expect(interactWith(s, bench)).toMatchObject({
      text: expect.stringMatching(/^Sit when tired/),
    });
  });
});

it('F2: a day you fill a request, Clay stays home', async () => {
  const { deliverOrder, ensureOrders } = await import('../src/systems/orders');
  const { rivalNotice, rivalPicks } = await import('../src/systems/rival');
  const { addItem } = await import('../src/systems/inventory');
  const { measureText } = await import('../src/ui/fontMetrics');
  const s = newState();
  s.time.day = 9;
  ensureOrders(s);
  for (const o of s.orders.list) {
    o.from = absoluteDay(s) - 1;
    o.until = absoluteDay(s);
  }
  expect(rivalPicks(s).length).toBe(1);
  const o = s.orders.list[0]!;
  addItem(s, o.item.split('|')[0]!, o.qty);
  expect(deliverOrder(s, o.id)).toBe('ok');
  expect(rivalPicks(s)).toEqual([]);
  expect(rivalNotice(s)).toMatch(/stays home: you won today/);
  expect(measureText(rivalNotice(s))).toBeLessThanOrEqual(184);
});
