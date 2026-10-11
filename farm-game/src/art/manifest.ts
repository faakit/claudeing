import { PLACEHOLDER_TILES, TILESET_KEY } from '../config';
import {
  animals,
  game,
  crops,
  forage,
  items,
  mail,
  nodes,
  npcs,
  placeables,
  projects,
  tools,
  trees,
} from '../data';
import { DIRECTIONS } from '../systems/direction';

/**
 * Every texture key (and frame) the game draws, derived from data wherever the data names it, so new
 * items, crops or placeables appear here without code changes. Each entry is either supplied by a packed
 * atlas in `public/assets/` or falls back to the code-generated placeholder of the same key.
 * `art-src/tools/manifest.mjs` prints this list to `agents/out/art-manifest.md`.
 */
export type AtlasGroup = 'tiles' | 'world' | 'ui' | 'chars';

export interface ArtEntry {
  /** Phaser texture key the game code asks for. */
  texture: string;
  /** Frame name inside a multi-frame texture; undefined for single-image keys. */
  frame?: string;
  /** Nominal size in px. Tiles, crops and characters must match it exactly; objects may be taller. */
  w: number;
  h: number;
  group: AtlasGroup;
  /** What it is, for the manifest table. */
  kind: string;
  /** Where the key comes from (data file or code). */
  from: string;
  /** Exact size required (grid-locked art). Single-image objects may be taller and are bottom-anchored. */
  exact: boolean;
  /** Decor drawn only when its art exists: no generated fallback, never reported missing. */
  optional?: boolean;
}

/** Atlas files the loader looks for, by group (relative to the game's base URL). */
export const ATLAS_FILES: Record<
  Exclude<AtlasGroup, 'tiles'>,
  { key: string; png: string; json: string }
> = {
  world: {
    key: 'atlas_world',
    png: 'assets/sprites/world.png',
    json: 'assets/sprites/world.json',
  },
  ui: { key: 'atlas_ui', png: 'assets/sprites/ui.png', json: 'assets/sprites/ui.json' },
  chars: {
    key: 'atlas_chars',
    png: 'assets/sprites/chars.png',
    json: 'assets/sprites/chars.json',
  },
};
/** The terrain tileset image: same tile order as PLACEHOLDER_TILES (Tiled gid = index + 1). */
export const TILESET_FILE = 'assets/tilesets/tiles.png';

export const PLAYER_KEY = 'player';
export const CROPS_KEY = 'crops';
export const npcTexture = (id: string): string => `npc_${id}`;
export const npcFrame = (id: string, dir: string, i: number): string => `npc_${id}_${dir}_${i}`;
/** Second idle frame of an animal (the first is the plain sprite key). */
export const animalIdleKey = (sprite: string): string => `${sprite}_1`;
/**
 * An animal's idle frames (art round 4): the plain key, `_1` (its round-2 second pose), `_2` a breath (the back
 * rises 1 px) and `_3` a head dip. `_2` and `_3` are optional.
 */
export const animalIdleFrames = (sprite: string): string[] => [
  sprite,
  `${sprite}_1`,
  `${sprite}_2`,
  `${sprite}_3`,
];
/**
 * Villager idle (art round 4), 4 frames per direction: 0 rest (hold it long), 1 breathe in (chest +1 px, head
 * rises 1 px, feet planted), 2 blink (from behind: same as 0), 3 the villager's own beat (Mara nods, Finn lifts his
 * hat, Orin shifts his weight, Rosa lifts and tips her hat, Clay tilts his head).
 */
export const NPC_IDLE_FRAMES = 4;
/** [frame, ms] of one villager idle loop (about 7.5 s): rest is held, the beat comes once. */
export const NPC_IDLE_SEQUENCE: [number, number][] = [
  [0, 1800],
  [1, 500],
  [0, 1500],
  [2, 110],
  [0, 1700],
  [3, 700],
  [0, 700],
  [1, 500],
];
/** Crop lean frames (art round 4) for grown stages (2 and up): the top half leans 1 px; the base stays. */
export const cropLeanFrame = (frame: string, side: 'l' | 'r'): string => `${frame}_lean_${side}`;
export const CROP_LEAN_FROM_STAGE = 2;
/** Harvest pop (art round 4): `_pop_0` stretch 14 x 18, `_pop_1` squash 18 x 14, then the 16 x 16 icon. */
export const popFrames = (icon: string): string[] => [`${icon}_pop_0`, `${icon}_pop_1`, icon];
/** Door opening over a tall facade door (16 x 32) or its ground tile only (16 x 16): 0 closed .. 3 open. */
export const DOOR_OPEN_FRAMES = 4;
export const doorOpenKey = (i: number, lowOnly = false): string =>
  lowOnly ? `obj_door_open_low_${i}` : `obj_door_open_${i}`;

/** Player walk cycle (art round 4): 8 frames, contact, down, passing, up, then the same on the other foot. */
export const PLAYER_WALK_FRAMES = 8;
/**
 * Tool-use frames (art round 4): 32 x 32 single-image keys `player_tool_<tool>_<dir>_<i>`, i = 0 wind-up,
 * 1 swing, 2 contact (the tool meets the tile: spawn dust or splash here), 3 follow-through. Left mirrors right.
 * Facing up only the hoe and pickaxe have frames (the rest keep the walk sprite, as before).
 */
export const TOOL_ANIM_FRAMES = 4;
export const TOOL_CONTACT_FRAME = 2;
const SIDES = ['down', 'right', 'left'] as const;
const ALL_DIRS = ['down', 'up', 'right', 'left'] as const;
export const TOOL_ANIMS: Record<string, { tool: string; dirs: readonly string[] }> = {
  hoe: { tool: 'hoe', dirs: ALL_DIRS },
  pickaxe: { tool: 'pick', dirs: ALL_DIRS },
  watering_can: { tool: 'can', dirs: SIDES },
  scythe: { tool: 'scythe', dirs: SIDES },
  fishing_rod: { tool: 'rod', dirs: SIDES },
};
/** The feel agent's 3-frame swing names: anticipation, impact (= contact frame 2), follow-through. */
export const swingKey = (tool: string, dir: string, i: number): string =>
  `player_swing_${tool}_${dir}_${i}`;
/**
 * Frame height of a tool sequence: 36 for the hoe and pickaxe facing down (the blade bites 3-4 px below the feet,
 * review 14), else 32. The feet are on row 31 in every frame, so the origin is (0.5, 32 / height).
 */
export const toolFrameHeight = (tool: string, dir: string): number =>
  dir === 'down' && (tool === 'hoe' || tool === 'pick') ? 36 : 32;
export const toolAnimKey = (tool: string, dir: string, i: number): string =>
  `player_tool_${tool}_${dir}_${i}`;
/** The frame keys of one tool-use sequence (by tool item id), or [] when that facing has none. */
export function toolAnimFrames(item: string, dir: string): string[] {
  const t = TOOL_ANIMS[item];
  if (!t || !t.dirs.includes(dir)) return [];
  return Array.from({ length: TOOL_ANIM_FRAMES }, (_, i) => toolAnimKey(t.tool, dir, i));
}

/**
 * The menu sheet skin (art round 5): a parchment sheet in a walnut frame with brass corner caps, as 9-slice pieces
 * in the ui atlas (art-src/tools/uisheet.py, Flow `ui1` b), composed by src/ui/sheetSkin.ts. Edges and the centre
 * TILE, never stretch.
 */
export const SHEET_PIECES = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'] as const;
export type SheetPiece = (typeof SHEET_PIECES)[number];
export const sheetPieceKey = (p: SheetPiece): string => `ui_sheet_${p}`;
/** Frame widths in px (the left and top include a 1 px paper shadow) and the safe content inset. */
export const SHEET_SLICE = { left: 6, right: 5, top: 7, bottom: 5, inset: 8 } as const;
/** Piece sizes [w, h], as the art pipeline builds them. */
export const SHEET_PIECE_SIZES: Record<SheetPiece, [number, number]> = {
  tl: [6, 7],
  t: [16, 7],
  tr: [5, 7],
  l: [6, 16],
  c: [16, 16],
  r: [5, 16],
  bl: [6, 5],
  b: [16, 5],
  br: [5, 5],
};

/** UI glyphs and fx drawn in code (gameArt.drawGlyphs / placeholders). */
/** Small effect and ambient sprites (ui atlas): drawn only when the art exists, no generated fallback. */
export const FX_SPRITES: [string, number, number][] = [
  ['fx_petal', 5, 5],
  ['fx_leaf_o', 7, 7],
  ['fx_leaf_r', 7, 7],
  ['fx_snow', 5, 5],
  ['fx_firefly', 5, 5],
  ['fx_seed', 7, 7],
  ['fx_butterfly_w0', 9, 8],
  ['fx_butterfly_w1', 5, 8],
  ['fx_butterfly_o0', 9, 8],
  ['fx_butterfly_o1', 5, 8],
  ['fx_sparkle_0', 3, 3],
  ['fx_sparkle_1', 7, 7],
  ['fx_sparkle_2', 11, 11],
  ['fx_sparkle_3', 5, 5],
  ['fx_dust_0', 5, 5],
  ['fx_dust_1', 8, 7],
  ['fx_dust_2', 10, 9],
  ['fx_dust_3', 11, 10],
  // art round 4: the splash redrawn as a crown of droplets on foam, and a ripple flipbook (stepped rings)
  ['fx_splash_0', 9, 4],
  ['fx_splash_1', 11, 7],
  ['fx_splash_2', 13, 10],
  ['fx_splash_3', 13, 8],
  ['fx_ripple_0', 5, 3],
  ['fx_ripple_1', 9, 5],
  ['fx_ripple_2', 12, 7],
  ['fx_ember', 4, 5],
  ['fx_glint', 7, 7],
];

/**
 * Onboarding coach marks (ui atlas, art round 3), for the guided start: a pointing hand (finger up; flip it to
 * point down), a target ring and a wider, thinner ring for a stepped pulse, and a speech bubble as a 12 x 12
 * nine-slice source (4 px corners) with a tail that overlaps its bottom outline row.
 */
export const COACH_SPRITES: [string, number, number][] = [
  ['ui_coach_hand', 13, 17],
  ['ui_coach_ring', 16, 16],
  ['ui_coach_ring_wide', 22, 22],
  ['ui_coach_bubble', 12, 12],
  ['ui_coach_bubble_tail', 7, 4],
];

/**
 * A repeatable project's landmark grows with its level: level 1 is the plain sprite, then `<sprite>_<level>` up
 * to the last level with its own frame (the statue: 5, its perk levels). Pure, so tests and the renderer agree.
 */
export function landmarkLevelKey(sprite: string, level: number, frames: number): string {
  const lv = Math.min(Math.max(1, Math.floor(level)), frames);
  return lv <= 1 ? sprite : `${sprite}_${lv}`;
}

/** A ground item's own small world sprite (forage, an animal house's product bubble). */
export const worldItemKey = (item: string): string => `world_${item}`;
/** Items that lie in the world: forage, and the products shown over animal houses. */
export function worldItems(): string[] {
  const out = new Set<string>();
  for (const f of forage.table) out.add(f.item);
  for (const a of Object.values(animals)) if (a.product) out.add(a.product);
  return [...out];
}

const UI_GLYPHS: [string, number, number][] = [
  ['ui_coin', 9, 9],
  ['ui_bolt', 9, 11],
  ['ui_drop', 9, 11],
  ['ui_menu', 11, 9],
  ['ui_sun', 11, 11],
  ['ui_rain', 13, 11],
  ['ui_star', 7, 7],
  ['ui_heart', 7, 6],
];

export function artManifest(): ArtEntry[] {
  const out: ArtEntry[] = [];
  const seen = new Set<string>();
  const add = (e: Omit<ArtEntry, 'exact'> & { exact?: boolean }): void => {
    const id = e.frame ? `${e.texture}#${e.frame}` : e.texture;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ exact: true, ...e });
  };

  PLACEHOLDER_TILES.forEach((t, i) =>
    add({
      texture: TILESET_KEY,
      frame: `${i}`,
      w: 16,
      h: 16,
      group: 'tiles',
      kind: `tile ${i} (gid ${i + 1}) ${t.name}`,
      from: 'config.ts PLACEHOLDER_TILES',
    }),
  );
  for (const k of ['soil_tilled', 'soil_watered', 'weed'])
    add({ texture: k, w: 16, h: 16, group: 'world', kind: 'soil', from: 'gameArt.ts' });
  for (const [id, c] of Object.entries(crops)) {
    for (let s = 0; s <= c.stageDays.length; s++)
      add({
        texture: CROPS_KEY,
        frame: `crop_${id}_${s}`,
        w: 16,
        h: 16,
        group: 'world',
        kind: s === c.stageDays.length ? `crop ${id} ripe` : `crop ${id} stage ${s}`,
        from: 'crops.json',
        exact: false,
      });
    for (let s = CROP_LEAN_FROM_STAGE; s <= c.stageDays.length; s++)
      for (const side of ['l', 'r'] as const)
        add({
          texture: CROPS_KEY,
          frame: cropLeanFrame(`crop_${id}_${s}`, side),
          w: 16,
          h: 16,
          group: 'world',
          kind: `crop ${id} stage ${s} lean ${side}`,
          from: 'art round 4 (motion.py)',
          exact: false,
          optional: true,
        });
  }
  for (const [id, p] of Object.entries(placeables)) {
    add({
      texture: p.sprite,
      w: 16,
      h: 16,
      group: 'world',
      kind: p.behavior === 'fruitTree' ? `tree ${id} (grown)` : `placeable ${id}`,
      from: 'placeables.json',
      exact: false,
    });
  }
  for (const id of Object.keys(trees))
    add({
      texture: `obj_tree_${id}`,
      w: 16,
      h: 16,
      group: 'world',
      kind: `tree ${id} (grown)`,
      from: 'trees.json',
      exact: false,
    });
  add({
    texture: 'obj_sapling',
    w: 8,
    h: 10,
    group: 'world',
    kind: 'young fruit tree (seedling)',
    from: 'mechanics/fruitTree.ts',
    exact: false,
  });
  // the sapling and young-tree stages (art round 3, proportions); optional: the seedling stands in without them
  for (const [k, w, h] of [
    ['obj_sapling_2', 12, 20],
    ['obj_sapling_3', 20, 28],
  ] as const)
    add({
      texture: k,
      w,
      h,
      group: 'world',
      kind: 'young fruit tree',
      from: 'mechanics/fruitTree.ts',
      exact: false,
      optional: true,
    });
  add({
    texture: 'obj_sign',
    w: 16,
    h: 16,
    group: 'world',
    kind: 'plot sign',
    from: 'ObjectsRenderer.ts',
    exact: false,
  });
  for (const id of Object.keys(nodes))
    add({
      texture: `node_${id}`,
      w: 16,
      h: 16,
      group: 'world',
      kind: `ore node ${id}`,
      from: 'nodes.json',
    });
  for (const [id, a] of Object.entries(animals)) {
    add({
      texture: a.sprite,
      w: 16,
      h: 16,
      group: 'world',
      kind: `animal ${id}`,
      from: 'animals.json',
      exact: false, // a cow is wider than a tile (review 8)
    });
    add({
      texture: animalIdleKey(a.sprite),
      w: 16,
      h: 16,
      group: 'world',
      kind: `animal ${id} idle frame 2`,
      from: 'animals.json',
      exact: false,
    });
    for (const texture of animalIdleFrames(a.sprite).slice(2))
      add({
        texture,
        w: 16,
        h: 16,
        group: 'world',
        kind: `animal ${id} idle (round 4)`,
        from: 'art round 4 (motion.py)',
        exact: false,
        optional: true,
      });
  }
  for (let i = 0; i < DOOR_OPEN_FRAMES; i++)
    for (const low of [false, true])
      add({
        texture: doorOpenKey(i, low),
        w: 16,
        h: low ? 16 : 32,
        group: 'world',
        kind: `door opening ${i}${low ? ' (ground tile)' : ''}`,
        from: 'art round 4 (motion.py)',
        optional: true,
      });

  for (const [id, it] of Object.entries(items))
    add({
      texture: it.icon,
      w: 16,
      h: 16,
      group: 'ui',
      kind: `item ${id} (${it.type})`,
      from: 'items.json',
    });
  for (const it of Object.values(items))
    if (it.type === 'crop' || it.type === 'forage' || it.type === 'product')
      popFrames(it.icon)
        .slice(0, 2)
        .forEach((texture, i) =>
          add({
            texture,
            w: i ? 18 : 14,
            h: i ? 14 : 18,
            group: 'ui',
            kind: `harvest pop ${i ? 'squash' : 'stretch'} ${it.icon}`,
            from: 'art round 4 (motion.py)',
            optional: true,
          }),
        );
  for (const [id, t] of Object.entries(tools))
    add({ texture: t.icon, w: 16, h: 16, group: 'ui', kind: `tool ${id}`, from: 'tools.json' });
  for (const [k, w, h] of UI_GLYPHS)
    add({ texture: k, w, h, group: 'ui', kind: 'ui glyph', from: 'gameArt.ts' });
  add({ texture: 'fx_px', w: 2, h: 2, group: 'ui', kind: 'fx particle pixel', from: 'gameArt.ts' });
  for (const k of ['player_use_hoe', 'player_use_can', 'player_use_rod'])
    add({
      texture: k,
      w: 32,
      h: 32,
      group: 'chars',
      kind: 'player tool pose',
      from: 'WorldScene',
      optional: true,
    });
  for (const item of Object.keys(TOOL_ANIMS))
    for (const d of TOOL_ANIMS[item]!.dirs)
      for (const texture of toolAnimFrames(item, d))
        add({
          texture,
          w: 32,
          h: toolFrameHeight(TOOL_ANIMS[item]!.tool, d),
          group: 'chars',
          kind: `player tool use ${item} ${d}`,
          from: 'art round 4 (toolanim.py)',
          optional: true,
        });
  // the feel agent's names (feel/smooth frames-wanted.md), atlas aliases of the frames above (build.py)
  for (const tool of ['hoe', 'can', 'scythe', 'pick', 'rod'])
    for (const d of tool === 'hoe' || tool === 'pick'
      ? ALL_DIRS
      : (['down', 'left', 'right'] as const))
      for (let i = 0; i < 3; i++)
        add({
          texture: swingKey(tool, d, i),
          w: 32,
          h: toolFrameHeight(tool, d),
          group: 'chars',
          kind: `player swing ${tool} ${d} (alias)`,
          from: 'art round 4 (alias of player_tool_*)',
          optional: true,
        });
  for (let i = 0; i < 3; i++) {
    add({
      texture: `obj_door_farmhouse_${i}`,
      w: 16,
      h: 32,
      group: 'world',
      kind: `farmhouse door ${i} (alias)`,
      from: 'art round 4 (alias of obj_door_open_*)',
      optional: true,
    });
    add({
      texture: `obj_door_house_${i}`,
      w: 16,
      h: 16,
      group: 'world',
      kind: `house exit door ${i}`,
      from: 'art round 4 (motion.py)',
      optional: true,
    });
  }
  // the menu sheet's 9-slice pieces (art round 5, src/ui/sheetSkin.ts); without them sheets draw the old panel
  for (const p of SHEET_PIECES) {
    const [w, h] = SHEET_PIECE_SIZES[p];
    add({
      texture: sheetPieceKey(p),
      w,
      h,
      group: 'ui',
      kind: `menu sheet 9-slice ${p}`,
      from: 'art round 5 (uisheet.py, Flow ui1)',
      optional: true,
    });
  }
  for (const [k, w, h] of FX_SPRITES)
    add({ texture: k, w, h, group: 'ui', kind: 'fx / ambient', from: 'fx/*', optional: true });
  // Ground items at world scale, drawn at 1x (review 8: the 16 px icon at 0.8 dropped pixel rows)
  for (const it of worldItems())
    add({
      texture: worldItemKey(it),
      w: 12,
      h: 12,
      group: 'world',
      kind: `world item ${it}`,
      from: 'forage.json / animals.json',
      optional: true,
    });
  for (const [k, w, h] of COACH_SPRITES)
    add({ texture: k, w, h, group: 'ui', kind: 'coach mark', from: 'onboarding', optional: true });
  add({
    texture: 'fx_shadow',
    w: 14,
    h: 6,
    group: 'ui',
    kind: 'fx drop shadow',
    from: 'placeholders.ts',
  });

  for (const d of DIRECTIONS) {
    add({
      texture: PLAYER_KEY,
      frame: `player_idle_${d}_0`,
      w: 16,
      h: 32,
      group: 'chars',
      kind: `player idle ${d}`,
      from: 'placeholders.ts',
    });
    add({
      texture: PLAYER_KEY,
      frame: `player_idle_${d}_1`,
      w: 16,
      h: 32,
      group: 'chars',
      kind: `player idle ${d} exhale`,
      from: 'art round 4 (motion.py)',
      optional: true,
    });
    for (let i = 0; i < PLAYER_WALK_FRAMES; i++)
      add({
        texture: PLAYER_KEY,
        frame: `player_walk_${d}_${i}`,
        w: 16,
        h: 32,
        group: 'chars',
        kind: `player walk ${d} ${i}`,
        from: 'placeholders.ts',
      });
  }
  for (const id of Object.keys(npcs))
    for (const d of DIRECTIONS)
      for (let i = 0; i < NPC_IDLE_FRAMES; i++)
        add({
          texture: npcTexture(id),
          frame: npcFrame(id, d, i),
          w: 16,
          h: 32,
          group: 'chars',
          kind: `villager ${id} idle ${d} ${i}`,
          from: 'npcs.json',
          exact: false,
        });
  // Drawn on demand by game/fallbackTexture.ts when no art exists, so they count as optional here.
  for (const [id, p] of Object.entries(projects)) {
    const l = p.landmark;
    if (!l) continue;
    // A growing landmark (the statue) has one key per level, 16x32 so it can stand taller each level.
    const keys = l.levels
      ? Array.from({ length: l.levels }, (_, i) => `${l.sprite}_${i + 1}`)
      : [l.sprite];
    keys.forEach((texture, i) =>
      add({
        texture,
        w: 16,
        h: l.levels ? 32 : 16,
        group: 'world',
        kind: l.levels ? `town landmark ${id} level ${i + 1}` : `town landmark ${id}`,
        from: 'projects.json',
        exact: false,
        optional: true,
      }),
    );
  }
  for (const t of game.trophies ?? [])
    add({
      texture: t.sprite,
      w: 16,
      h: 16,
      group: 'world',
      kind: `trophy ${t.id} at home`,
      from: 'game.json',
      exact: false,
      optional: true,
    });
  add({
    texture: mail.mailbox.sprite,
    w: 16,
    h: 16,
    group: 'world',
    kind: 'mailbox',
    from: 'mail.json',
    exact: false,
    optional: true,
  });
  return out;
}

/** Manifest entries grouped by texture key, in manifest order. */
export function manifestByTexture(entries: ArtEntry[] = artManifest()): Map<string, ArtEntry[]> {
  const m = new Map<string, ArtEntry[]>();
  for (const e of entries) {
    const list = m.get(e.texture) ?? [];
    list.push(e);
    m.set(e.texture, list);
  }
  return m;
}

/** Name of the atlas frame that supplies an entry: the frame name, or the key for single images. */
export const atlasFrameName = (e: ArtEntry): string => e.frame ?? e.texture;
