// Generates public/assets/maps/farm.tmj (40x30). Re-run after editing; or open the result in Tiled.
import { writeFileSync } from 'node:fs';

const W = 40;
const H = 30;
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
};

const ground = Array.from({ length: H }, () => Array(W).fill(T.grass));
const rect = (x, y, w, h, t) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) ground[j][i] = t;
};

rect(0, 0, W, 1, T.fence);
rect(0, H - 1, W, 1, T.fence);
rect(0, 0, 1, H, T.fence);
rect(W - 1, 0, 1, H, T.fence);
rect(W - 1, 12, 1, 4, T.path); // east exit to town (M5)
rect(30, 3, 7, 6, T.water); // pond
rect(4, 3, 7, 5, T.wall); // house
rect(7, 7, 1, 1, T.door);
rect(7, 8, 1, 8, T.path); // path from door
rect(7, 15, 32, 1, T.path);
rect(14, 18, 10, 7, T.dirt); // farmable plot

const collision = ground.map((row) =>
  row.map((t) => (t === T.fence || t === T.water || t === T.wall ? t : 0)),
);

const tmj = {
  compressionlevel: -1,
  height: H,
  width: W,
  infinite: false,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.10.2',
  version: '1.10',
  type: 'map',
  tilewidth: 16,
  tileheight: 16,
  nextlayerid: 3,
  nextobjectid: 1,
  layers: [
    {
      id: 1,
      name: 'ground',
      type: 'tilelayer',
      width: W,
      height: H,
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      data: ground.flat(),
    },
    {
      id: 2,
      name: 'collision',
      type: 'tilelayer',
      width: W,
      height: H,
      x: 0,
      y: 0,
      opacity: 1,
      visible: false,
      data: collision.flat(),
    },
  ],
  tilesets: [
    {
      firstgid: 1,
      name: 'placeholder',
      image: '../tilesets/placeholder.png',
      imagewidth: 144,
      imageheight: 16,
      tilewidth: 16,
      tileheight: 16,
      tilecount: 9,
      columns: 9,
      margin: 0,
      spacing: 0,
    },
  ],
};

writeFileSync(
  new URL('../public/assets/maps/farm.tmj', import.meta.url),
  JSON.stringify(tmj, null, 1) + '\n',
);
console.log('wrote farm.tmj');
