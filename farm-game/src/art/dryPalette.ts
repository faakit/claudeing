/**
 * The straw-coloured dry palette (docs/WORLD-PLAN.md 4.3): grass and foliage ramps go to straw and grey-green;
 * water, paths, roofs, props and flowers are untouched. Pure (no Phaser), so tests can check it stays on the
 * palette and never touches water.
 *
 * It mirrors art-src/tools/seasons.py: each tileset slot gets a category from the first tile name that uses it
 * (tiles.json), and each category remaps palette slots by name. Until the art lane bakes `tiles_dry.png` and
 * `tiles_<season>_dry.png` with the same table, the game remaps the loaded season tileset at runtime
 * (art/dryTiles.ts).
 */

/** public/assets/palette.gpl, by slot name. */
export const PALETTE: Record<string, [number, number, number]> = {
  ink: [42, 26, 36],
  'plum shadow': [74, 42, 64],
  'night navy': [30, 40, 72],
  'dusk blue': [46, 74, 122],
  water: [60, 116, 180],
  sky: [114, 170, 220],
  'ice white': [214, 236, 240],
  'teal shade': [31, 74, 64],
  'leaf dark': [46, 106, 62],
  'leaf mid': [74, 143, 58],
  grass: [116, 176, 67],
  'new leaf': [180, 212, 90],
  'earth dark': [76, 44, 28],
  soil: [124, 68, 44],
  wood: [180, 124, 76],
  sand: [220, 180, 124],
  parchment: [244, 228, 188],
  'skin light': [244, 192, 156],
  'skin mid': [216, 140, 108],
  'skin deep': [156, 90, 60],
  wine: [140, 28, 44],
  red: [204, 58, 42],
  rose: [224, 122, 138],
  orange: [228, 140, 36],
  gold: [244, 204, 60],
  lamp: [255, 240, 160],
  plum: [140, 92, 164],
  lilac: [196, 160, 216],
  'stone dark': [74, 72, 88],
  stone: [122, 118, 132],
  'stone lt': [174, 176, 180],
  taupe: [138, 116, 104],
};

export type DryCategory = 'ground' | 'lush' | 'flora' | 'foliage' | 'evergreen';

/**
 * Straw ground (sun-bleached tips, dry stalks, a dusty shade under trees) and grey-green crowns that have held on
 * through seven dry summers. Not autumn: no orange or gold anywhere, and the crowns stay green-grey.
 */
export const DRY_REMAP: Record<DryCategory, Record<string, string>> = {
  ground: {
    'new leaf': 'parchment',
    grass: 'parchment',
    'leaf mid': 'gold',
    'leaf dark': 'sand',
    'teal shade': 'stone dark',
  },
  lush: {
    'new leaf': 'parchment',
    grass: 'parchment',
    'leaf mid': 'gold',
    'leaf dark': 'sand',
    'teal shade': 'stone dark',
  },
  flora: { 'new leaf': 'parchment', grass: 'sand', 'leaf mid': 'taupe', 'leaf dark': 'taupe' },
  foliage: {
    'new leaf': 'sand',
    grass: 'taupe',
    'leaf mid': 'teal shade',
    'leaf dark': 'teal shade',
    // fall's crowns (orange and gold in the fall tileset) go dusty brown too, so a dry fall never reads as autumn
    orange: 'taupe',
    gold: 'sand',
  },
  evergreen: { 'new leaf': 'sand', grass: 'leaf mid' },
};

const FOLIAGE_PREFIX = ['canopy:', 'tree_oak', 'tree_birch', 'bush_', 'bigoak_'];
const FOLIAGE_EXACT = new Set(['tree', 'bush', 'fern']);
const ROOF_PREFIX = ['roof_', 'eave_', 'chimney_', 'vane_'];
const GROUND_PREFIX = [
  'base_grass',
  'grass_',
  'creep:path',
  'shore:',
  'path_',
  'base_path',
  'pebbles',
  'cobble_',
  'shade_',
];
const GROUND_EXACT = new Set([
  'grass',
  'flower',
  'fence',
  'path',
  'board',
  'bin',
  'puddle',
  'stepping',
]);
const BAKED_GROUND_PREFIX = ['ao:', 'rock', 'creep:', 'edge_', 'shore_', 'cracks'];
const FLORA_PREFIX = ['bloom_', 'patch_', 'rose_', 'tallgrass', 'fern_flat'];
const BOX_PREFIX = ['f_window_box', 'p_flowerbed', 'p_trellis'];
const AQUATIC_PREFIX = ['lily_', 'reeds_'];
const starts = (n: string, ps: string[]): boolean => ps.some((p) => n.startsWith(p));

/** seasons.py `category()`, for the categories the dry palette touches (null: left alone). */
export function dryCategory(name: string): DryCategory | null {
  if (name.startsWith('tree_pine')) return 'evergreen';
  if (name.startsWith('crown:')) {
    // baked crowns: pines stay evergreen, oaks and birches are foliage
    const drawn = (name.split(':').slice(5).join(':') || '')
      .split('~')
      .filter((e) => e.length > 1 && e[1] === '1');
    return drawn.length > 0 && drawn.every((e) => e[0] === 'p') ? 'evergreen' : 'foliage';
  }
  if (starts(name, FOLIAGE_PREFIX) || FOLIAGE_EXACT.has(name)) return 'foliage';
  if (starts(name, ROOF_PREFIX)) return null;
  if (starts(name, FLORA_PREFIX)) return 'flora';
  if (starts(name, AQUATIC_PREFIX)) return null;
  if (name.startsWith('shore:')) return 'ground';
  if (starts(name, BOX_PREFIX)) return null;
  if (name.startsWith('lush_') || name.startsWith('gv_')) return 'lush';
  if (starts(name, GROUND_PREFIX) || GROUND_EXACT.has(name)) return 'ground';
  // baked transitions over grass: occlusion, rocks, creeping dirt, path and shore edges, cracks
  if (starts(name, BAKED_GROUND_PREFIX)) return 'ground';
  return null;
}

/** Per tileset slot, its dry category: the first name in tiles.json that uses the slot decides (as seasons.py). */
export function slotCategories(tiles: Record<string, number>): Map<number, DryCategory> {
  const named = new Set<number>();
  const out = new Map<number, DryCategory>();
  for (const [name, slot] of Object.entries(tiles)) {
    if (slot < 0 || named.has(slot)) continue;
    named.add(slot);
    const c = dryCategory(name);
    if (c) out.set(slot, c);
  }
  return out;
}

const pack = ([r, g, b]: [number, number, number]): number => (r << 16) | (g << 8) | b;

/** A category's remap as packed RGB -> packed RGB. */
export function rgbRemap(cat: DryCategory): Map<number, number> {
  const m = new Map<number, number>();
  for (const [from, to] of Object.entries(DRY_REMAP[cat]))
    m.set(pack(PALETTE[from]!), pack(PALETTE[to]!));
  return m;
}

/**
 * Remap RGBA pixels in place, tile by tile (16 px tiles, `columns` per row). `cats` says each slot's category;
 * without it (no tile index: the placeholder tileset) every tile is treated as ground.
 */
export function remapDry(
  px: Uint8ClampedArray,
  width: number,
  height: number,
  columns: number,
  cats: Map<number, DryCategory> | null,
): void {
  const tables = new Map<DryCategory, Map<number, number>>();
  const table = (c: DryCategory): Map<number, number> => {
    let t = tables.get(c);
    if (!t) tables.set(c, (t = rgbRemap(c)));
    return t;
  };
  const T = 16;
  const rows = Math.floor(height / T);
  const cols = Math.min(columns, Math.floor(width / T));
  for (let ty = 0; ty < rows; ty++)
    for (let tx = 0; tx < cols; tx++) {
      const cat = cats ? cats.get(ty * columns + tx) : 'ground';
      if (!cat) continue;
      const m = table(cat);
      for (let y = ty * T; y < ty * T + T; y++)
        for (let x = tx * T; x < tx * T + T; x++) {
          const i = (y * width + x) * 4;
          if (px[i + 3] === 0) continue;
          const to = m.get((px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!);
          if (to === undefined) continue;
          px[i] = (to >> 16) & 255;
          px[i + 1] = (to >> 8) & 255;
          px[i + 2] = to & 255;
        }
    }
}
