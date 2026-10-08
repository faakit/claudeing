import { crops, game, placeables, tools } from '../data';
import {
  registerActionHandler,
  registerToolAction,
  toolActionFor,
} from '../systems/actionRegistry';
import type { TileInfo, ToolActionContext } from '../systems/actionTypes';
import { DIR_VECTORS } from '../systems/direction';
import type { Direction } from '../state/GameState';
import type { GameState } from '../state/GameState';
import { waterCapacity } from '../systems/actions';
import { canAfford, spendEnergy } from '../systems/energy';
import { gameEvents } from '../systems/events';
import {
  checkPlant,
  cropDef,
  getSoil,
  harvest,
  isMature,
  plant,
  till,
  tileKey,
  water,
} from '../systems/farming';
import { addStat } from '../systems/goals';
import { addItem, removeFromSlot, roomFor } from '../systems/inventory';
import { sellValue } from '../systems/itemRef';
import { placedAt, placeObject } from '../systems/placeables';
import { addXp } from '../systems/skills';
import { inGreenhouse } from '../systems/plots';

const TIRED = 'Too tired! Go to bed.';

/** Harvesting a mature crop beats whatever is equipped, so players never swap tools to collect. */
registerActionHandler({
  id: 'harvest',
  priority: 100,
  plan({ state, tile }) {
    if (!tile.farmland) return null;
    const soil = getSoil(state, tile.tx, tile.ty);
    if (!soil?.crop || !isMature(soil.crop)) return null;
    const def = cropDef(soil.crop);
    if (roomFor(state, def.harvestItem, def.harvestQuantity) < def.harvestQuantity)
      return { refusal: 'Inventory full!' };
    return {
      plan: {
        kind: 'harvest',
        tx: tile.tx,
        ty: tile.ty,
        run: () => {
          const res = harvest(state, tile.tx, tile.ty);
          if (!res.ok) throw new Error('harvest was planned but failed');
          addStat(state, 'harvested', res.qty);
          if (res.q > 0) addStat(state, 'qualityHarvested', res.qty);
          if (inGreenhouse(state, tile.tx, tile.ty)) addStat(state, 'greenhouseHarvested', res.qty);
          addXp(
            state,
            'farming',
            Math.max(2, Math.round(sellValue({ item: res.item, q: res.q }) * 0.12 * res.qty)),
          );
          return { item: res.item, qty: res.qty, q: res.q };
        },
      },
    };
  },
});

registerActionHandler({
  id: 'seed',
  priority: 50,
  plan({ state, tile, stack, def }) {
    if (!stack || def?.type !== 'seed') return null;
    if (!tile.farmland) return { refusal: "Seeds need your farm's soil." };
    const cropId = def.plants as string;
    const check = checkPlant(state, tile.tx, tile.ty, cropId);
    if (check === 'no_soil') return { refusal: 'Till the soil first.' };
    if (check === 'occupied') return { refusal: 'Something is already growing here.' };
    if (check === 'out_of_season') {
      const when = (crops[cropId]?.seasons ?? []).join(' or ');
      return { refusal: `Won't grow in ${state.time.season}. Plant in ${when}.` };
    }
    const grow = (crops[cropId]?.stageDays ?? []).reduce((a, b) => a + b, 0);
    if (!inGreenhouse(state, tile.tx, tile.ty) && grow >= game.seasonLength - state.time.day + 1)
      return { refusal: `Won't ripen in time (${grow} days). Save it for next season.` };
    // Seeds follow the hoe: a hoe that tills N in a row lets you sow the same row in one press.
    const row = lineFrom(tile, state.player.facing, upgradeLvl(state, 'hoe'))
      .filter((t) => t.farmland && checkPlant(state, t.tx, t.ty, cropId) === 'ok')
      .slice(0, stack.qty);
    return {
      plan: {
        kind: 'plant',
        tx: tile.tx,
        ty: tile.ty,
        run: () => {
          for (const t of row) {
            plant(state, t.tx, t.ty, cropId);
            removeFromSlot(state, state.inventory.selected, 1);
          }
          addStat(state, 'planted', row.length);
          addXp(state, 'farming', row.length);
          return { count: row.length };
        },
      },
    };
  },
});

/** Fertilizer goes on tilled soil; it improves the next harvest and is used up by it. */
registerActionHandler({
  id: 'fertilize',
  priority: 50,
  plan({ state, tile, stack, def }) {
    if (!stack || def?.type !== 'fertilizer') return null;
    if (!tile.farmland) return { refusal: "Fertilizer needs your farm's soil." };
    const soil = getSoil(state, tile.tx, tile.ty);
    if (!soil) return { refusal: 'Till the soil first.' };
    if (soil.fert) return { refusal: 'Already fertilized.' };
    return {
      plan: {
        kind: 'fertilize',
        tx: tile.tx,
        ty: tile.ty,
        run: () => {
          soil.fert = stack.item;
          removeFromSlot(state, state.inventory.selected, 1);
          gameEvents.emit('farmChanged', undefined);
          addStat(state, 'fertilized');
          return { item: stack.item };
        },
      },
    };
  },
});

/** Sprinklers, jars and other placeables go on free farm ground. */
registerActionHandler({
  id: 'place',
  priority: 50,
  plan({ state, tile, stack, def }) {
    if (!stack || !def?.placeable) return null;
    if (!tile.farmland || !tile.tillable || tile.blocked)
      return { refusal: "Can't place that here." };
    const soil = state.farm.tiles[tileKey(tile.tx, tile.ty)];
    if (soil?.crop) return { refusal: "Can't place on a growing crop." };
    if (placedAt(state, tile.map, tile.tx, tile.ty))
      return { refusal: 'Something is already here.' };
    const max = Number(placeables[stack.item]?.params['max'] ?? Infinity);
    const have = Object.values(state.placed).reduce(
      (n, list) => n + list.filter((o) => o.type === stack.item).length,
      0,
    );
    if (have >= max) return { refusal: `You can only have ${max} of these.` };
    return {
      plan: {
        kind: 'place',
        tx: tile.tx,
        ty: tile.ty,
        run: () => {
          delete state.farm.weeds[tileKey(tile.tx, tile.ty)];
          delete state.farm.tiles[tileKey(tile.tx, tile.ty)];
          removeFromSlot(state, state.inventory.selected, 1);
          placeObject(state, tile.map, tile.tx, tile.ty, stack.item);
          addStat(state, 'placed');
          if (def.type === 'sapling') addStat(state, 'treesPlanted');
          if (placeables[stack.item]?.behavior === 'decor') addStat(state, 'decorPlaced');
          return { item: stack.item };
        },
      },
    };
  },
});

/** Anything else: tools dispatch on their `action`; other items just can't be used. */
registerActionHandler({
  id: 'tool',
  priority: 40,
  plan(ctx) {
    const { def, stack } = ctx;
    if (!stack || !def) return { refusal: 'Nothing equipped.' };
    if (def.type !== 'tool' || !def.tool) return { refusal: `Can't use ${def.name} here.` };
    const tool = tools[def.tool];
    if (!tool) throw new Error(`Tool "${def.tool}" missing from tools.json`);
    const impl = toolActionFor(tool.action);
    if (!impl) return { refusal: `Nothing happens.` };
    return impl({ ...ctx, toolId: stack.item, tool } as ToolActionContext);
  },
});

/** Tiles an area tool covers: the target tile plus `extra` more in a line away from the player. */
function lineFrom(tile: TileInfo, facing: Direction, extra: number): TileInfo[] {
  const v = DIR_VECTORS[facing];
  const out = [tile];
  for (let i = 1; i <= extra && tile.at; i++) {
    const next = tile.at(tile.tx + v.x * i, tile.ty + v.y * i);
    if (!next) break;
    out.push(next);
  }
  return out;
}

const upgradeLvl = (state: GameState, id: 'hoe' | 'can' | 'rod'): number => state.upgrades[id];

function canTill(state: GameState, t: TileInfo): boolean {
  return (
    t.farmland &&
    t.tillable &&
    !t.blocked &&
    t.owned !== false &&
    !state.farm.tiles[tileKey(t.tx, t.ty)] &&
    !placedAt(state, t.map, t.tx, t.ty)
  );
}

registerToolAction('till', ({ state, tile, tool }) => {
  if (tile.farmland && state.farm.tiles[tileKey(tile.tx, tile.ty)])
    return { refusal: 'Already tilled.' };
  if (tile.farmland && tile.owned === false)
    return { refusal: 'Not your land yet. Buy it at a sign.' };
  if (!canTill(state, tile)) return { refusal: "Can't till here." };
  if (!canAfford(state, tool.energyCost)) return { refusal: TIRED };
  // A better hoe breaks several tiles in a row for the same energy.
  const targets = lineFrom(tile, state.player.facing, upgradeLvl(state, 'hoe')).filter((t) =>
    canTill(state, t),
  );
  return {
    plan: {
      kind: 'till',
      tx: tile.tx,
      ty: tile.ty,
      run: () => {
        spendEnergy(state, tool.energyCost);
        for (const t of targets) till(state, t.tx, t.ty);
        addStat(state, 'tilled', targets.length);
        return { count: targets.length };
      },
    },
  };
});

function needsWater(state: GameState, t: TileInfo): boolean {
  const soil = t.farmland ? getSoil(state, t.tx, t.ty) : undefined;
  return !!soil && !soil.watered;
}

registerToolAction('water', ({ state, tile, tool }) => {
  const soil = tile.farmland ? getSoil(state, tile.tx, tile.ty) : undefined;
  if (tile.kind === 'water') {
    if (state.water >= waterCapacity(state)) return { refusal: 'The can is already full.' };
    return {
      plan: {
        kind: 'refill',
        tx: tile.tx,
        ty: tile.ty,
        run: () => {
          state.water = waterCapacity(state);
          gameEvents.emit('energyChanged', undefined);
          return {};
        },
      },
    };
  }
  if (!soil) return { refusal: 'Nothing to water here.' };
  if (soil.watered) return { refusal: 'Already watered.' };
  if (state.water <= 0) return { refusal: 'Can is empty. Refill at the pond.' };
  if (!canAfford(state, tool.energyCost)) return { refusal: TIRED };
  // A bigger can waters a line of crops with one swing, as far as the water lasts.
  const targets = lineFrom(tile, state.player.facing, upgradeLvl(state, 'can'))
    .filter((t) => needsWater(state, t))
    .slice(0, state.water);
  return {
    plan: {
      kind: 'water',
      tx: tile.tx,
      ty: tile.ty,
      run: () => {
        spendEnergy(state, tool.energyCost);
        state.water -= targets.length;
        for (const t of targets) water(state, t.tx, t.ty);
        addStat(state, 'watered', targets.length);
        return { count: targets.length };
      },
    },
  };
});

registerToolAction('clear', ({ state, tile, tool }) => {
  const key = tileKey(tile.tx, tile.ty);
  if (!tile.farmland || !state.farm.weeds[key]) return { refusal: 'Nothing to cut.' };
  if (roomFor(state, 'fiber', 1) < 1) return { refusal: 'Inventory full!' };
  if (!canAfford(state, tool.energyCost)) return { refusal: TIRED };
  return {
    plan: {
      kind: 'clear',
      tx: tile.tx,
      ty: tile.ty,
      run: () => {
        spendEnergy(state, tool.energyCost);
        delete state.farm.weeds[key];
        addItem(state, 'fiber', 1);
        gameEvents.emit('farmChanged', undefined);
        addStat(state, 'cleared');
        return { item: 'fiber', qty: 1 };
      },
    },
  };
});
