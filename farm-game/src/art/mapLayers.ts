import type Phaser from 'phaser';
import { TILESET_KEY } from '../config';
import index from './atlases.json';
import { holeCircles, holeTiles } from '../fx/SeeThrough';

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
  // lamp-post tops: above the player, never cut away (they hide nothing)
  { name: 'lamps', depth: 5000 },
] as const;

export class MapArt {
  private overhead: Phaser.Tilemaps.TilemapLayer | null = null;
  private near = false;
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

  /**
   * Call when the player moves or turns. While an overhead tile (a crown, an eave) stands near them or their target,
   * the overhead layer gets the see-through hole (`src/fx/SeeThrough.ts`); otherwise it is drawn whole. Returns
   * whether the hole is in use. The tiles themselves always stay fully opaque (review 9: no translucent disc).
   */
  follow(
    tx: number,
    ty: number,
    target: { tx: number; ty: number } | undefined,
    hole: Phaser.Display.Masks.GeometryMask | null,
    px = tx * 16 + 8,
    py = ty * 16 + 11,
  ): boolean {
    if (!this.overhead) return false;
    const key = `${Math.round(px)},${Math.round(py)},${target?.tx},${target?.ty}`;
    if (key !== this.last) {
      this.last = key;
      const layer = this.overhead;
      // only tiles the hole itself would touch count, so a well roof or an eave nearby costs nothing
      this.near = holeTiles(holeCircles(px, py, target)).some(([x, y]) => !!layer.getTileAt(x, y));
      if (this.near && hole) layer.setMask(hole);
      else layer.clearMask();
    }
    return this.near;
  }
}
