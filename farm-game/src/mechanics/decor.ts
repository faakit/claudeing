import { maxEnergy } from '../systems/energy';
import { gameEvents, toast } from '../systems/events';
import { ARM_MS, pickupNow, registerPlaceableBehavior } from '../systems/placeables';
import { absoluteDay } from '../systems/time';
import { t } from '../i18n';

// Decorations mostly just look nice. Interact names them; a second tap picks them up, so a fence you
// walk past is never lost to a stray tap, and rearranging the farm is two taps per piece. A few do a little
// more: a bench (`rest`) gives a sit-down once a day, a scarecrow (`radius`) keeps crows off nearby crops.
/** When the player last sat down (runtime only): mashing Interact must not lift the bench. */
let satAt = -Infinity;

registerPlaceableBehavior('decor', {
  interact(state, _obj, def) {
    const rest = Number(def.params['rest'] ?? 0);
    const today = absoluteDay(state);
    // The sit is kept until it would give its full worth (critique 6, F7).
    if (
      rest > 0 &&
      state.stats['rested.day'] !== today &&
      maxEnergy(state) - state.energy >= rest
    ) {
      state.stats['rested.day'] = today;
      state.energy += rest;
      gameEvents.emit('energyChanged', undefined);
      toast(t('decor.sit', { n: rest }), 'good');
      satAt = pickupNow();
      return { kind: 'message', text: '' };
    }
    if (rest > 0 && pickupNow() - satAt <= ARM_MS)
      return { kind: 'message', text: t('decor.rested'), arm: false };
    // Say why there is no sit, so the "tap again to pick up" that follows is a choice (critique 7, F5).
    if (rest > 0)
      return {
        kind: 'message',
        text:
          state.stats['rested.day'] === today ? t('decor.restedToday') : t('decor.sitWhenTired', { n: rest }),
      };
    return { kind: 'message', text: def.name };
  },
  canPickUp: () => true,
});
