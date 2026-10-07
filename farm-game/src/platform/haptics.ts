/**
 * Tactile feedback. Native builds register a Capacitor driver (real haptic engine);
 * on the web we fall back to `navigator.vibrate` (Android Chrome; iOS Safari has none).
 */
export type HapticKind = 'tick' | 'success' | 'error';

type Driver = (kind: HapticKind) => void;

const PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 8,
  success: [14, 30, 22],
  error: [12, 50, 12],
};

let enabled = true;
let driver: Driver | null = null;

export const setHapticsEnabled = (on: boolean): void => {
  enabled = on;
};

/** Native shells call this once at startup to swap in the platform haptic engine. */
export const registerHapticsDriver = (d: Driver): void => {
  driver = d;
};

export function haptic(kind: HapticKind): void {
  if (!enabled) return;
  if (driver) {
    driver(kind);
    return;
  }
  // Some browsers throw if vibrate is called without a prior user gesture.
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    /* unsupported or blocked: feedback is optional */
  }
}
