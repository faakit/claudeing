import { placeables } from '../data';
import type { PlaceableDef } from '../data';
import type { GameState, PlacedObject } from '../state/GameState';
import type { DayContext } from './dayHooks';
import { gameEvents } from './events';

/** What the UI should do when the player interacts with a placed object. */
export type InteractResult =
  | { kind: 'none' }
  | { kind: 'message'; text: string }
  /** Open the sheet registered under `panel` for this object. */
  | { kind: 'panel'; panel: string; id: number }
  /** Pick the object back up into the inventory. */
  | { kind: 'pickup' };

/**
 * The code half of a placeable. Every hook is optional; a behavior implements only what it needs.
 * Register with `registerPlaceableBehavior` and reference it from placeables.json by name.
 */
export interface PlaceableBehavior {
  /** Runs in the 'pre-growth' phase of the day rollover (e.g. sprinklers water soil). */
  beforeGrowth?: (state: GameState, obj: PlacedObject, def: PlaceableDef, ctx: DayContext) => void;
  /** Runs in the 'morning' phase (e.g. a jar finishes working). */
  onMorning?: (state: GameState, obj: PlacedObject, def: PlaceableDef, ctx: DayContext) => void;
  /** What happens on Interact. Default: pick it up. */
  interact?: (state: GameState, obj: PlacedObject, def: PlaceableDef) => InteractResult;
  /** May this object be picked up right now? (A working jar may not.) */
  canPickUp?: (obj: PlacedObject) => boolean;
  /** How the world should draw it: nothing going on, working, or goods ready to collect. */
  status?: (obj: PlacedObject) => 'idle' | 'busy' | 'ready';
  /** Texture to draw for this object right now (e.g. a sapling before it is a tree). Default: the placeable's sprite. */
  sprite?: (obj: PlacedObject, def: PlaceableDef) => string;
}

const behaviors = new Map<string, PlaceableBehavior>();

export function registerPlaceableBehavior(name: string, behavior: PlaceableBehavior): void {
  behaviors.set(name, behavior);
}

export const behaviorOf = (def: PlaceableDef): PlaceableBehavior =>
  behaviors.get(def.behavior) ?? {};

export const hasBehavior = (name: string): boolean => behaviors.has(name);

export const placeableDef = (type: string): PlaceableDef | undefined => placeables[type];

export const objectsOn = (state: GameState, map: string): PlacedObject[] => state.placed[map] ?? [];

export function placedAt(
  state: GameState,
  map: string,
  tx: number,
  ty: number,
): PlacedObject | undefined {
  return objectsOn(state, map).find((o) => o.tx === tx && o.ty === ty);
}

export function placeObject(
  state: GameState,
  map: string,
  tx: number,
  ty: number,
  type: string,
): PlacedObject {
  if (!placeables[type]) throw new Error(`Unknown placeable "${type}"`);
  const obj: PlacedObject = { id: state.nextPlacedId++, type, tx, ty, data: {} };
  (state.placed[map] ??= []).push(obj);
  gameEvents.emit('placedChanged', { map });
  return obj;
}

export function removePlaced(state: GameState, map: string, id: number): PlacedObject | null {
  const list = state.placed[map];
  const i = list?.findIndex((o) => o.id === id) ?? -1;
  if (!list || i < 0) return null;
  const [obj] = list.splice(i, 1);
  if (list.length === 0) delete state.placed[map];
  gameEvents.emit('placedChanged', { map });
  return obj ?? null;
}

export function findPlaced(
  state: GameState,
  id: number,
): { map: string; obj: PlacedObject } | null {
  for (const [map, list] of Object.entries(state.placed)) {
    const obj = list.find((o) => o.id === id);
    if (obj) return { map, obj };
  }
  return null;
}

/** Tiles blocked by solid placeables on a map (the world scene adds them to its collision grid). */
export function solidTiles(state: GameState, map: string): [number, number][] {
  return objectsOn(state, map)
    .filter((o) => placeables[o.type]?.solid)
    .map((o) => [o.tx, o.ty] as [number, number]);
}

/** Run an interaction through the object's behavior (default: pick up). */
export function interactWith(state: GameState, obj: PlacedObject): InteractResult {
  const def = placeables[obj.type];
  if (!def) return { kind: 'none' };
  const b = behaviorOf(def);
  if (!b.interact) return { kind: 'pickup' };
  const res = b.interact(state, obj, def);
  // Machines, trees and houses have their own interactions, so picking one up is a deliberate second tap
  // on a plain status message (never after something happened, and never while it is busy).
  if (res.kind === 'message' && res.text !== '' && canPickUp(obj)) {
    if (obj.data['armedPick'] === true) {
      delete obj.data['armedPick'];
      return { kind: 'pickup' };
    }
    obj.data['armedPick'] = true;
    return { ...res, text: `${res.text} Tap again to pick up.` };
  }
  delete obj.data['armedPick'];
  return res;
}

export function statusOf(obj: PlacedObject): 'idle' | 'busy' | 'ready' {
  const def = placeables[obj.type];
  return def ? (behaviorOf(def).status?.(obj) ?? 'idle') : 'idle';
}

export function spriteOf(obj: PlacedObject): string {
  const def = placeables[obj.type];
  if (!def) return 'ui_coin';
  return behaviorOf(def).sprite?.(obj, def) ?? def.sprite;
}

export function canPickUp(obj: PlacedObject): boolean {
  const def = placeables[obj.type];
  return def ? (behaviorOf(def).canPickUp?.(obj) ?? true) : true;
}

/** Visit every placed object, handing each its definition and behavior. */
export function forEachPlaced(
  state: GameState,
  fn: (obj: PlacedObject, def: PlaceableDef, behavior: PlaceableBehavior, map: string) => void,
): void {
  for (const [map, list] of Object.entries(state.placed)) {
    for (const obj of [...list]) {
      const def = placeables[obj.type];
      if (def) fn(obj, def, behaviorOf(def), map);
    }
  }
}
