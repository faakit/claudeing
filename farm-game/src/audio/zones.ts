import type { InstrumentAsset, Zone } from './types';

/**
 * How far a sample may be pitch-shifted before it stops sounding like the instrument
 * (formants move, attacks speed up). Mallets and plucks tolerate a little more.
 */
export const MAX_SHIFT: Record<InstrumentAsset['kind'], number> = { decay: 4, sustain: 4, perc: 0 };
export const MAX_SHIFT_LOOSE = 6;
export const LOOSE_SHIFT_INSTRUMENTS = new Set(['marimba', 'glock', 'vibes', 'pizz']);

export function maxShift(name: string, inst: InstrumentAsset): number {
  return LOOSE_SHIFT_INSTRUMENTS.has(name) ? MAX_SHIFT_LOOSE : MAX_SHIFT[inst.kind];
}

/** The sample nearest in pitch to `midi`, and the playback rate that tunes it there. */
export function pickZone(
  zones: Zone[],
  midi: number,
): { zone: Zone; index: number; shift: number; rate: number } {
  let best = 0;
  let bestDist = Infinity;
  zones.forEach((z, i) => {
    const d = Math.abs(midi - (z.root ?? midi));
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  const zone = zones[best]!;
  const shift = midi - (zone.root ?? midi);
  return { zone, index: best, shift, rate: Math.pow(2, shift / 12) };
}

/** The playable range of an instrument within its shift limit, as [lowest, highest] MIDI. */
export function playableRange(name: string, inst: InstrumentAsset): [number, number] {
  const roots = (inst.zones ?? []).map((z) => z.root ?? 0);
  const lim = maxShift(name, inst);
  return [Math.min(...roots) - lim, Math.max(...roots) + lim];
}
