import { describe, expect, it } from 'vitest';
import {
  canDig,
  channelKeys,
  digChannel,
  fillChannel,
  flowReach,
  waterFromChannels,
  wateredByChannels,
} from '../src/systems/channels';
import type { GameState } from '../src/state/GameState';
import { equip, newState, grass } from './helpers';
import { plots } from '../src/data';
import { performAction } from '../src/systems/actions';
import { addItem } from '../src/systems/inventory';
import '../src/mechanics';
import { actOn, chooseAction } from '../src/systems/autoTool';
import { endDay } from '../src/systems/day';
import { migrate } from '../src/systems/save';
import { runtime } from '../src/state/runtime';
import { diggable, landRefusal } from '../src/mechanics/channels';

// A creek down x = 26 (as the farm's restored variant), nothing else wet.
const creek = (x: number): boolean => x === 26;
const noDelta = (): boolean => false;
const till = (s: GameState, x: number, y: number) =>
  (s.farm.tiles[`${x},${y}`] = { watered: false, crop: null });

/** A straight channel west from the creek along row y, `n` tiles long. */
function row(s: GameState, y: number, n: number): void {
  for (let i = 1; i <= n; i++) digChannel(s, 26 - i, y);
}

describe('channels', () => {
  it('the water reaches exactly `flow` channel tiles, breadth-first from the creek', () => {
    const s = newState();
    row(s, 10, 30);
    const reach = flowReach(s, creek, 24);
    expect(reach).toHaveLength(24);
    expect(reach[0]).toBe('25,10');
    expect(reach[23]).toBe('2,10');
    expect(reach).not.toContain('1,10');
  });

  it('a channel not joined to the creek gets no water', () => {
    const s = newState();
    digChannel(s, 10, 5);
    digChannel(s, 11, 5);
    expect(flowReach(s, creek, 24)).toEqual([]);
  });

  it('branches share the flow evenly by distance (two arms of 4 each with flow 8 plus the stem)', () => {
    const s = newState();
    row(s, 10, 2); // stem 25,10 and 24,10
    for (let i = 1; i <= 5; i++) {
      digChannel(s, 24, 10 - i);
      digChannel(s, 24, 10 + i);
    }
    const reach = flowReach(s, creek, 8);
    expect(reach).toHaveLength(8);
    const up = reach.filter((k) => Number(k.split(',')[1]) < 10).length;
    const down = reach.filter((k) => Number(k.split(',')[1]) > 10).length;
    expect(Math.abs(up - down)).toBeLessThanOrEqual(1);
  });

  it('only tilled soil beside a reached channel is watered, at most 2 x flow tiles', () => {
    const s = newState();
    row(s, 10, 6);
    for (let x = 20; x <= 25; x++) {
      till(s, x, 9);
      till(s, x, 11);
    }
    till(s, 20, 13); // not beside a channel
    const n = waterFromChannels(s, creek, 24);
    expect(n).toBe(12);
    expect(s.farm.tiles['20,13']!.watered).toBe(false);
    expect(s.farm.tiles['25,9']!.watered).toBe(true);
    // a long channel lined on both sides waters no more than 2 x flow
    const t = newState();
    row(t, 10, 40);
    for (let x = 0; x <= 25; x++) {
      till(t, x, 9);
      till(t, x, 11);
    }
    const reach = flowReach(t, creek, 24);
    expect(wateredByChannels(t, reach, 24).length).toBeLessThanOrEqual(48);
  });

  it('digging starts next to water and follows a channel; refusals change nothing', () => {
    const s = newState();
    expect(canDig(s, 20, 10, creek, noDelta)).toBe('Start next to water.');
    expect(canDig(s, 25, 10, creek, noDelta)).toBeNull();
    digChannel(s, 25, 10);
    expect(canDig(s, 24, 10, creek, noDelta)).toBeNull();
    till(s, 24, 11);
    expect(canDig(s, 24, 11, creek, noDelta)).toBe('Something is already here.');
    expect(canDig(s, 25, 9, creek, () => true)).toBe('The old creek bed. Best left clear.');
    const before = JSON.stringify(s.farm.tiles);
    canDig(s, 1, 1, creek, noDelta);
    expect(JSON.stringify(s.farm.tiles)).toBe(before);
  });

  it('filling a channel in leaves plain ground', () => {
    const s = newState();
    digChannel(s, 25, 10);
    expect(fillChannel(s, 25, 10)).toBe(true);
    expect(channelKeys(s)).toEqual([]);
    expect(fillChannel(s, 25, 10)).toBe(false);
  });
});

describe('channels in play (mechanics/channels.ts)', () => {
  /** The spring restored, the spade on the hotbar, standing on the creek's west bank at (25, y). */
  function restored(y = 14): GameState {
    const s = newState();
    s.stats['valley.farmGreen'] = 1;
    s.stats['place.spring'] = 3;
    s.inventory.slots[6] = { item: 'spade', qty: 1 };
    s.player.x = 25 * 16 + 8;
    s.player.y = y * 16 + 11;
    return s;
  }
  const grassAt = (tx: number, ty: number) => ({
    ...grass(tx, ty),
    at: (x: number, y: number) => grass(x, y),
  });

  it('one dig from the bank cuts the bank tile too, and the water reaches the new cut', () => {
    const s = restored();
    s.inventory.selected = 6;
    const res = actOn(s, [grassAt(24, 14)]);
    expect(res.ok && res.kind).toBe('dig');
    expect(channelKeys(s).sort()).toEqual(['24,14', '25,14']);
    expect(res.ok && (res as { wet?: boolean }).wet).toBe(true);
  });

  it('a row of digs west from the bank, then the morning waters the soil beside it', () => {
    const s = restored();
    s.inventory.selected = 6;
    for (let x = 24; x >= 19; x--) {
      const r = actOn(s, [grassAt(x, 14)]);
      expect(r.ok, `dig ${x}`).toBe(true);
    }
    for (let x = 19; x <= 24; x++) till(s, x, 15);
    endDay(s, { passedOut: false, weedCandidates: [] });
    if (s.weather === 'sunny')
      for (let x = 19; x <= 24; x++) expect(s.farm.tiles[`${x},15`]!.watered).toBe(true);
    expect(channelKeys(s)).toHaveLength(7);
  });

  it('channels go on any open farm ground; an unbought plot, a door or a wall refuses; a path takes a culvert', () => {
    const s = restored();
    s.inventory.selected = 6;
    digChannel(s, 25, 12);
    // (24, 12) is the Hilltop, for sale: refused with the sign's line
    const hill = actOn(s, [grassAt(24, 12)]);
    expect(hill.ok).toBe(false);
    expect(landRefusal(s, 24, 12)).toBe('Not your land yet. Buy it at a sign.');
    // the Greenhouse plot has no sign: it says what will stand there
    expect(landRefusal(s, 18, 27)).toBe('The Greenhouse will stand here.');
    expect(landRefusal(s, 25, 14)).toBeNull(); // unplotted ground
    expect(diggable({ ...grass(14, 20), kind: 'path', tillable: false })).toBe(true);
    expect(diggable({ ...grass(29, 3), kind: 'path', tillable: false, door: true })).toBe(false);
    expect(diggable({ ...grass(12, 5), kind: 'wall', tillable: false, blocked: true })).toBe(false);
  });

  it('nothing runs before the spring is restored; refusals change nothing', () => {
    const s = restored();
    s.stats['place.spring'] = 2;
    s.inventory.selected = 6;
    const before = JSON.stringify(s.farm.tiles);
    const r = actOn(s, [grassAt(24, 14)]);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(s.farm.tiles)).toBe(before);
  });

  it('Action on a channel fills it in (never while a painted row is being worked)', () => {
    const s = restored();
    s.inventory.selected = 6;
    actOn(s, [grassAt(24, 14)]);
    runtime.paintWork = true;
    expect(actOn(s, [grassAt(24, 14)]).ok).toBe(false);
    runtime.paintWork = false;
    const r = actOn(s, [grassAt(24, 14)]);
    expect(r.ok && r.kind).toBe('fill');
    expect(channelKeys(s)).toEqual(['25,14']);
  });

  it('the auto tool never picks the spade; nothing grows in a channel', () => {
    const s = restored();
    digChannel(s, 25, 14);
    s.inventory.selected = 0; // the hoe in hand, auto tool on
    const c = chooseAction(s, [grassAt(24, 14)]);
    expect(c?.plan.kind).not.toBe('dig');
    s.inventory.slots[7] = { item: 'parsnip_seed', qty: 5 };
    s.inventory.selected = 7;
    expect(actOn(s, [grassAt(25, 14)]).ok).toBe(false);
    expect(s.farm.tiles['25,14']!.crop).toBeNull();
  });

  it('balance: a channel field waters at most 2 x flow tiles, what six quality sprinklers cover', () => {
    const s = restored();
    for (let x = 0; x <= 25; x++) {
      digChannel(s, x, 14);
      till(s, x, 11);
      till(s, x, 15);
    }
    const n = waterFromChannels(s, creek, 24);
    expect(n).toBeLessThanOrEqual(48);
    expect(n).toBeLessThanOrEqual(6 * 8);
  });
});

describe('save v18 (the Dry Year bump)', () => {
  it('migrates a v17 save and keeps all four new fields; damaged values are repaired', () => {
    const s = newState();
    s.farm.tiles['20,12'] = { watered: true, crop: null, channel: true };
    s.farm.tiles['21,12'] = {
      watered: false,
      crop: { cropId: 'parsnip', stage: 4, daysInStage: 0, regrow: false, tag: true, ripeFor: 2 },
    };
    s.settings.strikeOffset = 60;
    const raw = JSON.parse(JSON.stringify({ ...s, version: 17 }));
    const back = migrate(raw);
    expect(back.version).toBe(18);
    expect(back.farm.tiles['20,12']).toEqual({ watered: false, crop: null, channel: true });
    expect(back.farm.tiles['21,12']!.crop).toMatchObject({ tag: true, ripeFor: 2 });
    expect(back.settings.strikeOffset).toBe(60);
    raw.settings.strikeOffset = 999;
    raw.farm.tiles['20,12'].crop = { cropId: 'parsnip', stage: 1, daysInStage: 0, regrow: false };
    raw.farm.tiles['21,12'].crop.tag = 'yes';
    const fixed = migrate(raw);
    expect(fixed.settings.strikeOffset).toBe(150);
    expect(fixed.farm.tiles['20,12']!.crop).toBeNull();
    expect(fixed.farm.tiles['21,12']!.crop!.tag).toBeUndefined();
    const old = migrate(JSON.parse(JSON.stringify({ ...newState(), version: 17 })));
    expect(old.settings.strikeOffset).toBeUndefined();
  });
});

describe('placing over a channel', () => {
  it('is refused, and the channel stays (placing used to fill it in for free)', () => {
    const s = newState();
    s.stats['place.spring'] = 3;
    s.stats['valley.farmGreen'] = 1;
    s.plots = Object.keys(plots);
    row(s, 10, 5);
    addItem(s, 'sprinkler', 1);
    equip(s, 'sprinkler');
    const r = performAction(s, grass(23, 10));
    expect(r.ok).toBe(false);
    expect(s.farm.tiles['23,10']?.channel).toBe(true);
    expect(s.placed['farm'] ?? []).toHaveLength(0);
  });
});
