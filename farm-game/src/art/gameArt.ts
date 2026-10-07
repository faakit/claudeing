import Phaser from 'phaser';
import { animals, crops, items, placeables } from '../data';

/** Code-generated gameplay art (soil, crops, items, UI glyphs). Replaced by atlases in M7. */
export const SOIL_TEXTURE = { tilled: 'soil_tilled', watered: 'soil_watered' } as const;
export const WEED_TEXTURE = 'weed';
export const CROPS_TEXTURE = 'crops';
export const PX_TEXTURE = 'fx_px';
export const cropFrame = (cropId: string, stage: number): string => `crop_${cropId}_${stage}`;

type Ctx = CanvasRenderingContext2D;
const LINE = '#241a2a';

function canvas(scene: Phaser.Scene, key: string, w: number, h: number): Ctx {
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) throw new Error(`Could not create texture ${key}`);
  return t.getContext();
}

function refresh(scene: Phaser.Scene, key: string): void {
  (scene.textures.get(key) as Phaser.Textures.CanvasTexture).refresh();
}

function outline(ctx: Ctx, ox: number, oy: number, w: number, h: number, color = LINE): void {
  const src = ctx.getImageData(ox, oy, w, h);
  const out = new Uint8ClampedArray(src.data);
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const a = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : src.data[(y * w + x) * 4 + 3]!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) > 0) continue;
      if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) {
        const i = (y * w + x) * 4;
        out[i] = rgb[0]!;
        out[i + 1] = rgb[1]!;
        out[i + 2] = rgb[2]!;
        out[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(new ImageData(out, w, h), ox, oy);
}

const shade = (hex: string, amt: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
};

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + 0.5) ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
}

// ---------- soil ----------
function drawSoil(ctx: Ctx, watered: boolean): void {
  const base = watered ? '#4a3220' : '#7a5530';
  const dark = watered ? '#38251a' : '#5e4025';
  const light = watered ? '#5d4129' : '#93683c';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 16, 16);
  for (let r = 1; r < 16; r += 4) {
    ctx.fillStyle = dark;
    ctx.fillRect(1, r + 2, 14, 1);
    ctx.fillStyle = light;
    ctx.fillRect(1, r, 14, 1);
  }
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 15, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
  ctx.fillRect(15, 0, 1, 16);
  if (watered) {
    ctx.fillStyle = 'rgba(111,163,224,0.35)';
    for (const [x, y] of [
      [3, 3],
      [9, 6],
      [5, 10],
      [12, 12],
      [7, 14],
    ] as const)
      ctx.fillRect(x, y, 2, 1);
  }
}

function drawWeed(ctx: Ctx): void {
  const blades: [number, number, number][] = [
    [4, 13, 7],
    [7, 14, 9],
    [10, 13, 6],
    [12, 14, 8],
    [6, 12, 5],
  ];
  ctx.fillStyle = '#4d8f3a';
  for (const [x, y, h] of blades) ctx.fillRect(x, y - h + 4, 1, h);
  ctx.fillStyle = '#7fc96b';
  for (const [x, y, h] of blades) ctx.fillRect(x + 1, y - h + 5, 1, h - 2);
  ctx.fillStyle = '#c9e87a';
  ctx.fillRect(7, 6, 1, 1);
  ctx.fillRect(12, 8, 1, 1);
  outline(ctx, 0, 0, 16, 16, '#26402a');
}

// ---------- crops ----------
function drawCropStage(ctx: Ctx, ox: number, id: string, stage: number, total: number): void {
  const def = crops[id]!;
  const { leaf, fruit } = def.placeholder;
  const leafDark = shade(leaf, -35);
  const leafLight = shade(leaf, 30);
  const t = stage / total; // 0..1
  const px = (x: number, y: number, c: string, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + x, y, w, h);
  };
  if (stage === 0) {
    // freshly planted seed mound with a tiny sprout
    px(6, 13, '#6a4a2a', 4, 2);
    px(7, 12, leaf, 2, 1);
    px(7, 11, leafLight, 1, 1);
    return;
  }
  const h = 3 + Math.round(t * 9);
  const spread = 1 + Math.round(t * 4);
  px(8, 15 - h, leafDark, 1, h); // stem
  for (let i = 0; i < Math.max(2, Math.round(t * 5)); i++) {
    const y = 14 - Math.round((i / 5) * h) - 1;
    const w = Math.min(spread, 2 + (i % 2));
    px(8 - w - (i % 2), y, leaf, w, 2);
    px(9 + (i % 2), y - 1, leaf, w, 2);
    px(8 - w - (i % 2), y, leafLight, 1, 1);
  }
  if (stage >= total - 1 && stage < total) {
    px(7, 15 - h - 1, shade(fruit, -20), 2, 2); // buds
    px(5, 9, shade(fruit, -20), 1, 1);
    px(10, 8, shade(fruit, -20), 1, 1);
  }
  if (stage >= total) {
    for (const [fx, fy, r] of [
      [5, 10, 2],
      [10, 9, 2],
      [8, 6, 2],
      [7, 12, 2],
    ] as const) {
      disc(ctx, ox + fx, fy, r, fruit);
      px(fx - 1, fy - 1, shade(fruit, 45));
      px(fx + 1, fy + 1, shade(fruit, -35));
    }
  }
}

// ---------- item icons ----------
function drawIcon(ctx: Ctx, id: string): void {
  const it = items[id]!;
  const c = it.color;
  const dk = shade(c, -45);
  const lt = shade(c, 40);
  const r = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  if (it.type === 'tool') {
    if (id === 'hoe') {
      for (let i = 0; i < 11; i++) r(3 + i, 13 - i, 2, 2, '#9a6a3a'); // handle
      r(9, 2, 6, 3, c);
      r(9, 2, 6, 1, lt);
      r(9, 5, 2, 2, c);
    } else if (id === 'watering_can') {
      r(3, 6, 8, 7, c);
      r(3, 6, 8, 1, lt);
      r(11, 8, 4, 2, c);
      r(14, 6, 2, 3, lt);
      r(4, 4, 6, 2, dk);
      r(1, 7, 2, 4, dk);
      r(5, 11, 4, 1, dk);
    } else if (id === 'fishing_rod') {
      for (let i = 0; i < 12; i++) r(2 + i, 14 - i, 2, 2, '#9a6a3a'); // rod
      r(13, 2, 2, 1, '#9a6a3a');
      r(14, 3, 1, 6, '#e8e8f0'); // line
      r(13, 9, 3, 3, '#e0574a'); // float
      r(13, 9, 3, 1, '#f4ead2');
    } else {
      for (let i = 0; i < 10; i++) r(4 + i, 13 - i, 2, 2, '#9a6a3a'); // scythe handle
      r(2, 2, 10, 2, c);
      r(2, 4, 3, 2, c);
      r(3, 2, 8, 1, lt);
      r(11, 3, 2, 2, dk);
    }
  } else if (it.type === 'seed') {
    r(4, 5, 8, 9, '#d8c08a'); // paper bag
    r(4, 5, 8, 1, '#efe0b0');
    r(3, 3, 10, 3, '#c9ad72');
    r(5, 8, 6, 4, c); // colored label
    r(6, 9, 4, 1, lt);
    r(7, 6, 2, 1, dk);
  } else if (it.type === 'material') {
    for (const [x, h] of [
      [4, 9],
      [7, 11],
      [10, 8],
      [12, 6],
    ] as const) {
      r(x, 14 - h, 2, h, c);
      r(x, 14 - h, 1, h, lt);
    }
    r(3, 13, 11, 1, '#6a4a2a');
  } else if (it.type === 'fish') {
    r(2, 7, 10, 5, c); // body
    r(2, 7, 10, 1, lt);
    r(3, 11, 8, 1, dk);
    r(11, 5, 3, 3, c); // tail
    r(11, 11, 3, 2, c);
    r(12, 8, 1, 3, c);
    r(4, 8, 1, 1, '#14101f'); // eye
    r(7, 8, 1, 3, dk); // gill
    r(6, 5, 3, 2, dk); // fin
  } else if (it.type === 'fertilizer') {
    r(3, 5, 10, 9, '#d8c08a'); // sack
    r(3, 5, 10, 1, '#efe0b0');
    r(4, 3, 8, 3, '#c9ad72');
    r(5, 8, 6, 4, c);
    r(6, 9, 4, 1, lt);
    r(7, 10, 2, 1, dk);
  } else if (it.type === 'bait') {
    r(4, 9, 8, 4, c); // worm tin
    r(4, 9, 8, 1, lt);
    r(3, 8, 10, 2, '#9aa3b4');
    r(6, 5, 2, 3, '#e08a8a'); // worms
    r(9, 6, 2, 2, '#e08a8a');
    r(7, 4, 1, 1, '#e08a8a');
  } else if (it.type === 'preserve') {
    r(4, 6, 8, 8, '#cfe6f0'); // glass jar
    r(4, 6, 8, 1, '#ffffff');
    r(5, 8, 6, 5, c); // contents
    r(6, 8, 4, 1, lt);
    r(3, 4, 10, 2, '#c9ad72'); // lid
    r(3, 4, 10, 1, '#efe0b0');
    if (id === 'pickles') r(7, 10, 1, 1, dk);
  } else if (it.type === 'animal') {
    drawAnimal(ctx, id, 16, 16, 0, 0);
  } else if (it.type === 'feed') {
    r(3, 5, 10, 9, '#d8c08a'); // sack
    r(3, 5, 10, 1, '#efe0b0');
    r(4, 3, 8, 3, '#c9ad72');
    r(5, 8, 6, 4, c);
    r(5, 8, 6, 1, lt);
    r(6, 10, 1, 1, dk);
    r(9, 9, 1, 1, dk);
  } else if (it.type === 'product') {
    if (id === 'milk') {
      r(5, 6, 6, 8, '#f4f4f8'); // bottle
      r(5, 6, 6, 1, '#ffffff');
      r(6, 3, 4, 3, '#dfe6f0');
      r(5, 9, 6, 3, '#6fa3e0');
      r(6, 2, 4, 1, '#c9d3e4');
    } else {
      disc(ctx, 8, 9, 5, c); // egg
      r(6, 5, 3, 1, lt);
      r(5, 7, 1, 2, '#ffffff');
      r(9, 12, 2, 1, dk);
    }
  } else if (it.type === 'placeable') {
    drawPlaceable(ctx, id, c, dk, lt);
  } else if (it.type === 'forage') {
    drawForage(ctx, id, c, dk, lt);
  } else {
    drawCrop(ctx, id, c, dk, lt);
  }
  outline(ctx, 0, 0, 16, 16);
}

/** Placed machines. Also used (same drawing) as the in-world sprite and as the item icon. */
function drawPlaceable(ctx: Ctx, id: string, c: string, dk: string, lt: string): void {
  const r = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  if (id === 'coop' || id === 'barn') {
    const wall = id === 'coop' ? '#b9783c' : '#a8443a';
    const roof = id === 'coop' ? '#7a4a28' : '#5a2a28';
    r(2, 7, 12, 8, wall);
    r(2, 7, 12, 1, shade(wall, 35));
    for (let x = 4; x < 14; x += 3) r(x, 8, 1, 7, shade(wall, -35));
    r(1, 4, 14, 4, roof);
    r(3, 2, 10, 3, roof);
    r(3, 2, 10, 1, shade(roof, 40));
    r(6, 10, 4, 5, '#2a1a1a'); // door
    r(7, 10, 2, 1, '#f4d35e');
    if (id === 'barn') r(7, 4, 2, 2, '#f4ead2');
  } else if (id === 'preserve_jar') {
    r(3, 5, 10, 9, '#8a5a32'); // wooden barrel
    r(3, 5, 10, 1, '#b07a48');
    r(3, 8, 10, 1, '#5a3a20');
    r(3, 11, 10, 1, '#5a3a20');
    r(4, 3, 8, 3, '#cfe6f0'); // glass lid
    r(4, 3, 8, 1, '#ffffff');
    r(5, 4, 6, 1, c);
  } else {
    // sprinkler: a standpipe with a spray head
    r(7, 6, 2, 8, '#8d98ab');
    r(7, 6, 1, 8, '#b8c2d4');
    r(5, 12, 6, 2, '#6b7488');
    r(5, 4, 6, 3, c);
    r(5, 4, 6, 1, lt);
    r(7, 2, 2, 2, dk);
    if (id === 'quality_sprinkler') {
      r(3, 5, 2, 1, lt);
      r(11, 5, 2, 1, lt);
      r(7, 1, 2, 1, '#f4d35e');
    }
  }
}

/** A farm animal, drawn at (ox, oy). Icons use the 16px box; world sprites use the same drawing. */
function drawAnimal(ctx: Ctx, id: string, _w: number, _h: number, ox: number, oy: number): void {
  const r = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  if (id === 'cow') {
    r(3, 5, 9, 6, '#f4f0e6');
    r(3, 5, 9, 1, '#ffffff');
    r(4, 6, 3, 3, '#4a3a33'); // spots
    r(9, 8, 2, 2, '#4a3a33');
    r(11, 3, 4, 4, '#f4f0e6'); // head
    r(14, 5, 2, 2, '#e8a0a0'); // snout
    r(11, 2, 1, 2, '#4a3a33'); // horn
    r(12, 4, 1, 1, '#14101f'); // eye
    r(4, 11, 2, 3, '#e8e0d0'); // legs
    r(9, 11, 2, 3, '#e8e0d0');
    r(2, 6, 1, 4, '#d8d0c0'); // tail
  } else {
    r(4, 6, 8, 6, '#f8f2e4'); // body
    r(4, 6, 8, 1, '#ffffff');
    r(10, 3, 4, 5, '#f8f2e4'); // head
    r(11, 2, 2, 2, '#e0574a'); // comb
    r(14, 5, 2, 1, '#f2a65a'); // beak
    r(12, 4, 1, 1, '#14101f'); // eye
    r(10, 8, 2, 2, '#e0574a'); // wattle
    r(2, 5, 3, 4, '#e8dec8'); // tail
    r(6, 12, 1, 2, '#f2a65a'); // legs
    r(9, 12, 1, 2, '#f2a65a');
    r(5, 8, 5, 2, '#e8dec8'); // wing
  }
}

/** Wild goods: a few distinct silhouettes (flower, berry, mushroom, root, leaf) tinted per item. */
function drawForage(ctx: Ctx, id: string, c: string, dk: string, lt: string): void {
  const r = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  const green = '#5fae4e';
  switch (id) {
    case 'mushroom':
      r(6, 8, 4, 5, '#efe0c8');
      r(3, 4, 10, 5, c);
      r(4, 3, 8, 1, c);
      r(5, 5, 2, 2, lt);
      r(9, 6, 2, 1, lt);
      break;
    case 'wild_berry':
    case 'blackberry':
      r(7, 2, 2, 3, green);
      for (const [x, y] of [
        [4, 6],
        [8, 6],
        [6, 9],
        [10, 9],
        [2, 9],
      ] as const)
        disc(ctx, x + 1, y + 1, 2, c);
      r(4, 5, 1, 1, lt);
      break;
    case 'daffodil':
    case 'wild_sunflower':
      r(7, 8, 2, 6, green);
      for (const [x, y] of [
        [7, 2],
        [7, 7],
        [4, 5],
        [10, 5],
      ] as const)
        r(x, y, 2, 3, c);
      r(7, 5, 2, 2, id === 'daffodil' ? '#f2a65a' : '#7a4a20');
      break;
    case 'holly':
      r(3, 5, 6, 5, '#3f8f4a');
      r(7, 7, 6, 5, '#2f7a3a');
      r(4, 5, 4, 1, '#6fc46f');
      disc(ctx, 7, 8, 1, c);
      disc(ctx, 9, 9, 1, c);
      break;
    case 'winter_root':
      r(7, 2, 2, 4, green);
      r(5, 6, 6, 4, c);
      r(6, 10, 4, 2, c);
      r(7, 12, 2, 2, dk);
      r(5, 6, 2, 1, lt);
      break;
    default:
      // wild leek and anything new: a leafy bundle
      r(7, 2, 2, 8, green);
      r(5, 4, 2, 6, '#4a9a3f');
      r(9, 4, 2, 6, '#4a9a3f');
      r(6, 10, 4, 3, c);
      r(6, 10, 4, 1, lt);
  }
}

function drawCrop(ctx: Ctx, id: string, c: string, dk: string, lt: string): void {
  const r = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  const green = '#5fae4e';
  switch (id) {
    case 'parsnip':
      r(7, 2, 2, 3, green);
      r(5, 3, 2, 2, green);
      r(9, 3, 2, 2, green);
      r(5, 5, 6, 3, c);
      r(6, 8, 4, 3, c);
      r(7, 11, 2, 3, dk);
      r(5, 5, 2, 1, lt);
      break;
    case 'potato':
      disc(ctx, 8, 9, 5, c);
      r(5, 6, 3, 1, lt);
      r(9, 10, 1, 1, dk);
      r(6, 11, 1, 1, dk);
      r(11, 8, 1, 1, dk);
      break;
    case 'cauliflower':
      r(3, 9, 10, 4, green);
      r(5, 8, 6, 2, '#4a9a3f');
      disc(ctx, 8, 6, 4, c);
      r(5, 4, 2, 1, '#ffffff');
      r(9, 7, 1, 1, dk);
      break;
    case 'tomato':
      disc(ctx, 8, 9, 5, c);
      r(5, 6, 3, 1, lt);
      r(6, 3, 4, 2, '#4a9a3f');
      r(7, 2, 2, 2, '#4a9a3f');
      r(5, 4, 1, 1, '#4a9a3f');
      r(10, 4, 1, 1, '#4a9a3f');
      break;
    case 'melon':
      disc(ctx, 8, 9, 6, c);
      for (const x of [5, 8, 11]) r(x, 4, 1, 11, dk);
      r(5, 6, 2, 1, lt);
      r(7, 2, 2, 2, '#3f8f4a');
      break;
    case 'corn':
      r(6, 2, 4, 11, c);
      r(7, 2, 1, 11, lt);
      for (let y = 3; y < 12; y += 2) {
        r(6, y, 4, 1, dk);
      }
      r(3, 6, 3, 8, green);
      r(10, 6, 3, 8, '#4a9a3f');
      r(4, 5, 2, 2, green);
      break;
    case 'pumpkin':
      r(7, 2, 2, 3, '#4a8a3a');
      disc(ctx, 5, 9, 4, c);
      disc(ctx, 11, 9, 4, c);
      disc(ctx, 8, 9, 5, c);
      r(8, 5, 1, 9, dk);
      r(5, 6, 1, 7, dk);
      r(11, 6, 1, 7, dk);
      r(6, 6, 1, 1, lt);
      break;
    case 'yam':
      r(3, 9, 4, 3, c);
      r(6, 7, 5, 3, c);
      r(9, 5, 4, 3, c);
      r(12, 3, 2, 2, c);
      r(4, 9, 3, 1, lt);
      r(7, 7, 3, 1, lt);
      r(5, 12, 2, 1, dk);
      break;
    default:
      disc(ctx, 8, 8, 5, c);
      r(5, 5, 3, 1, lt);
  }
}

function drawGlyphs(scene: Phaser.Scene): void {
  // coin
  let ctx = canvas(scene, 'ui_coin', 9, 9);
  disc(ctx, 4, 4, 4, '#f4d35e');
  disc(ctx, 4, 4, 2, '#d4a92e');
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(2, 2, 2, 1);
  outline(ctx, 0, 0, 9, 9, '#6a4a10');
  refresh(scene, 'ui_coin');
  // energy bolt
  ctx = canvas(scene, 'ui_bolt', 9, 11);
  ctx.fillStyle = '#f4d35e';
  for (const [x, y, w] of [
    [4, 0, 3],
    [3, 1, 3],
    [2, 2, 3],
    [1, 3, 6],
    [3, 4, 4],
    [2, 5, 3],
    [2, 6, 2],
    [1, 7, 2],
    [1, 8, 1],
  ] as const) {
    ctx.fillRect(x, y, w, 1);
  }
  outline(ctx, 0, 0, 9, 11, '#6a4a10');
  refresh(scene, 'ui_bolt');
  // water drop
  ctx = canvas(scene, 'ui_drop', 9, 11);
  ctx.fillStyle = '#6fa3e0';
  ctx.fillRect(4, 0, 1, 2);
  ctx.fillRect(3, 2, 3, 2);
  ctx.fillRect(2, 4, 5, 2);
  ctx.fillRect(1, 6, 7, 3);
  ctx.fillRect(2, 9, 5, 1);
  ctx.fillStyle = '#b8d8f8';
  ctx.fillRect(2, 6, 1, 2);
  outline(ctx, 0, 0, 9, 11, '#1f3f6a');
  refresh(scene, 'ui_drop');
  // menu (three bars)
  ctx = canvas(scene, 'ui_menu', 11, 9);
  ctx.fillStyle = '#f4ead2';
  for (const y of [0, 3, 6]) ctx.fillRect(0, y, 11, 2);
  refresh(scene, 'ui_menu');
  // sun
  ctx = canvas(scene, 'ui_sun', 11, 11);
  disc(ctx, 5, 5, 3, '#f4d35e');
  ctx.fillStyle = '#f4d35e';
  for (const [x, y] of [
    [5, 0],
    [5, 10],
    [0, 5],
    [10, 5],
    [1, 1],
    [9, 1],
    [1, 9],
    [9, 9],
  ] as const)
    ctx.fillRect(x, y, 1, 1);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(4, 4, 2, 1);
  refresh(scene, 'ui_sun');
  // rain cloud
  ctx = canvas(scene, 'ui_rain', 13, 11);
  disc(ctx, 4, 4, 3, '#b9c4d8');
  disc(ctx, 8, 3, 3, '#c9d3e4');
  ctx.fillStyle = '#b9c4d8';
  ctx.fillRect(2, 4, 9, 3);
  outline(ctx, 0, 0, 13, 11, '#3a4258');
  ctx.fillStyle = '#6fa3e0';
  for (const [x, y] of [
    [3, 8],
    [6, 9],
    [9, 8],
  ] as const)
    ctx.fillRect(x, y, 1, 2);
  refresh(scene, 'ui_rain');
  // quality star (tinted silver/gold in the UI)
  ctx = canvas(scene, 'ui_star', 7, 7);
  ctx.fillStyle = '#ffffff';
  for (const [x, y, w] of [
    [3, 0, 1],
    [3, 1, 1],
    [1, 2, 5],
    [2, 3, 3],
    [2, 4, 3],
    [1, 5, 2],
    [4, 5, 2],
  ] as const)
    ctx.fillRect(x, y, w, 1);
  outline(ctx, 0, 0, 7, 7, '#3a3350');
  refresh(scene, 'ui_star');
  // heart (tinted red when earned, grey when not)
  ctx = canvas(scene, 'ui_heart', 7, 6);
  ctx.fillStyle = '#ffffff';
  for (const [x, y, w] of [
    [1, 0, 2],
    [4, 0, 2],
    [0, 1, 7],
    [0, 2, 7],
    [1, 3, 5],
    [2, 4, 3],
    [3, 5, 1],
  ] as const)
    ctx.fillRect(x, y, w, 1);
  outline(ctx, 0, 0, 7, 6, '#3a3350');
  refresh(scene, 'ui_heart');
  // 2x2 particle pixel
  ctx = canvas(scene, PX_TEXTURE, 2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 2, 2);
  refresh(scene, PX_TEXTURE);
}

export function generateGameArt(scene: Phaser.Scene): void {
  drawSoil(canvas(scene, SOIL_TEXTURE.tilled, 16, 16), false);
  refresh(scene, SOIL_TEXTURE.tilled);
  drawSoil(canvas(scene, SOIL_TEXTURE.watered, 16, 16), true);
  refresh(scene, SOIL_TEXTURE.watered);
  drawWeed(canvas(scene, WEED_TEXTURE, 16, 16));
  refresh(scene, WEED_TEXTURE);

  const ids = Object.keys(crops);
  const maxFrames = Math.max(...ids.map((i) => crops[i]!.stageDays.length + 1));
  const sheet = scene.textures.createCanvas(CROPS_TEXTURE, 16 * maxFrames, 16 * ids.length);
  if (!sheet) throw new Error('Could not create crops texture');
  const ctx = sheet.getContext();
  ids.forEach((id, row) => {
    const total = crops[id]!.stageDays.length;
    for (let stage = 0; stage <= total; stage++) {
      const ox = stage * 16;
      const strip = scene.textures.createCanvas(`tmp_${id}_${stage}`, 16, 16);
      if (!strip) throw new Error('tmp texture');
      const sctx = strip.getContext();
      drawCropStage(sctx, 0, id, stage, total);
      outline(sctx, 0, 0, 16, 16, shade(crops[id]!.placeholder.leaf, -80));
      ctx.drawImage(strip.canvas, ox, row * 16);
      sheet.add(cropFrame(id, stage), 0, ox, row * 16, 16, 16);
      scene.textures.remove(`tmp_${id}_${stage}`);
    }
  });
  sheet.refresh();

  for (const [id, it] of Object.entries(items)) {
    drawIcon(canvas(scene, it.icon, 16, 16), id);
    refresh(scene, it.icon);
  }
  // In-world sprites for placed objects: the item icon drawn without the outline's tight crop.
  for (const [id, def] of Object.entries(placeables)) {
    const ctx = canvas(scene, def.sprite, 16, 16);
    const it = items[id];
    if (it) drawPlaceable(ctx, id, it.color, shade(it.color, -45), shade(it.color, 40));
    outline(ctx, 0, 0, 16, 16);
    refresh(scene, def.sprite);
  }
  for (const a of Object.values(animals)) {
    const ctx = canvas(scene, a.sprite, 16, 16);
    drawAnimal(ctx, a.item, 16, 16, 0, 0);
    outline(ctx, 0, 0, 16, 16);
    refresh(scene, a.sprite);
  }
  drawGlyphs(scene);
}
