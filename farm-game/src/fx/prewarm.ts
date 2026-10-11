import Phaser from 'phaser';
import { TILESET_KEY } from '../config';
import { mapsData } from '../data';
import { bakeButton } from '../input/TouchButton';
import { dockLayout } from '../ui/layout';
import { ensureTexture as ensureGlowTexture } from './NightGlow';
import { ensureDitherTextures } from './Wipe';
import { mapCacheKey } from '../scenes/PreloadScene';

/**
 * Work the first game frame would otherwise do, done ahead on the title screen while the player reads it, one
 * small task per frame: the generated textures (the dither wipe, the dock buttons, the night lights), the number
 * formatter, and a throwaway parse of the maps (the first parse of a map runs cold, several times slower). The
 * new game's build then fits under its wipe without a long frame (scripts/perf.mjs, "new game").
 */
export function prewarmTasks(scene: Phaser.Scene, firstMap: string): (() => void)[] {
  const L = dockLayout(false);
  const maps = [firstMap, ...Object.keys(mapsData.maps).filter((m) => m !== firstMap)];
  return [
    () => ensureDitherTextures(scene),
    () => [L.action.r, L.interact.r, L.menu.r].forEach((r) => bakeButton(scene, r)),
    () => ensureGlowTexture(scene),
    () => void (12345).toLocaleString('en-US'),
    ...maps.map((id) => () => warmMap(scene, id)),
  ];
}

/** Parse a map and build its layers once, then throw it away (warms the parser and the layer code). */
function warmMap(scene: Phaser.Scene, id: string): void {
  if (!scene.cache.tilemap.exists(mapCacheKey(id))) return;
  const map = scene.make.tilemap({ key: mapCacheKey(id) });
  const ts = map.addTilesetImage('placeholder', TILESET_KEY, 16, 16, 0, 0);
  if (ts) for (const l of map.layers) map.createLayer(l.name, ts)?.setVisible(false);
  map.destroy();
}
