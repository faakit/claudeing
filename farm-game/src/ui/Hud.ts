import Phaser from 'phaser';
import { CONTROLS_Y, GAME_HEIGHT, GAME_WIDTH, HUD_H } from '../config';
import { game, npcs, skills } from '../data';
import { fmtGold, fmtNum, t } from '../i18n';
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
import { HOTBAR, HOTBAR_HIT_Y, HOTBAR_Y, hotbarSlotX, PLATE_LIP } from './layout';
import { CH, SKIN } from './theme';
import { drawBar, drawPanel, drawSlot } from './widgets';
import { displayName, iconKey, refOf } from '../systems/itemRef';
import { runtime } from '../state/runtime';
import { tickToward } from '../fx/feel';
import { showBanner } from '../fx/hudBand';
import { valleyStep } from '../systems/valley';

/**
 * The floating hotbar (geometry in ui/layout.ts `HOTBAR`): 22 px slot faces on a 24 px pitch, each on a solid 2 px
 * soil lip, hugging the bottom edge with no band behind them. Every slot's touch zone is the whole pitch wide and runs
 * from just above the faces to the bottom edge (24 x 27 px: 45.8 x 51.5 CSS px on the iPhone 13, 38.8 x 43.7 on the
 * SE), so the zones meet and a tap on the row never falls through to the world.
 */
export const SLOT = HOTBAR.slot;
export const SLOT_PITCH = HOTBAR.pitch;
export const HOTBAR_X = hotbarSlotX(0, game.hotbarSlots);
export { HOTBAR_Y };

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
 * on purpose). Bottom: the floating hotbar, over the world. Reads state only.
 */
/** Toasts on screen at once: a third pushes the oldest out (a tap's results never pile over the world). */
export const MAX_TOASTS = 2;
/** The goal toast that the GOAL COMPLETE banner replaces (its text up to the gold, in the current language). */
const isGoalToast = (text: string): boolean => text.startsWith(t('goals.completeToast', { gold: '' }));

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
  /** Energy and water as shown: they tick toward the real values (whole bar pixels). */
  private shownEnergy = -1;
  private shownWater = -1;
  /** The hotbar's selection rise: when it changed, and which slot it left. */
  private selAt = -1e9;
  private selFrom = -1;
  private coinHopAt = -1e9;

  private readonly hotbarGfx: Phaser.GameObjects.Graphics;
  private hotbarIcons: Phaser.GameObjects.Image[] = [];
  private hotbarQty: Label[] = [];
  private hotbarStars: Phaser.GameObjects.Image[] = [];
  /** Gold has two stars and silver one, so quality reads by count, not only by tint. */
  private hotbarStars2: Phaser.GameObjects.Image[] = [];
  private hotbarZones: Phaser.GameObjects.Zone[] = [];
  private readonly nameLabel: Label;
  /** The item name's solid plate: it floats over the world just above the controls, so it needs its own ground. */
  private readonly nameBg: Phaser.GameObjects.Rectangle;
  private nameTimer: Phaser.Time.TimerEvent | null = null;
  private lastSelected = -1;
  private hotbarDirty = true;

  private toasts: Toast[] = [];
  private readonly savedLabel: Label;
  private readonly banner: Label;
  /** The valley's own moments (the first green): two lines, a slot apart from goal and heart banners. */
  private readonly moment: Label;
  private readonly momentTitle: Label;
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
    // No dock band any more (owner, 2026-10-11: "it still feels big"): the world runs to the bottom edge and the
    // controls float on their own plates (DECISIONS.md "Floating controls").
    // A dark line along the top, so the HUD reads as its own strip.
    panels.fillStyle(CH.ink, 1).fillRect(0, 0, GAME_WIDTH, 1);

    this.dateLabel = new Label(scene, 10, 5, '', { color: CH.creamDim }).setDepth(depth + 1);
    this.timeLabel = new Label(scene, 10, 14, '', { scale: 2 }).setDepth(depth + 1);
    this.coin = scene.add.image(121, 10, 'ui_coin').setDepth(depth + 1);
    this.goldLabel = new Label(scene, 130, 6, '', { color: CH.gold }).setDepth(depth + 1);
    this.weatherIcon = scene.add.image(121, 25, 'ui_sun').setDepth(depth + 1);
    this.weatherLabel = new Label(scene, 130, 21, '', { color: CH.creamDim }).setDepth(depth + 1);

    this.meters = scene.add.graphics().setDepth(depth);
    // 1x: a 0.8 scale dropped a row and a column of the icons' pixels
    scene.add.image(10, 41, 'ui_bolt').setDepth(depth + 1);
    scene.add.image(107, 41, 'ui_drop').setDepth(depth + 1);

    this.goalGfx = scene.add.graphics().setDepth(depth);
    this.goalLabel = new Label(scene, 9, 52, '', { color: CH.cream }).setDepth(depth + 1);
    this.goalCount = new Label(scene, 191, 63, '', { color: CH.gold, align: 'right' }).setDepth(
      depth + 1,
    );

    this.hotbarGfx = scene.add.graphics().setDepth(depth);
    // The selected item's name, in the toast lane just above the controls (on the old dock it sat over Interact).
    this.nameLabel = new Label(scene, GAME_WIDTH / 2, CONTROLS_Y - 15, '', { align: 'center' })
      .setDepth(80)
      .setAlpha(0);
    this.nameBg = scene.add
      .rectangle(GAME_WIDTH / 2, CONTROLS_Y - 12, 10, 10, SKIN === 'plum' ? CH.ink : CH.panel, 1)
      .setDepth(79)
      .setAlpha(0);
    if (SKIN !== 'plum') this.nameBg.setStrokeStyle(1, CH.ink);
    for (let i = 0; i < game.hotbarSlots; i++) {
      const x = HOTBAR_X + i * SLOT_PITCH;
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
      // The whole pitch wide, from just above the faces to the bottom edge: the zones meet, so no tap on the row
      // reaches the world, and the 2 px under the lips still pick the slot.
      const zone = scene.add
        .zone(x - (SLOT_PITCH - SLOT) / 2, HOTBAR_HIT_Y, SLOT_PITCH, GAME_HEIGHT - HOTBAR_HIT_Y)
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

    this.savedLabel = new Label(scene, GAME_WIDTH - 5, HUD_H + 3, t('hud.saved'), {
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
    this.momentTitle = new Label(scene, GAME_WIDTH / 2, HUD_H + 34, '', {
      color: CH.gold,
      align: 'center',
      scale: 2,
    })
      .setDepth(depth + 5)
      .setAlpha(0);
    this.moment = new Label(scene, GAME_WIDTH / 2, HUD_H + 56, '', {
      color: CH.cream,
      align: 'center',
      maxWidth: 190,
    })
      .setDepth(depth + 5)
      .setAlpha(0);

    this.cleanup.push(
      gameEvents.on('toast', (t) => this.toast(t.text, t.kind)),
      gameEvents.on('inventoryChanged', () => (this.hotbarDirty = true)),
      gameEvents.on('energyChanged', () => (this.hotbarDirty = true)),
      gameEvents.on('saved', () => this.flashSaved()),
      gameEvents.on('goalCompleted', (g) =>
        this.goalBanner(t('hud.goalComplete', { gold: fmtGold(g.reward) })),
      ),
      gameEvents.on('heartUp', (h) =>
        this.goalBanner(
          t('hud.hearts', { name: (npcs[h.id]?.name ?? h.id).toUpperCase(), count: h.hearts }),
        ),
      ),
      // The first green: the banner with the special-order fanfare until audio gives it its own jingle.
      gameEvents.on('valleyMoment', (m) => this.valleyMoment(m.text)),
      gameEvents.on('levelUp', (e) =>
        this.goalBanner(
          t('hud.levelUp', {
            skill: (skills[e.skill]?.name ?? e.skill).toUpperCase(),
            level: e.level,
          }),
          'medium',
        ),
      ),
    );
  }

  destroy(): void {
    this.cleanup.forEach((c) => c());
  }

  /** After a language change: redraw every cached text on the next update. */
  relocalize(): void {
    this.goalKey = '';
    this.goldLabel.setText('');
    this.savedLabel.setText(t('hud.saved'));
    this.lastSelected = -1;
    this.hotbarDirty = true;
  }

  update(time: number, dt: number): void {
    const s = this.getState();
    this.dateLabel.setText(
      t('hud.date', { season: seasonLabel(s.time.season), day: s.time.day, year: s.time.year }),
    );
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
    this.weatherLabel.setText(
      t(s.weather === 'storm' ? 'hud.storm' : rainy ? 'hud.rainy' : 'hud.sunny'),
    );

    if (this.shownMoney < 0) this.shownMoney = s.money;
    if (this.shownMoney !== s.money) {
      // Gold ticks toward its new value (frame-rate independent); the coin hops a pixel as it counts.
      this.shownMoney = tickToward(this.shownMoney, s.money, dt);
      if (time - this.coinHopAt > 180) this.coinHopAt = time;
      this.goldLabel.setText(fmtNum(this.shownMoney));
    } else if (this.goldLabel.text === '') this.goldLabel.setText(fmtNum(s.money));
    this.coin.setY(time - this.coinHopAt < 90 ? 9 : 10);

    this.drawGoal(s);
    this.drawMeters(s, dt);
    const rising = time - this.selAt < 120;
    if (this.hotbarDirty || rising || s.inventory.selected !== this.lastSelected)
      this.drawHotbar(s);
    this.updateToasts(time, dt);
  }

  // ---- goal tracker ----
  private drawGoal(s: GameState): void {
    // A valley step that can be done today comes first (WORLD-PLAN 2, "On the HUD"), else the goal chain.
    const step = valleyStep(s);
    const prog = goalProgress(s);
    const key = step ? `valley:${step.text}` : prog ? `${prog.goal.id}:${prog.value}` : 'done';
    if (key === this.goalKey) return;
    this.goalKey = key;
    this.goalGfx.clear();
    drawPanel(this.goalGfx, 3, 48, 194, 25, undefined, undefined, 'chrome');
    if (step) {
      this.goalLabel.setText(step.text).setColor(CH.cream);
      this.goalCount.setText(step.count ? `${step.count[0]}/${step.count[1]}` : '');
      if (step.count) drawBar(this.goalGfx, 9, 65, 132, 4, step.count[0] / step.count[1], CH.gold);
      return;
    }
    if (!prog) {
      this.goalLabel.setText(t('hud.allGoals')).setColor(CH.green);
      this.goalCount.setText('');
      return;
    }
    this.goalLabel.setText(prog.goal.text).setColor(CH.cream);
    this.goalCount.setText(`${fmtNum(prog.value)}/${fmtNum(prog.goal.target)}`);
    drawBar(this.goalGfx, 9, 65, 132, 4, prog.value / prog.goal.target, CH.gold);
  }

  /**
   * The first green: a big gold title and a line under it, in their own slot (never the goal banner's), held about
   * three seconds while the straw dissolves. Every valley moment plays the same jingle: the valley coming back.
   */
  private valleyMoment(text: string): void {
    const [title, line] = text.split('\n');
    audio.play('green');
    haptic('success');
    showBanner(3400);
    const calm = this.getState().settings.reduceMotion;
    this.momentTitle.setText(title ?? '');
    this.moment.setText(line ?? '');
    for (const [l, y] of [
      [this.momentTitle, HUD_H + 34],
      [this.moment, HUD_H + 56],
    ] as const) {
      this.scene.tweens.killTweensOf(l);
      l.setAlpha(0).setY(y + (calm ? 0 : 6));
      const round = () => l.setY(Math.round(l.y));
      this.scene.tweens.add({ targets: l, alpha: 1, y, duration: 400, onUpdate: round });
      this.scene.tweens.add({ targets: l, alpha: 0, duration: 500, delay: 2900 });
    }
  }

  /** A level-up is a medium pulse (owner decision 6); goals and hearts keep the success pattern. */
  private goalBanner(
    text: string,
    pulse: 'success' | 'medium' = 'success',
    cue: 'goal' | 'special' = 'goal',
  ): void {
    audio.play(cue);
    haptic(pulse);
    showBanner(2100); // world pickup lines keep clear of it (fx/hudBand.ts)
    // Rises in and out in whole pixels; Calm mode only fades it.
    const calm = this.getState().settings.reduceMotion;
    this.banner
      .setText(text)
      .setAlpha(0)
      .setY(HUD_H + (calm ? 14 : 22));
    this.scene.tweens.killTweensOf(this.banner);
    const round = () => this.banner.setY(Math.round(this.banner.y));
    this.scene.tweens.add({
      targets: this.banner,
      alpha: 1,
      y: HUD_H + 14,
      duration: 220,
      ease: 'Back.easeOut',
      onUpdate: round,
    });
    this.scene.tweens.add({
      targets: this.banner,
      alpha: 0,
      y: HUD_H + (calm ? 14 : 8),
      duration: 400,
      delay: 1700,
      onUpdate: round,
    });
  }

  // ---- energy & water ----
  /**
   * Energy and water bars. The fills tick toward their new length a whole pixel at a time instead of jumping
   * (frame-rate independent, about a fifth of a second for a big change).
   */
  private drawMeters(s: GameState, dt: number): void {
    const maxE = maxEnergy(s);
    const capW = waterCapacity(s);
    const FILL = 78; // inner bar width in px
    const wantE = Math.round((FILL * Math.max(0, Math.min(maxE, s.energy))) / maxE);
    const wantW = Math.round((FILL * Math.max(0, Math.min(capW, s.water))) / capW);
    if (this.shownEnergy < 0) this.shownEnergy = wantE;
    if (this.shownWater < 0) this.shownWater = wantW;
    this.shownEnergy = tickToward(this.shownEnergy, wantE, dt, 0.25);
    this.shownWater = tickToward(this.shownWater, wantW, dt, 0.25);
    const e = s.energy / maxE;
    const key = `${this.shownEnergy}|${this.shownWater}|${e > 0.5 ? 2 : e > 0.2 ? 1 : 0}`;
    if (key === this.meterKey) return; // only redraw when a shown value changed
    this.meterKey = key;
    const g = this.meters;
    g.clear();
    drawBar(
      g,
      17,
      37,
      80,
      8,
      this.shownEnergy / FILL,
      e > 0.5 ? CH.green : e > 0.2 ? CH.warn : CH.red,
    );
    drawBar(g, 114, 37, 80, 8, this.shownWater / FILL, CH.blue);
  }

  // ---- hotbar ----
  private drawHotbar(s: GameState): void {
    this.hotbarDirty = false;
    const g = this.hotbarGfx;
    g.clear();
    const now = this.scene.time.now;
    if (s.inventory.selected !== this.lastSelected && this.lastSelected >= 0) {
      this.selAt = now;
      this.selFrom = this.lastSelected;
    }
    // The selected slot rises 2 px in two whole steps; the one it left sinks the same way (Calm: at once).
    const calm = this.getState().settings.reduceMotion;
    const t = now - this.selAt;
    const half = !calm && t < 60;
    for (let i = 0; i < game.hotbarSlots; i++) {
      const x = HOTBAR_X + i * SLOT_PITCH;
      const sel = i === s.inventory.selected;
      const lift = sel ? (half ? 1 : 2) : i === this.selFrom && half ? 1 : 0;
      // A solid soil lip under the face (its sides in ink), so each slot is its own little plate over any ground; a
      // rising face shows more of it (the selected slot stands on 4 px of lip).
      const lipY = HOTBAR_Y + SLOT - lift;
      g.fillStyle(CH.ink, 1).fillRect(x, lipY, SLOT, PLATE_LIP + lift);
      g.fillStyle(CH.panelLight, 1).fillRect(x + 1, lipY, SLOT - 2, PLATE_LIP + lift);
      drawSlot(g, x, HOTBAR_Y - lift, SLOT, sel, false, 'chrome');
      const stack = s.inventory.slots[i] ?? null;
      const icon = this.hotbarIcons[i]!;
      const qty = this.hotbarQty[i]!;
      const star = this.hotbarStars[i]!;
      const star2 = this.hotbarStars2[i]!;
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

  /**
   * The selected item's name on a solid plate at the bottom of the toast lane (toasts stack above it while it shows).
   * It goes in one step after 1.5 s: a fading plate over the world would be see-through.
   */
  private showName(name: string): void {
    this.nameTimer?.remove();
    this.nameTimer = null;
    const l = this.nameLabel.setText(name).setAlpha(name ? 1 : 0);
    l.setY(CONTROLS_Y - 6 - l.textHeight - 2);
    this.nameBg
      .setPosition(l.x, l.y + l.textHeight / 2)
      .setSize(l.textWidth + 10, l.textHeight + 5)
      .setAlpha(name ? 1 : 0);
    if (!name) return;
    this.nameTimer = this.scene.time.delayedCall(1500, () => {
      this.nameLabel.setAlpha(0);
      this.nameBg.setAlpha(0);
    });
  }

  /** Bottom of the toast lane: just above the floating controls, and above the item name while it shows. */
  private laneBottom(): number {
    const y = CONTROLS_Y - 6;
    return this.nameLabel.alpha > 0 ? y - this.nameLabel.textHeight - 5 : y;
  }

  /**
   * A hook that may take a message instead of a toast (returns true when it did): while the guided start shows a
   * coach line, refusals appear there, so there is only ever one instruction on screen.
   */
  intercept: ((text: string, kind: 'info' | 'warn' | 'good') => boolean) | null = null;

  // ---- toasts ----
  toast(text: string, kind: 'info' | 'warn' | 'good' = 'info'): void {
    if (this.intercept?.(text, kind)) return;
    // the goal banner already says it (critic, valley review 4: one tap stacked the banner and two toasts)
    if (isGoalToast(text)) return;
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
    const label = new Label(this.scene, GAME_WIDTH / 2, CONTROLS_Y - 14, text, {
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
    if (this.toasts.length > MAX_TOASTS) {
      const old = this.toasts.shift();
      old?.label.destroy();
      old?.bg.destroy();
      old?.lit?.destroy();
    }
  }

  private updateToasts(time: number, dt: number): void {
    this.toasts = this.toasts.filter((t) => {
      const age = time - t.born;
      if (age > 2800) {
        t.label.destroy();
        t.bg.destroy();
        t.lit?.destroy();
        return false;
      }
      // Eases in over 140 ms (fade, and a 4 px rise below), out over 600 ms.
      const a = age > 2200 ? 1 - (age - 2200) / 600 : Math.min(1, age / 140);
      t.label.setAlpha(a);
      t.bg.setAlpha((SKIN === 'plum' ? 0.72 : 1) * a); // walnut: an opaque plate, never a grey veil
      t.lit?.setAlpha(a);
      return true;
    });
    // Newest sits on the bottom; older ones stack upward by their real (wrapped) height. While a sheet is open
    // the toasts move to the top of the screen, above the dim, so a sheet's own results ("Kept 4 Potato for the
    // board.", "Order done!") are seen when they happen (critique 10, F1).
    const sheet = runtime.modals > 0;
    let y = sheet ? 4 : this.laneBottom();
    if (sheet) for (const t of this.toasts) y += t.label.textHeight + 2;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i]!;
      y -= t.label.textHeight + 2;
      t.label.setDepth(sheet ? 232 : 80);
      t.bg.setDepth(sheet ? 231 : 79);
      t.lit?.setDepth(sheet ? 231.5 : 79.5);
      const born = time - t.born < 140 && !sheet && !this.getState().settings.reduceMotion;
      const target = born ? y + Math.round(4 * (1 - (time - t.born) / 140)) : y;
      // Older toasts glide up as a new one arrives, a whole pixel at a time, never stalling short.
      t.label.y = sheet ? target : tickToward(Math.round(t.label.y), target, dt, 0.3);
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
