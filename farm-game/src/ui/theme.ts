/**
 * UI colour tokens. Two skins:
 * - `plum`: the original dark plum UI (still available with `?skin=plum`).
 * - `walnut` (default): on the art palette (public/assets/palette.gpl). Chrome (HUD plates, dock, controls) is walnut wood
 *   with parchment text; content sheets (bag, shop, menus, dialogs) are parchment paper with ink text.
 * `C` is for content sheets, `CH` for chrome. In the plum skin they are the same.
 * The skin can be previewed with `?skin=walnut` (or `?skin=plum`) in the URL.
 */
export type Skin = 'plum' | 'walnut';

const PLUM = {
  ink: 0x14101f,
  panel: 0x2a2238,
  panelLight: 0x3a3050,
  cream: 0xf4ead2,
  creamDim: 0xb9ae98,
  gold: 0xf4d35e,
  green: 0x7fc96b,
  red: 0xe0574a,
  blue: 0x6fa3e0,
  warn: 0xf2a65a,
  slot: 0x1d1830,
  /** Rim of panels and buttons. */
  rim: 0xf4ead2,
  /** Rim of an unselected slot. */
  slotRim: 0xb9ae98,
  /** The one selection colour (slots, tabs): a gold ring with ink notches and a ledge. */
  select: 0xf4d35e,
};
export type Tokens = { [K in keyof typeof PLUM]: number };

/** Palette v2 slots used by the walnut skin. */
const P = {
  ink: 0x2a1a24,
  plumShadow: 0x4a2a40,
  earthDark: 0x4c2c1c,
  soil: 0x7c442c,
  wood: 0xb47c4c,
  sand: 0xdcb47c,
  parchment: 0xf4e4bc,
  gold: 0xf4cc3c,
  wine: 0x8c1c2c,
  red: 0xcc3a2a,
  orange: 0xe48c24,
  leafDark: 0x2e6a3e,
  grass: 0x74b043,
  dusk: 0x2e4a7a,
  sky: 0x72aadc,
};

const WALNUT_CONTENT: Tokens = {
  ink: P.ink,
  panel: P.parchment,
  panelLight: P.sand,
  cream: P.ink,
  creamDim: P.plumShadow,
  // headings, prices and "Gold" in ink (critic R1-5): wine is only for warnings and what you cannot afford
  gold: P.ink,
  green: P.leafDark,
  red: P.wine,
  blue: P.dusk,
  warn: P.soil,
  slot: P.sand,
  rim: P.wood,
  slotRim: P.soil,
  select: P.gold,
};
const WALNUT_CHROME: Tokens = {
  ink: P.ink,
  panel: P.earthDark,
  panelLight: P.soil,
  cream: P.parchment,
  creamDim: P.sand,
  gold: P.gold,
  green: P.grass,
  red: P.red,
  blue: P.sky,
  warn: P.orange,
  // hotbar slots are the bag's recessed sand slot too, so thin tools keep their ink outline (critic R1-2)
  slot: P.sand,
  rim: P.wood,
  slotRim: P.soil,
  select: P.gold,
};

function readSkin(): Skin {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('skin');
    if (q === 'walnut' || q === 'plum') return q;
  } catch {
    /* no location (tests) */
  }
  return 'walnut';
}

export const SKIN: Skin = readSkin();
/** Content sheets: bag, shop, menus, dialogs. */
export const C: Tokens = SKIN === 'walnut' ? WALNUT_CONTENT : PLUM;
/** Chrome: HUD plates, dock, toasts, on-screen controls. */
export const CH: Tokens = SKIN === 'walnut' ? WALNUT_CHROME : PLUM;
/** Wood-grain lines on walnut chrome (null in the plum skin). Plates behind text are flat (critic R1-1); only
 * the dock's plank seams use this. */
export const GRAIN: number | null = SKIN === 'walnut' ? P.plumShadow : null;
/** Ink and wood highlight of the walnut dock's plank seams. */
export const SEAM = { ink: P.ink, lit: P.soil, knot: P.plumShadow };

export const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
