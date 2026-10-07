import Phaser from 'phaser';
import {
  EVT_INTERACT_TARGET,
  GAME_HEIGHT,
  GAME_WIDTH,
  TAP_MAX_MOVE,
  TAP_MAX_MS,
  UI_LAYOUT,
} from '../config';
import { mapsData } from '../data';
import { weedCandidates } from '../game/farmInfo';
import { saveNow, wireAutosave } from '../game/persistence';
import { inputHub } from '../input/InputHub';
import { KeyboardInput } from '../input/KeyboardInput';
import { TouchButton } from '../input/TouchButton';
import { VirtualJoystick } from '../input/VirtualJoystick';
import { audio } from '../platform/audio';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { endDay } from '../systems/day';
import { gameEvents } from '../systems/events';
import { cycleSlot, selectSlot } from '../systems/inventory';
import { seasonLabel } from '../systems/time';
import { teleportPlayer, type TiledMapLike } from '../systems/world';
import { daylightColor, indoorColor, nightAmount } from '../ui/daylight';
import { Hud } from '../ui/Hud';
import {
  BinPanel,
  MenuPanel,
  ShopPanel,
  SleepPanel,
  SummaryPanel,
  YearEndPanel,
} from '../ui/panels';
import { Button, type Modal } from '../ui/widgets';
import { mapCacheKey } from './PreloadScene';
import { WorldScene } from './WorldScene';

const CREAM = 0xf4ead2;
const INK = 0x14101f;

/** Hoe silhouette: the placeholder for "use equipped tool" until real tool icons arrive. */
function drawActionIcon(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(4, INK, 0.6).lineBetween(-8, 9, 7, -6);
  g.lineStyle(2, CREAM, 1).lineBetween(-8, 9, 7, -6);
  g.fillStyle(INK, 0.6).fillRect(2, -11, 10, 7);
  g.fillStyle(CREAM, 1).fillRect(3, -10, 8, 5);
}

function drawHandIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(INK, 0.6).fillCircle(0, 0, 10);
  g.fillStyle(CREAM, 1).fillCircle(0, 0, 8);
  g.fillStyle(INK, 0.9);
  for (const x of [-4, 0, 4]) g.fillCircle(x, 0, 1.4);
}

function drawBedIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(INK, 0.6).fillRect(-11, -6, 22, 14);
  g.fillStyle(CREAM, 1).fillRect(-10, -1, 20, 8);
  g.fillStyle(0x4a7fc1, 1).fillRect(-4, -1, 14, 8);
  g.fillStyle(CREAM, 1).fillRect(-9, -5, 6, 5);
  g.fillStyle(INK, 0.6).fillRect(-11, 4, 2, 6).fillRect(9, 4, 2, 6);
}

const INTERACT_ICONS: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
  bed: drawBedIcon,
};

/** HUD overlay and flow controller: touch controls, panels, day tint, sleep and results. */
export class UIScene extends Phaser.Scene {
  private interactButton!: TouchButton;
  private interactIcon!: Phaser.GameObjects.Graphics;
  private taps = new Map<number, { x: number; y: number; t: number }>();
  private hud!: Hud;
  private tint!: Phaser.GameObjects.Rectangle;
  private blackout!: Phaser.GameObjects.Rectangle;
  private menu!: MenuPanel;
  private shop!: ShopPanel;
  private bin!: BinPanel;
  private sleepPanel!: SleepPanel;
  private summary!: SummaryPanel;
  private yearEnd!: YearEndPanel;
  private lastNight = -1;
  private lateWarnedDay = -1;
  private cleanup: (() => void)[] = [];

  constructor() {
    super('UI');
  }

  create(): void {
    this.taps.clear();
    this.cleanup = [];
    this.lastNight = -1;
    this.input.addPointer(3); // mouse + joystick thumb + both buttons
    new KeyboardInput(this, inputHub);
    new VirtualJoystick(this, inputHub);
    wireAutosave();

    this.tint = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff)
      .setOrigin(0)
      .setDepth(1)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.blackout = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0)
      .setDepth(190)
      .setAlpha(0);

    this.hud = new Hud(this, getState);
    this.buildControls();
    this.buildPanels();

    this.cleanup.push(
      gameEvents.on('openPanel', ({ type }) => this.openPanel(type)),
      gameEvents.on('sleepRequest', ({ passedOut }) => void this.runSleep(passedOut)),
      inputHub.on('menu', () => this.toggleMenu()),
      inputHub.on('slot', (i) => selectSlot(getState(), i)),
      inputHub.on('cycle', (d) => cycleSlot(getState(), d)),
    );
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (!runtime.blocked) cycleSlot(getState(), dy > 0 ? 1 : -1);
    });
    this.game.events.on(EVT_INTERACT_TARGET, this.setInteractTarget, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup.forEach((off) => off());
      this.game.events.off(EVT_INTERACT_TARGET, this.setInteractTarget, this);
      this.hud.destroy();
    });
    this.setupTaps();
  }

  update(time: number): void {
    const s = getState();
    this.hud.update(time);
    const base = daylightColor(s.time.minutes);
    const indoors = !mapsData.maps[s.player.map]?.outdoor;
    this.tint.setFillStyle(indoors ? indoorColor(base) : base);
    if (s.time.minutes >= 1500 && this.lateWarnedDay !== s.time.day && !runtime.busy) {
      this.lateWarnedDay = s.time.day;
      this.hud.toast("It's getting late. Head to bed soon!", 'warn');
    }
    const night = nightAmount(s.time.minutes);
    if (Math.abs(night - this.lastNight) > 0.02) {
      this.lastNight = night;
      audio.setNight(night);
    }
  }

  // ---- controls ----

  private buildControls(): void {
    const { margin, actionRadius, interactRadius } = UI_LAYOUT;
    const ax = GAME_WIDTH - margin - actionRadius;
    const ay = GAME_HEIGHT - margin - actionRadius;
    new TouchButton(
      this,
      ax,
      ay,
      actionRadius,
      drawActionIcon,
      () => (inputHub.actionHeld = true),
      () => (inputHub.actionHeld = false),
    );
    this.interactButton = new TouchButton(
      this,
      ax - actionRadius - interactRadius - 6,
      ay + 8,
      interactRadius,
      () => undefined,
      () => inputHub.emit('interact', undefined),
    );
    this.interactIcon = this.add.graphics().setDepth(91);
    this.interactIcon.setPosition(this.interactButton.view.x, this.interactButton.view.y);
    this.interactButton.view.setAlpha(0).setScale(0.8);
    this.interactButton.setEnabled(false);
    this.interactIcon.setAlpha(0);

    const menuBtn = new Button(this, GAME_WIDTH - 38, 6, 32, 32, '', () =>
      this.toggleMenu(),
    ).setDepth(60);
    menuBtn.add(this.add.image(16, 16, 'ui_menu'));
  }

  private setInteractTarget(type: string | null): void {
    this.interactButton.setEnabled(type !== null);
    if (type !== null) {
      this.interactIcon.clear();
      (INTERACT_ICONS[type] ?? drawHandIcon)(this.interactIcon);
    }
    this.tweens.add({ targets: this.interactIcon, alpha: type !== null ? 1 : 0, duration: 140 });
  }

  /** A short, nearly stationary touch on the world counts as a tap (not a joystick drag). */
  private setupTaps(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      audio.unlock();
      if (this.input.hitTestPointer(p).length > 0) return; // started on a button
      this.taps.set(p.id, { x: p.x, y: p.y, t: p.downTime });
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const down = this.taps.get(p.id);
      this.taps.delete(p.id);
      if (!down) return;
      const quick = p.upTime - down.t <= TAP_MAX_MS;
      const still = Math.hypot(p.x - down.x, p.y - down.y) <= TAP_MAX_MOVE;
      if (quick && still) inputHub.emit('tap', { x: p.x, y: p.y });
    });
  }

  // ---- panels ----

  private buildPanels(): void {
    this.menu = new MenuPanel(this, () => this.quitToTitle());
    this.shop = new ShopPanel(this);
    this.bin = new BinPanel(this);
    this.sleepPanel = new SleepPanel(this, () => void this.runSleep(false));
    this.summary = new SummaryPanel(this);
    this.yearEnd = new YearEndPanel(this);
    for (const m of [this.menu, this.shop, this.bin, this.sleepPanel]) {
      m.onClosed = () => void saveNow(true);
    }
  }

  private activeModal(): Modal | null {
    return [this.menu, this.shop, this.bin, this.sleepPanel].find((m) => m.isOpen) ?? null;
  }

  private openPanel(type: 'shop' | 'bin' | 'sleep' | 'menu'): void {
    if (runtime.blocked) return;
    inputHub.clearHeld();
    const panel = { shop: this.shop, bin: this.bin, sleep: this.sleepPanel, menu: this.menu }[type];
    panel.open();
  }

  private toggleMenu(): void {
    const open = this.activeModal();
    if (open) open.close();
    else if (!runtime.busy) this.openPanel('menu');
  }

  private quitToTitle(): void {
    runtime.inGame = false;
    runtime.busy = false;
    runtime.modals = 0;
    inputHub.clearHeld();
    const world = this.worldScene();
    world?.scene.stop();
    this.scene.start('Title');
  }

  // ---- sleep flow ----

  private worldScene(): WorldScene | undefined {
    return this.scene.manager.getScenes(true).find((s): s is WorldScene => s instanceof WorldScene);
  }

  private fadeBlackout(alpha: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ targets: this.blackout, alpha, duration, onComplete: () => resolve() });
    });
  }

  /** Bed or 02:00: fade out, roll the day, wake in bed, show the summary, fade back in. */
  private async runSleep(passedOut: boolean): Promise<void> {
    runtime.busy = true;
    inputHub.clearHeld();
    await this.fadeBlackout(1, 650);
    audio.play('sleep');

    const state = getState();
    const farm = this.cache.tilemap.get(mapCacheKey('farm')).data as TiledMapLike;
    const summary = endDay(state, { passedOut, weedCandidates: weedCandidates(farm) });
    const wake = mapsData.wake;
    teleportPlayer(state, wake);
    await saveNow(true);
    this.worldScene()?.scene.start(mapsData.maps[wake.map]?.scene ?? 'House');

    await this.delay(500);
    await this.summary.present(summary);
    if (summary.yearEnd) await this.yearEnd.present();
    this.hud.toast(`Good morning! ${seasonLabel(state.time.season)} ${state.time.day}`, 'info');
    await this.fadeBlackout(0, 600);
    runtime.busy = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }
}
