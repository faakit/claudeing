import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { collections, crops, game, items } from '../src/data';
import { endDay } from '../src/systems/day';
import { buyItem, shipStack, stockFor } from '../src/systems/economy';
import { addItem } from '../src/systems/inventory';
import { orderCandidates } from '../src/systems/orders';
import { newState } from './helpers';

const RARE = ['strawberry', 'blueberry', 'cranberry', 'snowpea'];

describe('second-year content: rare crops', () => {
  it('rare seeds are on the shelf only once the Seed Exchange is finished', () => {
    const s = newState();
    expect(stockFor('town_general_store', 'spring', s)).not.toContain('strawberry_seed');
    s.money = 1000;
    expect(buyItem(s, 'town_general_store', 'strawberry_seed', 1)).not.toBe('ok');
    s.stats['project.seedexchange'] = 1;
    expect(stockFor('town_general_store', 'spring', s)).toContain('strawberry_seed');
    expect(buyItem(s, 'town_general_store', 'strawberry_seed', 1)).toBe('ok');
  });

  it('one rare crop per season, each regrows, and none beats the best one-shot crop per tile-day', () => {
    const seasons = RARE.map((id) => crops[id]!.seasons[0]);
    expect(new Set(seasons).size).toBe(4);
    const perDay = (id: string) => {
      const c = crops[id]!;
      const grow = c.stageDays.reduce((a, b) => a + b, 0);
      const left = game.seasonLength - 1;
      const harvests = 1 + Math.floor((left - grow) / (c.regrowDays ?? 99));
      const seed = Object.values(items).find((d) => d.plants === id)!.buyPrice!;
      return (items[c.harvestItem]!.sellPrice! * harvests - seed) / left;
    };
    for (const id of RARE) {
      expect(crops[id]!.regrowDays, id).toBeGreaterThan(0);
      expect(perDay(id), id).toBeGreaterThan(5);
      expect(perDay(id), id).toBeLessThan(18); // melon and pumpkin earn about 18 a tile-day
    }
  });

  it('the board never asks for a rare crop before you can grow it', () => {
    const s = newState();
    for (const season of ['spring', 'summer', 'fall', 'winter'] as const) {
      s.time.season = season;
      expect(
        orderCandidates(s).some((r) => RARE.includes(r.item)),
        season,
      ).toBe(false);
    }
    s.stats['project.seedexchange'] = 1;
    s.time.season = 'summer';
    // ...and, like every crop, only once some is growing (critique 6, F3).
    expect(orderCandidates(s).some((r) => r.item === 'blueberry')).toBe(false);
    s.farm.tiles['10,17'] = {
      watered: false,
      crop: { cropId: 'blueberry', stage: 3, daysInStage: 0, regrow: false }, // ripe in 3 days
    };
    expect(orderCandidates(s).some((r) => r.item === 'blueberry')).toBe(true);
  });

  it('has its own Book page, and gold-quality sales are counted when paid', () => {
    expect(collections['rare']?.items).toEqual(RARE);
    const s = newState();
    addItem(s, { item: 'melon', q: 2 }, 3);
    addItem(s, { item: 'melon', q: 1 }, 2);
    shipStack(s, { item: 'melon', q: 2 }, 3);
    shipStack(s, { item: 'melon', q: 1 }, 2);
    endDay(s, { passedOut: false, weedCandidates: [] });
    expect(s.stats['goldShipped']).toBe(3);
  });
});
