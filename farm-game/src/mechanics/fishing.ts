import { tiredText } from '../systems/food';
import { registerActionHandler, registerToolAction } from '../systems/actionRegistry';
import type { Planned, TileInfo } from '../systems/actionTypes';
import { canAfford, spendEnergy } from '../systems/energy';
import { gameEvents } from '../systems/events';
import { baitOf, currentBait, pickFish, useBait } from '../systems/fishing';
import { roomFor } from '../systems/inventory';
import type { GameState } from '../state/GameState';
import { tools } from '../data';
import { t } from '../i18n';

/**
 * Casting at water starts the reel mini-game (the UI scene runs it and pays out the catch). Every cast needs a bait
 * and uses one (owner, bait round): the bait in hand, else the one used last, else the plainest you carry.
 */
function castPlan(state: GameState, tile: TileInfo, energyCost: number): NonNullable<Planned> {
  if (tile.kind !== 'water') return { refusal: t('fishing.castAtWater') };
  const bait = currentBait(state);
  if (!bait) return { refusal: t('fishing.needBait') };
  if (!canAfford(state, energyCost)) return { refusal: tiredText(state) };
  const fish = pickFish(state, tile.map, bait);
  if (!fish) return { refusal: t('fishing.nothingBites') };
  if (roomFor(state, fish.item, 1) < 1) return { refusal: t('common.inventoryFull') };
  return {
    plan: {
      kind: 'cast',
      tx: tile.tx,
      ty: tile.ty,
      run: () => {
        spendEnergy(state, energyCost);
        useBait(state, bait);
        gameEvents.emit('startFishing', { map: tile.map, fish: fish.item, bait });
        return { fishing: true };
      },
    },
  };
}

registerToolAction('fish', ({ state, tile, tool }) => castPlan(state, tile, tool.energyCost));

/**
 * A bait in hand casts with that bait (the rod is owned from day 1): picking a bait on the hotbar is how you change
 * it, one tap. Just above the tools (the generic tool handler at 40 refuses any item that is not a tool) and
 * below eating and planting; auto tool never picks a bait, so a cast is always the player's choice.
 */
registerActionHandler({
  id: 'bait',
  priority: 42,
  plan({ state, tile, stack }) {
    if (!baitOf(stack?.item)) return null;
    return castPlan(state, tile, tools['fishing_rod']?.energyCost ?? 0);
  },
});
