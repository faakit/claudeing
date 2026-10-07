import type { GameState } from '../state/GameState';

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
