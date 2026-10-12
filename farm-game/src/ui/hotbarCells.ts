/**
 * The five-cell hotbar (owner: "make fewer items in the hotbar, with a bigger hotbar"). The eight hotbar slots of the
 * save are unchanged; five bigger cells show them:
 *
 * - cell 0, the tool cell: the hoe, the scythe, the rod and the pickaxe share it. It shows the one selected (or the
 *   last one picked); a tap on it while it is selected moves on to the next tool, so every tool is one to three taps
 *   away (and the tool ring and the Action swipe still reach them in one gesture);
 * - cell 1: the watering can, always in sight (its water level is drawn on it);
 * - cells 2-4: the three item slots (seeds, placeables, goods), as before.
 *
 * Pure (no Phaser), so the HUD, the coach marks, the tests and the e2e harness agree on where a slot is drawn.
 */
import { game, items, tools } from '../data';
import type { ItemStack } from '../state/GameState';

export const HOTBAR_CELLS = 2 + (game.hotbarSlots - game.toolSlots);

/** The tool slot holding the watering can (its own cell), or the second tool slot. */
export function canSlotOf(slots: readonly (ItemStack | null | undefined)[]): number {
  for (let i = 0; i < game.toolSlots; i++) {
    const it = slots[i]?.item;
    if (it && tools[items[it]?.tool ?? '']?.action === 'water') return i;
  }
  return Math.min(1, game.toolSlots - 1);
}

/** The tool slots that share the tool cell (every tool slot but the can's). */
export function toolGroup(slots: readonly (ItemStack | null | undefined)[]): number[] {
  const can = canSlotOf(slots);
  return Array.from({ length: game.toolSlots }, (_, i) => i).filter((i) => i !== can);
}

/** The cell a hotbar slot is drawn in (a tool shares cell 0), or -1 for a bag slot. */
export function cellOfSlot(slot: number, slots: readonly (ItemStack | null | undefined)[]): number {
  if (slot < 0 || slot >= game.hotbarSlots) return -1;
  if (slot === canSlotOf(slots)) return 1;
  if (slot < game.toolSlots) return 0;
  return 2 + (slot - game.toolSlots);
}

/** The hotbar slot each cell shows now: the tool cell shows the selected tool, else the last one picked. */
export function hotbarCells(
  slots: readonly (ItemStack | null | undefined)[],
  selected: number,
  toolPick: number,
): number[] {
  const group = toolGroup(slots);
  const tool = group.includes(selected)
    ? selected
    : group.includes(toolPick)
      ? toolPick
      : (group[0] ?? 0);
  const rest = Array.from({ length: game.hotbarSlots - game.toolSlots }, (_, i) => game.toolSlots + i);
  return [tool, canSlotOf(slots), ...rest];
}

/** The tool after `current` in the tool cell (skipping empty slots), for a tap on the selected tool cell. */
export function nextTool(slots: readonly (ItemStack | null | undefined)[], current: number): number {
  const group = toolGroup(slots).filter((i) => !!slots[i]);
  if (group.length === 0) return current;
  const at = group.indexOf(current);
  return group[(at + 1) % group.length]!;
}
