import { PLAYER_HITBOX, TILE_SIZE } from '../config';
import {
  spawnPosition,
  type Direction,
  type GameState,
  type PlayerState,
} from '../state/GameState';
import { DIR_VECTORS, isDirection } from './direction';
import { createGrid, isTileBlocked, type CollisionGrid, type Hitbox } from './movement';

type PropValue = string | number | boolean;

export interface TiledObjectLike {
  id: number;
  name?: string;
  type?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: { name: string; value: PropValue }[];
}
export interface TiledLayerLike {
  name: string;
  type: string;
  data?: number[];
  objects?: TiledObjectLike[];
}
export interface TiledMapLike {
  width: number;
  height: number;
  tilewidth: number;
  layers: TiledLayerLike[];
}

/** A rectangular interactable or trigger, in tile units. */
export interface WorldObject {
  id: number;
  type: string;
  tx: number;
  ty: number;
  tw: number;
  th: number;
  props: Record<string, PropValue>;
}

export interface TileCoord {
  tx: number;
  ty: number;
}

function findLayer(map: TiledMapLike, name: string): TiledLayerLike {
  const layer = map.layers.find((l) => l.name === name);
  if (!layer) throw new Error(`Map is missing the "${name}" layer`);
  return layer;
}

export function buildCollisionGrid(map: TiledMapLike): CollisionGrid {
  const data = findLayer(map, 'collision').data;
  if (!data) throw new Error('"collision" must be a tile layer');
  return createGrid(map.width, map.height, map.tilewidth, data);
}

export function parseMapObjects(map: TiledMapLike): WorldObject[] {
  const objects = findLayer(map, 'objects').objects ?? [];
  const ts = map.tilewidth;
  return objects.map((o) => {
    if (!o.type) throw new Error(`Object ${o.id} needs a type (Tiled "class")`);
    return {
      id: o.id,
      type: o.type,
      tx: Math.floor(o.x / ts),
      ty: Math.floor(o.y / ts),
      tw: Math.max(1, Math.round(o.width / ts)),
      th: Math.max(1, Math.round(o.height / ts)),
      props: Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value])),
    };
  });
}

export function objectAt(
  objects: readonly WorldObject[],
  tx: number,
  ty: number,
  type?: string,
): WorldObject | undefined {
  return objects.find(
    (o) =>
      (type === undefined || o.type === type) &&
      tx >= o.tx &&
      tx < o.tx + o.tw &&
      ty >= o.ty &&
      ty < o.ty + o.th,
  );
}

/** The tile under the middle of the player's hitbox. */
export function playerTile(
  p: Pick<PlayerState, 'x' | 'y'>,
  hb: Hitbox = PLAYER_HITBOX,
  tileSize = TILE_SIZE,
): TileCoord {
  return { tx: Math.floor(p.x / tileSize), ty: Math.floor((p.y - hb.h / 2) / tileSize) };
}

/** The tile the player is facing, used by tools and interactions. */
export function facingTile(
  p: Pick<PlayerState, 'x' | 'y' | 'facing'>,
  hb: Hitbox = PLAYER_HITBOX,
  tileSize = TILE_SIZE,
): TileCoord {
  const { tx, ty } = playerTile(p, hb, tileSize);
  const v = DIR_VECTORS[p.facing];
  return { tx: tx + v.x, ty: ty + v.y };
}

/** Direction from one tile to a 4-neighbor, or null if not adjacent. */
export function adjacentDirection(from: TileCoord, to: TileCoord): Direction | null {
  const dx = to.tx - from.tx;
  const dy = to.ty - from.ty;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  if (dx === 1) return 'right';
  if (dx === -1) return 'left';
  return dy === 1 ? 'down' : 'up';
}

export interface DoorTarget extends TileCoord {
  map: string;
  facing: Direction;
}

export function doorTarget(door: WorldObject): DoorTarget {
  const { targetMap, spawnTx, spawnTy, facing } = door.props;
  if (
    typeof targetMap !== 'string' ||
    typeof spawnTx !== 'number' ||
    typeof spawnTy !== 'number' ||
    !isDirection(facing)
  ) {
    throw new Error(`Door ${door.id} needs targetMap, spawnTx, spawnTy and facing`);
  }
  return { map: targetMap, tx: spawnTx, ty: spawnTy, facing };
}

export function teleportPlayer(state: GameState, target: DoorTarget): void {
  state.player = { map: target.map, ...spawnPosition(target.tx, target.ty), facing: target.facing };
}

export const isTileBlockedAt = isTileBlocked;

/**
 * A free tile close to (tx, ty): the tile itself if open, else the nearest open one (clamped into the map).
 * Used to rescue a saved position that is out of bounds or inside a wall.
 */
export function nearestFreeTile(grid: CollisionGrid, tx: number, ty: number): TileCoord {
  const cx = Math.max(0, Math.min(grid.width - 1, Math.round(tx)));
  const cy = Math.max(0, Math.min(grid.height - 1, Math.round(ty)));
  const maxR = Math.max(grid.width, grid.height);
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < grid.width && y < grid.height && !isTileBlocked(grid, x, y))
          return { tx: x, ty: y };
      }
    }
  }
  return { tx: cx, ty: cy };
}
