import { addStat } from '../systems/goals';
import { displayName } from '../systems/itemRef';
import { addXp } from '../systems/skills';
import { registerPlaceableBehavior } from '../systems/placeables';
import { collectJar, jarContents, jarReady, tickJar } from '../systems/preserves';
import { toast } from '../systems/events';

/** A preserve jar turns fruit into jam and vegetables into pickles over a few mornings. */
registerPlaceableBehavior('jar', {
  onMorning: (_state, obj) => tickJar(obj),
  canPickUp: (obj) => !jarContents(obj),
  interact(state, obj) {
    const c = jarContents(obj);
    if (!c) return { kind: 'panel', panel: 'jar', id: obj.id };
    if (!jarReady(obj))
      return {
        kind: 'message',
        text: `${displayName(c.out)}: ${c.days} more day${c.days > 1 ? 's' : ''}.`,
      };
    const res = collectJar(state, obj);
    if (typeof res === 'string')
      return { kind: 'message', text: res === 'full' ? 'Inventory full!' : 'Nothing yet.' };
    addStat(state, 'preserved');
    addXp(state, 'farming', 8);
    toast(`Got ${displayName(res)}`, 'good');
    return { kind: 'message', text: '' };
  },
});
