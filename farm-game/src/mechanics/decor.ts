import { registerPlaceableBehavior } from '../systems/placeables';

// Decorations do nothing but look nice. Interact names them; a second tap picks them up, so a fence you
// walk past is never lost to a stray tap, and rearranging the farm is two taps per piece.
registerPlaceableBehavior('decor', {
  interact: (_state, _obj, def) => ({ kind: 'message', text: def.name }),
  canPickUp: () => true,
});
