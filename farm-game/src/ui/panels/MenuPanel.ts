import Phaser from 'phaser';
import { game, items } from '../../data';
import { saveNow } from '../../game/persistence';
import { audio } from '../../platform/audio';
import { fullscreenSupported, isIosSafari, toggleFullscreen } from '../../platform/display';
import { haptic, setHapticsEnabled } from '../../platform/haptics';
import { getState } from '../../state/store';
import { waterCapacity } from '../../systems/actions';
import { maxEnergy } from '../../systems/energy';
import { gameEvents, toast } from '../../systems/events';
import { asideGoals, goalProgress, recentGoals, stat } from '../../systems/goals';
import { valleyLines } from './valleyText';
import {
  isTaken,
  jobLabel,
  jobProgress,
  jobReady,
  welcomeFactor,
  welcomeJobsHeader,
} from '../../systems/jobs';
import { absoluteDay } from '../../systems/time';
import { fitRow, Label, measureText } from '../font';
import { wrapText } from '../fontMetrics';
import { bagGeom, bagSlotAt, LIFT_MS, movedToLift, slotXY, type BagGeom } from '../bagGrid';
import { equipFromBag, isToolSlot, selectSlot, swapSlots } from '../../systems/inventory';
import { isShippable } from '../../systems/economy';
import { dishText, eat, eatGain, foodEnergy, tooFullFor } from '../../systems/food';
import { displayName, iconKey, refOf, sellValue } from '../../systems/itemRef';
import {
  adjustVolume,
  toggleLeftHanded,
  toggleMute,
  toggleReduceMotion,
  toggleVibration,
} from '../../systems/settings';
import { C, CH } from '../theme';
import { Button, drawBar, drawSlot, Modal, type ButtonStyle, type RowSpec } from '../widgets';
import { fmt } from './format';
import { buildBook } from './GuideTab';
import { tabHidden } from '../../systems/reveal';
import { tabLabel } from './tabLabels';
import { menuTabGrid } from '../layout';
import { buildCraft } from './CraftTab';
import { buildSkills } from './SkillsTab';
import { buildControlsPage, controlsPage, drawHelpCard } from './ControlsTab';
import { fmtGold, t } from '../../i18n';
import { chooseLanguage, nextLanguage } from '../../game/language';
import { onOff } from './onOff';
import { cloudSync } from '../../game/cloudWiring';
import { buildCloudPage, cloudPage } from './CloudTab';
import { cloudStatusLine } from './cloudText';
import { analytics } from '../../platform/analytics';

/** What a menu tab can draw with. Tabs are plain functions, so new mechanics add a tab, not a panel. */
export interface MenuTabContext {
  readonly width: number;
  readonly height: number;
  /** y where tab content starts (below the tab strip). */
  readonly top: number;
  /** y where tab content must end (above the Close button). */
  readonly bottom: number;
  scene: Phaser.Scene;
  label: (
    x: number,
    y: number,
    text: string,
    color?: number,
    scale?: number,
    align?: 'left' | 'center' | 'right',
    maxWidth?: number,
  ) => Label;
  button: (
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    onClick: () => void,
    style?: ButtonStyle,
  ) => Button;
  icon: (x: number, y: number, key: string, scale?: number) => Phaser.GameObjects.Image;
  row: (y: number, spec: RowSpec) => number;
  add: (obj: Phaser.GameObjects.GameObject) => void;
  rebuild: () => void;
  close: () => void;
}

export interface MenuTab {
  id: string;
  /** The tab's name, read each time the menu draws (so it follows the language). It must fit a 48 px tab. */
  label: () => string;
  build: (ctx: MenuTabContext) => void;
}

/** Tabs shown in the menu, in order. Mechanics register their own (see docs/EXTENDING.md). */
export const menuTabs: MenuTab[] = [];
export function registerMenuTab(tab: MenuTab): void {
  const at = menuTabs.findIndex((other) => other.id === tab.id);
  if (at >= 0) menuTabs[at] = tab;
  else menuTabs.push(tab);
}

/** A body-face line, and a header line with its gap under it (DECISIONS "Type scale"). */
const LINE = 13;
const HEAD = 14;

/** Up to the bottom of the HUD (the sheet height cap in ui/widgets): never over the goal plate. */
const SHEET_H = 326;

export class MenuPanel extends Modal {
  private tab = 'bag';
  private cursor: number | null = null;
  private quitState: 'idle' | 'confirm' | 'unsaved' = 'idle';

  constructor(
    scene: Phaser.Scene,
    private readonly onQuit: () => void,
  ) {
    super(scene, SHEET_H);
  }

  /** Jump to a tab by id (e.g. the goal tracker opens "goals"). A tab not introduced yet opens the bag. */
  openTab(id: string): void {
    this.tab = tabHidden(getState(), id) ? 'bag' : id;
    this.cursor = null;
    if (this.isOpen) this.rebuild();
    else this.open();
  }

  protected build(): void {
    this.panel();
    // tabs of systems the reveal schedule has not introduced yet stay hidden (systems/reveal.ts, QA round)
    const tabs = menuTabs.filter((tab) => !tabHidden(getState(), tab.id));
    // Tabs and Close share a two-row grid at the bottom (the thumb's resting place on a tall phone): 48 px tabs
    // instead of six crowded 30 px ones, Close on the thumb's side of the bottom row (ui/layout menuTabGrid).
    // the two rows 4 px apart, as buttons stack elsewhere (8 px read as an empty strip between them)
    const grid = menuTabGrid(tabs.length, this.leftHanded, this.panelW, [
      this.panelH - 54,
      this.panelH - 28,
    ]);
    tabs.forEach((tab, i) => {
      const active = tab.id === this.tab;
      const r = grid.tabs[i]!;
      this.button(r.x, r.y, r.w, r.h, tab.label(), () => this.openTab(tab.id), {
        rim: active ? C.select : C.creamDim,
        textColor: active ? C.gold : C.cream,
      });
    });
    const cr = grid.close;
    this.button(cr.x, cr.y, cr.w, cr.h, t('common.close'), () => this.close(), {
      textColor: C.warn,
    });
    const ctx: MenuTabContext = {
      width: this.panelW,
      height: this.panelH,
      top: 8,
      bottom: this.panelH - 64,
      scene: this.scene,
      label: (x, y, text, color, scale, align, maxWidth) =>
        this.label(x, y, text, color, scale, align, maxWidth),
      button: (x, y, bw, bh, text, onClick, style) =>
        this.button(x, y, bw, bh, text, onClick, style),
      icon: (x, y, key, scale) => this.icon(x, y, key, scale),
      row: (y, spec) => this.row(y, spec),
      add: (obj) => this.content.add(obj),
      rebuild: () => this.rebuild(),
      close: () => this.close(),
    };
    (tabs.find((tab) => tab.id === this.tab) ?? tabs[0])?.build(ctx);
  }

  /** The bag grid as last drawn (buildBag), for resolving a drop. */
  bag: BagGeom | null = null;
  /** A press on a bag slot: a tap until it lifts (held or moved), then a drag carrying the item. */
  private drag: {
    from: number;
    x: number;
    y: number;
    live: boolean;
    ghost: Phaser.GameObjects.Image | null;
    mark: Phaser.GameObjects.Graphics | null;
    timer: Phaser.Time.TimerEvent | null;
  } | null = null;

  /**
   * A finger down on bag slot `i`. On an item that can move (not a tool), holding it for LIFT_MS or moving it
   * past LIFT_PX lifts it; a release before that is a tap (tapSlot).
   */
  pressSlot(i: number, p: Phaser.Input.Pointer): void {
    if (this.drag) return;
    const s = getState();
    const movable = !!s.inventory.slots[i] && !isToolSlot(i);
    this.drag = { from: i, x: p.x, y: p.y, live: false, ghost: null, mark: null, timer: null };
    if (movable) this.drag.timer = this.scene.time.delayedCall(LIFT_MS, () => this.lift(p));
    this.scene.input.on('pointermove', this.onDragMove, this);
    this.scene.input.on('pointerup', this.onDragUp, this);
  }

  /** The bag drag in progress, for tests and the dev tools: the slot it came from and whether it lifted. */
  get dragging(): { from: number; live: boolean } | null {
    return this.drag ? { from: this.drag.from, live: this.drag.live } : null;
  }

  /** The press becomes a drag: the item rides above the finger, at 2x so it shows past the thumb. */
  private lift(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || d.live || !this.isOpen) return;
    const stack = getState().inventory.slots[d.from];
    if (!stack || isToolSlot(d.from)) return;
    d.live = true;
    d.timer?.remove();
    d.timer = null;
    d.mark = this.scene.add.graphics().setDepth(219);
    d.ghost = this.scene.add
      .image(0, 0, iconKey(refOf(stack)))
      .setScale(2)
      .setDepth(220);
    haptic('tick');
    audio.play('select');
    this.follow(p);
  }

  /** The ghost over the finger and a frame on the slot it would land in (gold, or red where it cannot go). */
  private follow(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d?.ghost || !d.mark || !this.bag) return;
    d.ghost.setPosition(Math.round(p.x), Math.round(p.y) - 22);
    d.mark.clear();
    const to = bagSlotAt(this.bag, p.x, p.y - this.root.y);
    if (to === null) return;
    const { x, y } = slotXY(this.bag, to);
    const ok = to === d.from || !isToolSlot(to);
    const top = this.root.y + y;
    const n = this.bag.size;
    d.mark
      .fillStyle(ok ? C.select : C.red, 1)
      .fillRect(x - 2, top - 2, n + 4, 2)
      .fillRect(x - 2, top + n, n + 4, 2)
      .fillRect(x - 2, top, 2, n)
      .fillRect(x + n, top, 2, n);
  }

  private onDragMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    if (!d.live && d.timer && movedToLift(p.x - d.x, p.y - d.y)) this.lift(p);
    if (d.live) this.follow(p);
  }

  private onDragUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    this.endDrag();
    if (!this.isOpen || !this.bag) return;
    const at = bagSlotAt(this.bag, p.x, p.y - this.root.y);
    if (!d.live) {
      // a tap: only where it began (a press that slid off its slot does nothing)
      if (at === d.from) this.tapSlot(d.from);
      return;
    }
    if (at === null || at === d.from) {
      this.rebuild();
      return;
    }
    if (swapSlots(getState(), d.from, at)) {
      audio.play('select');
      haptic('tick');
    } else audio.play('error');
    this.cursor = null;
    this.rebuild();
  }

  /** Drop the drag (its ghost, its frame, its listeners), wherever it was. */
  private endDrag(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.timer?.remove();
    d.ghost?.destroy();
    d.mark?.destroy();
    this.scene.input.off('pointermove', this.onDragMove, this);
    this.scene.input.off('pointerup', this.onDragUp, this);
  }

  override close(): void {
    this.endDrag();
    super.close();
  }

  // The remaining state the Options tab needs lives here so the tab functions below stay stateless.
  tapSlot(i: number): void {
    const s = getState();
    if (this.cursor === null) {
      if (s.inventory.slots[i]) this.cursor = i;
    } else if (this.cursor === i) {
      // The same slot again equips it (as the bag's help says): a hotbar slot is selected; an item further in
      // the bag comes to hand at once, like "Use now", without a reach across the sheet (round 3, left hand).
      this.cursor = null;
      if (i >= game.hotbarSlots && s.inventory.slots[i]) {
        equipFromBag(s, i);
        audio.play('select');
        this.close();
        return;
      }
      selectSlot(s, i);
    } else {
      if (!swapSlots(s, this.cursor, i)) audio.play('error');
      this.cursor = null;
    }
    audio.play('select');
    this.rebuild();
  }

  /** The tab showing (the guided start points at tabs). */
  get currentTab(): string {
    return this.tab;
  }

  clearCursor(): void {
    this.cursor = null;
  }

  get selectedCursor(): number | null {
    return this.cursor;
  }

  get quit(): 'idle' | 'confirm' | 'unsaved' {
    return this.quitState;
  }

  setQuit(state: 'idle' | 'confirm' | 'unsaved'): void {
    this.quitState = state;
    this.rebuild();
  }

  leave(): void {
    this.quitState = 'idle';
    this.close();
    this.onQuit();
  }
}

// ---------------------------------------------------------------- built-in tabs

/** Registered by `installMenuTabs`, which binds the tabs to a live MenuPanel. */
export function installMenuTabs(menu: MenuPanel): void {
  registerMenuTab({ id: 'bag', label: () => tabLabel('bag'), build: (c) => buildBag(c, menu) });
  registerMenuTab({ id: 'goals', label: () => tabLabel('goals'), build: buildGoals });
  registerMenuTab({ id: 'craft', label: () => tabLabel('craft'), build: buildCraft });
  registerMenuTab({ id: 'skills', label: () => tabLabel('skills'), build: buildSkills });
  registerMenuTab({ id: 'book', label: () => tabLabel('book'), build: buildBook });
  registerMenuTab({
    id: 'opts',
    label: () => tabLabel('opts'),
    build: (c) => buildOptions(c, menu),
  });
}

function buildBag(c: MenuTabContext, menu: MenuPanel): void {
  const s = getState();
  // The grid sits at the bottom of the sheet, right above the tabs, where the thumb already is.
  // A Bigger Bag adds whole rows; the grid grows upward so it stays next to the thumb.
  const geom = bagGeom(s.inventory.slots.length, c.bottom);
  menu.bag = geom;
  const { size, y0 } = geom;
  const g = c.scene.add.graphics();
  c.add(g);
  const cursor = menu.selectedCursor;
  s.inventory.slots.forEach((stack, i) => {
    const { x, y } = slotXY(geom, i);
    drawSlot(g, x, y, size, i === cursor, i < game.hotbarSlots);
    if (i === s.inventory.selected)
      g.lineStyle(1, C.select, 1).strokeRect(x - 1.5, y - 1.5, size + 3, size + 3);
    if (stack) {
      const ref = refOf(stack);
      c.icon(x + size / 2, y + size / 2, iconKey(ref));
      if (!isToolSlot(i) && stack.qty > 1)
        // parchment on an ink outline, as on the hotbar: ink alone vanished over a dark icon
        c.add(
          new Label(c.scene, x + size - 2, y + size - 9, String(stack.qty), {
            align: 'right',
            color: CH.cream,
            outline: CH.ink,
            face: 'small', // a count over an icon keeps the small face
          }),
        );
      // quality stars in the top corner: at the bottom the second one sat on a two-digit count
      if (ref.q) c.icon(x + size - 5, y + 5, 'ui_star').setTint(ref.q >= 2 ? 0xf4d35e : 0xc9d3e4);
      if ((ref.q ?? 0) >= 2) c.icon(x + size - 11, y + 5, 'ui_star').setTint(0xf4d35e);
    }
    // the whole pitch, so the zones meet; a press is a tap or the start of a drag (menu.pressSlot)
    const zone = c.scene.add.zone(x, y, geom.pitch, geom.pitch).setOrigin(0, 0).setInteractive();
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => menu.pressSlot(i, p));
    c.add(zone);
  });

  const cur = cursor !== null ? s.inventory.slots[cursor] : null;
  // A dish, wherever it sits: one tap eats it (cooking is how a long day gets longer).
  const gain = eatGain(s, cur?.item);
  let floor = y0 - 3;
  if (cur && cursor !== null && foodEnergy(cur.item) > 0) {
    floor = y0 - 28;
    c.button(
      110,
      y0 - 26,
      82,
      22,
      tooFullFor(s, cur.item) ? t('bag.notHungry') : t('bag.eat', { n: gain }),
      () => {
        if (eat(getState(), cursor) === 'full') {
          audio.play('error');
          toast(t('food.notHungry'), 'info');
        } else audio.play('select');
        menu.clearCursor(); // the next slot tap selects, never swaps (critique 8, F6)
        c.rebuild();
      },
      tooFullFor(s, cur.item)
        ? { textColor: C.creamDim, rim: C.creamDim }
        : { textColor: C.green, rim: C.green },
    );
  }
  // A bag item picked: one tap puts it in your hand and closes the menu (no slot juggling).
  else if (cur && cursor !== null && cursor >= game.hotbarSlots) {
    floor = y0 - 28;
    c.button(
      s.settings.leftHanded ? 8 : 110, // on the thumb's side
      y0 - 26,
      82,
      22,
      t('bag.useNow'),
      () => {
        equipFromBag(getState(), cursor);
        audio.play('select');
        menu.clearCursor(); // the item left the bag: reopening must not show a stale selection
        c.close();
      },
      { textColor: C.green, rim: C.green },
    );
  }
  // The text above the grid is a flow, in priority order: each line shows only while it fits above the grid (and
  // the Eat / Use button), so a long description or Portuguese never runs into the slots.
  let y = c.top - 1;
  const line = (text: string, color: number, x = 8, width = 184): boolean => {
    const h = wrapText(text, width).length * LINE - 2;
    if (y + h > floor) return false;
    c.label(x, y, text, color, 1, 'left', width);
    y += h + 3;
    return true;
  };
  if (cur) {
    const ref = refOf(cur);
    const def = items[cur.item]!;
    c.icon(16, y + 6, iconKey(ref));
    line(displayName(ref), C.gold, 30, 160);
    // A dish says today's energy (less from the 4th dish of a day).
    line(foodEnergy(cur.item) > 0 ? dishText(s, cur.item) : def.description, C.cream);
    // Only say what the bin pays for things the bin takes (machines and decorations are kept, not sold).
    if (isShippable(ref)) line(t('bag.sellsFor', { gold: fmtGold(sellValue(ref)) }), C.creamDim);
    if (def.buyPrice) line(t('bag.costs', { gold: fmtGold(def.buyPrice) }), C.creamDim);
  } else {
    line(t('bag.title'), C.gold);
    line(t('bag.helpDrag'), C.creamDim);
    y += 2;
    line(
      t('bag.meters', {
        energy: s.energy,
        maxEnergy: maxEnergy(s),
        water: s.water,
        maxWater: waterCapacity(s),
      }),
      C.creamDim,
    );
    line(t('bag.gold', { gold: fmtGold(s.money) }), C.gold);
    // Wrapped: on one line it ran 58 px off the sheet (critique 12, F6).
    line(t('bag.tip'), C.creamDim);
  }
}

function buildGoals(c: MenuTabContext): void {
  const s = getState();
  const prog = goalProgress(s);
  // THE VALLEY: one row per asked place and its next step (systems/valley.ts), above the goals.
  const rows = valleyLines(s);
  let top = c.top + 2;
  if (rows.length > 0) {
    c.label(8, top, t('goals.valley'), C.gold);
    top += HEAD;
    for (const r of rows) {
      c.label(8, top, r, C.cream);
      top += LINE;
    }
    top += 4;
  }
  c.label(8, top, t('goals.current'), C.gold);
  let y = top + HEAD;
  if (prog) {
    // a flow: a goal or hint that wraps pushes what follows down
    y += c.label(8, y, prog.goal.text, C.cream, 1, 'left', 184).textHeight + 3;
    const g = c.scene.add.graphics();
    drawBar(g, 8, y, 184, 7, prog.value / prog.goal.target, C.gold);
    c.add(g);
    y += 10;
    c.label(192, y, `${fmt(prog.value)}/${fmt(prog.goal.target)}`, C.gold, 1, 'right');
    c.label(8, y, t('goals.reward', { gold: fmtGold(prog.goal.reward) }), C.green);
    y += LINE;
    y +=
      c.label(8, y, t('ui.hint', { hint: prog.goal.hint }), C.creamDim, 1, 'left', 184).textHeight +
      2;
  } else {
    y += c.label(8, y, t('goals.allDone'), C.green, 1, 'left', 184).textHeight + 2;
  }
  y += 6;
  // Rows below never run into STATS at the bottom (THE VALLEY can push them down).
  const floor = c.bottom - 4 * LINE - HEAD - 4;
  // Today's jobs: small requests posted on the town board, whatever the goal chain says.
  const today = s.jobs.day === absoluteDay(s) ? s.jobs.list : [];
  c.label(8, y, welcomeJobsHeader(today.length > 0 ? welcomeFactor(s.jobs.day) : 1), C.gold);
  y += HEAD;
  if (today.length === 0) {
    c.label(8, y, t('goals.jobsEveryMorning'), C.creamDim);
    y += LINE;
  }
  for (const job of today) {
    // Jobs are taken and turned in at the town board: a job still there says so, a finished one says to turn it in.
    const right = job.done
      ? t('common.done')
      : !isTaken(s, job)
        ? `${t('jobs.atBoard')} +${fmtGold(job.reward)}`
        : jobReady(s, job)
          ? `${t('jobs.turnIn')} +${fmtGold(job.reward)}`
          : `${jobProgress(s, job)}/${job.n} +${fmtGold(job.reward)}`;
    c.label(192, y, right, job.done ? C.green : isTaken(s, job) ? C.gold : C.creamDim, 1, 'right');
    c.label(
      8,
      y,
      fitRow(jobLabel(job), 184 - measureText(right) - 6),
      job.done ? C.creamDim : C.cream,
    );
    y += LINE;
  }
  y += 4;
  // A goal the chain does not wait for (a legendary fish) stays in view here while the next one is current.
  const aside = asideGoals(s);
  c.label(8, y, t('goals.completed'), C.gold);
  y += HEAD;
  const done = recentGoals(s, aside.length > 0 ? 1 : 2);
  if (done.length === 0) c.label(8, y, t('goals.nothingYet'), C.creamDim);
  for (const d of done) {
    if (y + LINE > floor) break;
    const row = c.label(8, y, `+ ${d.text}`, C.creamDim, 1, 'left', 184);
    y += row.textHeight + 3;
  }
  if (aside.length > 0 && y + HEAD + LINE <= floor) {
    y += 3;
    c.label(8, y, t('goals.alsoOpen'), C.gold);
    y += HEAD;
    // Two rows at most: the oldest open goal, then either the next or a count of the rest.
    const shown = aside.length > 2 ? aside.slice(0, 1) : aside;
    for (const g of shown) {
      const right = `${fmt(Math.min(g.target, stat(s, g.stat)))}/${fmt(g.target)}`;
      c.label(192, y, right, C.gold, 1, 'right');
      c.label(8, y, fitRow(g.text, 184 - measureText(right) - 6), C.cream);
      y += LINE;
    }
    if (aside.length > shown.length)
      c.label(8, y, t('goals.moreOpen', { count: aside.length - shown.length }), C.creamDim);
  }
  y = c.bottom - 4 * LINE - HEAD + 2;
  c.label(8, y, t('goals.stats'), C.gold);
  const stats: [string, number][] = [
    [t('stats.earned'), stat(s, 'earned')],
    [t('stats.harvested'), stat(s, 'harvested')],
    [t('stats.planted'), stat(s, 'planted')],
    [t('stats.slept'), stat(s, 'daysSlept')],
  ];
  stats.forEach(([name, v], i) => {
    c.label(8, y + HEAD + i * LINE, name, C.creamDim);
    c.label(192, y + HEAD + i * LINE, fmt(v), C.cream, 1, 'right');
  });
}

function buildOptions(c: MenuTabContext, menu: MenuPanel): void {
  if (controlsPage.open)
    return buildControlsPage(c, () => {
      controlsPage.open = false;
      c.rebuild();
    });
  if (cloudPage.open && cloudSync.usable)
    return buildCloudPage(c, () => {
      cloudPage.open = false;
      c.rebuild();
    });
  const s = getState();
  const apply = () => audio.setVolumes(s.settings.music, s.settings.sfx, s.settings.muted);
  const volumeRow = (y: number, name: string, key: 'music' | 'sfx') => {
    c.label(8, y + 8, name);
    const step = (d: number) => {
      adjustVolume(s, key, d);
      apply();
      if (key === 'sfx') audio.play('coin');
      c.rebuild();
    };
    c.button(46, y, 24, 22, '-', () => step(-0.1));
    const g = c.scene.add.graphics();
    drawBar(g, 74, y + 7, 68, 8, s.settings[key], C.green);
    c.add(g);
    c.button(146, y, 24, 22, '+', () => step(0.1));
    c.label(174, y + 8, `${Math.round(s.settings[key] * 100)}%`, C.creamDim);
  };
  // Laid out from the bottom of the tab area up (the rows end right above the tab strip, where the thumb
  // already is) rather than from the top of a tall sheet.
  // Rows: the language (with the autosave note beside it), Save/Quit, three rows of switches, then the volumes.
  const STACK_H = 26 + 26 + 26 + 26 + 26 + 32 + 22;
  let y = Math.max(c.top + 4, c.bottom - STACK_H);
  // How to play, two taps from anywhere (Menu, Opts), in the space above the rows.
  if (y - c.top >= 60) drawHelpCard(c, 8, c.top);
  // The volume rows go last, nearest the tabs: their small -/+ buttons sit at both edges, which only the
  // lowest rows keep in reach for either thumb.
  const half = 92;
  // Each row puts its more used switch in the column on the holding thumb's side (mirrored for the left hand).
  const thumbX = s.settings.leftHanded ? 8 : 100;
  const farX = s.settings.leftHanded ? 100 : 8;
  // The language heads the rows: one tap steps to the next and every text redraws (the open menu right now).
  // The autosave note sits beside it, two short lines in the far column.
  c.button(thumbX, y, half, 22, t('opts.language', { lang: t('lang.short') }), () => {
    void chooseLanguage(nextLanguage());
    c.rebuild();
  });
  if (cloudSync.usable) {
    // Cloud save (game/cloudSync.ts), where a provider exists: its page beside the language, its state in one line
    // above the rows. The autosave note moves onto that page. Without a provider Options is exactly as before.
    const st = cloudSync.status;
    const out = st.state === 'off' || st.state === 'signedOut' || st.state === 'signingIn';
    const entry = out ? t('cloud.entrySignIn') : t('cloud.entryOn');
    const openPage = () => {
      cloudPage.open = true;
      c.rebuild();
    };
    c.button(farX, y, half, 22, entry, openPage, { textColor: C.gold });
    c.label(8, y - 14, fitRow(cloudStatusLine(st, Date.now()), 184), C.creamDim);
  } else {
    c.label(farX, y - 1, t('opts.autosave1'), C.creamDim);
    c.label(farX, y + 11, t('opts.autosave2'), C.creamDim);
  }

  const pair = (
    yy: number,
    thumb: [string, () => void, number?],
    far?: [string, () => void, number?],
  ) => {
    c.button(thumbX, yy, half, 22, thumb[0], thumb[1], { textColor: thumb[2] ?? C.cream });
    if (far) c.button(farX, yy, half, 22, far[0], far[1], { textColor: far[2] ?? C.cream });
  };
  // Top to bottom: the rarely used rows first (Save, Quit), the switches people flip mid-play last, just
  // above the volume rows and the tab strip (round 3: Sound and Vibrate were in the top row, hard for the
  // right and the left thumb respectively).
  y += 26;
  const saveBtn: Button = c.button(thumbX, y, half, 22, t('opts.saveNow'), () => {
    void saveNow().then((ok) => {
      saveBtn.setLabel(ok ? t('opts.saved') : t('opts.saveFailed'));
      saveBtn.setTextColor(ok ? C.green : C.red);
      if (!ok) toast(t('opts.saveUnavailable'), 'warn');
    });
  });
  const q = menu.quit;
  c.button(
    farX,
    y,
    half,
    22,
    q === 'confirm' ? t('opts.tapAgain') : q === 'unsaved' ? t('opts.quitAnyway') : t('opts.quit'),
    () => {
      if (q === 'idle') return menu.setQuit('confirm');
      if (q === 'unsaved') return menu.leave();
      void saveNow().then((ok) => {
        if (ok) menu.leave();
        else {
          // Never discard a session the player believes is saved.
          toast(t('opts.couldNotSave'), 'warn');
          menu.setQuit('unsaved');
        }
      });
    },
    { textColor: q === 'idle' ? C.cream : C.warn },
  );
  y += 26;
  pair(
    y,
    [
      t('opts.leftHand', { state: onOff(s.settings.leftHanded) }),
      () => {
        toggleLeftHanded(s);
        gameEvents.emit('settingsChanged', undefined);
        c.rebuild();
      },
    ],
    // With analytics in the build (none by default), its opt-out takes this cell and Fullscreen moves to Controls...
    analytics.enabled
      ? [
          t('privacy.toggle', { state: onOff(analytics.consent === 'granted') }),
          () => {
            analytics.setConsent(analytics.consent !== 'granted');
            c.rebuild();
          },
        ]
      : fullscreenSupported()
        ? [t('opts.fullscreen'), () => void toggleFullscreen()]
        : undefined,
  );
  if (!analytics.enabled && !fullscreenSupported() && isIosSafari()) {
    c.label(farX, y - 1, t('opts.addHome1'), C.creamDim);
    c.label(farX, y + 11, t('opts.addHome2'), C.creamDim);
  }
  y += 26;
  // Sound and Vibrate both on the thumb's side, in the two lowest rows (the far column is a stretch there).
  pair(
    y,
    [
      t('opts.vibrate', { state: onOff(s.settings.vibrate) }),
      () => {
        setHapticsEnabled(toggleVibration(s));
        haptic('tick');
        c.rebuild();
      },
    ],
    [
      t('opts.controls'),
      () => {
        controlsPage.open = true;
        c.rebuild();
      },
      C.gold,
    ],
  );
  y += 26;
  pair(
    y,
    [
      t('opts.sound', { state: onOff(!s.settings.muted) }),
      () => {
        toggleMute(s);
        apply();
        c.rebuild();
      },
    ],
    [
      t('opts.calm', { state: onOff(s.settings.reduceMotion) }),
      () => {
        toggleReduceMotion(s);
        gameEvents.emit('settingsChanged', undefined);
        c.rebuild();
      },
    ],
  );
  y += 32;
  volumeRow(y, t('opts.music'), 'music');
  volumeRow(y + 26, t('opts.soundVolume'), 'sfx');
}
