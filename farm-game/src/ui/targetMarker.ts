/**
 * What the target marker says about the tile Action (or a tap) would use, pure so it is unit tested.
 * "Will act" and "nothing to do" differ in shape (solid brackets vs corner dots), not only in colour,
 * so they read in greyscale and for colour-blind players.
 */
export type MarkerKind = 'work' | 'harvest' | 'interact' | 'none';

/** Plan kinds that gather something: drawn in the harvest colour. */
const GATHER = new Set(['harvest', 'forage', 'pickup']);

export interface MarkerFacts {
  /** The plan Action would run on this tile, if any. */
  planKind: string | null;
  /** Interact has something here (bin, villager, machine...). */
  interactable: boolean;
}

export function markerKind(f: MarkerFacts): MarkerKind {
  if (f.planKind) return GATHER.has(f.planKind) ? 'harvest' : 'work';
  if (f.interactable) return 'interact';
  return 'none';
}

/** Marker colours by kind (theme-neutral; the walnut skin may restyle them). */
export const MARKER_COLORS: Record<MarkerKind, number> = {
  work: 0xffffff,
  harvest: 0x9be37f,
  interact: 0xf4d35e,
  none: 0xf4ead2,
};

/** Does this kind draw solid brackets (an action will happen) rather than dim corner dots? */
export const markerActs = (k: MarkerKind): boolean => k !== 'none';
