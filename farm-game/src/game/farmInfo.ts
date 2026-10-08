import { tileKind } from '../config';
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

/** Tiles where wild goods may appear on one map: walkable ground inside its "forage" zones. */
export function forageCandidates(raw: TiledMapLike): [number, number][] {
  const grid = buildCollisionGrid(raw);
  const ground = raw.layers.find((l) => l.name === 'ground')?.data ?? [];
  const out: [number, number][] = [];
  for (const z of parseMapObjects(raw).filter((o) => o.type === 'forage')) {
    for (let ty = z.ty; ty < z.ty + z.th; ty++) {
      for (let tx = z.tx; tx < z.tx + z.tw; tx++) {
        const kind = tileKind(ground[ty * raw.width + tx] ?? 0);
        if (kind !== 'grass' && kind !== 'flower') continue;
        if (!isTileBlockedAt(grid, tx, ty)) out.push([tx, ty]);
      }
    }
  }
  return out;
}

/** Open cave floor inside a map's "ore" zones, where ore nodes may appear. */
export function oreCandidates(raw: TiledMapLike): [number, number][] {
  const grid = buildCollisionGrid(raw);
  const ground = raw.layers.find((l) => l.name === 'ground')?.data ?? [];
  const out: [number, number][] = [];
  for (const z of parseMapObjects(raw).filter((o) => o.type === 'ore')) {
    for (let ty = z.ty; ty < z.ty + z.th; ty++) {
      for (let tx = z.tx; tx < z.tx + z.tw; tx++) {
        if (tileKind(ground[ty * raw.width + tx] ?? 0) !== 'stone') continue;
        if (!isTileBlockedAt(grid, tx, ty)) out.push([tx, ty]);
      }
    }
  }
  return out;
}
