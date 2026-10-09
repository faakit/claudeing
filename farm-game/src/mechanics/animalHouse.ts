import { items } from '../data';
import {
  collect,
  feed,
  houseOf,
  isFull,
  moveIn,
  morning,
  pet,
  speciesOf,
} from '../systems/animals';
import { toast } from '../systems/events';
import { addStat } from '../systems/goals';
import { registerPlaceableBehavior } from '../systems/placeables';
import { addXp } from '../systems/skills';
import { isWet } from '../systems/weather';

/**
 * A coop or barn. One tap does the chores in order: move in animals you carry, collect what is
 * waiting, then feed. The species (chicken, cow...) comes from the placeable's params and animals.json.
 */
registerPlaceableBehavior('animalHouse', {
  // Moving a house moves its animals (and what they made): the state is kept for the next one placed.
  canPickUp: () => true,
  keepsData: true,
  occupants(obj) {
    const sp = speciesOf(obj);
    const h = houseOf(obj);
    if (!sp || (h.n === 0 && h.ready === 0)) return null;
    const parts: string[] = [];
    if (h.n > 0) parts.push(`${h.n} ${sp.name.toLowerCase()}${h.n > 1 ? 's' : ''}`);
    if (h.ready > 0) {
      const good = items[sp.product]?.name.toLowerCase() ?? sp.product;
      const plural = h.ready > 1 && !['milk', 'wool', 'honey'].includes(sp.product);
      parts.push(`${h.ready} ${good}${plural ? 's' : ''} waiting`);
    }
    return parts.join(', ');
  },
  onMorning(state, obj, _def, ctx) {
    // Today's weather is settled before placeables wake up, so pigs know whether they can dig.
    const outdoorOk = !isWet(state.weather) && state.time.season !== 'winter';
    if (morning(obj, outdoorOk)) ctx.notes.push('Animal goods are waiting on the farm.');
  },
  interact(state, obj) {
    const sp = speciesOf(obj);
    if (!sp) return { kind: 'none' };
    const h = houseOf(obj);
    const said: string[] = [];
    const moved = moveIn(state, obj);
    if (moved > 0) {
      addStat(state, 'animalsAdded', moved);
      said.push(`${moved} ${sp.name.toLowerCase()}${moved > 1 ? 's' : ''} moved in!`);
    }
    const got = collect(state, obj);
    if (got > 0) {
      addStat(state, 'collected', got);
      addStat(state, `collected.${sp.product}`, got);
      addXp(state, 'farming', 4 * got);
      said.push(`+${got} ${items[sp.product]?.name}`);
    }
    if (h.n === 0 && said.length === 0)
      return { kind: 'message', text: `Empty. Bring a ${sp.name.toLowerCase()}.` };
    const fed = feed(state, obj);
    if (fed === 'ok') said.push('Fed!');
    else if (fed === 'no_feed' && said.length === 0)
      return { kind: 'message', text: `Needs ${h.n} ${items[sp.feed]?.name}.` };
    else if (fed === 'fed' && said.length === 0) {
      if (pet(obj)) {
        toast('You gave them a pat. They look happier!', 'good');
        return { kind: 'message', text: '' };
      }
      return { kind: 'message', text: `All fed. ${h.joy >= 3 ? 'Happy!' : 'Back tomorrow.'}` };
    }
    if (!isFull(obj) && said.length > 0) said.push('Room for more.');
    const text = said.join(' ');
    if (text) toast(text, 'good');
    return { kind: 'message', text: '' };
  },
});
