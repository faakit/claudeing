/**
 * Scenarios: named, reproducible game states for development, tests and reviews (pure, no Phaser).
 *
 * A scenario is data (`src/dev/scenarios/<name>.json`). It is turned into a game state like this:
 *
 * 1. Start from today's new game (`createInitialState`) with a fixed RNG seed (`dev.seed`, default 12345).
 * 2. Raw patch: `state` (a partial save written at save version `version`) is deep-merged on top, the result is
 *    labelled with that version and run through `migrate` (every migration since, then `sanitize`). This is what
 *    keeps an old fixture loading after a save-version bump.
 * 3. Semantic keys (`at`, `time`, `items`, `crops`, `placed`, `goal`, `tutorial`, ...) are applied through
 *    today's rules. They name things (items, crops, goals by id), never save-format details, so prefer them.
 * 4. The result goes through `migrate` once more (validated and sanitized at the current version).
 *
 * Every scenario is loaded by a unit test (tests/dev-scenarios.test.ts) on every run.
 */
import {
  crops,
  goals,
  items,
  mail,
  mapsData,
  nodes,
  npcs,
  placeables,
  plots,
  tips,
  tutorial as tutorialData,
} from '../data';
import {
  createInitialState,
  spawnPosition,
  STATE_VERSION,
  type ControlSettings,
  type Direction,
  type GameState,
  type Season,
  type Settings,
  type Weather,
} from '../state/GameState';
import { POINTS_PER_HEART } from '../systems/friendship';
import { addItem, bagSize } from '../systems/inventory';
import { letterDue } from '../systems/mail';
import { migrate } from '../systems/save';
import { applyLabPreset, LAB_MAP, readyPlacedData, registerLabMapDef } from './labDef';

export const DEFAULT_SEED = 12345;

type Tile = [number, number];

export interface ScenarioDef {
  /** File name without `.json` (set by the index from the file name). */
  name?: string;
  /** One line: what this scenario stages. */
  title: string;
  /** Longer notes: what to look at, which feature or finding it reproduces. */
  about?: string;
  /** Save version the raw `state` patch was written against (write the current STATE_VERSION). */
  version: number;
  /** Free tags for the dev menu and docs (e.g. "farm", "town", "a11y"). */
  tags?: string[];
  /** Raw partial save at `version`, for anything the semantic keys do not cover. Migrated on load. */
  state?: Record<string, unknown>;
  /** "lab": fill the lab map's showcase (every crop stage, placeable, machine, node, forage good). */
  preset?: 'lab';
  /** Where the player stands. */
  at?: { map: string; tx: number; ty: number; facing?: Direction };
  time?: { year?: number; season?: Season; day?: number; clock?: string };
  weather?: Weather;
  forecast?: Weather;
  money?: number;
  /** A number, or "max". */
  energy?: number | 'max';
  /** Water left in the can, or "max". */
  water?: number | 'max';
  /** Added to the bag (hotbar first for seeds and machines, like a pickup). `slot` puts it in that slot. */
  items?: { item: string; qty?: number; q?: number; of?: string; slot?: number }[];
  /** Hotbar slot to select: an index, or an item id (the first slot holding it). */
  select?: number | string;
  /** Soil with crops. `stage` is a number, "seed" (0) or "ripe" (mature). */
  crops?: {
    crop: string;
    stage: number | 'seed' | 'ripe';
    tiles?: Tile[];
    /** [x, y, w, h] */
    rect?: [number, number, number, number];
    watered?: boolean;
    fert?: string;
  }[];
  /** Tilled soil without crops. */
  soil?: { tiles?: Tile[]; rect?: [number, number, number, number]; watered?: boolean }[];
  /**
   * Placed objects (`map` defaults to the player's map). `data` is the behaviour's own state; `ready: true`
   * fills it "in use and ready" (animals home with a product waiting, a machine finished, a tree bearing).
   */
  placed?: {
    type: string;
    tx: number;
    ty: number;
    map?: string;
    ready?: boolean;
    data?: Record<string, unknown>;
  }[];
  forage?: { item: string; tx: number; ty: number; map?: string }[];
  nodes?: { node: string; tx: number; ty: number; map?: string }[];
  /** Hearts per villager (0-5). */
  friends?: Record<string, number>;
  /** The current goal, by id. */
  goal?: string;
  /** Merged into the lifetime stats. */
  stats?: Record<string, number>;
  /**
   * The guided start. "off" (default): skipped. "fresh": decided by the game as on a new game (the guide runs
   * unless the URL says `?tutorial=0`). "on": the guide runs from its first undone step. "day2": day 1 is done.
   */
  tutorial?: 'off' | 'fresh' | 'on' | 'day2';
  /** First-run tips and hints. "off" (default) marks them seen so they never cover a screenshot. */
  hints?: 'off' | 'on';
  settings?: Partial<Omit<Settings, 'controls'>> & { controls?: Partial<ControlSettings> };
  /** "all" or plot ids (starter plots are always owned). */
  plots?: 'all' | string[];
  upgrades?: Partial<GameState['upgrades']>;
  /**
   * Data letters by id (mail.json), delivered unread today. Every other data letter already due by the scenario's
   * date counts as delivered long ago, so the next morning does not bring a backlog.
   */
  letters?: string[];
  /** Extra hand-written letters in the mailbox (arrived today unless `day` is given). */
  mail?: {
    from: string;
    title: string;
    text: string;
    gift?: { item: string; qty: number };
    read?: boolean;
    day?: number;
  }[];
  /** Goods already in the shipping bin. */
  shipping?: { item: string; qty: number; q?: number }[];
  /** Runtime options applied when the scenario starts in the game (not part of the state). */
  dev?: {
    /** RNG seed (state.rng and, in the browser, Math.random). Default 12345. */
    seed?: number;
    /** "paused" freezes the game clock (the world still moves). */
    clock?: 'paused' | 'running';
    /** Game-clock speed multiplier (1 = normal). */
    clockScale?: number;
    /**
     * "first-launch": stop on the title screen as a first launch shows it (no save in the sandbox: Rosa's letter
     * and New Game). The scenario's state is not started.
     */
    title?: 'first-launch';
  };
}

export interface MapInfo {
  w: number;
  h: number;
  blocked(tx: number, ty: number): boolean;
}
export type MapInfoFn = (map: string) => MapInfo | null;

export class ScenarioError extends Error {
  constructor(
    readonly scenario: string,
    readonly problems: string[],
  ) {
    super(`Scenario "${scenario}": ${problems.join('; ')}`);
  }
}

const KEYS = new Set([
  '$schema',
  'name',
  'title',
  'about',
  'version',
  'tags',
  'state',
  'preset',
  'at',
  'time',
  'weather',
  'forecast',
  'money',
  'energy',
  'water',
  'items',
  'select',
  'crops',
  'soil',
  'placed',
  'forage',
  'nodes',
  'friends',
  'goal',
  'stats',
  'tutorial',
  'hints',
  'settings',
  'plots',
  'upgrades',
  'letters',
  'mail',
  'shipping',
  'dev',
]);
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const WEATHERS = ['sunny', 'rain', 'storm'];
const DIRS = ['up', 'down', 'left', 'right'];

/** "HH:MM" (hours may run past 24 for after midnight, up to 26:00) to minutes since midnight. */
export function parseClock(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 ? v : null;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isObj(base) || !isObj(patch)) return patch;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = deepMerge(base[k], v);
  return out;
}

function tilesOf(t: { tiles?: Tile[]; rect?: [number, number, number, number] }): Tile[] {
  const out: Tile[] = [...(t.tiles ?? [])];
  if (t.rect) {
    const [x, y, w, h] = t.rect;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) out.push([i, j]);
  }
  return out;
}

const usesLab = (d: ScenarioDef): boolean =>
  d.preset === 'lab' ||
  d.at?.map === LAB_MAP ||
  [...(d.placed ?? []), ...(d.forage ?? []), ...(d.nodes ?? [])].some((x) => x.map === LAB_MAP);

/** Every problem with a scenario (empty when it is valid). `mapInfo` adds bounds and walkability checks. */
export function validateScenario(input: unknown, mapInfo?: MapInfoFn): string[] {
  const p: string[] = [];
  if (!isObj(input)) return ['not an object'];
  const d = input as unknown as ScenarioDef;
  for (const k of Object.keys(input)) if (!KEYS.has(k)) p.push(`unknown key "${k}"`);
  if (typeof d.title !== 'string' || !d.title) p.push('needs a "title"');
  if (!Number.isInteger(d.version) || d.version < 1)
    p.push('needs an integer "version" (the save version)');
  else if (d.version > STATE_VERSION)
    p.push(`version ${d.version} is newer than this game (${STATE_VERSION})`);
  if (d.state !== undefined && !isObj(d.state)) p.push('"state" must be an object');
  if (d.preset !== undefined && d.preset !== 'lab') p.push(`unknown preset "${String(d.preset)}"`);
  if (usesLab(d)) registerLabMapDef();
  const mapOk = (m: unknown, what: string): boolean => {
    if (typeof m !== 'string' || !mapsData.maps[m]) {
      p.push(`${what}: unknown map "${String(m)}"`);
      return false;
    }
    return true;
  };
  const playerMap = d.at?.map ?? mapsData.start.map;
  const tileOk = (map: string, tx: number, ty: number, what: string, walkable = false): void => {
    if (!Number.isInteger(tx) || !Number.isInteger(ty)) {
      p.push(`${what}: tile must be integers`);
      return;
    }
    const info = mapInfo?.(map);
    if (!info) return;
    if (tx < 0 || ty < 0 || tx >= info.w || ty >= info.h)
      p.push(`${what}: tile ${tx},${ty} is outside map "${map}" (${info.w}x${info.h})`);
    else if (walkable && info.blocked(tx, ty))
      p.push(`${what}: tile ${tx},${ty} on "${map}" is blocked (a wall, water or prop)`);
  };
  if (d.at) {
    if (mapOk(d.at.map, 'at')) tileOk(d.at.map, d.at.tx, d.at.ty, 'at', true);
    if (d.at.facing !== undefined && !DIRS.includes(d.at.facing))
      p.push(`at.facing must be one of ${DIRS.join(', ')}`);
  }
  if (d.time) {
    if (d.time.season !== undefined && !SEASONS.includes(d.time.season))
      p.push(`time.season "${d.time.season}" unknown`);
    if (
      d.time.day !== undefined &&
      (!Number.isInteger(d.time.day) || d.time.day < 1 || d.time.day > 28)
    )
      p.push('time.day must be 1-28');
    if (d.time.clock !== undefined) {
      const m = parseClock(d.time.clock);
      if (m === null || m < 360 || m > 1560)
        p.push('time.clock must be "HH:MM" between 06:00 and 26:00');
    }
  }
  for (const w of [d.weather, d.forecast])
    if (w !== undefined && !WEATHERS.includes(w)) p.push(`weather "${w}" unknown`);
  const itemOk = (id: unknown, what: string): boolean => {
    if (typeof id !== 'string' || !items[id]) {
      p.push(`${what}: unknown item "${String(id)}"`);
      return false;
    }
    return true;
  };
  for (const it of d.items ?? []) {
    if (itemOk(it.item, 'items') && items[it.item]?.type === 'tool')
      p.push(`items: "${it.item}" is a tool (tools are always in their slots)`);
  }
  if (typeof d.select === 'string') itemOk(d.select, 'select');
  for (const c of d.crops ?? []) {
    const def = crops[c.crop];
    if (!def) p.push(`crops: unknown crop "${c.crop}"`);
    else if (typeof c.stage === 'number' && (c.stage < 0 || c.stage > def.stageDays.length))
      p.push(`crops: ${c.crop} has stages 0-${def.stageDays.length}`);
    else if (typeof c.stage !== 'number' && c.stage !== 'seed' && c.stage !== 'ripe')
      p.push(`crops: stage must be a number, "seed" or "ripe"`);
    if (c.fert !== undefined && items[c.fert]?.type !== 'fertilizer')
      p.push(`crops: "${c.fert}" is not a fertilizer`);
    if (!tilesOf(c).length) p.push(`crops: ${c.crop} needs "tiles" or "rect"`);
    for (const [tx, ty] of tilesOf(c)) tileOk('farm', tx, ty, `crops ${c.crop}`);
  }
  for (const o of d.placed ?? []) {
    if (!placeables[o.type]) p.push(`placed: unknown placeable "${o.type}"`);
    const map = o.map ?? playerMap;
    if (mapOk(map, 'placed')) tileOk(map, o.tx, o.ty, `placed ${o.type}`, true);
  }
  for (const f of d.forage ?? []) {
    if (itemOk(f.item, 'forage') && items[f.item]?.type !== 'forage')
      p.push(`forage: "${f.item}" is not a forage good`);
    const map = f.map ?? playerMap;
    if (mapOk(map, 'forage')) tileOk(map, f.tx, f.ty, `forage ${f.item}`, true);
  }
  for (const n of d.nodes ?? []) {
    if (!nodes[n.node]) p.push(`nodes: unknown node "${n.node}"`);
    const map = n.map ?? playerMap;
    if (mapOk(map, 'nodes')) tileOk(map, n.tx, n.ty, `node ${n.node}`, true);
  }
  for (const [id, h] of Object.entries(d.friends ?? {})) {
    if (!npcs[id]) p.push(`friends: unknown villager "${id}"`);
    if (typeof h !== 'number' || h < 0 || h > 5) p.push(`friends: ${id} hearts must be 0-5`);
  }
  if (d.goal !== undefined && !goals.some((g) => g.id === d.goal))
    p.push(`goal: unknown goal "${d.goal}"`);
  if (d.tutorial !== undefined && !['off', 'fresh', 'on', 'day2'].includes(d.tutorial))
    p.push(`tutorial must be off, fresh, on or day2`);
  if (d.plots !== undefined && d.plots !== 'all')
    for (const id of d.plots) if (!plots[id]) p.push(`plots: unknown plot "${id}"`);
  for (const id of d.letters ?? [])
    if (!mail.letters.some((l) => l.id === id)) p.push(`letters: unknown letter "${id}"`);
  for (const l of d.mail ?? []) {
    if (!npcs[l.from]) p.push(`mail: unknown sender "${l.from}"`);
    if (l.gift) itemOk(l.gift.item, 'mail gift');
  }
  for (const s of d.shipping ?? []) itemOk(s.item, 'shipping');
  if (d.dev?.clock !== undefined && !['paused', 'running'].includes(d.dev.clock))
    p.push('dev.clock must be "paused" or "running"');
  if (d.dev?.title !== undefined && d.dev.title !== 'first-launch')
    p.push('dev.title must be "first-launch"');
  return p;
}

/** Build the game state a scenario describes (throws ScenarioError when it is invalid). */
export function buildScenarioState(def: ScenarioDef, mapInfo?: MapInfoFn): GameState {
  const name = def.name ?? '(unnamed)';
  const problems = validateScenario(def, mapInfo);
  if (problems.length) throw new ScenarioError(name, problems);

  // 1-2. Today's new game with a fixed seed, the raw patch migrated from the fixture's version.
  const base = createInitialState();
  base.rng = (def.dev?.seed ?? DEFAULT_SEED) >>> 0;
  let s: GameState;
  try {
    if (def.state) {
      const raw = deepMerge(JSON.parse(JSON.stringify(base)), def.state) as Record<string, unknown>;
      raw['version'] = def.version;
      s = migrate(raw);
    } else s = migrate(JSON.parse(JSON.stringify(base)));
  } catch (e) {
    throw new ScenarioError(name, [`raw state does not load: ${(e as Error).message}`]);
  }

  // 3. Semantic keys, through today's rules.
  if (def.preset === 'lab') applyLabPreset(s);
  if (def.plots === 'all') s.plots = Object.keys(plots);
  else if (def.plots) s.plots = [...new Set([...s.plots, ...def.plots])];
  if (def.upgrades) {
    Object.assign(s.upgrades, def.upgrades);
    while (s.inventory.slots.length < bagSize(s)) s.inventory.slots.push(null);
  }
  if (def.money !== undefined) s.money = def.money;
  if (def.time) {
    const t = def.time;
    if (t.year !== undefined) s.time.year = t.year;
    if (t.season !== undefined) s.time.season = t.season;
    if (t.day !== undefined) s.time.day = t.day;
    if (t.clock !== undefined) s.time.minutes = parseClock(t.clock) ?? s.time.minutes;
    s.time.acc = 0;
  }
  if (def.weather) s.weather = def.weather;
  if (def.forecast) s.forecast = def.forecast;
  if (def.at) {
    s.player = {
      map: def.at.map,
      ...spawnPosition(def.at.tx, def.at.ty),
      facing: def.at.facing ?? 'down',
    };
  }
  if (def.settings) {
    const { controls, ...rest } = def.settings;
    Object.assign(s.settings, rest);
    if (controls) Object.assign(s.settings.controls, controls);
  }
  const tut = def.tutorial ?? 'off';
  if (tut === 'off') s.stats['tut.off'] = 1;
  else if (tut === 'on' || tut === 'day2') s.stats['tut.on'] = 1;
  if (tut === 'day2') {
    s.stats['tut.gift'] = 1;
    for (const st of tutorialData.steps) if (st.track === 'day1') s.stats[`tut.${st.id}`] = 1;
  }
  if ((def.hints ?? 'off') === 'off') {
    s.stats['moved'] = Math.max(1, s.stats['moved'] ?? 0); // the one-time drag hint
    for (const id of ['welcome', 'paint', 'ring', 'swaps', 'tills', ...tips.map((t) => t.id)])
      s.stats[`tip.${id}`] = 1;
  }
  if (def.goal !== undefined) s.goalIndex = goals.findIndex((g) => g.id === def.goal);
  if (def.stats) Object.assign(s.stats, def.stats);
  const today = ((s.time.year - 1) * 4 + SEASONS.indexOf(s.time.season)) * 28 + s.time.day; // absolute day
  for (const [id, hearts] of Object.entries(def.friends ?? {}))
    s.friends[id] = { points: Math.round(hearts * POINTS_PER_HEART), talkedDay: 0, giftedDay: 0 };
  for (const it of def.items ?? []) {
    const ref = { item: it.item, ...(it.q ? { q: it.q } : {}), ...(it.of ? { of: it.of } : {}) };
    if (it.slot !== undefined) s.inventory.slots[it.slot] = { ...ref, qty: it.qty ?? 1 };
    else addItem(s, ref, it.qty ?? 1);
  }
  if (typeof def.select === 'number') s.inventory.selected = def.select;
  else if (typeof def.select === 'string') {
    const i = s.inventory.slots.findIndex((x) => x?.item === def.select);
    if (i >= 0) s.inventory.selected = i;
  }
  for (const c of def.crops ?? []) {
    const len = crops[c.crop]!.stageDays.length;
    const stage = c.stage === 'ripe' ? len : c.stage === 'seed' ? 0 : c.stage;
    for (const [tx, ty] of tilesOf(c)) {
      delete s.farm.weeds[`${tx},${ty}`];
      s.farm.tiles[`${tx},${ty}`] = {
        watered: c.watered === true,
        crop: { cropId: c.crop, stage, daysInStage: 0, regrow: false },
        ...(c.fert ? { fert: c.fert } : {}),
      };
    }
  }
  for (const t of def.soil ?? [])
    for (const [tx, ty] of tilesOf(t)) {
      delete s.farm.weeds[`${tx},${ty}`];
      s.farm.tiles[`${tx},${ty}`] = { watered: t.watered === true, crop: null };
    }
  for (const o of def.placed ?? []) {
    const map = o.map ?? s.player.map;
    (s.placed[map] ??= []).push({
      id: s.nextPlacedId++,
      type: o.type,
      tx: o.tx,
      ty: o.ty,
      data: {
        ...(o.ready ? readyPlacedData(o.type) : {}),
        ...JSON.parse(JSON.stringify(o.data ?? {})),
      },
    });
  }
  for (const f of def.forage ?? [])
    (s.forage[f.map ?? s.player.map] ??= {})[`${f.tx},${f.ty}`] = f.item;
  for (const n of def.nodes ?? [])
    (s.nodes[n.map ?? s.player.map] ??= {})[`${n.tx},${n.ty}`] = n.node;
  for (const l of mail.letters) {
    const listed = def.letters?.includes(l.id) === true;
    if (s.stats[`mail.${l.id}`] || (!listed && !letterDue(s, l))) continue;
    s.stats[`mail.${l.id}`] = 1;
    if (listed)
      s.mail.list.push({
        id: s.mail.next++,
        from: l.from,
        title: l.title,
        text: l.text,
        day: today,
        read: false,
        taken: false,
        ...(l.gift ? { gift: { ...l.gift } } : {}),
      });
  }
  for (const l of def.mail ?? [])
    s.mail.list.push({
      id: s.mail.next++,
      from: l.from,
      title: l.title,
      text: l.text,
      day: l.day ?? today,
      read: l.read === true,
      taken: false,
      ...(l.gift ? { gift: { ...l.gift } } : {}),
    });
  for (const sh of def.shipping ?? []) {
    const key = `${sh.item}|${sh.q ?? 0}|`;
    s.shipping[key] = (s.shipping[key] ?? 0) + sh.qty;
  }

  // 4. Validate and sanitize at the current version; energy and water last (their caps depend on the rest).
  let out: GameState;
  try {
    out = migrate(JSON.parse(JSON.stringify(s)));
  } catch (e) {
    throw new ScenarioError(name, [`built state does not load: ${(e as Error).message}`]);
  }
  if (def.energy !== undefined)
    out.energy = def.energy === 'max' ? Number.MAX_SAFE_INTEGER : def.energy;
  if (def.water !== undefined)
    out.water = def.water === 'max' ? Number.MAX_SAFE_INTEGER : def.water;
  if (def.energy !== undefined || def.water !== undefined)
    out = migrate(JSON.parse(JSON.stringify(out)));
  return out;
}

/** The runtime options a scenario asks for (seed, clock), with defaults. */
export function scenarioRuntime(def: ScenarioDef): {
  seed: number;
  clock: 'paused' | 'running';
  clockScale: number;
  title: 'first-launch' | null;
} {
  return {
    seed: (def.dev?.seed ?? DEFAULT_SEED) >>> 0,
    clock: def.dev?.clock ?? 'running',
    clockScale: def.dev?.clockScale ?? 1,
    title: def.dev?.title ?? null,
  };
}

/** Map bounds and walkability from a Tiled map (its collision layer). */
export function mapInfoFromTiled(raw: {
  width: number;
  height: number;
  layers: { name: string; data?: number[] }[];
}): MapInfo {
  const col = raw.layers.find((l) => l.name === 'collision')?.data ?? [];
  return {
    w: raw.width,
    h: raw.height,
    blocked: (tx, ty) => (col[ty * raw.width + tx] ?? 0) !== 0,
  };
}
