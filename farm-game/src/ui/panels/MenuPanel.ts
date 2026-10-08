import Phaser from 'phaser';
import { game, goals, items } from '../../data';
import { saveNow } from '../../game/persistence';
import { audio } from '../../platform/audio';
import { fullscreenSupported, isIosSafari, toggleFullscreen } from '../../platform/display';
import { haptic, setHapticsEnabled } from '../../platform/haptics';
import { getState } from '../../state/store';
import { waterCapacity } from '../../systems/actions';
import { maxEnergy } from '../../systems/energy';
import { gameEvents, toast } from '../../systems/events';
import { goalProgress, stat } from '../../systems/goals';
import { isToolSlot, selectSlot, swapSlots } from '../../systems/inventory';
import { displayName, iconKey, refOf, sellValue } from '../../systems/itemRef';
import {
  adjustVolume,
  toggleLeftHanded,
  toggleMute,
  toggleReduceMotion,
  toggleVibration,
} from '../../systems/settings';
import { C } from '../theme';
import type { Label } from '../font';
import { Button, drawBar, drawSlot, Modal, type ButtonStyle, type RowSpec } from '../widgets';
import { fmt } from './format';
import { buildCraft } from './CraftTab';
import { buildSkills } from './SkillsTab';

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
  /** At most 5 characters: six tabs share 200px. */
  label: string;
  build: (ctx: MenuTabContext) => void;
}

/** Tabs shown in the menu, in order. Mechanics register their own (see docs/EXTENDING.md). */
export const menuTabs: MenuTab[] = [];
export function registerMenuTab(tab: MenuTab): void {
  const at = menuTabs.findIndex((t) => t.id === tab.id);
  if (at >= 0) menuTabs[at] = tab;
  else menuTabs.push(tab);
}

const SHEET_H = 330;

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

  /** Jump to a tab by id (e.g. the goal tracker opens "goals"). */
  openTab(id: string): void {
    this.tab = id;
    this.cursor = null;
    if (this.isOpen) this.rebuild();
    else this.open();
  }

  protected build(): void {
    this.panel();
    const tabs = menuTabs;
    const w = Math.floor((this.panelW - 8) / tabs.length);
    tabs.forEach((t, i) => {
      const active = t.id === this.tab;
      this.button(4 + i * w, 5, w - 2, 20, t.label, () => this.openTab(t.id), {
        rim: active ? C.gold : C.creamDim,
        textColor: active ? C.gold : C.cream,
      });
    });
    const ctx: MenuTabContext = {
      width: this.panelW,
      height: this.panelH,
      top: 32,
      bottom: this.panelH - 32,
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
    (tabs.find((t) => t.id === this.tab) ?? tabs[0])?.build(ctx);
    this.closeButton();
  }

  // The remaining state the Options tab needs lives here so the tab functions below stay stateless.
  tapSlot(i: number): void {
    const s = getState();
    if (this.cursor === null) {
      if (s.inventory.slots[i]) this.cursor = i;
    } else if (this.cursor === i) {
      if (i < game.hotbarSlots) selectSlot(s, i);
      this.cursor = null;
    } else {
      if (!swapSlots(s, this.cursor, i)) audio.play('error');
      this.cursor = null;
    }
    audio.play('select');
    this.rebuild();
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
  registerMenuTab({ id: 'bag', label: 'Bag', build: (c) => buildBag(c, menu) });
  registerMenuTab({ id: 'goals', label: 'Goals', build: buildGoals });
  registerMenuTab({ id: 'craft', label: 'Craft', build: buildCraft });
  registerMenuTab({ id: 'skills', label: 'Skills', build: buildSkills });
  registerMenuTab({ id: 'opts', label: 'Opts', build: (c) => buildOptions(c, menu) });
}

function buildBag(c: MenuTabContext, menu: MenuPanel): void {
  const s = getState();
  const size = 22;
  const pitch = 23;
  const x0 = 8;
  const y0 = c.top;
  const g = c.scene.add.graphics();
  c.add(g);
  const cursor = menu.selectedCursor;
  s.inventory.slots.forEach((stack, i) => {
    const x = x0 + (i % 8) * pitch;
    const y = y0 + Math.floor(i / 8) * pitch;
    drawSlot(g, x, y, size, i === cursor, i < game.hotbarSlots);
    if (i === s.inventory.selected)
      g.lineStyle(1, C.gold, 1).strokeRect(x - 1.5, y - 1.5, size + 3, size + 3);
    if (stack) {
      const ref = refOf(stack);
      c.icon(x + size / 2, y + size / 2, iconKey(ref));
      if (!isToolSlot(i) && stack.qty > 1)
        c.label(x + size - 2, y + size - 9, String(stack.qty), C.cream, 1, 'right');
      if (ref.q) c.icon(x + 5, y + size - 5, 'ui_star').setTint(ref.q >= 2 ? 0xf4d35e : 0xc9d3e4);
      if ((ref.q ?? 0) >= 2) c.icon(x + 11, y + size - 5, 'ui_star').setTint(0xf4d35e);
    }
    const zone = c.scene.add
      .zone(x, y, size + 1, size + 1)
      .setOrigin(0, 0)
      .setInteractive();
    zone.on('pointerup', () => menu.tapSlot(i));
    c.add(zone);
  });

  const dy = y0 + 3 * pitch + 6;
  const cur = cursor !== null ? s.inventory.slots[cursor] : null;
  if (cur) {
    const ref = refOf(cur);
    const def = items[cur.item]!;
    c.icon(16, dy + 8, iconKey(ref));
    c.label(30, dy + 4, displayName(ref), C.gold, 1, 'left', 160);
    c.label(8, dy + 20, def.description, C.cream, 1, 'left', 184);
    if (def.type !== 'tool') c.label(8, dy + 52, `Sells for ${fmt(sellValue(ref))}g`, C.creamDim);
    if (def.buyPrice) c.label(8, dy + 64, `Costs ${def.buyPrice}g in town`, C.creamDim);
  } else {
    c.label(8, dy + 2, 'Backpack', C.gold);
    c.label(
      8,
      dy + 16,
      'Blue-edged slots are your hotbar. Tap an item, then another slot to move it. Tap the same slot to equip it.',
      C.creamDim,
      1,
      'left',
      184,
    );
  }
  const ly = c.bottom - 36;
  c.label(
    8,
    ly,
    `Energy ${s.energy}/${maxEnergy(s)}   Water ${s.water}/${waterCapacity(s)}`,
    C.creamDim,
  );
  c.label(8, ly + 12, `Gold ${fmt(s.money)}`, C.gold);
  c.label(8, ly + 24, 'Tip: hold Action to keep working.', C.creamDim);
}

function buildGoals(c: MenuTabContext): void {
  const s = getState();
  const prog = goalProgress(s);
  c.label(8, c.top + 2, 'CURRENT GOAL', C.gold);
  if (prog) {
    c.label(8, c.top + 14, prog.goal.text, C.cream, 1, 'left', 184);
    const g = c.scene.add.graphics();
    drawBar(g, 8, c.top + 28, 150, 7, prog.value / prog.goal.target, C.gold);
    c.add(g);
    c.label(164, c.top + 28, `${fmt(prog.value)}/${fmt(prog.goal.target)}`, C.gold);
    c.label(8, c.top + 40, `Reward: +${fmt(prog.goal.reward)}g`, C.green);
    c.label(8, c.top + 52, `Hint: ${prog.goal.hint}`, C.creamDim, 1, 'left', 184);
  } else {
    c.label(
      8,
      c.top + 14,
      'Every goal is done. You are a Harvest Legend!',
      C.green,
      1,
      'left',
      184,
    );
  }
  let y = c.top + 78;
  c.label(8, y, 'COMPLETED', C.gold);
  y += 12;
  const done = goals.slice(Math.max(0, s.goalIndex - 4), s.goalIndex);
  if (done.length === 0) c.label(8, y, 'Nothing yet. You can do it!', C.creamDim);
  for (const d of done) {
    const row = c.label(8, y, `+ ${d.text}`, C.creamDim, 1, 'left', 184);
    y += row.textHeight + 3;
  }
  y = c.bottom - 62;
  c.label(8, y, 'STATS', C.gold);
  const stats: [string, number][] = [
    ['Gold earned', stat(s, 'earned')],
    ['Crops harvested', stat(s, 'harvested')],
    ['Seeds planted', stat(s, 'planted')],
    ['Days slept', stat(s, 'daysSlept')],
  ];
  stats.forEach(([name, v], i) => {
    c.label(8, y + 12 + i * 11, name, C.creamDim);
    c.label(192, y + 12 + i * 11, fmt(v), C.cream, 1, 'right');
  });
}

function buildOptions(c: MenuTabContext, menu: MenuPanel): void {
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
  let y = c.top + 4;
  volumeRow(y, 'Music', 'music');
  volumeRow((y += 26), 'Sound', 'sfx');

  const half = 92;
  const pair = (
    yy: number,
    a: [string, () => void, number?],
    b?: [string, () => void, number?],
  ) => {
    c.button(8, yy, half, 22, a[0], a[1], { textColor: a[2] ?? C.cream });
    if (b) c.button(100, yy, half, 22, b[0], b[1], { textColor: b[2] ?? C.cream });
  };
  y += 32;
  pair(
    y,
    [
      s.settings.muted ? 'Sound: OFF' : 'Sound: ON',
      () => {
        toggleMute(s);
        apply();
        c.rebuild();
      },
    ],
    [
      s.settings.vibrate ? 'Vibrate: ON' : 'Vibrate: OFF',
      () => {
        setHapticsEnabled(toggleVibration(s));
        haptic('tick');
        c.rebuild();
      },
    ],
  );
  y += 26;
  pair(
    y,
    [
      s.settings.leftHanded ? 'Left hand: ON' : 'Left hand: OFF',
      () => {
        toggleLeftHanded(s);
        gameEvents.emit('settingsChanged', undefined);
        c.rebuild();
      },
    ],
    fullscreenSupported() ? ['Fullscreen', () => void toggleFullscreen()] : undefined,
  );
  if (!fullscreenSupported() && isIosSafari()) {
    c.label(100, y + 2, 'Share > Add to', C.creamDim);
    c.label(100, y + 12, 'Home Screen', C.creamDim);
  }
  y += 26;
  pair(y, [
    s.settings.reduceMotion ? 'Calm: ON' : 'Calm: OFF',
    () => {
      toggleReduceMotion(s);
      gameEvents.emit('settingsChanged', undefined);
      c.rebuild();
    },
  ]);
  y += 26;
  const saveBtn: Button = c.button(8, y, half, 22, 'Save now', () => {
    void saveNow().then((ok) => {
      saveBtn.setLabel(ok ? 'Saved!' : 'Save failed');
      saveBtn.setTextColor(ok ? C.green : C.red);
      if (!ok) toast('Saving is unavailable in this browser. Progress is not stored.', 'warn');
    });
  });
  const q = menu.quit;
  c.button(
    100,
    y,
    half,
    22,
    q === 'confirm' ? 'Tap again!' : q === 'unsaved' ? 'Quit anyway?' : 'Quit to title',
    () => {
      if (q === 'idle') return menu.setQuit('confirm');
      if (q === 'unsaved') return menu.leave();
      void saveNow().then((ok) => {
        if (ok) menu.leave();
        else {
          // Never discard a session the player believes is saved.
          toast('Could not save. Tap again to quit and lose progress.', 'warn');
          menu.setQuit('unsaved');
        }
      });
    },
    { textColor: q === 'idle' ? C.cream : C.warn },
  );
  y += 32;
  c.label(
    8,
    y,
    'Your game saves automatically when you sleep, change maps, or leave the page.',
    C.creamDim,
    1,
    'left',
    184,
  );
}
