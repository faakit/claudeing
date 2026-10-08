import { registerActionHandler } from '../systems/actionRegistry';
import { registerDayHook } from '../systems/dayHooks';
import { addStat } from '../systems/goals';
import { clearForage, collectForage, forageAt, spawnForage } from '../systems/forage';
import { roomFor } from '../systems/inventory';
import { sellValue } from '../systems/itemRef';
import { addXp } from '../systems/skills';

/** Wild goods lying on the ground are picked up with Action, whatever is equipped. */
registerActionHandler({
  id: 'forage',
  priority: 95,
  plan({ state, tile }) {
    const item = forageAt(state, tile.map, tile.tx, tile.ty);
    if (!item) return null;
    if (roomFor(state, item, 1) < 1) return { refusal: 'Inventory full!' };
    return {
      plan: {
        kind: 'forage',
        tx: tile.tx,
        ty: tile.ty,
        run: () => {
          const res = collectForage(state, tile.map, tile.tx, tile.ty);
          if (!res.ok) throw new Error('forage was planned but failed');
          addStat(state, 'foraged', res.qty);
          addXp(
            state,
            'foraging',
            Math.max(3, Math.round(sellValue({ item: res.item }) * 0.2 * res.qty)),
          );
          return { item: res.item, qty: res.qty, q: res.q };
        },
      },
    };
  },
});

// Wild goods wilt when the season turns, and fresh ones appear every morning.
registerDayHook({
  id: 'forage:spawn',
  phase: 'morning',
  order: 10,
  run(state, ctx) {
    if (ctx.scratch['seasonChanged']) clearForage(state);
    const spawned = spawnForage(state, ctx.forageSpots);
    // The morning after a storm the woods are full: a second helping of goods.
    if (ctx.scratch['prevWeather'] === 'storm') {
      const more = spawnForage(state, ctx.forageSpots);
      for (const [map, n] of Object.entries(more)) spawned[map] = (spawned[map] ?? 0) + n;
      ctx.notes.push('A rainbow after the storm: extra wild goods!');
    }
    const total = Object.values(spawned).reduce((a, b) => a + b, 0);
    if (total > 0)
      ctx.notes.push(
        spawned['woods'] ? 'Wild goods are growing in the woods.' : 'Wild goods have sprouted.',
      );
  },
});
