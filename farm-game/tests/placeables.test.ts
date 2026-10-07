import { describe, expect, it } from 'vitest';
import { sprinklerTiles } from '../src/mechanics/sprinkler';
import { performAction } from '../src/systems/actions';
import { endDay } from '../src/systems/day';
import { getSoil, isMature, plant, till } from '../src/systems/farming';
import { addItem, countItem } from '../src/systems/inventory';
import {
  findPlaced,
  interactWith,
  objectsOn,
  placedAt,
  placeObject,
  removePlaced,
  solidTiles,
} from '../src/systems/placeables';
import { equip, grass, newState } from './helpers';

const NIGHT = { passedOut: false, weedCandidates: [] as [number, number][] };

describe('placing objects', () => {
  it('a sprinkler item is placed on free farm ground and consumed', () => {
    const s = newState();
    addItem(s, 'sprinkler', 1);
    equip(s, 'sprinkler');
    expect(performAction(s, grass(6, 6))).toMatchObject({
      ok: true,
      kind: 'place',
      item: 'sprinkler',
    });
    expect(countItem(s, 'sprinkler')).toBe(0);
    expect(placedAt(s, 'farm', 6, 6)?.type).toBe('sprinkler');
    expect(s.stats['placed']).toBe(1);
  });

  it('refuses tilled soil, occupied tiles, non-farm maps, and solid tiles', () => {
    const s = newState();
    addItem(s, 'sprinkler', 5);
    equip(s, 'sprinkler');
    till(s, 2, 2);
    expect(performAction(s, grass(2, 2)).ok).toBe(false);
    placeObject(s, 'farm', 3, 3, 'sprinkler');
    expect(performAction(s, grass(3, 3)).ok).toBe(false);
    expect(performAction(s, { ...grass(4, 4), farmland: false }).ok).toBe(false);
    expect(performAction(s, { ...grass(4, 4), blocked: true }).ok).toBe(false);
    expect(countItem(s, 'sprinkler')).toBe(5);
  });

  it('assigns unique ids, finds objects anywhere, and removes them cleanly', () => {
    const s = newState();
    const a = placeObject(s, 'farm', 1, 1, 'sprinkler');
    const b = placeObject(s, 'farm', 2, 1, 'sprinkler');
    expect(a.id).not.toBe(b.id);
    expect(findPlaced(s, b.id)?.obj).toBe(b);
    expect(removePlaced(s, 'farm', a.id)).toBe(a);
    expect(objectsOn(s, 'farm')).toHaveLength(1);
    removePlaced(s, 'farm', b.id);
    expect(s.placed['farm']).toBeUndefined(); // empty maps are dropped from the save
    expect(removePlaced(s, 'farm', 999)).toBeNull();
  });

  it('only solid placeables block movement', () => {
    const s = newState();
    placeObject(s, 'farm', 1, 1, 'sprinkler');
    placeObject(s, 'farm', 2, 2, 'preserve_jar');
    expect(solidTiles(s, 'farm')).toEqual([[2, 2]]);
  });

  it('interacting with a sprinkler offers to pick it up', () => {
    const s = newState();
    const obj = placeObject(s, 'farm', 1, 1, 'sprinkler');
    expect(interactWith(s, obj)).toEqual({ kind: 'pickup' });
  });
});

describe('sprinklers', () => {
  it('cover the 4 neighbours, or all 8 with diagonal', () => {
    expect(sprinklerTiles(5, 5, 1, false).sort()).toEqual(
      [
        [4, 5],
        [5, 4],
        [5, 6],
        [6, 5],
      ].sort(),
    );
    expect(sprinklerTiles(5, 5, 1, true)).toHaveLength(8);
    expect(sprinklerTiles(5, 5, 2, false)).toHaveLength(8);
  });

  it('water tilled neighbours in the morning so crops grow with no watering by hand', () => {
    const s = newState();
    placeObject(s, 'farm', 5, 5, 'sprinkler');
    for (const [x, y] of [
      [4, 5],
      [6, 5],
      [5, 4],
      [5, 6],
      [4, 4],
    ] as const) {
      till(s, x, y);
      plant(s, x, y, 'parsnip');
    }
    endDay(s, NIGHT);
    // first night: sprinkler watered the 4 plus-shaped tiles before growth, so they grew; the diagonal did not
    expect(getSoil(s, 4, 5)!.crop!.stage).toBe(1);
    expect(getSoil(s, 5, 6)!.crop!.stage).toBe(1);
    expect(getSoil(s, 4, 4)!.crop!.stage).toBe(0);
    for (let i = 0; i < 3; i++) endDay(s, NIGHT);
    expect(isMature(getSoil(s, 6, 5)!.crop!)).toBe(true); // parsnip: 4 days, all watered by the sprinkler
  });

  it('a quality sprinkler also covers diagonals', () => {
    const s = newState();
    placeObject(s, 'farm', 5, 5, 'quality_sprinkler');
    till(s, 4, 4);
    plant(s, 4, 4, 'parsnip');
    endDay(s, NIGHT);
    expect(getSoil(s, 4, 4)!.crop!.stage).toBe(1);
  });

  it('do nothing for untilled ground and never throw with no soil nearby', () => {
    const s = newState();
    placeObject(s, 'farm', 5, 5, 'sprinkler');
    expect(() => endDay(s, NIGHT)).not.toThrow();
    expect(Object.keys(s.farm.tiles)).toHaveLength(0);
  });
});
