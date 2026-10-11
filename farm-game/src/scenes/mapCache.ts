import Phaser from 'phaser';
import type { GameState } from '../state/GameState';
import { getState } from '../state/store';
import { valleyStage } from '../systems/valley';
import { lookCacheKey } from './PreloadScene';

/**
 * The tilemap cache key of the file a map shows now: its stage for the current state (systems/valley.ts). Every
 * stage's file is loaded at boot, and the stats that pick the stage only change overnight, so the door that
 * parses a map ahead and the scene that builds it always agree, and nothing is fetched at a door.
 */
export const activeMapKey = (mapId: string, state: GameState = getState()): string =>
  lookCacheKey(valleyStage(state, mapId));

/**
 * Parsing a map's Tiled data is most of what building a map costs (6-12 ms per visit at 4x CPU throttle), so it is
 * done ahead: on the frame the farmer steps onto a door (before the wipe has even closed) or on the title, and
 * the next map's build takes the parsed data. Each parse is used once (a map's tiles belong to the layers built
 * from them), so nothing parsed is ever shared between two visits. Parsed data is keyed by file (a stage's file),
 * so a stage that changed since the parse is never built from the old one.
 */
const pending = new Map<string, Phaser.Tilemaps.MapData>();

/** `state`: the state the map will be built for (the title parses ahead before the game's state is set). */
export function preparseMap(scene: Phaser.Scene, mapId: string, state?: GameState): void {
  const key = activeMapKey(mapId, state);
  if (pending.has(key)) return;
  const t = scene.cache.tilemap.get(key) as { format: number; data: object } | undefined;
  if (!t) return;
  const data = Phaser.Tilemaps.Parsers.Parse(key, t.format, t.data, 32, 32, false);
  if (data) pending.set(key, data);
}

/** The map for a scene: the data parsed ahead if there is some, else parsed now. */
export function takeTilemap(scene: Phaser.Scene, mapId: string): Phaser.Tilemaps.Tilemap {
  const key = activeMapKey(mapId);
  const data = pending.get(key);
  pending.delete(key);
  return data ? new Phaser.Tilemaps.Tilemap(scene, data) : scene.make.tilemap({ key });
}
