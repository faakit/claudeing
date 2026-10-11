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

const W = 26;
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
rect(1, 1, 7, 4, T.shopwall); // a building: the general store front
rect(3, 4, 3, 1, T.shopdoor);
rect(19, 1, 5, 4, T.wall); // a house with a door (the door teleports within the lab)
rect(21, 4, 1, 1, T.door);
rect(1, 5, W - 2, 2, T.path); // north road: shop, board, bin, villagers
rect(13, 7, 1, 21, T.path); // main road down the middle
rect(11, 4, 1, 1, T.board); // orders board
rect(15, 4, 1, 1, T.bin); // shipping bin
rect(5, 16, 5, 8, T.dirt); // west bed: eight crops, every stage (farm plot coordinates, see layout below)
rect(17, 16, 8, 10, T.dirt); // east bed: seven crops, then soil states
rect(19, 9, 5, 5, T.stone); // the quarry corner: one ore node of each kind
rect(1, 28, W - 2, 1, T.dirt); // shore
rect(1, 29, W - 2, 4, T.water); // water edge
rect(13, 28, 1, 1, T.path);
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
