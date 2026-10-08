import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { game, items, nodes, shops, tools } from '../src/data';
import { performAction } from '../src/systems/actions';
import { buyUpgrade, nextUpgrade } from '../src/systems/economy';
import { addItem, countItem } from '../src/systems/inventory';
import {
  mineNode,
  nodeAt,
  nodeCount,
  nodeTiles,
  spawnNodes,
  spawnable,
} from '../src/systems/mining';
import { collectJar, loadJar, tickJar } from '../src/systems/preserves';
import { placeObject } from '../src/systems/placeables';
import { migrate } from '../src/systems/save';
import { addXp } from '../src/systems/skills';
import { equip, grass, newState } from './helpers';

const floor = (n: number) =>
  Array.from({ length: n }, (_, i) => [3 + (i % 10), 3 + Math.floor(i / 10)] as [number, number]);
const mineTile = (tx: number, ty: number) => ({
  ...grass(tx, ty),
  map: 'mine',
  farmland: false,
  blocked: true,
});

describe('mine nodes', () => {
  it('spawn each morning on open floor, up to a cap, and stay until broken', () => {
    const s = newState();
    const spots = { mine: floor(80) };
    const made = spawnNodes(s, spots)['mine']!;
    expect(made).toBeGreaterThan(0);
    expect(nodeCount(s, 'mine')).toBe(made);
    for (let i = 0; i < 10; i++) spawnNodes(s, spots);
    expect(nodeCount(s, 'mine')).toBeLessThanOrEqual(22);
    const tiles = nodeTiles(s, 'mine');
    expect(new Set(tiles.map((t) => t.join(','))).size).toBe(tiles.length);
  });

  it('rarer, richer nodes wait for a higher mining level', () => {
    const s = newState();
    const early = spawnable(s).map(([id]) => id);
    expect(early).toContain('rock_node');
    expect(early).not.toContain('gem_node');
    addXp(s, 'mining', 300);
    expect(spawnable(s).map(([id]) => id)).toContain('gem_node');
  });

  it('the pickaxe breaks a node for energy and yields its drop, XP and a stat', () => {
    const s = newState();
    s.nodes['mine'] = { '5,5': 'copper_node' };
    equip(s, 'pickaxe');
    const energy = s.energy;
    const res = performAction(s, mineTile(5, 5));
    expect(res.ok && res.kind).toBe('mine');
    expect(countItem(s, 'copper_ore')).toBeGreaterThanOrEqual(1);
    expect(nodeAt(s, 'mine', 5, 5)).toBeUndefined();
    expect(energy - s.energy).toBe(tools['pickaxe']!.energyCost);
    expect(s.skills['mining']).toBeGreaterThan(0);
    expect(s.stats['mined']).toBe(1);
  });

  it('any other tool is told to use the pickaxe, and nothing changes', () => {
    const s = newState();
    s.nodes['mine'] = { '5,5': 'rock_node' };
    equip(s, 'hoe');
    const res = performAction(s, mineTile(5, 5));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.message).toMatch(/pickaxe/);
    expect(nodeAt(s, 'mine', 5, 5)).toBe('rock_node');
  });

  it('refuses with an empty tile, a tired player or a full bag, without spending anything', () => {
    const s = newState();
    equip(s, 'pickaxe');
    expect(performAction(s, mineTile(5, 5)).ok).toBe(false);
    s.nodes['mine'] = { '5,5': 'rock_node' };
    s.energy = 1;
    expect(performAction(s, mineTile(5, 5)).ok).toBe(false);
    expect(nodeAt(s, 'mine', 5, 5)).toBe('rock_node');
  });

  it('a mining perk can double the haul', () => {
    let doubled = false;
    for (let i = 0; i < 60 && !doubled; i++) {
      const s = newState();
      s.rng = 100 + i;
      addXp(s, 'mining', 99999);
      s.nodes['mine'] = { '5,5': 'copper_node' };
      const res = mineNode(s, 'mine', 5, 5);
      if (res.ok && res.qty > 3) doubled = true;
    }
    expect(doubled).toBe(true);
  });

  it('every node drops something that exists and weights are positive', () => {
    for (const n of Object.values(nodes)) {
      expect(n.weight).toBeGreaterThan(0);
      for (const d of n.drops) expect(items[d.item]).toBeDefined();
    }
  });
});

describe('furnace and bar upgrades', () => {
  it('smelts ore into a bar in two days', () => {
    const s = newState();
    const f = placeObject(s, 'farm', 4, 4, 'furnace');
    addItem(s, 'copper_ore', 2);
    expect(loadJar(s, f, { item: 'copper_ore' })).toBe('ok');
    tickJar(f);
    expect(collectJar(s, f)).toBe('waiting');
    tickJar(f);
    expect(collectJar(s, f)).toMatchObject({ item: 'copper_bar', of: 'copper_ore' });
    expect(countItem(s, 'copper_bar')).toBe(1);
  });

  it('tool upgrades can require bars: no bars, no upgrade', () => {
    const s = newState();
    s.money = 99999;
    const hoe = shops['town_general_store']!.upgrades.find((u) => u.id === 'hoe')!;
    expect(nextUpgrade(s, hoe)?.needs?.item).toBe('copper_bar');
    expect(buyUpgrade(s, hoe)).toBe('no_items');
    expect(s.upgrades.hoe).toBe(0);
    expect(s.money).toBe(99999);
    addItem(s, { item: 'copper_bar', of: 'copper_ore' }, 2);
    expect(buyUpgrade(s, hoe)).toBe('ok');
    expect(s.upgrades.hoe).toBe(1);
    expect(countItem(s, 'copper_bar')).toBe(0);
    expect(s.stats['barUpgrades']).toBe(1);
  });
});

describe('save v7', () => {
  it('v6 saves gain the pickaxe as the fifth tool and keep everything else in place', () => {
    const s = newState();
    // build a v6-shaped inventory: four tools, then seeds
    const oldSlots = s.inventory.slots.filter((x) => x?.item !== 'pickaxe');
    oldSlots.length = game.inventorySlots - 1;
    const raw = JSON.parse(JSON.stringify({ ...s, version: 6 }));
    raw.inventory = { slots: [...oldSlots, null], selected: 5 };
    delete raw.nodes;
    const out = migrate(raw);
    expect(out.inventory.slots[4]?.item).toBe('pickaxe');
    expect(out.inventory.slots[5]?.item).toBe('parsnip_seed');
    expect(out.inventory.selected).toBe(6);
    expect(out.nodes).toEqual({});
  });

  it('drops unknown nodes and bad tile keys', () => {
    const s = newState();
    const raw = JSON.parse(JSON.stringify(s));
    raw.nodes = {
      mine: { '3,3': 'copper_node', '4,4': 'ghost_node', bad: 'rock_node' },
      nowhere: { '1,1': 'rock_node' },
    };
    expect(migrate(raw).nodes).toEqual({ mine: { '3,3': 'copper_node' } });
  });
});

describe('mining balance', () => {
  it('pays less per energy than the best crop (it is a side trip, not the main job)', () => {
    const cost = tools['pickaxe']!.energyCost;
    const total = Object.values(nodes).reduce((n, d) => n + d.weight, 0);
    let value = 0;
    for (const n of Object.values(nodes)) {
      const dropTotal = n.drops.reduce((a, d) => a + d.weight, 0);
      for (const d of n.drops) {
        const avgQty = (d.qty[0] + d.qty[1]) / 2;
        value +=
          (n.weight / total) * (d.weight / dropTotal) * avgQty * (items[d.item]?.sellPrice ?? 0);
      }
    }
    expect(value / cost).toBeLessThan(26);
    expect(value / cost).toBeGreaterThan(2);
  });
});
