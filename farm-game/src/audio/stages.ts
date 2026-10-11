import stagesData from './stages.json';

/** A water bed that runs on a map stage (src/audio/stages.json). */
export interface StageWater {
  bed: 'creek' | 'river';
  /** Tile rects [x, y, w, h] of the water: the bed is louder near them. None: the same level everywhere. */
  near?: [number, number, number, number][];
  /** Level scale for the bed (a trickle is a creek at a third). */
  gain?: number;
  /** A stat that must be set before the bed runs (the reveal that first shows the water sets it). */
  wait?: string;
}

export interface StageAudio {
  arrangement?: 'thin' | 'full';
  water?: StageWater[];
}

type StageTable = Record<string, Record<string, StageAudio>>;

export const STAGE_AUDIO = Object.fromEntries(
  Object.entries(stagesData).filter(([k]) => !k.startsWith('_')),
) as unknown as StageTable;

/** Positional water: full level within this many tiles of the water, then down to the floor over FALLOFF tiles. */
export const WATER_NEAR = 1.5;
export const WATER_FALLOFF = 12;
export const WATER_FLOOR = 0.25;

/** The audio of a map stage: its entry in stages.json ('default' for a map with one look). */
export function stageAudio(map: string, variant: string | null): StageAudio {
  return STAGE_AUDIO[map]?.[variant ?? 'default'] ?? {};
}

/** Is this stage played thinned? Listed 'thin', or on the dry palette and not listed 'full'. */
export function stageThin(map: string, variant: string | null, palette?: string): boolean {
  const a = stageAudio(map, variant).arrangement;
  return a ? a === 'thin' : palette === 'dry';
}

/** Tiles from (tx, ty) to the nearest rect (0 inside one). */
export function tilesTo(rects: readonly (readonly number[])[], tx: number, ty: number): number {
  let best = Infinity;
  for (const [x, y, w, h] of rects) {
    const dx = Math.max(x! - tx, 0, tx - (x! + w! - 1));
    const dy = Math.max(y! - ty, 0, ty - (y! + h! - 1));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

/** 0..1 level of a water bed for a player on tile (tx, ty). */
export function waterLevel(w: StageWater, tx: number, ty: number): number {
  const g = w.gain ?? 1;
  if (!w.near?.length) return g;
  const d = tilesTo(w.near, tx, ty);
  const k = 1 - Math.max(0, d - WATER_NEAR) / WATER_FALLOFF;
  return g * Math.max(WATER_FLOOR, Math.min(1, k));
}

/**
 * Levels of the water beds for a stage (creek, river), with the stats (for `wait`) and the player's tile.
 * Two entries for the same bed take the louder.
 */
export function waterBeds(
  map: string,
  variant: string | null,
  stats: Record<string, number>,
  tx: number,
  ty: number,
): { creek: number; river: number } {
  const out = { creek: 0, river: 0 };
  for (const w of stageAudio(map, variant).water ?? []) {
    if (w.wait && !stats[w.wait]) continue;
    out[w.bed] = Math.max(out[w.bed], waterLevel(w, tx, ty));
  }
  return out;
}
