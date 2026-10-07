import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { audio } from '../platform/audio';
import { hitSize } from './hit';
import { runtime } from '../state/runtime';
import { Label } from './font';
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

/** Full-screen dimmer + centered panel. Opening a modal freezes the world and the clock. */
export abstract class Modal {
  readonly root: Phaser.GameObjects.Container;
  protected readonly content: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private opened = false;
  onClosed: (() => void) | null = null;

  protected constructor(
    protected readonly scene: Phaser.Scene,
    protected panelW: number,
    protected panelH: number,
  ) {
    this.dim = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, C.ink, 0.6)
      .setOrigin(0)
      .setDepth(200)
      .setVisible(false);
    this.dim.setInteractive(); // swallows pointers so nothing underneath reacts
    this.root = scene.add.container(0, 0).setDepth(210).setVisible(false);
    this.content = scene.add.container(0, 0);
    this.root.add(this.content);
  }

  /** Subclasses draw into `content`, in panel-local coordinates (0,0 = panel top-left). */
  protected abstract build(): void;

  protected rebuild(): void {
    this.content.removeAll(true);
    this.build();
  }

  /** Enter key: run the dialog's primary action. Dialogs without one ignore it. */
  confirm(): void {}

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    runtime.modals += 1;
    this.rebuild();
    this.root.setPosition(
      Math.round((GAME_WIDTH - this.panelW) / 2),
      Math.round((GAME_HEIGHT - this.panelH) / 2),
    );
    this.dim.setVisible(true).setAlpha(0);
    this.root.setVisible(true).setAlpha(0).setScale(0.94);
    this.scene.tweens.add({ targets: this.dim, alpha: 1, duration: 140 });
    this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: 'Back.easeOut',
    });
    audio.play('select');
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    runtime.modals = Math.max(0, runtime.modals - 1);
    this.dim.setVisible(false);
    this.root.setVisible(false);
    audio.play('select');
    this.onClosed?.();
  }

  protected panel(w = this.panelW, h = this.panelH): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    drawPanel(g, 0, 0, w, h);
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

  protected closeButton(): void {
    this.button(this.panelW - 30, 6, 24, 18, 'X', () => this.close(), { textColor: C.warn });
  }
}
