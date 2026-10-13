import Phaser from 'phaser';
import {
  bodyRows,
  COIN,
  COIN_COLOURS,
  COIN_ROWS,
  FACE,
  GAP,
  GLYPHS,
  glyphSpec,
  parseGlyph,
  TALL_GLYPHS,
  TALL_ROWS,
  type Face,
} from './fontMetrics';
import { C } from './theme';

const isDark = (c: number): boolean =>
  ((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114 < 110;
export { fitRow, fitText, measureText } from './fontMetrics';

/**
 * Hand-built pixel font in two faces (fontMetrics.ts `FACE`), generated into bitmap fonts at boot so UI text is
 * crisp at 200x400: `body` (the reading size) and `small` (the old 5x7). Glyph shapes and measuring live in
 * fontMetrics.ts; both faces share every advance width.
 */
export const FONT_KEY = 'px';
export const FONT_KEYS: Record<Face, string> = { small: 'px', body: 'pxb' };

/** Build both faces' textures and register them with Phaser's bitmap font cache. */
export function generateFont(scene: Phaser.Scene): void {
  buildFace(scene, 'small');
  buildFace(scene, 'body');
}

function buildFace(scene: Phaser.Scene, face: Face): void {
  // Regular glyphs are `size` rows; accented capitals (TALL_GLYPHS) have TALL_ROWS more above the cap line, drawn
  // with a negative y offset into the line gap, so every line keeps the same height.
  const H = FACE[face].size;
  const rowsOf = (ch: string): number[] =>
    face === 'body'
      ? bodyRows(ch)
      : glyphSpec(ch)
          .split(' ')
          .map((h) => parseInt(h, 16));
  const glyphs = [
    ...Object.keys(GLYPHS).map((ch) => ({ ch, tall: false })),
    ...Object.keys(TALL_GLYPHS).map((ch) => ({ ch, tall: true })),
  ].map(({ ch, tall }) => ({ g: parseGlyph(ch, glyphSpec(ch)), rows: rowsOf(ch), tall }));
  const coin = COIN_ROWS[face];
  const coinW = coin[0]!.length;
  const atlasW = glyphs.reduce((w, { g }) => w + g.width + GAP, 0) + coinW + GAP + 2;
  const atlasH = H + TALL_ROWS;
  const key = `font_${FONT_KEYS[face]}`;
  const tex = scene.textures.createCanvas(key, atlasW, atlasH);
  if (!tex) throw new Error('Could not create font texture');
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  const chars: Record<number, unknown> = {};
  const add = (
    code: number,
    x: number,
    y: number,
    w: number,
    h: number,
    yOffset: number,
    adv: number,
    xOffset = 0,
  ) => {
    chars[code] = {
      x,
      y,
      width: w,
      height: h,
      centerX: w / 2,
      centerY: h / 2,
      xOffset,
      yOffset,
      xAdvance: adv,
      data: {},
      kerning: {},
      u0: x / atlasW,
      v0: y / atlasH,
      u1: (x + w) / atlasW,
      v1: (y + h) / atlasH,
    };
  };
  let x = 0;
  for (const { g, rows, tall } of glyphs) {
    const top = tall ? 0 : TALL_ROWS; // texture row of the glyph's first row
    const h = tall ? atlasH : H;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < g.width; c++) {
        if ((rows[r] ?? 0) & (1 << (4 - (g.min + c)))) ctx.fillRect(x + c, top + r, 1, 1);
      }
    }
    add(g.ch.charCodeAt(0), x, top, g.width, h, tall ? -TALL_ROWS : 0, g.width + 1);
    x += g.width + GAP;
  }
  // the coin in its own colours, on the x-height (a Label leaves it untinted)
  const coinTop = TALL_ROWS + 2;
  coin.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const col = COIN_COLOURS[row[c]!];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + c, coinTop + r, 1, 1);
    }
  });
  // the small face's narrower coin is centred in the body face's advance, so measuring stays one function
  const advance = COIN_ROWS.body[0]!.length + 1;
  const pad = Math.floor((advance - 1 - coinW) / 2);
  add(COIN.charCodeAt(0), x, TALL_ROWS, coinW, H, 0, advance, pad);
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
  scene.cache.bitmapFont.add(FONT_KEYS[face], {
    data: { retroFont: true, font: FONT_KEYS[face], size: H, lineHeight: FACE[face].line, chars },
    frame: null,
    texture: key,
  });
}

export interface LabelStyle {
  color?: number;
  scale?: number;
  shadow?: number | null;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  /**
   * A full 1 px outline in this colour (four offset copies under the text), for text that sits on busy art
   * whatever is behind it, such as a stack count over an item icon. The copies share the font texture, so they
   * batch with the text and cost no draw call.
   */
  outline?: number;
  /**
   * The face (DECISIONS "Type scale"): `body` by default at scale 1, `small` (the old 5x7) for counts over icons
   * and for 2x display text.
   */
  face?: Face;
}

/** Pixel text with a 1px drop shadow. Anchor follows `align`. */
export class Label extends Phaser.GameObjects.Container {
  private readonly main: Phaser.GameObjects.BitmapText;
  private readonly shade: Phaser.GameObjects.BitmapText | null;
  /** The outline's copies (empty without `outline`), and its colour (read by the e2e text guard). */
  private readonly rim: Phaser.GameObjects.BitmapText[] = [];
  readonly outline: number | null;
  private readonly align: 'left' | 'center' | 'right';
  private color: number;
  /** The face this label draws in. */
  readonly face: Face;
  private tintedCoins = false;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, style: LabelStyle = {}) {
    super(scene, x, y);
    const scale = style.scale ?? 1;
    this.align = style.align ?? 'left';
    this.color = style.color ?? C.cream;
    this.face = style.face ?? (scale === 1 ? 'body' : 'small');
    const make = (color: number) => {
      const t = new Phaser.GameObjects.BitmapText(
        scene,
        0,
        0,
        FONT_KEYS[this.face],
        text,
        FACE[this.face].size,
      )
        .setTint(color)
        .setScale(scale);
      if (style.maxWidth) t.setMaxWidth(style.maxWidth / scale);
      return t;
    };
    // Dark text (ink on parchment) gets no drop shadow; light text gets an ink one.
    const shadowColor =
      style.shadow === undefined ? (isDark(this.color) ? null : C.ink) : style.shadow;
    this.outline = style.outline ?? null;
    this.shade = shadowColor === null || this.outline !== null ? null : make(shadowColor);
    this.main = make(this.color);
    if (this.outline !== null) for (let i = 0; i < 4; i++) this.rim.push(make(this.outline));
    this.add(this.rim);
    if (this.shade) this.add(this.shade);
    this.add(this.main);
    this.coins();
    this.layout();
    scene.add.existing(this);
  }

  /** The gold coin keeps its own colours in the main text (the shadow and outline copies draw it in theirs). */
  private coins(): void {
    const text = this.main.text;
    const had = this.tintedCoins;
    this.tintedCoins = text.includes(COIN);
    if (!had && !this.tintedCoins) return;
    if (text.length) this.main.setCharacterTint(0, -1, false);
    // the renderer indexes characters as laid out (line breaks and wrapped spaces are not counted), so take each
    // coin's index from the layout itself
    for (const ch of this.main.getTextBounds(true).characters)
      if (ch.char === COIN) this.main.setCharacterTint(ch.i, 1, false, 0xffffff);
  }

  setText(text: string): this {
    if (this.main.text === text) return this;
    this.main.setText(text);
    this.shade?.setText(text);
    for (const r of this.rim) r.setText(text);
    this.coins();
    this.layout();
    return this;
  }

  setColor(color: number): this {
    if (color === this.color) return this; // called every frame by the HUD; skip no-ops
    this.color = color;
    this.main.setTint(color);
    return this;
  }

  get text(): string {
    return this.main.text;
  }

  get textWidth(): number {
    return this.main.width; // BitmapText.width is already scaled
  }

  get textHeight(): number {
    return this.main.height;
  }

  /** Capital height in screen px (9 in the body face, 7 in the small one, times the scale): centres a label. */
  get cap(): number {
    return FACE[this.face].cap * this.main.scaleY;
  }

  private layout(): void {
    const w = this.textWidth;
    const ox = this.align === 'center' ? -w / 2 : this.align === 'right' ? -w : 0;
    this.main.setPosition(Math.round(ox), 0);
    this.shade?.setPosition(Math.round(ox) + 1, 1);
    const o = Math.round(ox);
    this.rim.forEach((r, i) => r.setPosition(o + [1, -1, 0, 0][i]!, [0, 0, 1, -1][i]!));
  }
}
