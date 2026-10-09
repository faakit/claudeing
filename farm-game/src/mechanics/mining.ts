import { tiredText } from '../systems/food';
import { items, mining } from '../data';
import { registerActionHandler, registerToolAction } from '../systems/actionRegistry';
import { registerDayHook } from '../systems/dayHooks';
import { canAfford, spendEnergy } from '../systems/energy';
import { addStat } from '../systems/goals';
import { roomFor } from '../systems/inventory';
import { mineNode, nodeAt, spawnNodes } from '../systems/mining';
import { addXp } from '../systems/skills';

/** The pickaxe breaks the ore node in front of you. Nodes are solid, so you always face one to mine it. */
registerToolAction('mine', ({ state, tile, tool }) => {
  if (!nodeAt(state, tile.map, tile.tx, tile.ty)) return { refusal: 'Nothing to mine here.' };
  if (!canAfford(state, tool.energyCost)) return { refusal: tiredText(state) };
  if (roomFor(state, 'stone', 1) < 1) return { refusal: 'Inventory full!' };
  return {
    plan: {
      kind: 'mine',
      tx: tile.tx,
      ty: tile.ty,
      run: () => {
        spendEnergy(state, tool.energyCost);
        const res = mineNode(state, tile.map, tile.tx, tile.ty);
        if (!res.ok) throw new Error('mining was planned but failed');
        addStat(state, 'mined');
        addXp(state, 'mining', res.xp);
        return { item: res.item, qty: res.qty, name: items[res.item]?.name };
      },
    },
  };
});

// Facing ore with the wrong item in hand: say what to do instead of a vague refusal.
registerActionHandler({
  id: 'node-hint',
  priority: 96,
  plan({ state, tile, def }) {
    if (!nodeAt(state, tile.map, tile.tx, tile.ty) || def?.tool === 'pickaxe') return null;
    return { refusal: 'Break it with the pickaxe (swipe the Action button to switch).' };
  },
});

// New ore appears in the mine every morning.
registerDayHook({
  id: 'mining:spawn',
  phase: 'morning',
  order: 14,
  run(state, ctx) {
    const made = spawnNodes(state, ctx.oreSpots ?? {});
    const total = Object.values(made).reduce((a, b) => a + b, 0);
    if (total > 0 && mining.maps.length > 0) ctx.notes.push('Fresh ore in the mine.');
  },
});
