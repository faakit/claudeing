import { describe, expect, it } from 'vitest';
import { canSlotOf, cellOfSlot, hotbarCells, nextTool, toolGroup } from '../src/ui/hotbarCells';
import { actOn } from '../src/systems/autoTool';
import { selectSlot } from '../src/systems/inventory';
import { runtime } from '../src/state/runtime';
import { newState } from './helpers';

describe('the five-cell hotbar (owner: "fewer items in the hotbar, with a bigger hotbar")', () => {
  it('shows a tool cell, the can, and the three item slots; every hotbar slot has a cell', () => {
    const s = newState();
    const slots = s.inventory.slots;
    expect(canSlotOf(slots)).toBe(1);
    expect(toolGroup(slots)).toEqual([0, 2, 3, 4]);
    expect(hotbarCells(slots, 0, 0)).toEqual([0, 1, 5, 6, 7]);
    // a tool in hand shows in the tool cell; with something else in hand, the last tool picked stays there
    expect(hotbarCells(slots, 3, 0)).toEqual([3, 1, 5, 6, 7]);
    expect(hotbarCells(slots, 5, 3)).toEqual([3, 1, 5, 6, 7]);
    for (let i = 0; i < 8; i++) expect(cellOfSlot(i, slots)).toBeGreaterThanOrEqual(0);
    expect(cellOfSlot(8, slots)).toBe(-1);
    expect([0, 2, 3, 4].map((i) => cellOfSlot(i, slots))).toEqual([0, 0, 0, 0]);
  });

  it('a tap on the tool cell with its tool in hand moves on to the next tool, round to the first', () => {
    const s = newState();
    const slots = s.inventory.slots;
    expect(nextTool(slots, 0)).toBe(2);
    expect(nextTool(slots, 2)).toBe(3);
    expect(nextTool(slots, 4)).toBe(0);
  });
});

describe('scrolling the hotbar (owner: "when we scroll, the item does not change the selected slot")', () => {
  const grass = {
    map: 'farm',
    tx: 10,
    ty: 18,
    kind: 'grass',
    tillable: true,
    blocked: false,
    farmland: true,
    owned: true,
    door: false,
    at: () => null,
  } as never;

  it('a slot picked by hand is what Action uses: auto tool waits until it has acted', () => {
    const s = newState();
    s.settings.controls.autoTool = true;
    selectSlot(s, 1); // scrolled to the can: nothing to water on grass, and auto tool does not swap in the hoe
    expect(runtime.handPick).toBe(true);
    expect(actOn(s, [grass], { quiet: true }).ok).toBe(false);
    expect(s.inventory.selected).toBe(1);
    runtime.handPick = false;
  });

  it('when auto tool uses another slot, the selection moves to it (the highlight shows what was used)', () => {
    const s = newState();
    s.settings.controls.autoTool = true;
    s.inventory.selected = 1;
    runtime.handPick = false;
    const r = actOn(s, [grass]);
    expect(r.ok && r.slot).toBe(0);
    expect(s.inventory.selected).toBe(0);
    expect(runtime.handPick).toBe(false);
  });
});
