import { maxEnergy } from '../systems/energy';
import { gameEvents, toast } from '../systems/events';
import { registerPlaceableBehavior } from '../systems/placeables';
import { absoluteDay } from '../systems/time';

// Decorations mostly just look nice. Interact names them; a second tap picks them up, so a fence you
// walk past is never lost to a stray tap, and rearranging the farm is two taps per piece. A few do a little
// more: a bench (`rest`) gives a sit-down once a day, a scarecrow (`radius`) keeps crows off nearby crops.
registerPlaceableBehavior('decor', {
  interact(state, _obj, def) {
    const rest = Number(def.params['rest'] ?? 0);
    const today = absoluteDay(state);
    if (rest > 0 && state.stats['rested.day'] !== today && state.energy < maxEnergy(state)) {
      state.stats['rested.day'] = today;
      const gain = Math.min(rest, maxEnergy(state) - state.energy);
      state.energy += gain;
      gameEvents.emit('energyChanged', undefined);
      toast(`You sit a while. +${gain} energy.`, 'good');
      return { kind: 'message', text: '' };
    }
    return { kind: 'message', text: def.name };
  },
  canPickUp: () => true,
});
