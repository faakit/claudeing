import { describe, expect, it } from 'vitest';
import { crops, items, shops } from '../src/data';
import { performAction, type TileInfo } from '../src/systems/actions';
import { endDay } from '../src/systems/day';
import { buyItem, buyUpgrade, shipItem, stockFor } from '../src/systems/economy';
import { maxEnergy } from '../src/systems/energy';
import { getSoil, isMature } from '../src/systems/farming';
import { countItem } from '../src/systems/inventory';
import { goalProgress } from '../src/systems/goals';
import { createInitialState, type GameState } from '../src/state/GameState';

const STORE = 'town_general_store';
const FIELD: [number, number][] = [];
for (let y = 17; y < 28; y++) for (let x = 11; x < 29; x++) FIELD.push([x, y]);
const tile = (tx: number, ty: number): TileInfo => ({
  tx,
  ty,
  kind: 'grass',
  tillable: true,
  blocked: false,
  farmland: true,
});
const POND: TileInfo = {
  tx: 0,
  ty: 0,
  kind: 'water',
  tillable: false,
  blocked: true,
  farmland: true,
};

const equipItem = (s: GameState, id: string) => {
  const i = s.inventory.slots.findIndex((x) => x?.item === id);
  if (i < 0) return false;
  s.inventory.selected = i;
  return true;
};

/** Profit per tile-day for a seed, if it can mature this season. */
function score(s: GameState, seedId: string): number {
  const crop = crops[items[seedId]!.plants!]!;
  const left = 28 - s.time.day;
  const grow = crop.stageDays.reduce((a, b) => a + b, 0);
  if (grow >= left) return -1;
  const harvests = crop.regrowDays ? 1 + Math.floor((left - grow) / crop.regrowDays) : 1;
  const revenue = items[crop.harvestItem]!.sellPrice! * harvests;
  const days = crop.regrowDays ? grow + (harvests - 1) * crop.regrowDays : grow;
  return (revenue - items[seedId]!.buyPrice!) / days;
}

/** A competent but not obsessive player: waters daily, harvests, ships, reinvests, upgrades. */
function playDay(s: GameState): void {
  // Refill whenever the can runs low.
  const refill = () => {
    equipItem(s, 'watering_can');
    if (s.water < 3) performAction(s, POND);
  };
  // 1. harvest
  for (const [x, y] of FIELD) {
    const soil = getSoil(s, x, y);
    if (soil?.crop && isMature(soil.crop)) performAction(s, tile(x, y));
  }
  // 2. ship everything sellable
  for (const [id, def] of Object.entries(items)) {
    if ((def.type === 'crop' || def.type === 'material') && countItem(s, id) > 0)
      shipItem(s, id, 999);
  }
  // 3. upgrades when comfortably affordable
  for (const up of shops[STORE]!.upgrades) {
    const price = up.levels[s.upgrades[up.id]]?.price;
    if (price !== undefined && s.money > price * 1.6) buyUpgrade(s, up);
  }
  // 4. water existing crops
  for (const [x, y] of FIELD) {
    const soil = getSoil(s, x, y);
    if (soil?.crop && !isMature(soil.crop) && !soil.watered && s.energy > 0) {
      refill();
      equipItem(s, 'watering_can');
      performAction(s, tile(x, y));
    }
  }
  // 5. buy and plant the best in-season seed with spare energy
  const stock = stockFor(STORE, s.time.season)
    .map((id) => ({ id, sc: score(s, id) }))
    .filter((e) => e.sc > 0)
    .sort((a, b) => b.sc - a.sc);
  const best = stock[0];
  if (!best) return;
  for (const [x, y] of FIELD) {
    if (s.energy < 3) break;
    const soil = getSoil(s, x, y);
    if (soil?.crop) continue;
    if (
      countItem(s, best.id) === 0 &&
      buyItem(s, STORE, best.id, Math.min(20, Math.floor(s.money / items[best.id]!.buyPrice!))) !==
        'ok'
    ) {
      // try a smaller purchase
      if (buyItem(s, STORE, best.id, 1) !== 'ok') break;
    }
    if (!soil) {
      equipItem(s, 'hoe');
      if (!performAction(s, tile(x, y)).ok) break;
    }
    // use any other leftover seed type on hand first (starting parsnips etc.)
    equipItem(s, best.id);
    if (!performAction(s, tile(x, y)).ok) continue;
    refill();
    equipItem(s, 'watering_can');
    performAction(s, tile(x, y));
  }
}

describe('balance simulation (decent player, full year)', () => {
  it('a competent farmer earns a satisfying amount and the season loop never stalls', () => {
    const s = createInitialState();
    s.rng = 42;
    const log: string[] = [];
    for (let day = 1; day <= 112; day++) {
      playDay(s);
      if (day % 14 === 0 || day === 56) {
        log.push(
          `day ${day} (${s.time.season} ${s.time.day}): gold ${s.money}, earned ${s.stats['earned'] ?? 0}, goal ${s.goalIndex}, energy max ${maxEnergy(s)}, can lv ${s.upgrades.can}`,
        );
      }
      endDay(s, { passedOut: false, weedCandidates: FIELD });
    }
    console.log(log.join('\n'));
    const prog = goalProgress(s);
    console.log('final goal:', prog?.goal.id ?? 'all done');
    expect(s.money).toBeGreaterThan(0);
    // An unlimited-patience bot should finish the year rich, but not absurdly so; real players land well below it.
    expect(s.stats['earned']).toBeGreaterThan(20000);
    expect(s.stats['earned']).toBeLessThan(400000);
  });
});
