/**
 * Tactile feedback. Native builds register a Capacitor driver (real haptic engine);
 * on the web we fall back to `navigator.vibrate` (Android Chrome; iOS Safari has none).
 *
 * Owner rules (DECISIONS.md, "Haptics"): light and on by default. `tick` for a successful tile action, a
 * tool or slot change and each tile added to a painted row; `medium` for a ripe harvest and a level-up;
 * `error` (a double pulse) for refusals. Every kind is throttled so a held action never buzzes, and every
 * haptic event has a visible twin on screen (iOS Safari cannot vibrate at all).
 */
export type HapticKind = 'tick' | 'medium' | 'success' | 'error';

type Driver = (kind: HapticKind) => void;

const PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 8,
  medium: 18,
  success: [14, 30, 22],
  error: [12, 50, 12],
};

/** Shortest gap between two pulses of one kind (ms). `repeat` is for a held action's later uses. */
export const HAPTIC_GAP_MS: Record<HapticKind | 'repeat', number> = {
  tick: 120,
  medium: 250,
  success: 300,
  error: 400,
  repeat: 450,
};

/** Any two pulses this close merge: the later one only plays if it is stronger (it replaces the first). */
export const HAPTIC_MERGE_MS = 80;
const RANK: Record<HapticKind, number> = { tick: 0, medium: 1, success: 2, error: 3 };

let enabled = true;
let lastPulse: { t: number; kind: HapticKind } | null = null;
let driver: Driver | null = null;
const lastAt = new Map<string, number>();

const now = (): number =>
  typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

export const setHapticsEnabled = (on: boolean): void => {
  enabled = on;
};

/** Native shells call this once at startup to swap in the platform haptic engine. */
export const registerHapticsDriver = (d: Driver): void => {
  driver = d;
};

/** Forget throttle history (tests, and a new game). */
export const resetHapticGate = (): void => {
  lastAt.clear();
  lastPulse = null;
};

/**
 * Pulse once, unless vibration is off or the same kind pulsed too recently. `repeat` marks a pulse that
 * repeats a held action (the 2nd, 3rd... use of a held Action): those tick at most every 450 ms.
 * Returns whether a pulse was sent.
 */
export function haptic(kind: HapticKind, opts: { repeat?: boolean; at?: number } = {}): boolean {
  if (!enabled) return false;
  const t = opts.at ?? now();
  const key = opts.repeat ? 'repeat' : kind;
  const gap = HAPTIC_GAP_MS[opts.repeat ? 'repeat' : kind];
  const prev = lastAt.get(key);
  if (prev !== undefined && t - prev < gap) return false;
  // Two events in the same instant (a tile worked and a goal completed) never buzz twice.
  if (lastPulse && t - lastPulse.t < HAPTIC_MERGE_MS && RANK[kind] <= RANK[lastPulse.kind])
    return false;
  lastPulse = { t, kind };
  lastAt.set(key, t);
  // A first tick also starts the repeat gate, so a held action never pulses faster than its rule.
  if (kind === 'tick' && !opts.repeat) lastAt.set('repeat', t);
  if (driver) {
    driver(kind);
    return true;
  }
  // Some browsers throw if vibrate is called without a prior user gesture.
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    /* unsupported or blocked: feedback is optional */
  }
  return true;
}
