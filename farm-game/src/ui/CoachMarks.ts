/**
 * The coach-mark layer of the guided start (rules in systems/tutorial.ts, steps in data/tutorial.json).
 *
 * One line at the top of the world view (never under the thumb or the dock), a pulsing ring and a hand on
 * exactly one target (a world tile, a dock button, a hotbar slot, a button in an open sheet), and at most one
 * HUD tag. Nothing here is modal and nothing blocks input: the only touch targets are the line itself (tap it
 * for Skip / Next) and the welcome strip's two buttons. Left-handed mirrors the hand; Calm stills every mark.
 *
 * Texture keys (code-drawn placeholders until the art agent supplies them): `ui_coach_ring`, `ui_coach_hand`.
 */
import Phaser from 'phaser';
import { GAME_WIDTH, HUD_H, WORLD_VIEW } from '../config';
import { npcFrame, npcTexture } from '../art/manifest';
import { audio } from '../platform/audio';
import { haptic } from '../platform/haptics';
import type { GameState } from '../state/GameState';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { gameEvents } from '../systems/events';
import { faceDirection } from '../systems/movement';
import { toggleLeftHanded } from '../systems/settings';
import {
  advance,
  CLOSE_BUTTON,
  COACH_LINE_PX,
  rewriteRefusal,
  coachView,
  setCoachContext,
  skipStep,
  skipTutorial,
  stepDone,
  tutorialOn,
  tutorialStep,
  welcome,
  type CoachFacts,
  type CoachView,
  type CoachWorld,
  type Pointer,
} from '../systems/tutorial';
import type { TutorialHud } from '../data';
import { edgePoint } from './coachGeometry';
import { fitText, Label } from './font';
import { HOTBAR_X, HOTBAR_Y, SLOT } from './Hud';
import type { DockLayout } from './layout';
import { CH } from './theme';
import { Button, drawPanel, type Modal } from './widgets';

export const COACH_RING = 'ui_coach_ring';
export const COACH_HAND = 'ui_coach_hand';

/** After this long on one step without finishing it, the marks escalate (a travelling hand, a bigger ring). */
export const ESCALATE_MS = 15_000;
/** After this long, an optional step's line offers Next. */
export const NEXT_MS = 45_000;
const DEPTH = 260;
const BAR_H = 18;
/** The "..." button at the end of the coach line (touch size). */
const GLYPH_HIT = 26;
/** The line's menu closes by itself after this long untouched. */
const MENU_MS = 4000;
/** An info line counts touches only after it has been up this long (so a quick tap cannot skip reading it). */
const INFO_MIN_MS = 1200;
export const SKIPPED_TOAST = 'Guide off. Replay it: Menu > Opts > Controls.';
const WELCOME_H = 60;

/** World view as the coach sees it, plus a tile -> screen mapping. */
export type CoachScreenWorld = CoachWorld & {
  screen(tx: number, ty: number): { x: number; y: number };
};

export interface CoachHost {
  scene: Phaser.Scene;
  layout(): DockLayout;
  world(): CoachScreenWorld | null;
  facts(): CoachFacts;
  /** The open sheet, if any (buttons inside it can be pointed at). */
  openModal(): Modal | null;
}

/** HUD element boxes (logical px), matching Hud.ts. */
const HUD_BOX: Record<TutorialHud, { x: number; y: number; w: number; h: number; label: string }> =
  {
    clock: { x: 3, y: 2, w: 104, h: 32, label: 'Clock' },
    gold: { x: 110, y: 2, w: 87, h: 17, label: 'Gold' },
    energy: { x: 4, y: 34, w: 95, h: 13, label: 'Energy' },
    water: { x: 101, y: 34, w: 95, h: 13, label: 'Water' },
    goal: { x: 3, y: 48, w: 194, h: 25, label: 'Goal' },
    hotbar: {
      x: HOTBAR_X - 1,
      y: HOTBAR_Y - 3,
      w: 8 * (SLOT + 1) + 1,
      h: SLOT + 5,
      label: 'Hotbar',
    },
  };

const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;

/** Draw the placeholder ring and hand once (the art agent can replace them by key). */
export function ensureCoachTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(COACH_RING)) {
    const g = scene.make.graphics({}, false);
    g.lineStyle(3, 0x2a1a24, 0.6).strokeCircle(16, 16, 13);
    g.lineStyle(2, 0xf4cc3c, 1).strokeCircle(16, 16, 13);
    g.lineStyle(1, 0xfff1b0, 0.8).strokeCircle(16, 16, 10);
    g.generateTexture(COACH_RING, 32, 32);
    g.destroy();
  }
  if (!scene.textures.exists(COACH_HAND)) {
    const g = scene.make.graphics({}, false);
    // a pointing glove: the fingertip is at (4, 1), the palm below and to the right
    const ink = 0x2a1a24;
    const glove = 0xf4e4bc;
    g.fillStyle(ink, 1).fillRect(2, 0, 5, 9).fillRect(2, 6, 11, 10).fillRect(1, 8, 13, 7);
    g.fillStyle(glove, 1).fillRect(3, 1, 3, 8).fillRect(3, 7, 9, 8).fillRect(2, 9, 11, 5);
    g.fillStyle(0xdcb47c, 1).fillRect(7, 8, 1, 3).fillRect(9, 8, 1, 3);
    g.generateTexture(COACH_HAND, 15, 17);
    g.destroy();
  }
}

export class CoachMarks {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly plates: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly line: Label;
  private readonly count: Label;
  private readonly glyph: Label;
  private readonly tagLabel: Label;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly hand: Phaser.GameObjects.Image;
  private readonly barZone: Phaser.GameObjects.Zone;
  private readonly menuButtons: Button[] = [];
  private welcomeParts: Phaser.GameObjects.GameObject[] = [];
  private welcomeSkip: Button | null = null;
  private welcomeLeft: Button | null = null;
  private view: CoachView | null = null;
  private stepId: string | null = null;
  private stepMs = 0;
  /** A refusal shown in the line instead of a toast, until this time. */
  private flash: { text: string; until: number } | null = null;
  private menuOpen = false;
  private skipArmedUntil = 0;
  /** Where the pointer aims on screen (debug hook; the e2e follows it like a player follows the hand). */
  private aim: { x: number; y: number; kind: string; dir?: string } | null = null;
  private stillMs = 0;
  private refusals = 0;
  private progressKey = '';
  private touches = 0;
  private shownAt = 0;
  private menuAt = 0;
  private barLow = false;
  private lastTile = '';
  private cleanup: (() => void)[] = [];

  constructor(private readonly host: CoachHost) {
    const scene = host.scene;
    this.scene = scene;
    ensureCoachTextures(scene);
    this.root = scene.add.container(0, 0).setDepth(DEPTH);
    this.plates = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.line = new Label(scene, GAME_WIDTH / 2, 0, '', { align: 'center', color: CH.cream });
    this.count = new Label(scene, GAME_WIDTH - 6, 0, '', { align: 'right', color: CH.gold });
    this.glyph = new Label(scene, GAME_WIDTH - 7, 0, '...', {
      align: 'center',
      color: CH.creamDim,
    });
    this.tagLabel = new Label(scene, 0, 0, '', { color: CH.gold });
    this.ring = scene.add.image(0, 0, COACH_RING).setVisible(false);
    this.hand = scene.add.image(0, 0, COACH_HAND).setOrigin(0.27, 0.06).setVisible(false);
    // Only the "..." at the end of the line is a button (Skip guide / Back): the rest of the line lets touches
    // through to the world, so a tap aimed at something near the top is never swallowed.
    this.barZone = scene.add.zone(0, 0, GLYPH_HIT, GLYPH_HIT).setOrigin(0.5, 0.5).setInteractive();
    this.barZone.on('pointerup', () => this.tapLine());
    // Every touch counts toward an info line ("Days end at 2 AM...") and closes the line's menu if it is
    // outside it.
    scene.input.on('pointerdown', this.onAnyTouch, this);
    this.root.add([
      this.plates,
      this.marks,
      this.ring,
      this.line,
      this.count,
      this.glyph,
      this.tagLabel,
      this.barZone,
      this.hand,
    ]);
    this.root.setVisible(false);
    this.barZone.disableInteractive();
    this.cleanup.push(
      gameEvents.on('settingsChanged', () => {
        if (this.welcomeParts.length) this.buildWelcome();
        if (this.menuOpen) this.buildMenu();
      }),
    );
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onAnyTouch, this);
    this.cleanup.forEach((c) => c());
    setCoachContext(null, { panel: null, tab: null });
    this.root.destroy();
  }

  get active(): boolean {
    return this.view !== null && this.root.visible;
  }

  /** The Hud's toast hook: while a step shows, a refusal appears in the coach line, not as a second message. */
  intercept(text: string, kind: 'info' | 'warn' | 'good'): boolean {
    if (kind !== 'warn' || !this.active) return false;
    this.flash = { text: rewriteRefusal(text), until: this.scene.time.now + 2400 };
    this.refusals++;
    return true;
  }

  /** What the coach shows (debug and e2e). */
  debug(): unknown {
    return {
      step: this.view?.step.id ?? null,
      text: this.view ? this.lineText() : null,
      pointer: this.view?.pointer ?? null,
      away: this.view?.away ?? false,
      tag: this.view?.tag ?? null,
      aim: this.aim,
      visible: this.root.visible,
      welcome: this.welcomeParts.length > 0 && this.welcomeVisible(),
      stepMs: Math.round(this.stepMs),
      refusals: this.refusals,
    };
  }

  update(time: number, delta: number): void {
    const s = getState();
    // Off (skipped, finished or never started): no work at all each frame.
    const world = tutorialOn(s) ? this.host.world() : null;
    if (!world) {
      if (this.view || this.root.visible) {
        this.view = null;
        runtime.coaching = false;
        setCoachContext(null, { panel: null, tab: null });
        this.root.setVisible(false);
        this.barZone.disableInteractive();
      }
      return;
    }
    const facts: CoachFacts = {
      ...this.host.facts(),
      touches: this.touches,
      touchStep: this.stepId,
    };
    // The stat watcher may advance between frames: it must never see this frame's touches (they belong to the
    // step showing now, not to one that a stat change shows next).
    setCoachContext(world, { ...facts, touches: 0 });
    const { current, completed } = advance(s, world, facts);
    if (completed.length && current?.id !== this.stepId) {
      audio.play('confirm');
      haptic('tick');
    }
    // Ship all: the bin closes by itself once its step is over (it may have finished in the stat watcher).
    if (this.stepId && current?.id !== this.stepId && tutorialStep(this.stepId)?.closeSheet)
      this.host.openModal()?.close();
    if (current && current.id !== this.stepId) {
      this.stepId = current.id;
      this.stepMs = 0;
      this.shownAt = this.scene.time.now;
      this.touches = 0;
      this.flash = null;
      this.closeMenu();
    } else if (!current) this.stepId = null;
    if (this.menuOpen && time - this.menuAt > MENU_MS) this.closeMenu();
    if (!runtime.blocked) this.stepMs += delta;
    this.view = current ? coachView(s, world, facts, current) : null;
    // The button a step points at is not in the open sheet (another page of it): lead out of the sheet instead.
    const v = this.view;
    if (v?.pointer?.kind === 'button' && facts.panel && !this.findButton(v.pointer.pattern))
      this.view = {
        ...v,
        text: 'Close this to carry on.',
        pointer: { kind: 'button', pattern: CLOSE_BUTTON },
      };
    // Progress (a count moving, the target changing) restarts the stall clock that escalates the marks.
    const progress = this.view ? `${this.view.count}|${JSON.stringify(this.view.pointer)}` : '';
    if (progress !== this.progressKey) {
      this.progressKey = progress;
      this.stepMs = 0;
    }
    // While a sheet is open, only a step that points inside it (or into the HUD) shows.
    const show = !!this.view && !runtime.busy && facts.panel !== 'summary';
    runtime.coaching = show;
    this.root.setVisible(show);
    // Hidden parts must never swallow a touch meant for the world.
    if (show) this.barZone.setInteractive();
    else this.barZone.disableInteractive();
    if (!show || !this.view) {
      this.aim = null;
      if (this.welcomeParts.length) this.dropWelcome();
      if (this.menuOpen) this.closeMenu();
      return;
    }
    this.assistFacing(s, world, delta);
    this.draw(time, world);
  }

  // ---- drawing ----

  private welcomeVisible(): boolean {
    // Only until the first thing is done: then the strip gets out of the way of the world.
    const s = getState();
    return this.view?.step.id === 'harvest' && !stepDone(s, 'harvest') && !s.stats['harvested'];
  }

  private lineText(): string {
    if (this.flash && this.flash.until > this.scene.time.now) return this.flash.text;
    return this.view?.text ?? '';
  }

  private draw(time: number, world: CoachScreenWorld): void {
    const view = this.view!;
    const calm = getState().settings.reduceMotion;
    const left = getState().settings.leftHanded;
    const g = this.plates;
    const m = this.marks;
    g.clear();
    m.clear();
    let y = HUD_H + 2;
    // HUD tag row: an outline on the element, its name just below the HUD.
    if (view.tag) {
      const b = HUD_BOX[view.tag];
      const a = calm ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(time / 260));
      m.lineStyle(2, CH.gold, a).strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
      if (view.tag !== 'hotbar') {
        this.tagLabel
          .setText(`^ ${b.label}`)
          .setPosition(Math.min(b.x + 4, 160), y)
          .setVisible(true);
        y += 11;
      } else this.tagLabel.setVisible(false);
    } else this.tagLabel.setVisible(false);
    // Welcome strip (the first step only).
    // The strip gives way when the target would sit under it or off screen (the player wandered first).
    const p = view.pointer;
    const sc = p?.kind === 'tile' ? world.screen(p.tx, p.ty) : null;
    const clear =
      !sc ||
      (sc.y > y + WELCOME_H + BAR_H + 12 &&
        sc.y < WORLD_VIEW.y + WORLD_VIEW.h &&
        sc.x > 0 &&
        sc.x < GAME_WIDTH);
    const welcomeOn = this.welcomeVisible() && clear;
    if (welcomeOn && !this.welcomeParts.length) this.buildWelcome();
    if (!welcomeOn && this.welcomeParts.length) this.dropWelcome();
    if (welcomeOn) {
      drawPanel(g, 3, y, 194, WELCOME_H, undefined, undefined, 'chrome');
      this.placeWelcome(y);
      y += WELCOME_H + 2;
    }
    // The coach line: at the top of the world, or at its bottom while the target sits right under the top.
    const top = y;
    if (sc && sc.x > 0 && sc.x < GAME_WIDTH) {
      if (sc.y < top + BAR_H + 14 && sc.y > WORLD_VIEW.y) this.barLow = true;
      else if (sc.y > top + BAR_H + 30 || sc.y < WORLD_VIEW.y) this.barLow = false;
    } else this.barLow = false;
    if (this.barLow) y = WORLD_VIEW.y + WORLD_VIEW.h - BAR_H - 4;
    if (this.menuOpen) {
      drawPanel(g, 3, y, 194, BAR_H + 10, undefined, undefined, 'chrome');
      this.placeMenu(y + 3);
      this.line.setVisible(false);
      this.glyph.setVisible(false);
      this.count.setVisible(false);
      this.barZone.setPosition(-100, -100);
      this.ring.setVisible(false);
      this.hand.setVisible(false);
      this.aim = null; // nothing is pointed at while the menu shows
      return;
    }
    drawPanel(g, 3, y, 194, BAR_H, undefined, undefined, 'chrome');
    const flashing = !!this.flash && this.flash.until > this.scene.time.now;
    this.line
      .setText(fitText(this.lineText(), COACH_LINE_PX))
      .setColor(flashing ? CH.gold : CH.cream)
      .setPosition(left ? 105 : 95, y + 5)
      .setVisible(true);
    const nextable = !!view.step.optional && this.stepMs >= NEXT_MS;
    const gx = left ? 8 : GAME_WIDTH - 8;
    this.glyph
      .setText(nextable ? '>' : '...')
      .setPosition(gx, y + 4)
      .setVisible(true);
    this.count.setVisible(false); // the goal bar already counts
    this.barZone.setPosition(gx, y + BAR_H / 2);
    this.drawPointer(
      time,
      view.pointer,
      world,
      calm,
      left,
      this.barLow ? top : y + BAR_H + 4,
      this.barLow ? y - 4 : WORLD_VIEW.y + WORLD_VIEW.h - 8,
    );
  }

  private drawPointer(
    time: number,
    p: Pointer | null,
    world: CoachScreenWorld,
    calm: boolean,
    left: boolean,
    topY: number,
    bottomY: number,
  ): void {
    const m = this.marks;
    const escalated = this.stepMs >= ESCALATE_MS;
    const pulse = calm ? 1.1 : 1 + (escalated ? 0.45 : 0.25) * (0.5 + 0.5 * Math.sin(time / 170));
    this.aim = null;
    if (!p) {
      this.ring.setVisible(false);
      this.hand.setVisible(false);
      return;
    }
    const L = this.host.layout();
    let at: { x: number; y: number } | null = null;
    let r = 8;
    let edge: { x: number; y: number; ang: number } | null = null;
    if (p.kind === 'tile') {
      const sc = world.screen(p.tx, p.ty);
      const minY = Math.max(WORLD_VIEW.y + 8, topY + 4);
      const maxY = bottomY;
      if (sc.x < 6 || sc.x > GAME_WIDTH - 6 || sc.y < minY || sc.y > maxY) {
        // Off screen (or under the coach's own strip): an arrow where the way to it leaves the visible world,
        // so tapping the arrow always walks the farmer toward the target.
        const me = world.screen(world.tile.tx, world.tile.ty);
        const e = edgePoint(me, sc, { x0: 10, x1: GAME_WIDTH - 10, y0: minY + 4, y1: maxY - 2 });
        edge = { x: e.x, y: e.y, ang: Math.atan2(sc.y - e.y, sc.x - e.x) };
        at = { x: e.x, y: e.y };
      } else at = sc;
      r = 9;
      this.aim = edge
        ? { x: Math.round(at.x), y: Math.round(at.y), kind: 'edge' }
        : { x: Math.round(at.x), y: Math.round(at.y), kind: 'tap' };
    } else if (p.kind === 'ui') {
      const spot = p.id === 'action' ? L.action : p.id === 'menu' ? L.menu : L.interact;
      at = { x: spot.x, y: spot.y };
      r = spot.r + 2;
      if (p.tile) {
        const sc = world.screen(p.tile.tx, p.tile.ty);
        m.lineStyle(1, CH.gold, 0.9).strokeRect(sc.x - 8, sc.y - 8, 16, 16);
      }
      this.aim = { x: spot.x, y: spot.y, kind: 'tap' };
    } else if (p.kind === 'slot') {
      at = { x: HOTBAR_X + p.slot * (SLOT + 1) + SLOT / 2, y: HOTBAR_Y + SLOT / 2 };
      r = 13;
      this.aim = { x: Math.round(at.x), y: Math.round(at.y), kind: 'tap' };
    } else if (p.kind === 'button') {
      const b = this.findButton(p.pattern);
      if (b) {
        at = { x: b.x, y: b.y };
        r = Math.max(10, Math.min(18, b.h / 2 + 3));
        this.aim = { x: Math.round(b.x), y: Math.round(b.y), kind: 'tap' };
      }
    } else if (p.kind === 'hud') {
      const b = HUD_BOX[p.id];
      m.lineStyle(2, CH.gold, calm ? 1 : 0.5 + 0.5 * Math.abs(Math.sin(time / 200))).strokeRect(
        b.x - 1,
        b.y - 1,
        b.w + 2,
        b.h + 2,
      );
      this.ring.setVisible(false);
      this.hand.setVisible(false);
      return;
    } else if (p.kind === 'stick') {
      // A drag anywhere off the buttons steers: the hand drags from the open dock the way to go.
      const home = L.stickHome;
      const d = VEC[p.dir];
      const cycle = calm ? 0.6 : (time % 1600) / 1600;
      const k = Math.min(1, cycle / 0.35);
      m.lineStyle(1, CH.cream, 0.5).strokeCircle(home.x, home.y, 18);
      const ex = home.x + d[0] * 26;
      const ey = home.y + d[1] * 26;
      m.lineStyle(2, CH.gold, 1).lineBetween(home.x, home.y, ex, ey);
      const ang = Math.atan2(d[1], d[0]);
      m.fillStyle(CH.gold, 1).fillTriangle(
        ex + Math.cos(ang) * 5,
        ey + Math.sin(ang) * 5,
        ex + Math.cos(ang + 2.4) * 6,
        ey + Math.sin(ang + 2.4) * 6,
        ex + Math.cos(ang - 2.4) * 6,
        ey + Math.sin(ang - 2.4) * 6,
      );
      this.ring.setVisible(false);
      this.placeHand(home.x + d[0] * 26 * k, home.y + d[1] * 26 * k, left);
      this.aim = { x: home.x, y: home.y, kind: 'stick', dir: p.dir };
      return;
    } else if (p.kind === 'paint' || p.kind === 'ring') {
      at = { x: L.action.x, y: L.action.y };
      r = L.action.r + 2;
      const dir = p.kind === 'paint' ? VEC[p.dir] : ([left ? 1 : -1, 0] as const); // the ring opens toward the middle
      // preview of the row on the world, and an arrow from Action the way to drag
      if (p.kind === 'paint')
        for (const t of p.tiles) {
          const sc = world.screen(t.tx, t.ty);
          m.lineStyle(1, CH.gold, 0.95).strokeRect(sc.x - 7, sc.y - 7, 14, 14);
        }
      const len = 30;
      const ex = at.x + dir[0] * (r + len);
      const ey = at.y + dir[1] * (r + len);
      m.lineStyle(3, CH.ink, 0.7).lineBetween(at.x + dir[0] * r, at.y + dir[1] * r, ex, ey);
      m.lineStyle(2, CH.gold, 1).lineBetween(at.x + dir[0] * r, at.y + dir[1] * r, ex, ey);
      const ang = Math.atan2(dir[1], dir[0]);
      m.fillStyle(CH.gold, 1).fillTriangle(
        ex + Math.cos(ang) * 5,
        ey + Math.sin(ang) * 5,
        ex + Math.cos(ang + 2.4) * 6,
        ey + Math.sin(ang + 2.4) * 6,
        ex + Math.cos(ang - 2.4) * 6,
        ey + Math.sin(ang - 2.4) * 6,
      );
      // the hand: press and hold (a filling arc), then slide the way of the arrow
      const cycle = calm ? 0.4 : (time % 1800) / 1800;
      const holdPart = p.kind === 'paint' ? 0.35 : 0.1;
      const slide = cycle < holdPart ? 0 : Math.min(1, (cycle - holdPart) / 0.45);
      if (p.kind === 'paint' && cycle < holdPart + 0.05)
        m.lineStyle(2, CH.cream, 0.9)
          .beginPath()
          .arc(
            at.x,
            at.y,
            r - 4,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * Math.min(1, cycle / holdPart),
          )
          .strokePath();
      this.placeHand(at.x + dir[0] * (r + len) * slide, at.y + dir[1] * (r + len) * slide, left);
      this.ring
        .setVisible(true)
        .setPosition(at.x, at.y)
        .setScale((r / 13) * (calm ? 1 : 1 + 0.1 * Math.sin(time / 170)));
      this.aim = {
        x: at.x,
        y: at.y,
        kind: p.kind,
        dir: p.kind === 'paint' ? p.dir : left ? 'right' : 'left',
      };
      return;
    }
    if (!at) {
      this.ring.setVisible(false);
      this.hand.setVisible(false);
      return;
    }
    if (edge) {
      // off screen: an arrow at the edge of the world view pointing the way
      const { x, y, ang } = edge;
      m.fillStyle(CH.ink, 0.7).fillCircle(x, y, 7);
      m.fillStyle(CH.gold, 1).fillTriangle(
        x + Math.cos(ang) * 7,
        y + Math.sin(ang) * 7,
        x + Math.cos(ang + 2.5) * 6,
        y + Math.sin(ang + 2.5) * 6,
        x + Math.cos(ang - 2.5) * 6,
        y + Math.sin(ang - 2.5) * 6,
      );
    }
    this.ring
      .setVisible(true)
      .setPosition(at.x, at.y)
      .setScale((r / 13) * pulse);
    if (escalated && !calm) {
      // the hand travels from the thumb's resting place to the target, again and again
      const f = (time % 1400) / 1400;
      const from = { x: L.action.x, y: L.action.y };
      const k = Math.min(1, f / 0.7);
      this.placeHand(from.x + (at.x - from.x) * k, from.y + (at.y - from.y) * k, left);
    } else {
      const bob = calm ? 0 : Math.max(0, Math.sin(time / 160)) * 3;
      this.placeHand(at.x + bob * 0.7, at.y + bob, left);
    }
  }

  /** The fingertip goes at (x, y); the hand sits toward the holding thumb's side. */
  private placeHand(x: number, y: number, left: boolean): void {
    this.hand
      .setVisible(true)
      .setFlipX(left)
      .setOrigin(left ? 0.73 : 0.27, 0.06)
      .setPosition(Math.round(x), Math.round(y + 2));
  }

  /** A button in the open sheet whose label matches, in screen coordinates. */
  private findButton(pattern: string): { x: number; y: number; h: number } | null {
    const modal = this.host.openModal();
    if (!modal) return null;
    // `a||b` lists patterns by priority: the first that matches any button wins.
    let found: Button | null = null;
    for (const part of pattern.split('||')) {
      const re = new RegExp(part);
      const walk = (o: Phaser.GameObjects.GameObject): void => {
        if (found) return;
        if (o instanceof Button) {
          if (o.visible && re.test(o.text)) found = o;
          return;
        }
        if (o instanceof Phaser.GameObjects.Container) o.list.forEach(walk);
      };
      walk(modal.root);
      if (found) break;
    }
    if (!found) return null;
    const b = (found as Button).getBounds();
    return { x: b.centerX, y: b.centerY, h: b.height };
  }

  // ---- facing assist ----

  /**
   * Standing still on the spot the coach pointed at (a tile beside soil), the farmer turns to face the soil, so
   * the next Action works there. Only after 350 ms still, only on that spot.
   */
  private assistFacing(s: GameState, world: CoachScreenWorld, delta: number): void {
    const p = this.view?.pointer;
    const key = `${world.tile.tx},${world.tile.ty}`;
    if (key !== this.lastTile) {
      this.lastTile = key;
      this.stillMs = 0;
    } else this.stillMs += delta;
    if (!p || p.kind !== 'tile' || !p.face) return;
    if (p.tx !== world.tile.tx || p.ty !== world.tile.ty || this.stillMs < 350) return;
    if (world.facing !== p.face) faceDirection(s.player, p.face);
  }

  // ---- the line's menu: Skip guide, Next, Back ----

  private tapLine(): void {
    if (!this.view || this.menuOpen) return;
    audio.play('select');
    this.buildMenu();
  }

  /** Any touch: counts toward an info line, and a touch outside the line's menu closes it. */
  private onAnyTouch(_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.scene.time.now - this.shownAt > INFO_MIN_MS) this.touches++;
    if (!this.menuOpen) return;
    const mine = (o: Phaser.GameObjects.GameObject): boolean =>
      this.menuButtons.some((b) => b === o || b.list.includes(o));
    if (!over.some(mine)) this.closeMenu();
  }

  private closeMenu(): void {
    this.menuOpen = false;
    this.menuButtons.forEach((b) => b.destroy());
    this.menuButtons.length = 0;
  }

  /** The guide is off: say where it comes back from (once, as a plain toast). */
  private skipped(): void {
    skipTutorial(getState());
    this.closeMenu();
    this.dropWelcome();
    this.root.setVisible(false);
    this.barZone.disableInteractive();
    runtime.coaching = false;
    gameEvents.emit('toast', { text: SKIPPED_TOAST, kind: 'info' });
  }

  private buildMenu(): void {
    this.closeMenu();
    this.menuOpen = true;
    this.menuAt = this.scene.time.now;
    const nextable = !!this.view?.step.optional && this.stepMs >= NEXT_MS;
    const left = getState().settings.leftHanded;
    let armed = 0;
    type Spec = [string, (b: Button) => void, number];
    const specs: Spec[] = [
      [
        'Skip guide',
        (b) => {
          // Two taps: the first asks, the second (within 3 s) skips.
          const now = this.scene.time.now;
          this.menuAt = now;
          if (now < armed) return this.skipped();
          armed = now + 3000;
          b.setLabel('Sure? Skip');
        },
        CH.warn,
      ],
    ];
    if (nextable)
      specs.push([
        'Next',
        () => {
          if (this.view) skipStep(getState(), this.view.step.id);
          this.closeMenu();
        },
        CH.cream,
      ]);
    specs.push(['Back', () => this.closeMenu(), CH.cream]);
    const w = Math.floor((190 - (specs.length - 1) * 4) / specs.length);
    // Back (the safe choice) sits nearest the thumb; Skip farthest from it.
    const order = left ? [...specs].reverse() : specs;
    order.forEach(([label, fn, color], i) => {
      const b: Button = new Button(this.scene, 5 + i * (w + 4), 0, w, 20, label, () => fn(b), {
        textColor: color,
      });
      this.root.add(b);
      this.menuButtons.push(b);
    });
  }

  private placeMenu(y: number): void {
    this.menuButtons.forEach((b) => b.setY(y + 1));
  }

  // ---- welcome strip ----

  private dropWelcome(): void {
    this.welcomeParts.forEach((p) => p.destroy());
    this.welcomeParts = [];
    this.welcomeSkip = null;
    this.welcomeLeft = null;
  }

  private buildWelcome(): void {
    this.dropWelcome();
    const w = welcome();
    const s = getState();
    const left = s.settings.leftHanded;
    const portrait = this.scene.add.image(0, 0, npcTexture(w.npc), npcFrame(w.npc, 'down', 0));
    portrait.setOrigin(0.5, 1);
    const name = new Label(this.scene, 0, 0, w.name.toUpperCase(), { color: CH.gold });
    const text = new Label(this.scene, 0, 0, w.text, { color: CH.cream, maxWidth: 158 });
    this.welcomeLeft = new Button(
      this.scene,
      0,
      0,
      78,
      20,
      s.settings.leftHanded ? 'Left hand: ON' : 'Left hand',
      () => {
        toggleLeftHanded(getState());
        gameEvents.emit('settingsChanged', undefined);
      },
      { textColor: CH.cream },
    );
    this.welcomeSkip = new Button(
      this.scene,
      0,
      0,
      78,
      20,
      'Skip guide',
      () => {
        const now = this.scene.time.now;
        if (now < this.skipArmedUntil) return this.skipped();
        this.skipArmedUntil = now + 3000;
        this.welcomeSkip?.setLabel('Sure? Skip');
        this.scene.time.delayedCall(3000, () => {
          if (this.welcomeSkip?.active) this.welcomeSkip.setLabel('Skip guide');
        });
      },
      { textColor: CH.warn },
    );
    this.welcomeParts = [portrait, name, text, this.welcomeLeft, this.welcomeSkip];
    this.root.addAt(this.welcomeParts, 2);
    this.welcomeLeftHand = left;
  }

  private welcomeLeftHand = false;

  private placeWelcome(y: number): void {
    const [portrait, name, text] = this.welcomeParts as [Phaser.GameObjects.Image, Label, Label];
    const left = this.welcomeLeftHand;
    portrait.setPosition(18, y + 32);
    name.setPosition(34, y + 5);
    text.setPosition(34, y + 15);
    // Skip sits farthest from the holding thumb, Left hand nearest it
    const xs = left ? [112, 30] : [30, 112];
    this.welcomeSkip?.setPosition(xs[0]!, y + 36);
    this.welcomeLeft?.setPosition(xs[1]!, y + 36);
  }
}
