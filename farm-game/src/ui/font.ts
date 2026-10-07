import Phaser from 'phaser';

/**
 * Hand-built 5x7 pixel font, generated into a bitmap font at boot so UI text is
 * perfectly crisp at 480x270. Each glyph is 7 rows of 5 bits (bit 4 = leftmost).
 */
const GLYPHS: Record<string, string> = {
  A: '0e 11 11 1f 11 11 11',
  B: '1e 11 11 1e 11 11 1e',
  C: '0e 11 10 10 10 11 0e',
  D: '1e 11 11 11 11 11 1e',
  E: '1f 10 10 1e 10 10 1f',
  F: '1f 10 10 1e 10 10 10',
  G: '0e 11 10 17 11 11 0f',
  H: '11 11 11 1f 11 11 11',
  I: '0e 04 04 04 04 04 0e',
  J: '07 02 02 02 02 12 0c',
  K: '11 12 14 18 14 12 11',
  L: '10 10 10 10 10 10 1f',
  M: '11 1b 15 15 11 11 11',
  N: '11 11 19 15 13 11 11',
  O: '0e 11 11 11 11 11 0e',
  P: '1e 11 11 1e 10 10 10',
  Q: '0e 11 11 11 15 12 0d',
  R: '1e 11 11 1e 14 12 11',
  S: '0f 10 10 0e 01 01 1e',
  T: '1f 04 04 04 04 04 04',
  U: '11 11 11 11 11 11 0e',
  V: '11 11 11 11 11 0a 04',
  W: '11 11 11 15 15 15 0a',
  X: '11 11 0a 04 0a 11 11',
  Y: '11 11 0a 04 04 04 04',
  Z: '1f 01 02 04 08 10 1f',
  a: '00 00 0e 01 0f 11 0f',
  b: '10 10 1e 11 11 11 1e',
  c: '00 00 0e 10 10 11 0e',
  d: '01 01 0f 11 11 11 0f',
  e: '00 00 0e 11 1f 10 0e',
  f: '06 09 08 1c 08 08 08',
  g: '00 00 0e 11 11 11 0f 01 0e',
  h: '10 10 16 19 11 11 11',
  i: '04 00 0c 04 04 04 0e',
  j: '02 00 06 02 02 02 02 12 0c',
  k: '10 10 12 14 18 14 12',
  l: '0c 04 04 04 04 04 0e',
  m: '00 00 1a 15 15 11 11',
  n: '00 00 16 19 11 11 11',
  o: '00 00 0e 11 11 11 0e',
  p: '00 00 1e 11 11 11 1e 10 10',
  q: '00 00 0f 11 11 11 0f 01 01',
  r: '00 00 16 19 10 10 10',
  s: '00 00 0f 10 0e 01 1e',
  t: '08 08 1c 08 08 09 06',
  u: '00 00 11 11 11 13 0d',
  v: '00 00 11 11 11 0a 04',
  w: '00 00 11 11 15 15 0a',
  x: '00 00 11 0a 04 0a 11',
  y: '00 00 11 11 11 11 0f 01 0e',
  z: '00 00 1f 02 04 08 1f',
  '0': '0e 11 13 15 19 11 0e',
  '1': '04 0c 04 04 04 04 0e',
  '2': '0e 11 01 02 04 08 1f',
  '3': '1f 02 04 02 01 11 0e',
  '4': '02 06 0a 12 1f 02 02',
  '5': '1f 10 1e 01 01 11 0e',
  '6': '06 08 10 1e 11 11 0e',
  '7': '1f 01 02 04 08 08 08',
  '8': '0e 11 11 0e 11 11 0e',
  '9': '0e 11 11 0f 01 02 0c',
  '!': '04 04 04 04 04 00 04',
  '"': '0a 0a 00 00 00 00 00',
  "'": '04 04 08 00 00 00 00',
  ',': '00 00 00 00 0c 0c 08',
  '.': '00 00 00 00 00 0c 0c',
  ':': '00 0c 0c 00 0c 0c 00',
  ';': '00 0c 0c 00 0c 0c 08',
  '-': '00 00 00 0e 00 00 00',
  '+': '00 04 04 1f 04 04 00',
  '/': '01 01 02 04 08 10 10',
  '%': '18 19 02 04 08 13 03',
  '(': '02 04 08 08 08 04 02',
  ')': '08 04 02 02 02 04 08',
  '?': '0e 11 01 02 04 00 04',
  '<': '02 04 08 10 08 04 02',
  '>': '08 04 02 01 02 04 08',
  '=': '00 00 1f 00 1f 00 00',
  '*': '00 0a 04 1f 04 0a 00',
  '#': '0a 0a 1f 0a 1f 0a 0a',
  _: '00 00 00 00 00 00 1f',
  $: '04 0f 14 0e 05 1e 04',
  '&': '0c 12 14 08 15 12 0d',
  '[': '0e 08 08 08 08 08 0e',
  ']': '0e 02 02 02 02 02 0e',
  '|': '04 04 04 04 04 04 04',
  '~': '00 00 08 15 02 00 00',
  '^': '04 0a 11 00 00 00 00',
};

export const FONT_KEY = 'px';
const GAP = 1; // blank column between glyphs in the atlas

interface Glyph {
  ch: string;
  rows: number[];
  min: number;
  width: number;
}

function parseGlyph(ch: string, spec: string): Glyph {
  const rows = spec.split(' ').map((h) => parseInt(h, 16));
  let min = 5;
  let max = -1;
  for (const r of rows) {
    for (let c = 0; c < 5; c++) {
      if (r & (1 << (4 - c))) {
        min = Math.min(min, c);
        max = Math.max(max, c);
      }
    }
  }
  if (max < 0) return { ch, rows, min: 0, width: 0 };
  return { ch, rows, min, width: max - min + 1 };
}

/** Build the font texture and register it with Phaser's bitmap font cache. */
export function generateFont(scene: Phaser.Scene): void {
  const glyphs = Object.entries(GLYPHS).map(([ch, spec]) => parseGlyph(ch, spec));
  const atlasW = glyphs.reduce((w, g) => w + g.width + GAP, 0) + 2;
  const H = 9;
  const tex = scene.textures.createCanvas('font_px', atlasW, H);
  if (!tex) throw new Error('Could not create font texture');
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  const chars: Record<number, unknown> = {};
  let x = 0;
  for (const g of glyphs) {
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < g.width; c++) {
        if ((g.rows[r] ?? 0) & (1 << (4 - (g.min + c)))) ctx.fillRect(x + c, r, 1, 1);
      }
    }
    chars[g.ch.charCodeAt(0)] = {
      x,
      y: 0,
      width: g.width,
      height: H,
      centerX: g.width / 2,
      centerY: H / 2,
      xOffset: 0,
      yOffset: 0,
      xAdvance: g.width + 1,
      data: {},
      kerning: {},
      u0: x / atlasW,
      v0: 0,
      u1: (x + g.width) / atlasW,
      v1: 1,
    };
    x += g.width + GAP;
  }
  chars[32] = {
    x: 0,
    y: 0,
    width: 0,
    height: H,
    centerX: 0,
    centerY: 0,
    xOffset: 0,
    yOffset: 0,
    xAdvance: 3,
    data: {},
    kerning: {},
    u0: 0,
    v0: 0,
    u1: 0,
    v1: 0,
  };
  tex.refresh();
  scene.cache.bitmapFont.add(FONT_KEY, {
    data: { retroFont: true, font: FONT_KEY, size: H, lineHeight: H + 2, chars },
    frame: null,
    texture: 'font_px',
  });
}

export interface LabelStyle {
  color?: number;
  scale?: number;
  shadow?: number | null;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
}

/** Pixel text with a 1px drop shadow. Anchor follows `align`. */
export class Label extends Phaser.GameObjects.Container {
  private readonly main: Phaser.GameObjects.BitmapText;
  private readonly shade: Phaser.GameObjects.BitmapText | null;
  private readonly align: 'left' | 'center' | 'right';
  private color: number;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, style: LabelStyle = {}) {
    super(scene, x, y);
    const scale = style.scale ?? 1;
    this.align = style.align ?? 'left';
    this.color = style.color ?? 0xf4ead2;
    const make = (color: number) => {
      const t = new Phaser.GameObjects.BitmapText(scene, 0, 0, FONT_KEY, text, H_SIZE)
        .setTint(color)
        .setScale(scale);
      if (style.maxWidth) t.setMaxWidth(style.maxWidth / scale);
      return t;
    };
    const shadowColor = style.shadow === undefined ? 0x14101f : style.shadow;
    this.shade = shadowColor === null ? null : make(shadowColor);
    this.main = make(style.color ?? 0xf4ead2);
    if (this.shade) this.add(this.shade);
    this.add(this.main);
    this.layout();
    scene.add.existing(this);
  }

  setText(text: string): this {
    if (this.main.text === text) return this;
    this.main.setText(text);
    this.shade?.setText(text);
    this.layout();
    return this;
  }

  setColor(color: number): this {
    if (color === this.color) return this; // called every frame by the HUD; skip no-ops
    this.color = color;
    this.main.setTint(color);
    return this;
  }

  get textWidth(): number {
    return this.main.width; // BitmapText.width is already scaled
  }

  get textHeight(): number {
    return this.main.height;
  }

  private layout(): void {
    const w = this.textWidth;
    const ox = this.align === 'center' ? -w / 2 : this.align === 'right' ? -w : 0;
    this.main.setPosition(Math.round(ox), 0);
    this.shade?.setPosition(Math.round(ox) + 1, 1);
  }
}

const H_SIZE = 9; // must equal the font data size, or Phaser rescales glyphs
