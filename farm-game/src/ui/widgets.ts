import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { audio } from '../platform/audio';
import { hitSize } from './hit';
import { runtime } from '../state/runtime';
import { fitRow, Label } from './font';
import { C } from './theme';

/** Notched pixel-art panel: ink outline, cream rim, soft shadow. Drawn at (x, y). */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number = C.panel,
  rim: number = C.cream,
): void {
  const notch = (c: number, a: number, ix: number, iy: number, iw: number, ih: number) => {
    g.fillStyle(c, a)
      .fillRect(ix + 1, iy, iw - 2, ih)
      .fillRect(ix, iy + 1, iw, ih - 2);
  };
  g.fillStyle(C.ink, 0.4).fillRect(x + 3, y + 3, w - 1, h - 1);
  notch(C.ink, 1, x, y, w, h);
  notch(rim, 1, x + 1, y + 1, w - 2, h - 2);
  notch(fill, 1, x + 2, y + 2, w - 4, h - 4);
  g.fillStyle(0xffffff, 0.07).fillRect(x + 3, y + 3, w - 6, 1);
}

export function drawSlot(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  selected: boolean,
  marked = false,
): void {
  g.fillStyle(C.ink, 1).fillRect(x, y, size, size);
  g.fillStyle(
    selected ? C.gold : marked ? C.blue : C.creamDim,
    selected || marked ? 1 : 0.55,
  ).fillRect(x + 1, y + 1, size - 2, size - 2);
  g.fillStyle(C.slot, 1).fillRect(x + 2, y + 2, size - 4, size - 4);
  g.fillStyle(0xffffff, 0.05).fillRect(x + 2, y + 2, size - 4, 1);
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
  g.fillStyle(0x0c0914, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
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

/** Pressable pixel button. Hit area is padded so thumbs never miss. */
export class Button extends Phaser.GameObjects.Container {
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
    this.bg = scene.add.graphics();
    this.label = new Label(scene, bw / 2, 0, text, {
      align: 'center',
      color: style.textColor ?? C.cream,
      scale: style.scale ?? 1,
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
    this.add([this.bg, this.label, this.zone]);
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
    const fill = this.enabled ? (style.fill ?? C.panelLight) : 0x241d33;
    const rim = this.enabled ? (style.rim ?? C.cream) : C.creamDim;
    drawPanel(this.bg, 0, this.down ? 1 : 0, w, h, this.down ? C.ink : fill, rim);
    this.label.setY(Math.round((h - 7 * (style.scale ?? 1)) / 2) + (this.down ? 1 : 0));
    this.label.setAlpha(this.enabled ? 1 : 0.5);
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

  /** Enter key: run the dialog's primary action. Dialogs without one ignore it. */
  confirm(): void {}

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.dimPressed = false;
    runtime.modals += 1;
    this.rebuild();
    this.dim.setVisible(true).setAlpha(0);
    this.root.setVisible(true).setAlpha(1).setY(GAME_HEIGHT);
    this.scene.tweens.add({ targets: this.dim, alpha: 1, duration: 140 });
    this.scene.tweens.add({
      targets: this.root,
      y: GAME_HEIGHT - this.panelH,
      duration: 190,
      ease: 'Cubic.easeOut',
    });
    audio.play('select');
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    runtime.modals = Math.max(0, runtime.modals - 1);
    this.dim.setVisible(false);
    this.root.setVisible(false);
    this.scene.tweens.killTweensOf(this.root);
    audio.play('select');
    this.onClosed?.();
  }

  /** The sheet background. Extends below the screen so its bottom corners are never visible. */
  protected panel(h = this.panelH): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    drawPanel(g, 0, 0, this.panelW, h + 6);
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
    if (spec.icon) this.icon(15, y + 12, spec.icon);
    const right = (spec.buttons ?? []).reduce((w, b) => w + (b.width ?? 44) + 3, 0);
    const maxText = this.panelW - 8 - 28 - right - 2;
    this.label(28, y + 3, fitRow(spec.title, maxText));
    if (spec.sub) this.label(28, y + 14, fitRow(spec.sub, maxText), spec.subColor ?? C.creamDim);
    let x = this.panelW - 8;
    for (const b of spec.buttons ?? []) {
      const w = b.width ?? 44;
      x -= w;
      this.button(x, y, w, 22, b.label, b.onClick, { textColor: b.color ?? C.cream }).setEnabled(
        b.enabled !== false,
      );
      x -= 3;
    }
    return y + ROW_H;
  }
}
