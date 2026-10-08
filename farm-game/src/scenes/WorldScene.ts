import Phaser from 'phaser';
import { addRoofs } from '../art/decor';
import { PLAYER_H, PLAYER_TEXTURE, playerIdleFrame, SHADOW_TEXTURE } from '../art/placeholders';
import {
  ACTION_LOCK_MS,
  CAMERA_LERP,
  EVT_INTERACT_TARGET,
  FADE_COLOR,
  FADE_MS,
  MAX_CLOCK_DT_MS,
  SEASON_TINT,
  tileKind,
  TILE_SIZE,
  TILESET_KEY,
  VOID_COLOR,
  WORLD_VIEW,
} from '../config';
import { items, mapsData } from '../data';
import { Effects } from '../fx/Effects';
import { playActionFx } from '../fx/actionFx';
import { TileHighlight } from '../fx/TileHighlight';
import { markerKind, type MarkerKind } from '../ui/targetMarker';
import { FarmRenderer } from '../game/FarmRenderer';
import { NpcRenderer } from '../game/NpcRenderer';
import { ObjectsRenderer } from '../game/ObjectsRenderer';
import { saveNow } from '../game/persistence';
import { inputHub } from '../input/InputHub';
import { audio } from '../platform/audio';
import { haptic } from '../platform/haptics';
import { spawnPosition, type GameState } from '../state/GameState';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { nodeTiles } from '../systems/mining';
import { ownsTile, plotForSaleAt, signTiles } from '../systems/plots';
import { landmarkAt, landmarksOn } from '../systems/projects';
import { mailboxAt } from '../systems/mail';
import { mail } from '../data';
import { projects } from '../data';
import { performBest, pickBest, planAction, type TileInfo } from '../systems/actions';
import { gameEvents, toast } from '../systems/events';
import { currentGoal } from '../systems/goals';
import { selectedStack } from '../systems/inventory';
import { interactWith, pickUpPlaced, placedAt, solidTiles } from '../systems/placeables';
import {
  createMoveState,
  faceDirection,
  isTileBlocked,
  stepMove,
  type CollisionGrid,
  type MoveState,
} from '../systems/movement';
import { tickTime } from '../systems/time';
import {
  adjacentDirection,
  buildCollisionGrid,
  nearestFreeTile,
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

/** Quiet time before the goal arrow appears. */
const GUIDE_AFTER_MS = 14_000;

/** Shared behavior for every walkable map: render, move, collide, doors, farming input. */
export abstract class WorldScene extends Phaser.Scene {
  private grid!: CollisionGrid;
  private raw!: TiledMapLike;
  private things: ObjectsRenderer | null = null;
  private npcs: NpcRenderer | null = null;
  private objects: WorldObject[] = [];
  private sprite!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private highlight!: TileHighlight;
  private ground!: Phaser.Tilemaps.TilemapLayer;
  private farm: FarmRenderer | null = null;
  protected fx!: Effects;
  private transitioning = false;
  /** After a door, ignore held input until it is released once, so doors never bounce. */
  private inputLocked = true;
  private actionLock = 0;
  private idleMs = 0;
  private lastNpcMinute = -1;
  private arrow: Phaser.GameObjects.Graphics | null = null;
  private heldFailed = false;
  /** Uses so far in the current Action hold: later ones tick the haptic less often. */
  private holdUses = 0;
  /** Turn-in-place and settle-on-release state (runtime only). */
  private move: MoveState = createMoveState();
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
    this.move = createMoveState();

    const raw = this.cache.tilemap.get(mapCacheKey(this.mapId)).data as TiledMapLike;
    this.raw = raw;
    this.rebuildGrid();
    this.objects = parseMapObjects(raw);
    // A saved position can be damaged (out of the map, inside a wall): step out to the nearest open tile.
    {
      const here = playerTile(state.player);
      if (isTileBlocked(this.grid, here.tx, here.ty)) {
        const free = nearestFreeTile(this.grid, here.tx, here.ty);
        const pos = spawnPosition(free.tx, free.ty);
        state.player.x = pos.x;
        state.player.y = pos.y;
      }
    }

    const map = this.make.tilemap({ key: mapCacheKey(this.mapId) });
    const tileset = map.addTilesetImage('placeholder', TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Tileset "placeholder" missing from map');
    const layer = map.createLayer('ground', tileset);
    if (!layer) throw new Error('Map has no "ground" layer');
    this.ground = layer.setDepth(0);
    addRoofs(this, layer, !!mapsData.maps[this.mapId]?.farmland);

    if (mapsData.maps[this.mapId]?.outdoor && SEASON_TINT[state.time.season] !== 0xffffff) {
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

    this.npcs = new NpcRenderer(this, this.mapId);
    this.npcs.sync(state, playerTile(state.player));
    this.rebuildGrid();
    this.things = new ObjectsRenderer(this, this.mapId);
    this.things.sync(state, false);
    this.highlight = new TileHighlight(this);
    this.idleMs = 0;
    this.lastNpcMinute = state.time.minutes;
    this.arrow = this.add.graphics().setScrollFactor(0).setDepth(9400).setVisible(false);
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
      gameEvents.on('mailChanged', () => this.things?.syncMailbox(getState())),
      // Flourishes: a heart gained and a level reached are celebrated where the player stands.
      gameEvents.on('heartUp', () => {
        const p = getState().player;
        this.fx.hearts(p.x, p.y - 14);
      }),
      gameEvents.on('levelUp', () => {
        const p = getState().player;
        this.fx.celebrate(p.x, p.y - 10);
      }),
      gameEvents.on('friendsChanged', () =>
        this.npcs?.sync(getState(), playerTile(getState().player)),
      ),
      gameEvents.on('forageChanged', ({ map }) => {
        if (map === this.mapId) this.things?.sync(getState(), true);
      }),
      gameEvents.on('nodesChanged', ({ map }) => {
        if (map !== this.mapId) return;
        this.rebuildGrid();
        this.things?.sync(getState(), true);
      }),
      gameEvents.on('placedChanged', ({ map }) => {
        if (map !== this.mapId) return;
        this.rebuildGrid();
        this.things?.sync(getState(), true);
      }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup.forEach((off) => off());
      this.cleanup = [];
      this.farm?.destroy();
      this.farm = null;
      this.things?.destroy();
      this.things = null;
      this.npcs?.destroy();
      this.npcs = null;
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

    const { moving } = stepMove(player, this.move, dir, delta, this.grid);
    this.syncSprite(moving);

    const here = playerTile(player);
    const door = objectAt(this.objects, here.tx, here.ty, 'door');
    if (door) {
      this.useDoor(door);
      return;
    }

    if (!inputHub.actionHeld) {
      this.heldFailed = false;
      this.holdUses = 0;
    } else if (this.actionLock <= 0 && !this.inputLocked && !this.heldFailed) this.tryAction();

    this.updateNpcs(state);
    this.updateTarget();
    this.updateHighlight(time);
    this.updateGuide(time, delta);
  }

  /** Villagers move on their schedule: check once per game minute and re-block tiles when someone moved. */
  private updateNpcs(state: GameState): void {
    if (state.time.minutes === this.lastNpcMinute) return;
    this.lastNpcMinute = state.time.minutes;
    if (this.npcs?.sync(state, playerTile(state.player))) this.rebuildGrid();
  }

  /**
   * After a quiet spell, a bobbing arrow shows where the current goal wants you to go: over the spot when it is
   * on screen, at the screen edge pointing toward it when it is not. Any input hides it again.
   */
  private updateGuide(time: number, delta: number): void {
    const arrow = this.arrow;
    if (!arrow) return;
    if (inputHub.direction !== null || inputHub.actionHeld) this.idleMs = 0;
    else this.idleMs += delta;
    const where = currentGoal(getState())?.where?.[this.mapId];
    if (!where || this.idleMs < GUIDE_AFTER_MS) {
      arrow.setVisible(false);
      return;
    }
    const cam = this.cameras.main;
    const wx = where[0] * TILE_SIZE + TILE_SIZE / 2 - cam.scrollX;
    const wy = where[1] * TILE_SIZE + TILE_SIZE / 2 - cam.scrollY;
    const m = 10;
    const cx = Math.max(m, Math.min(WORLD_VIEW.w - m, wx));
    const cy = Math.max(m, Math.min(WORLD_VIEW.h - m, wy));
    const onScreen = cx === wx && cy === wy;
    const bob = Math.sin(time / 180) * 2;
    arrow.clear().setVisible(true).setPosition(cx, cy);
    arrow.fillStyle(0x14101f, 0.7);
    arrow.fillStyle(0xf4d35e, 1);
    if (onScreen) {
      // a down arrow floating over the target tile
      arrow.fillTriangle(-5, -18 + bob, 5, -18 + bob, 0, -9 + bob);
      arrow.fillRect(-2, -26 + bob, 4, 8);
    } else {
      const ang = Math.atan2(wy - cy, wx - cx);
      const tip = { x: Math.cos(ang) * (9 + bob), y: Math.sin(ang) * (9 + bob) };
      const left = ang + 2.5;
      const right = ang - 2.5;
      arrow.fillTriangle(
        tip.x,
        tip.y,
        tip.x + Math.cos(left) * 9,
        tip.y + Math.sin(left) * 9,
        tip.x + Math.cos(right) * 9,
        tip.y + Math.sin(right) * 9,
      );
    }
  }

  // ---- setup ----

  private setupCamera(mapW: number, mapH: number): void {
    const cam = this.cameras.main;
    // The world only draws between the HUD and the dock, so nothing is ever hidden behind a control.
    cam.setViewport(WORLD_VIEW.x, WORLD_VIEW.y, WORLD_VIEW.w, WORLD_VIEW.h);
    cam.setBackgroundColor(VOID_COLOR);
    // Maps smaller than the view get bounds equal to the view, centered on the map.
    const bw = Math.max(mapW, WORLD_VIEW.w);
    const bh = Math.max(mapH, WORLD_VIEW.h);
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
    const def = mapsData.maps[this.mapId];
    const tillable = def?.tillable ?? [];
    const farmland = def?.farmland === true;
    return {
      map: this.mapId,
      tx: t.tx,
      ty: t.ty,
      kind: tileKind(gid),
      tillable: tillable.includes(gid),
      blocked: isTileBlocked(this.grid, t.tx, t.ty),
      farmland,
      owned: farmland ? ownsTile(getState(), t.tx, t.ty) : undefined,
      at: (tx, ty) => (this.inMap({ tx, ty }) ? this.tileInfo({ tx, ty }) : null),
    };
  }

  private inMap(t: TileCoord): boolean {
    return t.tx >= 0 && t.ty >= 0 && t.tx < this.grid.width && t.ty < this.grid.height;
  }

  /** Placed objects block movement when solid, so the collision grid is the map plus those. */
  private rebuildGrid(): void {
    this.grid = buildCollisionGrid(this.raw);
    for (const [tx, ty] of solidTiles(getState(), this.mapId)) {
      if (tx >= 0 && ty >= 0 && tx < this.grid.width && ty < this.grid.height)
        this.grid.blocked[ty * this.grid.width + tx] = 1;
    }
    const block = ([tx, ty]: [number, number]) => {
      if (this.inMap({ tx, ty })) this.grid.blocked[ty * this.grid.width + tx] = 1;
    };
    this.npcs?.tiles().forEach(block);
    nodeTiles(getState(), this.mapId).forEach(block);
    landmarksOn(getState(), this.mapId).forEach((l) => block([l.tx, l.ty]));
    if (mail.mailbox.map === this.mapId) block([mail.mailbox.tx, mail.mailbox.ty]);
    if (this.mapId === 'farm') signTiles(getState()).forEach(block);
  }

  /**
   * One-thumb targeting: the tile in front, then the two beside it. The player never has to line up
   * exactly with a plant or a pick-up; whatever the equipped item can act on nearby gets the action.
   */
  private candidates(): TileCoord[] {
    const p = getState().player;
    const f = facingTile(p);
    const side = p.facing === 'up' || p.facing === 'down' ? { x: 1, y: 0 } : { x: 0, y: 1 };
    return [
      f,
      { tx: f.tx - side.x, ty: f.ty - side.y },
      { tx: f.tx + side.x, ty: f.ty + side.y },
    ].filter((t) => this.inMap(t));
  }

  /** What Interact would do on a tile: a map object (bed, bin...) or a placed machine. */
  private interactableAt(t: TileCoord): string | null {
    if (this.mapId === 'farm') {
      const plot = plotForSaleAt(getState(), t.tx, t.ty);
      if (plot) return `plot:${plot}`;
    }
    const npc = this.npcs?.at(t.tx, t.ty);
    if (npc) return `npc:${npc}`;
    if (mailboxAt(this.mapId, t.tx, t.ty)) return 'mailbox';
    const landmark = landmarkAt(getState(), this.mapId, t.tx, t.ty);
    if (landmark) return `landmark:${landmark}`;
    const obj = objectAt(this.objects, t.tx, t.ty);
    if (obj && ['bed', 'bin', 'shop', 'board'].includes(obj.type)) return obj.type;
    return placedAt(getState(), this.mapId, t.tx, t.ty)?.type ?? null;
  }

  /** The first nearby tile Interact applies to. */
  private interactTile(): { tile: TileCoord; type: string } | null {
    for (const tile of this.candidates()) {
      const type = this.interactableAt(tile);
      if (type) return { tile, type };
    }
    return null;
  }

  /** The tile the equipped item would act on right now (first that works), else the one faced. */
  private actionTile(): { tile: TileCoord; plan: string | null } {
    const state = getState();
    const cands = this.candidates();
    const best = pickBest(
      state,
      cands.map((t) => this.tileInfo(t)),
    );
    if (best) return { tile: { tx: best.tile.tx, ty: best.tile.ty }, plan: best.plan.kind };
    return { tile: facingTile(state.player), plan: null };
  }

  private updateTarget(): void {
    const type = this.interactTile()?.type ?? null;
    if (type !== this.lastTarget) {
      this.lastTarget = type;
      this.game.events.emit(EVT_INTERACT_TARGET, type);
    }
  }

  /** The marker shows where Action will act, in a shape and colour that say whether it will. */
  private updateHighlight(time: number): void {
    const interact = this.interactTile();
    const act = this.actionTile();
    const t = interact && !act.plan ? interact.tile : act.tile;
    const kind: MarkerKind = markerKind({
      planKind: act.plan,
      interactable: !act.plan && interact !== null,
    });
    this.highlight.update(this.inMap(t) ? t : null, kind, time);
  }

  // ---- actions ----

  private tryAction(only?: TileCoord): void {
    const state = getState();
    const tiles = only ? [only] : this.candidates();
    if (tiles.length === 0) return;
    const stack = selectedStack(state);
    const res = performBest(
      state,
      tiles.map((t) => this.tileInfo(t)),
    );
    this.highlight.pulse();
    if (res.ok) {
      this.actionLock = ACTION_LOCK_MS.ok;
      this.heldFailed = false;
      playActionFx(this.fx, res, getState().player, stack?.item);
      // Light tick per tile worked (a held press repeats it at most every 450 ms); a ripe harvest is medium.
      if (res.kind === 'harvest') haptic('medium');
      else haptic('tick', { repeat: inputHub.actionHeld && this.holdUses > 0 });
      if (inputHub.actionHeld) this.holdUses++;
    } else {
      this.actionLock = ACTION_LOCK_MS.fail;
      this.heldFailed = true;
      audio.play('error');
      haptic('error');
      this.fx.shake(this.sprite);
    }
  }

  private onInteract(tile?: TileCoord): void {
    if (this.transitioning || runtime.blocked || this.inputLocked) return;
    const hit = tile ? { tile, type: this.interactableAt(tile) } : this.interactTile();
    if (!hit?.type) return;
    this.highlight.pulse();
    audio.play('ui');
    haptic('tick');
    if (hit.type.startsWith('plot:'))
      return void gameEvents.emit('buyPlot', { id: hit.type.slice(5) });
    if (hit.type.startsWith('npc:')) {
      const id = hit.type.slice(4);
      const p = getState().player;
      this.npcs?.faceToward(id, p.x, p.y);
      return void gameEvents.emit('talkTo', { id });
    }
    if (hit.type.startsWith('landmark:')) {
      const p = projects[hit.type.slice(9)];
      return void (p && toast(`${p.name}: funded by you! ${p.reward}`, 'good'));
    }
    if (hit.type === 'mailbox') return void gameEvents.emit('openPanel', { type: 'mail' });
    if (hit.type === 'bed') return void gameEvents.emit('openPanel', { type: 'sleep' });
    if (hit.type === 'bin') return void gameEvents.emit('openPanel', { type: 'bin' });
    if (hit.type === 'shop') return void gameEvents.emit('openPanel', { type: 'shop' });
    if (hit.type === 'board') return void gameEvents.emit('openPanel', { type: 'board' });
    const state = getState();
    const obj = placedAt(state, this.mapId, hit.tile.tx, hit.tile.ty);
    if (!obj) return;
    // Snapshot the bag so goods collected from a coop, jar, hive or tree can pop out of it.
    const before = new Map<string, number>();
    for (const st of state.inventory.slots)
      if (st) before.set(st.item, (before.get(st.item) ?? 0) + st.qty);
    const res = interactWith(state, obj);
    const gained = state.inventory.slots.find(
      (st) => st && st.item !== obj.type && st.qty > (before.get(st.item) ?? 0),
    );
    if (gained) {
      const at = FarmRenderer.center(obj.tx, obj.ty);
      this.fx.itemPop(at.x, at.y - 10, items[gained.item]?.icon ?? 'ui_coin');
      this.fx.sparkle(at.x, at.y - 6, 0xf4d35e);
    }
    if (res.kind === 'panel') gameEvents.emit('placedPanel', { panel: res.panel, id: res.id });
    else if (res.kind === 'message' && res.text) toast(res.text, 'info');
    else if (res.kind === 'pickup') {
      const got = pickUpPlaced(state, this.mapId, obj);
      if (got === 'busy') toast("It's busy. Wait until it's done.", 'warn');
      else if (got === 'full') toast('Inventory full!', 'warn');
    }
    this.things?.sync(state, true);
  }

  /** Tapping a tile next to the player turns toward it and uses the equipped item there. */
  private onTap(x: number, y: number): void {
    if (this.transitioning || runtime.blocked || this.actionLock > 0) return;
    // Taps arrive in screen space; only the world viewport shows tiles.
    if (y < WORLD_VIEW.y || y >= WORLD_VIEW.y + WORLD_VIEW.h) return;
    const cam = this.cameras.main;
    const wx = x - cam.x + cam.scrollX;
    const wy = y - cam.y + cam.scrollY;
    const target = { tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) };
    const player = getState().player;
    const dir = adjacentDirection(playerTile(player), target);
    if (!dir) {
      // Nothing to do from here: answer anyway, so a tap is never silent.
      this.highlight.ping(target.tx, target.ty);
      audio.play('select');
      return;
    }
    faceDirection(player, dir);
    this.syncSprite(false);
    if (this.interactableAt(target) && !planAction(getState(), this.tileInfo(target)).ok)
      this.onInteract(target);
    else this.tryAction(target);
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
