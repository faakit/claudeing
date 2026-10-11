import type Phaser from 'phaser';
import { TILESET_KEY } from '../config';
import type { GameState } from '../state/GameState';
import { dryMaps } from '../systems/valley';
import { remapDry, slotCategories, type DryCategory } from './dryPalette';
import { dryTilesetKey, seasonTilesetKey } from './mapLayers';

/** Cache key of the tile index (public/assets/tilesets/tiles.json), loaded with the tileset. */
export const TILE_INDEX_KEY = 'tiles_index';

export { dryTilesetKey };

const SEASONS = ['spring', 'summer', 'fall', 'winter'];
let categories: Map<number, DryCategory> | null | undefined;

/**
 * Make the season's dry tileset if it is not resident yet: a palette remap (art/dryPalette.ts) of the season's
 * loaded tileset, drawn once into a canvas texture. One long frame (tens of ms on a slow phone), so it is done
 * where nobody sees it: under the title's wipe, at the sleep fade, or as a world scene's safety net. Returns the
 * key, or null when there is no source tileset to remap.
 */
export function ensureDryTileset(scene: Phaser.Scene, season: string): string | null {
  const key = dryTilesetKey(season);
  const tex = scene.textures;
  if (tex.exists(key)) return key;
  const srcKey =
    season !== 'spring' && tex.exists(seasonTilesetKey(season))
      ? seasonTilesetKey(season)
      : TILESET_KEY;
  if (!tex.exists(srcKey)) return null;
  const src = tex.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const canvas = tex.createCanvas(key, src.width, src.height);
  if (!canvas) return null;
  const ctx = canvas.getContext();
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, src.width, src.height);
  if (categories === undefined) {
    const index = scene.cache.json.get(TILE_INDEX_KEY) as
      { columns?: number; tiles?: Record<string, number> } | undefined;
    categories = index?.tiles ? slotCategories(index.tiles) : null;
  }
  const cols = (scene.cache.json.get(TILE_INDEX_KEY) as { columns?: number } | undefined)?.columns;
  remapDry(img.data, src.width, src.height, cols ?? Math.floor(src.width / 16), categories);
  ctx.putImageData(img, 0, 0);
  canvas.refresh();
  return key;
}

/**
 * Keep exactly the dry tilesets today needs: the current season's while any outdoor map is dry, none once no map
 * is (the morning after the first green). Call at a moment nobody watches (the title's wipe, the sleep fade), never
 * at a door, and only while no world scene is drawing with a tileset it would release.
 */
export function syncDryTiles(scene: Phaser.Scene, state: GameState): void {
  const need = dryMaps(state).length > 0 ? dryTilesetKey(state.time.season) : null;
  for (const s of SEASONS) {
    const key = dryTilesetKey(s);
    if (key !== need && scene.textures.exists(key)) scene.textures.remove(key);
  }
  if (need) ensureDryTileset(scene, state.time.season);
}

/** Dry tilesets resident right now (for the e2e checks and the dev tools). */
export const residentDryTiles = (textures: { exists(key: string): boolean }): string[] =>
  SEASONS.map(dryTilesetKey).filter((k) => textures.exists(k));
