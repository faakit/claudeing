// Generates the developer map ("lab"): a compact, debug-only map where every crop stage, placeable, machine,
// node, forage, door, water edge, shop, board and bin sits within a few screens. It is never reachable in
// normal play: no door of a real map leads to it, and the map is registered at runtime by the dev tools
// (src/dev/lab.ts), only with ?debug or in a dev build.
//
// Output: src/dev/lab/lab-map.json (ground, collision, objects, the art layers by tile *name*, and the layout the
// "lab" preset fills with state). Art tiles are stored by name and resolved against the live tileset's
// tiles.json at runtime, so a tileset rebuild never leaves the lab pointing at the wrong tiles.
//
// This generator is separate from scripts/generate-maps.mjs on purpose (that one belongs to the art pipeline);
// it only *reads* scripts/map-art.mjs to dress the lab like the real maps. Run: npm run gen:lab
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { artLayers } from './map-art.mjs';

const T = {
  grass: 1,
  dirt: 2,
  tilled: 3,
  watered: 4,
  water: 5,
  path: 6,
  fence: 7,
  wall: 8,
  door: 9,
  floor: 10,
  wallin: 11,
  bed: 12,
  bin: 13,
  tree: 14,
  flower: 15,
  shopwall: 16,
  shopdoor: 17,
  board: 18,
  bush: 19,
  stone: 20,
  rock: 21,
};
const SOLID = new Set([
  T.fence,
  T.water,
  T.wall,
  T.wallin,
  T.bed,
  T.bin,
  T.tree,
  T.shopwall,
  T.shopdoor,
  T.board,
  T.bush,
  T.rock,
]);

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const crops = read('../src/data/crops.json');
const placeables = read('../src/data/placeables.json');
const nodes = read('../src/data/nodes.json');
const plots = read('../src/data/plots.json');

// Columns 0-25 are the showcase; columns 26-47 hold the long tow lane (M7 spike, round 2), walled off by the tree
// column 25. The lane sits beside the showcase, not below it, so the spike's shore keeps its place on screen (the
// camera stops at the map's south edge, as before).
const SHOWCASE_W = 26;
const W = 48;
const H = 34;
const ground = Array.from({ length: H }, () => Array(W).fill(T.grass));
const rect = (x, y, w, h, t) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) ground[j][i] = t;
};
let nextId = 1;
const prop = (name, type, value) => ({ name, type, value });
const obj = (type, name, tx, ty, tw = 1, th = 1, properties = []) => ({
  id: nextId++,
  name,
  type,
  x: tx * 16,
  y: ty * 16,
  width: tw * 16,
  height: th * 16,
  rotation: 0,
  visible: true,
  properties,
});

// ---- ground ----
rect(0, 0, W, 1, T.tree); // tree border
rect(0, 0, 1, H, T.tree);
rect(W - 1, 0, 1, H, T.tree);
rect(0, H - 1, W, 1, T.tree);
rect(SHOWCASE_W - 1, 0, 1, H, T.tree); // the showcase's east edge (the long lane lies beyond)
rect(SHOWCASE_W - 1, 1, 1, H - 2, T.bush); // drawn as bushes (a lone tree column draws as plain grass)
rect(1, 1, 7, 4, T.shopwall); // a building: the general store front
rect(3, 4, 3, 1, T.shopdoor);
rect(19, 1, 5, 4, T.wall); // a house with a door (the door teleports within the lab)
rect(21, 4, 1, 1, T.door);
rect(1, 5, SHOWCASE_W - 2, 2, T.path); // north road: shop, board, bin, villagers
rect(13, 7, 1, 21, T.path); // main road down the middle
rect(11, 4, 1, 1, T.board); // orders board
rect(15, 4, 1, 1, T.bin); // shipping bin
rect(5, 16, 5, 8, T.dirt); // west bed: eight crops, every stage (farm plot coordinates, see layout below)
rect(17, 16, 8, 10, T.dirt); // east bed: seven crops, then soil states
rect(19, 9, 5, 5, T.stone); // the quarry corner: one ore node of each kind
rect(1, 28, SHOWCASE_W - 2, 1, T.dirt); // shore
rect(1, 29, SHOWCASE_W - 2, 4, T.water); // water edge
rect(13, 28, 1, 1, T.path);
// ---- the long tow lane (columns 26-47, debug only): a water lane that runs west from a head just below the farmer
// and turns south to a slip at the bottom. The farmer walks the outer banks (north, then west), so the log trails
// behind and below him on the long leg (a tug tap on it is in comfortable reach), and the slip comes into view below
// him, low on the screen but above the floating controls. Everything else is bush,
// so a walk to the slip always follows the bank.
rect(SHOWCASE_W, 1, W - SHOWCASE_W - 1, H - 2, T.bush);
rect(26, 18, 13, 1, T.dirt); // the north bank (x 26-38): the farmer starts at (37,18), the lane's head below him
rect(27, 19, 12, 3, T.water); // leg 1: x 27-38, rows 19-21, flowing west
rect(27, 22, 3, 7, T.water); // leg 2: x 27-29, rows 22-28, flowing south
rect(26, 18, 1, 12, T.dirt); // the west bank (x 26, rows 18-29)
rect(26, 29, 5, 1, T.dirt); // the bottom bank (row 29, x 26-30); bush below it, so the slip sits above the controls
rect(28, 29, 1, 1, T.path); // the slip
const towLanes = {
  // the original spike lane on the showcase's south shore (scenario tow-spike)
  spike: {
    tiles: 6,
    water: [[1, 29, 24, 4]],
    flow: [{ rect: [1, 29, 24, 4], x: -6, y: 0 }],
    snags: [[17, 29]],
    slip: { bank: [13, 28], water: [13, 29] },
    spawn: { tx: 18, ty: 30, axis: 'h' },
    end: [[1, 29, 1, 4]],
  },
  // scenario tow-lane-long: about 17 tiles along the log's way (head to slip), one turn, one rock
  long: {
    tiles: 17,
    water: [
      [27, 19, 12, 3],
      [27, 22, 3, 7],
    ],
    flow: [
      { rect: [30, 19, 9, 3], x: -12, y: 0 },
      { rect: [27, 19, 3, 10], x: 0, y: 12 },
    ],
    snags: [[34, 19]],
    slip: { bank: [28, 29], water: [28, 28] },
    spawn: { tx: 37, ty: 20, axis: 'h' },
    end: [[27, 28, 3, 1]],
  },
};
for (const L of Object.values(towLanes)) {
  const inWater = (x, y) =>
    L.water.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
  for (const [rx, ry, rw, rh] of L.water)
    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++)
        if (ground[y][x] !== T.water) throw new Error(`lab: tow lane water ${x},${y} is not water`);
  for (const [x, y] of L.snags)
    if (!inWater(x, y)) throw new Error(`lab: snag ${x},${y} off the lane`);
  if (!inWater(...L.slip.water)) throw new Error('lab: the slip water is off the lane');
}

for (const [x, y] of [
  [2, 8],
  [2, 13],
  [10, 9],
])
  rect(x, y, 1, 1, T.tree);
for (const [x, y] of [
  [1, 26],
  [4, 27],
  [9, 27],
  [16, 27],
  [22, 27],
  [24, 15],
])
  rect(x, y, 1, 1, T.flower);

// ---- layout: what the "lab" preset puts where (state, not map) ----
// Soil is one per game (state.farm.tiles, drawn on the map being shown), and tilling needs an owned plot: the beds
// sit at farm plot coordinates so every soil rule works unchanged here. The preset owns every plot.
const cropIds = Object.keys(crops);
const cropRows = cropIds.map((id, i) => {
  const west = i < 8;
  return {
    crop: id,
    tx: west ? 5 : 17,
    ty: 16 + (west ? i : i - 8),
    stages: crops[id].stageDays.length,
  };
});
// East bed, rows 23-25: soil states. The east bed's right half (x 22-24, rows 16-22) stays untouched dirt: room
// to till, plant and paint rows.
const row = (y, x0, x1) => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y]);
const soil = [
  { kind: 'tilled', tiles: row(23, 17, 20) },
  { kind: 'watered', tiles: row(23, 21, 24) },
  { kind: 'fertilized', tiles: row(24, 17, 20) },
  { kind: 'weeds', tiles: row(24, 21, 24) },
  { kind: 'dirt', tiles: row(25, 17, 24) },
];
// Placeables: buildings north of the beds, machines and decor along the main road (every type, 1x1 footprints).
const buildingSpots = { coop: [3, 10], barn: [6, 10], shed: [3, 13], sty: [6, 13], silo: [8, 13] };
const roadSpots = [];
for (let y = 9; y <= 26; y++) for (const x of [11, 15]) roadSpots.push([x, y]);
const placed = [];
let road = 0;
for (const type of Object.keys(placeables)) {
  const at = buildingSpots[type] ?? roadSpots[road++];
  if (!at) throw new Error(`lab: no spot left for placeable "${type}"`);
  placed.push({ type, tx: at[0], ty: at[1] });
}
const nodeIds = Object.keys(nodes);
const nodeSpots = nodeIds.map((id, i) => ({
  node: id,
  tx: 20 + (i % 2) * 2,
  ty: 10 + Math.floor(i / 2) * 2,
}));
const forage = [
  { item: 'wild_leek', tx: 2, ty: 17 },
  { item: 'daffodil', tx: 3, ty: 19 },
  { item: 'wild_berry', tx: 2, ty: 21 },
  { item: 'mushroom', tx: 3, ty: 23 },
];
// Villagers stand here all day in a lab scenario (the dev tools override their schedule for that page session).
const npcIds = Object.keys(read('../src/data/npcs.json'));
const villagers = npcIds.map((id, i) => ({ npc: id, tx: 16 + i * 2, ty: 7 }));
const objects = [
  obj('shop', 'general_store', 3, 4, 3, 1),
  obj('board', 'orders_board', 11, 4),
  obj('bin', 'shipping_bin', 15, 4),
  obj('door', 'lab_house_door', 21, 4, 1, 1, [
    prop('targetMap', 'string', 'lab'),
    prop('spawnTx', 'int', 13),
    prop('spawnTy', 'int', 27),
    prop('facing', 'string', 'down'),
  ]),
  obj('weedzone', 'beds', 5, 16, 20, 10),
  obj('forage', 'meadow', 1, 15, 3, 11),
  obj('forage', 'shore', 1, 27, 11, 1),
  obj('ore', 'quarry', 19, 9, 5, 5),
  ...villagers.map((v) => obj('npc', v.npc, v.tx, v.ty)),
];
const items = read('../src/data/items.json');
for (const f of forage)
  if (items[f.item]?.type !== 'forage') throw new Error(`lab: "${f.item}" is not forage`);
// The beds must lie inside farm plots, or tilling is refused there.
const inPlot = (x, y) =>
  Object.values(plots).some(
    ({ rect: [px, py, pw, ph] }) => x >= px && x < px + pw && y >= py && y < py + ph,
  );
for (const r of cropRows)
  for (let s = 0; s <= r.stages; s++)
    if (!inPlot(r.tx + s, r.ty))
      throw new Error(`lab: crop tile ${r.tx + s},${r.ty} is outside every farm plot`);

// ---- art: the same dressing as the real maps, stored by tile name ----
const art = artLayers('lab', { w: W, h: H, ground }, objects, [
  [13, 15],
  [13, 27],
]);
const names = [];
const nameIndex = new Map();
let layers = {};
let missing = 0;
const collision = ground.map((row) => row.map((t) => (SOLID.has(t) ? t : 0)));
if (art) {
  const tilesJson = new URL('../public/assets/tilesets/tiles.json', import.meta.url);
  const { tiles } = JSON.parse(readFileSync(tilesJson, 'utf8'));
  const byIndex = new Map();
  for (const [n, i] of Object.entries(tiles)) if (i >= 0 && !byIndex.has(i)) byIndex.set(i, n);
  layers = Object.fromEntries(
    Object.entries(art.layers).map(([layer, data]) => [
      layer,
      data.map((gid) => {
        if (!gid) return 0;
        const n = byIndex.get(gid - 1);
        if (!n) {
          missing++;
          return 0;
        }
        if (!nameIndex.has(n)) {
          nameIndex.set(n, names.length + 1);
          names.push(n);
        }
        return nameIndex.get(n);
      }),
    ]),
  );
  for (const i of art.solid) collision[Math.floor(i / W)][i % W] ||= T.rock;
  // No decor on a tow lane's water (reeds, lilies, bank stones): it would cover the log (critic T3).
  for (const L of Object.values(towLanes))
    for (const [rx, ry, rw, rh] of L.water)
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++)
          for (const [layer, data] of Object.entries(layers)) {
            const n = names[data[y * W + x] - 1] ?? '';
            if (layer !== 'ground' && /reeds|lily|p_rocks|p_boulder/.test(n)) data[y * W + x] = 0;
          }
}

const out = {
  note: 'Generated by scripts/generate-lab-map.mjs (npm run gen:lab). Debug-only map; do not edit by hand.',
  w: W,
  h: H,
  start: { tx: 13, ty: 15, facing: 'down' },
  ground: ground.flat(),
  collision: collision.flat(),
  objects,
  art: { names, layers },
  lights: art?.lights ?? [],
  blooms: art?.blooms ?? [],
  layout: { cropRows, soil, placed, nodes: nodeSpots, forage, villagers },
  tow: towLanes,
};
const file = new URL('../src/dev/lab/lab-map.json', import.meta.url);
const text = JSON.stringify(out) + '\n';
if (process.argv.includes('--check')) {
  // Compared as data, so reformatting the file (Prettier) does not count as a change.
  const same =
    existsSync(file) &&
    JSON.stringify(JSON.parse(readFileSync(file, 'utf8'))) === JSON.stringify(out);
  console.log(same ? 'lab map is up to date' : 'lab map is stale: run npm run gen:lab');
  process.exit(same ? 0 : 1);
}
writeFileSync(file, text);
console.log(
  `wrote src/dev/lab/lab-map.json ${W}x${H}: ${cropRows.length} crop rows, ${placed.length} placeables, ` +
    `${nodeSpots.length} nodes, ${villagers.length} villager spots` +
    (art
      ? `, ${names.length} art tiles${missing ? ` (${missing} cells without a tile)` : ''}`
      : ', no art tileset'),
);
