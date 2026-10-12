/**
 * The developer map at runtime: builds its Tiled map from ./lab/lab-map.json (art tiles resolved by name against
 * the live tileset's tiles.json), puts it in the tilemap cache, adds the Lab scene and the map definition, and
 * stands villagers on their lab spots while a lab scenario runs. Debug builds only (loaded by src/dev/devtools.ts).
 */
import Phaser from 'phaser';
import { npcs } from '../data';
import { TILESET_KEY } from '../config';
import { getState } from '../state/store';
import { gameEvents } from '../systems/events';
import { FarmRenderer } from '../game/FarmRenderer';
import { mapCacheKey } from '../scenes/PreloadScene';
import { WorldScene } from '../scenes/WorldScene';
import { runtime } from '../state/runtime';
import { TowSpike } from './towSpike';
import { LAB_MAP, LAB_SCENE, labMap, labVillagers, registerLabMapDef } from './labDef';

/** The lab is a WorldScene like any map, plus its own soil renderer (soil state is shared with the farm). */
export class LabScene extends WorldScene {
  constructor() {
    super(LAB_SCENE, LAB_MAP);
  }

  /** The towing spike, when the scenario asks for it (stat `lab.towSpike`). */
  tow: TowSpike | null = null;

  create(): void {
    super.create();
    const soil = new FarmRenderer(this);
    soil.sync(getState(), false);
    const off = gameEvents.on('farmChanged', () => soil.sync(getState(), true));
    const stats = getState().stats;
    if (stats['lab.towSpike']) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const scene = this;
      this.tow = new TowSpike(
        {
          scene: this,
          fx: this.fx,
          walkTo: (t, face, done) => this.walkTo(t, face, done),
          stopWalk: () => this.stopWalk(),
          get walking() {
            return scene.walking;
          },
          get walkGoal() {
            return scene.walkGoal;
          },
          walkable: (tx, ty) => this.walkable(tx, ty),
          get farmer() {
            return scene.farmerSprite;
          },
          get actionInFront() {
            return scene.actionInFront;
          },
        },
        !!stats['lab.towLong'],
        stats['lab.towLane'] === 2 ? 'long' : 'spike',
      );
      this.tapHook = (wx, wy) => this.tow?.onTap(wx, wy) ?? false;
      this.actionHook = () => this.tow?.onAction() ?? false;
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      soil.destroy();
      this.tow?.destroy();
      this.tow = null;
      this.tapHook = null;
      this.actionHook = null;
    });
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (!runtime.blocked) this.tow?.update(delta);
  }
}

const TILE = 16;

/** The lab as a Tiled JSON map, with art layers when the art tileset (and its name table) is available. */
export function labTiledJson(
  tileIds: Record<string, number> | null,
  tilesetW: number,
  tilesetH: number,
) {
  const L = labMap;
  const columns = Math.max(1, Math.floor(tilesetW / TILE));
  const rows = Math.max(1, Math.floor(tilesetH / TILE));
  const layer = (id: number, name: string, data: number[], visible = true) => ({
    id,
    name,
    type: 'tilelayer',
    width: L.w,
    height: L.h,
    x: 0,
    y: 0,
    opacity: 1,
    visible,
    data,
  });
  const art =
    tileIds && columns * rows > 21
      ? Object.entries(L.art.layers).map(([name, cells], k) =>
          layer(
            10 + k,
            name,
            cells.map((i) => {
              const n = i ? L.art.names[i - 1] : undefined;
              const idx = n === undefined ? undefined : tileIds[n];
              return idx === undefined || idx < 0 ? 0 : idx + 1;
            }),
          ),
        )
      : [];
  const points = (id: number, name: string, objects: unknown[]) => ({
    id,
    name,
    type: 'objectgroup',
    x: 0,
    y: 0,
    opacity: 1,
    visible: false,
    draworder: 'topdown',
    objects,
  });
  return {
    compressionlevel: -1,
    width: L.w,
    height: L.h,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    version: '1.10',
    type: 'map',
    tilewidth: TILE,
    tileheight: TILE,
    nextlayerid: 30,
    nextobjectid: 1000,
    layers: [
      layer(1, 'ground', L.ground),
      ...art,
      layer(2, 'collision', L.collision, false),
      { ...points(3, 'objects', L.objects), visible: true },
      points(
        4,
        'lights',
        L.lights.map((l, k) => ({
          id: 500 + k,
          name: l.type,
          type: 'light',
          x: l.tx * TILE + 8,
          y: l.ty * TILE + 8,
          width: 0,
          height: 0,
          point: true,
          rotation: 0,
          visible: true,
        })),
      ),
      points(
        5,
        'blooms',
        L.blooms.map((b, k) => ({
          id: 800 + k,
          name: 'bloom',
          type: 'bloom',
          x: b.x,
          y: b.y,
          width: 0,
          height: 0,
          point: true,
          rotation: 0,
          visible: true,
          properties: [{ name: 'flowers', type: 'int', value: b.n }],
        })),
      ),
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'placeholder',
        image: '../tilesets/tiles.png',
        imagewidth: columns * TILE,
        imageheight: rows * TILE,
        tilewidth: TILE,
        tileheight: TILE,
        tilecount: columns * rows,
        columns,
        margin: 0,
        spacing: 0,
      },
    ],
  };
}

let installed: Promise<void> | null = null;

/**
 * Register the lab with a running game (after the Preload scene: it loads every map in mapsData by file, and the
 * lab is not a file). Safe to call more than once.
 */
export function installLab(game: Phaser.Game): Promise<void> {
  installed ??= (async () => {
    let tileIds: Record<string, number> | null = null;
    try {
      const res = await fetch('assets/tilesets/tiles.json');
      if (res.ok) tileIds = ((await res.json()) as { tiles: Record<string, number> }).tiles;
    } catch {
      /* no art tileset: the lab shows its ground only */
    }
    const src = game.textures.exists(TILESET_KEY)
      ? (game.textures.get(TILESET_KEY).getSourceImage() as { width: number; height: number })
      : { width: 21 * TILE, height: TILE };
    game.cache.tilemap.add(mapCacheKey(LAB_MAP), {
      format: Phaser.Tilemaps.Formats.TILED_JSON,
      data: labTiledJson(tileIds, src.width, src.height),
    });
    registerLabMapDef();
    if (!game.scene.getScene(LAB_SCENE)) {
      game.scene.add(LAB_SCENE, LabScene, false);
      // Added last, the lab would draw over the UI: the floating controls sit inside the world's view (feel lane,
      // towing round: the Action plate and hotbar were hidden in every lab scenario).
      if (game.scene.getScene('UI')) game.scene.moveBelow('UI', LAB_SCENE);
    }
  })();
  return installed;
}

/** Villager schedules as the game data has them, kept while the lab override is on. */
let savedSchedules: Map<string, unknown> | null = null;

/**
 * While a lab scenario runs, villagers with a lab spot stand there all day (so talking, gifting and the villager
 * sheet can be tried in the lab). This edits the loaded villager data for this page session only; `false`
 * restores it.
 */
export function standVillagersInLab(on: boolean): void {
  if (on && !savedSchedules) {
    savedSchedules = new Map();
    for (const v of labVillagers()) {
      const def = npcs[v.npc] as unknown as Record<string, unknown>;
      savedSchedules.set(v.npc, def['schedule']);
      def['schedule'] = [{ from: 0, map: LAB_MAP, tx: v.tx, ty: v.ty }];
    }
  } else if (!on && savedSchedules) {
    for (const [id, schedule] of savedSchedules) {
      const def = npcs[id] as unknown as Record<string, unknown>;
      if (schedule === undefined) delete def['schedule'];
      else def['schedule'] = schedule;
    }
    savedSchedules = null;
  }
}
