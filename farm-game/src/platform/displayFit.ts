/**
 * How the 200x400 canvas is sized on a screen (pure, so the profile table in DECISIONS.md is a unit test).
 *
 * Pixel art reads best when every game pixel covers the same whole number of device pixels: at 5.72 device px
 * per game px (an iPhone 13 at "fit") the columns come out 5 or 6 px wide and crawl as the world scrolls. So the
 * canvas is scaled by a whole number of device pixels whenever that costs at most `MAX_LOSS` of the fitted size;
 * the leftover margin is walnut and all of it goes above the HUD, so the canvas's bottom (the hotbar and the floating
 * controls) sits on the bottom safe area, where the thumb rests (owner, round 5: split top and bottom it lifted the
 * controls 60 px on a Pixel 7). Where a whole number would
 * cost more, the canvas keeps the fitted size (one nearest-neighbour step from the game's pixels), aligned to the
 * device-pixel grid. Ruling: coordinator, round 4 (DECISIONS.md "Whole-pixel canvas scale").
 */

/** The most of the fitted size a whole-pixel scale may give up (about 10%). */
export const MAX_LOSS = 0.1;
/**
 * Touch comes first: the tightest controls sit 24 game px apart (hotbar slots), and on a phone that clears the
 * 38 CSS px bar at the fitted size (scripts/e2e-mobile.mjs), a whole-pixel scale may not take them below it.
 */
export const TARGET_PITCH = 24;
export const MIN_TARGET_CSS = 38;

export interface Fit {
  mode: 'integer' | 'fit';
  /** Device px per game px. */
  devScale: number;
  /** Canvas size and offset inside the available box, in CSS px (offsets fall on device pixels). */
  cssW: number;
  cssH: number;
  cssLeft: number;
  cssTop: number;
  /** Share of the fitted size given up by the whole-pixel scale (0 in fit mode). */
  loss: number;
  /** Game columns and rows whose device width differs from the most common width (0 = perfectly even). */
  uneven: number;
}

/** Device widths of `n` game pixels at `scale` device px each, starting at device offset `off`. */
export function cellWidths(n: number, scale: number, off = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++)
    out.push(Math.round(off + (i + 1) * scale) - Math.round(off + i * scale));
  return out;
}

/** Cells whose width is not the most common width. */
export function unevenCells(widths: number[]): number {
  const count = new Map<number, number>();
  for (const w of widths) count.set(w, (count.get(w) ?? 0) + 1);
  const common = Math.max(...count.values());
  return widths.length - common;
}

/**
 * Size a `gw` x `gh` canvas in an available box of `availW` x `availH` CSS px at `dpr` device px per CSS px.
 */
export function displayFit(
  availW: number,
  availH: number,
  dpr: number,
  gw = 200,
  gh = 400,
  maxLoss = MAX_LOSS,
): Fit {
  const devW = availW * dpr;
  const devH = availH * dpr;
  const fit = Math.min(devW / gw, devH / gh);
  const whole = Math.floor(fit + 1e-6);
  const loss = whole >= 1 ? 1 - whole / fit : 1;
  const pitchFit = (TARGET_PITCH * fit) / dpr;
  const pitchWhole = (TARGET_PITCH * whole) / dpr;
  const shrinksTargets = pitchFit >= MIN_TARGET_CSS && pitchWhole < MIN_TARGET_CSS;
  const integer = whole >= 1 && loss <= maxLoss + 1e-9 && !shrinksTargets;
  // Fit mode: snap the size to whole device pixels too (the scale itself stays fractional).
  const devScale = integer ? whole : fit;
  const wDev = Math.floor(gw * devScale + 1e-6);
  const hDev = Math.floor(gh * devScale + 1e-6);
  const leftDev = Math.floor((devW - wDev) / 2);
  // Every leftover pixel above the canvas: the hotbar (the canvas's bottom) sits on the bottom of the safe area.
  const topDev = Math.floor(devH - hDev);
  return {
    mode: integer ? 'integer' : 'fit',
    devScale,
    cssW: wDev / dpr,
    cssH: hDev / dpr,
    cssLeft: leftDev / dpr,
    cssTop: topDev / dpr,
    loss: integer ? loss : 0,
    uneven: unevenCells(cellWidths(gw, devScale)) + unevenCells(cellWidths(gh, devScale)),
  };
}
