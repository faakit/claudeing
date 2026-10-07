// Generates the .tmj maps in public/assets/maps. Output stays editable in Tiled.
// Tile ids follow PLACEHOLDER_TILES order in src/config.ts (gid = index + 1).
// Layout is portrait-first: every map is taller than it is wide, and exits sit on the long axis.
import { writeFileSync } from 'node:fs';

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
]);
const TILE_COUNT = 19;

function makeMap(w, h, fill) {
  const ground = Array.from({ length: h }, () => Array(w).fill(fill));
  const rect = (x, y, rw, rh, t) => {
    for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) ground[j][i] = t;
  };
  return { w, h, ground, rect };
}

const prop = (name, type, value) => ({ name, type, value });
let nextId = 1;
const obj = (type, name, tx, ty, tw, th, properties = []) => ({
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
const door = (name, tx, ty, targetMap, spawnTx, spawnTy, facing) =>
  obj('door', name, tx, ty, 1, 1, [
    prop('targetMap', 'string', targetMap),
    prop('spawnTx', 'int', spawnTx),
    prop('spawnTy', 'int', spawnTy),
    prop('facing', 'string', facing),
  ]);
/** A named area where daily spawns (weeds, forageables) may appear. */
const zone = (type, name, tx, ty, tw, th) => obj(type, name, tx, ty, tw, th);

function toTmj({ w, h, ground }, objects) {
  const collision = ground.map((row) => row.map((t) => (SOLID.has(t) ? t : 0)));
  const layer = (id, name, data, visible) => ({
    id,
    name,
    type: 'tilelayer',
    width: w,
    height: h,
    x: 0,
    y: 0,
    opacity: 1,
    visible,
    data: data.flat(),
  });
  return {
    compressionlevel: -1,
    height: h,
    width: w,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    version: '1.10',
    type: 'map',
    tilewidth: 16,
    tileheight: 16,
    nextlayerid: 4,
    nextobjectid: nextId,
    layers: [
      layer(1, 'ground', ground, true),
      layer(2, 'collision', collision, false),
      {
        id: 3,
        name: 'objects',
        type: 'objectgroup',
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        draworder: 'topdown',
        objects,
      },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'placeholder',
        image: '../tilesets/placeholder.png',
        imagewidth: TILE_COUNT * 16,
        imageheight: 16,
        tilewidth: 16,
        tileheight: 16,
        tilecount: TILE_COUNT,
        columns: TILE_COUNT,
        margin: 0,
        spacing: 0,
      },
    ],
  };
}

function write(name, map, objects) {
  const out = new URL(`../public/assets/maps/${name}.tmj`, import.meta.url);
  writeFileSync(out, JSON.stringify(toTmj(map, objects), null, 1) + '\n');
  console.log(`wrote ${name}.tmj ${map.w}x${map.h}`);
}

// Deterministic scatter so regenerated maps are stable.
function scatter(m, tile, n, seed, ok) {
  let a = seed;
  const rnd = () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296;
  let placed = 0;
  for (let tries = 0; placed < n && tries < n * 60; tries++) {
    const x = 1 + Math.floor(rnd() * (m.w - 2));
    const y = 1 + Math.floor(rnd() * (m.h - 2));
    if (m.ground[y][x] === T.grass && ok(x, y)) {
      m.ground[y][x] = tile;
      placed++;
    }
  }
}
const border = (m, t) => {
  m.rect(0, 0, m.w, 1, t);
  m.rect(0, m.h - 1, m.w, 1, t);
  m.rect(0, 0, 1, m.h, t);
  m.rect(m.w - 1, 0, 1, m.h, t);
};
const inside = (x, y, [rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;

// ---- Farm 30x44: house at the top, fields down the middle, gate to town at the bottom ----
{
  nextId = 1;
  const m = makeMap(30, 44, T.grass);
  const { h, rect } = m;
  border(m, T.fence);
  rect(14, h - 1, 2, 1, T.path); // south gate
  rect(10, 3, 9, 5, T.wall); // house
  rect(14, 7, 1, 1, T.door);
  rect(14, 8, 2, h - 8, T.path); // main road, door to gate
  rect(12, 9, 1, 1, T.bin); // shipping bin beside the door path
  rect(5, 16, 8, 10, T.dirt); // starter plots either side of the road
  rect(17, 16, 8, 10, T.dirt);
  rect(19, 30, 7, 6, T.water); // pond
  const keep = [[4, 14, 22, 26]];
  for (const [x, y] of [
    [2, 3],
    [3, 6],
    [26, 4],
    [27, 7],
    [2, 39],
    [3, 41],
    [26, 40],
    [27, 42],
    [7, 2],
    [22, 2],
    [5, 31],
    [24, 39],
    [9, 12],
    [21, 12],
  ])
    rect(x, y, 1, 1, T.tree);
  scatter(m, T.flower, 46, 7, (x, y) => !inside(x, y, keep[0]));
  write('farm', m, [
    obj('bin', 'shipping_bin', 12, 9, 1, 1),
    zone('weedzone', 'field', 3, 14, 24, 26),
    zone('forage', 'west_meadow', 2, 27, 8, 14),
    zone('forage', 'pond_edge', 18, 37, 9, 5),
    door('house_door', 14, 7, 'house', 5, 7, 'up'),
    door('to_town_14', 14, h - 1, 'town', 11, 2, 'down'),
    door('to_town_15', 15, h - 1, 'town', 12, 2, 'down'),
  ]);
}

// ---- House 10x9 ----
{
  nextId = 1;
  const m = makeMap(10, 9, T.floor);
  const { w, h, rect } = m;
  rect(0, 0, w, 2, T.wallin);
  rect(0, h - 1, w, 1, T.wallin);
  rect(0, 0, 1, h, T.wallin);
  rect(w - 1, 0, 1, h, T.wallin);
  rect(5, h - 1, 1, 1, T.door);
  rect(1, 2, 2, 2, T.bed);
  write('house', m, [
    door('front_door', 5, h - 1, 'farm', 14, 8, 'down'),
    obj('bed', 'bed', 1, 2, 2, 2),
  ]);
}

// ---- Town 24x34: north gate to the farm, shop + board on the road, river east, woods west ----
{
  nextId = 1;
  const m = makeMap(24, 34, T.grass);
  const { h, rect } = m;
  border(m, T.tree);
  rect(11, 0, 2, 1, T.path); // north gate
  rect(10, 1, 4, h - 2, T.path); // main road
  rect(0, 24, 10, 2, T.path); // west road to the woods
  rect(2, 5, 7, 5, T.shopwall); // general store
  rect(4, 9, 3, 1, T.shopdoor);
  rect(4, 10, 6, 2, T.path); // forecourt joining the road
  rect(14, 11, 1, 1, T.board); // orders board
  rect(14, 3, 6, 4, T.wall); // neighbours (decor)
  rect(2, 15, 6, 4, T.wall);
  rect(14, 16, 4, 3, T.wall);
  rect(17, 22, 6, 10, T.water); // river
  for (const [x, y] of [
    [8, 2],
    [3, 2],
    [21, 8],
    [22, 14],
    [9, 20],
    [2, 29],
    [8, 31],
    [15, 30],
  ])
    rect(x, y, 1, 1, T.tree);
  scatter(m, T.flower, 40, 11, () => true);
  scatter(m, T.tree, 8, 3, (x) => x < 9 || x > 14);
  const objects = [
    obj('shop', 'general_store', 4, 9, 3, 1),
    obj('board', 'orders_board', 14, 11, 1, 1),
    zone('forage', 'riverbank', 14, 24, 3, 8),
    zone('forage', 'town_edge', 2, 20, 7, 3),
    door('to_farm_11', 11, 0, 'farm', 14, 42, 'up'),
    door('to_farm_12', 12, 0, 'farm', 15, 42, 'up'),
    door('to_woods_24', 0, 24, 'woods', 18, 14, 'left'),
    door('to_woods_25', 0, 25, 'woods', 18, 15, 'left'),
  ];
  write('town', m, objects);
}

// ---- Woods 20x30: a clearing to forage, a lake to fish; one gate east back to town ----
{
  nextId = 1;
  const m = makeMap(20, 30, T.grass);
  const { w, rect } = m;
  border(m, T.tree);
  rect(w - 1, 14, 1, 2, T.path); // east gate
  rect(10, 14, 9, 2, T.path); // trail west from the gate
  rect(9, 6, 2, 10, T.path); // trail north into the clearing
  rect(3, 18, 8, 7, T.water); // lake
  for (const [x, y] of [
    [4, 3],
    [13, 4],
    [6, 9],
    [15, 10],
    [3, 13],
    [14, 18],
    [16, 24],
    [12, 26],
    [5, 27],
    [17, 6],
    [2, 8],
    [8, 20],
  ])
    rect(x, y, 1, 1, T.bush);
  for (const [x, y] of [
    [2, 2],
    [8, 3],
    [17, 3],
    [11, 7],
    [1, 16],
    [12, 22],
    [17, 20],
    [9, 27],
    [15, 28],
    [3, 28],
  ])
    rect(x, y, 1, 1, T.tree);
  scatter(m, T.flower, 40, 5, () => true);
  write('woods', m, [
    zone('forage', 'clearing', 2, 3, 16, 11),
    zone('forage', 'lakeside', 11, 16, 7, 12),
    zone('forage', 'south_glade', 2, 25, 9, 4),
    door('to_town_14', w - 1, 14, 'town', 1, 24, 'right'),
    door('to_town_15', w - 1, 15, 'town', 1, 25, 'right'),
  ]);
}
