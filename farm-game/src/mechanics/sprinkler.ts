import { gameEvents } from '../systems/events';
import { registerPlaceableBehavior } from '../systems/placeables';
import { tileKey } from '../systems/farming';

/** Tiles a sprinkler covers: the 4 neighbours within `reach`, plus diagonals if enabled. */
export function sprinklerTiles(
  tx: number,
  ty: number,
  reach: number,
  diagonal: boolean,
): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (!diagonal && dx !== 0 && dy !== 0) continue;
      out.push([tx + dx, ty + dy]);
    }
  }
  return out;
}

/** A sprinkler waters every tilled tile around it each morning, before crops grow. */
registerPlaceableBehavior('sprinkler', {
  beforeGrowth(state, obj, def) {
    const reach = Number(def.params['reach'] ?? 1);
    const diagonal = def.params['diagonal'] === true;
    let watered = 0;
    for (const [x, y] of sprinklerTiles(obj.tx, obj.ty, reach, diagonal)) {
      const soil = state.farm.tiles[tileKey(x, y)];
      if (soil && !soil.watered) {
        soil.watered = true;
        watered += 1;
      }
    }
    if (watered > 0) gameEvents.emit('farmChanged', undefined);
  },
  interact: () => ({ kind: 'pickup' }),
});
