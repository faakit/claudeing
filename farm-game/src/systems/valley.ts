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
  type MapStageDef,
  type StageWhen,
  type ValleyWhen,
} from '../data';
import type { GameState, PlacedObject } from '../state/GameState';
import { absoluteDay } from './time';
import { addItem, roomFor } from './inventory';
import { behaviorOf, removePlaced } from './placeables';

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

/** Does a stage condition hold? `place: "spring"` reads the stat `place.spring`; a missing stat is 0. */
export function stageWhenHolds(state: StatsOnly, when: StageWhen): boolean {
  const key = when.place !== undefined ? `place.${when.place}` : (when.stat ?? '');
  const v = state.stats[key] ?? 0;
  return (when.min === undefined || v >= when.min) && (when.max === undefined || v <= when.max);
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
    for (const v of m.variants) if (v.when?.place) out.add(v.when.place);
  return [...out];
}

export interface DeltaClearing {
  /** Placed objects moved to free ground nearby. */
  moved: number;
  /** Placed objects that found no free ground and went into the bag. */
  returned: number;
  /** Crops lifted: their seeds (or the harvest, when ripe) went into the bag. */
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
        if (back && roomFor(state, back, qty) >= qty) addItem(state, back, qty);
        res.crops++;
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
  if (res.moved + res.returned) parts.push('your things moved to the bank');
  if (res.crops)
    parts.push(res.crops === 1 ? 'a crop came back to your bag' : 'crops came back to your bag');
  if (parts.length) res.note = `The old creek bed was cleared: ${parts.join(', ')}.`;
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
