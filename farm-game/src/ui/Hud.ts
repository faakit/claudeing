import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { game, items } from '../data';
import { audio } from '../platform/audio';
import type { GameState } from '../state/GameState';
import { waterCapacity } from '../systems/actions';
import { maxEnergy } from '../systems/energy';
import { gameEvents } from '../systems/events';
import { goalProgress } from '../systems/goals';
import { selectedStack, selectSlot, isToolSlot } from '../systems/inventory';
import { formatClock, seasonLabel } from '../systems/time';
import { Label } from './font';
import { C } from './theme';
import { drawBar, drawPanel, drawSlot } from './widgets';

export const SLOT = 30;
const SLOT_GAP = 1;
export const HOTBAR_X = Math.round(
  (GAME_WIDTH - (game.hotbarSlots * (SLOT + SLOT_GAP) - SLOT_GAP)) / 2,
);
export const HOTBAR_Y = GAME_HEIGHT - SLOT - 6;

interface Toast {
  label: Label;
  text: string;
  born: number;
}

/** Always-on overlay: clock, gold, goal, energy/water, hotbar, toasts. Reads state only. */
export class Hud {
  private readonly timePanel: Phaser.GameObjects.Graphics;
  private readonly dateLabel: Label;
  private readonly timeLabel: Label;
  private readonly goldLabel: Label;
  private readonly coin: Phaser.GameObjects.Image;
  private shownMoney = -1;
  private readonly weatherIcon: Phaser.GameObjects.Image;

  private readonly goalGfx: Phaser.GameObjects.Graphics;
  private readonly goalLabel: Label;
  private readonly goalCount: Label;
  private goalKey = '';
  private meterKey = '';

  private readonly meters: Phaser.GameObjects.Graphics;
  private readonly energyLabel: Label;

  private readonly hotbarGfx: Phaser.GameObjects.Graphics;
  private hotbarIcons: Phaser.GameObjects.Image[] = [];
  private hotbarQty: Label[] = [];
  private readonly nameLabel: Label;
  private nameTween: Phaser.Tweens.Tween | null = null;
  private lastSelected = -1;
  private hotbarDirty = true;

  private toasts: Toast[] = [];
  private readonly savedLabel: Label;
  private readonly banner: Label;
  private cleanup: (() => void)[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getState: () => GameState,
  ) {
    const depth = 50;
    this.timePanel = scene.add.graphics().setDepth(depth);
    drawPanel(this.timePanel, 6, 6, 98, 36);
    drawPanel(this.timePanel, 6, 46, 70, 17);
    this.dateLabel = new Label(scene, 13, 12, '', { color: C.creamDim }).setDepth(depth + 1);
    this.timeLabel = new Label(scene, 13, 23, '', { scale: 2 }).setDepth(depth + 1);
    this.weatherIcon = scene.add.image(93, 15, 'ui_sun').setDepth(depth + 1);
    this.coin = scene.add.image(17, 55, 'ui_coin').setDepth(depth + 1);
    this.goldLabel = new Label(scene, 25, 51, '', { color: C.gold }).setDepth(depth + 1);

    this.goalGfx = scene.add.graphics().setDepth(depth);
    this.goalLabel = new Label(scene, 120, 12, '', { color: C.cream }).setDepth(depth + 1);
    this.goalCount = new Label(scene, 426, 26, '', { color: C.gold, align: 'right' }).setDepth(
      depth + 1,
    );

    this.meters = scene.add.graphics().setDepth(depth);
    scene.add.image(15, 176, 'ui_bolt').setDepth(depth + 1);
    scene.add.image(30, 176, 'ui_drop').setDepth(depth + 1);
    this.energyLabel = new Label(scene, 15, 254, '', { align: 'center', color: C.gold }).setDepth(
      depth + 1,
    );

    this.hotbarGfx = scene.add.graphics().setDepth(depth);
    this.nameLabel = new Label(scene, GAME_WIDTH / 2, HOTBAR_Y - 12, '', { align: 'center' })
      .setDepth(depth + 2)
      .setAlpha(0);
    for (let i = 0; i < game.hotbarSlots; i++) {
      const x = HOTBAR_X + i * (SLOT + SLOT_GAP);
      this.hotbarIcons.push(
        scene.add
          .image(x + SLOT / 2, HOTBAR_Y + SLOT / 2 + 1, 'ui_coin')
          .setDepth(depth + 1)
          .setVisible(false),
      );
      this.hotbarQty.push(
        new Label(scene, x + SLOT - 3, HOTBAR_Y + SLOT - 10, '', { align: 'right' }).setDepth(
          depth + 2,
        ),
      );
      new Label(scene, x + 4, HOTBAR_Y + 4, String(i + 1), { color: C.creamDim, shadow: null })
        .setDepth(depth + 2)
        .setAlpha(0.7);
      const zone = scene.add
        .zone(x, HOTBAR_Y, SLOT, SLOT)
        .setOrigin(0, 0)
        .setDepth(depth + 3)
        .setInteractive();
      zone.on('pointerdown', () => {
        selectSlot(this.getState(), i);
        audio.play('select');
      });
    }

    this.savedLabel = new Label(scene, GAME_WIDTH - 10, 46, 'Saved', {
      color: C.green,
      align: 'right',
    })
      .setDepth(depth + 1)
      .setAlpha(0);
    this.banner = new Label(scene, GAME_WIDTH / 2, 76, '', {
      color: C.gold,
      scale: 2,
      align: 'center',
    })
      .setDepth(depth + 5)
      .setAlpha(0);

    this.cleanup.push(
      gameEvents.on('toast', (t) => this.toast(t.text, t.kind)),
      gameEvents.on('inventoryChanged', () => (this.hotbarDirty = true)),
      gameEvents.on('energyChanged', () => (this.hotbarDirty = true)),
      gameEvents.on('saved', () => this.flashSaved()),
      gameEvents.on('goalCompleted', (g) => this.goalBanner(g.reward)),
    );
  }

  destroy(): void {
    this.cleanup.forEach((c) => c());
  }

  update(time: number): void {
    const s = this.getState();
    this.dateLabel.setText(`${seasonLabel(s.time.season)} ${s.time.day}  Y${s.time.year}`);
    this.timeLabel.setText(formatClock(s.time.minutes));
    this.weatherIcon.setTexture(s.weather === 'rain' ? 'ui_rain' : 'ui_sun');
    // Late-night warning: the clock turns orange then red as 02:00 nears.
    this.timeLabel.setColor(
      s.time.minutes >= 1500 ? C.red : s.time.minutes >= 1380 ? C.warn : C.cream,
    );

    if (this.shownMoney < 0) this.shownMoney = s.money;
    if (this.shownMoney !== s.money) {
      const diff = s.money - this.shownMoney;
      this.shownMoney += Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) * 0.12));
      if (Math.abs(s.money - this.shownMoney) < 1) this.shownMoney = s.money;
      this.coin.setScale(1 + 0.25 * Math.abs(Math.sin(time / 60)));
    } else this.coin.setScale(1);
    this.goldLabel.setText(String(this.shownMoney));

    this.drawGoal(s);
    this.drawMeters(s);
    if (this.hotbarDirty || s.inventory.selected !== this.lastSelected) this.drawHotbar(s);
    this.updateToasts(time);
  }

  // ---- goal tracker ----
  private drawGoal(s: GameState): void {
    const prog = goalProgress(s);
    const key = prog ? `${prog.goal.id}:${prog.value}` : 'done';
    if (key === this.goalKey) return;
    this.goalKey = key;
    this.goalGfx.clear();
    drawPanel(this.goalGfx, 112, 6, 322, 34);
    if (!prog) {
      this.goalLabel.setText('All goals complete! Enjoy your farm.').setColor(C.green);
      this.goalCount.setText('');
      return;
    }
    this.goalLabel.setText(prog.goal.text).setColor(C.cream);
    this.goalCount.setText(
      `${prog.value.toLocaleString('en-US')}/${prog.goal.target.toLocaleString('en-US')} +${prog.goal.reward.toLocaleString('en-US')}g`,
    );
    drawBar(this.goalGfx, 120, 27, 190, 5, prog.value / prog.goal.target, C.gold);
  }

  private goalBanner(reward: number): void {
    audio.play('goal');
    this.banner.setText(`GOAL COMPLETE  +${reward}g`).setAlpha(0).setY(84);
    this.scene.tweens.killTweensOf(this.banner);
    this.scene.tweens.add({
      targets: this.banner,
      alpha: 1,
      y: 76,
      duration: 220,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({ targets: this.banner, alpha: 0, y: 70, duration: 400, delay: 1700 });
  }

  // ---- energy & water ----
  private drawMeters(s: GameState): void {
    const key = `${s.energy}|${s.water}|${maxEnergy(s)}|${waterCapacity(s)}`;
    if (key === this.meterKey) return; // only redraw when a value changed
    this.meterKey = key;
    const e = s.energy / maxEnergy(s);
    const g = this.meters;
    g.clear();
    drawBar(g, 10, 184, 10, 66, e, e > 0.5 ? C.green : e > 0.2 ? C.warn : C.red, true);
    drawBar(g, 25, 184, 10, 66, s.water / waterCapacity(s), C.blue, true);
    this.energyLabel.setText(String(s.energy));
  }

  // ---- hotbar ----
  private drawHotbar(s: GameState): void {
    this.hotbarDirty = false;
    const g = this.hotbarGfx;
    g.clear();
    for (let i = 0; i < game.hotbarSlots; i++) {
      const x = HOTBAR_X + i * (SLOT + SLOT_GAP);
      const sel = i === s.inventory.selected;
      drawSlot(g, x, HOTBAR_Y - (sel ? 2 : 0), SLOT, sel);
      const stack = s.inventory.slots[i] ?? null;
      const icon = this.hotbarIcons[i]!;
      const qty = this.hotbarQty[i]!;
      if (stack) {
        icon
          .setTexture(items[stack.item]!.icon)
          .setVisible(true)
          .setY(HOTBAR_Y + SLOT / 2 + 1 - (sel ? 2 : 0));
        qty
          .setText(!isToolSlot(i) && stack.qty > 1 ? String(stack.qty) : '')
          .setY(HOTBAR_Y + SLOT - 10 - (sel ? 2 : 0));
      } else {
        icon.setVisible(false);
        qty.setText('');
      }
    }
    if (s.inventory.selected !== this.lastSelected) {
      this.lastSelected = s.inventory.selected;
      const stack = selectedStack(s);
      this.showName(stack ? items[stack.item]!.name : '');
    }
  }

  private showName(name: string): void {
    this.nameTween?.stop();
    this.nameLabel.setText(name).setAlpha(name ? 1 : 0);
    if (!name) return;
    this.nameTween = this.scene.tweens.add({
      targets: this.nameLabel,
      alpha: 0,
      delay: 1100,
      duration: 400,
    });
  }

  // ---- toasts ----
  toast(text: string, kind: 'info' | 'warn' | 'good' = 'info'): void {
    const now = this.scene.time.now;
    const dup = this.toasts.find((t) => t.text === text && now - t.born < 1400);
    if (dup) {
      dup.born = now; // keep it alive instead of stacking spam
      return;
    }
    const color = kind === 'warn' ? C.warn : kind === 'good' ? C.green : C.cream;
    const label = new Label(this.scene, GAME_WIDTH / 2, HOTBAR_Y - 28, text, {
      color,
      align: 'center',
    }).setDepth(80);
    this.toasts.push({ label, text, born: now });
    if (this.toasts.length > 3) this.toasts.shift()?.label.destroy();
  }

  private updateToasts(time: number): void {
    this.toasts = this.toasts.filter((t) => {
      const age = time - t.born;
      if (age > 2600) {
        t.label.destroy();
        return false;
      }
      t.label.setAlpha(age > 2000 ? 1 - (age - 2000) / 600 : 1);
      return true;
    });
    const baseY = HOTBAR_Y - 30;
    this.toasts.forEach((t, i) => {
      const target = baseY - (this.toasts.length - 1 - i) * 11;
      t.label.y += (target - t.label.y) * 0.3;
    });
  }

  private flashSaved(): void {
    this.scene.tweens.killTweensOf(this.savedLabel);
    this.savedLabel.setAlpha(1);
    this.scene.tweens.add({ targets: this.savedLabel, alpha: 0, delay: 900, duration: 500 });
  }
}
