/**
 * Dev tools entry (a lazy chunk; src/main.ts imports it only in dev builds or with ?debug, and
 * `npm run build:store` leaves it out entirely). Installs `window.__farm.dev` (see ./api.ts), the lab map, the
 * dev menu, and starts `?scenario=<name>` when the URL asks for one.
 */
import Phaser from 'phaser';
import { mapsData } from '../data';
import { saveStore } from '../game/persistence';
import { inputHub } from '../input/InputHub';
import { MemoryStore } from '../platform/SaveStore';
import { spawnPosition, type Direction, type GameState } from '../state/GameState';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { mapCacheKey } from '../scenes/PreloadScene';
import { pinStage } from '../systems/valley';
import type { TiledMapLike } from '../systems/world';
import type { FarmDevApi, ScenarioInfo } from './api';
import { DevControl } from './control';
import { DevMenu } from './devMenu';
import { FrameMeter } from './frameStats';
import { installLab, standVillagersInLab } from './lab';
import { LAB_MAP, labMap } from './labDef';
import { SCENARIOS } from './scenarioIndex';
import { buildScenarioState, mapInfoFromTiled, scenarioRuntime, type MapInfoFn } from './scenarios';
import { DevWaits } from './waits';
import { parseLocale, setLocale } from '../i18n';

type Loose = Record<string, unknown>;

/** A string only this chunk contains: scripts/check-bundle.mjs looks for it in what players load. */
export const DEVTOOLS_MARKER = 'tiny-acre-devtools';

/** Map bounds and walkability from the loaded tilemaps (validation before a scenario starts). */
function mapInfoFrom(game: Phaser.Game): MapInfoFn {
  return (map, variant) => {
    const raw = game.cache.tilemap.get(mapCacheKey(map, variant ?? null))?.data as
      Parameters<typeof mapInfoFromTiled>[0] | undefined;
    return raw ? mapInfoFromTiled(raw) : null;
  };
}

/** Where a map's doors drop the player (the first door of another map that leads there). */
function arrivalTile(
  game: Phaser.Game,
  map: string,
): { tx: number; ty: number; facing: Direction } {
  if (map === LAB_MAP) return labMap.start;
  if (map === mapsData.start.map) return mapsData.start;
  if (map === mapsData.wake.map) return mapsData.wake;
  for (const id of Object.keys(mapsData.maps)) {
    const raw = game.cache.tilemap.get(mapCacheKey(id))?.data as TiledMapLike | undefined;
    for (const layer of raw?.layers ?? [])
      for (const o of (layer as { objects?: Loose[] }).objects ?? []) {
        if (o['type'] !== 'door') continue;
        const p = Object.fromEntries(
          ((o['properties'] as { name: string; value: unknown }[]) ?? []).map((q) => [
            q.name,
            q.value,
          ]),
        );
        if (p['targetMap'] === map)
          return {
            tx: Number(p['spawnTx']),
            ty: Number(p['spawnTy']),
            facing: p['facing'] as Direction,
          };
      }
  }
  return { tx: 2, ty: 2, facing: 'down' };
}

export function installDevTools(game: Phaser.Game): FarmDevApi {
  const control = new DevControl(game);
  const waits = new DevWaits(game);
  const meter = new FrameMeter(game);
  let readyState: FarmDevApi['readyState'] = 'installing';
  let error: string | null = null;
  let current: string | null = null;
  let sandboxed = false;
  let menu: DevMenu | null = null;
  let resolveReady!: () => void;
  const readyPromise = new Promise<void>((r) => (resolveReady = r));

  /** From the first scenario on, saves go to memory: the developer's real save is never overwritten. */
  let mem = new MemoryStore();
  const sandbox = (): void => {
    if (sandboxed) return;
    sandboxed = true;
    const store = saveStore as unknown as Loose;
    store['read'] = (k: string) => mem.read(k);
    store['write'] = (k: string, v: string) => mem.write(k, v);
    store['remove'] = (k: string) => mem.remove(k);
  };

  const titleActive = () => game.scene.isActive('Title');

  /** Back to the title screen (as Quit does from a game), waiting until it has built its buttons. */
  const toTitle = async (): Promise<void> => {
    if (!titleActive()) {
      const ui = game.scene.getScene('UI') as unknown as Loose | null;
      if (game.scene.isActive('UI') && ui && typeof ui['quitToTitle'] === 'function')
        (ui['quitToTitle'] as () => void).call(ui);
      else game.scene.start('Title');
    }
    // The title builds its buttons once it has looked for a save: start after that, never under it.
    await waits.until(() => {
      const t = game.scene.getScene('Title') as unknown as Loose;
      return titleActive() && ((t['buttons'] as unknown[])?.length ?? 0) > 0;
    }, 'the title screen');
  };

  /** Start a state through the title screen's own start (exactly what Continue does). */
  const startFromTitle = async (state: GameState): Promise<void> => {
    await toTitle();
    const title = game.scene.getScene('Title') as unknown as Loose;
    (title['start'] as (s: GameState) => void).call(title, state);
  };

  const load = async (name: string): Promise<void> => {
    const def = SCENARIOS[name];
    if (!def) throw new Error(`No scenario "${name}". Known: ${Object.keys(SCENARIOS).join(', ')}`);
    await installLab(game);
    const state = buildScenarioState(def, mapInfoFrom(game));
    const opts = scenarioRuntime(def);
    sandbox();
    current = name;
    // The scenario's language, else ?lang=, else English (never the device: checks read the same text everywhere).
    setLocale(opts.lang ?? parseLocale(new URLSearchParams(location.search).get('lang')) ?? 'en');
    if (opts.title === 'first-launch') {
      // A first launch: an empty sandbox (no save), then the title rebuilt from scratch so it looks for none.
      mem = new MemoryStore();
      inputHub.clearHeld();
      await toTitle();
      game.scene.getScene('Title').scene.restart();
      await waits.frames(2);
      await toTitle();
      const url = new URL(location.href);
      url.searchParams.set('scenario', name);
      history.replaceState(null, '', url);
      return;
    }
    inputHub.clearHeld();
    standVillagersInLab(state.player.map === LAB_MAP);
    control.resumeLoop();
    control.resumeClock();
    control.setClockScale(1);
    await startFromTitle(state);
    control.seed(opts.seed);
    if (opts.clock === 'paused') control.pauseClock();
    control.setClockScale(opts.clockScale);
    const url = new URL(location.href);
    if (url.searchParams.get('scenario') !== name) {
      url.searchParams.set('scenario', name);
      history.replaceState(null, '', url);
    }
    await waits.sceneReady();
  };

  const worldCamera = (): Phaser.Cameras.Scene2D.Camera | null =>
    waits.world()?.cameras.main ?? null;

  const api: FarmDevApi = {
    version: 1,
    get readyState() {
      return readyState;
    },
    get error() {
      return error;
    },
    ready: () => readyPromise,
    scenarios: (): ScenarioInfo[] =>
      Object.values(SCENARIOS).map((d) => ({
        name: d.name!,
        title: d.title,
        ...(d.about ? { about: d.about } : {}),
        ...(d.tags ? { tags: d.tags } : {}),
      })),
    get scenario() {
      return current;
    },
    load,
    build: (name) => {
      const def = SCENARIOS[name];
      if (!def) throw new Error(`No scenario "${name}"`);
      return buildScenarioState(def, mapInfoFrom(game));
    },
    get sandboxed() {
      return sandboxed;
    },
    clock: {
      pause: () => control.pauseClock(),
      resume: () => control.resumeClock(),
      scale: (k) => control.setClockScale(k),
      get: () => control.clock,
    },
    loop: {
      pause: () => control.pauseLoop(),
      resume: () => control.resumeLoop(),
      step: (n, dt) => control.step(n, dt),
      get paused() {
        return control.isLoopPaused;
      },
      get frame() {
        return control.frame;
      },
    },
    seed: (n) => control.seed(n),
    time: {
      set: (t) => control.setTime(t),
      skipDays: (n, o) => control.skipDays(n, o),
    },
    stage: async (map, variant) => {
      const s = getState();
      const stats = pinStage(map, variant, s.stats);
      if (!stats) throw new Error(`Map "${map}" has no stage "${variant}"`);
      Object.assign(s.stats, stats);
      const p = s.player;
      await api.goto(p.map, Math.floor(p.x / 16), Math.floor((p.y - 3) / 16), p.facing);
    },
    goto: async (map, tx, ty, facing) => {
      if (!mapsData.maps[map]) throw new Error(`Unknown map "${map}"`);
      if (map === LAB_MAP) await installLab(game);
      const at = arrivalTile(game, map);
      const s = getState();
      s.player = { map, ...spawnPosition(tx ?? at.tx, ty ?? at.ty), facing: facing ?? at.facing };
      standVillagersInLab(map === LAB_MAP);
      runtime.busy = false;
      const key = mapsData.maps[map]!.scene;
      const world = waits.world();
      if (world?.scene.key === key) {
        // the same map: restart it (a stop and a start of one scene in one step left it shut down every other time)
        world.scene.restart();
        await waits.frames(2);
      } else {
        world?.scene.stop();
        game.scene.start(key);
      }
      await waits.sceneReady(key);
    },
    wait: {
      until: (pred, what, o) => waits.until(pred, what, o),
      frames: (n, o) => waits.frames(n, o),
      event: (name, o) => waits.event(name, o),
      sceneReady: (key, o) => waits.sceneReady(key, o),
      transitionDone: (o) => waits.transitionDone(o),
      panelOpen: (name, o) => waits.panelOpen(name, o),
      panelClosed: (o) => waits.panelClosed(o),
      actionDone: (o) => waits.actionDone(o),
      idle: (frames, o) => waits.idle(frames, o),
    },
    openSheet: () => waits.openSheet(),
    tileToScreen: (tx, ty) => {
      const c = worldCamera();
      if (!c) return null;
      return { x: tx * 16 + 8 - c.scrollX + c.x, y: ty * 16 + 8 - c.scrollY + c.y };
    },
    screenToTile: (x, y) => {
      const c = worldCamera();
      if (!c) return null;
      return {
        tx: Math.floor((x - c.x + c.scrollX) / 16),
        ty: Math.floor((y - c.y + c.scrollY) / 16),
      };
    },
    menu: {
      open: () => menu?.open(),
      close: () => menu?.close(),
      toggle: () => menu?.toggle(),
      get isOpen() {
        return menu?.isOpen ?? false;
      },
    },
    overlay: {
      fps: (on) => {
        if (on !== undefined) menu?.setFps(on);
        return menu?.showFps ?? false;
      },
      tiles: (on) => {
        if (on !== undefined) menu?.setTiles(on);
        return menu?.showTiles ?? false;
      },
    },
    frameStats: () => meter.stats(),
  };
  (window as unknown as { __farm?: Loose }).__farm ??= {};
  (window as unknown as { __farm: Loose }).__farm['dev'] = api;
  document.documentElement.dataset['devtools'] = DEVTOOLS_MARKER;

  // Install once the Preload scene has loaded every map (the lab joins them by hand, not by file).
  void (async () => {
    try {
      await waits.until(() => titleActive() || game.scene.isActive('UI'), 'the title screen', {
        timeout: 60_000,
      });
      await installLab(game);
      const q = new URLSearchParams(location.search);
      menu = new DevMenu(
        api,
        meter,
        () => game.canvas,
        import.meta.env.DEV || q.has('scenario') || q.has('devmenu'),
      );
      const wanted = new URLSearchParams(location.search).get('scenario');
      if (wanted) await load(wanted);
      readyState = 'ready';
      resolveReady();
    } catch (e) {
      error = String((e as Error)?.message ?? e);
      readyState = 'error';
      console.error(`${DEVTOOLS_MARKER}: ${error}`);
      resolveReady();
    }
  })();
  return api;
}
