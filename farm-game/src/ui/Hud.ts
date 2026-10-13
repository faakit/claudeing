import Phaser from 'phaser';
import { CONTROLS_Y, GAME_HEIGHT, GAME_WIDTH, HUD_H } from '../config';
import { game, npcs, skills } from '../data';
import { fmtGold, fmtNum, t } from '../i18n';
import { audio, SFX_IDS, type Sfx } from '../platform/audio';
import { haptic } from '../platform/haptics';
import type { GameState, ItemStack } from '../state/GameState';
import { waterCapacity } from '../systems/actions';
import { maxEnergy } from '../systems/energy';
import { gameEvents, type ToastKind } from '../systems/events';
import { readMs, STICKY_TOASTS } from './readTime';
import { goalProgress } from '../systems/goals';
import { isToolSlot, selectedStack, selectSlot } from '../systems/inventory';
import { formatClock, seasonLabel } from '../systems/time';
import { Label } from './font';
import { HOTBAR, HOTBAR_HIT_Y, HOTBAR_Y, hotbarSlotX, PLATE_LIP } from './layout';
import { cellOfSlot, HOTBAR_CELLS, hotbarCells, nextTool, toolGroup } from './hotbarCells';
import { CH, SKIN } from './theme';
import { drawBar, drawPanel, drawSlot } from './widgets';
import { displayName, iconKey, refOf } from '../systems/itemRef';
import { runtime } from '../state/runtime';
import { tickToward } from '../fx/feel';
import { showBanner } from '../fx/hudBand';
import { valleyStep } from '../systems/valley';

/**
 * The floating hotbar (geometry in ui/layout.ts `HOTBAR`, cells in ui/hotbarCells.ts): five 38 x 24 px cell faces on
 * a 40 px pitch, each on a solid 2 px soil lip, hugging the bottom edge with no band behind them. Every cell's touch
 * zone is the whole pitch wide and runs from just above the faces to the bottom edge (40 x 29 px: 76.3 x 55.3 CSS px
 * on the iPhone 13, 64.7 x 46.9 on the SE), so the zones meet and a tap on the row never falls through to the world.
 */
export const SLOT = HOTBAR.slot;
export const SLOT_W = HOTBAR.w;
export const SLOT_PITCH = HOTBAR.pitch;
export const HOTBAR_X = hotbarSlotX(0, HOTBAR_CELLS);
export { HOTBAR_Y };

/** The centre of the cell a hotbar slot is drawn in (the coach's slot pointer), or null for a bag slot. */
export function hotbarSlotCentre(
  slot: number,
  slots: readonly (ItemStack | null | undefined)[],
): { x: number; y: number } | null {
  const cell = cellOfSlot(slot, slots);
  return cell < 0 ? null : { x: HOTBAR_X + cell * SLOT_PITCH + SLOT_W / 2, y: HOTBAR_Y + SLOT / 2 };
}

interface Toast {
  label: Label;
  bg: Phaser.GameObjects.Rectangle;
  /** Walnut skin: the plate's lit top edge. */
  lit?: Phaser.GameObjects.Rectangle;
  text: string;
  born: number;
  /** On screen this long (its reading time, `readMs`), then a 600 ms fade; a sticky one waits for a touch. */
  life: number;
  /** Its reading time (a sticky toast's life grows past it until a touch after it). */
  read: number;
  sticky: boolean;
  /** A first-time tip waits while a sheet is open. */
  tip: boolean;
}

/**
 * Always-on overlay. Top: clock, gold, weather, energy/water, goal (read-only, out of thumb reach
 * on purpose). Bottom: the floating hotbar, over the world. Reads state only.
 */
/**
 * Toasts on screen at once (a tap's results never pile over the world). A fourth waits in a queue and shows when
 * one has gone: a new toast never cuts one off mid-read (owner: "a few dialogs are too quick to read").
 */
export const MAX_TOASTS = 3;
/** Px between stacked toast plates (a plate is its text's height + 5). */
const TOAST_GAP = 2;
/** A toast fades out over this long at the end of its life. */
const TOAST_FADE_MS = 600;
/** The goal toast that the GOAL COMPLETE banner replaces (its text up to the gold, in the current language). */
const isGoalToast = (text: string): boolean =>
  text.startsWith(t('goals.completeToast', { gold: '' }));

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
  /** The hotbar slot each cell shows (ui/hotbarCells.ts), refreshed on every draw. */
  cells: number[] = [];
  /** The tool the tool cell shows while no tool is selected (the last one picked). */
  private toolPick = 0;
  /** The can's water when the hotbar was last drawn (its level is drawn on the can's cell). */
  private drawnWater = -1;
  private readonly nameLabel: Label;
  /** The item name's solid plate: it floats over the world just above the controls, so it needs its own ground. */
  private readonly nameBg: Phaser.GameObjects.Rectangle;
  private nameTimer: Phaser.Time.TimerEvent | null = null;
  private lastSelected = -1;
  private hotbarDirty = true;

  private toasts: Toast[] = [];
  private readonly savedLabel: Label;
  private readonly banner: Label;
  /** The goal banner's solid walnut plate (gold on the bare world read low on straw and sand). */
  private readonly bannerPlate: Phaser.GameObjects.Graphics;
  /** The valley's own moments (the first green): two lines, a slot apart from goal and heart banners. */
  private readonly moment: Label;
  private readonly momentTitle: Label;
  /** The solid walnut plate behind a valley moment's banner (drawn per moment, it fits the text). */
  private readonly momentPlate: Phaser.GameObjects.Graphics;
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

    this.dateLabel = new Label(scene, 10, 4, '', { color: CH.creamDim }).setDepth(depth + 1);
    this.timeLabel = new Label(scene, 10, 16, '', { scale: 2 }).setDepth(depth + 1);
    this.coin = scene.add.image(121, 10, 'ui_coin').setDepth(depth + 1);
    this.goldLabel = new Label(scene, 130, 5, '', { color: CH.gold }).setDepth(depth + 1);
    this.weatherIcon = scene.add.image(121, 25, 'ui_sun').setDepth(depth + 1);
    this.weatherLabel = new Label(scene, 130, 20, '', { color: CH.creamDim }).setDepth(depth + 1);

    this.meters = scene.add.graphics().setDepth(depth);
    // 1x: a 0.8 scale dropped a row and a column of the icons' pixels
    scene.add.image(10, 41, 'ui_bolt').setDepth(depth + 1);
    scene.add.image(107, 41, 'ui_drop').setDepth(depth + 1);

    this.goalGfx = scene.add.graphics().setDepth(depth);
    this.goalLabel = new Label(scene, 9, 51, '', { color: CH.cream }).setDepth(depth + 1);
    this.goalCount = new Label(scene, 191, 62, '', { color: CH.gold, align: 'right' }).setDepth(
      depth + 1,
    );

    this.hotbarGfx = scene.add.graphics().setDepth(depth);
    // The selected item's name, in the toast lane just above the controls (on the old dock it sat over Interact).
    // Parchment with its ink shadow on the walnut plate (owner: the default ink read black on dark wood).
    this.nameLabel = new Label(scene, GAME_WIDTH / 2, CONTROLS_Y - 15, '', {
      align: 'center',
      color: CH.cream,
    })
      .setDepth(80)
      .setAlpha(0);
    this.nameBg = scene.add
      .rectangle(GAME_WIDTH / 2, CONTROLS_Y - 12, 10, 10, SKIN === 'plum' ? CH.ink : CH.panel, 1)
      .setDepth(79)
      .setAlpha(0);
    if (SKIN !== 'plum') this.nameBg.setStrokeStyle(1, CH.ink);
    for (let i = 0; i < HOTBAR_CELLS; i++) {
      const x = HOTBAR_X + i * SLOT_PITCH;
      this.hotbarIcons.push(
        scene.add
          .image(x + SLOT_W / 2, HOTBAR_Y + SLOT / 2, 'ui_coin')
          .setDepth(depth + 1)
          .setVisible(false),
      );
      this.hotbarStars.push(
        scene.add
          .image(x + SLOT_W - 5, HOTBAR_Y + 5, 'ui_star')
          .setDepth(depth + 2)
          .setVisible(false),
      );
      this.hotbarStars2.push(
        scene.add
          .image(x + SLOT_W - 11, HOTBAR_Y + 5, 'ui_star')
          .setDepth(depth + 2)
          .setTint(0xf4d35e)
          .setVisible(false),
      );
      this.hotbarQty.push(
        new Label(scene, x + SLOT_W - 3, HOTBAR_Y + SLOT - 10, '', {
          align: 'right',
          color: CH.cream,
          outline: CH.ink, // over the item's own icon, whatever its colours
          face: 'small', // a count over an icon keeps the small face (DECISIONS "Type scale")
        }).setDepth(depth + 2),
      );
      // The whole pitch wide, from just above the faces to the bottom edge: the zones meet, so no tap on the row
      // reaches the world, and the 2 px under the lips still pick the cell.
      const zone = scene.add
        .zone(x - (SLOT_PITCH - SLOT_W) / 2, HOTBAR_HIT_Y, SLOT_PITCH, GAME_HEIGHT - HOTBAR_HIT_Y)
        .setOrigin(0, 0)
        .setDepth(depth + 3)
        .setInteractive();
      this.hotbarZones.push(zone);
      zone.on('pointerdown', () => {
        const s = this.getState();
        const slot = this.cells[i] ?? i;
        // the tool cell, tapped while its tool is in hand, moves on to the next tool (hoe, scythe, rod, pickaxe)
        const pick =
          i === 0 && s.inventory.selected === slot ? nextTool(s.inventory.slots, slot) : slot;
        selectSlot(s, pick);
        audio.play('select');
        haptic('tick');
      });
    }
    this.cells = hotbarCells(
      this.getState().inventory.slots,
      this.getState().inventory.selected,
      0,
    );

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
    this.bannerPlate = scene.add
      .graphics()
      .setDepth(depth + 4)
      .setAlpha(0);
    this.momentPlate = scene.add
      .graphics()
      .setDepth(depth + 4)
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

    // a touch (or a key, on a desktop) lets a sticky toast go once it has had its reading time
    scene.input.on('pointerdown', () => (this.touchedAt = scene.time.now));
    scene.input.keyboard?.on('keydown', () => (this.touchedAt = scene.time.now));
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
      gameEvents.on('valleyMoment', (m) =>
        m.delay
          ? this.scene.time.delayedCall(m.delay, () => this.valleyMoment(m.text, m.farmerY, m.cue))
          : this.valleyMoment(m.text, m.farmerY, m.cue),
      ),
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
    if (
      this.hotbarDirty ||
      rising ||
      s.inventory.selected !== this.lastSelected ||
      s.water !== this.drawnWater
    )
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
      if (step.count)
        drawBar(this.goalGfx, 9, 65, this.goalBarW(), 4, step.count[0] / step.count[1], CH.gold);
      return;
    }
    if (!prog) {
      this.goalLabel.setText(t('hud.allGoals')).setColor(CH.green);
      this.goalCount.setText('');
      return;
    }
    this.goalLabel.setText(prog.goal.text).setColor(CH.cream);
    this.goalCount.setText(`${fmtNum(prog.value)}/${fmtNum(prog.goal.target)}`);
    drawBar(this.goalGfx, 9, 65, this.goalBarW(), 4, prog.value / prog.goal.target, CH.gold);
  }

  /** The goal bar runs up to the count beside it (a long count printed over a fixed 132 px bar). */
  private goalBarW(): number {
    return Math.min(132, 191 - this.goalCount.textWidth - 6 - 9);
  }

  /**
   * The first green: a big gold title and a line under it, in their own slot (never the goal banner's), held about
   * three seconds while the straw dissolves. Every valley moment plays the same jingle: the valley coming back.
   */
  /**
   * A valley moment's banner (THE CREEK RUNS...): the gold title and its parchment line on a solid walnut plate with
   * a 2 px ink edge, so it reads over straw and sand as well as green (owner feedback, art round dry-year-2). Its slot
   * is HUD_H + 30; when the farmer (`farmerY`, their feet in screen px) stands in that band, as at the town's clamped
   * north edge, the banner drops below them instead (critic, round 22). Opaque at rest; the group fades in and out.
   */
  private valleyMoment(text: string, farmerY?: number, cue?: string): void {
    const [title, line] = text.split('\n');
    // a homecoming has its own jingle (audio lane), the valley's `green` otherwise
    audio.play(cue && (SFX_IDS as readonly string[]).includes(cue) ? (cue as Sfx) : 'green');
    haptic('success');
    const calm = this.getState().settings.reduceMotion;
    // held for its reading time (never shorter than the 2.9 s it had), then a 500 ms fade
    const hold = Math.max(2900, readMs(`${title ?? ''} ${line ?? ''}`, calm));
    showBanner(hold + 500);
    this.momentTitle.setText(title ?? '');
    this.moment.setText(line ?? '');
    const w = Math.min(
      GAME_WIDTH - 8,
      Math.max(this.momentTitle.textWidth, this.moment.textWidth) + 16,
    );
    const h = line ? 40 : 26;
    let top = HUD_H + 30;
    if (farmerY !== undefined && farmerY + 8 > top && farmerY - 30 - 8 < top + h)
      top = Math.min(Math.round(farmerY) + 6, CONTROLS_Y - h - 4);
    const x = Math.round((GAME_WIDTH - w) / 2);
    const g = this.momentPlate.clear();
    // a 2 px ink edge with notched corners, the walnut fill, a 2 px lit top (all solid)
    g.fillStyle(CH.ink, 1)
      .fillRect(x + 2, top, w - 4, h)
      .fillRect(x, top + 2, w, h - 4)
      .fillRect(x + 1, top + 1, w - 2, h - 2);
    g.fillStyle(CH.panel, 1).fillRect(x + 2, top + 2, w - 4, h - 4);
    g.fillStyle(CH.panelLight, 1).fillRect(x + 4, top + 2, w - 8, 2);
    const rise = calm ? 0 : 6;
    for (const [o, y] of [
      [this.momentPlate, 0],
      [this.momentTitle, top + 5],
      [this.moment, top + 27],
    ] as const) {
      this.scene.tweens.killTweensOf(o);
      o.setAlpha(0).setY(y + rise);
      const round = () => o.setY(Math.round(o.y));
      this.scene.tweens.add({ targets: o, alpha: 1, y, duration: 400, onUpdate: round });
      this.scene.tweens.add({ targets: o, alpha: 0, duration: 500, delay: hold });
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
    // Rises in and out in whole pixels; Calm mode only fades it. Held for its reading time (it was 1.9 s).
    const calm = this.getState().settings.reduceMotion;
    const hold = readMs(text, calm);
    showBanner(hold + 400); // world pickup lines keep clear of it (fx/hudBand.ts)
    this.banner
      .setText(text)
      .setAlpha(0)
      .setY(HUD_H + (calm ? 14 : 22));
    // a solid walnut plate under it (ink edge, lit top), moving and fading with the text
    const w = Math.min(GAME_WIDTH - 4, Math.ceil(this.banner.textWidth) + 14);
    const h = Math.ceil(this.banner.textHeight) + 6;
    const px = Math.round((GAME_WIDTH - w) / 2);
    this.bannerPlate
      .clear()
      .fillStyle(CH.ink, 1)
      .fillRect(px + 1, 0, w - 2, h)
      .fillRect(px, 1, w, h - 2)
      .fillStyle(CH.panel, 1)
      .fillRect(px + 1, 1, w - 2, h - 2)
      .fillStyle(CH.panelLight, 1)
      .fillRect(px + 2, 1, w - 4, 1);
    this.scene.tweens.killTweensOf(this.banner);
    const round = () => {
      this.banner.setY(Math.round(this.banner.y));
      this.bannerPlate.setY(this.banner.y - 3).setAlpha(this.banner.alpha);
    };
    round();
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
      delay: hold,
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
    const slots = s.inventory.slots;
    if (toolGroup(slots).includes(s.inventory.selected)) this.toolPick = s.inventory.selected;
    this.cells = hotbarCells(slots, s.inventory.selected, this.toolPick);
    const fromCell = this.selFrom >= 0 ? cellOfSlot(this.selFrom, slots) : -1;
    const selCell = cellOfSlot(s.inventory.selected, slots);
    this.drawnWater = s.water;
    for (let i = 0; i < HOTBAR_CELLS; i++) {
      const x = HOTBAR_X + i * SLOT_PITCH;
      const slot = this.cells[i]!;
      const sel = i === selCell;
      const lift = sel ? (half ? 1 : 2) : i === fromCell && half && fromCell !== selCell ? 1 : 0;
      // A solid soil lip under the face (its sides in ink), so each cell is its own little plate over any ground; a
      // rising face shows more of it (the selected cell stands on 4 px of lip).
      const lipY = HOTBAR_Y + SLOT - lift;
      g.fillStyle(CH.ink, 1).fillRect(x, lipY, SLOT_W, PLATE_LIP + lift);
      g.fillStyle(CH.panelLight, 1).fillRect(x + 1, lipY, SLOT_W - 2, PLATE_LIP + lift);
      const top = HOTBAR_Y - lift;
      drawSlot(g, x, top, SLOT, sel, false, 'chrome', SLOT_W);
      const stack = slots[slot] ?? null;
      const icon = this.hotbarIcons[i]!;
      const qty = this.hotbarQty[i]!;
      const star = this.hotbarStars[i]!;
      const star2 = this.hotbarStars2[i]!;
      if (stack) {
        const ref = refOf(stack);
        icon
          .setTexture(iconKey(ref))
          .setVisible(true)
          .setY(top + SLOT / 2);
        qty
          .setText(!isToolSlot(slot) && stack.qty > 1 ? String(stack.qty) : '')
          .setY(top + SLOT - 10);
        const q = ref.q ?? 0;
        star
          .setVisible(q > 0)
          .setTint(q >= 2 ? 0xf4d35e : 0xc9d3e4)
          .setY(top + 5);
        star2.setVisible(q >= 2).setY(top + 5);
      } else {
        icon.setVisible(false);
        qty.setText('');
        star.setVisible(false);
        star2.setVisible(false);
      }
      if (i === 0) {
        // the tool cell's tools as a column of pips at its left, clear of the icon: the one shown in gold
        const group = toolGroup(slots).filter((k) => !!slots[k]);
        group.forEach((k, n) => {
          g.fillStyle(CH.ink, 1).fillRect(x + 3, top + 4 + n * 4, 4, 4);
          g.fillStyle(k === slot ? CH.gold : CH.slotRim, 1).fillRect(x + 4, top + 5 + n * 4, 2, 2);
        });
      }
      if (stack && i === 1) {
        // owner: "the watering can should show how much water it has": a solid level bar across its foot, ink when
        // dry (no water at all reads as an empty ink track)
        // standing up along its right side, clear of the icon (2 px of blue in a 4 px ink track, filled upward)
        const cap = waterCapacity(s);
        const bh = SLOT - 8;
        const fill = cap > 0 ? Math.round((bh * Math.max(0, Math.min(cap, s.water))) / cap) : 0;
        g.fillStyle(CH.ink, 1).fillRect(x + SLOT_W - 8, top + 3, 4, bh + 2);
        if (fill > 0)
          g.fillStyle(CH.blue, 1).fillRect(x + SLOT_W - 7, top + 4 + bh - fill, 2, fill);
      }
    }
    if (s.inventory.selected !== this.lastSelected) {
      this.lastSelected = s.inventory.selected;
      const stack = selectedStack(s);
      // named when the player picked it; when Action moved the selection to what it used (auto tool), the rising
      // cell shows it without a name plate popping up on every tile of a row
      if (runtime.handPick || !stack) this.showName(stack ? displayName(refOf(stack)) : '');
    }
  }

  /**
   * The selected item's name on a solid plate at the bottom of the toast lane (toasts stack above it while it shows).
   * It goes in one step after its reading time (readMs): a fading plate over the world would be see-through.
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
    this.nameTimer = this.scene.time.delayedCall(
      readMs(name, this.getState().settings.reduceMotion),
      () => {
        this.nameLabel.setAlpha(0);
        this.nameBg.setAlpha(0);
      },
    );
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
  intercept: ((text: string, kind: ToastKind) => boolean) | null = null;

  // ---- toasts ----
  /** Toasts waiting for room in the lane. */
  private queue: { text: string; kind: ToastKind }[] = [];
  /** When the player last touched the screen (sticky toasts go on a touch). */
  private touchedAt = -Infinity;

  toast(text: string, kind: ToastKind = 'info'): void {
    if (this.intercept?.(text, kind)) return;
    // the goal banner already says it (critic, valley review 4: one tap stacked the banner and two toasts)
    if (isGoalToast(text)) return;
    const now = this.scene.time.now;
    const dup = this.toasts.find((t) => t.text === text);
    if (dup) {
      dup.born = Math.max(dup.born, now - 140); // keep it alive instead of stacking spam (no new fade-in)
      return;
    }
    if (this.queue.some((q) => q.text === text)) return;
    // over the world the lane holds MAX_TOASTS and the rest wait; over a sheet the newest shows at once (alone)
    if (this.toasts.length >= MAX_TOASTS && runtime.modals === 0) {
      this.queue.push({ text, kind });
      return;
    }
    this.showToast(text, kind, now);
  }

  private showToast(text: string, kind: ToastKind, now: number): void {
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
    const calm = this.getState().settings.reduceMotion;
    this.toasts.push({
      label,
      bg,
      lit,
      text,
      born: now,
      life: readMs(text, calm),
      read: readMs(text, calm),
      sticky: STICKY_TOASTS.includes(kind),
      tip: kind === 'tip',
    });
  }

  /**
   * While a sheet is open: the band free for a toast, from under the coach line (or the HUD) to the sheet's top
   * (UIScene supplies it). Null with no sheet open.
   */
  sheetBand: (() => { top: number; bottom: number } | null) | null = null;

  private updateToasts(time: number, dt: number): void {
    // While a sheet is open only one toast shows, the newest that is not a tip, in the band between the coach line
    // (or the HUD) and the sheet: never over the date, the goal line or another toast (critic P3-1). The others
    // wait, their clocks held, and show once the sheet closes.
    const band = runtime.modals > 0 ? (this.sheetBand?.() ?? { top: HUD_H, bottom: HUD_H }) : null;
    const front = band ? [...this.toasts].reverse().find((t) => !t.tip) : undefined;
    this.toasts = this.toasts.filter((t) => {
      if (band && t !== front) {
        t.born += dt; // held: it has not been read yet
        t.label.setAlpha(0);
        t.bg.setAlpha(0);
        t.lit?.setAlpha(0);
        return true;
      }
      const age = time - t.born;
      // a sticky toast (a refusal, a tip) stays past its reading time until the screen is touched after it
      if (t.sticky && age >= t.life && !(this.touchedAt > t.born + t.read)) t.life = age;
      if (age > t.life + TOAST_FADE_MS) {
        t.label.destroy();
        t.bg.destroy();
        t.lit?.destroy();
        return false;
      }
      // Eases in over 140 ms (fade, and a 4 px rise below), out over 600 ms after its reading time.
      const a = age > t.life ? 1 - (age - t.life) / TOAST_FADE_MS : Math.min(1, age / 140);
      t.label.setAlpha(a);
      t.bg.setAlpha((SKIN === 'plum' ? 0.72 : 1) * a); // walnut: an opaque plate, never a grey veil
      t.lit?.setAlpha(a);
      return true;
    });
    // a sheet closed with more toasts than the lane holds: the older ones wait again (they were held, unread)
    if (!band)
      while (this.toasts.length > MAX_TOASTS) {
        const t = this.toasts.shift()!;
        this.queue.unshift({ text: t.text, kind: t.tip ? 'tip' : t.sticky ? 'warn' : 'info' });
        t.label.destroy();
        t.bg.destroy();
        t.lit?.destroy();
      }
    while (!band && this.queue.length && this.toasts.length < MAX_TOASTS) {
      const q = this.queue.shift()!;
      this.showToast(q.text, q.kind, time);
    }
    // each step is a whole plate and a gap (a step of the text's height let plates overprint: critic P1-2)
    const step = (t: Toast): number => Math.ceil(t.label.textHeight) + 5 + TOAST_GAP;
    const place = (t: Toast, y: number, depth: number): void => {
      t.label.y = y;
      t.label.setDepth(depth + 1);
      t.bg.setDepth(depth);
      t.lit?.setDepth(depth + 0.5);
      t.bg
        .setPosition(t.label.x, t.label.y + t.label.textHeight / 2)
        .setSize(t.label.textWidth + 10, t.label.textHeight + 5);
      t.lit
        ?.setPosition(t.bg.x, Math.round(t.bg.y - t.bg.height / 2) + 1)
        .setSize(t.bg.width - 2, 1);
    };
    if (band) {
      const shown = this.toasts.find((t) => t === front);
      if (!shown) return;
      const plate = Math.ceil(shown.label.textHeight) + 5;
      // centred in the free band; a sheet up to the HUD leaves none, so it sits over the meters row (dimmed),
      // still clear of the date and the goal line
      const free = band.bottom - band.top;
      const top = free >= plate + 2 ? band.top + Math.floor((free - plate) / 2) : 33;
      place(shown, top + 2, 231);
      return;
    }
    // Newest sits on the bottom of the toast lane; older ones stack upward by their real (wrapped) height.
    let y = this.laneBottom();
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i]!;
      y -= step(t);
      const born = time - t.born < 140 && !this.getState().settings.reduceMotion;
      const target = born ? y + Math.round(4 * (1 - (time - t.born) / 140)) : y;
      // Older toasts glide up as a new one arrives, a whole pixel at a time, never stalling short.
      place(t, tickToward(Math.round(t.label.y), target, dt, 0.3), 79);
    }
  }

  private flashSaved(): void {
    this.scene.tweens.killTweensOf(this.savedLabel);
    this.savedLabel.setAlpha(1);
    this.scene.tweens.add({ targets: this.savedLabel, alpha: 0, delay: 900, duration: 500 });
  }
}
