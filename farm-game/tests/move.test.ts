import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { performAction } from '../src/systems/actions';
import { houseOf, moveIn } from '../src/systems/animals';
import { addItem, countItem } from '../src/systems/inventory';
import { pickUpPlaced, placeObject, placedAt } from '../src/systems/placeables';
import { migrate } from '../src/systems/save';
import { siloStock } from '../src/systems/silo';
import { equip, grass, newState } from './helpers';

describe('moving buildings', () => {
  it('a coop picked up with hens keeps them; the next coop placed gets them back', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    addItem(s, 'chicken', 2);
    moveIn(s, coop);
    houseOf(coop).ready = 2;
    houseOf(coop).joy = 4;
    expect(pickUpPlaced(s, 'farm', coop)).toBe('ok');
    expect(countItem(s, 'coop')).toBe(1);
    expect(s.stored['coop']).toHaveLength(1);
    equip(s, 'coop');
    performAction(s, grass(9, 9));
    const moved = placedAt(s, 'farm', 9, 9)!;
    expect(houseOf(moved)).toMatchObject({ n: 2, ready: 2, joy: 4 });
    expect(s.stored['coop']).toBeUndefined();
  });

  it('a silo keeps its feed when moved; an empty jar carries nothing', () => {
    const s = newState();
    const silo = placeObject(s, 'farm', 4, 4, 'silo');
    siloStock(silo)['hay'] = 50;
    pickUpPlaced(s, 'farm', silo);
    equip(s, 'silo');
    performAction(s, grass(6, 6));
    expect(siloStock(placedAt(s, 'farm', 6, 6)!)['hay']).toBe(50);
    const jar = placeObject(s, 'farm', 2, 2, 'preserve_jar');
    pickUpPlaced(s, 'farm', jar);
    expect(s.stored['preserve_jar']).toBeUndefined();
  });

  it('a busy machine or a full bag refuses, changing nothing', () => {
    const s = newState();
    const jar = placeObject(s, 'farm', 2, 2, 'preserve_jar');
    jar.data['jar'] = { out: { item: 'jam', of: 'tomato' }, days: 2 };
    expect(pickUpPlaced(s, 'farm', jar)).toBe('busy');
    expect(placedAt(s, 'farm', 2, 2)).toBe(jar);
  });

  it('a house being moved survives a save, but never more than the houses carried', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    addItem(s, 'chicken', 1);
    moveIn(s, coop);
    pickUpPlaced(s, 'farm', coop);
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.stored['coop']).toHaveLength(1);
    const raw = JSON.parse(JSON.stringify(s));
    raw.stored.coop.push({ house: { n: 3 } }, { house: { n: 3 } }); // forged extras
    expect(migrate(raw).stored['coop']).toHaveLength(1);
  });
});
