import Phaser from 'phaser';
import { CH } from '../ui/theme';
import { actionDrag, GESTURE } from './gesture';

export type IconDrawer = (g: Phaser.GameObjects.Graphics) => void;

export interface TouchButtonOptions {
  x: number;
  y: number;
  radius: number;
  /** Touch radius (defaults to radius + 8). */
  hit?: number;
  icon: IconDrawer;
  /**
   * 'down' acts on touch-down (Action: speed matters). 'release' acts when a still touch lifts and is
   * cancelled once the finger travels past the tap tolerance; such a touch may turn into a joystick drag
   * (it is "pass-through"), so a drag that starts on the button never opens anything.
   */
  fireOn?: 'down' | 'release';
  /** Called on press ('down') or on a clean release ('release'). */
  onPress: () => void;
  /** 'down' buttons only: the press ended (lift, slide-off, or a swipe took over). */
  onRelease?: () => void;
  /** 'down' buttons only: +1 / -1 per tool step when the finger slides up / down while pressing. */
  onSwipe?: (step: number) => void;
  /** 'down' buttons only: a clearly sideways flick while pressing (+1 right, -1 left), with the pointer. */
  onFlick?: (dir: number, pointerId: number) => void;
  /** 'down' buttons only: every pointer move of the press, relative to its anchor. */
  onMove?: (dx: number, dy: number) => void;
  /**
   * Final say on whether a touch at (x, y) belongs to this button, for overlapping touch circles (see
   * `resolveTouch` in ui/layout.ts). Defaults to "inside the touch circle".
   */
  owns?: (x: number, y: number) => boolean;
}

/** Round on-screen button with a generous hit area and press feedback. */
export class TouchButton {
  readonly view: Phaser.GameObjects.Container;
  readonly zone: Phaser.GameObjects.Zone;
  private readonly glow: Phaser.GameObjects.Graphics;
  private enabled = true;
  private pressed = false;
  private pointerId: number | null = null;
  private anchor = { x: 0, y: 0 };
  private start = { x: 0, y: 0 };
  private cleanup: (() => void)[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: TouchButtonOptions,
  ) {
    const { x, y, radius, icon } = opts;
    const body = scene.add.graphics();
    body.fillStyle(CH.ink, 0.38).fillCircle(0, 1.5, radius + 1); // soft drop shadow
    body.fillStyle(CH.panel, 0.62).fillCircle(0, 0, radius);
    body.lineStyle(2, CH.cream, 0.7).strokeCircle(0, 0, radius - 1);
    body.lineStyle(1, CH.ink, 0.5).strokeCircle(0, 0, radius + 0.5);
    this.glow = scene.add.graphics().setAlpha(0);
    this.glow.fillStyle(CH.cream, 0.3).fillCircle(0, 0, radius - 2);
    const iconGfx = scene.add.graphics();
    icon(iconGfx);

    this.view = scene.add.container(x, y, [body, this.glow, iconGfx]).setDepth(90);

    const hit = opts.hit ?? radius + 8; // finger-friendly margin beyond the drawn circle
    this.zone = scene.add.zone(x, y, hit * 2, hit * 2).setDepth(90);
    this.zone.setInteractive({
      hitArea: new Phaser.Geom.Circle(hit, hit, hit),
      // Local coords inside the zone; the owner check works in screen (logical) coords.
      hitAreaCallback: (area: Phaser.Geom.Circle, lx: number, ly: number) =>
        Phaser.Geom.Circle.Contains(area, lx, ly) &&
        (opts.owns ? opts.owns(x - hit + lx, y - hit + ly) : true),
    });
    // Release buttons let a drag that starts on them become a joystick drag.
    this.zone.setData('passThrough', opts.fireOn === 'release');

    this.zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.enabled) return;
      this.pointerId = p.id;
      this.anchor = { x: p.x, y: p.y };
      this.start = { x: p.x, y: p.y };
      this.pressed = true;
      this.press(true);
      if (opts.fireOn !== 'release') opts.onPress();
    });
    const onMove = (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== p.id) return;
      if (opts.fireOn === 'release') {
        // Reaching the stick's deadzone cancels: the touch is a drag now (the joystick takes it).
        const d = Math.hypot(p.x - this.start.x, p.y - this.start.y);
        if (this.pressed && d >= GESTURE.stickDeadzone) {
          this.pressed = false;
          this.press(false);
        }
        return;
      }
      opts.onMove?.(p.x - this.anchor.x, p.y - this.anchor.y);
      const kind = actionDrag(p.x - this.anchor.x, p.y - this.anchor.y);
      if (kind === 'swipeUp' || kind === 'swipeDown') {
        if (!opts.onSwipe) return;
        this.anchor = { x: p.x, y: p.y };
        opts.onSwipe(kind === 'swipeUp' ? 1 : -1); // first, so the release below knows it was a swipe
        this.endPress(); // a swipe is not a work press: let go of the held action
      } else if (kind === 'flick' && opts.onFlick) {
        // The flick hands this finger to whatever it opens (the tool ring): stop tracking it here.
        const dir = Math.sign(p.x - this.anchor.x);
        this.pointerId = null;
        opts.onFlick(dir, p.id); // first, so the release below knows it was not a tap
        this.endPress();
      }
    };
    const onUp = (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== p.id) return;
      this.pointerId = null;
      if (opts.fireOn === 'release') {
        const fire = this.pressed && this.enabled;
        this.pressed = false;
        this.press(false);
        if (fire) opts.onPress();
        return;
      }
      this.endPress();
    };
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    this.cleanup.push(
      () => scene.input.off('pointermove', onMove),
      () => scene.input.off('pointerup', onUp),
    );
    // A 'down' button that was actually pressed releases when the finger slides off it, so a mouse merely
    // crossing it can never cancel input held elsewhere (e.g. Space held for the tool).
    if (opts.fireOn !== 'release') this.zone.on('pointerout', () => this.endPress());
  }

  private endPress(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.press(false);
    this.opts.onRelease?.();
  }

  private press(down: boolean): void {
    this.scene.tweens.add({
      targets: this.view,
      scale: down ? 0.92 : this.enabled ? 1 : 0.8,
      duration: 70,
    });
    this.scene.tweens.add({ targets: this.glow, alpha: down ? 1 : 0, duration: down ? 40 : 160 });
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Remove the button (used when the controls are re-laid out, e.g. left-handed mode). */
  destroy(): void {
    this.cleanup.forEach((off) => off());
    this.zone.destroy();
    this.view.destroy();
  }

  /** Show or hide with a small pop; a hidden button cannot be hit. */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (this.zone.input) this.zone.input.enabled = enabled;
    if (!enabled) this.pressed = false;
    this.scene.tweens.add({
      targets: this.view,
      alpha: enabled ? 1 : 0,
      scale: enabled ? 1 : 0.8,
      duration: 140,
      ease: enabled ? 'Back.easeOut' : 'Sine.easeIn',
    });
  }
}
