import { items } from '../data';
import {
  defaultControlSettings,
  type ControlSettings,
  type GameState,
  type StickSize,
} from '../state/GameState';

type Channel = 'music' | 'sfx';

/** Nudge a volume by `delta`, snapped to 10% steps and clamped to 0..1. Returns the new value. */
export function adjustVolume(state: GameState, channel: Channel, delta: number): number {
  const next = Math.round(Math.max(0, Math.min(1, state.settings[channel] + delta)) * 10) / 10;
  state.settings[channel] = next;
  return next;
}

export function toggleMute(state: GameState): boolean {
  state.settings.muted = !state.settings.muted;
  return state.settings.muted;
}

export function toggleVibration(state: GameState): boolean {
  state.settings.vibrate = !state.settings.vibrate;
  return state.settings.vibrate;
}

export function toggleLeftHanded(state: GameState): boolean {
  state.settings.leftHanded = !state.settings.leftHanded;
  return state.settings.leftHanded;
}

export function toggleReduceMotion(state: GameState): boolean {
  state.settings.reduceMotion = !state.settings.reduceMotion;
  return state.settings.reduceMotion;
}

const STICK_SIZES: readonly StickSize[] = ['s', 'm', 'l'];
/** Stick radius in logical px by size setting. */
export const STICK_RADIUS: Record<StickSize, number> = { s: 18, m: 24, l: 32 };

/** Damaged or missing control settings fall back to the owner defaults, field by field. */
export function sanitizeControlSettings(raw: unknown): ControlSettings {
  const d = defaultControlSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
  const r = raw as Record<string, unknown>;
  const flag = (k: keyof ControlSettings, def: boolean) => (typeof r[k] === 'boolean' ? r[k] : def);
  return {
    autoTool: flag('autoTool', d.autoTool) as boolean,
    tapToMove: flag('tapToMove', d.tapToMove) as boolean,
    paint: flag('paint', d.paint) as boolean,
    stickSize: STICK_SIZES.includes(r['stickSize'] as StickSize)
      ? (r['stickSize'] as StickSize)
      : d.stickSize,
    twoSpeed: flag('twoSpeed', d.twoSpeed) as boolean,
  };
}

/** The remembered seed must be a real seed item, else none. */
export function sanitizeLastSeed(raw: unknown): string | null {
  return typeof raw === 'string' && items[raw]?.type === 'seed' ? raw : null;
}

type ControlFlag = 'autoTool' | 'tapToMove' | 'paint' | 'twoSpeed';

export function toggleControl(state: GameState, key: ControlFlag): boolean {
  state.settings.controls[key] = !state.settings.controls[key];
  return state.settings.controls[key];
}

/** Next stick size (S -> M -> L -> S). */
export function cycleStickSize(state: GameState): StickSize {
  const i = STICK_SIZES.indexOf(state.settings.controls.stickSize);
  const next = STICK_SIZES[(i + 1) % STICK_SIZES.length]!;
  state.settings.controls.stickSize = next;
  return next;
}
