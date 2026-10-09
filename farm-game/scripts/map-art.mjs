// Visual map layers for the art tileset (round-2 maps pass). scripts/generate-maps.mjs calls `artLayers` and
// writes the layers into the .tmj files. Tile names come from public/assets/tilesets/tiles.json, written by
// art-src/tools/build.py (tiles authored in art-src/tools/maptiles.py and tiles_extra.py).
//
// Gameplay geometry is never changed: ground, doors, zones and objects stay as generated. The only collision this
// adds is `solid` for hand-placed props, and a prop is placed only on open grass/floor outside every zone, door,
// spawn, plot, landmark, mailbox, sign and villager spot (anything else is skipped with a warning). Big visuals
// (the forest mass, the old oak, the chimney, boats) are anchored on tiles that are already solid.
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const TILES_JSON = new URL('../public/assets/tilesets/tiles.json', import.meta.url);

/** Baked tiles requested by the maps (rendered by art-src/tools/bake.py), and those not rendered yet. */
const RECIPES = new Set();
const MISSING = new Set();
export const bakedTiles = () => ({ recipes: [...RECIPES].sort(), missing: [...MISSING] });

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
/** Ground that reads as grass at a transition (paths and dirt get grass creeping onto them from these). */
const GREEN = new Set(['grass', 'flower', 'tree', 'bush', 'board', 'fence', 'bin']);
const BUILDING = { wall: 'red', door: 'red', shopwall: 'slate', shopdoor: 'slate' };
const N = 1,
  E = 2,
  S = 4,
  W = 8,
  NE = 16,
  SE = 32,
  SW = 64,
  NW = 128;

/** Same reduction as art-src/tools/maptiles.py `canon`: a corner bit counts only when both sides next to it are clear. */
export function canon(m) {
  if (m & (N | E)) m &= ~NE;
  if (m & (S | E)) m &= ~SE;
  if (m & (S | W)) m &= ~SW;
  if (m & (N | W)) m &= ~NW;
  return m;
}

const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
/** Smooth value noise in [0,1) over a lattice of `cell` tiles: ground variation comes in patches, not salt and pepper. */
function noise(x, y, cell, seed) {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const v = (i, j) => (hash(gx + i, gy + j, seed) % 1000) / 1000;
  const s = (t) => t * t * (3 - 2 * t);
  const a = v(0, 0) + (v(1, 0) - v(0, 0)) * s(fx);
  const b = v(0, 1) + (v(1, 1) - v(0, 1)) * s(fx);
  return a + (b - a) * s(fy);
}

/**
 * Per-map composition. Coordinates are tile coords. Props: `t_*` has its base here and its top on the tile above
 * (overhead); `w_*` spans this tile and the one east. `facade` decorates a building's front (bottom) row;
 * `chimney` sits on a roof's top row. `flat` is walkable decor in the shade layer.
 */
const COMPOSITION = {
  farm: {
    props: [
      // two yard vignettes with air between them: water (well, bucket, wash tub) and firewood (logs, the
      // split pile, a stump for a chopping block); tools and stores by the east wall; the lamp where the path
      // leaves the door
      ['t_well', 3, 4],
      ['p_bucket', 4, 5],
      ['p_trough', 2, 5],
      ['p_logs', 7, 5],
      ['p_firewood', 8, 5],
      ['p_stump', 8, 6],
      ['p_toolrack', 19, 6],
      ['p_barrel', 19, 7],
      ['p_crates', 20, 7],
      ['w_laundry', 21, 3],
      ['p_haybale', 23, 7],
      ['t_lanternpole', 16, 8],
      ['p_flowerbed', 10, 8],
      ['p_flowerbed', 11, 8],
      ['p_cat', 11, 9],
      ['p_trellis', 9, 7],
      // a bench to sit by the pond
      ['p_bench', 27, 26],
      ['t_scarecrow', 27, 24],
      ['p_hollowlog', 5, 42],
      ['p_sign_sprout', 17, 42],
    ],
    // copses that frame the fence corners and sides (each joins one of the farm's lone trees)
    groves: [
      [1, 2, 3, 2],
      [25, 2, 3, 3],
      [1, 19, 2, 3],
      [27, 15, 2, 3],
      [1, 40, 3, 3],
      [25, 40, 3, 3],
    ],
    facade: [
      [12, 7, 'f_window_box'],
      [15, 7, 'f_lantern'],
      [17, 7, 'f_window_box'],
    ],
    chimney: [[16, 3]],
    vane: [[12, 2]],
    trees: ['oak', 'oak', 'birch'],
    bushes: ['bush_big', 'bush_rose', 'bush_small'],
    blooms: 0.35,
  },
  town: {
    props: [
      ['t_streetlamp', 9, 3],
      ['t_streetlamp', 14, 8],
      ['t_streetlamp', 8, 15],
      ['t_streetlamp', 14, 20],
      ['t_streetlamp', 9, 28],
      // Mara's store: stock stacked by the wall
      ['p_barrel', 9, 5],
      ['p_applecrates', 9, 6],
      ['p_crates', 9, 7],
      ['p_crates', 1, 6],
      // the well and a bench: the square
      ['t_well', 9, 12],
      ['p_bench', 8, 13],
      // Orin's smithy
      ['p_coal', 2, 19],
      ['p_anvil', 3, 19],
      ['p_firewood', 7, 19],
      // Rosa's cottage
      ['p_flowerbed', 16, 19],
      ['p_flowerbed', 17, 19],
      ['p_flowerpot', 18, 18],
      ['p_trellis', 19, 18],
      // a stone lantern across the road from the square
      ['p_stonelantern', 15, 14],
      // Clay's house
      ['p_wheelbarrow', 20, 5],
      // Finn's things by the river
      ['p_bucket', 18, 32],
      ['p_netrack', 19, 32],
      ['p_fishcrate', 21, 32],
      ['p_signpost', 9, 26],
      ['p_sign_sprout', 14, 1],
      ['w_laundry', 3, 13],
    ],
    facade: [
      // the store
      [3, 9, 'f_window_box'],
      [7, 9, 'f_window_box'],
      // Clay's house (north-east)
      [15, 6, 'f_window'],
      [16, 6, 'f_door'],
      [18, 6, 'f_window'],
      // Orin's smithy (south-west)
      [2, 18, 'f_window'],
      [4, 18, 'f_forge'],
      [6, 18, 'f_door'],
      // Rosa's cottage (south-east)
      [14, 18, 'f_window_box'],
      [15, 18, 'f_door'],
      [16, 18, 'f_window_box'],
    ],
    chimney: [
      [6, 15],
      [18, 3],
    ],
    boats: [[18, 29]],

    cobble: [10, 9, 4, 4],
    trees: ['oak', 'birch', 'oak', 'pine'],
    bushes: ['bush_big', 'bush_rose', 'bush_small'],
    blooms: 0.4,
  },
  woods: {
    props: [
      ['p_hollowlog', 18, 2],
      ['p_stump', 1, 26],
      ['p_boulder', 18, 28],
      ['p_logs', 1, 12],
    ],
    // groves pushing in from the wood's edge where no forage zone lies (the clearings stay open)
    groves: [
      [1, 17, 2, 6],
      [2, 1, 3, 2],
      [12, 1, 4, 2],
      [18, 5, 1, 5],
    ],
    groveEdge: 0.45,
    bigOak: [17, 3],
    cave: [9, 0],
    trees: ['oak', 'birch', 'oak', 'pine'],
    bushes: ['bush_big', 'bush_berry', 'fern', 'p_boulder', 'fern', 'p_rootstump'],
    blooms: 0.15,
  },
  mine: {
    props: [
      ['p_minecart', 4, 26],
      ['p_crates', 15, 26],
      ['p_torch', 1, 25, 'rock'],
      ['p_torch', 18, 25, 'rock'],
      ['p_torch', 6, 1, 'rock'],
      ['p_torch', 13, 1, 'rock'],
      ['t_beams', 8, 28, 'rock'],
      ['t_beams', 11, 28, 'rock'],
      ['t_beams', 6, 24],
      ['t_beams', 12, 24],
      ['p_stalagmite', 2, 10],
      ['p_stalagmite', 17, 15],
    ],
    // rock bays pushing in from the walls, so the cavern is not a rectangle
    bays: [
      [2, 5, 1, 3],
      [2, 14, 1, 4],
      [17, 9, 1, 3],
      [17, 18, 1, 2],
      [5, 2, 3, 1],
      [12, 2, 2, 1],
      [2, 24, 1, 2],
      [16, 27, 2, 1],
    ],
    lintel: [9, 27, 2],
    // the cart's track: from the cart by the west wall, across the hall and up toward the ore
    rails: [
      [5, 26, 'h'],
      [6, 26, 'h'],
      [7, 26, 'h'],
      [8, 26, 'nw'],
      [8, 25, 'v'],
      [8, 24, 'v'],
    ],
    crystals: 7,
    trees: [],
    bushes: [],
    blooms: 0,
  },
  house: {
    props: [
      ['i_window', 3, 1, 'wallin'],
      ['i_clock', 5, 1, 'wallin'],
      ['i_fireplace', 7, 1, 'wallin'],
      ['i_shelf', 8, 1, 'wallin'],
      ['i_stove', 8, 2],
      ['i_table', 6, 4],
      ['i_chair', 7, 4],
      ['i_armchair', 8, 5],
      ['i_lamp', 1, 4],
      ['i_yarn', 1, 5],
      ['i_plant', 1, 7],
      ['i_chest', 8, 7],
    ],
    rug: [4, 4],
    trees: [],
    bushes: [],
    blooms: 0,
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
  f_lantern: 'wall',
  f_forge: 'fire',
};

/** Tiles where nothing solid may go: objects (doors, zones, interactables), spawns, plots, landmarks, villagers. */
export function reservedTiles(name, w, h, objects) {
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
  const maps = read('../src/data/maps.json');
  for (const s of [maps.start, maps.wake]) if (s.map === name) mark(s.tx, s.ty, 1);
  for (const n of Object.values(read('../src/data/npcs.json'))) {
    if (n.map === name) mark(n.tx, n.ty, 1);
    for (const s of n.schedule ?? []) if (s.map === name) mark(s.tx, s.ty, 1);
  }
  for (const p of Object.values(read('../src/data/projects.json')))
    if (p.landmark?.map === name) mark(p.landmark.tx, p.landmark.ty, 1);
  const mail = read('../src/data/mail.json').mailbox;
  if (mail.map === name) mark(mail.tx, mail.ty, 1);
  if (name === 'farm')
    for (const p of Object.values(read('../src/data/plots.json'))) {
      const [x, y, pw, ph] = p.rect ?? [];
      if (x !== undefined)
        for (let j = y - 1; j <= y + ph; j++) for (let i = x - 1; i <= x + pw; i++) mark(i, j);
      if (p.sign) mark(p.sign[0], p.sign[1], 1);
    }
  return r;
}

/** Door spawn tiles on this map (where other maps' doors drop the player): kept clear of props too. */
export function spawnTiles(name, allObjects) {
  const out = [];
  for (const list of Object.values(allObjects))
    for (const o of list) {
      if (o.type !== 'door') continue;
      const p = Object.fromEntries((o.properties ?? []).map((q) => [q.name, q.value]));
      if (p.targetMap === name) out.push([p.spawnTx, p.spawnTy]);
    }
  return out;
}

/**
 * @returns {null | { layers: Record<string, number[]>, solid: Set<number>, lights: object[],
 *   blooms: { x: number, y: number, n: number }[], tilecount: number,
 *   columns: number, rows: number }}
 */
export function artLayers(name, m, objects, extraReserved = []) {
  if (!existsSync(TILES_JSON)) return null;
  const { tiles, columns } = JSON.parse(readFileSync(TILES_JSON, 'utf8'));
  const gid = (n) => {
    if (tiles[n] !== undefined) return tiles[n] + 1;
    MISSING.add(n); // not in the tileset yet: build.py renders it on the next run (npm run art:maps)
    return 0;
  };
  /** A baked tile (rendered in world space by art-src/tools/bake.py), requested by name. */
  const bake = (...parts) => {
    const n = parts.join(':');
    RECIPES.add(n);
    return n;
  };
  const seed = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 100000;
  /** Membership string of the n x n window centred on (x, y); out of the map counts as `edge`. */
  const nb = (x, y, n, test, edge) => {
    let out = '';
    const r = (n - 1) / 2;
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        const k = kind(x + i, y + j);
        out += (k === null ? edge : test(k, x + i, y + j)) ? '1' : '0';
      }
    return out;
  };
  const has = (n) => tiles[n] !== undefined;
  const C = COMPOSITION[name] ?? { props: [], trees: [], bushes: [], blooms: 0 };
  const { w, h } = m;
  // The art reads a copy of the ground with its additions (groves, rock bays) applied below.
  const G = m.ground.map((row) => row.slice());
  const kind = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : GROUND[G[y][x] - 1]);
  const L = Object.fromEntries(
    ['detail', 'shade', 'roof', 'props', 'overhead'].map((k) => [k, new Array(w * h).fill(0)]),
  );
  const set = (layer, x, y, n) => {
    if (x >= 0 && y >= 0 && x < w && y < h) L[layer][y * w + x] = gid(n);
  };
  // (a tile that renders fully transparent has index -1 in tiles.json, so its gid is 0: the cell stays empty)
  const setIfFree = (layer, x, y, n) => {
    if (x >= 0 && y >= 0 && x < w && y < h && !L[layer][y * w + x]) set(layer, x, y, n);
  };
  const solid = new Set();
  const lights = [];
  const reserved = reservedTiles(name, w, h, objects);
  for (const [x, y] of extraReserved)
    for (let j = y - 1; j <= y + 1; j++)
      for (let i = x - 1; i <= x + 1; i++)
        if (i >= 0 && j >= 0 && i < w && j < h) reserved.add(j * w + i);
  const zoneTiles = new Set();
  for (const o of objects)
    if (['weedzone', 'forage', 'ore'].includes(o.type))
      for (let j = o.y / 16; j < (o.y + o.height) / 16; j++)
        for (let i = o.x / 16; i < (o.x + o.width) / 16; i++) zoneTiles.add(j * w + i);

  // --- additions: small groves of trees and rock bays, only on open ground outside every zone and reserved
  // spot (the same rule as props); they are solid, so they go into `solid` like props ---
  const freeGround = (x, y) => {
    const k = kind(x, y);
    const i = y * w + x;
    return (
      (k === 'grass' || k === 'flower' || k === 'stone') && !reserved.has(i) && !zoneTiles.has(i)
    );
  };
  for (const [list, k] of [
    [C.groves ?? [], 'tree'],
    [C.bays ?? [], 'rock'],
  ])
    for (const [gx, gy, gw, gh] of list)
      for (let y = gy; y < gy + gh; y++)
        for (let x = gx; x < gx + gw; x++)
          if (x >= 0 && y >= 0 && x < w && y < h && freeGround(x, y)) {
            G[y][x] = GROUND.indexOf(k) + 1;
            solid.add(y * w + x);
          }

  const mask4 = (x, y, same, edge = true) => {
    let mk = 0;
    for (const [dx, dy, bit] of [
      [0, -1, N],
      [1, 0, E],
      [0, 1, S],
      [-1, 0, W],
    ]) {
      const k = kind(x + dx, y + dy);
      if (k === null ? edge : same(k, x + dx, y + dy)) mk |= bit;
    }
    return mk;
  };

  // --- classify trees: a group of tree tiles joined to the map edge, or of 3 or more, is drawn as a wood of
  // crowns; smaller groups stand alone ---
  const forest = new Set();
  {
    const seenT = new Set();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (kind(x, y) !== 'tree' || seenT.has(y * w + x)) continue;
        const group = [];
        const stack = [[x, y]];
        seenT.add(y * w + x);
        let edge = false;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          group.push(cy * w + cx);
          if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) edge = true;
          for (const [nx, ny] of [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
          ])
            if (kind(nx, ny) === 'tree' && !seenT.has(ny * w + nx)) {
              seenT.add(ny * w + nx);
              stack.push([nx, ny]);
            }
        }
        if (edge || group.length >= 3) group.forEach((i) => forest.add(i));
      }
  }
  const isForest = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? true : forest.has(y * w + x));

  const cliff = new Set();
  if (C.cave) {
    const [cx, cy] = C.cave;
    cliff.add(cy * w + cx - 1);
    cliff.add(cy * w + cx + 2);
  }
  /** The forest mass drawn as tree crowns (the cliff by the cave mouth is rock instead). */
  const woods = (x, y) => isForest(x, y) && !cliff.has(y * w + x);
  /** Object tiles standing in water (a bush placed in the lake): drawn as reeds on water. */
  const wet = (x, y) =>
    ['tree', 'bush'].includes(kind(x, y)) &&
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].filter(([dx, dy]) => kind(x + dx, y + dy) === 'water').length >= 3;
  const waterish = (k, x, y) => k === 'water' || wet(x, y);

  const torches = (C.props ?? []).filter(([n]) => n === 'p_torch').map(([, x, y]) => [x, y]);
  if (C.lintel) torches.push([C.lintel[0] + 0.5, C.lintel[1]]); // daylight at the mine's mouth
  /**
   * Floor darkness 0-9 at a tile corner, following the geometry: it rises with the distance from the nearest
   * light (a straight falloff from 4 to 9 tiles) and is deepest against walls, in bays and at boulder feet.
   */
  // only the cavern's outer wall and its bays deepen the dark (boulders get their own foot band)
  const rockTiles = [];
  {
    const seenR = new Set();
    const stack = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (kind(x, y) === 'rock' && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) {
          seenR.add(y * w + x);
          stack.push([x, y]);
        }
    while (stack.length) {
      const [x, y] = stack.pop();
      rockTiles.push([x + 0.5, y + 0.5]);
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ])
        if (kind(nx, ny) === 'rock' && !seenR.has(ny * w + nx)) {
          seenR.add(ny * w + nx);
          stack.push([nx, ny]);
        }
    }
  }
  const darkness = (cx, cy) => {
    const d = Math.min(99, ...torches.map(([tx, ty]) => Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy)));
    const far = Math.max(0, Math.min(1, (d - 4) / 5));
    let near = 9;
    for (const [rx, ry] of rockTiles) {
      const e = Math.max(Math.abs(rx - cx), Math.abs(ry - cy)) - 0.5;
      if (e < near) near = e;
    }
    const wall = Math.max(0, Math.min(1, 1 - near / 2.5));
    return Math.round(9 * far * (0.25 + 0.75 * wall));
  };
  const cornersOf = (x, y) =>
    [
      [x, y],
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
    ]
      .map(([cx, cy]) => darkness(cx, cy))
      .join('');
  // --- detail: ground bases under objects, transitions, variation ---
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = kind(x, y);
      const i = y * w + x;
      if (k === 'path') {
        const g = nb(x, y, 3, (n) => GREEN.has(n), false);
        if (g.includes('1')) set('detail', x, y, bake('creep', 'path', seed, x, y, g));
        else {
          // the middle of a wide path: worn in patches, cart ruts down the long roads
          const n = noise(x, y, 4, 71 + w);
          const long =
            kind(x, y - 1) === 'path' && kind(x, y + 1) === 'path' && kind(x, y - 2) === 'path';
          if (n > 0.6) set('detail', x, y, long && hash(x, 0, 3) % 2 ? 'path_ruts' : 'path_worn');
          else set('detail', x, y, `path_${hash(x, y, 31) % 3}`);
        }
      } else if (k === 'dirt') {
        const g = nb(x, y, 3, (n) => GREEN.has(n), false);
        if (g.includes('1')) set('detail', x, y, bake('creep', 'dirt', seed, x, y, g));
      } else if (k === 'water') {
        const wa = nb(x, y, 3, waterish, true);
        if (wa.includes('0')) set('detail', x, y, bake('shore', seed, x, y, wa));
        else set('detail', x, y, bake('water', seed, x, y));
      } else if (k === 'rock') {
        const r = nb(x, y, 3, (n) => n !== 'stone' && n !== 'path', true);
        set(
          'detail',
          x,
          y,
          r.includes('0') ? bake('rock', seed, x, y, r, cornersOf(x, y)) : 'rock_0',
        );
      } else if (k === 'stone') {
        const n = noise(x, y, 5, 41 + w);
        // darker pockets of floor far from the torches; worn and earthy patches elsewhere
        const corners = cornersOf(x, y);
        if (/[1-9]/.test(corners)) set('detail', x, y, bake('floor', seed, x, y, corners));
        else set('detail', x, y, `stone_${n > 0.62 ? 2 : n < 0.35 ? 1 : hash(x, y, 8) % 2}`);
      } else if (k === 'bed') {
        set('detail', x, y, 'base_floor');
      } else if (k === 'tree' || k === 'bush') {
        if (wet(x, y)) set('detail', x, y, 'base_water');
        else if (cliff.has(i)) set('detail', x, y, bake('rock', seed, x, y, '111111000'));
        else set('detail', x, y, hash(x, y, 3) % 2 ? 'base_grass' : 'base_grass_2');
      } else if (k === 'grass' || k === 'flower' || k === 'fence') {
        // opaque grass variants: lush in clustered patches, plain ones at random to break the 16 px repeat
        const n = noise(x, y, 4, 17 + w);
        const r = hash(x, y, 29);
        if (n > 0.6) set('detail', x, y, `lush_${r % 3}`);
        else set('detail', x, y, `grass_${r % 4}`);
      } else if (k === 'wallin') {
        if (kind(x, y + 1) === 'floor' || kind(x, y + 1) === 'bed')
          set('detail', x, y, 'wall_face');
        else
          set(
            'detail',
            x,
            y,
            `wall_top_${mask4(x, y, (n) => n !== 'wallin' && n !== 'door', false)}`,
          );
      }
    }
  if (C.cave) {
    const [cx, cy] = C.cave;
    set('detail', cx, cy, 'cave_l');
    set('detail', cx + 1, cy, 'cave_r');
  }
  if (C.cobble) {
    const [cx, cy, cw, ch] = C.cobble;
    const inSq = (x, y) => x >= cx && y >= cy && x < cx + cw && y < cy + ch;
    for (let y = cy; y < cy + ch; y++)
      for (let x = cx; x < cx + cw; x++) {
        if (kind(x, y) !== 'path') continue;
        let mk = 0;
        if (!inSq(x, y - 1)) mk |= N;
        if (!inSq(x + 1, y)) mk |= E;
        if (!inSq(x, y + 1)) mk |= S;
        if (!inSq(x - 1, y)) mk |= W;
        set('detail', x, y, `cobble_${mk}`);
      }
  }

  // --- forest mass, fences, bushes, standalone trees (props); overhangs and canopies (overhead) ---
  const overTop = (x, y, n) => {
    // an overhead tile above (x, y): only where nothing overhead is drawn yet
    if (y - 1 >= 0) setIfFree('overhead', x, y - 1, n);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = kind(x, y);
      const i = y * w + x;
      if (k === 'tree' && woods(x, y)) {
        set(
          'props',
          x,
          y,
          bake(
            'canopy',
            seed,
            x,
            y,
            'in',
            nb(x, y, 5, (_, nx, ny) => woods(nx, ny), true),
          ),
        );
      } else if (k === 'tree' && wet(x, y)) {
        set('props', x, y, 'reeds_s');
      } else if (k === 'tree' && !cliff.has(i) && C.trees.length) {
        const t = C.trees[hash(x, y, 5) % C.trees.length];
        set('props', x, y, `tree_${t}_base`);
        const up = kind(x, y - 1);
        if (up !== null && up !== 'tree') overTop(x, y, `tree_${t}_top`);
      } else if (k === 'bush') {
        if (wet(x, y)) set('props', x, y, hash(x, y, 4) % 2 ? 'reeds_s' : 'p_boulder');
        else if (C.bushes.length) set('props', x, y, C.bushes[hash(x, y, 7) % C.bushes.length]);
        else set('props', x, y, 'bush_big');
      } else if (k === 'fence') {
        set('props', x, y, `fence_${mask4(x, y, (n) => n === 'fence', false)}`);
      } else if (k === 'board') {
        set('detail', x, y, 'base_grass');
        set('props', x, y, 'p_board');
      }
    }

  // --- shade: shadows (light top-left: cast south and east), flora, water decor ---
  const groundOf = (k) =>
    k === 'path' || k === 'shopdoor'
      ? 'path'
      : k === 'stone'
        ? 'stone'
        : k === 'floor'
          ? 'floor'
          : k === 'dirt'
            ? 'dirt'
            : 'grass';
  const shadowable = (k) =>
    k && !['water', 'rock', 'wallin', 'tree', 'wall', 'door', 'shopwall', 'shopdoor'].includes(k);
  const isBuilding = (x, y) => !!BUILDING[kind(x, y)];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = kind(x, y);
      if (k === 'water') {
        const f = (hash(x, y, 91 + w) % 1000) / 1000;
        const n = noise(x, y, 3, 61 + h);
        const wa = nb(x, y, 3, waterish, true);
        if (!wa.includes('0') && n > 0.42 && f < 0.5)
          set('shade', x, y, `lily_${hash(x, y, 1) % 2}`);
        else if ((wa[1] === '0' || wa[7] === '0') && (wa[3] === '0' || wa[5] === '0'))
          // a rounded corner of the bank: a clump of reeds or bank stones softens it
          set('shade', x, y, hash(x, y, 3) % 2 ? 'reeds_s' : 'p_rocks');
        else if (wa[1] === '0' && f < 0.22) set('shade', x, y, 'reeds_n');
        continue;
      }
      if (!shadowable(k)) continue;
      if (k === 'stone') {
        const r = nb(x, y, 3, (n) => n === 'rock', true);
        if (r.includes('1')) {
          set('shade', x, y, bake('ao', seed, x, y, r));
          continue;
        }
      }
      if (isBuilding(x, y - 1) || kind(x, y - 1) === 'rock') {
        set('shade', x, y, `shade_n_${groundOf(k)}`);
        continue;
      }
      if (isBuilding(x - 1, y)) {
        set('shade', x, y, `shade_e_${groundOf(k)}`);
        continue;
      }
      const f = (hash(x, y, 91 + w) % 1000) / 1000;
      const n = noise(x, y, 3, 53 + h);
      const farmland = name === 'farm' && zoneTiles.has(y * w + x);
      if (k === 'flower') {
        // the scattered flower tiles gather into patches: the rose-pink wildflower (the valley's signature)
        // where the noise is high, a few daisies and buttercups at the patch edges, plain grass elsewhere
        if (n > 0.55)
          set('shade', x, y, f < 0.45 ? 'patch_roses' : f < 0.75 ? 'bloom_rose_0' : 'rose_2');
        else if (n > 0.4)
          set(
            'shade',
            x,
            y,
            f < 0.35
              ? 'patch_daisies'
              : f < 0.6
                ? 'patch_buttercups'
                : f < 0.75
                  ? 'patch_lavender'
                  : 'bloom_daisy_0',
          );
        else if (f < 0.2) set('shade', x, y, 'tallgrass');
      } else if (k === 'grass' && !farmland && C.blooms) {
        if (n > 0.72 && f < C.blooms)
          set('shade', x, y, f < C.blooms * 0.5 ? 'bloom_rose_0' : 'bloom_rose_1');
        else if (n < 0.2 && f < C.blooms * 0.4)
          set('shade', x, y, f < C.blooms * 0.2 ? 'bloom_daisy_1' : 'bloom_lilac_0');
        else if (name !== 'farm' && n > 0.45 && n < 0.55 && f < 0.12)
          set('shade', x, y, 'tallgrass');
      } else if (k === 'path' && f < 0.035) set('shade', x, y, f < 0.017 ? 'pebbles' : 'pebbles_2');
      else if (k === 'path' && f < 0.045 && name !== 'farm') set('shade', x, y, 'puddle');
      else if (k === 'stone') {
        if (n > 0.6 && f < 0.3) set('shade', x, y, `cracks_${hash(x, y, 2) % 3}`);
        else if (n < 0.3 && f < 0.15) set('shade', x, y, f < 0.07 ? 'rubble' : 'rubble_2');
      }
    }
  // ferns and tall grass gathered along the groves' edges (flat, walkable: props layer, not solid)
  if (C.groveEdge)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (kind(x, y) !== 'grass' || L.props[y * w + x]) continue;
        if (C.props.some(([, px, py]) => px === x && py === y)) continue; // a hand-placed prop goes here
        const nearWood = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => kind(x + dx, y + dy) === 'tree' && woods(x + dx, y + dy));
        const f = (hash(x, y, 57) % 1000) / 1000;
        if (nearWood && f < C.groveEdge)
          set('props', x, y, f < C.groveEdge / 2 ? 'fern_flat' : 'tallgrass');
      }
  // seasonal clumps under and downwind (south and east) of trees: invisible in spring; dry grass in summer,
  // leaf litter in fall, small drifts in winter (art-src/tools/seasons.py draws them per season)
  if (C.trees.length)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (kind(x, y) !== 'grass' || L.props[y * w + x]) continue;
        if (C.props.some(([, px, py]) => px === x && py === y)) continue;
        const byTree = [
          [0, -1],
          [-1, 0],
          [-1, -1],
        ].some(([dx, dy]) => kind(x + dx, y + dy) === 'tree');
        const f = (hash(x, y, 61) % 1000) / 1000;
        if (byTree && f < 0.55) set('props', x, y, `seasonal_${hash(x, y, 62) % 3}`);
      }
  // the forest's edge: crowns spilling over the open tiles around it (under the player, or overhead where the
  // wood is south of the tile so you walk behind it), with its shadow cast down-right
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (kind(x, y) === 'tree' && woods(x, y)) continue;
      const f5 = nb(x, y, 5, (_, nx, ny) => woods(nx, ny) && kind(nx, ny) === 'tree', false);
      const near = [6, 7, 8, 11, 13, 16, 17, 18].some((k) => f5[k] === '1');
      if (!near) continue;
      const full = nb(x, y, 5, (_, nx, ny) => woods(nx, ny), true);
      set('shade', x, y, bake('canopy', seed, x, y, 'under', full));
      if ([16, 17, 18].some((k) => full[k] === '1'))
        set('overhead', x, y, bake('canopy', seed, x, y, 'over', full));
    }
  // the bed object: one 2x2 sprite over its four (already solid) tiles
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (kind(x, y) === 'bed' && kind(x - 1, y) !== 'bed' && kind(x, y - 1) !== 'bed') {
        set('props', x, y, 'bed_tl');
        set('props', x + 1, y, 'bed_tr');
        set('props', x, y + 1, 'bed_bl');
        set('props', x + 1, y + 1, 'bed_br');
      }
  if (C.rug) {
    const [rx, ry] = C.rug;
    set('shade', rx, ry, 'rug_tl');
    set('shade', rx + 1, ry, 'rug_tr');
    set('shade', rx, ry + 1, 'rug_bl');
    set('shade', rx + 1, ry + 1, 'rug_br');
  }

  // --- roofs over building blocks (all rows but the facade), ridge caps above them (overhead) ---
  const seen = new Set();
  const blocks = [];
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
      blocks.push({ style, cells, top, bottom });
      const inBlock = (cx, cy) => cells.some(([a, b]) => a === cx && b === cy);
      for (const [cx, cy] of cells) {
        const col = !inBlock(cx - 1, cy) ? 'l' : !inBlock(cx + 1, cy) ? 'r' : 'c';
        if (cy === top && top > 0) set('overhead', cx, cy - 1, `eave_${style}_${col}`);
        if (cy === bottom) {
          if (has('eave_shadow')) set('shade', cx, cy, 'eave_shadow');
          continue;
        }
        const row = cy === bottom - 1 ? 'b' : cy === top ? 't' : 'm';
        set('roof', cx, cy, `roof_${style}_${row}${col}`);
      }
    }
  for (const [x, y] of C.chimney ?? []) {
    const b = blocks.find((q) => q.top === y && q.cells.some(([a, c]) => a === x && c === y));
    if (!b) {
      console.warn(`map-art: ${name}: a chimney needs a roof's top row at ${x},${y}`);
      continue;
    }
    // composite tiles (roof + chimney foot, ridge cap + chimney top) so no layer has to hold two tiles
    set('roof', x, y, `chimney_base_${b.style}`);
    if (y > 0) set('overhead', x, y - 1, `chimney_top_${b.style}`);
    lights.push({ type: 'chimney', tx: x, ty: y - 1 });
  }
  for (const [x, y, n] of C.facade ?? []) {
    const k = kind(x, y);
    if (!BUILDING[k] || k === 'door' || k === 'shopdoor') {
      console.warn(`map-art: ${name}: no facade at ${x},${y}`);
      continue;
    }
    set('props', x, y, n);
    if (LIGHT_OF[n]) lights.push({ type: LIGHT_OF[n], tx: x, ty: y });
  }

  // --- the old oak (woods landmark): trunk on a solid tree tile, canopy overhead, roots flat ---
  if (C.bigOak) {
    const [ox, oy] = C.bigOak;
    if (kind(ox, oy) !== 'tree')
      console.warn(`map-art: ${name}: the old oak needs a tree tile at ${ox},${oy}`);
    else
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 3; i++) {
          const n = `bigoak_${i}_${j}`;
          if (!has(n)) continue;
          const x = ox - 1 + i;
          const y = oy - 3 + j;
          if (j === 3) set(i === 1 ? 'props' : 'shade', x, y, n);
          else set('overhead', x, y, n);
        }
  }
  for (const [x, y] of C.boats ?? []) {
    if (kind(x, y) !== 'water' || kind(x, y + 1) !== 'water') continue;
    set('props', x, y, 'boat_t');
    set('props', x, y + 1, 'boat_b');
    L.shade[y * w + x] = L.shade[(y + 1) * w + x] = 0;
  }
  for (const [x, y] of C.vane ?? []) {
    const b = blocks.find(
      (q) => q.top === y + 1 && q.cells.some(([a, c]) => a === x && c === y + 1),
    );
    if (b) set('overhead', x, y, `vane_${b.style}`);
  }
  for (const [x, y, n] of C.rails ?? [])
    if (kind(x, y) === 'stone') set('shade', x, y, `rail_${n}`);
  if (C.lintel) {
    const [lx, ly, lw] = C.lintel;
    for (let i = 0; i < lw; i++)
      set(
        'overhead',
        lx + i,
        ly,
        lw === 1 ? 'lintel_c' : i === 0 ? 'lintel_l' : i === lw - 1 ? 'lintel_r' : 'lintel_c',
      );
  }

  // --- hand-placed props (solid) ---
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
  // MAP_OPEN=<map> node scripts/generate-maps.mjs prints where a hand-placed prop may go ('.' open, '#' not)
  if (process.env.MAP_OPEN === name)
    for (let y = 0; y < h; y++)
      console.log(
        String(y).padStart(2) +
          ' ' +
          Array.from({ length: w }, (_, x) => (open(x, y) ? '.' : '#')).join(''),
      );
  const place = (n, x, y, on) => {
    if (!open(x, y, on)) {
      console.warn(`map-art: ${name}: skipped ${n} at ${x},${y} (not open)`);
      return false;
    }
    set('props', x, y, n);
    if (!on) solid.add(y * w + x);
    L.shade[y * w + x] = 0; // no flowers under a barrel
    return true;
  };
  for (const [n, x, y, on] of C.props) {
    let ok = false;
    if (n.startsWith('t_')) {
      ok = place(`${n}_base`, x, y, on);
      if (ok) set('overhead', x, y - 1, `${n}_top`);
    } else if (n.startsWith('w_')) {
      if (open(x, y, on) && open(x + 1, y, on)) {
        ok = place(`${n}_l`, x, y, on) && place(`${n}_r`, x + 1, y, on);
      } else console.warn(`map-art: ${name}: skipped ${n} at ${x},${y}`);
    } else if (n === 'i_shelf') {
      ok = place('i_shelf_bot', x, y, on);
      if (ok) set('props', x, y - 1, 'i_shelf_top');
    } else ok = place(n, x, y, on);
    const light = LIGHT_OF[n];
    if (light && ok) lights.push({ type: light, tx: x, ty: n.startsWith('t_') ? y - 1 : y });
  }
  if (C.crystals) {
    // crystals on wall faces that look onto the cavern floor (already solid rock)
    // only on the cavern's outer wall (never on a free-standing boulder, which could pass for a gem node)
    const outer = new Set();
    const stack = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (kind(x, y) === 'rock' && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) {
          outer.add(y * w + x);
          stack.push([x, y]);
        }
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ])
        if (kind(nx, ny) === 'rock' && !outer.has(ny * w + nx)) {
          outer.add(ny * w + nx);
          stack.push([nx, ny]);
        }
    }
    const spots = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (outer.has(y * w + x) && kind(x, y + 1) === 'stone' && L.props[y * w + x] === 0)
          spots.push([x, y, hash(x, y, 77)]);
    spots.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of spots.slice(0, C.crystals)) {
      set('props', x, y, 'p_crystal');
      lights.push({ type: 'crystal', tx: x, ty: y });
    }
  }
  // --- blooms: where butterflies flit (src/fx/Ambient.ts). One point per 4x4 block holding flowers on the ground
  // or in the art layers, at the block's flower centroid; written as a hidden object group ---
  const nameOf = new Map(Object.entries(tiles).map(([n, i]) => [i + 1, n]));
  const FLORA = /^(flower|bloom_|rose_|patch_|bush_rose|p_flowerbed|p_flowerbox)/;
  const cells = new Map();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const hit =
        kind(x, y) === 'flower' ||
        ['detail', 'shade', 'props'].some((k) => FLORA.test(nameOf.get(L[k][y * w + x]) ?? ''));
      if (!hit) continue;
      const key = `${x >> 2},${y >> 2}`;
      const c = cells.get(key) ?? { sx: 0, sy: 0, n: 0 };
      c.sx += x;
      c.sy += y;
      c.n++;
      cells.set(key, c);
    }
  const blooms = [...cells.values()]
    .filter((c) => c.n >= 2)
    .map((c) => ({
      x: Math.round(((c.sx / c.n) * 16 + 8) / 2) * 2,
      y: Math.round(((c.sy / c.n) * 16 + 8) / 2) * 2,
      n: c.n,
    }));
  const rows = Math.ceil((Math.max(...Object.values(tiles)) + 1) / columns);
  return { layers: L, solid, lights, blooms, tilecount: rows * columns, columns, rows };
}
