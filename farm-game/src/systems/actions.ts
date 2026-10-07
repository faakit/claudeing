import { items } from '../data';
import '../mechanics'; // registers every built-in action handler, tool action, day hook and behavior
import type { GameState } from '../state/GameState';
import type { ActionContext, ActionDetail, ActionPlan, TileInfo } from './actionTypes';
import { orderedHandlers, toolActionFor } from './actionRegistry';
import { game } from '../data';
import { toast } from './events';
import { selectedStack } from './inventory';

export type { ActionContext, ActionDetail, ActionPlan, TileInfo } from './actionTypes';
export { registerActionHandler, registerToolAction } from './actionRegistry';

export type ActionResult =
  | ({ ok: true; kind: string; tx: number; ty: number } & ActionDetail)
  | { ok: false; message: string };

export const waterCapacity = (state: GameState): number =>
  game.canCapacity[state.upgrades.can] ?? game.canCapacity[0] ?? 20;

function contextFor(state: GameState, tile: TileInfo): ActionContext {
  const stack = selectedStack(state);
  const def = stack ? (items[stack.item] ?? null) : null;
  return { state, tile, stack, def };
}

export type PlanResult =
  { ok: true; plan: ActionPlan; priority: number } | { ok: false; message: string };

/**
 * Decide what "use the equipped item on this tile" would do, without doing it. Handlers are asked
 * highest-priority first (harvest beats seeds beats tools...); the first to answer wins.
 */
export function planAction(state: GameState, tile: TileInfo): PlanResult {
  const ctx = contextFor(state, tile);
  for (const handler of orderedHandlers()) {
    const answer = handler.plan(ctx);
    if (!answer) continue;
    if ('plan' in answer) return { ok: true, plan: answer.plan, priority: handler.priority };
    return { ok: false, message: answer.refusal };
  }
  return { ok: false, message: ctx.def ? `Can't use ${ctx.def.name} here.` : 'Nothing equipped.' };
}

function execute(plan: ActionPlan): ActionResult {
  return { ok: true, kind: plan.kind, tx: plan.tx, ty: plan.ty, ...plan.run() };
}

/** The single entry point for "use the equipped item on a tile". Refusals are toasted to the player. */
export function performAction(state: GameState, tile: TileInfo): ActionResult {
  const planned = planAction(state, tile);
  if (!planned.ok) {
    toast(planned.message, 'warn');
    return { ok: false, message: planned.message };
  }
  return execute(planned.plan);
}

/** The candidate where the most valuable action can be done (ties go to the earlier tile), if any. */
export function pickBest(
  state: GameState,
  candidates: TileInfo[],
): { plan: ActionPlan; priority: number; tile: TileInfo } | null {
  let best: { plan: ActionPlan; priority: number; tile: TileInfo } | null = null;
  for (const tile of candidates) {
    const planned = planAction(state, tile);
    if (planned.ok && (!best || planned.priority > best.priority))
      best = { plan: planned.plan, priority: planned.priority, tile };
  }
  return best;
}

/**
 * One-thumb targeting: look at the facing tile and its neighbours and act where the most valuable
 * thing can be done (picking up or harvesting beats planting beats tilling); on a tie the earlier
 * candidate, i.e. the tile in front, wins. If nothing can be done, report the refusal for the first
 * candidate, which is the tile the player is looking at. Returns the tile chosen.
 */
export function performBest(
  state: GameState,
  candidates: TileInfo[],
): ActionResult & { tile: TileInfo } {
  const first = candidates[0];
  if (!first) throw new Error('performBest needs at least one candidate tile');
  const best = pickBest(state, candidates);
  if (best) return { ...execute(best.plan), tile: best.tile };
  return { ...performAction(state, first), tile: first };
}

/** Is there any candidate where the equipped item can act? (For hints and tests.) */
export function canActAnywhere(state: GameState, candidates: TileInfo[]): boolean {
  return candidates.some((t) => planAction(state, t).ok);
}

export { toolActionFor };
