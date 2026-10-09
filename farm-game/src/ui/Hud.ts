import Phaser from 'phaser';
import { DOCK_H, DOCK_Y, GAME_HEIGHT, GAME_WIDTH, HUD_H } from '../config';
import { game, npcs } from '../data';
import { audio } from '../platform/audio';
import { haptic } from '../platform/haptics';
import type { GameState } from '../state/GameState';
import { waterCapacity } from '../systems/actions';
import { maxEnergy } from '../systems/energy';
import { gameEvents } from '../systems/events';
import { goalProgress } from '../systems/goals';
import { isToolSlot, selectedStack, selectSlot } from '../systems/inventory';
import { formatClock, seasonLabel } from '../systems/time';
import { Label } from './font';
import { hitSize } from './hit';
import { CH, SEAM, SKIN } from './theme';
import { drawBar, drawPanel, drawSlot } from './widgets';
import { displayName, iconKey, refOf } from '../systems/itemRef';

/** Hotbar slot size: 23 logical px is ~45 CSS px on a typical phone, so taps land first time. */
export const SLOT = 23;
const SLOT_GAP = 1;
export const HOTBAR_X = Math.round(
  (GAME_WIDTH - (game.hotbarSlots * (SLOT + SLOT_GAP) - SLOT_GAP)) / 2,
);
export const HOTBAR_Y = GAME_HEIGHT - SLOT - 5;

interface Toast {
  label: Label;
  bg: Phaser.GameObjects.Rectangle;
  /** Walnut skin: the plate's lit top edge. */
  lit?: Phaser.GameObjects.Rectangle;
  text: string;
  born: number;
}

/**
 * Always-on overlay. Top: clock, gold, weather, energy/water, goal (read-only, out of thumb reach
 * on purpose). Bottom: the dock background and hotbar. Reads state only.
 */
export class Hud {
  private readonly dateLabel: Label;
  private readonly timeLabel: Label;
  private readonly goldLabel: Label;
  private readonly weatherLabel: Label;
  private readonly coin: Phaser.GameObjects.Image;
  private readonly weatherIcon: Phaser.GameObjects.Image;
  private shownMoney = -1;

  private readonly goalGfx: Phaser.GameObjects.Graphics;
  private readonly goalLabel: Label;
  private readonly goalCount: Label;
  private goalKey = '';

  private readonly meters: Phaser.GameObjects.Graphics;
  private meterKey = '';

  private readonly hotbarGfx: Phaser.GameObjects.Graphics;
  private hotbarIcons: Phaser.GameObjects.Image[] = [];
  private hotbarQty: Label[] = [];
  private hotbarStars: Phaser.GameObjects.Image[] = [];
  /** Gold has two stars and silver one, so quality reads by count, not only by tint. */
  private hotbarStars2: Phaser.GameObjects.Image[] = [];
  private hotbarZones: Phaser.GameObjects.Zone[] = [];
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
    // Static panels drawn once.
    const panels = scene.add.graphics().setDepth(depth);
    drawPanel(panels, 3, 2, 104, 32, undefined, undefined, 'chrome');
    drawPanel(panels, 110, 2, 87, 32, undefined, undefined, 'chrome');
    // Dock: solid so the world never shows through behind controls.
    if (SKIN === 'plum') {
      panels.fillStyle(CH.ink, 1).fillRect(0, DOCK_Y, GAME_WIDTH, DOCK_H);
      panels.fillStyle(CH.cream, 0.55).fillRect(0, DOCK_Y, GAME_WIDTH, 1);
      panels.fillStyle(CH.panelLight, 0.5).fillRect(0, DOCK_Y + 1, GAME_WIDTH, 1);
    } else {
      // Walnut dock (critic R1-1): full-width planks 14 px tall, each seam a 1 px ink line over a 1 px
      // highlight, and two small knots far from the controls; no grain behind anything you read.
      panels.fillStyle(CH.panel, 1).fillRect(0, DOCK_Y, GAME_WIDTH, DOCK_H);
      panels.fillStyle(CH.ink, 1).fillRect(0, DOCK_Y, GAME_WIDTH, 1);
      panels.fillStyle(CH.rim, 1).fillRect(0, DOCK_Y + 1, GAME_WIDTH, 1);
      for (let gy = DOCK_Y + 16; gy < GAME_HEIGHT - 2; gy += 14) {
        panels.fillStyle(SEAM.ink, 1).fillRect(0, gy, GAME_WIDTH, 1);
        panels.fillStyle(SEAM.lit, 1).fillRect(0, gy + 1, GAME_WIDTH, 1);
      }
      for (const [kx, ky] of [[182, GAME_HEIGHT - 8]] as const)
        panels
          .fillStyle(SEAM.knot, 1)
          .fillRect(kx, ky, 3, 2)
          .fillRect(kx + 1, ky - 1, 1, 1);
    }
    // Dark band above the world too, so the HUD reads as its own strip.
    panels.fillStyle(CH.ink, 1).fillRect(0, 0, GAME_WIDTH, 1);

    this.dateLabel = new Label(scene, 10, 5, '', { color: CH.creamDim }).setDepth(depth + 1);
    this.timeLabel = new Label(scene, 10, 14, '', { scale: 2 }).setDepth(depth + 1);
    this.coin = scene.add.image(121, 10, 'ui_coin').setDepth(depth + 1);
    this.goldLabel = new Label(scene, 130, 6, '', { color: CH.gold }).setDepth(depth + 1);
    this.weatherIcon = scene.add.image(121, 25, 'ui_sun').setDepth(depth + 1);
    this.weatherLabel = new Label(scene, 130, 21, '', { color: CH.creamDim }).setDepth(depth + 1);

    this.meters = scene.add.graphics().setDepth(depth);
    scene.add
      .image(10, 41, 'ui_bolt')
      .setScale(0.8)
      .setDepth(depth + 1);
    scene.add
      .image(107, 41, 'ui_drop')
      .setScale(0.8)
      .setDepth(depth + 1);

    this.goalGfx = scene.add.graphics().setDepth(depth);
    this.goalLabel = new Label(scene, 9, 52, '', { color: CH.cream }).setDepth(depth + 1);
    this.goalCount = new Label(scene, 191, 63, '', { color: CH.gold, align: 'right' }).setDepth(
      depth + 1,
    );

    this.hotbarGfx = scene.add.graphics().setDepth(depth);
    this.nameLabel = new Label(scene, GAME_WIDTH / 2, HOTBAR_Y - 11, '', { align: 'center' })
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
      this.hotbarStars.push(
        scene.add
          .image(x + 5, HOTBAR_Y + SLOT - 5, 'ui_star')
          .setDepth(depth + 2)
          .setVisible(false),
      );
      this.hotbarStars2.push(
        scene.add
          .image(x + 11, HOTBAR_Y + SLOT - 5, 'ui_star')
          .setDepth(depth + 2)
          .setTint(0xf4d35e)
          .setVisible(false),
      );
      this.hotbarQty.push(
        new Label(scene, x + SLOT - 2, HOTBAR_Y + SLOT - 9, '', { align: 'right' }).setDepth(
          depth + 2,
        ),
      );
      new Label(scene, x + 3, HOTBAR_Y + 2, String(i + 1), { color: CH.creamDim, shadow: null })
        .setDepth(depth + 2)
        .setAlpha(0.6);
      const zone = scene.add
        .zone(x, HOTBAR_Y, SLOT, SLOT)
        .setOrigin(0, 0)
        .setDepth(depth + 3)
        .setInteractive();
      this.hotbarZones.push(zone);
      zone.on('pointerdown', () => {
        selectSlot(this.getState(), i);
        audio.play('select');
        haptic('tick');
      });
    }

    this.savedLabel = new Label(scene, GAME_WIDTH - 5, HUD_H + 3, 'Saved', {
      color: CH.green,
      align: 'right',
    })
      .setDepth(depth + 1)
      .setAlpha(0);
    this.banner = new Label(scene, GAME_WIDTH / 2, HUD_H + 14, '', {
      color: CH.gold,
      align: 'center',
      maxWidth: 190,
    })
      .setDepth(depth + 5)
      .setAlpha(0);

    this.fitHotbarHits();
    scene.scale.on('resize', this.fitHotbarHits, this);
    this.cleanup.push(
      () => scene.scale.off('resize', this.fitHotbarHits, this),
      gameEvents.on('toast', (t) => this.toast(t.text, t.kind)),
      gameEvents.on('inventoryChanged', () => (this.hotbarDirty = true)),
      gameEvents.on('energyChanged', () => (this.hotbarDirty = true)),
      gameEvents.on('saved', () => this.flashSaved()),
      gameEvents.on('goalCompleted', (g) => this.goalBanner(`GOAL COMPLETE  +${g.reward}g`)),
      gameEvents.on('heartUp', (h) =>
        this.goalBanner(
          `${(npcs[h.id]?.name ?? h.id).toUpperCase()}: ${h.hearts} HEART${h.hearts > 1 ? 'S' : ''}!`,
        ),
      ),
      gameEvents.on('levelUp', (e) =>
        this.goalBanner(`${e.skill.toUpperCase()} LEVEL ${e.level}!`, 'medium'),
      ),
    );
  }

  /** Slots are 24px apart; grow each touch area up to that pitch so it reaches ~44 CSS px. */
  private fitHotbarHits(): void {
    const size = hitSize(this.scene, SLOT, SLOT + SLOT_GAP);
    const grow = (size - SLOT) / 2;
    this.hotbarZones.forEach((zone, i) => {
      const x = HOTBAR_X + i * (SLOT + SLOT_GAP);
      zone.setPosition(x - grow, HOTBAR_Y - grow).setSize(size, size);
      if (zone.input) zone.input.hitArea.setSize(size, size);
    });
  }

  destroy(): void {
    this.cleanup.forEach((c) => c());
  }

  update(time: number): void {
    const s = this.getState();
    this.dateLabel.setText(`${seasonLabel(s.time.season)} ${s.time.day}  Y${s.time.year}`);
    this.timeLabel.setText(formatClock(s.time.minutes));
    // Late-night warning: the clock turns orange then red as pass-out nears.
    this.timeLabel.setColor(
      s.time.minutes >= game.dayEndMinutes - 60
        ? CH.red
        : s.time.minutes >= game.dayEndMinutes - 180
          ? CH.warn
          : CH.cream,
    );
    const rainy = s.weather !== 'sunny';
    const weatherKey = rainy ? 'ui_rain' : 'ui_sun';
    if (this.weatherIcon.texture.key !== weatherKey) this.weatherIcon.setTexture(weatherKey);
    this.weatherLabel.setText(s.weather === 'storm' ? 'Storm' : rainy ? 'Rainy' : 'Sunny');

    if (this.shownMoney < 0) this.shownMoney = s.money;
    if (this.shownMoney !== s.money) {
      const diff = s.money - this.shownMoney;
      this.shownMoney += Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) * 0.12));
      if (Math.abs(s.money - this.shownMoney) < 1) this.shownMoney = s.money;
      this.coin.setScale(1 + 0.25 * Math.abs(Math.sin(time / 60)));
    } else this.coin.setScale(1);
    this.goldLabel.setText(this.shownMoney.toLocaleString('en-US'));

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
    drawPanel(this.goalGfx, 3, 48, 194, 25, undefined, undefined, 'chrome');
    if (!prog) {
      this.goalLabel.setText('All goals complete!').setColor(CH.green);
      this.goalCount.setText('');
      return;
    }
    this.goalLabel.setText(prog.goal.text).setColor(CH.cream);
    this.goalCount.setText(
      `${prog.value.toLocaleString('en-US')}/${prog.goal.target.toLocaleString('en-US')}`,
    );
    drawBar(this.goalGfx, 9, 65, 132, 4, prog.value / prog.goal.target, CH.gold);
  }

  /** A level-up is a medium pulse (owner decision 6); goals and hearts keep the success pattern. */
  private goalBanner(text: string, pulse: 'success' | 'medium' = 'success'): void {
    audio.play('goal');
    haptic(pulse);
    this.banner
      .setText(text)
      .setAlpha(0)
      .setY(HUD_H + 22);
    this.scene.tweens.killTweensOf(this.banner);
    this.scene.tweens.add({
      targets: this.banner,
      alpha: 1,
      y: HUD_H + 14,
      duration: 220,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: this.banner,
      alpha: 0,
      y: HUD_H + 8,
      duration: 400,
      delay: 1700,
    });
  }

  // ---- energy & water ----
  private drawMeters(s: GameState): void {
    const key = `${s.energy}|${s.water}|${maxEnergy(s)}|${waterCapacity(s)}`;
    if (key === this.meterKey) return; // only redraw when a value changed
    this.meterKey = key;
    const e = s.energy / maxEnergy(s);
    const g = this.meters;
    g.clear();
    drawBar(g, 17, 37, 80, 8, e, e > 0.5 ? CH.green : e > 0.2 ? CH.warn : CH.red);
    drawBar(g, 114, 37, 80, 8, s.water / waterCapacity(s), CH.blue);
  }

  // ---- hotbar ----
  private drawHotbar(s: GameState): void {
    this.hotbarDirty = false;
    const g = this.hotbarGfx;
    g.clear();
    for (let i = 0; i < game.hotbarSlots; i++) {
      const x = HOTBAR_X + i * (SLOT + SLOT_GAP);
      const sel = i === s.inventory.selected;
      drawSlot(g, x, HOTBAR_Y - (sel ? 2 : 0), SLOT, sel, false, 'chrome');
      const stack = s.inventory.slots[i] ?? null;
      const icon = this.hotbarIcons[i]!;
      const qty = this.hotbarQty[i]!;
      const star = this.hotbarStars[i]!;
      const star2 = this.hotbarStars2[i]!;
      const lift = sel ? 2 : 0;
      if (stack) {
        const ref = refOf(stack);
        icon
          .setTexture(iconKey(ref))
          .setVisible(true)
          .setY(HOTBAR_Y + SLOT / 2 + 1 - lift);
        qty
          .setText(!isToolSlot(i) && stack.qty > 1 ? String(stack.qty) : '')
          .setY(HOTBAR_Y + SLOT - 9 - lift);
        const q = ref.q ?? 0;
        star
          .setVisible(q > 0)
          .setTint(q >= 2 ? 0xf4d35e : 0xc9d3e4)
          .setY(HOTBAR_Y + SLOT - 5 - lift);
        star2.setVisible(q >= 2).setY(HOTBAR_Y + SLOT - 5 - lift);
      } else {
        icon.setVisible(false);
        qty.setText('');
        star.setVisible(false);
        star2.setVisible(false);
      }
    }
    if (s.inventory.selected !== this.lastSelected) {
      this.lastSelected = s.inventory.selected;
      const stack = selectedStack(s);
      this.showName(stack ? displayName(refOf(stack)) : '');
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
    // walnut (critic R0-3): parchment text with its ink shadow on a walnut plate; gold only to stress a warning
    const color =
      SKIN === 'plum'
        ? kind === 'warn'
          ? CH.warn
          : kind === 'good'
            ? CH.green
            : CH.cream
        : kind === 'warn'
          ? CH.gold
          : CH.cream;
    const label = new Label(this.scene, GAME_WIDTH / 2, DOCK_Y - 14, text, {
      color,
      align: 'center',
      maxWidth: 186,
    }).setDepth(80);
    // A dark pill behind the text keeps it readable over grass, sand and snow.
    const bg = this.scene.add
      .rectangle(
        label.x,
        label.y,
        label.textWidth + 10,
        label.textHeight + 5,
        SKIN === 'plum' ? CH.ink : CH.panel,
        SKIN === 'plum' ? 0.72 : 0.95,
      )
      .setDepth(79);
    let lit: Phaser.GameObjects.Rectangle | undefined;
    if (SKIN !== 'plum') {
      bg.setStrokeStyle(1, CH.ink);
      // the plate's lit top edge
      lit = this.scene.add
        .rectangle(
          label.x,
          label.y - (label.textHeight + 5) / 2 + 1,
          label.textWidth + 8,
          1,
          CH.rim,
        )
        .setDepth(79.5);
    }
    this.toasts.push({ label, bg, lit, text, born: now });
    if (this.toasts.length > 3) {
      const old = this.toasts.shift();
      old?.label.destroy();
      old?.bg.destroy();
      old?.lit?.destroy();
    }
  }

  private updateToasts(time: number): void {
    this.toasts = this.toasts.filter((t) => {
      const age = time - t.born;
      if (age > 2800) {
        t.label.destroy();
        t.bg.destroy();
        t.lit?.destroy();
        return false;
      }
      const a = age > 2200 ? 1 - (age - 2200) / 600 : 1;
      t.label.setAlpha(a);
      t.bg.setAlpha((SKIN === 'plum' ? 0.72 : 1) * a); // walnut: an opaque plate, never a grey veil
      t.lit?.setAlpha(a);
      return true;
    });
    // Newest sits on the bottom; older ones stack upward by their real (wrapped) height.
    let y = DOCK_Y - 6;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i]!;
      y -= t.label.textHeight + 2;
      t.label.y += (y - t.label.y) * 0.3;
      t.bg
        .setPosition(t.label.x, t.label.y + t.label.textHeight / 2)
        .setSize(t.label.textWidth + 10, t.label.textHeight + 5);
      t.lit
        ?.setPosition(t.bg.x, Math.round(t.bg.y - t.bg.height / 2) + 1)
        .setSize(t.bg.width - 2, 1);
    }
  }

  private flashSaved(): void {
    this.scene.tweens.killTweensOf(this.savedLabel);
    this.savedLabel.setAlpha(1);
    this.scene.tweens.add({ targets: this.savedLabel, alpha: 0, delay: 900, duration: 500 });
  }
}
