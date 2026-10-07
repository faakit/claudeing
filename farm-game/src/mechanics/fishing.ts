import { registerToolAction } from '../systems/actionRegistry';
import { canAfford, spendEnergy } from '../systems/energy';
import { gameEvents } from '../systems/events';
import { hasBait, pickFish, useBait } from '../systems/fishing';
import { roomFor } from '../systems/inventory';

/** Casting the rod at water starts the reel mini-game (the UI scene runs it and pays out the catch). */
registerToolAction('fish', ({ state, tile, tool }) => {
  if (tile.kind !== 'water') return { refusal: 'Cast at the water.' };
  if (!canAfford(state, tool.energyCost)) return { refusal: 'Too tired! Go to bed.' };
  const fish = pickFish(state, tile.map);
  if (!fish) return { refusal: 'Nothing bites here right now.' };
  if (roomFor(state, fish.item, 1) < 1) return { refusal: 'Inventory full!' };
  return {
    plan: {
      kind: 'cast',
      tx: tile.tx,
      ty: tile.ty,
      run: () => {
        spendEnergy(state, tool.energyCost);
        const bait = hasBait(state) && useBait(state);
        gameEvents.emit('startFishing', { map: tile.map, fish: fish.item, bait });
        return { fishing: true };
      },
    },
  };
});
