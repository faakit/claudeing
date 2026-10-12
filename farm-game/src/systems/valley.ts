/**
 * Map stages: which variant of a map the valley shows (WORLD-PLAN section 4, MILESTONES M2). Pure, no Phaser.
 *
 * A map listed in `valley.json` `maps` has 2-4 variants, first to last (the farm: dry, waking, restored). The first
 * variant whose `when` holds is the stage shown; the last one is the default and keeps the map's own file
 * (`farm.tmj`), the others are `<map>@<variant>.tmj` beside it. Maps not listed have one look.
 *
 * Variants may differ only inside the map's **delta rectangles**; nothing fixed (doors, spawns, plots, villager
 * spots, landmarks...) sits in them, and placing or tilling there is refused (`deltaRefusal`). The variant is chosen
 * when a map is built (a scene start: mornings start in the house, so an overnight change is seen on stepping out),
 * never at a door: the stats it reads only change overnight.
 */
import {
  crops,
  items,
  mapsData,
  placeables,
  valley,
  projects,
  type AskWhen,
  type MapStageDef,
  type PlaceDef,
  type StageWhen,
  type ValleyWhen,
  type WorkDayDef,
} from '../data';
import type { GameState, PlacedObject } from '../state/GameState';
import { absoluteDay } from './time';
import { addItem, roomFor } from './inventory';
import { behaviorOf, removePlaced } from './placeables';
import { fmtGold, t } from '../i18n';

export type Rect = readonly [number, number, number, number];

/** What a map looks like for a game state. */
export interface MapLook {
  map: string;
  /** The variant name, or null for a map with one look. */
  variant: string | null;
  /** Index of the stage, 0 = first (0 for a map with one look). */
  stage: number;
  /** The last (final) variant, or a map with one look: the map's own file. */
  final: boolean;
  /** The .tmj path under public/ (e.g. "assets/maps/farm@dry.tmj"). */
  file: string;
  /** Tileset palette for this stage ("dry"), when it has one. */
  palette?: string;
}

type StatsOnly = Pick<GameState, 'stats'>;

/**
 * Does a stage condition hold? `place: "spring"` reads the stat `place.spring`; a missing stat is 0. `all` and `any`
 * nest conditions (Wendhead's dry stage: the spring and the weir both unrestored).
 */
export function stageWhenHolds(state: StatsOnly, when: StageWhen): boolean {
  if (when.all) return when.all.every((w) => stageWhenHolds(state, w));
  if (when.any) return when.any.some((w) => stageWhenHolds(state, w));
  const key = when.place !== undefined ? `place.${when.place}` : (when.stat ?? '');
  const v = state.stats[key] ?? 0;
  return (when.min === undefined || v >= when.min) && (when.max === undefined || v <= when.max);
}

/** The stat keys a condition reads (nested ones included). */
export function whenKeys(when: StageWhen): string[] {
  if (when.all ?? when.any) return (when.all ?? when.any)!.flatMap(whenKeys);
  return [when.place !== undefined ? `place.${when.place}` : (when.stat ?? '')];
}

/** The variant names of a map, first to last (empty for a map with one look). */
export const mapVariants = (map: string): string[] =>
  valley.maps[map]?.variants.map((v) => v.variant) ?? [];

/** The .tmj file of one variant of a map (the last variant, or no variant, is the map's own file). */
export function variantFile(map: string, variant: string | null): string {
  const def = mapsData.maps[map];
  if (!def) throw new Error(`Unknown map "${map}"`);
  const list = mapVariants(map);
  if (variant === null || list.length === 0 || variant === list[list.length - 1]) return def.file;
  if (!list.includes(variant)) throw new Error(`Map "${map}" has no variant "${variant}"`);
  return def.file.replace(/\.tmj$/, `@${variant}.tmj`);
}

function lookOf(map: string, stages: MapStageDef[], i: number): MapLook {
  const v = stages[i]!;
  return {
    map,
    variant: v.variant,
    stage: i,
    final: i === stages.length - 1,
    file: variantFile(map, v.variant),
    ...(v.palette ? { palette: v.palette } : {}),
  };
}

/** The stage a map shows for this state: the first variant whose `when` holds, else the last. */
export function valleyStage(state: StatsOnly, map: string): MapLook {
  const stages = valley.maps[map]?.variants;
  if (!stages) {
    const def = mapsData.maps[map];
    return { map, variant: null, stage: 0, final: true, file: def?.file ?? '' };
  }
  const i = stages.findIndex((v) => !v.when || stageWhenHolds(state, v.when));
  return lookOf(map, stages, i < 0 ? stages.length - 1 : i);
}

/** The file and palette for a map (the name WORLD-PLAN 4.1 uses). */
export function mapLook(state: StatsOnly, map: string): { file: string; palette?: string } {
  const l = valleyStage(state, map);
  return { file: l.file, ...(l.palette ? { palette: l.palette } : {}) };
}

/** Every variant of every map (one entry per .tmj file, maps with one look included). */
export function allMapLooks(): MapLook[] {
  const out: MapLook[] = [];
  for (const map of Object.keys(mapsData.maps)) {
    const stages = valley.maps[map]?.variants;
    if (!stages)
      out.push({ map, variant: null, stage: 0, final: true, file: mapsData.maps[map]!.file });
    else stages.forEach((_, i) => out.push(lookOf(map, stages, i)));
  }
  return out;
}

/** The delta rectangles of a map ([x, y, w, h]); empty for a map with one look. */
export const deltaRects = (map: string): readonly Rect[] => valley.maps[map]?.delta ?? [];

export const inRect = (tx: number, ty: number, [x, y, w, h]: Rect): boolean =>
  tx >= x && ty >= y && tx < x + w && ty < y + h;

/** Is this tile inside one of the map's delta rectangles (where tiles change between stages)? */
export const inDelta = (map: string, tx: number, ty: number): boolean =>
  deltaRects(map).some((r) => inRect(tx, ty, r));

/** The refusal for placing or tilling on this tile ("The old creek bed. Best left clear."), or null. */
export const deltaRefusal = (map: string, tx: number, ty: number): string | null =>
  inDelta(map, tx, ty) ? (valley.maps[map]?.deltaText ?? null) : null;

/** The scenario `valley` key's names: `farmGreen` is the first-green stat, anything else a place. */
export const valleyStatKey = (key: string): string =>
  key === 'farmGreen' ? 'valley.farmGreen' : `place.${key}`;

/** Places and stats the stage tables read, as scenario `valley` keys (for validation). */
export function valleyKeys(): string[] {
  const out = new Set<string>(['farmGreen']);
  for (const m of Object.values(valley.maps))
    for (const v of m.variants)
      for (const k of v.when ? whenKeys(v.when) : [])
        if (k.startsWith('place.')) out.add(k.slice(6));
  return [...out];
}

export interface DeltaClearing {
  /** Placed objects moved to free ground nearby. */
  moved: number;
  /** Placed objects that found no free ground and went into the bag. */
  returned: number;
  /** Crops lifted whose seeds (or harvest, when ripe) went into the bag (one that did not fit is lost). */
  crops: number;
  /** One line for the morning summary, or null when nothing was there. */
  note: string | null;
}

const dist2 = (a: [number, number], tx: number, ty: number): number =>
  (a[0] - tx) ** 2 + (a[1] - ty) ** 2;

/**
 * Keep the delta rectangles clear (old saves from before they existed may hold soil, crops, weeds or placed things
 * there). Runs every night (`mechanics/mapStages.ts`), so by the time a stage turns a tile to water nothing stands on
 * it. Soil, weeds and forage there are removed; a crop gives back its seed (its harvest when ripe) if the bag has room;
 * a placed object moves, with its state, to the nearest tile of `free` (open farm ground) that is outside every delta
 * rect and unused, else into the bag (or stays put when the bag is full, to be tried again tomorrow).
 */
export function clearDeltaRegions(
  state: GameState,
  map: string,
  free: readonly [number, number][],
): DeltaClearing {
  const res: DeltaClearing = { moved: 0, returned: 0, crops: 0, note: null };
  if (!deltaRects(map).length) return res;
  const inD = (key: string): boolean => {
    const [x, y] = key.split(',').map(Number) as [number, number];
    return inDelta(map, x, y);
  };
  if (mapsData.maps[map]?.farmland) {
    for (const [key, soil] of Object.entries(state.farm.tiles)) {
      if (!inD(key)) continue;
      if (soil.crop) {
        const def = crops[soil.crop.cropId];
        const ripe = def && soil.crop.stage >= def.stageDays.length;
        const seed = Object.entries(items).find(([, it]) => it.plants === soil.crop!.cropId)?.[0];
        const back = ripe ? def.harvestItem : seed;
        const qty = ripe ? def.harvestQuantity : 1;
        if (back && roomFor(state, back, qty) >= qty) {
          addItem(state, back, qty);
          res.crops++;
        }
      }
      delete state.farm.tiles[key];
    }
    for (const key of Object.keys(state.farm.weeds)) if (inD(key)) delete state.farm.weeds[key];
  }
  const forage = state.forage[map];
  if (forage) for (const key of Object.keys(forage)) if (inD(key)) delete forage[key];
  const list = state.placed[map] ?? [];
  const taken = new Set(list.map((o) => `${o.tx},${o.ty}`));
  const open = free.filter(
    ([x, y]) => !inDelta(map, x, y) && !state.farm.tiles[`${x},${y}`] && !taken.has(`${x},${y}`),
  );
  for (const obj of [...list]) {
    if (!inDelta(map, obj.tx, obj.ty)) continue;
    let best: [number, number] | null = null;
    for (const t of open)
      if (!best || dist2(t, obj.tx, obj.ty) < dist2(best, obj.tx, obj.ty)) best = t;
    if (best) {
      open.splice(open.indexOf(best), 1);
      delete state.farm.weeds[`${best[0]},${best[1]}`];
      if (forage) delete forage[`${best[0]},${best[1]}`];
      obj.tx = best[0];
      obj.ty = best[1];
      res.moved++;
    } else if (roomFor(state, obj.type, 1) >= 1) {
      returnToBag(state, map, obj);
      res.returned++;
    }
  }
  const parts: string[] = [];
  if (res.moved + res.returned) parts.push(t('valley.clearedMoved'));
  if (res.crops) parts.push(t('valley.clearedCrops', { count: res.crops }));
  if (parts.length) res.note = t('valley.cleared', { parts: parts.join(', ') });
  return res;
}

/** Into the bag, keeping a building's state for the next one placed (as picking it up does). */
function returnToBag(state: GameState, map: string, obj: PlacedObject): void {
  const def = placeables[obj.type];
  removePlaced(state, map, obj.id);
  if (def && behaviorOf(def).keepsData && Object.keys(obj.data).length)
    (state.stored[obj.type] ??= []).push({ ...obj.data });
  addItem(state, obj.type, 1);
}

/**
 * Stats that show a map in one stage (the dev menu's stage buttons, `__farm.dev.stage`): every earlier stage's
 * condition made false, this one's made true, starting from `base`. Null when no such stats exist.
 */
export function pinStage(
  map: string,
  variant: string,
  base: Record<string, number> = {},
): Record<string, number> | null {
  const stages = valley.maps[map]?.variants;
  const i = stages?.findIndex((v) => v.variant === variant) ?? -1;
  if (!stages || i < 0) return null;
  const out = { ...base };
  const key = (w: StageWhen) => (w.place !== undefined ? `place.${w.place}` : (w.stat ?? ''));
  const simple = (w: StageWhen | undefined) => !w || (!w.all && !w.any);
  if (stages.every((v) => simple(v.when))) {
    for (const v of stages.slice(0, i)) {
      const w = v.when!;
      if (!stageWhenHolds({ stats: out }, w)) continue;
      out[key(w)] = w.max !== undefined ? w.max + 1 : (w.min ?? 1) - 1;
    }
    const own = stages[i]!.when;
    if (own && !stageWhenHolds({ stats: out }, own))
      out[key(own)] = own.min !== undefined ? own.min : (own.max ?? 0);
    return valleyStage({ stats: out }, map).variant === variant ? out : null;
  }
  // nested conditions: try the values the table's bounds suggest for the stats it reads, fewest changes first
  const keys = [...new Set(stages.flatMap((v) => (v.when ? whenKeys(v.when) : [])))];
  const bounds = (k: string): number[] => {
    const vals = new Set<number>([out[k] ?? 0]);
    const walk = (w: StageWhen): void => {
      if (w.all ?? w.any) return void (w.all ?? w.any)!.forEach(walk);
      if (key(w) !== k) return;
      if (w.min !== undefined) [w.min, w.min - 1].forEach((n) => vals.add(n));
      if (w.max !== undefined) [w.max, w.max + 1].forEach((n) => vals.add(n));
    };
    stages.forEach((v) => v.when && walk(v.when));
    return [...vals].filter((n) => n >= 0);
  };
  let best: Record<string, number> | null = null;
  let bestChanges = Infinity;
  const tryAll = (j: number, cur: Record<string, number>, changes: number): void => {
    if (changes >= bestChanges) return;
    if (j === keys.length) {
      if (valleyStage({ stats: cur }, map).variant === variant) {
        best = { ...cur };
        bestChanges = changes;
      }
      return;
    }
    const k = keys[j]!;
    for (const n of bounds(k))
      tryAll(j + 1, { ...cur, [k]: n }, changes + (n === (out[k] ?? 0) ? 0 : 1));
  };
  tryAll(0, out, 0);
  return best;
}

// ---------------------------------------------------------------------------------------------------------------
/**
 * The Dry Year's valley state (docs/WORLD-PLAN.md): how each map looks for it, and the first green. Pure rules, no
 * Phaser. Everything is a lifetime stat, so none of it needs a save change:
 *
 * - `valley.farmGreen` 1 once the farm has turned green (the morning after 5 goods shipped, day 5 at the earliest);
 * - `valley.greenSeen` 1 once the first-green moment has played (stepping out onto the green farm);
 * - `place.<id>` 0 untouched, 1 asked, 2 funded, 3 restored (the places arrive with M3);
 * - `valley.on` 1 on every save made since the valley existed (old saves get their defaults once, in `sanitize`).
 */
export const FARM_GREEN = 'valley.farmGreen';
export const GREEN_SEEN = 'valley.greenSeen';
export const VALLEY_ON = 'valley.on';
export const placeStat = (id: string): string => `place.${id}`;

/** Does a valley condition hold? No condition always holds. */
export function valleyHolds(state: StatsOnly, when: ValleyWhen | undefined): boolean {
  return !when || stageWhenHolds(state, when);
}

/** Outdoor maps on the dry palette today. While any is, the season's dry tileset stays resident. */
export function dryMaps(state: StatsOnly): string[] {
  return Object.entries(mapsData.maps)
    .filter(([id, m]) => m.outdoor && valleyStage(state, id).palette === 'dry')
    .map(([id]) => id);
}

/** The palette a map's tileset takes today ("dry" while its stage is on the straw palette). */
export const paletteOf = (state: StatsOnly, map: string): 'dry' | null =>
  valleyStage(state, map).palette === 'dry' ? 'dry' : null;

/**
 * The night check for the first green (call before the calendar moves on): with `min` of `stat` reached on the
 * night of day `minDay` or later, the farm wakes green tomorrow. Fires once; true on the night it fires.
 */
export function checkFarmGreen(state: GameState): boolean {
  const rule = valley.farmGreen;
  if ((state.stats[FARM_GREEN] ?? 0) >= 1) return false;
  if ((state.stats[rule.stat] ?? 0) < rule.min || absoluteDay(state) < rule.minDay) return false;
  state.stats[FARM_GREEN] = 1;
  return true;
}

/** The first-green moment plays once, the first time the farmer stands on the green farm. True that once. */
export function takeFirstGreenMoment(state: GameState): boolean {
  if ((state.stats[FARM_GREEN] ?? 0) < 1 || state.stats[GREEN_SEEN]) return false;
  state.stats[GREEN_SEEN] = 1;
  return true;
}

/**
 * Defaults for a save from before the valley (no `valley.on`): a farm that has already shipped `min` goods is
 * green (nobody returns to a dry farm they had already greened) and plays no moment. Saves made since keep their
 * own stats. Mutates and returns `stats` (called from `sanitize`).
 */
export function valleyDefaults(stats: Record<string, number>): Record<string, number> {
  if (stats[VALLEY_ON]) return stats;
  stats[VALLEY_ON] = 1;
  if ((stats[valley.farmGreen.stat] ?? 0) >= valley.farmGreen.min) {
    stats[FARM_GREEN] = Math.max(1, stats[FARM_GREEN] ?? 0);
    stats[GREEN_SEEN] = 1;
  }
  return stats;
}

/** Rosa's title-screen letter is kept in the mailbox (already read) from the morning of `keepDay`. */
export const ROSA_LETTER_STAT = 'mail.rosa_letter';
export function rosaLetterDue(state: GameState): boolean {
  return !state.stats[ROSA_LETTER_STAT] && absoluteDay(state) >= valley.letter.keepDay;
}

// ---------------------------------------------------------------------------------------------------------------
// The restoration pattern (docs/WORLD-PLAN.md 2): ask, gather, work days, opening. Stats only:
//   place.<id>         0 untouched, 1 asked, 2 funded, 3 restored
//   place.<id>.since   absolute day the current step began (a step with no progress for 3 days waits)
//   place.<id>.opened  absolute day it opened
//   site.<id>.work     work days done;  site.<id>.last  absolute day of the last one
//   placesDone         restorations finished (each also counts in projectsDone)

export const PLACE_WAIT_DAYS = 3;
export const placeIds = (): string[] => Object.keys(valley.places);
const def = (id: string): PlaceDef => valley.places[id] as PlaceDef;
const st = (s: GameState, k: string): number => s.stats[k] ?? 0;
export const stageOf = (s: GameState, id: string): number => st(s, placeStat(id));
export const workDone = (s: GameState, id: string): number => st(s, `site.${id}.work`);
/**
 * Places open in the valley today (stage 3), however they got there. Later asks that need "N places open" (the
 * market's three) read this, not `placesDone`: an old save's quietly restored weir counts here, so a returning
 * player is never stuck one place short, but it never counts toward goals or rewards (coordinator ruling).
 */
export const placesOpen = (s: Pick<GameState, 'stats'>): number =>
  placeIds().filter((id) => (s.stats[placeStat(id)] ?? 0) >= 3).length;
const setStage = (s: GameState, id: string, stage: number): void => {
  s.stats[placeStat(id)] = stage;
  s.stats[`place.${id}.since`] = absoluteDay(s);
};

/** Friendship points per heart (systems/friendship.ts POINTS_PER_HEART; not imported, which would be a cycle). */
export const HEART_POINTS = 50;

/**
 * Does a place's ask hold? A stat condition, a villager's hearts (`npc` + `hearts`), an absolute day (`day`, on or
 * after), nested with `all` / `any`.
 */
export function askHolds(s: Pick<GameState, 'stats' | 'friends' | 'time'>, w: AskWhen): boolean {
  if (w.all) return w.all.every((x) => askHolds(s, x));
  if (w.any) return w.any.some((x) => askHolds(s, x));
  if (w.npc !== undefined)
    return Math.floor((s.friends[w.npc]?.points ?? 0) / HEART_POINTS) >= (w.hearts ?? 1);
  if (w.day !== undefined) return absoluteDay(s as GameState) >= w.day;
  return stageWhenHolds(s, w);
}

/** The morning's asks: every untouched place whose `ask` holds is asked for today. Returns their ids. */
export function askPlaces(s: GameState): string[] {
  const out: string[] = [];
  for (const id of placeIds())
    if (stageOf(s, id) === 0 && askHolds(s, def(id).ask)) {
      setStage(s, id, 1);
      out.push(id);
    }
  return out;
}

/** The fund is complete (projects.ts calls this when a `place` project finishes). */
export function markFunded(s: GameState, id: string): void {
  if (valley.places[id] && stageOf(s, id) < 2) setStage(s, id, 2);
}

export type WorkRefusal = 'stage' | 'today' | 'done' | 'energy';

/** Can the farmer do a work day here now? Once a day, after the fund, with the energy for it. */
export function canWork(s: GameState, id: string): WorkRefusal | null {
  const p = def(id);
  if (stageOf(s, id) !== 2) return 'stage';
  if (workDone(s, id) >= p.workDays) return 'done';
  if (st(s, `site.${id}.last`) === absoluteDay(s)) return 'today';
  if (s.energy < p.energy) return 'energy';
  return null;
}

/** One work day (nothing changes on a refusal). Returns the day done (1-based) and its taste, or the refusal. */
export function workAt(
  s: GameState,
  id: string,
): { ok: true; day: number; work: WorkDayDef } | { ok: false; reason: WorkRefusal } {
  const no = canWork(s, id);
  if (no) return { ok: false, reason: no };
  const p = def(id);
  s.energy -= p.energy;
  const day = workDone(s, id) + 1;
  s.stats[`site.${id}.work`] = day;
  s.stats[`site.${id}.last`] = absoluteDay(s);
  s.stats[`place.${id}.since`] = absoluteDay(s);
  const work = p.work[day - 1] ?? p.work[p.work.length - 1]!;
  // what is handed over that day goes in the bag if it fits; else the opening's letter brings it
  if (work.gives && !owns(s, work.gives) && roomFor(s, work.gives, 1) >= 1)
    addItem(s, work.gives, 1);
  return { ok: true, day, work };
}

/**
 * The morning's openings: a place whose last work day was before today is restored (maps change overnight,
 * the villager waits at the site). Counts once in `placesDone` and `projectsDone`. Returns their ids.
 */
export function openPlaces(s: GameState): string[] {
  const out: string[] = [];
  const today = absoluteDay(s);
  for (const id of placeIds()) {
    const p = def(id);
    if (stageOf(s, id) !== 2 || workDone(s, id) < p.workDays) continue;
    if (st(s, `site.${id}.last`) >= today) continue;
    setStage(s, id, 3);
    s.stats[`place.${id}.opened`] = today;
    s.stats['placesDone'] = st(s, 'placesDone') + 1;
    s.stats['projectsDone'] = st(s, 'projectsDone') + 1;
    out.push(id);
  }
  return out;
}

/**
 * The site sprite now: before the work, then one per work day; the last work day's sprite (the water following
 * the first cut) is also the restored look.
 */
export function siteSprite(s: GameState, id: string): string {
  const p = def(id);
  const last = p.sprites.length - 1;
  const i = stageOf(s, id) >= 3 ? last : Math.min(workDone(s, id), last);
  return p.sprites[Math.max(0, i)]!;
}

/** Everything the fund still needs: gold, then goods (what the project sheet would take). */
export function fundLeft(
  s: GameState,
  id: string,
): { gold: number; items: { item: string; qty: number }[] } {
  const key = def(id).project;
  const proj = projects[key];
  if (!proj) return { gold: 0, items: [] };
  const gold = Math.max(0, proj.gold - st(s, `fund.${key}`));
  const left = (proj.items ?? [])
    .map((n) => ({ item: n.item, qty: Math.max(0, n.qty - st(s, `fund.${key}.${n.item}`)) }))
    .filter((n) => n.qty > 0);
  return { gold, items: left };
}

const countOf = (s: GameState, item: string): number =>
  s.inventory.slots.reduce((n, x) => (x && x.item === item ? n + x.qty : n), 0);

/** Do the purse and the bag hold everything the fund still needs? */
export function canFundNow(s: GameState, id: string): boolean {
  const left = fundLeft(s, id);
  return s.money >= left.gold && left.items.every((n) => countOf(s, n.item) >= n.qty);
}

export type SiteAnswer =
  | { kind: 'say'; text: string }
  | { kind: 'fund'; project: string }
  | { kind: 'work'; day: number; of: number; work: WorkDayDef }
  | { kind: 'lines'; npc: string; lines: string[] }
  | { kind: 'upgrade'; project: string };

/** What Interact at a site does: one tap a day (a work day happens on the tap, with no sheet). */
export function interactSite(s: GameState, id: string): SiteAnswer {
  const p = def(id);
  const stage = stageOf(s, id);
  if (stage === 0) return { kind: 'say', text: p.sign };
  if (stage === 1) return { kind: 'fund', project: p.project };
  if (stage === 2) {
    const r = workAt(s, id);
    if (r.ok) return { kind: 'work', day: r.day, of: p.workDays, work: r.work };
    if (r.reason === 'done') return { kind: 'say', text: t('valley.workDone') };
    if (r.reason === 'today') return { kind: 'say', text: t('valley.workToday') };
    return { kind: 'say', text: t('valley.workTired', { n: p.energy }) };
  }
  // the opening morning: the villager's lines, when they wait at the site (Finn waits in the Heron, in town)
  if (st(s, `place.${id}.opened`) === absoluteDay(s) && !p.opening.at)
    return { kind: 'lines', npc: p.npc, lines: p.opening.lines };
  const up = Object.entries(projects).find(([, r]) => r.site === id);
  if (up && !st(s, `project.${up[0]}`)) {
    const after = up[1].after;
    if (after && !st(s, `project.${after}`))
      return {
        kind: 'say',
        text: t('valley.upgradeAfter', {
          phrase: p.phrase,
          name: up[1].name,
          after: projects[after]?.name ?? after,
        }),
      };
    return { kind: 'upgrade', project: up[0] };
  }
  return { kind: 'say', text: p.phrase };
}

/** The valley's line for the HUD (WORLD-PLAN 2, "On the HUD"). */
export interface ValleyStep {
  place: string;
  text: string;
  /** Work days: done so far and the total, for the bar. */
  count?: [number, number];
}

/**
 * A valley step that can be done today and has not waited 3 days, in place order: the ask (its day), ready to
 * fund (purse and bag hold it), a work day not done today, the opening morning. Null: the goal chain shows.
 */
export function valleyStep(s: GameState): ValleyStep | null {
  const today = absoluteDay(s);
  for (const id of placeIds()) {
    const p = def(id);
    const stage = stageOf(s, id);
    const since = st(s, `place.${id}.since`);
    if (stage === 3) {
      if (st(s, `place.${id}.opened`) === today)
        return { place: id, text: t('valley.stepOpen', { name: p.name }) };
      continue;
    }
    if (stage === 0 || today - since >= PLACE_WAIT_DAYS) continue;
    if (stage === 1 && since === today) return { place: id, text: p.asked };
    if (stage === 1 && canFundNow(s, id))
      return { place: id, text: t('valley.stepFund', { name: p.name }) };
    const done = workDone(s, id);
    if (stage === 2 && done < p.workDays && st(s, `site.${id}.last`) !== today)
      return {
        place: id,
        text: t('valley.stepWork', { name: p.name, n: done + 1, of: p.workDays }),
        count: [done, p.workDays],
      };
  }
  return null;
}

/** THE VALLEY in Menu > Goal: one row per asked place and its next step. */
export function valleyRows(s: GameState): { place: string; name: string; next: string }[] {
  const today = absoluteDay(s);
  const out: { place: string; name: string; next: string }[] = [];
  for (const id of placeIds()) {
    const p = def(id);
    const stage = stageOf(s, id);
    if (stage === 0) continue;
    let next: string;
    if (stage === 1) {
      const left = fundLeft(s, id);
      const parts = [
        ...(left.gold > 0 ? [fmtGold(left.gold)] : []),
        ...left.items.map((n) => {
          const name = (items[n.item]?.name ?? n.item).toLowerCase();
          return n.qty === 1 ? name : `${n.qty} ${name}`; // "60 stone, sluice gate"
        }),
      ];
      next = t('valley.rowFund', { parts: parts.join(', ') });
    } else if (stage === 2) {
      const done = workDone(s, id);
      next =
        done >= p.workDays
          ? t('valley.rowOpensTomorrow')
          : st(s, `site.${id}.last`) === today
            ? t('valley.rowWorkedToday', { n: done, of: p.workDays })
            : t('valley.rowWorkDay', { n: done + 1, of: p.workDays });
    } else next = t('valley.rowOpen', { phrase: p.phrase });
    out.push({ place: id, name: p.name, next });
  }
  return out;
}

/** Where the goal arrow points for a place, by map: its site, and the doors toward it on other maps. */
export function placeWhere(id: string): Record<string, [number, number]> {
  const p = def(id);
  return { ...(p.where ?? {}), ...(p.map && p.site ? { [p.map]: p.site } : {}) };
}

/** Until the evening of the opening morning, the place's villager waits beside its site. */
export const SITE_VISIT_UNTIL = 18 * 60;
export function siteVisit(
  s: Pick<GameState, 'stats' | 'time'>,
  npc: string,
  minutes: number,
): { map: string; tx: number; ty: number } | null {
  if (minutes >= SITE_VISIT_UNTIL) return null;
  for (const id of placeIds()) {
    const p = def(id);
    if (p.npc !== npc || !p.map || !p.site || stageOf(s as GameState, id) < 3) continue;
    if (st(s as GameState, `place.${id}.opened`) !== absoluteDay(s as GameState)) continue;
    if (p.opening.at) return { ...p.opening.at };
    return { map: p.map, tx: p.site[0] + 1, ty: p.site[1] }; // beside it, the farmer on the other side
  }
  return null;
}

/** Maps where a villager may wait on an opening morning (beside a site, or the place's `opening.at`). */
export const openingMaps = (npc: string): string[] =>
  Object.values(valley.places)
    .filter((p) => p.npc === npc && p.map)
    .map((p) => p.opening.at?.map ?? p.map!);

/** On a place's opening day, its villager's first opening line (the rest are said at the site). */
export function openingLine(s: GameState, npc: string): string | null {
  for (const id of placeIds()) {
    const p = def(id);
    if (p.npc === npc && stageOf(s, id) >= 3 && st(s, `place.${id}.opened`) === absoluteDay(s))
      return p.opening.lines[0] ?? null;
  }
  return null;
}

/**
 * The first green's morning, before the farmer has stepped out: the dry tileset is held so the straw can dissolve
 * into green around them (critic, M1 review 2; released at the next sleep).
 */
export const revealPending = (s: StatsOnly): boolean =>
  ((s.stats[FARM_GREEN] ?? 0) >= 1 && !s.stats[GREEN_SEEN]) || riverMomentDue(s);

/**
 * The farm creek as the channels see it (systems/channels.ts): it runs in the farm's final stage (the spring
 * restored), and its water is the creek bed, the farm's delta rects.
 */
export function creekSource(s: StatsOnly): {
  running: boolean;
  at: (x: number, y: number) => boolean;
  inDelta: (x: number, y: number) => boolean;
} {
  const running = valleyStage(s, 'farm').final;
  return {
    running,
    at: (x, y) => running && inDelta('farm', x, y),
    inDelta: (x, y) => inDelta('farm', x, y),
  };
}

/** Channel tiles the water reaches each morning: the spring's flow, the higher once the weir is restored. */
export function channelFlow(s: StatsOnly): number {
  const [low, high] = (valley.places['spring'] as PlaceDef | undefined)?.flow ?? [24, 64];
  return (s.stats[placeStat('weir')] ?? 0) >= 3 ? high : low;
}

/** Does the bag hold this item? */
export const owns = (s: GameState, item: string): boolean =>
  s.inventory.slots.some((x) => x?.item === item);

/**
 * The opening morning's scene: the place's villager says the three opening lines one tap at a time in the
 * villager sheet, as a heart event does (friendship.ts `pendingEvent`), and it gives nothing but the moment.
 */
export function openingScene(
  s: GameState,
  npc: string,
): {
  hearts: number;
  id: string;
  title: string;
  lines: string[];
  reward: { gold?: number };
} | null {
  for (const id of placeIds()) {
    const p = def(id);
    if (p.npc !== npc || stageOf(s, id) < 3 || st(s, `place.${id}.opened`) !== absoluteDay(s))
      continue;
    return {
      hearts: 0,
      id: `opening.${id}`,
      title: t('valley.openingTitle', { name: p.name }),
      lines: p.opening.lines,
      reward: {},
    };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// The Weir (M6). The town river is mud and a trickle until `place.weir` is 3.

/**
 * `valley.weirOn` 1 on every save made since the Weir existed (M6). A save without it (made before) keeps the town
 * river it always had: the weir is quietly restored once in `sanitize` (coordinator ruling), with no opening, no
 * moment and no count in `placesDone`/`projectsDone`, so only games started since play the dry town.
 */
export const WEIR_ON = 'valley.weirOn';
export const RIVER_SEEN = 'valley.riverSeen';

/** Old saves keep their river (see WEIR_ON). Mutates and returns `stats` (called from `sanitize`). */
export function weirDefaults(stats: Record<string, number>): Record<string, number> {
  if (stats[WEIR_ON]) return stats;
  stats[WEIR_ON] = 1;
  if ((stats['place.weir'] ?? 0) < 3) {
    stats['place.weir'] = 3;
    stats[RIVER_SEEN] = 1;
  }
  return stats;
}

/** Is the town river back (the weir restored)? */
export const riverBack = (s: StatsOnly): boolean => (s.stats['place.weir'] ?? 0) >= 3;

/**
 * The river's first morning in town: on the first step into town after the weir opens, the dry town (its mud and
 * its straw) is drawn over the river town and cut away. Once (`valley.riverSeen`); the dry tileset is held for it.
 */
export const riverMomentDue = (s: StatsOnly): boolean => riverBack(s) && !s.stats[RIVER_SEEN];
export function takeRiverMoment(state: GameState): boolean {
  if (!riverMomentDue(state)) return false;
  state.stats[RIVER_SEEN] = 1;
  return true;
}

/**
 * A part an asked place's fund still needs and the bag does not hold, sold by this villager (valley.json `parts`:
 * the sluice gate from Orin, until the forge is lit). Null when there is nothing to offer.
 */
export function partOffer(s: GameState, npc: string): { item: string; price: number } | null {
  for (const [item, part] of Object.entries(valley.parts ?? {})) {
    if (part.npc !== npc || owns(s, item)) continue;
    const needed = placeIds().some(
      (id) => stageOf(s, id) === 1 && fundLeft(s, id).items.some((n) => n.item === item),
    );
    if (needed) return { item, price: part.price };
  }
  return null;
}

/** Buy an offered part (nothing changes on a refusal). */
export function buyPart(
  s: GameState,
  npc: string,
): { ok: true; item: string } | { ok: false; reason: 'none' | 'gold' | 'bag' } {
  const offer = partOffer(s, npc);
  if (!offer) return { ok: false, reason: 'none' };
  if (s.money < offer.price) return { ok: false, reason: 'gold' };
  if (roomFor(s, offer.item, 1) < 1) return { ok: false, reason: 'bag' };
  s.money -= offer.price;
  addItem(s, offer.item, 1);
  return { ok: true, item: offer.item };
}

/** The creek's first morning on the farm (the spring restored): its reveal plays once. True that once. */
export const CREEK_SEEN = 'valley.creekSeen';
export const creekMomentDue = (state: GameState): boolean =>
  stageOf(state, 'spring') >= 3 && !state.stats[CREEK_SEEN];
export function takeCreekMoment(state: GameState): boolean {
  if (stageOf(state, 'spring') < 3 || state.stats[CREEK_SEEN]) return false;
  state.stats[CREEK_SEEN] = 1;
  return true;
}
