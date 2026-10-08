import type Phaser from 'phaser';
import { PLACEHOLDER_TILES, TILE_SIZE } from '../config';
import { hasArt } from './registry';

/**
 * Decor drawn over the ground layer, derived from the map so no map file changes: every block of wall
 * tiles gets a roof over all but its bottom row (the facade with the doors), so buildings read as houses
 * instead of slabs of bricks. Purely visual: collision still comes from the map. Drawn only when the roof
 * art exists (the generated placeholders keep the old look).
 */
const gid = (name: string): number => PLACEHOLDER_TILES.findIndex((t) => t.name === name) + 1;
const BUILDING: Record<number, 'red' | 'slate'> = {
  [gid('wall')]: 'red',
  [gid('door')]: 'red',
  [gid('shopwall')]: 'slate',
  [gid('shopdoor')]: 'slate',
};

export const roofKey = (style: string, row: 't' | 'm' | 'b', col: 'l' | 'c' | 'r'): string =>
  `decor_roof_${style}_${row}${col}`;
export const ROOF_KEYS = (['red', 'slate'] as const).flatMap((s) =>
  (['t', 'm', 'b'] as const).flatMap((r) =>
    (['l', 'c', 'r'] as const).map((c) => roofKey(s, r, c)),
  ),
);

/** Roof tiles for every building block in a ground grid (gids, row-major). Pure, for tests. */
export function roofTiles(
  data: number[],
  w: number,
  h: number,
): { tx: number; ty: number; key: string }[] {
  const style = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h ? BUILDING[data[y * w + x] ?? 0] : undefined;
  const seen = new Set<number>();
  const out: { tx: number; ty: number; key: string }[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = style(x, y);
      if (!s || seen.has(y * w + x)) continue;
      // Flood the block (same roof style), then roof its bounding rows except the last.
      const cells: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen.add(y * w + x);
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        cells.push([cx, cy]);
        for (const [nx, ny] of [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ] as const)
          if (style(nx, ny) === s && !seen.has(ny * w + nx)) {
            seen.add(ny * w + nx);
            stack.push([nx, ny]);
          }
      }
      const bottom = Math.max(...cells.map((c) => c[1]));
      const top = Math.min(...cells.map((c) => c[1]));
      if (bottom === top) continue; // a one-row wall is a wall, not a building
      for (const [cx, cy] of cells) {
        if (cy === bottom) continue;
        const row = cy === bottom - 1 ? 'b' : cy === top ? 't' : 'm';
        const col = style(cx - 1, cy) !== s ? 'l' : style(cx + 1, cy) !== s ? 'r' : 'c';
        out.push({ tx: cx, ty: cy, key: roofKey(s, row, col) });
      }
    }
  return out;
}

export const GROUND_DECOR_KEYS = ['decor_grass_a', 'decor_grass_b', 'decor_flowers'];

/** Small deterministic hash of a tile (stable across sessions, no RNG state touched). */
const hash = (x: number, y: number, salt: number): number => {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * Flat ground decor (grass sprigs, tiny flowers) on about 1 in 12 grass tiles, so large
 * fields do not look like one repeated tile. Nothing tall on the farm, where a tuft could pass for a weed.
 */
export function groundDecor(
  data: number[],
  w: number,
  h: number,
  farm: boolean,
): { tx: number; ty: number; key: string }[] {
  const grass = gid('grass');
  const onGrass = farm
    ? ['decor_grass_b', 'decor_flowers']
    : ['decor_grass_a', 'decor_grass_b', 'decor_flowers'];
  const out: { tx: number; ty: number; key: string }[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const g = data[y * w + x];
      const r = hash(x, y, w * 31 + h);
      if (r % 12 !== 0) continue;
      if (g === grass) out.push({ tx: x, ty: y, key: onGrass[(r >>> 8) % onGrass.length]! });
    }
  return out;
}

/** Add the roofs of a map's ground layer to a scene (just above the ground, under the season tint). */
export function addRoofs(
  scene: Phaser.Scene,
  layer: Phaser.Tilemaps.TilemapLayer,
  farm = false,
): void {
  const { width: w, height: h } = layer.layer;
  const data: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data.push(layer.getTileAt(x, y)?.index ?? 0);
  const list = [
    ...(GROUND_DECOR_KEYS.every(hasArt) ? groundDecor(data, w, h, farm) : []),
    ...(ROOF_KEYS.every(hasArt) ? roofTiles(data, w, h) : []),
  ];
  for (const r of list)
    scene.add
      .image(r.tx * TILE_SIZE, r.ty * TILE_SIZE, r.key)
      .setOrigin(0)
      .setDepth(0.1);
}
