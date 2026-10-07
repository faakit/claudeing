// Generates the .tmj maps in public/assets/maps. Output stays editable in Tiled.
// Tile ids follow PLACEHOLDER_TILES order in src/config.ts (gid = index + 1).
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
]);

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
        imagewidth: 272,
        imageheight: 16,
        tilewidth: 16,
        tileheight: 16,
        tilecount: 17,
        columns: 17,
        margin: 0,
        spacing: 0,
      },
    ],
  };
}

function write(name, map, objects) {
  const out = new URL(`../public/assets/maps/${name}.tmj`, import.meta.url);
  writeFileSync(out, JSON.stringify(toTmj(map, objects), null, 1) + '\n');
  console.log(`wrote ${name}.tmj`);
}

// Deterministic scatter so regenerated maps are stable.
function scatter(m, tile, n, seed, ok) {
  let a = seed;
  const rnd = () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296;
  let placed = 0;
  for (let tries = 0; placed < n && tries < n * 50; tries++) {
    const x = 1 + Math.floor(rnd() * (m.w - 2));
    const y = 1 + Math.floor(rnd() * (m.h - 2));
    if (m.ground[y][x] === T.grass && ok(x, y)) {
      m.ground[y][x] = tile;
      placed++;
    }
  }
}

// ---- Farm 40x30 ----
{
  nextId = 1;
  const m = makeMap(40, 30, T.grass);
  const { w, h, rect } = m;
  rect(0, 0, w, 1, T.fence);
  rect(0, h - 1, w, 1, T.fence);
  rect(0, 0, 1, h, T.fence);
  rect(w - 1, 0, 1, h, T.fence);
  rect(36, 12, 4, 4, T.path); // gate east, leads to town
  rect(4, 3, 7, 5, T.wall); // house
  rect(7, 7, 1, 1, T.door);
  rect(7, 8, 1, 8, T.path);
  rect(7, 15, 33, 1, T.path);
  rect(10, 9, 1, 1, T.bin); // shipping bin
  rect(14, 18, 10, 7, T.dirt); // starter plot
  rect(28, 19, 5, 5, T.water); // pond, close to the fields
  for (const [x, y] of [
    [2, 25],
    [3, 27],
    [2, 22],
    [34, 3],
    [36, 5],
    [33, 27],
    [36, 24],
    [20, 2],
    [27, 4],
  ]) {
    rect(x, y, 1, 1, T.tree);
  }
  scatter(m, T.flower, 28, 7, (x, y) => !(x > 11 && x < 27 && y > 16 && y < 28));
  const objects = [
    obj('bin', 'shipping_bin', 10, 9, 1, 1),
    obj('weedzone', 'field', 11, 17, 18, 11),
    door('house_door', 7, 7, 'house', 8, 10, 'up'),
  ];
  for (let y = 12; y < 16; y++)
    objects.push(door(`to_town_${y}`, 39, y, 'town', 1, y - 3, 'right'));
  write('farm', m, objects);
}

// ---- House 16x12 ----
{
  nextId = 1;
  const m = makeMap(16, 12, T.floor);
  const { w, h, rect } = m;
  rect(0, 0, w, 2, T.wallin);
  rect(0, h - 1, w, 1, T.wallin);
  rect(0, 0, 1, h, T.wallin);
  rect(w - 1, 0, 1, h, T.wallin);
  rect(8, 11, 1, 1, T.door);
  rect(2, 2, 2, 2, T.bed);
  write('house', m, [
    door('front_door', 8, 11, 'farm', 7, 8, 'down'),
    obj('bed', 'bed', 2, 2, 2, 2),
  ]);
}

// ---- Town 30x20 ----
{
  nextId = 1;
  const m = makeMap(30, 20, T.grass);
  const { w, h, rect } = m;
  rect(0, 0, w, 1, T.tree);
  rect(0, h - 1, w, 1, T.tree);
  rect(w - 1, 0, 1, h, T.tree);
  rect(0, 0, 1, h, T.tree);
  rect(0, 9, w - 1, 4, T.path); // main road, west gate to the farm
  rect(11, 3, 9, 5, T.shopwall); // general store
  rect(14, 7, 3, 1, T.shopdoor);
  rect(14, 8, 3, 1, T.path);
  rect(3, 3, 5, 4, T.wall); // neighbors (decor)
  rect(23, 3, 4, 4, T.wall);
  rect(6, 14, 5, 3, T.wall);
  rect(20, 14, 6, 3, T.wall);
  rect(5, 7, 1, 2, T.path);
  scatter(m, T.flower, 34, 11, () => true);
  scatter(m, T.tree, 10, 3, (x, y) => y < 8 || y > 13);
  const objects = [obj('shop', 'general_store', 14, 7, 3, 1)];
  for (let y = 9; y < 13; y++) objects.push(door(`to_farm_${y}`, 0, y, 'farm', 38, y + 3, 'left'));
  write('town', m, objects);
}
