import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { audio } from '../platform/audio';
import { hitSize } from './hit';
import { runtime } from '../state/runtime';
import { fitRow, Label } from './font';
import { rowLayout } from './layout';
import { getState } from '../state/store';
import { C, CH, SKIN, SEAM } from './theme';
import { sheetTexture } from './sheetSkin';

/**
 * Notched pixel-art panel drawn at (x, y). Plum skin: ink outline, cream rim, soft shadow. Walnut skin: a
 * content sheet is parchment in a 2 px wood frame; chrome (`kind = 'chrome'`) is walnut with a wood top edge and
 * plum-shadow grain.
 */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: number,
  rim?: number,
  kind: 'content' | 'chrome' = 'content',
): void {
  const t = kind === 'chrome' ? CH : C;
  const f = fill ?? t.panel;
  const r = rim ?? t.rim;
  const notch = (c: number, a: number, ix: number, iy: number, iw: number, ih: number) => {
    g.fillStyle(c, a)
      .fillRect(ix + 1, iy, iw - 2, ih)
      .fillRect(ix, iy + 1, iw, ih - 2);
  };
  if (SKIN === 'plum') {
    g.fillStyle(C.ink, 0.4).fillRect(x + 3, y + 3, w - 1, h - 1);
    notch(C.ink, 1, x, y, w, h);
    notch(r, 1, x + 1, y + 1, w - 2, h - 2);
    notch(f, 1, x + 2, y + 2, w - 4, h - 4);
    g.fillStyle(0xffffff, 0.07).fillRect(x + 3, y + 3, w - 6, 1);
    return;
  }
  // no see-through drop shadow (critic review 16: the last semi-alpha pixels in the UI); buttons get a solid lip
  notch(t.ink, 1, x, y, w, h);
  if (kind === 'chrome') {
    // flat walnut behind text (critic R1-1): no grain, just a lit top edge
    notch(f, 1, x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(r, 1).fillRect(x + 2, y + 1, w - 4, 1);
    return;
  }
  // 1 px ink outline, a 2 px wood frame, then the fill: no 1 px stripes inside (on the fractional display scales of
  // the iPhone 13 and SE a 1 px line renders 1 or 2 device px wider at random; art round 5, review 16)
  notch(r, 1, x + 1, y + 1, w - 2, h - 2);
  notch(f, 1, x + 3, y + 3, w - 6, h - 6);
}

export function drawSlot(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  selected: boolean,
  marked = false,
  kind: 'content' | 'chrome' = 'content',
): void {
  const t = kind === 'chrome' ? CH : C;
  g.fillStyle(t.ink, 1).fillRect(x, y, size, size);
  if (SKIN === 'plum') {
    g.fillStyle(
      selected ? C.gold : marked ? C.blue : C.creamDim,
      selected || marked ? 1 : 0.55,
    ).fillRect(x + 1, y + 1, size - 2, size - 2);
    g.fillStyle(C.slot, 1).fillRect(x + 2, y + 2, size - 4, size - 4);
    g.fillStyle(0xffffff, 0.05).fillRect(x + 2, y + 2, size - 4, 1);
    return;
  }
  const rimC = selected ? t.select : marked ? t.blue : t.slotRim;
  g.fillStyle(rimC, 1).fillRect(x + 1, y + 1, size - 2, size - 2);
  g.fillStyle(t.slot, 1).fillRect(x + 2, y + 2, size - 4, size - 4);
  g.fillStyle(t.ink, 0.25).fillRect(x + 2, y + 2, size - 4, 1); // recessed: shadow under the top edge
  if (selected) drawSelection(g, x, y, size, t.select, t.ink);
}

/**
 * The one selection style (critic R1-3), for slots and anything slot-like: a gold ring, 2 px ink notches in
 * its corners and a 2 px gold ledge along the bottom, so selection never relies on colour alone.
 */
export function drawSelection(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  gold: number = C.select,
  ink: number = C.ink,
): void {
  g.fillStyle(gold, 1)
    .fillRect(x + 1, y + 1, size - 2, 1)
    .fillRect(x + 1, y + 1, 1, size - 2)
    .fillRect(x + size - 2, y + 1, 1, size - 2)
    .fillRect(x + 1, y + size - 3, size - 2, 2);
  for (const [cx, cy, dx, dy] of [
    [x + 2, y + 2, 1, 1],
    [x + size - 3, y + 2, -1, 1],
    [x + 2, y + size - 4, 1, -1],
    [x + size - 3, y + size - 4, -1, -1],
  ] as const)
    g.fillStyle(ink, 1)
      .fillRect(cx, cy, 1, 1)
      .fillRect(cx + dx, cy, 1, 1)
      .fillRect(cx, cy + dy, 1, 1);
}

export function drawBar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: number,
  vertical = false,
): void {
  g.fillStyle(C.ink, 1).fillRect(x, y, w, h);
  // walnut: a plum-shadow track, or a sand one when the fill itself is ink (content progress bars)
  const track = SKIN === 'plum' ? 0x0c0914 : color === C.ink ? C.slot : 0x4a2a40;
  g.fillStyle(track, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
  const r = Math.max(0, Math.min(1, ratio));
  if (vertical) {
    const fh = Math.round((h - 2) * r);
    g.fillStyle(color, 1).fillRect(x + 1, y + h - 1 - fh, w - 2, fh);
    g.fillStyle(0xffffff, 0.25).fillRect(x + 1, y + h - 1 - fh, 1, fh);
  } else {
    const fw = Math.round((w - 2) * r);
    g.fillStyle(color, 1).fillRect(x + 1, y + 1, fw, h - 2);
    g.fillStyle(0xffffff, 0.25).fillRect(x + 1, y + 1, fw, 1);
  }
}

export interface ButtonStyle {
  fill?: number;
  rim?: number;
  textColor?: number;
  scale?: number;
}

/** The button lip's colour (palette soil). */
const SOIL = SEAM.lit;

/** Pressable pixel button. Hit area is padded so thumbs never miss. */
export class Button extends Phaser.GameObjects.Container {
  /** Walnut skin: a solid 2 px soil lip under the face, inside the footprint; the face sinks onto it when pressed. */
  static readonly LIP = SKIN === 'plum' ? 0 : 2;
  private readonly lip: Phaser.GameObjects.Graphics;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Label;
  private readonly zone: Phaser.GameObjects.Zone;
  private enabled = true;
  private down = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly bw: number,
    private readonly bh: number,
    text: string,
    private readonly onClick: () => void,
    private readonly style: ButtonStyle = {},
  ) {
    super(scene, x, y);
    this.lip = scene.add.graphics();
    this.bg = scene.add.graphics();
    // walnut: ink text gets no drop shadow (a light shadow under dark glyphs reads as doubled)
    const dark =
      SKIN !== 'plum' && [C.cream, C.creamDim, C.warn].includes(style.textColor ?? C.cream);
    this.label = new Label(scene, bw / 2, 0, text, {
      align: 'center',
      color: style.textColor ?? C.cream,
      scale: style.scale ?? 1,
      ...(dark ? { shadow: null } : {}),
    });
    this.label.setY(Math.round((bh - 7 * (style.scale ?? 1)) / 2));
    // Grow the touch area to >= 44 CSS px, overlapping the visual edge but never by more than 4px
    // a side so neighbouring rows stay distinguishable.
    const padX = Math.min(4, Math.max(3, (hitSize(scene, bw) - bw) / 2));
    const padY = Math.min(4, Math.max(3, (hitSize(scene, bh) - bh) / 2));
    this.zone = scene.add
      .zone(-padX, -padY, bw + padX * 2, bh + padY * 2)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.add([this.lip, this.bg, this.label, this.zone]);
    this.draw();
    this.zone.on('pointerdown', () => {
      if (!this.enabled) return;
      this.down = true;
      this.draw();
    });
    this.zone.on('pointerup', () => {
      if (!this.enabled || !this.down) return;
      this.down = false;
      this.draw();
      audio.play('ui');
      this.onClick();
    });
    const release = () => {
      if (!this.down) return;
      this.down = false;
      this.draw();
    };
    this.zone.on('pointerout', release);
    scene.add.existing(this);
  }

  private draw(): void {
    const { bw: w, bh: h, style } = this;
    this.bg.clear();
    const fill = this.enabled ? (style.fill ?? C.panelLight) : SKIN === 'plum' ? 0x241d33 : C.slot;
    const rim = this.enabled ? (style.rim ?? C.rim) : C.creamDim;
    const lip = Button.LIP;
    const dy = this.down ? lip || 1 : 0;
    this.lip.clear();
    if (lip) {
      // the lip: ink outline, soil inside; only its bottom `lip` rows show below the face
      this.lip
        .fillStyle(C.ink, 1)
        .fillRect(1, lip, w - 2, h - lip)
        .fillRect(0, lip + 1, w, h - lip - 2);
      this.lip.fillStyle(SOIL, 1).fillRect(1, h - lip - 1, w - 2, lip);
      this.lip.fillStyle(C.ink, 1).fillRect(1, h - 1, w - 2, 1);
    }
    drawPanel(this.bg, 0, dy, w, h - lip, this.down ? C.ink : fill, rim);
    this.label.setY(Math.round((h - lip - 7 * (style.scale ?? 1)) / 2) + dy);
    this.label.setAlpha(this.enabled ? 1 : 0.5);
    if (SKIN !== 'plum') {
      // walnut (critic R1-4): an enabled button always reads in full ink (or the colour asked for, never the
      // dim one); a disabled one is dim AND hatched, so it is told apart by shape as well as colour
      const asked = style.textColor ?? C.cream;
      const dim = asked === C.creamDim || asked === C.warn; // Close used the warn tone: it read as disabled
      this.label.setColor(this.enabled ? (dim ? C.cream : asked) : C.creamDim);
      this.label.setAlpha(1);
      if (!this.enabled && !this.down)
        // hatch only a band inside the frame, so the glyphs stay clean: solid 2 px blocks on a diagonal (no
        // semi-alpha, no 1 px checker that a fractional display scale breaks up)
        for (let yy = 3; yy < h - lip - 4; yy += 2)
          for (let xx = 3; xx < w - 4; xx += 2) {
            const band = xx < 7 || xx >= w - 7 || yy < 7 || yy >= h - lip - 7;
            if (band && ((xx >> 1) + (yy >> 1)) % 3 === 0)
              this.bg.fillStyle(C.slotRim, 1).fillRect(xx, yy, 2, 2);
          }
    }
  }

  /** The label text (the guided start finds buttons in a sheet by it). */
  get text(): string {
    return this.label.text;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.draw();
    return this;
  }

  setTextColor(color: number): this {
    this.label.setColor(color);
    return this;
  }
}

/** Turn touch on or off for everything interactive inside a container (a sheet sliding away takes none). */
function setInputEnabled(c: Phaser.GameObjects.Container, on: boolean): void {
  for (const o of c.list) {
    const io = (o as Phaser.GameObjects.GameObject).input;
    if (io) io.enabled = on;
    if (o instanceof Phaser.GameObjects.Container) setInputEnabled(o, on);
  }
}

/** One list row: icon, title + subtitle on the left, an optional button on the right. */
export interface RowSpec {
  icon?: string;
  title: string;
  sub?: string;
  subColor?: number;
  /** Right-aligned buttons, laid out right to left. */
  buttons?: {
    label: string;
    onClick: () => void;
    width?: number;
    color?: number;
    enabled?: boolean;
  }[];
}

export const ROW_H = 26;

/**
 * A bottom sheet: full-width dialog anchored to the bottom of the screen, where the thumb is.
 * Opening it freezes the world and the clock. Tapping the dimmed area above dismisses it.
 */
export abstract class Modal {
  readonly root: Phaser.GameObjects.Container;
  protected readonly content: Phaser.GameObjects.Container;
  protected readonly panelW = GAME_WIDTH;
  protected panelH: number;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private opened = false;
  private dimPressed = false;
  /** Tapping outside the sheet closes it. Flows that must be acknowledged turn this off. */
  protected dismissOnDim = true;
  onClosed: (() => void) | null = null;

  protected constructor(
    protected readonly scene: Phaser.Scene,
    panelH: number,
  ) {
    this.panelH = panelH;
    this.dim = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, C.ink, 0.6)
      .setOrigin(0)
      .setDepth(200)
      .setVisible(false);
    this.dim.setInteractive();
    // A press that opened this sheet (Interact, a menu button) ends on the dim once the finger lifts;
    // only a press that also began on the dim counts as "tap outside".
    this.dim.on('pointerdown', () => (this.dimPressed = true));
    this.dim.on('pointerup', () => {
      const armed = this.dimPressed;
      this.dimPressed = false;
      if (armed && this.dismissOnDim) this.close();
    });
    this.root = scene.add
      .container(0, GAME_HEIGHT - panelH)
      .setDepth(210)
      .setVisible(false);
    this.content = scene.add.container(0, 0);
    this.root.add(this.content);
  }

  /** Subclasses draw into `content` in sheet-local coordinates (0,0 = sheet top-left). */
  protected abstract build(): void;

  protected rebuild(): void {
    this.content.removeAll(true);
    this.build();
    if (this.opened) this.root.y = GAME_HEIGHT - this.panelH;
  }

  /** Change the sheet height from inside build(); the sheet stays glued to the bottom edge. */
  protected setHeight(h: number): void {
    this.panelH = Math.min(h, GAME_HEIGHT - 60);
  }

  /** Left-handed mode: sheet rows put their buttons on the left (`rowLayout`). */
  protected get leftHanded(): boolean {
    return getState().settings.leftHanded;
  }

  /** Enter key: run the dialog's primary action. Dialogs without one ignore it. */
  confirm(): void {}

  get isOpen(): boolean {
    return this.opened;
  }

  /**
   * Slides up from the bottom edge (190 ms, easing out, whole-pixel steps) over a dim that fades in. Calm mode:
   * the sheet is simply there and only the dim fades. Its buttons work from the first frame.
   */
  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.dimPressed = false;
    runtime.modals += 1;
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.killTweensOf(this.dim);
    this.rebuild();
    const calm = getState().settings.reduceMotion;
    const top = GAME_HEIGHT - this.panelH;
    this.dim.setVisible(true).setAlpha(0).setInteractive();
    this.root
      .setVisible(true)
      .setAlpha(1)
      .setY(calm ? top : GAME_HEIGHT);
    // The slide starts on the next frame: building the sheet's content can make this frame long, and a tween
    // started now would jump by that long frame on its first step.
    this.scene.time.delayedCall(0, () => {
      if (!this.opened) return;
      this.scene.tweens.add({ targets: this.dim, alpha: 1, duration: calm ? 90 : 140 });
      if (!calm)
        this.scene.tweens.add({
          targets: this.root,
          y: top,
          duration: 190,
          ease: 'Cubic.easeOut',
          onUpdate: () => this.root.setY(Math.round(this.root.y)),
        });
    });
    audio.play('select');
  }

  /**
   * The world takes input again at once (the sheet stops counting as open on this frame and its buttons and dim
   * stop taking touches), while the sheet slides back down over 150 ms. Calm mode: it is gone at once.
   */
  close(): void {
    if (!this.opened) return;
    this.opened = false;
    runtime.modals = Math.max(0, runtime.modals - 1);
    this.dimPressed = false;
    this.dim.disableInteractive();
    setInputEnabled(this.content, false);
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.killTweensOf(this.dim);
    const hide = () => {
      if (this.opened) return;
      this.dim.setVisible(false);
      this.root.setVisible(false);
    };
    if (getState().settings.reduceMotion) hide();
    else {
      this.scene.tweens.add({ targets: this.dim, alpha: 0, duration: 120 });
      this.scene.tweens.add({
        targets: this.root,
        y: GAME_HEIGHT,
        duration: 150,
        ease: 'Cubic.easeIn',
        onUpdate: () => this.root.setY(Math.round(this.root.y)),
        onComplete: hide,
      });
    }
    audio.play('select');
    this.onClosed?.();
  }

  /**
   * The sheet background. Extends below the screen so its bottom corners are never visible. The walnut skin uses
   * the 9-slice parchment-and-walnut sheet when its art is in the ui atlas (sheetSkin.ts), else the drawn panel.
   */
  protected panel(h = this.panelH): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    const skin = sheetTexture(this.scene, this.panelW, h + 6);
    if (skin) this.content.add(this.scene.add.image(0, 0, skin).setOrigin(0));
    else drawPanel(g, 0, 0, this.panelW, h + 6);
    this.content.add(g);
    return g;
  }

  protected label(
    x: number,
    y: number,
    text: string,
    color: number = C.cream,
    scale = 1,
    align: 'left' | 'center' | 'right' = 'left',
    maxWidth?: number,
  ): Label {
    const l = new Label(this.scene, x, y, text, { color, scale, align, maxWidth });
    this.content.add(l);
    return l;
  }

  protected button(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    onClick: () => void,
    style?: ButtonStyle,
  ): Button {
    const b = new Button(this.scene, x, y, w, h, text, onClick, style);
    this.content.add(b);
    return b;
  }

  protected icon(x: number, y: number, key: string, scale = 1): Phaser.GameObjects.Image {
    const img = this.scene.add.image(x, y, key).setScale(scale);
    this.content.add(img);
    return img;
  }

  /** Full-width Close button pinned to the bottom of the sheet (thumb-friendly). */
  protected closeButton(label = 'Close'): void {
    this.button(8, this.panelH - 28, this.panelW - 16, 22, label, () => this.close(), {
      textColor: C.warn,
    });
  }

  /** Lay out one list row at `y`. Returns the y of the next row. */
  protected row(y: number, spec: RowSpec): number {
    // Buttons sit on the thumb's side (mirrored for the left hand); icon and text take the other side.
    const widths = (spec.buttons ?? []).map((b) => b.width ?? 44);
    const L = rowLayout(this.panelW, widths, this.leftHanded);
    if (spec.icon) this.icon(L.iconX, y + 12, spec.icon);
    this.label(L.textX, y + 3, fitRow(spec.title, L.maxText));
    if (spec.sub)
      this.label(L.textX, y + 14, fitRow(spec.sub, L.maxText), spec.subColor ?? C.creamDim);
    (spec.buttons ?? []).forEach((b, i) => {
      this.button(L.buttonXs[i]!, y, widths[i]!, 22, b.label, b.onClick, {
        textColor: b.color ?? C.cream,
      }).setEnabled(b.enabled !== false);
    });
    return y + ROW_H;
  }
}
