import Phaser from 'phaser';
import { game } from '../data';
import { audio } from '../platform/audio';
import { haptic } from '../platform/haptics';
import type { GameState } from '../state/GameState';
import { iconKey, refOf } from '../systems/itemRef';
import { Label } from './font';
import { RING, ringItem, ringPick } from './layout';
import { CH } from './theme';

/** What a ring pick does. */
export type RingChoice = { kind: 'slot'; slot: number } | { kind: 'bag' };

/**
 * The tool ring (M6): a sideways flick on Action opens the 8 hotbar slots and "Bag" on an arc around Action,
 * inside the thumb's comfortable zone. The same finger slides to an item (picked by angle, a whole sector) and
 * lets go to choose it; letting go in the middle, or toward the screen edge, cancels. Drawn with theme tokens
 * and item icons, so a UI skin restyles it.
 */
export class ToolRing {
  private readonly root: Phaser.GameObjects.Container;
  private readonly back: Phaser.GameObjects.Graphics;
  private readonly hi: Phaser.GameObjects.Graphics;
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private readonly nums: Label[] = [];
  private readonly bag: Phaser.GameObjects.Graphics;
  private pointerId: number | null = null;
  private centre = { x: 0, y: 0 };
  private left = false;
  private hover: number | null = null;
  private readonly n = game.hotbarSlots + 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getState: () => GameState,
    private readonly onChoose: (c: RingChoice) => void,
  ) {
    this.back = scene.add.graphics();
    this.hi = scene.add.graphics();
    this.bag = scene.add.graphics();
    this.root = scene.add
      .container(0, 0, [this.back, this.hi, this.bag])
      .setDepth(150)
      .setVisible(false);
    for (let i = 0; i < game.hotbarSlots; i++) {
      const img = scene.add.image(0, 0, 'ui_coin');
      const num = new Label(scene, 0, 0, String(i + 1), { color: CH.creamDim, shadow: null });
      this.icons.push(img);
      this.nums.push(num);
      this.root.add([img, num]);
    }
    const move = (p: Phaser.Input.Pointer) => this.move(p);
    const up = (p: Phaser.Input.Pointer) => this.up(p);
    scene.input.on('pointermove', move);
    scene.input.on('pointerup', up);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointermove', move);
      scene.input.off('pointerup', up);
    });
  }

  get isOpen(): boolean {
    return this.pointerId !== null;
  }

  /** Open around Action's centre for the finger that flicked. */
  open(pointerId: number, centre: { x: number; y: number }, leftHanded: boolean): void {
    this.pointerId = pointerId;
    this.centre = centre;
    this.left = leftHanded;
    this.hover = null;
    this.draw();
    this.root.setVisible(true).setAlpha(1);
    if (!this.getState().settings.reduceMotion) {
      this.root.setScale(0.85);
      this.root.setPosition(centre.x * 0.15, centre.y * 0.15);
      this.scene.tweens.add({
        targets: this.root,
        scale: 1,
        x: 0,
        y: 0,
        duration: 110,
        ease: 'Back.easeOut',
      });
    } else this.root.setScale(1).setPosition(0, 0);
    audio.play('select');
    haptic('tick');
  }

  close(): void {
    this.pointerId = null;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(false);
  }

  private draw(): void {
    const s = this.getState();
    const g = this.back;
    g.clear();
    g.fillStyle(CH.ink, 0.45).fillCircle(
      this.centre.x,
      this.centre.y,
      RING.radius + RING.itemR + 4,
    );
    for (let i = 0; i < this.n; i++) {
      const c = ringItem(this.centre, i, this.n, this.left);
      const isBag = i === game.hotbarSlots;
      const stack = isBag ? null : (s.inventory.slots[i] ?? null);
      const empty = !isBag && !stack;
      const selected = !isBag && i === s.inventory.selected;
      g.fillStyle(CH.ink, 0.6).fillCircle(c.x, c.y + 1, RING.itemR + 1);
      g.fillStyle(CH.panel, empty ? 0.5 : 0.95).fillCircle(c.x, c.y, RING.itemR);
      g.lineStyle(selected ? 2 : 1, selected ? CH.gold : CH.cream, empty ? 0.35 : 0.8);
      g.strokeCircle(c.x, c.y, RING.itemR - 0.5);
      if (isBag) {
        this.drawBag(c.x, c.y);
        continue;
      }
      const img = this.icons[i]!;
      if (stack)
        img
          .setTexture(iconKey(refOf(stack)))
          .setPosition(c.x, c.y)
          .setVisible(true);
      else img.setVisible(false);
      this.nums[i]!.setPosition(c.x - RING.itemR + 2, c.y - RING.itemR + 1).setAlpha(
        empty ? 0.4 : 0.8,
      );
    }
    this.drawHover();
  }

  /** A small sack (no atlas key yet; the UI skin may replace it). */
  private drawBag(x: number, y: number): void {
    const g = this.bag;
    g.clear();
    g.fillStyle(CH.ink, 0.8)
      .fillRect(x - 5, y - 2, 10, 8)
      .fillRect(x - 3, y - 5, 6, 3);
    g.fillStyle(CH.gold, 1)
      .fillRect(x - 4, y - 1, 8, 6)
      .fillRect(x - 2, y - 4, 4, 2);
    g.fillStyle(CH.ink, 0.8).fillRect(x - 3, y - 2, 6, 1);
  }

  private drawHover(): void {
    const g = this.hi;
    g.clear();
    if (this.hover === null) return;
    const c = ringItem(this.centre, this.hover, this.n, this.left);
    g.lineStyle(3, CH.gold, 1).strokeCircle(c.x, c.y, RING.itemR + 3);
  }

  private pick(p: Phaser.Input.Pointer): number | null {
    const i = ringPick(p.x - this.centre.x, p.y - this.centre.y, this.n, this.left);
    if (i === null) return null;
    // an empty hotbar slot cannot be chosen
    if (i < game.hotbarSlots && !this.getState().inventory.slots[i]) return null;
    return i;
  }

  private move(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    const i = this.pick(p);
    if (i === this.hover) return;
    this.hover = i;
    this.drawHover();
    if (i !== null) haptic('tick');
  }

  private up(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    const i = this.pick(p);
    this.close();
    if (i === null) return;
    audio.play('select');
    this.onChoose(i === game.hotbarSlots ? { kind: 'bag' } : { kind: 'slot', slot: i });
  }
}
