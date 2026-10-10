import type Phaser from 'phaser';
import { TILESET_KEY } from '../config';
import index from './atlases.json';

/** Texture key of a season's tileset (palette swaps of the spring tiles, built by art-src/tools/seasons.py). */
export const seasonTilesetKey = (season: string): string => `${TILESET_KEY}_${season}`;

/**
 * The tileset texture for a map: outdoors, the season's own tileset when it was built and loaded (then no colour
 * tint is needed); otherwise the spring one. `tinted` says whether the old full-screen season tint still applies.
 */
export function tilesetFor(
  textures: { exists(key: string): boolean },
  season: string,
  outdoor: boolean,
): { key: string; tinted: boolean } {
  if (!outdoor || season === 'spring') return { key: TILESET_KEY, tinted: false };
  const key = seasonTilesetKey(season);
  return textures.exists(key) ? { key, tinted: false } : { key: TILESET_KEY, tinted: true };
}

/**
 * The art layers baked into each map by scripts/generate-maps.mjs (see scripts/map-art.mjs): ground detail and
 * transitions, shadows and flora, props, roofs, and an overhead layer you walk behind (tree crowns, lamp tops,
 * ridge caps). Purely visual; collision comes from the map's collision layer. Drawn only when the art tileset
 * exists: the generated placeholder tileset has none of these tiles.
 */
export const MAP_ART_LAYERS = [
  { name: 'detail', depth: 0.02 },
  { name: 'shade', depth: 0.03 },
  { name: 'props', depth: 0.06 },
  { name: 'roof', depth: 0.1 },
  { name: 'overhead', depth: 5000 },
] as const;

/** Overhead tiles this close to the player (in tiles) turn see-through, so you and your target stay visible. */
export const FADE_RADIUS = 1;
export const FADE_ALPHA = 0.45;

/**
 * Tiles to fade: about 24 px around the player's body (feet tile, head tile above, and the ring around them, without
 * the far corners) plus the 3x3 around the target tile, so a big tree crown never hides you, your target marker or
 * the crop and forage you are working. Pure, for tests.
 */
export function fadeTiles(
  tx: number,
  ty: number,
  target?: { tx: number; ty: number },
): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<string>();
  const add = (x: number, y: number): void => {
    const k = `${x},${y}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([x, y]);
    }
  };
  for (let y = ty - FADE_RADIUS - 2; y <= ty + FADE_RADIUS; y++)
    for (let x = tx - FADE_RADIUS - 1; x <= tx + FADE_RADIUS + 1; x++) {
      const far =
        Math.abs(x - tx) === FADE_RADIUS + 1 &&
        (y === ty - FADE_RADIUS - 2 || y === ty + FADE_RADIUS);
      if (!far) add(x, y);
    }
  if (target)
    for (let y = target.ty - 1; y <= target.ty + 1; y++)
      for (let x = target.tx - 1; x <= target.tx + 1; x++) add(x, y);
  return out;
}

export class MapArt {
  private overhead: Phaser.Tilemaps.TilemapLayer | null = null;
  private faded: Phaser.Tilemaps.Tile[] = [];
  private last = '';

  constructor(
    map: Phaser.Tilemaps.Tilemap,
    tileset: Phaser.Tilemaps.Tileset,
    overheadTint = 0xffffff,
  ) {
    if (!index.tileset) return;
    for (const { name, depth } of MAP_ART_LAYERS) {
      if (map.getLayerIndex(name) === null) continue;
      const layer = map.createLayer(name, tileset);
      if (!layer) continue;
      layer.setDepth(depth);
      if (name === 'overhead') {
        this.overhead = layer;
        if (overheadTint !== 0xffffff) layer.setTint(overheadTint);
      }
    }
  }

  /** Call when the player moves or turns: overhead tiles near them and their target fade, the rest come back. */
  follow(tx: number, ty: number, target?: { tx: number; ty: number }): void {
    if (!this.overhead) return;
    const key = `${tx},${ty},${target?.tx},${target?.ty}`;
    if (key === this.last) return;
    this.last = key;
    for (const t of this.faded) t.setAlpha(1);
    this.faded = [];
    for (const [x, y] of fadeTiles(tx, ty, target)) {
      const t = this.overhead.getTileAt(x, y);
      if (t) {
        t.setAlpha(FADE_ALPHA);
        this.faded.push(t);
      }
    }
  }
}
