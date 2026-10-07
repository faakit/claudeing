import Phaser from 'phaser';
import { fish as fishTable, items } from '../../data';
import { inputHub } from '../../input/InputHub';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import {
  biteDelay,
  HOOK_WINDOW,
  newReel,
  outcomeOf,
  reelSize,
  resolveCatch,
  stepReel,
  type Reel,
} from '../../systems/fishing';
import { toast } from '../../systems/events';
import { displayName } from '../../systems/itemRef';
import { random } from '../../systems/rng';
import type { Label } from '../font';
import { C } from '../theme';
import { drawBar, drawPanel, Modal } from '../widgets';

type Phase = 'wait' | 'bite' | 'reel' | 'done';

const TRACK = { x: 78, y: 40, w: 24, h: 116 };

/**
 * The reel mini-game, one thumb: wait for the bite, tap to hook, then hold to lift the bar and keep
 * it on the darting fish. The rules live in systems/fishing.ts; this only draws and feeds input.
 */
export class FishingPanel extends Modal {
  private phase: Phase = 'done';
  private clock = 0;
  private delay = 0;
  private fishId = 'carp';
  private bait = false;
  private reel: Reel = newReel(0.3, 0.3);
  private pointerDown = false;
  private wasHolding = false;
  /** A press happened since the last frame (a quick tap can start and end between two frames). */
  private tapped = false;
  private gfx!: Phaser.GameObjects.Graphics;
  private fishIcon!: Phaser.GameObjects.Image;
  private status!: Label;
  private hint!: Label;

  constructor(scene: Phaser.Scene) {
    super(scene, 214);
    this.dismissOnDim = false;
    scene.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => this.tick(dt / 1000));
  }

  start(fishId: string, bait: boolean): void {
    this.fishId = fishId;
    this.bait = bait;
    this.phase = 'wait';
    this.clock = 0;
    this.delay = biteDelay(random(getState()), bait);
    const def = fishTable.find((f) => f.item === fishId);
    const difficulty = def?.difficulty ?? 0.4;
    this.reel = newReel(reelSize(getState(), difficulty, bait), difficulty);
    this.pointerDown = false;
    this.wasHolding = true; // the cast press must be released first
    this.tapped = false;
    this.open();
  }

  protected build(): void {
    this.panel();
    this.label(8, 8, 'Fishing', C.gold);
    this.label(
      192,
      8,
      this.bait ? 'Bait on!' : 'No bait',
      this.bait ? C.green : C.creamDim,
      1,
      'right',
    );
    this.status = this.label(100, 22, '', C.cream, 1, 'center');
    this.gfx = this.scene.add.graphics();
    this.content.add(this.gfx);
    this.fishIcon = this.icon(
      TRACK.x + TRACK.w / 2,
      TRACK.y,
      items[this.fishId]?.icon ?? 'ui_coin',
    );
    this.fishIcon.setVisible(false);
    // Whole sheet is the touch surface for "hold".
    const zone = this.scene.add
      .zone(0, 0, this.panelW, this.panelH)
      .setOrigin(0, 0)
      .setInteractive();
    zone.on('pointerdown', () => {
      this.pointerDown = true;
      this.tapped = true;
    });
    zone.on('pointerup', () => this.onRelease());
    zone.on('pointerout', () => (this.pointerDown = false));
    this.content.add(zone);
    this.hint = this.label(100, this.panelH - 44, '', C.creamDim, 1, 'center', 190);
    this.button(
      8,
      this.panelH - 28,
      this.panelW - 16,
      22,
      'Reel in & leave',
      () => this.finish(false),
      {
        textColor: C.warn,
      },
    );
    this.draw();
  }

  private onRelease(): void {
    this.pointerDown = false;
    if (this.phase === 'done' && this.clock > 0.6) this.close();
  }

  private holding(): boolean {
    return this.pointerDown || inputHub.actionHeld;
  }

  private tick(dt: number): void {
    if (!this.isOpen) return;
    const down = this.holding();
    const pressed = (down && !this.wasHolding) || this.tapped;
    this.tapped = false;
    this.wasHolding = down;
    this.clock += dt;
    if (this.phase === 'wait' && this.clock >= this.delay) {
      this.phase = 'bite';
      this.clock = 0;
      audio.play('select');
      haptic('success');
    } else if (this.phase === 'bite') {
      if (pressed) {
        this.phase = 'reel';
        this.clock = 0;
        audio.play('ui');
      } else if (this.clock > HOOK_WINDOW) this.finish(false);
    } else if (this.phase === 'reel') {
      stepReel(this.reel, Math.min(dt, 0.05), down, () => random(getState()));
      if (this.reel.result) this.finish(outcomeOf(this.reel).caught);
    } else if (this.phase === 'done' && pressed && this.clock > 0.5) {
      this.close();
    }
    this.draw();
  }

  private finish(caught: boolean): void {
    if (this.phase === 'done') return;
    const out = caught ? outcomeOf(this.reel) : { caught: false, perfect: false };
    if (this.phase === 'wait' || this.phase === 'bite') {
      // Left early or missed the bite: nothing was hooked.
      this.phase = 'done';
      if (out.caught === false && this.clock > 0) toast('Too slow!', 'warn');
      this.close();
      return;
    }
    this.phase = 'done';
    this.clock = 0;
    const res = resolveCatch(getState(), this.fishId, out);
    if (res.ok) {
      audio.play('harvest');
      haptic('success');
      this.resultText = `${displayName({ item: this.fishId, q: res.q })}${out.perfect ? ' (perfect!)' : ''}`;
    } else {
      audio.play('error');
      this.resultText = 'It got away...';
    }
  }

  private resultText = '';

  private draw(): void {
    if (!this.gfx?.scene) return;
    const g = this.gfx;
    g.clear();
    const { x, y, w, h } = TRACK;
    const t = this.scene.time.now / 1000;
    drawPanel(g, x - 4, y - 4, w + 8, h + 8, 0x1d3a52, C.blue);
    if (this.phase === 'wait' || this.phase === 'bite') {
      // Ripples and a bobber.
      const cx = x + w / 2;
      const cy = y + h / 2;
      for (const k of [0, 0.5]) {
        const p = (t * 0.6 + k) % 1;
        g.lineStyle(1, 0xffffff, 0.5 * (1 - p)).strokeCircle(cx, cy, 4 + p * 10);
      }
      const dip = this.phase === 'bite' ? 3 + Math.sin(t * 40) * 2 : Math.sin(t * 3) * 0.8;
      g.fillStyle(0xe0574a, 1).fillRect(cx - 2, cy - 4 + dip, 4, 4);
      g.fillStyle(0xf4ead2, 1).fillRect(cx - 2, cy + dip, 4, 3);
      this.fishIcon.setVisible(false);
      this.status.setText(this.phase === 'wait' ? 'Waiting for a bite...' : '! TAP NOW !');
      this.status.setColor(this.phase === 'bite' ? C.gold : C.cream);
      this.hint.setText('Any tap on the sheet hooks it.');
    } else if (this.phase === 'reel') {
      const r = this.reel;
      const barTop = y + h - (r.bar + r.size) * h;
      g.fillStyle(0x7fc96b, 0.55).fillRect(x + 1, barTop, w - 2, r.size * h);
      g.lineStyle(1, 0x9be37f, 1).strokeRect(x + 1.5, barTop + 0.5, w - 3, r.size * h - 1);
      this.fishIcon.setVisible(true).setPosition(x + w / 2, y + h - r.fish * h);
      drawBar(g, x + w + 14, y, 8, h, r.progress, C.gold, true);
      this.status.setText('Keep the fish in the green!');
      this.status.setColor(C.cream);
      this.hint.setText('Hold to lift, let go to sink.');
    } else {
      this.fishIcon.setVisible(false);
      this.status.setText(this.resultText);
      this.status.setColor(this.resultText.startsWith('It got') ? C.warn : C.green);
      this.hint.setText('Tap to continue.');
    }
  }
}
