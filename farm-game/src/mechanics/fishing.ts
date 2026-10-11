import { tiredText } from '../systems/food';
import { registerToolAction } from '../systems/actionRegistry';
import { canAfford, spendEnergy } from '../systems/energy';
import { gameEvents } from '../systems/events';
import { hasBait, pickFish, useBait } from '../systems/fishing';
import { roomFor } from '../systems/inventory';
import { t } from '../i18n';

/** Casting the rod at water starts the reel mini-game (the UI scene runs it and pays out the catch). */
registerToolAction('fish', ({ state, tile, tool }) => {
  if (tile.kind !== 'water') return { refusal: t('fishing.castAtWater') };
  if (!canAfford(state, tool.energyCost)) return { refusal: tiredText(state) };
  const fish = pickFish(state, tile.map);
  if (!fish) return { refusal: t('fishing.nothingBites') };
  if (roomFor(state, fish.item, 1) < 1) return { refusal: t('common.inventoryFull') };
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
