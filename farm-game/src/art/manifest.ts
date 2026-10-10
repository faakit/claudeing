import { PLACEHOLDER_TILES, TILESET_KEY } from '../config';
import {
  animals,
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
  ['fx_splash_0', 9, 4],
  ['fx_splash_1', 10, 8],
  ['fx_splash_2', 12, 11],
  ['fx_splash_3', 12, 11],
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
  }

  for (const [id, it] of Object.entries(items))
    add({
      texture: it.icon,
      w: 16,
      h: 16,
      group: 'ui',
      kind: `item ${id} (${it.type})`,
      from: 'items.json',
    });
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
    for (let i = 0; i < 4; i++)
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
      for (let i = 0; i < 2; i++)
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
  for (const [id, p] of Object.entries(projects))
    if (p.landmark)
      add({
        texture: p.landmark.sprite,
        w: 16,
        h: 16,
        group: 'world',
        kind: `town landmark ${id}`,
        from: 'projects.json',
        exact: false,
        optional: true,
      });
  // Level frames of a repeatable project's landmark (the Founder's Statue grows each level).
  for (const [id, p] of Object.entries(projects))
    if (p.landmark && p.repeat)
      for (let lv = 2; lv <= p.repeat.perkLevels; lv++)
        add({
          texture: landmarkLevelKey(p.landmark.sprite, lv, p.repeat.perkLevels),
          w: 16,
          h: 16,
          group: 'world',
          kind: `town landmark ${id} level ${lv}`,
          from: 'projects.json',
          exact: false,
          optional: true,
        });
  // Keys the depth branch (depth/round3) draws after the merge: the statue as levels _1.._6 and three house trophies.
  // Optional here, so they are aliased when the atlas has them and nothing else changes on this branch.
  for (const [k, kind] of [
    ['obj_landmark_statue_1', 'statue level 1 (depth/round3 naming)'],
    ['obj_landmark_statue_6', 'statue level 6, gilded (depth/round3)'],
    ['obj_trophy_board', 'house trophy: town board (depth/round3)'],
    ['obj_trophy_festival', 'house trophy: festivals (depth/round3)'],
    ['obj_trophy_legends', 'house trophy: legendary fish (depth/round3)'],
  ] as const)
    add({
      texture: k,
      w: 16,
      h: 16,
      group: 'world',
      kind,
      from: 'depth/round3',
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
