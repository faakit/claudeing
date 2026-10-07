import Phaser from 'phaser';
import { PLAYER_H, PLAYER_TEXTURE, playerIdleFrame, SHADOW_TEXTURE } from '../art/placeholders';
import {
  ACTION_LOCK_MS,
  CAMERA_LERP,
  EVT_INTERACT_TARGET,
  FADE_COLOR,
  FADE_MS,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_CLOCK_DT_MS,
  SEASON_TINT,
  tileKind,
  TILE_SIZE,
  TILESET_KEY,
  VOID_COLOR,
} from '../config';
import { items, mapsData } from '../data';
import { Effects } from '../fx/Effects';
import { FarmRenderer } from '../game/FarmRenderer';
import { saveNow } from '../game/persistence';
import { inputHub } from '../input/InputHub';
import { audio } from '../platform/audio';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { performAction, type ActionResult, type TileInfo } from '../systems/actions';
import { gameEvents } from '../systems/events';
import { getSoil, isMature } from '../systems/farming';
import { selectedStack } from '../systems/inventory';
import { isTileBlocked, stepPlayer, type CollisionGrid } from '../systems/movement';
import { tickTime } from '../systems/time';
import {
  adjacentDirection,
  buildCollisionGrid,
  doorTarget,
  facingTile,
  objectAt,
  parseMapObjects,
  playerTile,
  teleportPlayer,
  type TileCoord,
  type TiledMapLike,
  type WorldObject,
} from '../systems/world';
import { mapCacheKey } from './PreloadScene';

type HighlightKind = 'free' | 'solid' | 'interactive' | 'harvest';

/** Shared behavior for every walkable map: render, move, collide, doors, farming input. */
export abstract class WorldScene extends Phaser.Scene {
  private grid!: CollisionGrid;
  private objects: WorldObject[] = [];
  private sprite!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private highlight!: Phaser.GameObjects.Graphics;
  private highlightKey = '';
  private ground!: Phaser.Tilemaps.TilemapLayer;
  private farm: FarmRenderer | null = null;
  protected fx!: Effects;
  private transitioning = false;
  /** After a door, ignore held input until it is released once, so doors never bounce. */
  private inputLocked = true;
  private actionLock = 0;
  private heldFailed = false;
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
    this.actionLock = 0;
    this.heldFailed = false;
    this.lastTarget = undefined;
    this.highlightKey = '';

    const raw = this.cache.tilemap.get(mapCacheKey(this.mapId)).data as TiledMapLike;
    this.grid = buildCollisionGrid(raw);
    this.objects = parseMapObjects(raw);

    const map = this.make.tilemap({ key: mapCacheKey(this.mapId) });
    const tileset = map.addTilesetImage('placeholder', TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Tileset "placeholder" missing from map');
    const layer = map.createLayer('ground', tileset);
    if (!layer) throw new Error('Map has no "ground" layer');
    this.ground = layer.setDepth(0);

    if (mapsData.maps[this.mapId]?.outdoor) {
      this.add
        .rectangle(0, 0, map.widthInPixels, map.heightInPixels, SEASON_TINT[state.time.season])
        .setOrigin(0)
        .setDepth(0.2)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
    }

    this.fx = new Effects(this);
    if (this.mapId === 'farm') {
      this.farm = new FarmRenderer(this);
      this.farm.sync(state, false);
    }

    this.highlight = this.add.graphics().setDepth(1);
    this.shadow = this.add.image(0, 0, SHADOW_TEXTURE).setOrigin(0.5, 0.5);
    this.sprite = this.add
      .sprite(0, 0, PLAYER_TEXTURE, playerIdleFrame(state.player.facing))
      .setOrigin(0.5, 1);
    this.sprite.on(
      Phaser.Animations.Events.ANIMATION_UPDATE,
      (_a: unknown, f: Phaser.Animations.AnimationFrame) => {
        if (f.index % 2 === 0) this.footstep();
      },
    );
    this.syncSprite(false);

    this.setupCamera(map.widthInPixels, map.heightInPixels);
    this.cameras.main.fadeIn(FADE_MS, FADE_COLOR.r, FADE_COLOR.g, FADE_COLOR.b);

    this.cleanup.push(
      inputHub.on('interact', () => this.onInteract()),
      inputHub.on('tap', (p) => this.onTap(p.x, p.y)),
      gameEvents.on('farmChanged', () => this.farm?.sync(getState(), true)),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup.forEach((off) => off());
      this.cleanup = [];
      this.farm?.destroy();
      this.farm = null;
      this.game.events.emit(EVT_INTERACT_TARGET, null);
    });
  }

  update(time: number, delta: number): void {
    if (this.transitioning) return;
    const state = getState();
    const player = state.player;

    if (runtime.blocked) {
      // Panels and flows freeze the world and the clock.
      this.sprite.anims.stop();
      this.sprite.setFrame(playerIdleFrame(player.facing));
      this.actionLock = Math.max(0, this.actionLock - delta);
      this.updateHighlight(time);
      return;
    }

    if (tickTime(state, Math.min(delta, MAX_CLOCK_DT_MS)).passOut) {
      runtime.busy = true;
      gameEvents.emit('sleepRequest', { passedOut: true });
      return;
    }

    this.actionLock = Math.max(0, this.actionLock - delta);
    let dir = inputHub.direction;
    if (this.inputLocked) {
      if (dir === null) this.inputLocked = false;
      dir = null;
    }
    if (this.actionLock > 0) dir = null; // a swing roots you for a moment

    const { moving } = stepPlayer(player, dir, delta, this.grid);
    this.syncSprite(moving);

    const here = playerTile(player);
    const door = objectAt(this.objects, here.tx, here.ty, 'door');
    if (door) {
      this.useDoor(door);
      return;
    }

    if (!inputHub.actionHeld) this.heldFailed = false;
    else if (this.actionLock <= 0 && !this.inputLocked && !this.heldFailed) this.tryAction();

    this.updateTarget();
    this.updateHighlight(time);
  }

  // ---- setup ----

  private setupCamera(mapW: number, mapH: number): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(VOID_COLOR);
    // Maps smaller than the screen get bounds equal to the screen, centered on the map.
    const bw = Math.max(mapW, GAME_WIDTH);
    const bh = Math.max(mapH, GAME_HEIGHT);
    cam.setBounds(-(bw - mapW) / 2, -(bh - mapH) / 2, bw, bh);
    const p = getState().player;
    const bodyOffset = PLAYER_H / 2 - 4; // aim at the body, not the feet
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

  private footstep(): void {
    const t = playerTile(getState().player);
    const kind = tileKind(this.ground.getTileAt(t.tx, t.ty)?.index ?? 0);
    audio.play(kind === 'floor' || kind === 'path' ? 'stepWood' : 'stepGrass');
  }

  // ---- targeting ----

  private tileInfo(t: TileCoord): TileInfo {
    const gid = this.ground.getTileAt(t.tx, t.ty)?.index ?? 0;
    const tillable = mapsData.maps[this.mapId]?.tillable ?? [];
    return {
      tx: t.tx,
      ty: t.ty,
      kind: tileKind(gid),
      tillable: tillable.includes(gid),
      blocked: isTileBlocked(this.grid, t.tx, t.ty),
    };
  }

  private inMap(t: TileCoord): boolean {
    return t.tx >= 0 && t.ty >= 0 && t.tx < this.grid.width && t.ty < this.grid.height;
  }

  private updateTarget(): void {
    const t = facingTile(getState().player);
    const obj = objectAt(this.objects, t.tx, t.ty);
    const type = obj && ['bed', 'bin', 'shop'].includes(obj.type) ? obj.type : null;
    if (type !== this.lastTarget) {
      this.lastTarget = type;
      this.game.events.emit(EVT_INTERACT_TARGET, type);
    }
  }

  private highlightKind(t: TileCoord): HighlightKind {
    if (this.lastTarget) return 'interactive';
    const crop = getSoil(getState(), t.tx, t.ty)?.crop;
    if (crop && isMature(crop)) return 'harvest';
    return isTileBlocked(this.grid, t.tx, t.ty) ? 'solid' : 'free';
  }

  private updateHighlight(time: number): void {
    const t = facingTile(getState().player);
    this.highlight.setVisible(this.inMap(t));
    if (!this.inMap(t)) return;
    const kind = this.highlightKind(t);
    if (kind !== this.highlightKey) {
      this.highlightKey = kind;
      this.drawHighlight(kind);
    }
    this.highlight.setPosition(t.tx * TILE_SIZE + TILE_SIZE / 2, t.ty * TILE_SIZE + TILE_SIZE / 2);
    const base = kind === 'solid' ? 0.4 : 1;
    this.highlight.setAlpha(base * (0.78 + 0.22 * Math.sin(time / 170)));
  }

  /** Corner brackets read well on any ground color and never hide the tile. */
  private drawHighlight(kind: HighlightKind): void {
    const g = this.highlight;
    const color = { free: 0xffffff, solid: 0xf4ead2, interactive: 0xf4d35e, harvest: 0x9be37f }[
      kind
    ];
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

  private pulse(): void {
    this.tweens.killTweensOf(this.highlight);
    this.highlight.setScale(1.3);
    this.tweens.add({ targets: this.highlight, scale: 1, duration: 150, ease: 'Back.easeOut' });
  }

  // ---- actions ----

  private tryAction(): void {
    const state = getState();
    const t = facingTile(state.player);
    if (!this.inMap(t)) return;
    const stack = selectedStack(state);
    const res = performAction(state, this.tileInfo(t));
    this.pulse();
    if (res.ok) {
      this.actionLock = ACTION_LOCK_MS.ok;
      this.heldFailed = false;
      this.playActionFx(res, stack?.item);
    } else {
      this.actionLock = ACTION_LOCK_MS.fail;
      this.heldFailed = true;
      audio.play('error');
      this.fx.shake(this.sprite);
    }
  }

  private playActionFx(res: Extract<ActionResult, { ok: true }>, equipped?: string): void {
    const { x, y } = FarmRenderer.center(res.tx, res.ty);
    const p = getState().player;
    const icon = equipped ? items[equipped]?.icon : undefined;
    if (icon && items[equipped as string]?.type === 'tool') {
      this.fx.swing(p.x, p.y, icon, p.facing);
      audio.play('swing');
    }
    switch (res.kind) {
      case 'till':
        this.fx.dust(x, y);
        audio.play('till');
        break;
      case 'water':
        this.fx.splash(x, y);
        audio.play('water');
        break;
      case 'refill':
        this.fx.splash(x, y);
        this.fx.floatText(p.x, p.y - 30, 'Refilled!', 0x6fa3e0);
        audio.play('refill');
        break;
      case 'clear':
        this.fx.leaves(x, y);
        this.fx.floatText(p.x, p.y - 30, '+1 Fiber', 0x7fc96b);
        audio.play('cut');
        break;
      case 'plant':
        this.fx.dust(x, y);
        audio.play('plant');
        break;
      case 'harvest': {
        const def = items[res.item ?? ''];
        this.fx.sparkle(x, y - 4, parseInt((def?.color ?? '#ffffff').slice(1), 16));
        if (def) {
          this.fx.itemPop(x, y - 8, def.icon);
          this.fx.floatText(p.x, p.y - 30, `+${res.qty ?? 1} ${def.name}`, 0xf4ead2);
        }
        audio.play('harvest');
        break;
      }
    }
  }

  private onInteract(): void {
    if (this.transitioning || runtime.blocked || this.inputLocked) return;
    const t = facingTile(getState().player);
    const obj = objectAt(this.objects, t.tx, t.ty);
    if (!obj) return;
    this.pulse();
    audio.play('ui');
    if (obj.type === 'bed') gameEvents.emit('openPanel', { type: 'sleep' });
    else if (obj.type === 'bin') gameEvents.emit('openPanel', { type: 'bin' });
    else if (obj.type === 'shop') gameEvents.emit('openPanel', { type: 'shop' });
  }

  /** Tapping a tile next to the player turns toward it and uses the equipped item there. */
  private onTap(x: number, y: number): void {
    if (this.transitioning || runtime.blocked || this.actionLock > 0) return;
    const wp = this.cameras.main.getWorldPoint(x, y);
    const target = { tx: Math.floor(wp.x / TILE_SIZE), ty: Math.floor(wp.y / TILE_SIZE) };
    const player = getState().player;
    const dir = adjacentDirection(playerTile(player), target);
    if (!dir) return;
    player.facing = dir;
    this.syncSprite(false);
    const obj = objectAt(this.objects, target.tx, target.ty);
    if (obj && ['bed', 'bin', 'shop'].includes(obj.type)) this.onInteract();
    else this.tryAction();
  }

  private useDoor(door: WorldObject): void {
    const target = doorTarget(door);
    const def = mapsData.maps[target.map];
    if (!def) throw new Error(`Door ${door.id} targets unknown map "${target.map}"`);
    this.transitioning = true;
    audio.play('door');
    this.sprite.anims.stop();
    this.sprite.setFrame(playerIdleFrame(getState().player.facing));
    const cam = this.cameras.main;
    cam.fadeOut(FADE_MS, FADE_COLOR.r, FADE_COLOR.g, FADE_COLOR.b);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      teleportPlayer(getState(), target);
      void saveNow(true);
      this.scene.start(def.scene);
    });
  }
}
