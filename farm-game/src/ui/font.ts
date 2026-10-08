import Phaser from 'phaser';
import { GAP, GLYPHS, parseGlyph } from './fontMetrics';
import { C } from './theme';

const isDark = (c: number): boolean =>
  ((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114 < 110;
export { fitRow, fitText, measureText } from './fontMetrics';

/**
 * Hand-built 5x7 pixel font, generated into a bitmap font at boot so UI text is
 * perfectly crisp at 200x400. Glyph shapes and text measuring live in fontMetrics.ts.
 */
export const FONT_KEY = 'px';

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
    this.color = style.color ?? C.cream;
    const make = (color: number) => {
      const t = new Phaser.GameObjects.BitmapText(scene, 0, 0, FONT_KEY, text, H_SIZE)
        .setTint(color)
        .setScale(scale);
      if (style.maxWidth) t.setMaxWidth(style.maxWidth / scale);
      return t;
    };
    // Dark text (ink on parchment) gets no drop shadow; light text gets an ink one.
    const shadowColor =
      style.shadow === undefined ? (isDark(this.color) ? null : C.ink) : style.shadow;
    this.shade = shadowColor === null ? null : make(shadowColor);
    this.main = make(this.color);
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
