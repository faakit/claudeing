/**
 * Auto tool (one-thumb "context Action"): with a farm tool or seeds in hand, Action uses whichever of the
 * hotbar's farm items can do something on the tiles in reach (hoe on grass, seeds on tilled soil, the can on
 * a dry crop, the scythe on weeds, the pickaxe on ore). The rod, placeables, fertilizer and anything else
 * stay explicit: holding one of those, Action does exactly what that item does (owner decision 2).
 *
 * Pure rules. `inventory.selected` never changes: the hotbar shows what you chose, the Action icon and the
 * marker show what will happen. Handlers read the selected slot, so a choice is planned and run with the
 * chosen slot selected for that instant (`withSelected`), which keeps the action registry unchanged.
 */
import { items, tools, type ItemDef } from '../data';
import type { GameState, ItemStack } from '../state/GameState';
import { planAction, type ActionPlan, type ActionResult, type TileInfo } from './actions';
import { game } from '../data';
import { toast } from './events';

/** An item auto tool may pick from the hotbar. Mechanics can register more (see docs/EXTENDING.md). */
export interface AutoItem {
  id: string;
  /** Tie-break when two auto items can act on the same tile with the same handler priority. Higher wins. */
  priority: number;
  /** Is this hotbar stack one of mine? */
  eligible: (stack: ItemStack, def: ItemDef) => boolean;
}

const registry: AutoItem[] = [];

export function registerAutoItem(item: AutoItem): void {
  const i = registry.findIndex((r) => r.id === item.id);
  if (i >= 0) registry[i] = item;
  else registry.push(item);
}

export function unregisterAutoItem(id: string): void {
  const i = registry.findIndex((r) => r.id === id);
  if (i >= 0) registry.splice(i, 1);
}

const toolAction = (def: ItemDef): string | undefined =>
  def.type === 'tool' && def.tool ? tools[def.tool]?.action : undefined;

// Built-ins (owner decision 2): hoe, can, scythe, pickaxe and seeds. Never the rod, never placeables.
registerAutoItem({ id: 'seeds', priority: 50, eligible: (_s, d) => d.type === 'seed' });
registerAutoItem({ id: 'can', priority: 40, eligible: (_s, d) => toolAction(d) === 'water' });
registerAutoItem({ id: 'scythe', priority: 35, eligible: (_s, d) => toolAction(d) === 'clear' });
registerAutoItem({ id: 'pickaxe', priority: 30, eligible: (_s, d) => toolAction(d) === 'mine' });
registerAutoItem({ id: 'hoe', priority: 20, eligible: (_s, d) => toolAction(d) === 'till' });

/** The auto item a stack belongs to, if any. */
export function autoItemFor(stack: ItemStack | null): AutoItem | null {
  const def = stack ? items[stack.item] : undefined;
  if (!stack || !def) return null;
  let best: AutoItem | null = null;
  for (const r of registry)
    if (r.eligible(stack, def) && (!best || r.priority > best.priority)) best = r;
  return best;
}

/**
 * Does Action choose for you right now? Only with auto tool on and a farm item (or nothing) in hand:
 * holding the rod, a placeable, fertilizer or goods is an explicit choice.
 */
export function autoMode(state: GameState): boolean {
  if (!state.settings.controls.autoTool) return false;
  const stack = state.inventory.slots[state.inventory.selected] ?? null;
  return stack === null || autoItemFor(stack) !== null;
}

/** Run `fn` with `slot` selected for that instant (handlers read the selected slot), then put it back. */
export function withSelected<T>(state: GameState, slot: number, fn: () => T): T {
  const was = state.inventory.selected;
  state.inventory.selected = slot;
  try {
    return fn();
  } finally {
    state.inventory.selected = was;
  }
}

/**
 * The seed auto tool sows: the selected seed when seeds are in hand, else the seed planted last while some is
 * still in the bag, else none (Action then says to pick seeds). Never a seed the player did not choose.
 */
export function seedSlot(state: GameState): number | null {
  const slots = state.inventory.slots;
  const isSeed = (i: number) => items[slots[i]?.item ?? '']?.type === 'seed';
  if (isSeed(state.inventory.selected)) return state.inventory.selected;
  const last = state.controls.lastSeed;
  if (!last) return null;
  // The seed planted last, wherever it is in the bag; never some other seed the player did not choose.
  const i = slots.findIndex((st, k) => st?.item === last && isSeed(k));
  return i >= 0 ? i : null;
}

/** The slots auto tool may use now (hotbar farm tools, plus the seed slot), best tie-break first. */
export function autoSlots(state: GameState): number[] {
  const seed = seedSlot(state);
  const out: { slot: number; priority: number }[] = [];
  for (let i = 0; i < game.hotbarSlots; i++) {
    const stack = state.inventory.slots[i] ?? null;
    const item = autoItemFor(stack);
    if (!item || items[stack!.item]?.type === 'seed') continue;
    out.push({ slot: i, priority: item.priority });
  }
  if (seed !== null)
    out.push({ slot: seed, priority: autoItemFor(state.inventory.slots[seed]!)!.priority });
  return out.sort((a, b) => b.priority - a.priority).map((o) => o.slot);
}

export interface Choice {
  /** The hotbar slot that will be used. */
  slot: number;
  plan: ActionPlan;
  priority: number;
  tile: TileInfo;
  /** Chosen by auto tool (not simply the item in hand). */
  auto: boolean;
}

/**
 * What Action would do on these tiles (front first, then the sides). In explicit mode: the item in hand,
 * exactly as before auto tool. In auto mode: the most valuable action any auto item can do (harvest beats
 * planting beats tools, as the handlers rank them); ties go to the earlier tile, then the item priority.
 */
export function chooseAction(
  state: GameState,
  candidates: TileInfo[],
  opts: { kind?: string } = {},
): Choice | null {
  const sel = state.inventory.selected;
  const best = (slots: number[]): Choice | null => {
    let out: Choice | null = null;
    for (const tile of candidates)
      for (const slot of slots) {
        const planned = withSelected(state, slot, () => planAction(state, tile));
        if (!planned.ok || (opts.kind && planned.plan.kind !== opts.kind)) continue;
        if (!out || planned.priority > out.priority)
          out = { slot, plan: planned.plan, priority: planned.priority, tile, auto: slot !== sel };
      }
    return out;
  };
  // What you hold always wins when it can do something; auto tool only fills in when it cannot.
  const explicit = best([sel]);
  if (explicit || !autoMode(state)) return explicit;
  return best(autoSlots(state).filter((s) => s !== sel));
}

/** Run a choice: with its slot selected, and remember the seed when it sowed. */
export function performChoice(state: GameState, choice: Choice): ActionResult {
  const stack = state.inventory.slots[choice.slot] ?? null;
  const res = withSelected(state, choice.slot, () => ({
    ok: true as const,
    kind: choice.plan.kind,
    tx: choice.plan.tx,
    ty: choice.plan.ty,
    ...choice.plan.run(),
  }));
  if (choice.plan.kind === 'plant' && stack && items[stack.item]?.type === 'seed')
    state.controls.lastSeed = stack.item;
  return res;
}

/**
 * The one-thumb Action: choose and run, or report why nothing can be done (for the tile in front, with the
 * item in hand). Refusals are toasted. Returns the tile and slot used.
 */
export function actOn(
  state: GameState,
  candidates: TileInfo[],
  opts: { kind?: string; quiet?: boolean } = {},
): ActionResult & { tile: TileInfo; slot: number } {
  const first = candidates[0];
  if (!first) throw new Error('actOn needs at least one candidate tile');
  const choice = chooseAction(state, candidates, opts);
  if (choice) return { ...performChoice(state, choice), tile: choice.tile, slot: choice.slot };
  const sel = state.inventory.selected;
  const message = refusalFor(state, candidates);
  if (!opts.quiet) toast(message, 'warn');
  return { ok: false, message, tile: first, slot: sel };
}

/** Why Action can do nothing: no seed for empty soil in reach, else the item in hand's own refusal. */
export function refusalFor(state: GameState, candidates: TileInfo[]): string {
  const first = candidates[0]!;
  const emptySoil = candidates.some((t) => {
    const soil = t.farmland ? state.farm.tiles[`${t.tx},${t.ty}`] : undefined;
    return !!soil && !soil.crop;
  });
  if (emptySoil && autoMode(state) && seedSlot(state) === null) return NO_SEED_HINT;
  const planned = planAction(state, first);
  return planned.ok ? 'Nothing to do here.' : planned.message;
}

export const NO_SEED_HINT = 'Pick seeds on the hotbar first.';
