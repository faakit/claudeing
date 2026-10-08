import type { DaySummary, GameState } from '../state/GameState';

/**
 * The day rollover is a pipeline of phases; mechanics add steps by registering a hook instead of
 * editing `endDay`. Phases run in this order:
 *
 *  - 'start'     before anything changes (e.g. record what happened today)
 *  - 'pre-growth' before crops grow (sprinklers water the soil here)
 *  - 'growth'    crops grow, tiles dry
 *  - 'payout'    shipped goods are paid for
 *  - 'calendar'  the date advances; out-of-season crops wither
 *  - 'morning'   the new day sets up (weeds, forage, weather, orders, machines, energy...)
 *  - 'end'       last look, after everything else
 */
export const DAY_PHASES = [
  'start',
  'pre-growth',
  'growth',
  'payout',
  'calendar',
  'morning',
  'end',
] as const;
export type DayPhase = (typeof DAY_PHASES)[number];

export interface DayContext {
  readonly passedOut: boolean;
  /** Farmable tiles where weeds may appear (from the farm map). */
  readonly weedCandidates: readonly [number, number][];
  /** Tiles where forageables may appear, by map id (from the maps' "forage" zones). */
  readonly forageSpots: Readonly<Record<string, readonly [number, number][]>>;
  /** Tiles where ore nodes may appear, by map id (from the maps' "ore" zones). */
  readonly oreSpots?: Readonly<Record<string, readonly [number, number][]>>;
  /** Hooks add short lines here; they appear in the morning summary. */
  readonly notes: string[];
  /** Hooks may record values for other hooks / the summary. */
  readonly scratch: Record<string, unknown>;
  /** The summary being built; hooks in 'payout'/'calendar' fill the fields they own. */
  readonly summary: DaySummary;
}

export interface DayHook {
  /** Unique id, so a hook can be replaced and tests can inspect order. */
  id: string;
  phase: DayPhase;
  /** Lower runs first within a phase (default 0). */
  order?: number;
  run: (state: GameState, ctx: DayContext) => void;
}

const hooks: DayHook[] = [];

/** Register (or replace, by id) a day hook. */
export function registerDayHook(hook: DayHook): void {
  const i = hooks.findIndex((h) => h.id === hook.id);
  if (i >= 0) hooks[i] = hook;
  else hooks.push(hook);
}

export function unregisterDayHook(id: string): void {
  const i = hooks.findIndex((h) => h.id === id);
  if (i >= 0) hooks.splice(i, 1);
}

/** Hooks of a phase in run order (stable for equal `order`). */
export function hooksFor(phase: DayPhase): DayHook[] {
  return hooks
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.phase === phase)
    .sort((a, b) => (a.h.order ?? 0) - (b.h.order ?? 0) || a.i - b.i)
    .map(({ h }) => h);
}

export function runDayPipeline(state: GameState, ctx: DayContext): void {
  for (const phase of DAY_PHASES) {
    for (const hook of hooksFor(phase)) hook.run(state, ctx);
  }
}

export const registeredHookIds = (): string[] => hooks.map((h) => h.id);
