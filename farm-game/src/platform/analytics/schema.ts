/**
 * The analytics event schema: every event the game may send, its parameters and their types. Nothing else gets out:
 * `validateEvent` drops an event that has an unknown name, a missing, extra or mistyped parameter, or a string that
 * isn't a short identifier. That rules out free text, names, emails and device identifiers by construction.
 *
 * Every event also gets `install_day` (whole local days since this install, `retention.ts`), added by the
 * analytics layer and not by callers.
 */

/** A parameter's type: a whole number in [0, 10^7], an identifier (letters, digits, `_`, at most 24), or one of a list. */
export type ParamSpec = 'int' | 'id' | readonly string[];

/** The once-per-install milestones (the first time each happens on this install, never again). */
export const MILESTONES = [
  'first_harvest',
  'first_sale',
  'first_green',
  'spring_opened',
  'weir_opened',
  'senna_home',
  'first_fish',
  'first_board_quest',
] as const;
export type Milestone = (typeof MILESTONES)[number];

export const LANGS = ['en', 'pt-BR'] as const;

/** Every event and its parameters (the exact list the Data safety answers describe: agents/PUBLISHING.md). */
export const SCHEMA = {
  /** The first launch of this install (once). */
  first_open: {},
  /** The app came to the foreground: a cold start, or back after 30 minutes or more away. */
  session_start: { n: 'int', days_away: 'int', last_game_day: 'int' },
  /** The app went to the background: `length_s` is that foreground stretch in seconds. */
  session_end: { length_s: 'int' },
  /** A guided-start step finished (`index` is its place in the funnel, 0-based). Once per step per install. */
  tutorial_step: { id: 'id', index: 'int' },
  /** Every guided step is done. Once per install. */
  tutorial_complete: { steps: 'int', game_day: 'int' },
  /** The player skipped the guided start at step `index` (`id`). Once per install. */
  tutorial_skip: { id: 'id', index: 'int' },
  /** A game day started being played (`game_day` 1 is spring 1 of year 1). */
  day_start: { game_day: 'int' },
  /** The player picked a language. */
  settings_language: { lang: LANGS },
  ...(Object.fromEntries(MILESTONES.map((m) => [m, { game_day: 'int' }])) as Record<
    Milestone,
    { game_day: 'int' }
  >),
} as const satisfies Record<string, Record<string, ParamSpec>>;

export type EventName = keyof typeof SCHEMA;
type ParamValue<S> = S extends 'int'
  ? number
  : S extends 'id'
    ? string
    : S extends readonly (infer U)[]
      ? U
      : never;
/** The parameters an event takes (typed from SCHEMA). */
export type EventParams<N extends EventName> = {
  -readonly [K in keyof (typeof SCHEMA)[N]]: ParamValue<(typeof SCHEMA)[N][K]>;
};

/** Added by the layer to every event. */
export const COMMON_PARAMS = { install_day: 'int' } as const satisfies Record<string, ParamSpec>;

export const MAX_INT = 10_000_000;
const ID = /^[a-zA-Z][a-zA-Z0-9_]{0,23}$/;

const fits = (spec: ParamSpec, v: unknown): boolean => {
  if (spec === 'int') return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_INT;
  if (spec === 'id') return typeof v === 'string' && ID.test(v);
  return typeof v === 'string' && spec.includes(v);
};

/** Null when the event matches the schema exactly (with the common parameters), else why it doesn't. */
export function validateEvent(name: string, params: Record<string, unknown>): string | null {
  const spec = (SCHEMA as Record<string, Record<string, ParamSpec>>)[name];
  if (!spec) return `unknown event "${name}"`; // i18n-ok: a developer message
  const all: Record<string, ParamSpec> = { ...spec, ...COMMON_PARAMS };
  for (const k of Object.keys(params)) if (!(k in all)) return `${name}: unexpected param "${k}"`; // i18n-ok
  for (const [k, s] of Object.entries(all)) {
    if (!(k in params)) return `${name}: missing param "${k}"`; // i18n-ok
    if (!fits(s, params[k])) return `${name}: bad value for "${k}"`; // i18n-ok
  }
  return null;
}

/** One event as queued and sent: the name and parameters, plus local bookkeeping that providers may use. */
export interface Envelope {
  name: EventName;
  params: Record<string, string | number>;
  /** Epoch ms when it happened. */
  t: number;
  /** This app session's random id. */
  sid: string;
  /** This install's random id (not tied to any account or device id). Providers with their own id ignore it. */
  iid: string;
  /** Order within this install (gaps mean dropped events). */
  seq: number;
}
