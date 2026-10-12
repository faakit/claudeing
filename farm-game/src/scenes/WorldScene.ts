import Phaser from 'phaser';
import { MapArt, tilesetFor } from '../art/mapLayers';
import { DRY_SAFETY_NET, dryTilesetKey, ensureDryTileset, TILE_INDEX_KEY } from '../art/dryTiles';
import {
  channelMask,
  channelTileName,
  culvertTileName,
  isGroundDecal,
  mouthTileName,
  namesBySlot,
  OPPOSITE,
  SIDES as CHANNEL_SIDES,
  tileGid,
  type TileIndex,
} from '../art/channelTiles';
import { GreenReveal } from '../fx/GreenReveal';
import { ChannelFx } from '../fx/ChannelFx';
import {
  interactSite,
  paletteOf,
  placeWhere,
  creekMomentDue,
  riverMomentDue,
  takeRiverMoment,
  creekSource,
  takeCreekMoment,
  takeFirstGreenMoment,
  valleyStage,
  valleyStep,
} from '../systems/valley';
import { lookCacheKey } from './PreloadScene';
import { hasArt } from '../art/registry';
import { PLAYER_H, PLAYER_TEXTURE, playerIdleFrame, SHADOW_TEXTURE } from '../art/placeholders';
import {
  ACTION_LOCK_MS,
  EVT_INTERACT_TARGET,
  FADE_COLOR,
  FADE_MS,
  MAX_CLOCK_DT_MS,
  TURN_HOLD_MS,
  PLAYER_HITBOX,
  PLAYER_SPEED,
  SEASON_TINT,
  tileKind,
  TILE_SIZE,
  VOID_COLOR,
  WORLD_CLEAR,
  WORLD_VIEW,
} from '../config';
import { items, mapsData, valley } from '../data';
import { houseOf, speciesOf } from '../systems/animals';
import {
  ACT_CONTACT_FRAME,
  ACT_FEET_ROW,
  ACT_FOR_KIND,
  ACT_FRAME_H,
  ACT_ITEM_ANCHORS,
  ACT_ORIGIN_Y,
} from '../art/manifest';
import { Effects, RISING_LABEL } from '../fx/Effects';
import { playActionFx } from '../fx/actionFx';
import { parseLights, publishGlow } from '../fx/NightGlow';
import { Ambient, parseBlooms } from '../fx/Ambient';
import { NO_HOLE, SeeThrough } from '../fx/SeeThrough';
import { Label } from '../ui/font';
import { liftClear, type Plate } from '../ui/layout';
import { PixelCamera } from '../fx/PixelCamera';
import { DoorFx } from '../fx/DoorFx';
import { PlayerFrames, showFrame, TOOL_CONTACT_FRAME, type FrameRef } from '../fx/playerFrames';
import {
  breathFrame,
  shouldHoldCamera,
  HIT_STOP_MS,
  isContactFrame,
  walkFps,
  WIPE_CLOSE_MS,
  WIPE_OPEN_MS,
} from '../fx/feel';
import type { Wipe } from '../fx/Wipe';
import { TileHighlight } from '../fx/TileHighlight';
import { markerKind, type MarkerKind } from '../ui/targetMarker';
import {
  findPath,
  pathToFace,
  pathToFaceAny,
  replanFrom,
  routeStarts,
  standTiles,
  type RouteStart,
} from '../systems/pathfind';
import { createWork, nextWork, type WorkQueue } from '../systems/workQueue';
import {
  compensateTouch,
  ownTileTap,
  tapIntent,
  type TapIntent,
  type TapWorld,
} from '../systems/tapIntent';
import { cssPerLogical } from '../ui/hit';
import { FarmRenderer } from '../game/FarmRenderer';
import { NpcRenderer } from '../game/NpcRenderer';
import { ObjectsRenderer } from '../game/ObjectsRenderer';
import { saveNow } from '../game/persistence';
import { controlsLog } from '../input/controlsLog';
import { pathTiles } from '../input/gesture';
import { TIPS } from '../ui/controlTips';
import { inputHub } from '../input/InputHub';
import { audio } from '../platform/audio';
import { haptic } from '../platform/haptics';
import { spawnPosition, type Direction, type GameState } from '../state/GameState';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { nodeTiles } from '../systems/mining';
import { ownsTile, plotForSaleAt, signTiles } from '../systems/plots';
import { landmarkAt, landmarksOn } from '../systems/projects';
import { mailboxAt } from '../systems/mail';
import { mail } from '../data';
import { type TileInfo } from '../systems/actions';
import { actOn, chooseAction } from '../systems/autoTool';
import { gameEvents, toast } from '../systems/events';
import { currentGoal, tipsHeldNow } from '../systems/goals';
import { interactWith, pickUpPlaced, placedAt, solidTiles } from '../systems/placeables';
import {
  createMoveState,
  createRoute,
  faceDirection,
  isTileBlocked,
  stepMove,
  stepRoute,
  type CollisionGrid,
  type MoveState,
  type Route,
} from '../systems/movement';
import { tickTime } from '../systems/time';
import { inDelta } from '../systems/valley';
import {
  adjacentDirection,
  buildCollisionGrid,
  nearestFreeTile,
  nearestDoorSpawn,
  doorLocked,
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
import { activeMapKey, preparseMap, takeTilemap } from './mapCache';
import { guidedTracksDone, tutorialOn, type CoachObject } from '../systems/tutorial';
import type { CoachScreenWorld } from '../ui/CoachMarks';
import { npcLocation } from '../systems/npcs';
import { npcs as npcData } from '../data';
import { t } from '../i18n';

/** The creek's first morning: how long the water takes down the bed in view, and its banner (the valley slot). */
const CREEK_REVEAL_MS = 1800;
/** The creek's banner: a title line and a line under it. */
const creekBanner = (): string => `${t('valley.creekTitle')}\n${t('valley.creekLine')}`;
/** The river's first morning in town (M6): the dry town dissolves around the farmer, a little slower. */
const RIVER_REVEAL_MS = 1600;
/** The river's banner (valley.json, translated with the data). */
const riverBanner = (): string => valley.places['weir']?.banner ?? t('valley.riverTitle');

/** A bank tile where a first channel can start on any farm (open ground beside the creek, no plot). */
const CREEK_BANK = [25, 14] as const;

/** A work day's beat at a site (ms): three swings and a stone rolling off, or two spade cuts and the water. */
const SITE_BEAT_MS = { pickaxe: 3300, channel: 3400, beam: 3600 } as const;

/** A channel's fallback tiles when the tileset has no channel art (placeholder tiles): plain water, dug earth. */
const CHANNEL_GID = { wet: 5, dry: 2 } as const;

/** Tool-use poses by tool item (chars atlas, from the Flow sheet npcs4). */
const TOOL_POSES: Record<string, string> = {
  hoe: 'player_use_hoe',
  watering_can: 'player_use_can',
  fishing_rod: 'player_use_rod',
};
/** What each tool's own use is called, so a harvest with the hoe in hand never shows the hoe pose. */
const TOOL_KINDS: Record<string, string[]> = {
  hoe: ['till'],
  watering_can: ['water', 'refill'],
  fishing_rod: ['cast'],
  scythe: ['clear'],
  pickaxe: ['mine'],
};
/** Doors with a leaf that opens (frames-wanted.md): the farmhouse door outside, the house door inside. */
const doorStyle = (map: string, to: string): string | null =>
  map === 'farm' && to === 'house' ? 'farmhouse' : null;
/** The first-use warm-up of the effects ran this session. */
let fxWarmed = false;
/** Swing timing (ms): the wind-up shows at once, the impact (fx, sound, haptic) lands on the strike frame. */
const SWING = { windup: 50 } as const;
/** After a swing the stick may walk again this soon, even while the next use still waits for the lock. */
const MOVE_ROOT_MS = 120;
/** Standing still this long facing a tile under a crown cuts the target part of the see-through hole. */
const HOLE_STILL_MS = 250;

/** Palette slot 0 (ink): the outline colour, also the void around indoor maps. */
const INK_HEX = '#2a1a24';

/** Uses a painted tile may get in one visit (till, plant, water). */
const WORK_USES_PER_TILE = 3;
/** Quiet time before the goal arrow appears. */
const GUIDE_AFTER_MS = 14_000;
/** The same while the guided start's first days run (between its coach marks). */
const GUIDE_GUIDED_MS = 3_000;

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
  private tilemap!: Phaser.Tilemaps.Tilemap;
  /** Detail-layer tiles a channel drew over, to put back when it is filled in. */
  private channelUnder = new Map<string, number>();
  /** Shade-layer tiles under channel overlays (hidden decals, culverts, creek mouths), by cell. */
  private channelShadeUnder = new Map<string, number>();
  /** Creek cell -> the channel cell whose mouth is drawn on it. */
  private channelMouths = new Map<string, string>();
  /** Painted channel cells and their look. */
  private channelLook = new Map<string, 'wet' | 'dry'>();
  private channelSlotNames: Map<number, string> | undefined;
  private farm: FarmRenderer | null = null;
  /** The channels' juice: the spade's cut, the water running into it, the morning's run (fx/ChannelFx.ts). */
  private channels: ChannelFx | null = null;
  private mapArt: MapArt | null = null;
  private ambient: Ambient | null = null;
  /** The pixel-art see-through hole over crowns and tall objects in front of the player (review 9). */
  private seeThrough: SeeThrough | null = null;
  /** The tool-use pose shown for a moment after a tool action (art only; see toolPose). */
  private pose: Phaser.GameObjects.Image | null = null;
  /** The pose frames in order, each shown from `at` (scene ms), until `poseUntil`. */
  private poseSeq: { f: FrameRef; at: number }[] = [];
  private poseUntil = 0;
  /** An action animation waiting for the world to run again (the reel, after the fishing sheet). */
  private pendingAct: string | null = null;
  /** The held item drawn in the farmer's hands during `place` (art round 5), per pose frame. */
  private held: Phaser.GameObjects.Image | null = null;
  private heldSeq: { at: number; xy: [number, number] | null }[] = [];
  /** The farmer dips 1 px on a strike without a drawn strike frame (until this time). */
  private dipUntil = 0;
  /** A refusal's shake, added to the drawn farmer (syncSprite places him every frame, after the tweens ran). */
  private readonly shakeOff = { x: 0 };
  /** The stick is held back until this many ms after a use (shorter than the use's lock). */
  private moveLock = 0;
  /** A push held while rooted walks the moment the root ends, without a second turn-in-place wait. */
  private rootedPush = false;
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
  /** The kind of step the current hold started with (it repeats only that). */
  private holdKind: string | null = null;
  /** What the marker and Action icon showed last frame (debug log: did the act match?). */
  private lastMark: { slot: number | null; plan: string | null; tx: number; ty: number } | null =
    null;
  /** A tap's walk in progress, and what to do on arrival (runtime only). */
  private route: Route | null = null;
  private routeEnd: { intent: TapIntent; face: Direction | null } | null = null;
  /** A tap preview is showing (touch held still on the world). */
  private preview = false;
  /** The line being painted from Action (finger down), and the painted line being worked (runtime only). */
  private painting: TileCoord[] | null = null;
  private paintDir: Direction | null = null;
  private work: WorkQueue | null = null;
  /** Turn-in-place and settle-on-release state (runtime only). */
  private move: MoveState = createMoveState();
  /** The pixel-locked camera follow (fx/PixelCamera.ts). */
  private pcam!: PixelCamera;
  /** Where the farmer's frames come from (newer atlas frames when drawn, today's otherwise). */
  private frames!: PlayerFrames;
  /** Px walked into the current walk cycle (the cycle runs by distance, so feet never slide). */
  private walkDist = 0;
  private walkIdx = -1;
  /** Real ms standing still (idle breathing starts after a while). */
  private stillMs = 0;
  private lastPos = { x: 0, y: 0 };
  /** When the current tool use's impact lands (scene ms): field changes show then. */
  private impactAt = 0;
  private farmDirty = false;
  /** Built this frame (the first update is skipped). */
  private fresh = false;
  /** The creek's first-morning reveal, waiting for the creek to come into view. */
  creekReveal: GreenReveal | null = null;
  /** A site's work-day beat is playing (the world waits for it). */
  private siteBeat = false;
  /** The first green's straw-to-green dissolve while it plays (fx/GreenReveal.ts). */
  reveal: GreenReveal | null = null;
  private lastTile = { tx: -1, ty: -1 };
  private lastTarget: string | null | undefined;
  private cleanup: (() => void)[] = [];
  /**
   * A verb that reads taps and Action its own way (the towing spike, src/dev/towSpike.ts): a tap at a world point
   * or an Action press it took returns true, and the usual handling is skipped.
   */
  protected tapHook: ((wx: number, wy: number) => boolean) | null = null;
  /** Where the last world touch landed and the camera's scroll then (a tap is read on the world as it was). */
  private touchCam: { x: number; y: number; sx: number; sy: number } | null = null;
  protected actionHook: (() => boolean) | null = null;
  /** Called when a walk started with `walkTo` arrives. */
  private walkDone: (() => void) | null = null;

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
    this.pose = null; // the scene object is reused across visits; its old images are gone
    this.held = null; // the item shown in hand went with them (setTexture on it threw and froze the game)
    this.heldSeq = [];
    this.poseSeq = [];
    this.poseUntil = 0;
    this.dipUntil = 0;
    this.shakeOff.x = 0;
    this.moveLock = 0;
    this.rootedPush = false;
    this.inputLocked = true;
    this.actionLock = 0;
    this.heldFailed = false;
    this.lastTarget = undefined;
    this.move = createMoveState();
    this.route = null;
    this.routeEnd = null;
    this.preview = false;
    this.work = null;
    this.painting = null;
    this.water = null;
    this.tweens.timeScale = 1; // a hit-stop cut short by leaving the map never carries over
    this.impactAt = 0;
    this.farmDirty = false;
    this.fresh = true;
    this.lastTile = { tx: -1, ty: -1 };

    // the file of the map's current stage (systems/valley.ts): chosen here, at the build, never at a door
    const raw = this.cache.tilemap.get(activeMapKey(this.mapId)).data as TiledMapLike;
    this.raw = raw;
    this.objects = parseMapObjects(raw);
    this.rebuildGrid();
    // A saved position can be damaged (out of the map, inside a wall): step out to the nearest open tile. A tile
    // that is solid in this stage of the map (a scenario standing in the creek bed once it runs) sends the player
    // to the nearest door spawn instead (WORLD-PLAN 4.2.4).
    {
      const here = playerTile(state.player);
      if (isTileBlocked(this.grid, here.tx, here.ty)) {
        const free = inDelta(this.mapId, here.tx, here.ty)
          ? nearestDoorSpawn(this.grid, this.doorSpawns(), here.tx, here.ty)
          : nearestFreeTile(this.grid, here.tx, here.ty);
        const pos = spawnPosition(free.tx, free.ty);
        state.player.x = pos.x;
        state.player.y = pos.y;
      }
    }

    const map = takeTilemap(this, this.mapId); // parsed ahead when the door was stepped on (mapCache.ts)
    const outdoor = !!mapsData.maps[this.mapId]?.outdoor;
    // The dry palette's tileset is made at the title or the sleep fade; making it here is only a safety net.
    const palette = paletteOf(state, this.mapId);
    if (outdoor && palette === 'dry' && !this.textures.exists(dryTilesetKey(state.time.season))) {
      // a slow frame here: the title or the sleep fade should have made it (the e2e fails on this warning)
      if ((window as unknown as { __farm?: unknown }).__farm) console.warn(DRY_SAFETY_NET);
      ensureDryTileset(this, state.time.season);
    }
    const look = tilesetFor(this.textures, state.time.season, outdoor, palette);
    const tileset = map.addTilesetImage('placeholder', look.key, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Tileset "placeholder" missing from map');
    // The tileset image can be taller than the .tmj says (the channel tiles sit at its end, painted at runtime):
    // setImage recounted the tiles, so index the new gids too, or putTileAt cannot place them.
    for (let t = map.tiles.length, n = tileset.firstgid + tileset.total; t < n; t++) {
      const i = t - tileset.firstgid;
      map.tiles[t] = [
        (i % tileset.columns) * TILE_SIZE,
        Math.floor(i / tileset.columns) * TILE_SIZE,
        0,
      ];
    }
    const layer = map.createLayer('ground', tileset);
    if (!layer) throw new Error('Map has no "ground" layer');
    this.ground = layer.setDepth(0);
    this.tilemap = map;
    this.channelUnder = new Map();
    this.channelShadeUnder = new Map();
    this.channelMouths = new Map();
    this.channelLook = new Map();
    publishGlow(
      this.mapId,
      outdoor,
      parseLights(raw as unknown as Parameters<typeof parseLights>[0]),
      this.cameras.main,
    );
    this.mapArt = new MapArt(map, tileset, look.tinted ? SEASON_TINT[state.time.season] : 0xffffff);
    // Ilse's gate stands shut in the map art; once its stat holds it is drawn open (it changes only overnight)
    for (const o of this.objects) {
      const open = o.props['gateOpen'];
      if (o.type === 'door' && typeof open === 'number' && !doorLocked(state, o))
        this.mapArt.setTile('props', o.tx, o.ty, open);
    }

    if (look.tinted && SEASON_TINT[state.time.season] !== 0xffffff) {
      this.add
        .rectangle(0, 0, map.widthInPixels, map.heightInPixels, SEASON_TINT[state.time.season])
        .setOrigin(0)
        .setDepth(0.2)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
    }

    this.fx = new Effects(this);
    // Once a session, run the effects a first tool use needs, off screen, a moment after the map is up: their
    // first run is several times slower (feel critic: the first Action at 6x spent 67 ms in one frame).
    if (!fxWarmed) {
      fxWarmed = true;
      this.time.delayedCall(1200, () => {
        const off = -400;
        this.fx.dust(off, off);
        this.fx.sparkle(off, off, 0xffffff);
        this.fx.floatText(off, off, '+1');
        this.fx.itemPop(off, off, 'ui_coin', { x: off, y: off });
        this.fx.swing(off, off, 'ui_coin', 'down');
      });
    }
    this.ambient = new Ambient(
      this,
      this.mapId,
      outdoor,
      parseBlooms(raw as unknown as Parameters<typeof parseBlooms>[0]),
    );
    if (this.mapId === 'farm') {
      this.farm = new FarmRenderer(this, (tx, ty, look) => this.paintChannel(tx, ty, look));
      this.farm.sync(state, false);
      const detail = !!map.getLayer('detail');
      this.channels = new ChannelFx(
        this,
        this.farm,
        {
          texture: detail ? look.key : null,
          src: (tx, ty, l) =>
            detail && tileKind(this.ground.getTileAt(tx, ty)?.index ?? 0) !== 'path' // a culvert shows nothing
              ? (tileset.getTileTextureCoordinates(
                  this.channelGid(tx, ty, l) ?? CHANNEL_GID[l],
                ) as {
                  x: number;
                  y: number;
                } | null)
              : null,
        },
        () => getState().settings.reduceMotion,
      );
    }
    // The first green (systems/valley.ts): the first time the farmer stands on the green farm, the straw gives way
    // to green outward from them (the dry tileset is held for this one morning), with its banner and jingle.
    if (this.mapId === 'farm' && takeFirstGreenMoment(state)) {
      const dry = dryTilesetKey(state.time.season);
      if (this.textures.exists(dry)) {
        this.reveal = new GreenReveal(
          this,
          activeMapKey(this.mapId),
          dry,
          { x: state.player.x, y: state.player.y - 8 },
          state.settings.reduceMotion,
        );
        runtime.valleyReveal = !this.reveal.done;
      }
      this.time.delayedCall(WIPE_OPEN_MS, () => {
        this.reveal?.start();
        gameEvents.emit('valleyMoment', { text: valley.farmGreen.banner });
      });
    } else if (this.mapId === 'town' && riverMomentDue(state)) {
      // The river's first morning: the dry town (its straw and its mud) drawn over the river town, cut away around
      // the farmer as they come in (the dry tileset is held for it until the next sleep), with its banner. Once.
      takeRiverMoment(state);
      const dry = dryTilesetKey(state.time.season);
      const before = lookCacheKey(
        valleyStage({ stats: { ...state.stats, 'place.weir': 2 } }, 'town'),
      );
      if (this.textures.exists(dry) && this.cache.tilemap.exists(before)) {
        this.reveal = new GreenReveal(
          this,
          before,
          dry,
          { x: state.player.x, y: state.player.y - 8 },
          state.settings.reduceMotion,
          RIVER_REVEAL_MS,
        );
        runtime.valleyReveal = !this.reveal.done;
      }
      this.time.delayedCall(WIPE_OPEN_MS, () => {
        this.reveal?.start();
        audio.play('water');
        gameEvents.emit('valleyMoment', { text: riverBanner() });
      });
    } else if (this.mapId === 'farm' && !creekMomentDue(state)) {
      // the morning's water runs down the channels the first time they come into view today
      this.channels?.planMorning(state);
    } else if (this.mapId === 'farm' && creekMomentDue(state)) {
      // The creek's first morning: the dry bed drawn over the running one and cut away from Ilse's gate down, once
      // the creek comes into view (update starts it; until then the overlay is hidden and costs nothing).
      const before = lookCacheKey(
        valleyStage({ stats: { ...state.stats, 'place.spring': 2 } }, 'farm'),
      );
      if (this.cache.tilemap.exists(before))
        this.creekReveal = new GreenReveal(
          this,
          before,
          look.key,
          { x: 29 * TILE_SIZE, y: 3 * TILE_SIZE },
          state.settings.reduceMotion,
          CREEK_REVEAL_MS,
          true,
        );
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
    this.frames = new PlayerFrames(this);
    this.walkIdx = -1;
    this.stillMs = 0;
    this.lastPos = { x: state.player.x, y: state.player.y };
    this.syncSprite(false);

    this.setupCamera(map.widthInPixels, map.heightInPixels);
    // Through a door: the wipe that closed over the last map opens a couple of frames after this one has drawn.
    const wipe = this.wipe();
    if (wipe?.covered) {
      wipe.open(WIPE_OPEN_MS, state.settings.reduceMotion);
      // The door just come through closes behind the farmer as the view clears.
      const here = playerTile(state.player);
      const came = this.objects.find(
        (o) =>
          o.type === 'door' &&
          Math.abs(o.tx - here.tx) + Math.abs(o.ty - here.ty) === 1 &&
          doorStyle(this.mapId, doorTarget(o).map),
      );
      const style = came ? doorStyle(this.mapId, doorTarget(came).map) : null;
      if (came && style)
        new DoorFx(this, came.tx, came.ty, this.frames.door()).closeAfter(WIPE_OPEN_MS / 2);
    }

    this.cleanup.push(
      inputHub.on('interact', () => this.onInteract()),
      inputHub.on('touchDown', (p) => {
        const cam = this.cameras.main;
        this.touchCam = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
      }),
      inputHub.on('tap', (p) => this.onTap(p.x, p.y)),
      inputHub.on('tapPreview', (p) => this.onTapPreview(p.x, p.y)),
      inputHub.on('tapCancel', () => this.onTapCancel()),
      inputHub.on('paintLine', (p) => this.onPaintLine(p.dir, p.tiles, p.path)),
      inputHub.on('paintEnd', (p) => this.onPaintEnd(p.commit)),
      // Drawn on the next frame, or on a tool's strike frame: the tilled soil appears with its dust.
      gameEvents.on('farmChanged', () => (this.farmDirty = true)),
      // art round 5: the reel plays once the fishing sheet has closed (the world is frozen while it is open)
      gameEvents.on('fishCaught', () => (this.pendingAct = 'reel')),
      gameEvents.on('mailChanged', () => this.things?.syncMailbox(getState())),
      // Flourishes: a heart gained and a level reached are celebrated where the player stands.
      gameEvents.on('heartUp', () => {
        const p = getState().player;
        this.fx.hearts(p.x, p.y - 14);
      }),
      gameEvents.on('levelUp', () => {
        const p = getState().player;
        this.fx.celebrate(p.x, p.y - 10);
        this.nudgeCamera(0, 1, 2); // a big moment: the view dips 2 px and springs back
      }),
      gameEvents.on('goalCompleted', () => this.nudgeCamera(0, 1, 2)),
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
      this.channels?.destroy();
      this.channels = null;
      this.farm?.destroy();
      this.farm = null;
      this.things?.destroy();
      this.things = null;
      this.npcs?.destroy();
      this.npcs = null;
      this.game.events.emit(EVT_INTERACT_TARGET, null);
      publishGlow(this.mapId, false, [], null);
      this.ambient?.destroy();
      this.ambient = null;
      this.seeThrough?.destroy();
      this.seeThrough = null;
      this.reveal?.destroy();
      this.reveal = null;
      this.creekReveal?.destroy();
      this.creekReveal = null;
      runtime.valleyReveal = false;
      this.endSiteBeat();
    });
  }

  update(time: number, delta: number): void {
    runtime.paintWork = this.work !== null; // a painted row digs on, never fills (mechanics/channels.ts)
    // The creek's first morning starts once the creek bed (x 26-27) is wholly in view, a tile in from the edge: it
    // started as the view's edge passed x 25, with the bed still off screen (the same sliver as feel critic C1-1).
    if (
      this.creekReveal &&
      !this.reveal &&
      this.cameras.main.worldView.right >= 28 * TILE_SIZE + TILE_SIZE
    ) {
      takeCreekMoment(getState());
      this.reveal = this.creekReveal;
      this.creekReveal = null;
      this.reveal.start();
      runtime.valleyReveal = true;
      audio.play('water');
      gameEvents.emit('valleyMoment', { text: creekBanner() });
    }
    if (this.reveal) {
      this.reveal.update(delta);
      if (this.reveal.done) {
        this.reveal = null;
        runtime.valleyReveal = false;
      }
    }
    this.channels?.update(delta, this.clearView());
    if (this.farmDirty && this.time.now >= this.impactAt) {
      this.farmDirty = false;
      this.farm?.sync(getState(), true);
    }
    // The frame a map is built on has done enough: its first update waits a frame (the wipe still covers it).
    if (this.fresh) {
      this.fresh = false;
      return;
    }
    const p = getState().player;
    const x0 = p.x;
    const y0 = p.y;
    this.tick(time, delta);
    // While a finger rests on the screen and the farmer stood still this frame, the camera does not finish
    // centring: a tap is read through the camera at its lift, so it must not drift under the finger (feel critic,
    // review 1). "Still" is measured across this frame's tick. (Round 5 blocker: it was measured against the
    // position syncSprite had just stored, which always matched, so a held stick drag froze the camera.)
    const touching = this.input.manager.pointers.some((ptr) => ptr.isDown);
    this.pcam.hold = shouldHoldCamera(touching, x0, y0, p.x, p.y);
    this.pcam.update(p.x, p.y, delta, time);
  }

  private tick(time: number, delta: number): void {
    this.ambient?.update(time, getState());
    this.things?.syncLandmarkLevels(getState());
    if (this.transitioning) return;
    const state = getState();
    const player = state.player;

    if (runtime.blocked) {
      // Panels and flows freeze the world and the clock.
      this.walkIdx = -1;
      showFrame(this.sprite, this.frames.idle(player.facing, 0));
      this.actionLock = Math.max(0, this.actionLock - delta);
      this.updateHighlight(time);
      return;
    }

    if (this.pendingAct) {
      const anim = this.pendingAct;
      this.pendingAct = null;
      this.playAct(anim);
    }

    if (tickTime(state, Math.min(delta, MAX_CLOCK_DT_MS)).passOut) {
      runtime.busy = true;
      gameEvents.emit('sleepRequest', { passedOut: true });
      return;
    }

    this.actionLock = Math.max(0, this.actionLock - delta);
    this.moveLock = Math.max(0, this.moveLock - delta);
    let dir = inputHub.direction;
    if (this.inputLocked) {
      if (dir === null) this.inputLocked = false;
      dir = null;
    }
    if (this.moveLock > 0) {
      // A swing roots you for a moment; a push held through it walks as soon as it ends.
      this.rootedPush = dir !== null;
      dir = null;
    } else if (this.rootedPush) {
      this.rootedPush = false;
      if (dir !== null) {
        this.move.turnDir = dir;
        this.move.turnMs = TURN_HOLD_MS;
        player.facing = dir;
      }
    }

    // A tap's walk runs until the stick or a key takes over (they always win, at once).
    let moving: boolean;
    if (!this.route && this.work && dir === null && this.actionLock <= 0) this.startNextWork();
    if (this.route && dir === null && this.actionLock <= 0) moving = this.followRoute(delta);
    else {
      if ((this.route || this.work) && dir !== null) {
        this.work = null;
        this.highlight.showPaint(null);
        this.cancelRoute();
      }
      // Two-speed stick (Options): a gentle push walks at half speed for fine positioning.
      const slow = state.settings.controls.twoSpeed && inputHub.stickSlow && dir !== null;
      moving = stepMove(
        player,
        this.move,
        dir,
        delta,
        this.grid,
        undefined,
        slow ? PLAYER_SPEED / 2 : PLAYER_SPEED,
      ).moving;
    }
    this.stillMs = moving ? 0 : this.stillMs + delta;
    this.syncSprite(moving, delta);

    const here = playerTile(player);
    // Crops lean as the farmer walks through them.
    if (moving && (here.tx !== this.lastTile.tx || here.ty !== this.lastTile.ty)) {
      const dx = here.tx - this.lastTile.tx || ((here.tx + here.ty) % 2 ? 1 : -1);
      this.farm?.brush(here.tx, here.ty, Math.sign(dx));
    }
    this.lastTile = here;
    const facing = facingTile(player);
    // The see-through hole eases in and out (owner bug: it popped, and cut crowns the farmer only passed beside).
    this.seeThrough ??= new SeeThrough(this);
    const still = !moving && this.stillMs >= HOLE_STILL_MS;
    const holeOpen = this.seeThrough.isOpen;
    const holeMap = this.mapArt?.want(player.x, player.y, facing, still) ?? NO_HOLE;
    const holeObj =
      this.things?.seeThrough(player.x, player.y, facing, this.seeThrough.mask, holeOpen, still) ??
      NO_HOLE;
    if (holeOpen || holeMap.body || holeMap.target || holeObj.body || holeObj.target)
      this.seeThrough.update(
        player.x,
        player.y,
        facing,
        { body: holeMap.body || holeObj.body, target: holeMap.target || holeObj.target },
        delta,
      );
    this.mapArt?.hole(this.seeThrough.mask, this.seeThrough.isOpen);
    const door = objectAt(this.objects, here.tx, here.ty, 'door');
    if (door && !doorLocked(getState(), door)) {
      this.useDoor(door);
      return;
    }

    if (!inputHub.actionHeld) {
      this.heldFailed = false;
      this.holdUses = 0;
      this.holdKind = null;
    } else if (this.actionLock <= 0 && !this.inputLocked && !this.heldFailed) {
      if (this.actionHook?.()) {
        // a verb took the press (one use per press, as a refused Action is)
        this.actionLock = ACTION_LOCK_MS.ok;
        this.heldFailed = true;
      } else this.tryAction();
    }

    this.updateNpcs(state);
    this.updateTarget();
    this.updateHighlight(time);
    this.updateGuide(time, delta);
    this.keepLabelsClear();
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
    // a valley step on the HUD points at its site (or the door toward it), else the goal's own spot
    const step = valleyStep(getState());
    const where = step
      ? placeWhere(step.place)[this.mapId]
      : currentGoal(getState())?.where?.[this.mapId];
    // While the guided start points at something, its own marks do this job.
    // While the guided days run, free play shows the errand's arrow after a breath, not after 14 s.
    const wait =
      tutorialOn(getState()) && !guidedTracksDone(getState()) ? GUIDE_GUIDED_MS : GUIDE_AFTER_MS;
    if (!where || this.idleMs < wait || runtime.coaching) {
      arrow.setVisible(false);
      return;
    }
    const cam = this.cameras.main;
    const wx = where[0] * TILE_SIZE + TILE_SIZE / 2 - cam.scrollX;
    const wy = where[1] * TILE_SIZE + TILE_SIZE / 2 - cam.scrollY;
    const m = 10;
    const cx = Math.max(m, Math.min(WORLD_CLEAR.w - m, wx));
    const cy = Math.max(m, Math.min(WORLD_CLEAR.h - m, wy)); // never under the floating controls
    const onScreen = cx === wx && cy === wy;
    const bob = Math.sin(time / 180) * 2;
    arrow.clear().setVisible(true).setPosition(cx, cy);
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

  /**
   * The world as the guided start's coach sees it (systems/tutorial.ts): the player's tile, what Action would do,
   * the map's objects and villagers, and a tile -> screen mapping for the coach marks. Read-only.
   */
  coachWorld(): CoachScreenWorld | null {
    if (this.transitioning || !this.grid) return null;
    const state = getState();
    const here = playerTile(state.player);
    const cam = this.cameras.main;
    const types = ['bin', 'bed', 'shop', 'board', 'door'];
    const objects: CoachObject[] = this.objects
      .filter((o) => types.includes(o.type))
      .map((o) => ({
        type: o.type,
        tx: o.tx,
        ty: o.ty,
        w: o.tw,
        h: o.th,
        to: o.type === 'door' ? doorTarget(o).map : undefined,
      }));
    if (mail.mailbox.map === this.mapId)
      objects.push({ type: 'mailbox', tx: mail.mailbox.tx, ty: mail.mailbox.ty, w: 1, h: 1 });
    for (const pl of Object.values(valley.places))
      if (pl.map === this.mapId && pl.site)
        objects.push({ type: 'site', tx: pl.site[0], ty: pl.site[1], w: 1, h: 1 });
    // where channels start: the running creek's bank on open ground (the channels intro points here)
    if (this.mapId === 'farm' && creekSource(state).running)
      objects.push({ type: 'creek', tx: CREEK_BANK[0], ty: CREEK_BANK[1], w: 1, h: 1 });
    const npcs: { id: string; tx: number; ty: number }[] = [];
    for (const id of Object.keys(npcData)) {
      const at = npcLocation(id, state.time.minutes, state);
      if (at && at.map === this.mapId) npcs.push({ id, tx: at.tx, ty: at.ty });
    }
    const screen = (tx: number, ty: number) => ({
      x: tx * TILE_SIZE + TILE_SIZE / 2 - cam.scrollX + cam.x,
      y: ty * TILE_SIZE + TILE_SIZE / 2 - cam.scrollY + cam.y,
    });
    return {
      map: this.mapId,
      tile: here,
      facing: state.player.facing,
      action: this.lastMark
        ? { plan: this.lastMark.plan, tx: this.lastMark.tx, ty: this.lastMark.ty }
        : null,
      objects,
      npcs,
      blocked: (tx, ty) => !this.inMap({ tx, ty }) || isTileBlocked(this.grid, tx, ty),
      actKind: (tx, ty) => (this.inMap({ tx, ty }) ? this.actKindAt({ tx, ty }) : null),
      water: this.waterTiles(),
      route: (tx, ty) => this.coachRoute(here, { tx, ty }),
      inView: (tx, ty) => {
        const p = screen(tx, ty);
        // above the floating controls: a tile behind a thumb gets the coach's edge arrow instead
        return (
          p.x >= 0 &&
          p.x < WORLD_CLEAR.w &&
          p.y >= WORLD_CLEAR.y &&
          p.y < WORLD_CLEAR.y + WORLD_CLEAR.h
        );
      },
      screen,
    };
  }

  /** The walk to a tile (or beside it, when it is solid) for the coach's off-screen arrows; cached per tile. */
  private coachRouteCache: { key: string; path: TileCoord[] | null } | null = null;
  private coachRoute(here: TileCoord, to: TileCoord): TileCoord[] | null {
    const key = `${this.mapId}:${here.tx},${here.ty}>${to.tx},${to.ty}`;
    if (this.coachRouteCache?.key === key) return this.coachRouteCache.path;
    const goals = isTileBlocked(this.grid, to.tx, to.ty) ? standTiles(to) : [to];
    const path = findPath(this.grid, here, goals, { avoid: (tx, ty) => this.isDoor(tx, ty) });
    this.coachRouteCache = { key, path };
    return path;
  }

  /** Water tiles a farmer can stand beside (the coach points at the nearest to refill the can). Cached per visit. */
  private water: TileCoord[] | null = null;
  private waterTiles(): TileCoord[] {
    if (this.water) return this.water;
    const out: TileCoord[] = [];
    for (let ty = 0; ty < this.grid.height; ty++)
      for (let tx = 0; tx < this.grid.width; tx++) {
        if (tileKind(this.ground.getTileAt(tx, ty)?.index ?? 0) !== 'water') continue;
        const shore = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(
          ([dx, dy]) =>
            this.inMap({ tx: tx + dx!, ty: ty + dy! }) &&
            !isTileBlocked(this.grid, tx + dx!, ty + dy!),
        );
        if (shore) out.push({ tx, ty });
      }
    this.water = out;
    return out;
  }

  /** The camera's world view above the floating controls (what "in view" means for moments that must be seen). */
  private readonly clearRect = new Phaser.Geom.Rectangle();
  private clearView(): Phaser.Geom.Rectangle {
    const v = this.cameras.main.worldView;
    return this.clearRect.setTo(v.x, v.y, v.width, Math.min(v.height, WORLD_CLEAR.h));
  }

  // ---- setup ----

  private setupCamera(mapW: number, mapH: number): void {
    const cam = this.cameras.main;
    // The world draws from under the HUD to the bottom edge, behind the floating controls; the follow keeps the farmer
    // in the part above them (PixelCamera's inset), exactly where the old dock-bound view had him.
    cam.setViewport(WORLD_VIEW.x, WORLD_VIEW.y, WORLD_VIEW.w, WORLD_VIEW.h);
    // Around a small room, the void is the ink of the outline palette, so the walls read as a framed box.
    cam.setBackgroundColor(mapsData.maps[this.mapId]?.outdoor ? VOID_COLOR : INK_HEX);
    // Maps smaller than the view stay centred in it (PixelCamera.setMap sets the bounds).
    const p = getState().player;
    const bodyOffset = PLAYER_H / 2 - 4; // aim at the body, not the feet
    this.pcam = new PixelCamera(cam, bodyOffset, WORLD_VIEW.h - WORLD_CLEAR.h);
    this.pcam.setMap(mapW, mapH);
    this.pcam.snap(p.x, p.y);
  }

  /** A small push of the view on a big moment (never in Calm mode). */
  nudgeCamera(dx: number, dy: number, px = 2): void {
    if (getState().settings.reduceMotion) return;
    this.pcam?.push(dx, dy, px, this.time.now);
  }

  private syncSprite(moving: boolean, delta = 0): void {
    const p = getState().player;
    const now = this.time.now;
    this.sprite.setPosition(p.x + this.shakeOff.x, p.y + (now < this.dipUntil && !moving ? 1 : 0));
    this.sprite.setDepth(10 + p.y);
    const posing = !!this.pose && now < this.poseUntil && !moving;
    this.sprite.setVisible(!posing);
    if (this.pose) {
      this.pose
        .setVisible(posing)
        .setPosition(p.x, p.y)
        .setDepth(10 + p.y);
      let cur: FrameRef | null = null;
      for (const step of this.poseSeq) if (now >= step.at) cur = step.f;
      if (posing && cur) {
        if (this.pose.texture.key !== cur.texture || this.pose.frame.name !== cur.frame) {
          this.pose.setTexture(cur.texture, cur.frame);
          // Feet sit on row 31 of every tool frame; frames whose blade reaches below the feet are taller (the
          // hoe and pickaxe facing down are 36 px), so the origin comes from the frame's own height.
          const h = this.pose.frame.height;
          // action frames (art round 5) are 44 px with the feet on row 39
          this.pose.setOrigin(0.5, h === ACT_FRAME_H ? ACT_ORIGIN_Y : 32 / h);
        }
        this.pose.setFlipX(cur.flipX);
      }
    }
    if (this.held) {
      let xy: [number, number] | null = null;
      for (const step of this.heldSeq) if (now >= step.at) xy = step.xy;
      const show = posing && xy !== null;
      this.held.setVisible(show);
      if (show && xy)
        this.held
          .setPosition(p.x - 16 + xy[0], p.y - ACT_FEET_ROW - 1 + xy[1])
          .setDepth(10 + p.y + 0.5);
    }
    this.shadow.setPosition(p.x, p.y - 2).setDepth(9 + p.y);
    const moved = Math.abs(p.x - this.lastPos.x) + Math.abs(p.y - this.lastPos.y);
    this.lastPos = { x: p.x, y: p.y };
    if (moving) {
      // The walk cycle runs by distance walked: half speed walks it at half rate, a slow frame skips ahead.
      const n = this.frames.walkCount;
      // The cycle runs at a rate set by the speed actually walked (fx/feel walkFps), so half speed and the settle
      // glide step at their own pace; a first stride shows at once.
      const dt = Math.max(1, delta);
      const fps = walkFps((moved * 1000) / dt, n);
      this.walkDist = this.walkIdx < 0 ? 1 : this.walkDist + (Math.min(dt, 50) * fps) / 1000;
      const i = Math.floor(this.walkDist) % n;
      if (i !== this.walkIdx && isContactFrame(i, n)) this.footstep();
      this.walkIdx = i;
      showFrame(this.sprite, this.frames.walk(p.facing, i));
    } else {
      this.walkIdx = -1;
      const calm = getState().settings.reduceMotion;
      showFrame(this.sprite, this.frames.idle(p.facing, calm ? 0 : breathFrame(this.stillMs)));
    }
  }

  /**
   * The swing for a tool use, with anticipation: returns how long after the press the impact lands (the fx,
   * sound and haptic wait for it) and whether a pose shows the tool (else the tool icon swings).
   *
   * - Drawn swing frames (agents/out/feel/frames-wanted.md): wind-up 50 ms, strike 100 ms, follow-through 110 ms.
   * - The single drawn pose: the hoe pose (raised overhead) is the wind-up, then the strike is the farmer
   *   dipping 1 px; the can and rod poses are already the impact, so they show at once.
   * - No pose: the tool icon swings in three whole steps (fx/Effects.swing), impact on the second.
   *
   * Only the tool's own use poses (a harvest with the hoe in hand shows no hoe).
   */
  private toolSwing(item: string | undefined, kind: string): { delay: number; shown: boolean } {
    const p = getState().player;
    const now = this.time.now;
    const own = !!item && (TOOL_KINDS[item]?.includes(kind) ?? false);
    if (!own) return { delay: 0, shown: false };
    const drawn = this.frames.tool(item, p.facing);
    let delay: number = SWING.windup;
    if (drawn) {
      // Wind-up, swing, contact (the impact lands here), follow-through, then the idle frame.
      let at = now;
      this.poseSeq = drawn.frames.map((f, i) => {
        const step = { f, at };
        at += drawn.ms[i]!;
        return step;
      });
      this.poseUntil = at;
      delay = this.poseSeq[TOOL_CONTACT_FRAME]!.at - now;
    } else {
      const key = item ? TOOL_POSES[item] : undefined;
      const hoe = key === TOOL_POSES['hoe'];
      if (!key || p.facing === 'up' || !hasArt(key) || (hoe && p.facing !== 'down'))
        return { delay: SWING.windup, shown: false };
      this.poseSeq = [
        { f: { texture: key, frame: '__BASE', flipX: p.facing === 'left' }, at: now },
      ];
      if (hoe) {
        this.poseUntil = now + SWING.windup;
        this.dipUntil = now + SWING.windup + 50;
      } else {
        this.poseUntil = now + ACTION_LOCK_MS.ok;
        delay = 0;
      }
    }
    const first = this.poseSeq[0]!.f;
    this.pose ??= this.add.image(0, 0, first.texture, first.frame).setOrigin(0.5, 1);
    this.syncSprite(false);
    return { delay, shown: true };
  }

  /**
   * An action animation (art round 5: harvest, plant, eat, pet, reel, place), shown like a tool swing: returns how
   * long after now its contact frame (index 2) lands, so the action's fx, sound and haptic wait for it, or null when
   * it is not drawn or Calm mode is on (then the farmer simply stands and the fx play at once). Moving cuts it short
   * (posing needs the farmer still), so it never blocks input. `item`: what `place` holds.
   */
  private playAct(anim: string, item?: string): number | null {
    if (getState().settings.reduceMotion) return null;
    const p = getState().player;
    const drawn = this.frames.act(anim, p.facing);
    if (!drawn) return null;
    const now = this.time.now;
    let at = now;
    this.poseSeq = drawn.frames.map((f, i) => {
      const step = { f, at };
      at += drawn.ms[i]!;
      return step;
    });
    this.poseUntil = at;
    const anchors = ACT_ITEM_ANCHORS[anim]?.[p.facing === 'left' ? 'right' : p.facing];
    const icon = item ? items[item]?.icon : undefined;
    if (anchors && icon && this.textures.exists(icon)) {
      this.held ??= this.add.image(0, 0, icon).setOrigin(0.5, 0.5);
      this.held.setTexture(icon);
      this.heldSeq = this.poseSeq.map((step, i) => {
        const a = anchors[i] ?? null;
        return { at: step.at, xy: a && p.facing === 'left' ? [32 - a[0], a[1]] : a };
      });
    } else this.heldSeq = [];
    const first = this.poseSeq[0]!.f;
    this.pose ??= this.add.image(0, 0, first.texture, first.frame).setOrigin(0.5, 1);
    this.syncSprite(false);
    return this.poseSeq[Math.min(ACT_CONTACT_FRAME, this.poseSeq.length - 1)]!.at - now;
  }

  /** Hold the frame for a moment on an impact (a harvest): tweens pause, input does not. */
  private hitStop(): void {
    if (getState().settings.reduceMotion) return;
    this.tweens.timeScale = 0;
    this.time.delayedCall(HIT_STOP_MS, () => (this.tweens.timeScale = 1));
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
      door: !!objectAt(this.objects, t.tx, t.ty, 'door'),
      at: (tx, ty) => (this.inMap({ tx, ty }) ? this.tileInfo({ tx, ty }) : null),
    };
  }

  private inMap(t: TileCoord): boolean {
    return t.tx >= 0 && t.ty >= 0 && t.tx < this.grid.width && t.ty < this.grid.height;
  }

  /** Where other maps' doors drop the player on this map (doors are the same in every stage). */
  private doorSpawns(): TileCoord[] {
    const out: TileCoord[] = [];
    for (const id of Object.keys(mapsData.maps)) {
      const raw = this.cache.tilemap.get(activeMapKey(id))?.data as TiledMapLike | undefined;
      if (!raw) continue;
      for (const o of parseMapObjects(raw))
        if (o.type === 'door' && o.props['targetMap'] === this.mapId) out.push(doorTarget(o));
    }
    return out;
  }

  /**
   * A channel (systems/channels.ts) drawn in the map's detail layer, so it costs no draw call: the ditch autotiled by
   * its neighbours (art/channelTiles.ts), with water where the flow reaches it and a dry bed where it does not, and
   * the old tile back when it is filled in. Under a path it is a culvert (stone headwalls in the shade layer, the
   * path keeps its look); beside the creek a mouth is cut through the creek's bank. Ground decals (flowers, tufts)
   * on the cell are hidden while it is a channel. Purely visual: the ground layer (what the rules read) is
   * untouched. A new or filled channel repaints its painted neighbours, whose masks change. False when the map has
   * no detail layer (placeholder tiles).
   */
  private paintChannel(tx: number, ty: number, look: 'wet' | 'dry' | null): boolean {
    const detail = this.tilemap?.getLayer('detail')?.tilemapLayer;
    const path = tileKind(this.ground.getTileAt(tx, ty)?.index ?? 0) === 'path';
    if (!detail && !path) return false;
    const key = `${tx},${ty}`;
    if (look === null) this.channelLook.delete(key);
    else this.channelLook.set(key, look);
    this.drawChannelCell(tx, ty);
    for (const s of CHANNEL_SIDES)
      if (this.channelLook.has(`${tx + s.dx},${ty + s.dy}`))
        this.drawChannelCell(tx + s.dx, ty + s.dy);
    return true;
  }

  /** The channel tile a cell shows for a look, as a gid (for fx that copy it), or null on a path or without art. */
  channelGid(tx: number, ty: number, look: 'wet' | 'dry'): number | null {
    if (tileKind(this.ground.getTileAt(tx, ty)?.index ?? 0) === 'path') return null;
    const state = getState();
    const creek = creekSource(state);
    const mask = channelMask(tx, ty, (x, y) => !!state.farm.tiles[`${x},${y}`]?.channel, creek.at);
    const index = this.cache.json.get(TILE_INDEX_KEY) as TileIndex | undefined;
    return tileGid(index, channelTileName(look, mask)) ?? CHANNEL_GID[look];
  }

  /** Draw (or undraw) one cell from `channelLook` and the state's channels. */
  private drawChannelCell(tx: number, ty: number): void {
    const key = `${tx},${ty}`;
    const look = this.channelLook.get(key);
    const detail = this.tilemap?.getLayer('detail')?.tilemapLayer;
    const shade = this.tilemap?.getLayer('shade')?.tilemapLayer;
    const index = this.cache.json.get(TILE_INDEX_KEY) as TileIndex | undefined;
    const state = getState();
    const isChannel = (x: number, y: number) => !!state.farm.tiles[`${x},${y}`]?.channel;
    const creek = creekSource(state);
    const path = tileKind(this.ground.getTileAt(tx, ty)?.index ?? 0) === 'path';
    const keep = (layer: Phaser.Tilemaps.TilemapLayer, store: Map<string, number>) => {
      if (!store.has(key)) store.set(key, layer.getTileAt(tx, ty)?.index ?? -1);
    };
    const restore = (
      layer: Phaser.Tilemaps.TilemapLayer | undefined,
      store: Map<string, number>,
    ) => {
      const under = store.get(key);
      store.delete(key);
      if (!layer || under === undefined) return;
      if (under > 0) layer.putTileAt(under, tx, ty);
      else layer.removeTileAt(tx, ty);
    };
    // mouths this cell cut into the creek: cleared, then redrawn below if it is still a channel
    for (const s of CHANNEL_SIDES) {
      const ck = `${tx + s.dx},${ty + s.dy}`;
      if (this.channelMouths.get(ck) === key) {
        this.channelMouths.delete(ck);
        const under = this.channelShadeUnder.get(ck);
        this.channelShadeUnder.delete(ck);
        if (shade && under !== undefined) {
          if (under > 0) shade.putTileAt(under, tx + s.dx, ty + s.dy);
          else shade.removeTileAt(tx + s.dx, ty + s.dy);
        }
      }
    }
    if (!look) {
      restore(detail, this.channelUnder);
      restore(shade, this.channelShadeUnder);
      return;
    }
    if (path) {
      // a culvert: the path keeps its look; headwalls where an open channel meets it (none between two culverts)
      const open = (x: number, y: number) =>
        isChannel(x, y) && tileKind(this.ground.getTileAt(x, y)?.index ?? 0) !== 'path';
      const gid = tileGid(index, culvertTileName(tx, ty, open) ?? '');
      if (shade && gid) {
        keep(shade, this.channelShadeUnder);
        shade.putTileAt(gid, tx, ty);
      } else restore(shade, this.channelShadeUnder);
      return;
    }
    if (!detail) return;
    keep(detail, this.channelUnder);
    detail.putTileAt(this.channelGid(tx, ty, look) ?? CHANNEL_GID[look], tx, ty);
    // flowers and tufts on the cell go while it is a channel (the critic's ruling, review 20); crowns stay
    if (shade) {
      const names = (this.channelSlotNames ??= namesBySlot(index));
      const here = shade.getTileAt(tx, ty)?.index ?? -1;
      if (here > 0 && isGroundDecal(names.get(here))) {
        keep(shade, this.channelShadeUnder);
        shade.removeTileAt(tx, ty);
      }
      // the mouth: cut through the creek's bank where the channel opens into it (only on a free shade cell)
      for (const s of CHANNEL_SIDES) {
        const cx = tx + s.dx;
        const cy = ty + s.dy;
        const ck = `${cx},${cy}`;
        if (!creek.at(cx, cy) || this.channelMouths.has(ck)) continue;
        const gid = tileGid(index, mouthTileName(OPPOSITE[s.side]));
        if (!gid || (shade.getTileAt(cx, cy)?.index ?? -1) > 0) continue;
        this.channelShadeUnder.set(ck, -1);
        this.channelMouths.set(ck, key);
        shade.putTileAt(gid, cx, cy);
      }
    }
  }

  /** Placed objects block movement when solid, so the collision grid is the map plus those. */
  private rebuildGrid(): void {
    this.grid = buildCollisionGrid(this.raw);
    // a door that is still shut (Ilse's gate) blocks; Interact reads its text
    for (const o of this.objects)
      if (doorLocked(getState(), o) && this.inMap(o))
        this.grid.blocked[o.ty * this.grid.width + o.tx] = 1;
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
    const shut = objectAt(this.objects, t.tx, t.ty, 'door');
    if (shut && doorLocked(getState(), shut)) return 'locked';
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

  /**
   * The tile Action would act on right now and with which hotbar slot (auto tool may pick another item than
   * the one in hand), else the tile faced.
   */
  private actionTile(): { tile: TileCoord; plan: string | null; slot: number | null } {
    const state = getState();
    const cands = this.candidates();
    const best = chooseAction(
      state,
      cands.map((t) => this.tileInfo(t)),
    );
    if (best)
      return {
        tile: { tx: best.tile.tx, ty: best.tile.ty },
        plan: best.plan.kind,
        slot: best.slot,
      };
    return { tile: facingTile(state.player), plan: null, slot: null };
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
    inputHub.actionSlot = act.slot;
    this.lastMark = { slot: act.slot, plan: act.plan, tx: act.tile.tx, ty: act.tile.ty };
    const kind: MarkerKind = markerKind({
      planKind: act.plan,
      interactable: !act.plan && interact !== null,
    });
    this.highlight.update(this.inMap(t) ? t : null, kind, time);
  }

  // ---- actions ----

  private tryAction(only?: TileCoord, quietHaptic = false): void {
    const state = getState();
    const tiles = only ? [only] : this.candidates();
    if (tiles.length === 0) return;
    // A held Action repeats only the kind of step it started with, and simply stops (no buzz) when there
    // is no more of it in reach: a hold that starts by tilling only tills.
    const repeating = !only && inputHub.actionHeld && this.holdUses > 0 && this.holdKind !== null;
    // Facing a shut door (Ilse's gate) with nothing to do: its own line, not the tool's refusal
    const front = only ?? facingTile(state.player);
    const shut = !repeating ? objectAt(this.objects, front.tx, front.ty, 'door') : undefined;
    const shutText = shut ? doorLocked(state, shut) : null;
    if (
      shutText &&
      !chooseAction(
        state,
        tiles.map((t) => this.tileInfo(t)),
      )
    ) {
      toast(shutText, 'info');
      this.actionLock = ACTION_LOCK_MS.fail;
      this.heldFailed = true;
      return;
    }
    // what the farmer holds before the action (placing the last one empties the slot): `place` shows it in his hands
    const heldBefore = state.inventory.slots[state.inventory.selected]?.item;
    this.channels?.beforeAct(state, heldBefore);
    const res = actOn(
      state,
      tiles.map((t) => this.tileInfo(t)),
      repeating ? { kind: this.holdKind!, quiet: true } : {},
    );
    if (!res.ok && repeating) {
      this.heldFailed = true;
      return;
    }
    const stack = state.inventory.slots[res.slot] ?? null;
    if (!only && this.lastMark)
      controlsLog.push({
        kind: 'act',
        t: this.time.now,
        ok: res.ok,
        marked: this.lastMark,
        used: {
          slot: res.slot,
          plan: res.ok ? res.kind : null,
          tx: res.tile.tx,
          ty: res.tile.ty,
        },
      });
    this.highlight.pulse();
    if (res.ok) {
      // the cut's new tiles the water reaches are held dry until it runs into them on the impact
      const fresh = res.kind === 'dig' ? (this.channels?.afterDig(state) ?? []) : [];
      // the row's toast counts every tile that became channel, the bank tile too (feel critic N1)
      if (this.work && res.kind === 'dig')
        this.work.dug = (this.work.dug ?? 0) + Math.max(1, this.channels?.lastDug ?? 1);
      this.actionLock = ACTION_LOCK_MS.ok;
      this.moveLock = MOVE_ROOT_MS;
      this.heldFailed = false;
      const swing = this.toolSwing(stack?.item, res.kind);
      if (!swing.shown && ACT_FOR_KIND[res.kind]) {
        // art round 5: plant, harvest, forage, eat and place play the farmer's own action; the fx land on contact
        const d = this.playAct(ACT_FOR_KIND[res.kind]!, heldBefore);
        if (d !== null) {
          swing.delay = d;
          swing.shown = true;
        }
      }
      const at = { ...getState().player };
      const def = stack?.item ? items[stack.item] : undefined;
      if (!swing.shown && def?.type === 'tool' && TOOL_KINDS[stack!.item]?.includes(res.kind))
        this.fx.swing(at.x, at.y, def.icon, at.facing);
      // Ilse's spade (a key item, so no tool pose): its icon swings, and the cut lands after the wind-up
      if (!swing.shown && def && (res.kind === 'dig' || res.kind === 'fill')) {
        this.fx.swing(at.x, at.y, def.icon, at.facing);
        swing.delay = SWING.windup;
      }
      const repeat = inputHub.actionHeld && this.holdUses > 0;
      // Hit-stop only on a single harvest or the first of a hold or a painted row: a freeze per tile is a stutter.
      const firstUse = !repeat && (!this.work || (this.work.done <= 1 && this.work.tileUses === 0));
      // The impact: particles, sound and the haptic all land on the strike frame together.
      const impact = () => {
        if (!this.sys.isActive()) return;
        // a dig's water is ChannelFx's (it runs into the cut from upstream), not a splash on the spot
        playActionFx(
          this.fx,
          res.kind === 'dig' && this.channels ? { ...res, wet: false } : res,
          at,
          stack?.item,
          true,
        );
        if (res.kind === 'dig') this.channels?.dig(res.tx, res.ty, at.facing, fresh);
        // Light tick per tile worked (a held press repeats it at most every 450 ms); a ripe harvest is medium.
        if (res.kind === 'dig') haptic('tick');
        // a cut is felt tile by tile, even along a painted row (the 120 ms tick gap spaces them)
        else if (quietHaptic) {
          /* a painted row: no buzz per use */
        } else if (res.kind === 'harvest') haptic('medium');
        else haptic('tick', { repeat });
        if (res.kind === 'harvest' && firstUse) this.hitStop();
      };
      this.impactAt = this.time.now + swing.delay;
      if (swing.delay > 0) this.time.delayedCall(swing.delay, impact);
      else impact();
      if (inputHub.actionHeld) {
        if (this.holdUses === 0) this.holdKind = res.kind;
        this.holdUses++;
      }
      // First-run tip: after a few tiles tilled one at a time with Action, teach painting a row (once).
      if (
        !only &&
        res.kind === 'till' &&
        state.settings.controls.paint &&
        !state.stats['tip.paint'] &&
        !tipsHeldNow(state)
      ) {
        state.stats['tip.tills'] = (state.stats['tip.tills'] ?? 0) + 1;
        if (state.stats['tip.tills'] >= 3) {
          state.stats['tip.paint'] = 1;
          toast(TIPS.paint, 'info');
        }
      }
    } else {
      this.actionLock = ACTION_LOCK_MS.fail;
      this.moveLock = MOVE_ROOT_MS;
      this.heldFailed = true;
      audio.play('error');
      haptic('error');
      this.fx.shake(this.shakeOff);
    }
  }

  /**
   * A broken place's site (systems/valley.ts): one tap a day. Before it is asked for it reads its sign; asked, it
   * opens the fund; funded, the tap is the work day itself (a ten-second taste of the place's verb); on the opening
   * morning the villager's lines; then the site's upgrade.
   */
  private useSite(id: string, tile: TileCoord): void {
    const state = getState();
    const res = interactSite(state, id);
    if (res.kind === 'say') return void toast(res.text, 'info');
    if (res.kind === 'fund' || res.kind === 'upgrade')
      return void gameEvents.emit('openProject', { id: res.project });
    // the opening morning: the villager's lines in the villager sheet, one a tap (their opening scene)
    if (res.kind === 'lines') return void gameEvents.emit('talkTo', { id: res.npc });
    // The work day: a few seconds of the place's verb, played out (critic, valley review 4), still one tap. The
    // farmer swings at the rockfall and a stone rolls off its top; on the spade day a channel is cut from the pool
    // and the water runs into it. The site's new sprite shows when the beat ends.
    gameEvents.emit('energyChanged', undefined);
    const channel = res.work.taste === 'channel';
    const beat = SITE_BEAT_MS[res.work.taste];
    this.things?.hold(`site.${id}`, beat);
    runtime.busy = true;
    this.siteBeat = true;
    const at = { ...state.player };
    const rockX = (tile.tx + 1) * TILE_SIZE; // the rockfall's middle (it covers this tile and the next)
    const rockY = tile.ty * TILE_SIZE;
    const live = () => this.sys.isActive();
    if (res.work.taste === 'beam') {
      this.beamBeat(tile, live);
      this.time.delayedCall(beat, () => {
        this.endSiteBeat();
        if (!live()) return;
        haptic('medium');
        toast(t('valley.workBeat', { text: res.work.text, n: res.day, of: res.of }), 'good');
      });
      return;
    }
    const swings = channel ? [0, 650] : [0, 800, 1600];
    swings.forEach((t, k) =>
      this.time.delayedCall(t, () => {
        if (!live()) return;
        this.fx.swing(at.x, at.y, channel ? 'item_spade' : 'item_pickaxe', at.facing);
        this.time.delayedCall(140, () => {
          if (!live()) return;
          if (channel) this.fx.dust((tile.tx + 0.5) * TILE_SIZE, (tile.ty + 1.5) * TILE_SIZE);
          else this.fx.dust(rockX - 6 + k * 6, rockY + 4 - k * 3);
          audio.play(channel ? 'dig' : 'swing');
          haptic('tick');
        });
      }),
    );
    if (!channel) {
      // a stone comes off the top of the heap and rolls down beside it
      this.time.delayedCall(2200, () => {
        if (!live()) return;
        const stone = this.add.graphics().setDepth(10 + rockY + 20);
        stone.fillStyle(0x241a2a, 1).fillRect(-6, -5, 12, 10);
        stone.fillStyle(0xaeb0b4, 1).fillRect(-5, -4, 10, 8);
        stone.fillStyle(0x8a8694, 1).fillRect(-5, 1, 10, 3);
        stone.setPosition(rockX, rockY - 14); // the top stone of the heap
        this.tweens.add({
          targets: stone,
          x: rockX + 26,
          y: rockY + 22,
          duration: 700,
          ease: 'Bounce.easeOut',
          onComplete: () => {
            audio.play('till');
            this.tweens.add({
              targets: stone,
              alpha: 0,
              delay: 500,
              duration: 300,
              onComplete: () => stone.destroy(),
            });
          },
        });
      });
    } else {
      // the cut: a strip of dug earth from the pool's edge, then the water runs into it from the pool side
      const cx = tile.tx * TILE_SIZE;
      const cy = (tile.ty + 1) * TILE_SIZE;
      const cut = this.add.graphics().setDepth(0.45);
      this.time.delayedCall(1100, () => {
        if (!live()) return;
        cut.fillStyle(0x4c2c1c, 1).fillRect(cx, cy + 4, TILE_SIZE, 8);
        const flow = { w: 0 };
        audio.play('water');
        this.tweens.add({
          targets: flow,
          w: TILE_SIZE,
          duration: 900,
          ease: 'Sine.easeOut',
          onUpdate: () => {
            const w = Math.round(flow.w);
            cut.clear();
            cut.fillStyle(0x4c2c1c, 1).fillRect(cx, cy + 4, TILE_SIZE, 8);
            cut.fillStyle(0x3c74b4, 1).fillRect(cx + TILE_SIZE - w, cy + 5, w, 6);
            cut.fillStyle(0x72aadc, 1).fillRect(cx + TILE_SIZE - w, cy + 5, w, 1);
          },
          onComplete: () => live() && this.fx.splash(cx + 4, cy + 8),
        });
      });
    }
    this.time.delayedCall(beat, () => {
      this.endSiteBeat();
      if (!live()) return;
      haptic('medium');
      toast(t('valley.workBeat', { text: res.work.text, n: res.day, of: res.of }), 'good');
    });
  }

  /**
   * The weir's last work day (scripted until towing, M7): Orin opens the gate a crack, the gorge's water comes through
   * the gap beside the site, and it lifts the last beam up into place. Placeholder shapes until the feel lane's pass.
   */
  private beamBeat(tile: TileCoord, live: () => boolean): void {
    const gapX = (tile.tx + 2) * TILE_SIZE; // the gorge's bank, east of the site's two tiles
    const y = tile.ty * TILE_SIZE;
    const water = this.add.graphics().setDepth(10 + y + 18);
    const flow = { w: 0 };
    this.time.delayedCall(300, () => {
      if (!live()) return;
      audio.play('water');
      haptic('tick');
      this.tweens.add({
        targets: flow,
        w: TILE_SIZE * 1.5,
        duration: 1000,
        ease: 'Sine.easeOut',
        onUpdate: () => {
          const w = Math.round(flow.w);
          water.clear();
          water.fillStyle(0x3c74b4, 1).fillRect(gapX - w, y + 4, w, 10);
          water.fillStyle(0x72aadc, 1).fillRect(gapX - w, y + 4, w, 2);
        },
        onComplete: () => live() && this.fx.splash(gapX - TILE_SIZE, y + 10),
      });
    });
    // the beam floats up on the water and swings into the gap
    const beam = this.add
      .graphics()
      .setDepth(10 + y + 19)
      .setVisible(false);
    beam.fillStyle(0x241a2a, 1).fillRect(-13, -3, 26, 6);
    beam.fillStyle(0x8a6a4a, 1).fillRect(-12, -2, 24, 4);
    beam.fillStyle(0xb08a5a, 1).fillRect(-12, -2, 24, 1);
    beam.setPosition(gapX + 6, y + 22).setAngle(70);
    this.time.delayedCall(1400, () => {
      if (!live()) return;
      beam.setVisible(true);
      this.tweens.add({
        targets: beam,
        x: gapX - TILE_SIZE,
        y: y + 2,
        angle: 0,
        duration: 1100,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (!live()) return;
          audio.play('logLand');
          haptic('medium');
          this.fx.dust(gapX - TILE_SIZE, y + 4);
        },
      });
    });
    this.time.delayedCall(3400, () => {
      this.tweens.add({
        targets: [water, beam],
        alpha: 0,
        duration: 200,
        onComplete: () => {
          water.destroy();
          beam.destroy();
        },
      });
    });
  }

  /** The work day's beat is over (or the scene went): the world moves again. */
  private endSiteBeat(): void {
    if (!this.siteBeat) return;
    this.siteBeat = false;
    runtime.busy = false;
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
    if (hit.type.startsWith('landmark:site.'))
      return void this.useSite(hit.type.slice(14), hit.tile);
    if (hit.type.startsWith('landmark:')) {
      const id = hit.type.slice(9);
      const l = landmarksOn(getState(), this.mapId).find((x) => x.id === id);
      return void (l && toast(l.text, 'good'));
    }
    if (hit.type === 'mailbox') return void gameEvents.emit('openPanel', { type: 'mail' });
    if (hit.type === 'bed') return void gameEvents.emit('openPanel', { type: 'sleep' });
    if (hit.type === 'bin') return void gameEvents.emit('openPanel', { type: 'bin' });
    if (hit.type === 'shop') return void gameEvents.emit('openPanel', { type: 'shop' });
    if (hit.type === 'board') return void gameEvents.emit('openPanel', { type: 'board' });
    if (hit.type === 'locked') {
      const shut = objectAt(this.objects, hit.tile.tx, hit.tile.ty, 'door');
      const text = shut && doorLocked(getState(), shut);
      return void (text && toast(text, 'info'));
    }
    const state = getState();
    const obj = placedAt(state, this.mapId, hit.tile.tx, hit.tile.ty);
    if (!obj) return;
    // Snapshot the bag so goods collected from a coop, jar, hive or tree can pop out of it.
    const before = new Map<string, number>();
    for (const st of state.inventory.slots)
      if (st) before.set(st.item, (before.get(st.item) ?? 0) + st.qty);
    const pettedBefore = speciesOf(obj) ? houseOf(obj).petted : true;
    const res = interactWith(state, obj);
    if (!pettedBefore && houseOf(obj).petted) this.playAct('pet'); // art round 5: the daily pat
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
      if (got === 'busy') toast(t('move.busy'), 'warn');
      else if (got === 'full') toast(t('common.inventoryFull'), 'warn');
    }
    this.things?.sync(state, true);
  }

  // ---- tap to move (M4) ----

  /** Screen (logical) point -> world point, or null outside the world view. */
  private worldPoint(x: number, y: number): { x: number; y: number } | null {
    if (y < WORLD_VIEW.y || y >= WORLD_VIEW.y + WORLD_VIEW.h) return null;
    const cam = this.cameras.main;
    // the touch at this point read the world as the camera stood when it landed (the view may scroll by the lift)
    const at =
      this.touchCam && this.touchCam.x === x && this.touchCam.y === y ? this.touchCam : null;
    return { x: x - cam.x + (at?.sx ?? cam.scrollX), y: y - cam.y + (at?.sy ?? cam.scrollY) };
  }

  /** The world as tap intent sees it. */
  private tapWorld(): TapWorld {
    return {
      tileSize: TILE_SIZE,
      spriteTarget: (x, y) => this.spriteTargetAt(x, y),
      inMap: (t) => this.inMap(t),
      blocked: (t) => isTileBlocked(this.grid, t.tx, t.ty),
      interactable: (t) => this.interactableAt(t),
      actKind: (t) => chooseAction(getState(), [this.tileInfo(t)])?.plan.kind ?? null,
      door: (t) => this.isDoor(t.tx, t.ty),
    };
  }

  /**
   * Every tile of the interactable thing on `t` (a bed or a counter covers several): the connected tiles
   * around it with the same interact type, at most 2 away.
   */
  private footprint(t: TileCoord, type: string): TileCoord[] {
    const out: TileCoord[] = [t];
    const seen = new Set([`${t.tx},${t.ty}`]);
    for (let i = 0; i < out.length; i++) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const n = { tx: out[i]!.tx + dx, ty: out[i]!.ty + dy };
        const k = `${n.tx},${n.ty}`;
        if (seen.has(k) || Math.abs(n.tx - t.tx) > 2 || Math.abs(n.ty - t.ty) > 2) continue;
        seen.add(k);
        if (this.inMap(n) && this.interactableAt(n) === type) out.push(n);
      }
    }
    return out;
  }

  private isDoor = (tx: number, ty: number): boolean => !!objectAt(this.objects, tx, ty, 'door');

  /**
   * The interact target whose drawn sprite covers a world point: villagers and machines are drawn taller than
   * their tile, so a tap on a head opens the right sheet. Only y-sorted sprites (depth >= 9) count; the topmost
   * wins. The farmer's own sprite never does.
   */
  private spriteTargetAt(x: number, y: number): { tile: TileCoord; type: string } | null {
    let best: { tile: TileCoord; type: string; depth: number } | null = null;
    for (const o of this.children.list) {
      if (o === this.sprite || o === this.shadow || (o.type !== 'Image' && o.type !== 'Sprite'))
        continue;
      const g = o as Phaser.GameObjects.Image;
      if (!g.visible || g.depth < 9 || g.depth >= 9000 || (best && g.depth <= best.depth)) continue;
      const b = g.getBounds();
      if (!b.contains(x, y)) continue;
      const tile = {
        tx: Math.floor(b.centerX / TILE_SIZE),
        ty: Math.floor((b.bottom - 1) / TILE_SIZE),
      };
      const type = this.interactableAt(tile);
      if (type) best = { tile, type, depth: g.depth };
    }
    return best ? { tile: best.tile, type: best.type } : null;
  }

  /** Where a tap at (x, y) leads: the intent and the walk to do it, or null path when it cannot. */
  private planTap(
    x: number,
    y: number,
  ): { intent: TapIntent; path: TileCoord[] | null; face: Direction | null } | null {
    if (!this.worldPoint(x, y)) return null; // outside the world view: not a world tap
    const c = compensateTouch(x, y, getState().settings.leftHanded, cssPerLogical(this));
    const w = this.worldPoint(c.x, c.y) ?? this.worldPoint(x, y)!;
    const intent = tapIntent(this.tapWorld(), w.x, w.y);
    if (intent.kind === 'none') return { intent, path: null, face: null };
    const here = playerTile(getState().player);
    const avoid = (tx: number, ty: number) => this.isDoor(tx, ty);
    // Your own tile: nothing to walk to, and stepping off just to work it would surprise.
    if (intent.target.tx === here.tx && intent.target.ty === here.ty)
      return { intent, path: null, face: null };
    // Mid-step, plan from where the farmer really is, so a new tap never walks him back first (owner bug 2).
    const starts = this.routeStarts();
    if (intent.kind === 'walk') {
      const r = replanFrom(
        starts,
        (from) => {
          const path = findPath(this.grid, from, [intent.target], { avoid });
          return path ? { path } : null;
        },
        TILE_SIZE,
      );
      return { intent, path: r?.path ?? null, face: null };
    }
    if (intent.kind === 'interact') {
      // A bed or a counter is reached from whichever side is open (its top half is often against a wall).
      const cells = this.footprint(intent.target, intent.type);
      const r = replanFrom(
        starts,
        (from) => pathToFaceAny(this.grid, from, cells, { avoid }),
        TILE_SIZE,
      );
      if (!r) return { intent, path: null, face: null };
      return { intent: { ...intent, target: r.target }, path: r.path, face: r.face };
    }
    const r = replanFrom(
      starts,
      (from) => pathToFace(this.grid, from, intent.target, { avoid }),
      TILE_SIZE,
    );
    return { intent, path: r?.path ?? null, face: r?.face ?? null };
  }

  private intentMarker(intent: TapIntent): MarkerKind {
    if (intent.kind === 'interact' || (intent.kind === 'walk' && intent.door)) return 'interact';
    if (intent.kind === 'act') return markerKind({ planKind: intent.plan, interactable: false });
    return 'none';
  }

  /** A touch held still on the world: show where a tap would lead before the finger lifts. */
  private onTapPreview(x: number, y: number): void {
    if (this.transitioning || runtime.blocked || !getState().settings.controls.tapToMove) return;
    const plan = this.planTap(x, y);
    if (!plan) return;
    this.preview = true;
    if (plan.path)
      this.highlight.showPlan(plan.path, plan.intent.target, this.intentMarker(plan.intent));
    else this.highlight.showPlan(null, null, 'none');
  }

  private onTapCancel(): void {
    if (!this.preview) return;
    this.preview = false;
    if (!this.route) this.highlight.showPlan(null, null, 'none');
  }

  /**
   * A tap on the world. With tap-to-move: walk there and do the obvious thing (interact, act with the auto
   * tool, or just walk). Without: the old rule, the 4 tiles next to the player only.
   */
  private onTap(x: number, y: number): void {
    this.preview = false;
    if (this.transitioning || runtime.blocked) return;
    const wp = this.tapHook ? this.worldPoint(x, y) : null;
    if (wp && this.tapHook?.(wp.x, wp.y)) return;
    if (!getState().settings.controls.tapToMove) return this.onTapAdjacent(x, y);
    // A new tap replaces a painted row in progress.
    if (this.work) {
      this.work = null;
      this.highlight.showPaint(null);
    }
    const plan = this.planTap(x, y);
    if (!plan) return;
    if (!plan.path && this.onPlayerTile(plan.intent.target) && this.ownTileTap()) return;
    if (!plan.path) {
      // Nothing to do there, or no way to get there: answer anyway, never silently.
      this.cancelRoute();
      this.highlight.ping(plan.intent.target.tx, plan.intent.target.ty);
      audio.play('select');
      if (plan.intent.kind !== 'none' && !this.onPlayerTile(plan.intent.target)) {
        toast(t('ui.cantGetThere'), 'warn');
        haptic('error');
      }
      controlsLog.push({ kind: 'silent', t: this.time.now, detail: plan.intent.kind });
      return;
    }
    this.route = createRoute(plan.path);
    this.routeEnd = { intent: plan.intent, face: plan.face };
    this.highlight.showPlan(plan.path, plan.intent.target, this.intentMarker(plan.intent));
    if (plan.path.length > 1) audio.play('target'); // a walk target set (soft; throttled by the audio engine)
    controlsLog.push({
      kind: 'route',
      t: this.time.now,
      // i18n-ok: a controls-log detail for checks, never shown
      detail: `${plan.intent.kind}@${plan.intent.target.tx},${plan.intent.target.ty} in ${plan.path.length - 1}`,
    });
    // Already there: act now, or, mid-swing, as soon as the swing ends (the route waits for the lock), so a
    // quick second tap is buffered, never dropped. Mid-step, the route first finishes the step to that centre.
    if (plan.path.length === 1 && this.actionLock <= 0 && this.onCentre(plan.path[0]!))
      this.arrive();
  }

  /** Where each world label was put by its owner, and where it was last lifted to (keepLabelsClear). */
  private labelLift = new WeakMap<Label, { base: number; set: number }>();

  /**
   * World text never sits under a floating control plate (the world runs under the controls): a label (a plot
   * sign's price, a site's name, a villager's "!") that would be covered rises just above the plate, and settles
   * back once it is clear. Its owner may move it any frame: a y it did not get from here is its new resting place
   * (a villager's bobbing "!" is moved by its tween every frame, so it is lifted from wherever the tween put it).
   * Rising "+1" lines (`RISING_LABEL`) are left to their own tween.
   */
  private keepLabelsClear(): void {
    const ui = this.scene.get('UI') as unknown as { plates?: () => Plate[] } | null;
    const plates = ui?.plates?.();
    if (!plates) return;
    const cam = this.cameras.main;
    for (const o of this.children.list) {
      if (!(o instanceof Label) || !o.visible || o.name === RISING_LABEL) continue;
      let lift = this.labelLift.get(o);
      if (!lift || o.y !== lift.set) lift = { base: o.y, set: o.y };
      o.y = lift.base;
      const b = o.getBounds();
      const sx = cam.x - cam.scrollX;
      const sy = cam.y - cam.scrollY;
      const dy = liftClear(
        { x0: b.x + sx, y0: b.y + sy, x1: b.right + sx, y1: b.bottom + sy },
        plates,
        WORLD_VIEW.y,
      );
      o.y = lift.base - dy;
      lift.set = o.y;
      this.labelLift.set(o, lift);
    }
  }

  /** Where a walk planned now may start (systems/pathfind routeStarts): mid-step, ahead first. */
  private routeStarts(): RouteStart[] {
    return routeStarts(getState().player, this.move, this.grid, PLAYER_HITBOX, (tx, ty) =>
      this.isDoor(tx, ty),
    );
  }

  /** Is the farmer standing on this tile's centre? */
  private onCentre(t: TileCoord): boolean {
    const p = getState().player;
    const c = spawnPosition(t.tx, t.ty);
    return Math.abs(p.x - c.x) < 0.01 && Math.abs(p.y - c.y) < 0.01;
  }

  /** A tap on your own tile uses what you face (systems/tapIntent ownTileTap); true when it did something. */
  private ownTileTap(): boolean {
    const near = this.interactTile();
    const act = this.actionTile();
    const what = ownTileTap(act.plan, near !== null);
    if (what === 'none') return false;
    this.cancelRoute();
    controlsLog.push({ kind: 'route', t: this.time.now, detail: `own tile: ${what}` }); // i18n-ok
    if (what === 'interact') this.onInteract(near!.tile);
    else if (this.actionLock <= 0) this.tryAction(act.tile);
    return true;
  }

  private onPlayerTile(t: TileCoord): boolean {
    const here = playerTile(getState().player);
    return here.tx === t.tx && here.ty === t.ty;
  }

  /** One frame of a tap's walk. */
  private followRoute(delta: number): boolean {
    const route = this.route!;
    const end = this.routeEnd!;
    const res = stepRoute(getState().player, this.move, route, delta, this.grid);
    if (res === 'blocked') {
      this.cancelRoute();
      this.highlight.ping(end.intent.target.tx, end.intent.target.ty);
      audio.play('error');
      haptic('error');
      return false;
    }
    if (res === 'arrived') {
      this.arrive();
      return false;
    }
    // A finger held still on the world shows where the next tap leads: keep that preview up until it lifts, or the
    // walk's own plan would replace it the next frame (a one-frame flash of dots, owner bug 2).
    if (!this.preview)
      this.highlight.showPlan(
        route.path,
        end.intent.target,
        this.intentMarker(end.intent),
        route.i,
      );
    return true;
  }

  /** At the end of a tap's walk: face the target and do it. */
  private arrive(): void {
    const end = this.routeEnd;
    const done = this.walkDone;
    this.cancelRoute();
    if (!end) return;
    if (done) {
      const player = getState().player;
      if (end.face) faceDirection(player, end.face);
      this.syncSprite(false);
      done();
      return;
    }
    const player = getState().player;
    if (end.face) faceDirection(player, end.face);
    this.syncSprite(false);
    const target = end.intent.target;
    if (end.intent.kind === 'interact') this.onInteract(target);
    else if (end.intent.kind === 'act') {
      // A painted row buzzed once per tile when it was drawn, and once on commit: working it is quiet.
      this.tryAction(target, this.work !== null);
      // A painted tile is worked until it is done for today (till, plant, water: at most 3 uses), so one
      // pass over grass leaves a planted, watered row. Each use waits for the swing like a held Action.
      const w = this.work;
      if (w && w.tileUses < WORK_USES_PER_TILE - 1 && this.actKindAt(target)) {
        w.tileUses++;
        this.route = createRoute([playerTile(player)]);
        this.routeEnd = end;
      } else if (w) w.tileUses = 0;
    }
  }

  /**
   * Walk to a tile by the usual tap walk (the plan shown, the stick takes over at once), then face `face` and call
   * `done`. False when there is no way there.
   */
  protected walkTo(t: TileCoord, face: Direction | null = null, done?: () => void): boolean {
    // mid-step, from where the farmer really is (owner bug 2: a new walk never steps back first)
    const path =
      replanFrom(
        this.routeStarts(),
        (from) => {
          const p =
            from.tx === t.tx && from.ty === t.ty
              ? [from]
              : findPath(this.grid, from, [t], { avoid: (tx, ty) => this.isDoor(tx, ty) });
          return p ? { path: p } : null;
        },
        TILE_SIZE,
      )?.path ?? null;
    if (!path) return false;
    this.work = null;
    this.highlight.showPaint(null);
    this.route = createRoute(path);
    this.routeEnd = { intent: { kind: 'none', target: t }, face };
    this.walkDone = done ?? null;
    this.highlight.showPlan(path, t, 'none');
    if (path.length === 1 && this.actionLock <= 0 && this.onCentre(path[0]!)) this.arrive();
    return true;
  }

  /** A walk is in progress (a tap's, a painted row's or `walkTo`'s). */
  protected get walking(): boolean {
    return this.route !== null;
  }

  /** Where the walk in progress ends, if one is. */
  protected get walkGoal(): TileCoord | null {
    return this.route ? (this.route.path[this.route.path.length - 1] ?? null) : null;
  }

  /** Stop a walk where the farmer stands. */
  protected stopWalk(): void {
    this.cancelRoute();
  }

  /** Can the farmer stand on this tile? */
  protected walkable(tx: number, ty: number): boolean {
    return this.inMap({ tx, ty }) && !isTileBlocked(this.grid, tx, ty);
  }

  /** Action would act on something right now (the marked tile's plan, as last drawn): a verb yields to it. */
  protected get actionInFront(): boolean {
    return this.lastMark?.plan != null;
  }

  /** The farmer's sprite (a verb may lean it for a frame; syncSprite puts it back each frame). */
  protected get farmerSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  private cancelRoute(): void {
    this.walkDone = null;
    this.route = null;
    this.routeEnd = null;
    if (!this.preview) this.highlight.showPlan(null, null, 'none');
  }

  // ---- paint a row from Action (M5, as ruled 2026-10-09) ----

  /** What Action would do on a tile right now (auto tool), if anything. */
  private actKindAt(t: TileCoord): string | null {
    return chooseAction(getState(), [this.tileInfo(t)])?.plan.kind ?? null;
  }

  private paintMarks(tiles: readonly TileCoord[]): { tx: number; ty: number; kind: MarkerKind }[] {
    return tiles.map((t) => ({
      ...t,
      kind: markerKind({ planKind: this.actKindAt(t), interactable: false }),
    }));
  }

  /**
   * Painting from Action (ruling 2026-10-09, corners in round 3): the path runs from the tile next to the farmer,
   * one tile per step of the drag, turning where the drag turned. Shown live; nothing changes until the lift.
   */
  private paintLineTiles(dir: Direction, tiles: number, path?: readonly Direction[]): TileCoord[] {
    const out: TileCoord[] = [];
    for (const t of pathTiles(
      playerTile(getState().player),
      path ?? Array<Direction>(tiles).fill(dir),
    )) {
      if (!this.inMap(t)) break;
      out.push(t);
    }
    return out;
  }

  private onPaintLine(dir: Direction | null, tiles: number, path?: Direction[]): void {
    if (this.transitioning || runtime.blocked) return;
    if (this.work) this.work = null;
    this.cancelRoute();
    if (!dir || tiles === 0) {
      this.painting = [];
      this.highlight.showPaint(null);
      return;
    }
    faceDirection(getState().player, path?.[0] ?? dir);
    this.syncSprite(false);
    this.painting = this.paintLineTiles(dir, tiles, path);
    this.paintDir = dir;
    this.highlight.showPaint(this.paintMarks(this.painting));
  }

  private onPaintEnd(commit: boolean): void {
    const tiles = this.painting;
    this.painting = null;
    if (!commit || !tiles?.length || !this.paintDir) {
      this.highlight.showPaint(null);
      controlsLog.push({ kind: 'paint', t: this.time.now, detail: 'cancel' });
      return;
    }
    controlsLog.push({ kind: 'paint', t: this.time.now, detail: `work ${tiles.length}` }); // i18n-ok
    this.work = createWork(tiles);
    this.highlight.showPaint(this.paintMarks(tiles));
  }

  /** Between tiles of a painted row: walk to the next tile that still has work, or finish. */
  private startNextWork(): void {
    const w = this.work!;
    const state = getState();
    const next = nextWork(
      w,
      (t) => this.actKindAt(t) !== null,
      () => (state.energy <= 0 ? t('energy.tired') : null),
    );
    if ('stop' in next) {
      this.work = null;
      this.highlight.showPaint(null);
      if (next.stop) toast(next.stop, 'warn');
      // a dug row says what it dug, never that tiles "had nothing left to do" (critic, valley review 5)
      else if (w.dug) toast(t('channels.dug', { count: w.dug }), 'good');
      else if (w.skipped > 0) toast(t('farm.skipped', { count: w.skipped }), 'info');
      return;
    }
    this.highlight.showPaint(this.paintMarks(w.tiles), w.i);
    const here = playerTile(state.player);
    const r = pathToFace(this.grid, here, next.tile, { avoid: (tx, ty) => this.isDoor(tx, ty) });
    if (!r) {
      w.skipped++;
      w.i++;
      return;
    }
    const plan = this.actKindAt(next.tile) ?? 'till';
    this.route = createRoute(r.path);
    this.routeEnd = { intent: { kind: 'act', target: next.tile, plan }, face: r.face };
    w.i++;
    w.done++;
  }

  /** Tap-to-move off: tapping a tile next to the player turns toward it and uses Action there. */
  private onTapAdjacent(x: number, y: number): void {
    const w = this.worldPoint(x, y);
    if (!w) return;
    const target = { tx: Math.floor(w.x / TILE_SIZE), ty: Math.floor(w.y / TILE_SIZE) };
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
    if (this.interactableAt(target) && !chooseAction(getState(), [this.tileInfo(target)]))
      this.onInteract(target);
    else this.tryAction(target);
  }

  /** The UI scene's map-change wipe, when the UI is up. */
  private wipe(): Wipe | null {
    const ui = this.scene.get('UI') as unknown as { wipe?: Wipe } | null;
    return ui?.wipe && ui.wipe.busy !== undefined ? ui.wipe : null;
  }

  /**
   * Through a door: a short dither wipe closes over the world view (the HUD and the floating controls stay), the next map is built
   * and the game saved while it is covered, and the new map opens out of it (about 280 ms in all).
   */
  private useDoor(door: WorldObject): void {
    const target = doorTarget(door);
    const def = mapsData.maps[target.map];
    if (!def) throw new Error(`Door ${door.id} targets unknown map "${target.map}"`);
    this.transitioning = true;
    preparseMap(this, target.map);
    audio.play('door');
    const style = doorStyle(this.mapId, target.map);
    if (style && !getState().settings.reduceMotion)
      new DoorFx(this, door.tx, door.ty, this.frames.door()).open();
    this.walkIdx = -1;
    showFrame(this.sprite, this.frames.idle(getState().player.facing, 0));
    const wipe = this.wipe();
    if (wipe && !wipe.busy) {
      // Under the closed wipe, one job per frame: snapshot the save, take this map down, build the next one.
      const ui = this.scene.get('UI');
      const game = this.game;
      return wipe.close(
        WIPE_CLOSE_MS,
        () => {
          teleportPlayer(getState(), target);
          void saveNow(true);
          this.scene.stop();
          ui.time.delayedCall(1, () => game.scene.start(def.scene));
        },
        getState().settings.reduceMotion,
      );
    }
    const cam = this.cameras.main;
    cam.fadeOut(FADE_MS, FADE_COLOR.r, FADE_COLOR.g, FADE_COLOR.b);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      teleportPlayer(getState(), target);
      void saveNow(true);
      this.scene.start(def.scene);
    });
  }
}
