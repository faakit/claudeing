/**
 * Map stages (MILESTONES M2): every night the delta rects are kept clear, so the morning a stage turns a tile to
 * water nothing stands on it (old saves from before the creek bed may hold soil or placed things there; nothing new
 * can be put there). Rules in systems/valley.ts.
 */
import { valley } from '../data';
import { registerDayHook } from '../systems/dayHooks';
import { ownsPlot, plotAtTile } from '../systems/plots';
import { clearDeltaRegions } from '../systems/valley';

registerDayHook({
  id: 'map-stages-clear-delta',
  phase: 'end',
  run(state, ctx) {
    for (const map of Object.keys(valley.maps)) {
      // open farm ground to move things onto: the weed candidates (free tillable farm tiles), never land for sale
      const mine = ([x, y]: readonly [number, number]): boolean => {
        const plot = plotAtTile(x, y);
        return plot === null || ownsPlot(state, plot);
      };
      const free = map === 'farm' ? ctx.weedCandidates.filter(mine) : [];
      const res = clearDeltaRegions(state, map, free);
      if (res.note) ctx.notes.push(res.note);
    }
  },
});
