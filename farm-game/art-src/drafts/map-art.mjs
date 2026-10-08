// DRAFT for the maps pass, not wired in yet (see agents/NEXT-STEPS-ART.md). Visual map layers for the art
// tileset: scripts/generate-maps.mjs will call `artLayers` and write the layers into the .tmj files.
// Ground, collision and objects are untouched except for the solid props listed per map, which are only placed on
// open grass/floor outside every zone, door, spawn, plot, landmark and villager spot (and the map tests check the
// world stays connected). Tile names come from public/assets/tilesets/tiles.json (written by art-src/tools/build.py).
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const TILES_JSON = new URL('../../public/assets/tilesets/tiles.json', import.meta.url);

/** Ground tile names by gid (placeholder order, gid = index + 1). */
const GROUND = [
  'grass',
  'dirt',
  'tilled',
  'watered',
  'water',
  'path',
  'fence',
  'wall',
  'door',
  'floor',
  'wallin',
  'bed',
  'bin',
  'tree',
  'flower',
  'shopwall',
  'shopdoor',
  'board',
  'bush',
  'stone',
  'rock',
];
const GREEN = new Set(['grass', 'flower', 'tree', 'bush', 'board', 'fence', 'bin']);
const BUILDING = { wall: 'red', door: 'red', shopwall: 'slate', shopdoor: 'slate' };
const CASTS_SHADOW = new Set([
  'tree',
  'bush',
  'wall',
  'door',
  'shopwall',
  'shopdoor',
  'rock',
  'board',
]);

const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * Per-map composition: hand-placed props (solid) and lights. Coordinates are tile coords; a two-tile prop
 * (`t_*`) has its base here and its top on the tile above (overhead layer). A placement that lands on a
 * reserved or non-open tile is skipped with a warning, so map changes elsewhere can never break gameplay.
 */
const COMPOSITION = {
  farm: {
    props: [
      ['t_lanternpole', 16, 8],
      ['t_well', 6, 5],
      ['p_barrel', 9, 6],
      ['p_crates', 9, 7],
      ['p_haybale', 19, 6],
      ['p_trough', 19, 7],
      ['w_laundry', 20, 5],
      ['p_stump', 24, 42],
      ['p_mosslog', 5, 42],
      ['p_rock', 27, 20],
      ['p_rock', 2, 21],
      ['t_scarecrow', 27, 24],
      ['p_logs', 27, 12],
    ],
    facade: [
      [11, 7, 'f_window_box'],
      [13, 7, 'f_window'],
      [16, 7, 'f_window'],
      [17, 7, 'f_window_box'],
    ],
    trees: ['oak', 'oak', 'birch'],
    roses: 0.05,
    tallgrass: 0,
  },
  town: {
    props: [
      ['t_streetlamp', 9, 3],
      ['t_streetlamp', 14, 8],
      ['t_streetlamp', 9, 13],
      ['t_streetlamp', 14, 20],
      ['t_streetlamp', 9, 22],
      ['p_barrel', 9, 5],
      ['p_applecrates', 9, 6],
      ['p_crates', 1, 6],
      ['w_laundry', 3, 13],
      ['p_bench', 14, 23],
      ['p_signpost', 9, 26],
      ['t_well', 5, 12],
      ['p_flowerpot', 8, 14],
      ['p_barrel', 18, 7],
    ],
    facade: [
      [2, 9, 'f_window_box'],
      [3, 9, 'f_window'],
      [7, 9, 'f_window'],
      [8, 9, 'f_window_box'],
      [15, 6, 'f_window_box'],
      [18, 6, 'f_window'],
      [3, 18, 'f_window'],
      [6, 18, 'f_window_box'],
      [15, 18, 'f_window_box'],
      [16, 18, 'f_window'],
    ],
    trees: ['oak', 'birch', 'oak', 'pine'],
    roses: 0.06,
    tallgrass: 0.02,
  },
  woods: {
    props: [
      ['p_mosslog', 18, 2],
      ['p_stump', 1, 26],
      ['p_rock', 18, 28],
      ['p_logs', 1, 12],
    ],
    facade: [],
    trees: ['pine', 'pine', 'oak', 'birch'],
    roses: 0.05,
    tallgrass: 0.05,
  },
  mine: {
    props: [
      ['p_torch', 8, 28, 'rock'],
      ['p_torch', 11, 28, 'rock'],
      ['p_minecart', 4, 26],
      ['t_beams', 8, 27, 'rock'],
      ['t_beams', 11, 27, 'rock'],
    ],
    crystals: 6,
    facade: [],
    trees: [],
    roses: 0,
    tallgrass: 0,
  },
  house: {
    props: [
      ['i_window', 3, 1, 'wallin'],
      ['i_painting', 5, 1, 'wallin'],
      ['i_fireplace', 7, 1, 'wallin'],
      ['i_clock', 5, 0, 'wallin'],
      ['i_shelf', 8, 1, 'wallin'],
      ['i_stove', 8, 2],
      ['i_table', 6, 4],
      ['i_chair', 7, 4],
      ['i_armchair', 8, 5],
      ['i_plant', 1, 7],
      ['i_chest', 8, 7],
      ['i_lamp', 3, 2],
      ['i_yarn', 1, 5],
    ],
    rug: [4, 4],
    facade: [],
    trees: [],
    roses: 0,
    tallgrass: 0,
  },
};

const LIGHT_OF = {
  t_streetlamp: 'lamp',
  t_lanternpole: 'lamp',
  p_torch: 'torch',
  p_crystal: 'crystal',
  i_fireplace: 'fire',
  i_lamp: 'lamp',
  f_window: 'window',
  f_window_box: 'window',
  i_window: 'window',
};

/** Tiles where nothing solid may go: objects (doors, zones, interactables), spawns, plots, landmarks, villagers. */
function reservedTiles(name, w, h, objects) {
  const r = new Set();
  const mark = (x, y, pad = 0) => {
    for (let j = y - pad; j <= y + pad; j++)
      for (let i = x - pad; i <= x + pad; i++)
        if (i >= 0 && j >= 0 && i < w && j < h) r.add(j * w + i);
  };
  for (const o of objects) {
    const tx = Math.floor(o.x / 16);
    const ty = Math.floor(o.y / 16);
    const tw = Math.max(1, Math.round(o.width / 16));
    const th = Math.max(1, Math.round(o.height / 16));
    const pad = o.type === 'door' ? 1 : 0;
    for (let j = ty; j < ty + th; j++) for (let i = tx; i < tx + tw; i++) mark(i, j, pad);
  }
  const maps = read('../../src/data/maps.json');
  for (const s of [maps.start, maps.wake]) if (s.map === name) mark(s.tx, s.ty, 1);
  for (const n of Object.values(read('../../src/data/npcs.json'))) {
    if (n.map === name) mark(n.tx, n.ty, 1);
    for (const s of n.schedule ?? []) if (s.map === name) mark(s.tx, s.ty, 1);
  }
  for (const p of Object.values(read('../../src/data/projects.json')))
    if (p.landmark?.map === name) mark(p.landmark.tx, p.landmark.ty, 1);
  const mail = read('../../src/data/mail.json').mailbox;
  if (mail.map === name) mark(mail.tx, mail.ty, 1);
  if (name === 'farm')
    for (const p of Object.values(read('../../src/data/plots.json'))) {
      const [x, y, pw, ph] = p.rect ?? [];
      if (x !== undefined)
        for (let j = y - 1; j <= y + ph; j++) for (let i = x - 1; i <= x + pw; i++) mark(i, j);
    }
  return r;
}

/**
 * @returns {null | { layers: Record<string, number[]>, solid: Set<number>, lights: object[], tilecount: number,
 *   rows: number }}
 */
export function artLayers(name, m, objects) {
  if (!existsSync(TILES_JSON)) return null;
  const { tiles, columns } = JSON.parse(readFileSync(TILES_JSON, 'utf8'));
  const gid = (n) => {
    if (tiles[n] === undefined) throw new Error(`tile "${n}" missing from tiles.json`);
    return tiles[n] + 1;
  };
  const C = COMPOSITION[name] ?? { props: [], facade: [], trees: [], roses: 0, tallgrass: 0 };
  const { w, h } = m;
  const kind = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : GROUND[m.ground[y][x] - 1]);
  const L = Object.fromEntries(
    ['detail', 'shade', 'roof', 'props', 'overhead'].map((k) => [k, new Array(w * h).fill(0)]),
  );
  const set = (layer, x, y, n) => {
    if (x >= 0 && y >= 0 && x < w && y < h) L[layer][y * w + x] = gid(n);
  };
  const solid = new Set();
  const lights = [];
  const reserved = reservedTiles(name, w, h, objects);
  const zoneTiles = new Set();
  for (const o of objects)
    if (['weedzone', 'forage', 'ore'].includes(o.type))
      for (let j = o.y / 16; j < (o.y + o.height) / 16; j++)
        for (let i = o.x / 16; i < (o.x + o.width) / 16; i++) zoneTiles.add(j * w + i);

  const maskOf = (x, y, differs) => {
    let mk = 0;
    if (differs(kind(x, y - 1))) mk |= 1;
    if (differs(kind(x + 1, y))) mk |= 2;
    if (differs(kind(x, y + 1))) mk |= 4;
    if (differs(kind(x - 1, y))) mk |= 8;
    return mk;
  };

  // --- detail: edges, shorelines, rock masses, ground variants ---
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = kind(x, y);
      const r = hash(x, y, w * 7 + h);
      if (k === 'path') {
        const mk = maskOf(x, y, (n) => n !== null && GREEN.has(n));
        if (mk) set('detail', x, y, `edge_path_${mk}`);
      } else if (k === 'dirt') {
        const mk = maskOf(x, y, (n) => n !== null && GREEN.has(n));
        if (mk) set('detail', x, y, `edge_dirt_${mk}`);
      } else if (k === 'water') {
        const mk = maskOf(x, y, (n) => n !== null && n !== 'water');
        if (mk) set('detail', x, y, `shore_${mk}`);
      } else if (k === 'rock') {
        set('detail', x, y, `rock_${maskOf(x, y, (n) => n === 'stone' || n === 'path')}`);
      } else if (k === 'grass') {
        const v = r % 100;
        if (v < 9) set('detail', x, y, 'grass_v1');
        else if (v < 15) set('detail', x, y, 'grass_v2');
        else if (v < 18) set('detail', x, y, 'grass_v3');
      } else if (k === 'stone' && r % 100 < 9) set('detail', x, y, 'stone_v1');
    }

  // --- shade: drop shadows south of tall things, flat decor ---
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = kind(x, y);
      const above = kind(x, y - 1);
      if (k && !CASTS_SHADOW.has(k) && k !== 'water' && above && CASTS_SHADOW.has(above)) {
        set('shade', x, y, 'shade_n');
        continue;
      }
      const r = hash(x, y, 91 + w);
      const f = (r % 1000) / 1000;
      const farmland = name === 'farm' && zoneTiles.has(y * w + x);
      if (k === 'grass' && !farmland) {
        if (f < C.roses * 0.4) set('shade', x, y, 'rose_2');
        else if (f < C.roses) set('shade', x, y, 'rose_1');
        else if (f < C.roses + C.tallgrass) set('shade', x, y, 'tallgrass');
      } else if (k === 'path' && f < 0.03) set('shade', x, y, 'pebbles');
      else if (k === 'path' && f < 0.04 && name !== 'farm') set('shade', x, y, 'puddle');
      else if (k === 'stone' && f < 0.06) set('shade', x, y, 'rubble');
    }
  if (C.rug) {
    const [rx, ry] = C.rug;
    set('shade', rx, ry, 'rug_tl');
    set('shade', rx + 1, ry, 'rug_tr');
    set('shade', rx, ry + 1, 'rug_bl');
    set('shade', rx + 1, ry + 1, 'rug_br');
  }

  // --- roofs over building blocks (all rows but the facade), eaves above them ---
  const seen = new Set();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const style = BUILDING[kind(x, y)];
      if (!style || seen.has(y * w + x)) continue;
      const cells = [];
      const stack = [[x, y]];
      seen.add(y * w + x);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        for (const [nx, ny] of [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ])
          if (BUILDING[kind(nx, ny)] === style && !seen.has(ny * w + nx)) {
            seen.add(ny * w + nx);
            stack.push([nx, ny]);
          }
      }
      const top = Math.min(...cells.map((c) => c[1]));
      const bottom = Math.max(...cells.map((c) => c[1]));
      if (top === bottom) continue;
      const inBlock = (cx, cy) => cells.some(([a, b]) => a === cx && b === cy);
      for (const [cx, cy] of cells) {
        const col = !inBlock(cx - 1, cy) ? 'l' : !inBlock(cx + 1, cy) ? 'r' : 'c';
        if (cy === top && top > 0) set('overhead', cx, cy - 1, `eave_${style}_${col}`);
        if (cy === bottom) continue;
        const row = cy === bottom - 1 ? 'b' : cy === top ? 't' : 'm';
        set('roof', cx, cy, `roof_${style}_${row}${col}`);
      }
    }

  // --- trees and bushes: a taller tree on every tree tile, its canopy over the tile above ---
  if (C.trees.length)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = kind(x, y);
        if (k === 'bush') set('props', x, y, 'bush_big');
        if (k !== 'tree') continue;
        const t = C.trees[hash(x, y, 5) % C.trees.length];
        set('props', x, y, `tree_${t}_base`);
        const up = kind(x, y - 1);
        if (up !== null && up !== 'tree') set('overhead', x, y - 1, `tree_${t}_top`);
      }

  // --- hand-placed props ---
  const open = (x, y, on) => {
    const k = kind(x, y);
    if (on) return k === on && L.props[y * w + x] === 0;
    const i = y * w + x;
    return (
      (k === 'grass' || k === 'flower' || k === 'floor' || k === 'stone') &&
      !reserved.has(i) &&
      !zoneTiles.has(i) &&
      L.props[i] === 0
    );
  };
  const place = (n, x, y, on) => {
    if (!open(x, y, on)) {
      console.warn(`map-art: ${name}: skipped ${n} at ${x},${y} (not open)`);
      return false;
    }
    set('props', x, y, n);
    solid.add(y * w + x);
    return true;
  };
  for (const [n, x, y, on] of C.props) {
    if (n.startsWith('t_')) {
      if (place(`${n}_base`, x, y, on)) set('overhead', x, y - 1, `${n}_top`);
    } else if (n.startsWith('w_')) {
      if (open(x, y, on) && open(x + 1, y, on)) {
        place(`${n}_l`, x, y, on);
        place(`${n}_r`, x + 1, y, on);
      } else console.warn(`map-art: ${name}: skipped ${n} at ${x},${y}`);
    } else if (n === 'i_shelf') {
      if (place('i_shelf_bot', x, y, on)) set('props', x, y - 1, 'i_shelf_top');
    } else place(n, x, y, on);
    const light = LIGHT_OF[n];
    if (light && L.props[y * w + x])
      lights.push({ type: light, tx: x, ty: n.startsWith('t_') ? y - 1 : y });
  }
  for (const [x, y, n] of C.facade) {
    const k = kind(x, y);
    if (!BUILDING[k] || k === 'door' || k === 'shopdoor') {
      console.warn(`map-art: ${name}: no facade at ${x},${y}`);
      continue;
    }
    set('props', x, y, n);
    lights.push({ type: 'window', tx: x, ty: y });
  }
  if (C.crystals) {
    // crystals on wall faces that look onto the cavern floor (already solid rock)
    const spots = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (kind(x, y) === 'rock' && kind(x, y + 1) === 'stone' && L.props[y * w + x] === 0)
          spots.push([x, y, hash(x, y, 77)]);
    spots.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of spots.slice(0, C.crystals)) {
      set('props', x, y, 'p_crystal');
      lights.push({ type: 'crystal', tx: x, ty: y });
    }
  }
  const rows = Math.ceil(Object.keys(tiles).length / columns);
  return { layers: L, solid, lights, tilecount: rows * columns, columns, rows };
}
