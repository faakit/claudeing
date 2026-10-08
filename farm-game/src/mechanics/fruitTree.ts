import { items } from '../data';
import { toast } from '../systems/events';
import { addStat } from '../systems/goals';
import { registerPlaceableBehavior } from '../systems/placeables';
import { addXp } from '../systems/skills';
import { growTree, isGrown, pickFruit, treeDef, treeOf } from '../systems/trees';

/** Fruit trees: a sapling grows for ten mornings, then bears fruit every few days in its own season. */
registerPlaceableBehavior('fruitTree', {
  canPickUp: () => false,
  status: (obj) => (treeOf(obj).fruit > 0 ? 'ready' : isGrown(obj) ? 'idle' : 'busy'),
  sprite: (obj, def) => (isGrown(obj) ? def.sprite : 'obj_sapling'),
  onMorning(state, obj, _def, ctx) {
    if (growTree(obj, state.time.season)) ctx.notes.push('Fruit is ripe on a tree.');
    // A storm shakes ripe fruit to the ground. The forecast gives you a night to pick it first.
    if (state.weather === 'storm' && treeOf(obj).fruit > 0) {
      treeOf(obj).fruit = 0;
      ctx.notes.push('The storm blew fruit off a tree.');
    }
  },
  interact(state, obj) {
    const def = treeDef(obj);
    if (!def) return { kind: 'none' };
    if (!isGrown(obj)) {
      const left = def.growDays - treeOf(obj).age;
      return { kind: 'message', text: `Still growing: ${left} more day${left > 1 ? 's' : ''}.` };
    }
    const t = treeOf(obj);
    if (t.fruit === 0)
      return {
        kind: 'message',
        text:
          state.time.season === def.season
            ? 'No fruit yet. Check back in a day or two.'
            : `It only bears fruit in ${def.season}.`,
      };
    const took = pickFruit(state, obj);
    if (took === 0) return { kind: 'message', text: 'Inventory full!' };
    addStat(state, 'collected', took);
    addXp(state, 'farming', 3 * took);
    toast(`+${took} ${items[def.fruit]?.name}`, 'good');
    return { kind: 'message', text: '' };
  },
});
