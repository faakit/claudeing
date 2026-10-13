import { plots } from '../data';
import type { PlotDef } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents } from './events';
import { addStat } from './goals';
import { isProjectDone } from './projects';

export const plotIds = (): string[] => Object.keys(plots);
export const starterPlots = (): string[] =>
  plotIds().filter((id) => (plots[id] as PlotDef).price === 0 && !(plots[id] as PlotDef).project);

/** The plot that covers a farm tile, if any. */
export function plotAtTile(tx: number, ty: number): string | null {
  for (const [id, p] of Object.entries(plots)) {
    const [x, y, w, h] = p.rect;
    if (tx >= x && tx < x + w && ty >= y && ty < y + h) return id;
  }
  return null;
}

/** Bought plots, plus plots that come with a finished town project (the greenhouse). */
export const ownsPlot = (state: GameState, id: string): boolean => {
  const project = plots[id]?.project;
  return state.plots.includes(id) || (!!project && isProjectDone(state, project));
};

/** Does the player own a greenhouse? Then the shop sells every season's seeds. */
export const ownsGreenhouse = (state: GameState): boolean =>
  plotIds().some((id) => plots[id]?.greenhouse === true && ownsPlot(state, id));

/** Is this farm tile inside a greenhouse the player owns? Crops there ignore the season. */
export function inGreenhouse(state: GameState, tx: number, ty: number): boolean {
  const id = plotAtTile(tx, ty);
  return id !== null && plots[id]?.greenhouse === true && ownsPlot(state, id);
}

/** May the player till here? Only inside plots they own. */
export function ownsTile(state: GameState, tx: number, ty: number): boolean {
  const id = plotAtTile(tx, ty);
  return id !== null && ownsPlot(state, id);
}

/**
 * The connected piece of owned farmland each farm tile belongs to (critic ruling C3-1, QA round): owned tiles that
 * `usable` allows (the world passes "tillable"), flood-filled 4 ways across plot borders, so the Home Plot and a
 * bought West Field beside it are one field. Returns a reader giving a region's id per tile (null off owned land);
 * regions are found lazily and remembered, so read it fresh for each press. A painted path stays inside the region
 * of its first tile (`ActionPress`, input/gesture.ts).
 */
export function ownedRegions(
  state: GameState,
  usable: (tx: number, ty: number) => boolean = () => true,
): (tx: number, ty: number) => string | null {
  const region = new Map<string, string>();
  const ok = (tx: number, ty: number) => ownsTile(state, tx, ty) && usable(tx, ty);
  return (tx, ty) => {
    const key = `${tx},${ty}`;
    const known = region.get(key);
    if (known !== undefined) return known;
    if (!ok(tx, ty)) return null;
    const id = `field@${key}`;
    region.set(key, id);
    const todo: [number, number][] = [[tx, ty]];
    for (let next = todo.pop(); next; next = todo.pop()) {
      const [x, y] = next;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        const k = `${nx},${ny}`;
        if (region.has(k) || !ok(nx, ny)) continue;
        region.set(k, id);
        todo.push([nx, ny]);
      }
    }
    return id;
  };
}

/**
 * Is a plot's "for sale" sign up yet? The cheapest unbought plot always is; a dearer one appears once the
 * player has earned half its price or holds half of it, so day one is not two 2,000g signs at the door.
 */
export function signVisible(state: GameState, id: string): boolean {
  const p = plots[id];
  if (!p?.sign || ownsPlot(state, id)) return false;
  const forSale = Object.entries(plots).filter(([pid, x]) => x.sign && !ownsPlot(state, pid));
  const cheapest = Math.min(...forSale.map(([, x]) => x.price));
  return (
    p.price <= cheapest || (state.stats['earned'] ?? 0) >= p.price / 2 || state.money >= p.price / 2
  );
}

/** The plot whose "for sale" sign stands on this tile, if it is up. */
export function plotForSaleAt(state: GameState, tx: number, ty: number): string | null {
  for (const [id, p] of Object.entries(plots))
    if (p.sign && p.sign[0] === tx && p.sign[1] === ty && signVisible(state, id)) return id;
  return null;
}

/** Signs that should be drawn and block movement: those that are up. */
export const signTiles = (state: GameState): [number, number][] =>
  Object.entries(plots)
    .filter(([id]) => signVisible(state, id))
    .map(([, p]) => p.sign as [number, number]);

export const plotSize = (id: string): number => {
  const [, , w, h] = (plots[id] as PlotDef).rect;
  return w * h;
};

export type BuyPlotResult = 'ok' | 'no_money' | 'owned' | 'unknown';

export function buyPlot(state: GameState, id: string): BuyPlotResult {
  const p = plots[id];
  if (!p || p.project) return 'unknown'; // project plots are built, not bought
  if (ownsPlot(state, id)) return 'owned';
  if (state.money < p.price) return 'no_money';
  state.money -= p.price;
  state.plots.push(id);
  gameEvents.emit('moneyChanged', { delta: -p.price });
  gameEvents.emit('placedChanged', { map: 'farm' });
  addStat(state, 'plotsBought');
  return 'ok';
}
