import { crops, game, placeables, plots, tools } from '../data';
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
import { isChannel } from '../systems/channels';
import { canAfford, spendEnergy } from '../systems/energy';
import { gameEvents } from '../systems/events';
import {
  checkPlant,
  cropDef,
  getSoil,
  harvest,
  isMature,
  lastsOneSeason,
  plant,
  till,
  tileKey,
  water,
} from '../systems/farming';
import { addStat } from '../systems/goals';
import { addItem, removeFromSlot, roomFor } from '../systems/inventory';
import { sellValue } from '../systems/itemRef';
import { placedAt, placeObject, restoreStored } from '../systems/placeables';
import { addXp } from '../systems/skills';
import { inGreenhouse, ownsPlot, plotAtTile } from '../systems/plots';
import { villagerSpot } from '../systems/npcs';
import { tiredText } from '../systems/food';
import { deltaRefusal, inDelta } from '../systems/valley';
import { t } from '../i18n';
import { seasonLower } from '../systems/time';

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
      return { refusal: t('common.inventoryFull') };
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
    if (!tile.farmland) return { refusal: t('farm.seedsSoil') };
    const cropId = def.plants as string;
    const check = checkPlant(state, tile.tx, tile.ty, cropId);
    if (check === 'no_soil') return { refusal: t('farm.tillFirst') };
    if (check === 'occupied') return { refusal: t('farm.growingHere') };
    if (check === 'out_of_season') {
      const when = (crops[cropId]?.seasons ?? []).map(seasonLower).join(t('common.or'));
      return {
        refusal: t('farm.outOfSeason', { season: seasonLower(state.time.season), when }),
      };
    }
    const grow = (crops[cropId]?.stageDays ?? []).reduce((a, b) => a + b, 0);
    const late = grow >= game.seasonLength - state.time.day + 1;
    if (late && !inGreenhouse(state, tile.tx, tile.ty))
      return { refusal: t('farm.tooLateSeason', { n: grow }) };
    // Under glass the season does not matter, except that regrowing plants are spent when it ends.
    if (late && lastsOneSeason(cropId)) return { refusal: t('farm.tooLateGlass', { n: grow }) };
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
    if (!tile.farmland) return { refusal: t('farm.fertSoil') };
    const soil = getSoil(state, tile.tx, tile.ty);
    if (!soil) return { refusal: t('farm.tillFirst') };
    if (soil.fert) return { refusal: t('farm.fertilized') };
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
    // where the map changes with the valley's stage (the old creek bed), nothing may be placed (WORLD-PLAN 4.2.2)
    const stageOnly = deltaRefusal(tile.map, tile.tx, tile.ty);
    if (stageOnly) return { refusal: stageOnly };
    if (!tile.farmland || !tile.tillable || tile.blocked) return { refusal: t('farm.cantPlace') };
    const soil = state.farm.tiles[tileKey(tile.tx, tile.ty)];
    if (soil?.crop) return { refusal: t('farm.cantPlaceCrop') };
    // a channel is filled in with the spade (its energy), never for free under a sprinkler
    if (isChannel(soil)) return { refusal: t('farm.cantPlaceChannel') };
    if (placedAt(state, tile.map, tile.tx, tile.ty)) return { refusal: t('farm.somethingHere') };
    if (villagerSpot(tile.map, tile.tx, tile.ty)) return { refusal: t('farm.someoneStands') };
    // Land for sale (or a project's site) is not yours yet: placing is refused just like tilling.
    const plot = tile.map === 'farm' ? plotAtTile(tile.tx, tile.ty) : null;
    if (plot && !ownsPlot(state, plot))
      return {
        refusal: plots[plot]?.project
          ? t('farm.willStandFund', { name: plots[plot]?.name ?? plot })
          : t('farm.notYourLand'),
      };
    const max = Number(placeables[stack.item]?.params['max'] ?? Infinity);
    const have = Object.values(state.placed).reduce(
      (n, list) => n + list.filter((o) => o.type === stack.item).length,
      0,
    );
    if (have >= max) return { refusal: t('farm.onlyMax', { n: max }) };
    return {
      plan: {
        kind: 'place',
        tx: tile.tx,
        ty: tile.ty,
        run: () => {
          delete state.farm.weeds[tileKey(tile.tx, tile.ty)];
          delete state.farm.tiles[tileKey(tile.tx, tile.ty)];
          removeFromSlot(state, state.inventory.selected, 1);
          const obj = placeObject(state, tile.map, tile.tx, tile.ty, stack.item);
          if (restoreStored(state, obj)) gameEvents.emit('placedChanged', { map: tile.map });
          addStat(state, 'placed');
          if (def.type === 'sapling') addStat(state, 'treesPlanted');
          // The decoration goal counts decorations standing at once, so moving one about earns nothing.
          if (placeables[stack.item]?.behavior === 'decor') {
            const standing = Object.values(state.placed)
              .flat()
              .filter((o) => placeables[o.type]?.behavior === 'decor').length;
            const best = state.stats['decorPlaced'] ?? 0;
            if (standing > best) addStat(state, 'decorPlaced', standing - best);
          }
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
    if (!stack || !def) return { refusal: t('farm.nothingEquipped') };
    if (def.type !== 'tool' || !def.tool) return { refusal: t('farm.cantUse', { item: def.name }) };
    const tool = tools[def.tool];
    if (!tool) throw new Error(`Tool "${def.tool}" missing from tools.json`);
    const impl = toolActionFor(tool.action);
    if (!impl) return { refusal: t('farm.nothingHappens') };
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
    !placedAt(state, t.map, t.tx, t.ty) &&
    !inDelta(t.map, t.tx, t.ty)
  );
}

registerToolAction('till', ({ state, tile, tool }) => {
  // the old creek bed answers first: it lies in no plot, so the land refusal below would claim it is for sale
  const stageOnly = tile.farmland ? deltaRefusal(tile.map, tile.tx, tile.ty) : null;
  if (stageOnly) return { refusal: stageOnly };
  if (tile.farmland && state.farm.tiles[tileKey(tile.tx, tile.ty)])
    return { refusal: t('farm.tilled') };
  if (tile.farmland && tile.owned === false) return { refusal: t('farm.notYourLand') };
  if (!canTill(state, tile)) return { refusal: t('farm.cantTill') };
  if (!canAfford(state, tool.energyCost)) return { refusal: tiredText(state) };
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
    if (state.water >= waterCapacity(state)) return { refusal: t('farm.canFull') };
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
  if (!soil) return { refusal: t('farm.nothingToWater') };
  if (soil.watered) return { refusal: t('farm.watered') };
  if (state.water <= 0) return { refusal: t('farm.canEmpty') };
  if (!canAfford(state, tool.energyCost)) return { refusal: tiredText(state) };
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

/**
 * Fiber a cut weed gives (tutorial review: two a weed plus big grass bundles made fiber free; one a weed keeps a
 * day's light gathering at the first recipes, never a wall; dry-grass bundles give 2: forage.json).
 */
export const FIBER_PER_WEED = 1;

registerToolAction('clear', ({ state, tile, tool }) => {
  const key = tileKey(tile.tx, tile.ty);
  if (!tile.farmland || !state.farm.weeds[key]) return { refusal: t('farm.nothingToCut') };
  if (roomFor(state, 'fiber', 1) < 1) return { refusal: t('common.inventoryFull') };
  if (!canAfford(state, tool.energyCost)) return { refusal: tiredText(state) };
  return {
    plan: {
      kind: 'clear',
      tx: tile.tx,
      ty: tile.ty,
      run: () => {
        spendEnergy(state, tool.energyCost);
        delete state.farm.weeds[key];
        // one fiber a weed, if the bag has room
        const qty = Math.min(FIBER_PER_WEED, roomFor(state, 'fiber', FIBER_PER_WEED));
        addItem(state, 'fiber', qty);
        gameEvents.emit('farmChanged', undefined);
        addStat(state, 'cleared');
        return { item: 'fiber', qty };
      },
    },
  };
});
