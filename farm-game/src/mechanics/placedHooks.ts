import { registerDayHook } from '../systems/dayHooks';
import { forEachPlaced } from '../systems/placeables';

// Placed objects take part in the day rollover through their behavior's optional hooks.
registerDayHook({
  id: 'placeables:before-growth',
  phase: 'pre-growth',
  run(state, ctx) {
    forEachPlaced(state, (obj, def, behavior) => behavior.beforeGrowth?.(state, obj, def, ctx));
  },
});

registerDayHook({
  id: 'placeables:morning',
  phase: 'morning',
  order: 30,
  run(state, ctx) {
    forEachPlaced(state, (obj, def, behavior) => behavior.onMorning?.(state, obj, def, ctx));
  },
});
