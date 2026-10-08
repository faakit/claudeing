import { registerDayHook } from '../systems/dayHooks';
import { registerPlaceableBehavior } from '../systems/placeables';
import { depositFeed, feedFromSilos, siloCap, siloTotal } from '../systems/silo';
import { toast } from '../systems/events';

/** A feed silo: one tap pours every feed in the bag into it; overnight it feeds any hungry house. */
registerPlaceableBehavior('silo', {
  canPickUp: () => true,
  keepsData: true,
  interact(state, obj) {
    const n = depositFeed(state, obj);
    if (n > 0) {
      toast(`Stored ${n} feed. Silo ${siloTotal(obj)}/${siloCap(obj)}.`, 'good');
      return { kind: 'message', text: '' };
    }
    return { kind: 'message', text: `Silo ${siloTotal(obj)}/${siloCap(obj)} feed. Bring feed.` };
  },
});

// Before animals wake up (placed objects run at order 30), hungry houses eat from the silo.
registerDayHook({
  id: 'animals:silo',
  phase: 'morning',
  order: 25,
  run(state, ctx) {
    const n = feedFromSilos(state);
    if (n > 0) ctx.notes.push(`The silo fed ${n} animal house${n > 1 ? 's' : ''}.`);
  },
});
