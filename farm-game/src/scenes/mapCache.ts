import Phaser from 'phaser';
import { mapCacheKey } from './PreloadScene';

/**
 * Parsing a map's Tiled data is most of what building a map costs (6-12 ms per visit at 4x CPU throttle), so it is
 * done ahead: on the frame the farmer steps onto a door (before the wipe has even closed) or on the title, and
 * the next map's build takes the parsed data. Each parse is used once (a map's tiles belong to the layers built
 * from them), so nothing parsed is ever shared between two visits.
 */
const pending = new Map<string, Phaser.Tilemaps.MapData>();

export function preparseMap(scene: Phaser.Scene, mapId: string): void {
  if (pending.has(mapId)) return;
  const key = mapCacheKey(mapId);
  const t = scene.cache.tilemap.get(key) as { format: number; data: object } | undefined;
  if (!t) return;
  const data = Phaser.Tilemaps.Parsers.Parse(key, t.format, t.data, 32, 32, false);
  if (data) pending.set(mapId, data);
}

/** The map for a scene: the data parsed ahead if there is some, else parsed now. */
export function takeTilemap(scene: Phaser.Scene, mapId: string): Phaser.Tilemaps.Tilemap {
  const data = pending.get(mapId);
  pending.delete(mapId);
  return data
    ? new Phaser.Tilemaps.Tilemap(scene, data)
    : scene.make.tilemap({ key: mapCacheKey(mapId) });
}
