import Phaser from 'phaser';

export type IconDrawer = (g: Phaser.GameObjects.Graphics) => void;

/** Round on-screen button with a generous hit area and press feedback. */
export class TouchButton {
  readonly view: Phaser.GameObjects.Container;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly glow: Phaser.GameObjects.Graphics;
  private enabled = true;
  private pressed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    icon: IconDrawer,
    onPress: () => void,
    onRelease?: () => void,
  ) {
    const body = scene.add.graphics();
    body.fillStyle(0x14101f, 0.38).fillCircle(0, 1.5, radius + 1); // soft drop shadow
    body.fillStyle(0x2a2238, 0.62).fillCircle(0, 0, radius);
    body.lineStyle(2, 0xf4ead2, 0.7).strokeCircle(0, 0, radius - 1);
    body.lineStyle(1, 0x14101f, 0.5).strokeCircle(0, 0, radius + 0.5);
    this.glow = scene.add.graphics().setAlpha(0);
    this.glow.fillStyle(0xf4ead2, 0.3).fillCircle(0, 0, radius - 2);
    const iconGfx = scene.add.graphics();
    icon(iconGfx);

    this.view = scene.add.container(x, y, [body, this.glow, iconGfx]).setDepth(90);

    const hit = radius + 8; // finger-friendly margin beyond the drawn circle
    this.zone = scene.add.zone(x, y, hit * 2, hit * 2).setDepth(90);
    this.zone.setInteractive({
      hitArea: new Phaser.Geom.Circle(hit, hit, hit),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
    });
    this.zone.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.press(true);
      onPress();
    });
    // Only a button that was actually pressed may release, so a mouse merely crossing it
    // can never cancel input held elsewhere (e.g. Space held for the tool).
    for (const ev of ['pointerup', 'pointerout']) {
      this.zone.on(ev, () => {
        if (!this.pressed) return;
        this.pressed = false;
        this.press(false);
        onRelease?.();
      });
    }
  }

  private press(down: boolean): void {
    this.scene.tweens.add({
      targets: this.view,
      scale: down ? 0.92 : this.enabled ? 1 : 0.8,
      duration: 70,
    });
    this.scene.tweens.add({ targets: this.glow, alpha: down ? 1 : 0, duration: down ? 40 : 160 });
  }

  /** Show or hide with a small pop; a hidden button cannot be hit. */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (this.zone.input) this.zone.input.enabled = enabled;
    this.scene.tweens.add({
      targets: this.view,
      alpha: enabled ? 1 : 0,
      scale: enabled ? 1 : 0.8,
      duration: 140,
      ease: enabled ? 'Back.easeOut' : 'Sine.easeIn',
    });
  }
}
