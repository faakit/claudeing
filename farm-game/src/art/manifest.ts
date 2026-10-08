import { PLACEHOLDER_TILES, TILESET_KEY } from '../config';
import { animals, crops, items, nodes, npcs, placeables, tools, trees } from '../data';
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
    w: 16,
    h: 16,
    group: 'world',
    kind: 'young fruit tree',
    from: 'mechanics/fruitTree.ts',
    exact: false,
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
    });
    add({
      texture: animalIdleKey(a.sprite),
      w: 16,
      h: 16,
      group: 'world',
      kind: `animal ${id} idle frame 2`,
      from: 'animals.json',
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
