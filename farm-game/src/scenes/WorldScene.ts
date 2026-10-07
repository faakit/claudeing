import Phaser from 'phaser';
import { PLAYER_TEXTURE, playerIdleFrame, PLAYER_H, SHADOW_TEXTURE } from '../art/placeholders';
import {
  CAMERA_LERP,
  EVT_INTERACT_TARGET,
  FADE_COLOR,
  FADE_MS,
  GAME_HEIGHT,
  GAME_WIDTH,
  TILE_SIZE,
  TILESET_KEY,
  VOID_COLOR,
} from '../config';
import { mapsData } from '../data';
import { inputHub } from '../input/InputHub';
import { getState } from '../state/store';
import { adjacentDirection } from '../systems/world';
import type { CollisionGrid } from '../systems/movement';
import { isTileBlocked, stepPlayer } from '../systems/movement';
import {
  buildCollisionGrid,
  doorTarget,
  facingTile,
  objectAt,
  parseMapObjects,
  playerTile,
  teleportPlayer,
  type TiledMapLike,
  type TileCoord,
  type WorldObject,
} from '../systems/world';
import { mapCacheKey } from './PreloadScene';

/** Shared behavior for every walkable map: render, move, collide, doors, highlight. */
export abstract class WorldScene extends Phaser.Scene {
  private grid!: CollisionGrid;
  private objects: WorldObject[] = [];
  private sprite!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private highlight!: Phaser.GameObjects.Graphics;
  private highlightTile: TileCoord | null = null;
  private transitioning = false;
  /** After a door, ignore held input until it is released once, so doors never bounce. */
  private inputLocked = true;
  private lastTarget: string | null | undefined;
  private cleanup: (() => void)[] = [];

  protected constructor(
    key: string,
    private readonly mapId: string,
  ) {
    super(key);
  }

  create(): void {
    const state = getState();
    if (state.player.map !== this.mapId) {
      throw new Error(`State says player is on "${state.player.map}" but scene is "${this.mapId}"`);
    }
    this.transitioning = false;
    this.inputLocked = true;
    this.lastTarget = undefined;
    this.highlightTile = null;

    const raw = this.cache.tilemap.get(mapCacheKey(this.mapId)).data as TiledMapLike;
    this.grid = buildCollisionGrid(raw);
    this.objects = parseMapObjects(raw);

    const map = this.make.tilemap({ key: mapCacheKey(this.mapId) });
    const tileset = map.addTilesetImage('placeholder', TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Tileset "placeholder" missing from map');
    map.createLayer('ground', tileset)?.setDepth(0);

    this.highlight = this.add.graphics().setDepth(1);
    this.shadow = this.add.image(0, 0, SHADOW_TEXTURE).setOrigin(0.5, 0.5);
    this.sprite = this.add
      .sprite(0, 0, PLAYER_TEXTURE, playerIdleFrame(state.player.facing))
      .setOrigin(0.5, 1);
    this.syncSprite(false);

    this.setupCamera(map.widthInPixels, map.heightInPixels);
    this.cameras.main.fadeIn(FADE_MS, FADE_COLOR.r, FADE_COLOR.g, FADE_COLOR.b);

    this.cleanup.push(
      inputHub.on('action', () => this.onAction()),
      inputHub.on('interact', () => this.onInteract()),
      inputHub.on('tap', (p) => this.onTap(p.x, p.y)),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup.forEach((off) => off());
      this.cleanup = [];
      this.game.events.emit(EVT_INTERACT_TARGET, null);
    });
  }

  update(time: number, delta: number): void {
    if (this.transitioning) return;
    const player = getState().player;

    let dir = inputHub.direction;
    if (this.inputLocked) {
      if (dir === null) this.inputLocked = false;
      dir = null;
    }
    const { moving } = stepPlayer(player, dir, delta, this.grid);
    this.syncSprite(moving);

    const here = playerTile(player);
    const door = objectAt(this.objects, here.tx, here.ty, 'door');
    if (door) {
      this.useDoor(door);
      return;
    }
    this.updateTarget();
    this.updateHighlight(time);
  }

  private setupCamera(mapW: number, mapH: number): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(VOID_COLOR);
    // Maps smaller than the screen get bounds equal to the screen, centered on the map.
    const bw = Math.max(mapW, GAME_WIDTH);
    const bh = Math.max(mapH, GAME_HEIGHT);
    cam.setBounds(-(bw - mapW) / 2, -(bh - mapH) / 2, bw, bh);
    const p = getState().player;
    // Aim at the middle of the body rather than the feet.
    const bodyOffset = PLAYER_H / 2 - 4;
    cam.centerOn(p.x, p.y - bodyOffset);
    cam.startFollow(this.sprite, true, CAMERA_LERP, CAMERA_LERP);
    cam.setFollowOffset(0, bodyOffset);
  }

  private syncSprite(moving: boolean): void {
    const p = getState().player;
    this.sprite.setPosition(p.x, p.y);
    this.sprite.setDepth(10 + p.y);
    this.shadow.setPosition(p.x, p.y - 2).setDepth(9 + p.y);
    if (moving) {
      this.sprite.anims.play(`player_walk_${p.facing}`, true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(playerIdleFrame(p.facing));
    }
  }

  private updateTarget(): void {
    const t = facingTile(getState().player);
    const obj = objectAt(this.objects, t.tx, t.ty);
    const type = obj && obj.type !== 'door' ? obj.type : null;
    if (type !== this.lastTarget) {
      this.lastTarget = type;
      this.game.events.emit(EVT_INTERACT_TARGET, type);
    }
  }

  private updateHighlight(time: number): void {
    const t = facingTile(getState().player);
    const inMap = t.tx >= 0 && t.ty >= 0 && t.tx < this.grid.width && t.ty < this.grid.height;
    this.highlight.setVisible(inMap);
    if (!inMap) return;

    const solid = isTileBlocked(this.grid, t.tx, t.ty);
    const interactive = this.lastTarget !== null;
    if (
      this.highlightTile?.tx !== t.tx ||
      this.highlightTile?.ty !== t.ty ||
      this.highlight.getData('k') !== `${solid}${interactive}`
    ) {
      this.highlightTile = t;
      this.highlight.setData('k', `${solid}${interactive}`);
      this.drawHighlight(solid, interactive);
    }
    this.highlight.setPosition(t.tx * TILE_SIZE + TILE_SIZE / 2, t.ty * TILE_SIZE + TILE_SIZE / 2);
    const base = interactive ? 1 : solid ? 0.35 : 0.9;
    this.highlight.setAlpha(base * (0.78 + 0.22 * Math.sin(time / 170)));
  }

  /** Corner brackets read well on any ground color and never hide the tile. */
  private drawHighlight(solid: boolean, interactive: boolean): void {
    const g = this.highlight;
    const color = interactive ? 0xf4d35e : solid ? 0xf4ead2 : 0xffffff;
    const h = TILE_SIZE / 2;
    const len = 4;
    g.clear();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const cx = sx * (h - 1);
      const cy = sy * (h - 1);
      g.lineStyle(3, 0x14101f, 0.55); // dark underlay keeps it visible on light tiles
      g.beginPath()
        .moveTo(cx - sx * len, cy)
        .lineTo(cx, cy)
        .lineTo(cx, cy - sy * len)
        .strokePath();
      g.lineStyle(1, color, 1);
      g.beginPath()
        .moveTo(cx - sx * len, cy)
        .lineTo(cx, cy)
        .lineTo(cx, cy - sy * len)
        .strokePath();
    }
  }

  /** Brief pop on the highlight so presses feel acknowledged even before tools exist (M3). */
  private pulse(): void {
    this.tweens.killTweensOf(this.highlight);
    this.highlight.setScale(1.3);
    this.tweens.add({ targets: this.highlight, scale: 1, duration: 150, ease: 'Back.easeOut' });
  }

  private onAction(): void {
    if (this.transitioning) return;
    this.pulse();
  }

  private onInteract(): void {
    if (this.transitioning || this.lastTarget === null || this.lastTarget === undefined) return;
    this.pulse();
  }

  /** Tapping a tile next to the player turns toward it and uses the equipped tool there. */
  private onTap(x: number, y: number): void {
    if (this.transitioning) return;
    const wp = this.cameras.main.getWorldPoint(x, y);
    const target = { tx: Math.floor(wp.x / TILE_SIZE), ty: Math.floor(wp.y / TILE_SIZE) };
    const dir = adjacentDirection(playerTile(getState().player), target);
    if (!dir) return;
    getState().player.facing = dir;
    this.syncSprite(false);
    this.pulse();
  }

  private useDoor(door: WorldObject): void {
    const target = doorTarget(door);
    const def = mapsData.maps[target.map];
    if (!def) throw new Error(`Door ${door.id} targets unknown map "${target.map}"`);
    this.transitioning = true;
    this.sprite.anims.stop();
    this.sprite.setFrame(playerIdleFrame(getState().player.facing));
    const cam = this.cameras.main;
    cam.fadeOut(FADE_MS, FADE_COLOR.r, FADE_COLOR.g, FADE_COLOR.b);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      teleportPlayer(getState(), target);
      this.scene.start(def.scene);
    });
  }
}
