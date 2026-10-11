import Phaser from 'phaser';
import { CH } from '../ui/theme';
import { GESTURE } from './gesture';
import { bakeGraphics } from '../fx/bake';
import { getState } from '../state/store';

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
  /** 'down' buttons only: every pointer move of the press, relative to its anchor, with the pointer id. */
  onMove?: (dx: number, dy: number, pointerId: number) => void;
  /**
   * 'down' buttons only: release when the finger slides off the button (default true). Action keeps the
   * press while a drag paints a row far outside its disc; it ends on lift.
   */
  releaseOnOut?: boolean;
  /**
   * Final say on whether a touch at (x, y) belongs to this button, for overlapping touch circles (see
   * `resolveTouch` in ui/layout.ts). Defaults to "inside the touch circle".
   */
  owns?: (x: number, y: number) => boolean;
}

/** The button's disc and its press light as textures (baked once per radius; the title prewarms them). */
export function bakeButton(
  scene: Phaser.Scene,
  radius: number,
): { bodyKey: string; glowKey: string; c: number } {
  const size = (radius + 4) * 2;
  const c = radius + 4;
  const bodyKey = bakeGraphics(scene, `fx_button_${radius}`, size, size, c, c, (body) => {
    body.fillStyle(CH.ink, 0.38).fillCircle(0, 1.5, radius + 1); // soft drop shadow
    body.fillStyle(CH.panel, 0.62).fillCircle(0, 0, radius);
    body.lineStyle(2, CH.cream, 0.7).strokeCircle(0, 0, radius - 1);
    body.lineStyle(1, CH.ink, 0.5).strokeCircle(0, 0, radius + 0.5);
  });
  const glowKey = bakeGraphics(scene, `fx_button_glow_${radius}`, size, size, c, c, (g) =>
    g.fillStyle(CH.cream, 0.3).fillCircle(0, 0, radius - 2),
  );
  return { bodyKey, glowKey, c };
}

/** Round on-screen button with a generous hit area and press feedback. */
export class TouchButton {
  readonly view: Phaser.GameObjects.Container;
  readonly zone: Phaser.GameObjects.Zone;
  private readonly glow: Phaser.GameObjects.Image;
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
    // Drawn once into textures (fx/bake.ts): a live Graphics re-tessellates its circles every frame.
    const { bodyKey, glowKey, c } = bakeButton(scene, radius);
    const body = scene.add.image(-c, -c, bodyKey).setOrigin(0);
    this.glow = scene.add.image(-c, -c, glowKey).setOrigin(0).setAlpha(0);
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
      opts.onMove?.(p.x - this.anchor.x, p.y - this.anchor.y, p.id);
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
    if (opts.fireOn !== 'release' && opts.releaseOnOut !== false)
      this.zone.on('pointerout', () => this.endPress());
  }

  private endPress(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.press(false);
    this.opts.onRelease?.();
  }

  /**
   * Press-down state: on the very frame of the touch the button sinks 1 px and lights up (no tween, so it shows
   * within a frame); on release it rises at once and the light fades. Whole pixels, no scaling.
   */
  private press(down: boolean): void {
    this.scene.tweens.killTweensOf(this.glow);
    this.view.y = this.opts.y + (down ? 1 : 0);
    this.onPressVisual?.(down);
    if (down) this.glow.setAlpha(1);
    else this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 160 });
  }

  /** Lets an icon drawn outside the button (the Action icon) sink with it. */
  onPressVisual: ((down: boolean) => void) | null = null;

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
    // Shows and hides with a fade and a 2 px rise in whole pixels (no scale pop on drawn art).
    this.scene.tweens.killTweensOf(this.view);
    if (enabled && !getState().settings.reduceMotion) this.view.y = this.opts.y + 2;
    this.scene.tweens.add({
      targets: this.view,
      alpha: enabled ? 1 : 0,
      y: this.opts.y,
      duration: 140,
      ease: enabled ? 'Quad.easeOut' : 'Sine.easeIn',
      onUpdate: () => (this.view.y = Math.round(this.view.y)),
    });
  }
}
