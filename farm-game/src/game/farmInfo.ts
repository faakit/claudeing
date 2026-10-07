import { mapsData } from '../data';
import {
  buildCollisionGrid,
  isTileBlockedAt,
  parseMapObjects,
  type TiledMapLike,
} from '../systems/world';

/** Farmable tiles inside the farm map's "weedzone" objects, where weeds may sprout. */
export function weedCandidates(raw: TiledMapLike): [number, number][] {
  const grid = buildCollisionGrid(raw);
  const ground = raw.layers.find((l) => l.name === 'ground')?.data ?? [];
  const tillable = mapsData.maps['farm']?.tillable ?? [];
  const out: [number, number][] = [];
  for (const z of parseMapObjects(raw).filter((o) => o.type === 'weedzone')) {
    for (let ty = z.ty; ty < z.ty + z.th; ty++) {
      for (let tx = z.tx; tx < z.tx + z.tw; tx++) {
        const gid = ground[ty * raw.width + tx] ?? 0;
        if (tillable.includes(gid) && !isTileBlockedAt(grid, tx, ty)) out.push([tx, ty]);
      }
    }
  }
  return out;
}
