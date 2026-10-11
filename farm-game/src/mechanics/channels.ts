import { plots, valley } from '../data';
import type { TileInfo } from '../systems/actionTypes';
import { ownsPlot, plotAtTile } from '../systems/plots';
import type { GameState } from '../state/GameState';
import { registerActionHandler } from '../systems/actionRegistry';
import {
  canDig,
  digChannel,
  fillChannel,
  flowReach,
  isChannel,
  waterFromChannels,
} from '../systems/channels';
import { registerDayHook } from '../systems/dayHooks';
import { canAfford, spendEnergy } from '../systems/energy';
import { gameEvents, toast } from '../systems/events';
import { absoluteDay } from '../systems/time';
import { tiredText } from '../systems/food';
import { addStat } from '../systems/goals';
import { channelFlow, creekSource } from '../systems/valley';
import { runtime } from '../state/runtime';

// Channels: the Old Spring's verb (docs/WORLD-PLAN.md 3.1). Ilse's spade digs off the running creek; each morning
// the water runs along the connected channels (up to the flow) and waters the soil beside them.

/** Said when a cut lies past the spring's flow (WORLD-PLAN 3.1). */
export const DRY_CUT = 'The water runs out before here.';
/**
 * Where a channel may go: open ground (grass, dirt, a patch of flowers) or across a path as a culvert under it (the
 * path keeps its look and stays a path), never a door, a building or anything solid.
 */
export function diggable(t: TileInfo | null): boolean {
  if (!t || t.blocked || t.door || !t.farmland) return false;
  return t.tillable || t.kind === 'flower' || t.kind === 'path';
}

/** Unbought land: a plot for sale ("Buy it at a sign"), or a project's plot. Unplotted farm ground is free. */
export function landRefusal(state: GameState, tx: number, ty: number): string | null {
  const plot = plotAtTile(tx, ty);
  if (!plot || ownsPlot(state, plot)) return null;
  return plots[plot]?.sign
    ? 'Not your land yet. Buy it at a sign.'
    : `The ${plots[plot]?.name} will stand here.`;
}

/** Energy per tile dug or filled. */
export const SPADE_ENERGY = 2;
const key = (x: number, y: number): string => `${x},${y}`;

registerActionHandler({
  id: 'dig-channel',
  priority: 45,
  plan({ state, tile, stack }) {
    if (stack?.item !== 'spade') return null;
    if (!tile.farmland) return { refusal: 'Channels belong on the farm.' };
    const source = creekSource(state);
    const here = state.farm.tiles[key(tile.tx, tile.ty)];
    if (isChannel(here)) {
      // a painted row digs on: it never fills in the channel it just cut (or one it crosses)
      if (runtime.paintWork) return null;
      if (!canAfford(state, SPADE_ENERGY)) return { refusal: tiredText(state) };
      return {
        plan: {
          kind: 'fill',
          tx: tile.tx,
          ty: tile.ty,
          run: () => {
            spendEnergy(state, SPADE_ENERGY);
            fillChannel(state, tile.tx, tile.ty);
            gameEvents.emit('farmChanged', undefined);
            return {};
          },
        },
      };
    }
    // Channels go on any open farm ground (owner ruling): only an unbought plot says so, never ground no sign sells
    const land = landRefusal(state, tile.tx, tile.ty);
    if (land) return { refusal: land };
    if (!diggable(tile)) return { refusal: "Can't dig here." };
    const inDeltaFarm = (x: number, y: number) => source.inDelta(x, y);
    // Starting from the bank: the farmer's own tile beside the creek is cut too, so one drag from the bank digs a
    // channel that reaches the water.
    const p = state.player;
    const me = { tx: Math.floor(p.x / 16), ty: Math.floor((p.y - 3) / 16) };
    let refusal = canDig(state, tile.tx, tile.ty, source.at, inDeltaFarm);
    let bank = false;
    if (
      refusal === 'Start next to water.' &&
      Math.abs(me.tx - tile.tx) + Math.abs(me.ty - tile.ty) === 1 &&
      canDig(state, me.tx, me.ty, source.at, inDeltaFarm) === null &&
      !landRefusal(state, me.tx, me.ty) &&
      (tile.at ? diggable(tile.at(me.tx, me.ty)) : true)
    ) {
      refusal = null;
      bank = true;
    }
    if (refusal) return { refusal };
    const cost = SPADE_ENERGY * (bank ? 2 : 1);
    if (!canAfford(state, cost)) return { refusal: tiredText(state) };
    return {
      plan: {
        kind: 'dig',
        tx: tile.tx,
        ty: tile.ty,
        run: () => {
          spendEnergy(state, cost);
          if (bank) digChannel(state, me.tx, me.ty);
          digChannel(state, tile.tx, tile.ty);
          addStat(state, 'channelsDug', bank ? 2 : 1);
          gameEvents.emit('farmChanged', undefined);
          // does the water reach the new cut? (the dig's splash; the soil beside it is watered from tomorrow)
          const wet =
            source.running &&
            flowReach(state, source.at, channelFlow(state)).includes(key(tile.tx, tile.ty));
          // past the flow the cut stays dry, and says so (once a day, so a painted row does not repeat it)
          if (!wet && source.running && state.stats['channels.dryDay'] !== absoluteDay(state)) {
            state.stats['channels.dryDay'] = absoluteDay(state);
            toast(DRY_CUT, 'info');
          }
          return { wet };
        },
      },
    };
  },
});

// Each morning, as rain does: the water runs down the channels and waters the soil beside them (so it shows
// watered on stepping out, and that night's growth counts it).
registerDayHook({
  id: 'channels:water',
  phase: 'morning',
  order: 10,
  run(state, ctx) {
    const source = creekSource(state);
    if (!source.running) return;
    const n = waterFromChannels(state, source.at, channelFlow(state));
    if (n > 0) ctx.scratch['channelsWatered'] = n;
  },
});

/** The flows a spring's channels can carry (valley.json `spring.flow`), for the dev tools and tests. */
export const SPRING_FLOW = valley.places['spring']?.flow ?? [24, 64];
