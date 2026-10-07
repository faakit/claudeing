import { describe, expect, it } from 'vitest';
import { spawnPosition } from '../src/state/GameState';
import {
  adjacentDirection,
  doorTarget,
  facingTile,
  objectAt,
  parseMapObjects,
  playerTile,
  teleportPlayer,
  type TiledMapLike,
} from '../src/systems/world';
import { createInitialState } from '../src/state/GameState';

describe('tiles', () => {
  it('spawnPosition round-trips through playerTile', () => {
    expect(playerTile(spawnPosition(7, 9))).toEqual({ tx: 7, ty: 9 });
  });

  it('facingTile offsets by direction', () => {
    const base = spawnPosition(5, 5);
    expect(facingTile({ ...base, facing: 'up' })).toEqual({ tx: 5, ty: 4 });
    expect(facingTile({ ...base, facing: 'down' })).toEqual({ tx: 5, ty: 6 });
    expect(facingTile({ ...base, facing: 'left' })).toEqual({ tx: 4, ty: 5 });
    expect(facingTile({ ...base, facing: 'right' })).toEqual({ tx: 6, ty: 5 });
  });

  it('adjacentDirection only accepts 4-neighbors', () => {
    const o = { tx: 5, ty: 5 };
    expect(adjacentDirection(o, { tx: 6, ty: 5 })).toBe('right');
    expect(adjacentDirection(o, { tx: 5, ty: 4 })).toBe('up');
    expect(adjacentDirection(o, { tx: 6, ty: 6 })).toBeNull();
    expect(adjacentDirection(o, o)).toBeNull();
    expect(adjacentDirection(o, { tx: 7, ty: 5 })).toBeNull();
  });
});

describe('objects', () => {
  const map: TiledMapLike = {
    width: 4,
    height: 4,
    tilewidth: 16,
    layers: [
      {
        name: 'objects',
        type: 'objectgroup',
        objects: [
          { id: 1, type: 'bed', x: 16, y: 16, width: 32, height: 32 },
          {
            id: 2,
            type: 'door',
            x: 0,
            y: 48,
            width: 16,
            height: 16,
            properties: [
              { name: 'targetMap', value: 'farm' },
              { name: 'spawnTx', value: 3 },
              { name: 'spawnTy', value: 4 },
              { name: 'facing', value: 'down' },
            ],
          },
        ],
      },
    ],
  };

  it('finds multi-tile objects by any covered tile', () => {
    const objects = parseMapObjects(map);
    expect(objectAt(objects, 1, 1)?.type).toBe('bed');
    expect(objectAt(objects, 2, 2)?.type).toBe('bed');
    expect(objectAt(objects, 3, 3)).toBeUndefined();
    expect(objectAt(objects, 0, 3, 'door')?.id).toBe(2);
    expect(objectAt(objects, 1, 1, 'door')).toBeUndefined();
  });

  it('reads door targets and teleports the player', () => {
    const objects = parseMapObjects(map);
    const state = createInitialState();
    teleportPlayer(state, doorTarget(objects[1]!));
    expect(state.player.map).toBe('farm');
    expect(playerTile(state.player)).toEqual({ tx: 3, ty: 4 });
    expect(state.player.facing).toBe('down');
  });

  it('rejects malformed doors with a clear error', () => {
    const [bed] = parseMapObjects(map);
    expect(() => doorTarget(bed!)).toThrow(/needs targetMap/);
  });
});
