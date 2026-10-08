import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { crops, items, plots, projects } from '../src/data';
import { performAction, type TileInfo } from '../src/systems/actions';
import { buyItem, stockFor } from '../src/systems/economy';
import { checkPlant, getSoil, killOutOfSeason, till } from '../src/systems/farming';
import { addItem } from '../src/systems/inventory';
import { buyPlot, inGreenhouse, ownsGreenhouse, ownsTile } from '../src/systems/plots';
import type { GameState } from '../src/state/GameState';
import { equip, grass, newState } from './helpers';

const [gx, gy, gw, gh] = plots['greenhouse']!.rect;
const inside: TileInfo = { ...grass(gx, gy), owned: true };
const outside: TileInfo = { ...grass(10, 17), owned: true };

/** Finish the greenhouse project (progress lives in stats). */
const build = (s: GameState) => (s.stats['project.greenhouse'] = 1);

describe('greenhouse', () => {
  it('is a town project that comes after the library and unlocks a farm plot', () => {
    expect(projects['greenhouse']?.after).toBe('library');
    expect(plots['greenhouse']?.project).toBe('greenhouse');
    expect(gw * gh).toBe(32);
  });

  it('cannot be bought at a sign or tilled before it is built', () => {
    const s = newState();
    s.money = 99999;
    expect(buyPlot(s, 'greenhouse')).toBe('unknown');
    expect(ownsTile(s, gx, gy)).toBe(false);
    expect(inGreenhouse(s, gx, gy)).toBe(false);
    build(s);
    expect(ownsTile(s, gx, gy)).toBe(true);
    expect(inGreenhouse(s, gx, gy)).toBe(true);
    expect(inGreenhouse(s, 10, 17)).toBe(false);
  });

  it('grows any crop in any season, and nothing in it withers', () => {
    const s = newState();
    build(s);
    s.time.season = 'winter';
    till(s, gx, gy);
    till(s, 10, 17);
    expect(checkPlant(s, gx, gy, 'melon')).toBe('ok');
    expect(checkPlant(s, 10, 17, 'melon')).toBe('out_of_season');
    addItem(s, 'melon_seed', 2);
    equip(s, 'melon_seed');
    s.time.day = 27; // late in the season: fine under glass
    expect(performAction(s, inside)).toMatchObject({ ok: true, kind: 'plant' });
    expect(performAction(s, outside)).toMatchObject({ ok: false });
    s.time.season = 'spring';
    expect(killOutOfSeason(s)).toBe(0);
    expect(getSoil(s, gx, gy)?.crop?.cropId).toBe('melon');
  });

  it('once built, the shop sells every season’s seeds', () => {
    const s = newState();
    s.time.season = 'winter';
    expect(stockFor('town_general_store', 'winter', s)).not.toContain('melon_seed');
    build(s);
    expect(ownsGreenhouse(s)).toBe(true);
    expect(stockFor('town_general_store', 'winter', s)).toContain('melon_seed');
    s.money = 1000;
    expect(buyItem(s, 'town_general_store', 'pumpkin_seed', 1)).toBe('ok');
  });

  it('a full greenhouse is a real winter income, but not a runaway one', () => {
    const perTileDay = Math.max(
      ...Object.values(crops).map((c) => {
        const days = c.stageDays.reduce((a, b) => a + b, 0);
        return (items[c.harvestItem]!.sellPrice! * c.harvestQuantity) / days;
      }),
    );
    const perDay = gw * gh * perTileDay;
    expect(perDay).toBeGreaterThan(400);
    expect(perDay).toBeLessThan(1200);
  });
});
