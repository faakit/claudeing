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
 * Is a plot's "for sale" sign up yet? The cheapest unbought plot always is; a dearer one appears once the
 * player has earned a quarter of its price or holds half of it, so day one is not two 2,000g signs at the door.
 */
export function signVisible(state: GameState, id: string): boolean {
  const p = plots[id];
  if (!p?.sign || ownsPlot(state, id)) return false;
  const forSale = Object.entries(plots).filter(([pid, x]) => x.sign && !ownsPlot(state, pid));
  const cheapest = Math.min(...forSale.map(([, x]) => x.price));
  return (
    p.price <= cheapest || (state.stats['earned'] ?? 0) >= p.price / 4 || state.money >= p.price / 2
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
