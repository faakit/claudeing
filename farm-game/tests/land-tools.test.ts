import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { plots } from '../src/data';
import type { TileInfo } from '../src/systems/actions';
import { performAction } from '../src/systems/actions';
import { runDayPipeline } from '../src/systems/dayHooks';
import { biteDelay, reelSize } from '../src/systems/fishing';
import { buyUpgrade } from '../src/systems/economy';
import { shops } from '../src/data';
import { migrate } from '../src/systems/save';
import {
  buyPlot,
  ownsTile,
  plotAtTile,
  plotForSaleAt,
  signTiles,
  starterPlots,
} from '../src/systems/plots';
import { tileKey } from '../src/systems/farming';
import { equip, grass, newState } from './helpers';

/** A little world where every tile is open farmland, so area tools can see their neighbours. */
function openField(
  owned?: (tx: number, ty: number) => boolean,
): (tx: number, ty: number) => TileInfo {
  const make = (tx: number, ty: number): TileInfo => ({
    ...grass(tx, ty),
    owned: owned ? owned(tx, ty) : undefined,
    at: (x, y) => make(x, y),
  });
  return make;
}

describe('area tools', () => {
  it('a better hoe tills a line of tiles for the same energy', () => {
    const s = newState();
    s.player.facing = 'right';
    s.upgrades.hoe = 2;
    equip(s, 'hoe');
    const energy = s.energy;
    const res = performAction(s, openField()(5, 5));
    expect(res.ok && res.count).toBe(3);
    for (const x of [5, 6, 7]) expect(s.farm.tiles[tileKey(x, 5)]).toBeDefined();
    expect(s.farm.tiles[tileKey(8, 5)]).toBeUndefined();
    expect(energy - s.energy).toBe(2);
    expect(s.stats['tilled']).toBe(3);
  });

  it('a plain hoe still tills one tile', () => {
    const s = newState();
    equip(s, 'hoe');
    performAction(s, openField()(5, 5));
    expect(Object.keys(s.farm.tiles)).toHaveLength(1);
  });

  it('a line stops at unowned land and at tilled soil', () => {
    const s = newState();
    s.player.facing = 'right';
    s.upgrades.hoe = 3;
    equip(s, 'hoe');
    const field = openField((tx) => tx <= 6);
    performAction(s, field(5, 5));
    expect(Object.keys(s.farm.tiles).sort()).toEqual([tileKey(5, 5), tileKey(6, 5)]);
  });

  it('a bigger can waters a line, limited by the water left', () => {
    const s = newState();
    s.player.facing = 'down';
    s.upgrades.hoe = 2;
    equip(s, 'hoe');
    s.player.facing = 'down';
    performAction(s, openField()(5, 5)); // tills (5,5),(5,6),(5,7)
    s.upgrades.can = 2;
    s.water = 2;
    equip(s, 'watering_can');
    const res = performAction(s, openField()(5, 5));
    expect(res.ok && res.count).toBe(2);
    expect(s.water).toBe(0);
    expect(s.farm.tiles[tileKey(5, 7)]?.watered).toBe(false);
  });
});

describe('land plots', () => {
  it('you start with the free plot only; others sell for gold', () => {
    const s = newState();
    expect(s.plots).toEqual(starterPlots());
    const [x, y] = plots['home']!.rect;
    expect(ownsTile(s, x, y)).toBe(true);
    const [wx, wy] = plots['west']!.rect;
    expect(ownsTile(s, wx, wy)).toBe(false);
    expect(buyPlot(s, 'west')).toBe('no_money');
    s.money = 5000;
    expect(buyPlot(s, 'west')).toBe('ok');
    expect(buyPlot(s, 'west')).toBe('owned');
    expect(s.money).toBe(5000 - plots['west']!.price);
    expect(ownsTile(s, wx, wy)).toBe(true);
    expect(buyPlot(s, 'nope')).toBe('unknown');
  });

  it('tilling on unowned land is refused with a reason', () => {
    const s = newState();
    equip(s, 'hoe');
    const res = performAction(s, { ...grass(5, 5), owned: false });
    expect(res).toMatchObject({ ok: false });
    expect(!res.ok && res.message).toMatch(/land/);
    expect(Object.keys(s.farm.tiles)).toHaveLength(0);
  });

  it('signs belong to plots still for sale and disappear once bought', () => {
    const s = newState();
    const sign = plots['east']!.sign!;
    expect(plotForSaleAt(s, sign[0], sign[1])).toBe('east');
    expect(signTiles(s)).toHaveLength(Object.keys(plots).length - 1);
    s.money = 9999;
    buyPlot(s, 'east');
    expect(plotForSaleAt(s, sign[0], sign[1])).toBeNull();
    expect(plotAtTile(sign[0], sign[1])).toBeNull();
  });

  it('weeds only grow on land you own', () => {
    const s = newState();
    const owned = plots['home']!.rect;
    const candidates: [number, number][] = [
      [owned[0], owned[1]],
      [plots['east']!.rect[0], plots['east']!.rect[1]],
    ];
    const ctx = {
      passedOut: false,
      weedCandidates: candidates,
      forageSpots: {},
      notes: [],
      scratch: {},
      summary: {
        endedDay: 1,
        endedSeason: 'spring' as const,
        shipped: [],
        total: 0,
        withered: 0,
        passedOut: false,
        weather: 'sunny' as const,
        yearEnd: false,
        notes: [],
      },
    };
    for (let i = 0; i < 12; i++) runDayPipeline(s, ctx);
    const unowned = tileKey(plots['east']!.rect[0], plots['east']!.rect[1]);
    expect(s.farm.weeds[unowned]).toBeUndefined();
  });

  it('plot rectangles never overlap (validated at load)', () => {
    const seen = new Set<string>();
    for (const p of Object.values(plots)) {
      const [x, y, w, h] = p.rect;
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) {
          expect(seen.has(`${i},${j}`)).toBe(false);
          seen.add(`${i},${j}`);
        }
    }
  });

  it('v4 saves keep every plot they already used', () => {
    const s = newState();
    const east = plots['east']!.rect;
    s.farm.tiles[tileKey(east[0], east[1])] = { watered: false, crop: null } as never;
    const raw = JSON.parse(JSON.stringify({ ...s, version: 4 }));
    delete raw.plots;
    raw.upgrades = { can: 1, stamina: 0 };
    const out = migrate(raw);
    expect(out.plots).toContain('east');
    expect(out.plots).toContain('home');
    expect(out.plots).not.toContain('lowland');
    expect(out.upgrades).toMatchObject({ can: 1, hoe: 0, rod: 0 });
  });

  it('garbage in the plots list is dropped, starters are always owned', () => {
    const s = newState();
    const raw = JSON.parse(JSON.stringify(s));
    raw.plots = ['ghost', 7, 'west', 'west'];
    const out = migrate(raw);
    expect(out.plots.sort()).toEqual(['home', 'west']);
  });
});

describe('tool upgrades in the shop and on the water', () => {
  it('hoe and rod upgrades can be bought level by level', () => {
    const s = newState();
    s.money = 100000;
    const hoe = shops['town_general_store']!.upgrades.find((u) => u.id === 'hoe')!;
    expect(buyUpgrade(s, hoe)).toBe('ok');
    expect(s.upgrades.hoe).toBe(1);
    for (let i = 0; i < 5; i++) buyUpgrade(s, hoe);
    expect(s.upgrades.hoe).toBe(hoe.levels.length);
    expect(buyUpgrade(s, hoe)).toBe('maxed');
  });

  it('a better rod widens the catch zone and shortens the wait', () => {
    const s = newState();
    const base = reelSize(s, 0.5, false);
    s.upgrades.rod = 3;
    expect(reelSize(s, 0.5, false)).toBeGreaterThan(base);
    expect(biteDelay(0.5, false, 3)).toBeLessThan(biteDelay(0.5, false, 0));
  });
});
