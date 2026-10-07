import Phaser from 'phaser';
import { game, goals, items } from '../../data';
import { saveNow } from '../../game/persistence';
import { audio } from '../../platform/audio';
import { getState } from '../../state/store';
import { waterCapacity } from '../../systems/actions';
import { maxEnergy } from '../../systems/energy';
import { toast } from '../../systems/events';
import { adjustVolume, toggleMute } from '../../systems/settings';
import { goalProgress, stat } from '../../systems/goals';
import { isToolSlot, selectSlot, swapSlots } from '../../systems/inventory';
import { C } from '../theme';
import { Button, drawBar, drawSlot, Modal } from '../widgets';

import { fmt } from './format';

// ============================================================ Menu

type Tab = 'items' | 'goals' | 'options';

export class MenuPanel extends Modal {
  private tab: Tab = 'items';
  private cursor: number | null = null;
  private quitState: 'idle' | 'confirm' | 'unsaved' = 'idle';

  constructor(
    scene: Phaser.Scene,
    private readonly onQuit: () => void,
  ) {
    super(scene, 420, 236);
  }

  protected build(): void {
    this.panel();
    (['items', 'goals', 'options'] as Tab[]).forEach((t, i) => {
      const active = t === this.tab;
      this.button(
        10 + i * 78,
        8,
        74,
        20,
        t === 'items' ? 'Items' : t === 'goals' ? 'Goals' : 'Options',
        () => {
          this.tab = t;
          this.cursor = null;
          this.quitState = 'idle';
          this.rebuild();
        },
        { rim: active ? C.gold : C.creamDim, textColor: active ? C.gold : C.cream },
      );
    });
    this.closeButton();
    if (this.tab === 'items') this.buildItems();
    else if (this.tab === 'goals') this.buildGoals();
    else this.buildOptions();
  }

  private buildItems(): void {
    const s = getState();
    const size = 28;
    const gap = 3;
    const x0 = 14;
    const y0 = 38;
    const g = this.scene.add.graphics();
    this.content.add(g);
    s.inventory.slots.forEach((stack, i) => {
      const x = x0 + (i % 8) * (size + gap);
      const y = y0 + Math.floor(i / 8) * (size + gap);
      drawSlot(g, x, y, size, i === this.cursor, i < game.hotbarSlots);
      if (i === s.inventory.selected)
        g.lineStyle(1, C.gold, 1).strokeRect(x - 1.5, y - 1.5, size + 3, size + 3);
      if (stack) {
        this.icon(x + size / 2, y + size / 2, items[stack.item]!.icon);
        if (!isToolSlot(i) && stack.qty > 1)
          this.label(x + size - 3, y + size - 9, String(stack.qty), C.cream, 1, 'right');
      }
      const zone = this.scene.add.zone(x, y, size, size).setOrigin(0, 0).setInteractive();
      zone.on('pointerup', () => this.tapSlot(i));
      this.content.add(zone);
    });

    const cur = this.cursor !== null ? s.inventory.slots[this.cursor] : null;
    const dx = 278;
    if (cur) {
      const def = items[cur.item]!;
      this.icon(dx + 8, 46, def.icon);
      this.label(dx + 22, 42, def.name, C.gold);
      this.label(dx, 58, def.description, C.cream, 1, 'left', 130);
      if (def.sellPrice) this.label(dx, 96, `Sells for ${def.sellPrice}g`, C.creamDim);
      if (def.buyPrice) this.label(dx, 108, `Costs ${def.buyPrice}g in town`, C.creamDim);
    } else {
      this.label(dx, 42, 'Backpack', C.gold);
      this.label(
        dx,
        58,
        'Blue-edged slots are your hotbar. Tap a slot, then another to swap. Tap the same slot to equip it.',
        C.creamDim,
        1,
        'left',
        130,
      );
    }
    this.label(
      14,
      y0 + 3 * (size + gap) + 6,
      `Energy ${s.energy}/${maxEnergy(s)}    Water ${s.water}/${waterCapacity(s)}    Gold ${fmt(s.money)}`,
      C.creamDim,
    );
    this.label(
      14,
      y0 + 3 * (size + gap) + 20,
      'Keys: WASD move, Space use tool, E interact, 1-8 hotbar, Esc menu',
      C.creamDim,
    );
    this.label(
      14,
      y0 + 3 * (size + gap) + 34,
      'Tip: hold the Action button to keep working a row of tiles.',
      C.creamDim,
    );
  }

  private leave(): void {
    this.quitState = 'idle';
    this.close();
    this.onQuit();
  }

  private tapSlot(i: number): void {
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

  private buildGoals(): void {
    const s = getState();
    const prog = goalProgress(s);
    this.label(14, 40, 'CURRENT GOAL', C.gold);
    if (prog) {
      this.label(14, 54, prog.goal.text, C.cream, 1, 'left', 390);
      const g = this.scene.add.graphics();
      drawBar(g, 14, 70, 300, 7, prog.value / prog.goal.target, C.gold);
      this.content.add(g);
      this.label(322, 69, `${fmt(prog.value)}/${fmt(prog.goal.target)}`, C.gold);
      this.label(14, 82, `Reward: +${prog.goal.reward}g`, C.green);
    } else {
      this.label(14, 54, 'Every goal is done. You are a Harvest Legend!', C.green);
    }
    this.label(14, 104, 'COMPLETED', C.gold);
    const done = goals.slice(Math.max(0, s.goalIndex - 5), s.goalIndex);
    if (done.length === 0) this.label(14, 118, 'Nothing yet. You can do it!', C.creamDim);
    let doneY = 118;
    for (const d of done.slice(-4)) {
      const row = this.label(14, doneY, `+ ${d.text}`, C.creamDim, 1, 'left', 250);
      doneY += row.textHeight + 3; // wrapped goals take two lines
    }
    const stats: [string, number][] = [
      ['Gold earned', stat(s, 'earned')],
      ['Crops harvested', stat(s, 'harvested')],
      ['Seeds planted', stat(s, 'planted')],
      ['Days slept', stat(s, 'daysSlept')],
    ];
    this.label(280, 104, 'STATS', C.gold);
    stats.forEach(([name, v], i) => {
      this.label(280, 118 + i * 11, name, C.creamDim);
      this.label(406, 118 + i * 11, fmt(v), C.cream, 1, 'right');
    });
  }

  private buildOptions(): void {
    const s = getState();
    const volumeRow = (y: number, name: string, key: 'music' | 'sfx') => {
      this.label(14, y + 8, name);
      const step = (d: number) => {
        adjustVolume(s, key, d);
        audio.setVolumes(s.settings.music, s.settings.sfx, s.settings.muted);
        if (key === 'sfx') audio.play('coin');
        this.rebuild();
      };
      this.button(90, y, 26, 24, '-', () => step(-0.1));
      const g = this.scene.add.graphics();
      drawBar(g, 124, y + 7, 110, 10, s.settings[key], C.green);
      this.content.add(g);
      this.button(242, y, 26, 24, '+', () => step(0.1));
      this.label(278, y + 8, `${Math.round(s.settings[key] * 100)}%`, C.creamDim);
    };
    volumeRow(40, 'Music', 'music');
    volumeRow(70, 'Sound', 'sfx');
    this.button(14, 104, 120, 24, s.settings.muted ? 'Sound: OFF' : 'Sound: ON', () => {
      toggleMute(s);
      audio.setVolumes(s.settings.music, s.settings.sfx, s.settings.muted);
      this.rebuild();
    });
    this.button(142, 104, 120, 24, 'Fullscreen', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().catch(() => undefined);
    });
    const saveBtn: Button = this.button(14, 138, 120, 24, 'Save now', () => {
      void saveNow().then((ok) => {
        saveBtn.setLabel(ok ? 'Saved!' : 'Save failed');
        saveBtn.setTextColor(ok ? C.green : C.red);
        if (!ok) toast('Saving is unavailable in this browser. Progress is not stored.', 'warn');
      });
    });
    this.button(
      142,
      138,
      120,
      24,
      this.quitState === 'confirm'
        ? 'Tap again!'
        : this.quitState === 'unsaved'
          ? 'Quit anyway?'
          : 'Quit to title',
      () => {
        if (this.quitState === 'idle') {
          this.quitState = 'confirm';
          this.rebuild();
          return;
        }
        if (this.quitState === 'unsaved') {
          this.leave();
          return;
        }
        void saveNow().then((ok) => {
          if (ok) this.leave();
          else {
            // Never discard a session the player believes is saved.
            this.quitState = 'unsaved';
            toast('Could not save. Tap again to quit and lose progress.', 'warn');
            this.rebuild();
          }
        });
      },
      { textColor: this.quitState === 'idle' ? C.cream : C.warn },
    );
    this.label(14, 176, 'Your game saves automatically every time you sleep,', C.creamDim);
    this.label(14, 188, 'change maps, or leave the page.', C.creamDim);
  }
}
