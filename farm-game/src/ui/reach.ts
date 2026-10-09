/**
 * One-handed thumb reach model, pure (no Phaser). Used by layout tests to prove that the controls the thumb
 * works with sit in the comfortable zone on the phones we target. The same maths drives the one-thumb
 * benchmark (`scripts/thumb-lib.mjs`); see PLAN-CONTROLS.md "The reach model" for sources and limits.
 *
 * It is a geometric model built from published studies, not a measurement of anyone's hand.
 */
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

export type Hand = 'right' | 'left';
export type Zone = 'comfort' | 'stretch' | 'hard';

export interface PhoneProfile {
  id: string;
  name: string;
  /** CSS viewport. */
  w: number;
  h: number;
  dpr: number;
  ppi: number;
  /** Phone body below the screen, in mm. */
  chin: number;
  insets: { top: number; left: number; bottom: number; right: number };
  /** Primary phones carry the owner's weighting; `hard` ones must still pass. */
  weight: 'primary' | 'hard' | 'secondary';
}

export const PHONES: readonly PhoneProfile[] = [
  {
    id: 'i13',
    name: 'iPhone 13/14',
    w: 390,
    h: 844,
    dpr: 3,
    ppi: 460,
    chin: 4,
    insets: { top: 47, left: 0, bottom: 34, right: 0 },
    weight: 'primary',
  },
  {
    id: 'pixel7',
    name: 'Pixel 7',
    w: 412,
    h: 915,
    dpr: 2.625,
    ppi: 416,
    chin: 4,
    insets: { top: 24, left: 0, bottom: 0, right: 0 },
    weight: 'primary',
  },
  {
    id: 'se',
    name: 'iPhone SE (16:9)',
    w: 375,
    h: 667,
    dpr: 2,
    ppi: 326,
    chin: 13,
    insets: { top: 20, left: 0, bottom: 0, right: 0 },
    weight: 'hard',
  },
  {
    id: 'promax',
    name: 'iPhone 15 Pro Max',
    w: 430,
    h: 932,
    dpr: 3,
    ppi: 460,
    chin: 4,
    insets: { top: 59, left: 0, bottom: 34, right: 0 },
    weight: 'secondary',
  },
  {
    id: 'fold',
    name: 'Galaxy Fold cover (narrow)',
    w: 280,
    h: 653,
    dpr: 3,
    ppi: 387,
    chin: 4,
    insets: { top: 0, left: 0, bottom: 0, right: 0 },
    weight: 'secondary',
  },
];

/** Distances from the thumb pivot, in mm (Le et al. 2018, Karlson et al.). */
export const THUMB = {
  pivotOut: 12,
  pivotUp: 20,
  comfortMin: 25,
  comfortMax: 68,
  stretchMin: 15,
  stretchMax: 85,
} as const;

export const mmPerCss = (p: PhoneProfile): number => (25.4 / p.ppi) * p.dpr;

/** Where the 1:2 canvas lands in CSS px (Phaser FIT inside the safe area, centred). */
export function canvasRect(p: PhoneProfile): { left: number; top: number; k: number } {
  const aw = p.w - p.insets.left - p.insets.right;
  const ah = p.h - p.insets.top - p.insets.bottom;
  const k = Math.min(aw / GAME_WIDTH, ah / GAME_HEIGHT);
  return {
    left: p.insets.left + (aw - GAME_WIDTH * k) / 2,
    top: p.insets.top + (ah - GAME_HEIGHT * k) / 2,
    k,
  };
}

/** Zone of a CSS point for a hand. */
export function zoneAtCss(
  p: PhoneProfile,
  hand: Hand,
  x: number,
  y: number,
): { zone: Zone; d: number } {
  const k = mmPerCss(p);
  const px = hand === 'right' ? p.w * k + THUMB.pivotOut : -THUMB.pivotOut;
  const py = p.h * k + p.chin - THUMB.pivotUp;
  const d = Math.hypot(x * k - px, y * k - py);
  let zone: Zone = 'hard';
  if (d >= THUMB.comfortMin && d <= THUMB.comfortMax) zone = 'comfort';
  else if (d >= THUMB.stretchMin && d <= THUMB.stretchMax) zone = 'stretch';
  return { zone, d: Math.round(d * 10) / 10 };
}

/** Zone of a logical (200x400 canvas) point for a hand. */
export function zoneAt(
  p: PhoneProfile,
  hand: Hand,
  lx: number,
  ly: number,
): { zone: Zone; d: number } {
  const c = canvasRect(p);
  return zoneAtCss(p, hand, c.left + lx * c.k, c.top + ly * c.k);
}

/** Logical px per mm on this phone (a 2.5 mm thumb roll is `2.5 * logicalPerMm` logical px). */
export const logicalPerMm = (p: PhoneProfile): number => 1 / (canvasRect(p).k * mmPerCss(p));
