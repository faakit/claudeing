import { registerActionHandler } from '../systems/actionRegistry';
import { maxEnergy } from '../systems/energy';
import { eat, tooFullFor } from '../systems/food';
import type { GameState } from '../state/GameState';

const stackItem = (state: GameState): string | undefined =>
  state.inventory.slots[state.inventory.selected]?.item;

/**
 * A dish in hand: Action eats it, wherever you face (above tools at 40, below planting and placing at 50,
 * so a dish never gets in the way of a harvest). Auto tool: none; you pick the dish, or eat from the bag.
 */
registerActionHandler({
  id: 'eat',
  priority: 45,
  plan({ state, tile, def }) {
    if (def?.type !== 'food') return null;
    if (state.energy >= maxEnergy(state) || tooFullFor(state, def && stackItem(state)))
      return { refusal: "You're not hungry enough." };
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
