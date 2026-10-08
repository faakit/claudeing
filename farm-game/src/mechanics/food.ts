import { registerActionHandler } from '../systems/actionRegistry';
import { maxEnergy } from '../systems/energy';
import { eat } from '../systems/food';

/**
 * A dish in hand: Action eats it, wherever you face (above tools at 40, below planting and placing at 50,
 * so a dish never gets in the way of a harvest). Auto tool: none; you pick the dish, or eat from the bag.
 */
registerActionHandler({
  id: 'eat',
  priority: 45,
  plan({ state, tile, def }) {
    if (def?.type !== 'food') return null;
    if (state.energy >= maxEnergy(state)) return { refusal: "You're not hungry." };
    return {
      plan: {
        kind: 'eat',
        tx: tile.tx,
        ty: tile.ty,
        run: () => {
          eat(state, state.inventory.selected);
          return {};
        },
      },
    };
  },
});
