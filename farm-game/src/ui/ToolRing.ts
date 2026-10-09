import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { game } from '../data';
import { audio } from '../platform/audio';
import { haptic } from '../platform/haptics';
import type { GameState } from '../state/GameState';
import { iconKey, refOf } from '../systems/itemRef';
import { compensateTouch } from '../systems/tapIntent';
import { Label } from './font';
import { cssPerLogical } from './hit';
import { RING, ringItem, ringPick } from './layout';
import { CH } from './theme';

/** What a ring pick does. */
export type RingChoice = { kind: 'slot'; slot: number } | { kind: 'bag' };

/** A slide-and-lift pick needs the finger to rest this long on the highlighted item (else: tap menu). */
export const RING_DWELL_MS = 80;
/** A lift this soon after the ring opened leaves it open as a tap menu. */
export const RING_QUICK_MS = 120;

/**
 * The tool ring: a quick sideways flick on Action opens the hotbar's items (empty slots left out, so each gets
 * a bigger sector) and "Bag" on an arc around Action, inside the thumb's comfortable zone. Never acts.
 *
 * - Slide and lift: the item under the finger (by angle, aim corrected for the thumb-base pull, with gaps
 *   between sectors so a miss lands on nothing) is highlighted; lifting after resting on it 80 ms picks it.
 * - Flick and lift at once (or lift without resting on an item): the ring stays open as a tap menu: tap an
 *   item to pick it, tap anywhere else to close. Never a silent pick.
 *
 * Drawn with theme tokens and item icons, so a UI skin restyles it.
 */
export class ToolRing {
  private readonly root: Phaser.GameObjects.Container;
  private readonly back: Phaser.GameObjects.Graphics;
  private readonly hi: Phaser.GameObjects.Graphics;
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private readonly nums: Label[] = [];
  private readonly bag: Phaser.GameObjects.Graphics;
  /** Catches the taps of the sticky tap menu (and keeps them from the world). */
  private readonly catcher: Phaser.GameObjects.Zone;
  private pointerId: number | null = null;
  private sticky = false;
  private openedAt = 0;
  private centre = { x: 0, y: 0 };
  private left = false;
  private hover: number | null = null;
  private hoverAt = 0;
  /** What each arc position holds: a hotbar slot index, or 'bag'. */
  private items: (number | 'bag')[] = [];

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
    this.catcher = scene.add
      .zone(0, 0, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0, 0)
      .setDepth(149)
      .setInteractive();
    this.catcher.input!.enabled = false;
    this.catcher.on('pointerup', (p: Phaser.Input.Pointer) => this.stickyTap(p));
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
    return this.pointerId !== null || this.sticky;
  }

  /** Open around Action's centre for the finger that flicked. */
  open(pointerId: number, centre: { x: number; y: number }, leftHanded: boolean): void {
    const s = this.getState();
    this.items = [];
    for (let i = 0; i < game.hotbarSlots; i++) if (s.inventory.slots[i]) this.items.push(i);
    this.items.push('bag');
    this.pointerId = pointerId;
    this.sticky = false;
    this.openedAt = this.scene.time.now;
    this.centre = centre;
    this.left = leftHanded;
    this.hover = null;
    this.draw();
    this.root.setVisible(true).setAlpha(1);
    if (!s.settings.reduceMotion) {
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
    audio.play('ringOpen');
    haptic('tick');
  }

  close(): void {
    this.pointerId = null;
    this.sticky = false;
    if (this.catcher.input) this.catcher.input.enabled = false;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(false);
  }

  private draw(): void {
    const s = this.getState();
    const g = this.back;
    g.clear();
    this.bag.clear();
    g.fillStyle(CH.ink, 0.45).fillCircle(
      this.centre.x,
      this.centre.y,
      RING.radius + RING.itemR + 4,
    );
    this.icons.forEach((img) => img.setVisible(false));
    this.nums.forEach((l) => l.setVisible(false));
    const n = this.items.length;
    this.items.forEach((it, i) => {
      const c = ringItem(this.centre, i, n, this.left);
      const selected = it !== 'bag' && it === s.inventory.selected;
      g.fillStyle(CH.ink, 0.6).fillCircle(c.x, c.y + 1, RING.itemR + 1);
      g.fillStyle(CH.panel, 0.95).fillCircle(c.x, c.y, RING.itemR);
      g.lineStyle(selected ? 2 : 1, selected ? CH.gold : CH.cream, 0.8);
      g.strokeCircle(c.x, c.y, RING.itemR - 0.5);
      if (it === 'bag') return this.drawBag(c.x, c.y);
      const stack = s.inventory.slots[it]!;
      this.icons[it]!.setTexture(iconKey(refOf(stack)))
        .setPosition(c.x, c.y)
        .setVisible(true);
      this.nums[it]!.setPosition(c.x - RING.itemR + 2, c.y - RING.itemR + 1).setVisible(true);
    });
    this.drawHover();
  }

  /** A small sack (no atlas key yet; the UI skin may replace it). */
  private drawBag(x: number, y: number): void {
    const g = this.bag;
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
    const c = ringItem(this.centre, this.hover, this.items.length, this.left);
    g.lineStyle(3, CH.gold, 1).strokeCircle(c.x, c.y, RING.itemR + 3);
  }

  /** The arc position a finger at (x, y) points at, aim corrected for the thumb-base pull. */
  private pick(x: number, y: number): number | null {
    const c = compensateTouch(x, y, this.left, cssPerLogical(this.scene));
    return ringPick(c.x - this.centre.x, c.y - this.centre.y, this.items.length, this.left);
  }

  private choose(i: number): void {
    const it = this.items[i];
    this.close();
    if (it === undefined) {
      audio.play('ringClose');
      return;
    }
    audio.play('confirm');
    this.onChoose(it === 'bag' ? { kind: 'bag' } : { kind: 'slot', slot: it });
  }

  private move(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    const i = this.pick(p.x, p.y);
    if (i === this.hover) return;
    this.hover = i;
    this.hoverAt = this.scene.time.now;
    this.drawHover();
    if (i !== null) haptic('tick');
  }

  private up(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    this.pointerId = null;
    const now = this.scene.time.now;
    const i = this.pick(p.x, p.y);
    const rested = i !== null && i === this.hover && now - this.hoverAt >= RING_DWELL_MS;
    if (rested && now - this.openedAt >= RING_QUICK_MS) return this.choose(i);
    // A quick flick, or a lift without resting on an item: stay open as a tap menu.
    this.sticky = true;
    this.hover = null;
    this.drawHover();
    if (this.catcher.input) this.catcher.input.enabled = true;
  }

  /** Tap menu: a tap on an item picks it (a generous disc, aim corrected), a tap anywhere else closes. */
  private stickyTap(p: Phaser.Input.Pointer): void {
    if (!this.sticky) return;
    const c = compensateTouch(p.x, p.y, this.left, cssPerLogical(this.scene));
    const n = this.items.length;
    let best: { i: number; d: number } | null = null;
    for (let i = 0; i < n; i++) {
      const at = ringItem(this.centre, i, n, this.left);
      const d = Math.hypot(c.x - at.x, c.y - at.y);
      if (d <= RING.itemR + 6 && (!best || d < best.d)) best = { i, d };
    }
    if (best) this.choose(best.i);
    else {
      audio.play('ringClose');
      this.close();
    }
  }
}
