import { describe, expect, it } from 'vitest';
import {
  addItem,
  countItem,
  cycleSlot,
  removeFromSlot,
  removeItem,
  roomFor,
  selectSlot,
  swapSlots,
} from '../src/systems/inventory';
import { FULL_INVENTORY, newState, TOOL_SLOTS } from './helpers';

describe('inventory', () => {
  it('stacks up to the limit then spills into a new slot', () => {
    const s = newState();
    expect(addItem(s, 'parsnip', 99)).toBe(0);
    expect(addItem(s, 'parsnip', 5)).toBe(0);
    expect(s.inventory.slots.filter((x) => x?.item === 'parsnip').map((x) => x?.qty)).toEqual([
      99, 5,
    ]);
  });

  it('returns the leftover when full instead of losing items silently', () => {
    const s = newState();
    // Every slot that is neither a tool nor the starting seed stack is free.
    const free = TOOL_SLOTS === 0 ? 0 : FULL_INVENTORY / 99 - 1;
    expect(addItem(s, 'melon', free * 99)).toBe(0);
    expect(roomFor(s, 'melon', 1)).toBe(0);
    expect(addItem(s, 'melon', 7)).toBe(7);
    expect(countItem(s, 'melon')).toBe(free * 99);
  });

  it('never places items in tool slots', () => {
    const s = newState();
    addItem(s, 'tomato', 3);
    expect(s.inventory.slots[0]?.item).toBe('hoe');
    expect(s.inventory.slots.findIndex((x) => x?.item === 'tomato')).toBeGreaterThanOrEqual(3);
  });

  it('removing more than owned changes nothing', () => {
    const s = newState();
    expect(removeItem(s, 'parsnip_seed', 11)).toBe(false);
    expect(countItem(s, 'parsnip_seed')).toBe(10);
    expect(removeItem(s, 'parsnip_seed', 4)).toBe(true);
    expect(countItem(s, 'parsnip_seed')).toBe(6);
  });

  it('tools cannot be removed or dropped', () => {
    const s = newState();
    expect(removeItem(s, 'hoe', 1)).toBe(false);
    expect(removeFromSlot(s, 0, 1)).toBe(false);
    expect(s.inventory.slots[0]?.item).toBe('hoe');
  });

  it('empties the slot when the last item is removed', () => {
    const s = newState();
    removeFromSlot(s, TOOL_SLOTS, 10);
    expect(s.inventory.slots[TOOL_SLOTS]).toBeNull();
  });

  it('swaps and merges stacks but never touches tool slots', () => {
    const s = newState();
    addItem(s, 'tomato', 5);
    expect(swapSlots(s, 0, 5)).toBe(false);
    swapSlots(s, TOOL_SLOTS, TOOL_SLOTS + 1);
    expect(s.inventory.slots[TOOL_SLOTS]?.item).toBe('tomato');
    expect(s.inventory.slots[TOOL_SLOTS + 1]?.item).toBe('parsnip_seed');
  });

  it('selection clamps to the hotbar and cycles', () => {
    const s = newState();
    selectSlot(s, 99);
    expect(s.inventory.selected).toBe(7);
    cycleSlot(s, 1);
    expect(s.inventory.selected).toBe(0);
    cycleSlot(s, -1);
    expect(s.inventory.selected).toBe(7);
  });
});
