import Phaser from 'phaser';
import {
  DOCK_Y,
  EVT_INTERACT_TARGET,
  GAME_HEIGHT,
  GAME_WIDTH,
  TAP_MAX_MOVE,
  TAP_MAX_MS,
  UI_LAYOUT,
  WORLD_VIEW,
} from '../config';
import { game, mapsData } from '../data';
import { RainLayer } from '../fx/RainLayer';
import { forageCandidates, weedCandidates } from '../game/farmInfo';
import { saveNow, wireAutosave } from '../game/persistence';
import { inputHub } from '../input/InputHub';
import { KeyboardInput } from '../input/KeyboardInput';
import { TouchButton } from '../input/TouchButton';
import { VirtualJoystick } from '../input/VirtualJoystick';
import { audio } from '../platform/audio';
import { lifecycle } from '../platform/lifecycle';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { endDay } from '../systems/day';
import { gameEvents, type PanelType } from '../systems/events';
import { addStat, currentGoal, stat } from '../systems/goals';
import { cycleSlot, selectSlot } from '../systems/inventory';
import { seasonLabel } from '../systems/time';
import { teleportPlayer, type TiledMapLike } from '../systems/world';
import { mixColor } from '../ui/color';
import { daylightColor, indoorColor, nightAmount } from '../ui/daylight';
import { Label } from '../ui/font';
import { Hud } from '../ui/Hud';
import {
  BinPanel,
  BoardPanel,
  FishingPanel,
  installMenuTabs,
  JarPanel,
  NpcPanel,
  PlotPanel,
  MenuPanel,
  ShopPanel,
  SleepPanel,
  SummaryPanel,
  YearEndPanel,
} from '../ui/panels';
import type { Modal } from '../ui/widgets';
import { mapCacheKey } from './PreloadScene';
import { WorldScene } from './WorldScene';

/** Silence before a hint appears. */
const IDLE_HINT_MS = 40_000;
const CREAM = 0xf4ead2;
const INK = 0x14101f;

/** Hoe silhouette: the placeholder for "use equipped item" until real tool icons arrive. */
function drawActionIcon(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(4, INK, 0.6).lineBetween(-9, 10, 8, -7);
  g.lineStyle(2, CREAM, 1).lineBetween(-9, 10, 8, -7);
  g.fillStyle(INK, 0.6).fillRect(2, -12, 11, 8);
  g.fillStyle(CREAM, 1).fillRect(3, -11, 9, 6);
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

function drawBoardIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(INK, 0.6).fillRect(-11, -10, 22, 18);
  g.fillStyle(0xb98a52, 1).fillRect(-10, -9, 20, 16);
  g.fillStyle(CREAM, 1).fillRect(-7, -6, 6, 7).fillRect(1, -6, 6, 5);
  g.fillStyle(INK, 0.5).fillRect(-6, -4, 4, 1).fillRect(2, -4, 4, 1);
  g.fillStyle(INK, 0.6).fillRect(-9, 7, 2, 4).fillRect(7, 7, 2, 4);
}

function drawTalkIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(INK, 0.6).fillRect(-11, -9, 22, 15).fillRect(-6, 5, 5, 5);
  g.fillStyle(CREAM, 1).fillRect(-10, -8, 20, 13).fillRect(-5, 5, 4, 4);
  g.fillStyle(INK, 0.9);
  for (const x of [-5, 0, 5]) g.fillRect(x - 1, -3, 2, 2);
}

function drawMenuIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(CREAM, 1);
  for (const y of [-5, -1, 3]) g.fillRect(-6, y, 12, 2);
}

/** Interact-button icon by the kind of thing in reach. Mechanics add an entry for their objects. */
export const INTERACT_ICONS: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
  bed: drawBedIcon,
  board: drawBoardIcon,
  npc: drawTalkIcon,
};

/** HUD overlay and flow controller: thumb controls, panels, day tint, sleep and results. */
export class UIScene extends Phaser.Scene {
  private controls: TouchButton[] = [];
  private interactButton: TouchButton | null = null;
  private interactIcon: Phaser.GameObjects.Graphics | null = null;
  private interactType: string | null = null;
  private taps = new Map<number, { x: number; y: number; t: number }>();
  private hud!: Hud;
  private tint!: Phaser.GameObjects.Rectangle;
  private blackout!: Phaser.GameObjects.Rectangle;
  private menu!: MenuPanel;
  private summary!: SummaryPanel;
  private yearEnd!: YearEndPanel;
  private jar!: JarPanel;
  private npc!: NpcPanel;
  private plot!: PlotPanel;
  private fishing!: FishingPanel;
  /** Panels a placed object can open, by the name its behavior gives in `interact`. */
  private jarPanels: Record<string, { openFor(id: number): void }> = {};
  /** Dismissible sheets by panel type. */
  private panels = new Map<PanelType, Modal>();
  private lastNight = -1;
  private lateWarnedDay = -1;
  /** Real ms since the player last touched anything; a long silence earns a hint about the goal. */
  private idleMs = 0;
  private rain!: RainLayer;
  private dragHint: Phaser.GameObjects.Container | null = null;
  private sleeping = false;
  private cleanup: (() => void)[] = [];

  constructor() {
    super('UI');
  }

  create(): void {
    this.taps.clear();
    this.cleanup = [];
    this.controls = [];
    this.interactButton = null;
    this.interactIcon = null;
    this.lastNight = -1;
    this.sleeping = false;
    this.input.addPointer(2); // mouse + a thumb + a spare for multi-touch
    new KeyboardInput(this, inputHub);
    new VirtualJoystick(this, inputHub);
    wireAutosave();

    this.tint = this.add
      .rectangle(WORLD_VIEW.x, WORLD_VIEW.y, WORLD_VIEW.w, WORLD_VIEW.h, 0xffffff)
      .setOrigin(0)
      .setDepth(1)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.blackout = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0)
      .setDepth(190)
      .setAlpha(0);

    this.rain = new RainLayer(this, 2);
    this.hud = new Hud(this, getState);
    this.buildControls();
    this.buildPanels();
    this.buildDragHint();

    const fresh = getState();
    if (
      fresh.goalIndex === 0 &&
      fresh.time.day === 1 &&
      fresh.time.season === 'spring' &&
      !fresh.stats['tilled']
    ) {
      this.time.delayedCall(900, () =>
        this.hud.toast('Welcome to Tiny Acre! Pick the hoe and tap Action to till soil.', 'good'),
      );
      this.time.delayedCall(4200, () =>
        this.hud.toast(
          'Drag anywhere low on the screen to walk. Hold Action to keep working.',
          'info',
        ),
      );
    }

    this.cleanup.push(
      gameEvents.on('openPanel', ({ type }) => this.openPanel(type)),
      gameEvents.on('levelUp', () => audio.play('goal')),
      gameEvents.on('sleepRequest', ({ passedOut }) => void this.runSleep(passedOut)),
      gameEvents.on('settingsChanged', () => this.buildControls()),
      gameEvents.on('placedPanel', ({ panel, id }) => {
        if (!runtime.blocked) {
          inputHub.clearHeld();
          this.jarPanels[panel]?.openFor(id);
        }
      }),
      gameEvents.on('buyPlot', ({ id }) => {
        if (runtime.blocked) return;
        inputHub.clearHeld();
        this.plot.openFor(id);
      }),
      gameEvents.on('talkTo', ({ id }) => {
        if (runtime.blocked) return;
        inputHub.clearHeld();
        this.npc.openFor(id);
      }),
      gameEvents.on('startFishing', ({ fish, bait }) => {
        inputHub.clearHeld();
        this.fishing.start(fish, bait);
      }),
      inputHub.on('menu', () => this.toggleMenu()),
      inputHub.on('confirm', () =>
        this.allModals()
          .find((m) => m.isOpen)
          ?.confirm(),
      ),
      // Android back: close the open dialog, otherwise open the menu (never kill the game by accident).
      lifecycle.on('back', () => this.toggleMenu()),
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
      // Quitting to title must silence the world: rain and night music belong to the game scene.
      audio.setRain(0);
      audio.setNight(0);
    });
    this.setupTaps();
  }

  update(time: number, delta: number): void {
    const s = getState();
    if (this.dragHint && inputHub.direction !== null) {
      addStat(s, 'moved', 1); // remembered in the save, so the hint never returns
      this.dragHint.destroy();
      this.dragHint = null;
    }
    this.hud.update(time);
    this.updateIdleHint(delta);
    const indoors = !mapsData.maps[s.player.map]?.outdoor;
    const raining = s.weather === 'rain';
    let base = daylightColor(s.time.minutes);
    if (raining && !indoors) base = mixColor(base, 0x9db0cc, 0.4); // grey-blue overcast
    const grade = indoors ? indoorColor(base) : base;
    // A white multiply overlay changes nothing but still costs a blend, so skip it.
    this.tint.setVisible(grade !== 0xffffff).setFillStyle(grade);
    this.rain.setIntensity(raining && !indoors ? 1 : 0);
    this.rain.update(delta);
    audio.setRain(raining ? (indoors ? 0.35 : 1) : 0);
    if (
      s.time.minutes >= game.dayEndMinutes - 60 &&
      this.lateWarnedDay !== s.time.day &&
      !runtime.busy
    ) {
      this.lateWarnedDay = s.time.day;
      this.hud.toast("It's getting late. Head to bed soon!", 'warn');
    }
    const night = nightAmount(s.time.minutes);
    if (Math.abs(night - this.lastNight) > 0.02) {
      this.lastNight = night;
      audio.setNight(night);
    }
  }

  /** After a long quiet spell, remind the player what the current goal wants (at most every 90 s). */
  private updateIdleHint(delta: number): void {
    if (runtime.blocked || this.sleeping) return;
    if (inputHub.direction !== null || inputHub.actionHeld) this.idleMs = 0;
    else this.idleMs += delta;
    if (this.idleMs < IDLE_HINT_MS) return;
    this.idleMs = -IDLE_HINT_MS / 2;
    const goal = currentGoal(getState());
    if (goal) this.hud.toast(`Hint: ${goal.hint}`, 'info');
  }

  // ---- thumb controls ----

  /** (Re)build the dock controls. Right-handed puts Action under the right thumb; left-handed mirrors. */
  private buildControls(): void {
    this.controls.forEach((c) => c.destroy());
    this.controls = [];
    this.interactIcon?.destroy();
    const { actionRadius: ar, interactRadius: ir, menuRadius: mr, edge } = UI_LAYOUT;
    const left = getState().settings.leftHanded;
    const x = (rightHandedX: number) => (left ? GAME_WIDTH - rightHandedX : rightHandedX);

    // Action sits low in the corner where the resting thumb lands; Interact is a short slide away.
    const action = new TouchButton(
      this,
      x(GAME_WIDTH - edge - ar),
      DOCK_Y + 8 + ar,
      ar,
      drawActionIcon,
      () => (inputHub.actionHeld = true),
      () => (inputHub.actionHeld = false),
    );
    this.interactButton = new TouchButton(
      this,
      x(GAME_WIDTH - edge - ar - ir - 20),
      DOCK_Y + 34 + ir,
      ir,
      () => undefined,
      () => inputHub.emit('interact', undefined),
    );
    // Menu is rarely needed, so it lives up and away from the working corner: no accidental taps.
    const menu = new TouchButton(this, x(edge + mr + 2), DOCK_Y + 12 + mr, mr, drawMenuIcon, () =>
      this.toggleMenu(),
    );
    this.controls.push(action, this.interactButton, menu);

    this.interactIcon = this.add.graphics().setDepth(91);
    this.interactIcon.setPosition(this.interactButton.view.x, this.interactButton.view.y);
    this.interactButton.view.setAlpha(0).setScale(0.8);
    this.interactButton.setEnabled(false);
    this.interactIcon.setAlpha(0);
    this.setInteractTarget(this.interactType);
  }

  /** A faint ring in the thumb zone on a fresh game: shows where to drag. Gone after the first step. */
  private buildDragHint(): void {
    this.dragHint?.destroy();
    this.dragHint = null;
    if (stat(getState(), 'moved') > 0) return;
    const left = getState().settings.leftHanded;
    const cx = left ? GAME_WIDTH - 64 : 64;
    const cy = DOCK_Y + 56;
    const ring = this.add.graphics();
    ring.lineStyle(2, 0xf4ead2, 0.45).strokeCircle(0, 0, 24);
    ring.fillStyle(0xf4ead2, 0.18).fillCircle(0, 0, 10);
    for (const a of [0, 90, 180, 270]) {
      const r = Phaser.Math.DegToRad(a);
      ring
        .fillStyle(0xf4ead2, 0.5)
        .fillTriangle(
          Math.cos(r) * 34,
          Math.sin(r) * 34,
          Math.cos(r + 0.35) * 28,
          Math.sin(r + 0.35) * 28,
          Math.cos(r - 0.35) * 28,
          Math.sin(r - 0.35) * 28,
        );
    }
    const label = new Label(this, 0, -44, 'Drag to walk', { align: 'center', color: 0xf4ead2 });
    this.dragHint = this.add.container(cx, cy, [ring, label]).setDepth(60);
    this.tweens.add({
      targets: this.dragHint,
      alpha: { from: 1, to: 0.45 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private setInteractTarget(type: string | null): void {
    this.interactType = type;
    if (!this.interactButton || !this.interactIcon) return;
    this.interactButton.setEnabled(type !== null);
    if (type !== null) {
      this.interactIcon.clear();
      (INTERACT_ICONS[type] ?? INTERACT_ICONS[type.split(':')[0] ?? ''] ?? drawHandIcon)(
        this.interactIcon,
      );
    }
    this.tweens.add({ targets: this.interactIcon, alpha: type !== null ? 1 : 0, duration: 140 });
  }

  /** A short, nearly stationary touch on the world counts as a tap (not a joystick drag). */
  private setupTaps(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.idleMs = 0;
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
    this.panels.clear();
    this.menu = new MenuPanel(this, () => this.quitToTitle());
    installMenuTabs(this.menu);
    this.summary = new SummaryPanel(this);
    this.yearEnd = new YearEndPanel(this);
    this.panels.set('menu', this.menu);
    this.panels.set('shop', new ShopPanel(this));
    this.panels.set('bin', new BinPanel(this));
    this.panels.set('board', new BoardPanel(this));
    this.jar = new JarPanel(this);
    this.npc = new NpcPanel(this);
    this.plot = new PlotPanel(this);
    this.fishing = new FishingPanel(this);
    this.panels.set('fishing', this.fishing);
    this.panels.set('sleep', new SleepPanel(this, () => void this.runSleep(false)));
    this.jarPanels = { jar: this.jar };
    for (const m of [...this.panels.values(), this.jar, this.npc, this.plot])
      m.onClosed = () => void saveNow(true);
  }

  private allModals(): Modal[] {
    return [...this.panels.values(), this.jar, this.npc, this.plot, this.summary, this.yearEnd];
  }

  /** The dismissible modal (not the sleep results, which must be acknowledged). */
  private activeModal(): Modal | null {
    return [...this.panels.values(), this.jar, this.npc, this.plot].find((m) => m.isOpen) ?? null;
  }

  private openPanel(type: PanelType): void {
    if (runtime.blocked) return;
    inputHub.clearHeld();
    if (type === 'craft' || type === 'skills') this.menu.openTab(type);
    else if (type === 'fishing')
      return; // started only by casting
    else this.panels.get(type)?.open();
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

  /** Bed or pass-out: fade out, roll the day, wake in bed, show the summary, fade back in. */
  private async runSleep(passedOut: boolean): Promise<void> {
    if (this.sleeping) return; // never run two rollovers at once
    this.sleeping = true;
    runtime.busy = true;
    inputHub.clearHeld();
    await this.fadeBlackout(1, 650);
    audio.play('sleep');

    const state = getState();
    const farm = this.cache.tilemap.get(mapCacheKey('farm')).data as TiledMapLike;
    const forageSpots: Record<string, [number, number][]> = {};
    for (const id of Object.keys(mapsData.maps)) {
      const raw = this.cache.tilemap.get(mapCacheKey(id))?.data as TiledMapLike | undefined;
      if (raw) forageSpots[id] = forageCandidates(raw);
    }
    const summary = endDay(state, { passedOut, weedCandidates: weedCandidates(farm), forageSpots });
    const wake = mapsData.wake;
    teleportPlayer(state, wake);
    await saveNow(true);
    this.worldScene()?.scene.start(mapsData.maps[wake.map]?.scene ?? 'House');

    await this.delay(500);
    await this.summary.present(summary);
    if (summary.yearEnd) await this.yearEnd.present();
    this.hud.toast(
      state.weather === 'rain'
        ? `Good morning! It's raining, crops are watered.`
        : `Good morning! ${seasonLabel(state.time.season)} ${state.time.day}`,
      'info',
    );
    await this.fadeBlackout(0, 600);
    runtime.busy = false;
    this.sleeping = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }
}
