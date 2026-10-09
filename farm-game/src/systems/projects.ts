import { items, projects } from '../data';
import type { ProjectDef } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents, toast } from './events';
import { addStat } from './goals';
import { countItem, removeItem } from './inventory';

/**
 * Town projects: big shared goals the player funds with gold and goods, a little at a time. Finishing one
 * grants its perks for good (summed into `perk()` by mechanics/projects.ts) and puts a landmark in town.
 *
 * No new state: progress is kept in stats (the stats-as-state trick), so it saves with everything else.
 *  - `fund.<id>`          gold given so far
 *  - `fund.<id>.<item>`   goods given so far
 *  - `project.<id>`       1 once finished
 *  - `project.<id>.level` times a repeatable project was finished (gold and goods restart each level)
 */
const goldKey = (id: string): string => `fund.${id}`;
const itemKey = (id: string, item: string): string => `fund.${id}.${item}`;
const doneKey = (id: string): string => `project.${id}`;
const levelKey = (id: string): string => `project.${id}.level`;

/** How many times a project was finished: 0 or 1, or any number for a repeatable one. */
export const projectLevel = (state: GameState, id: string): number =>
  projects[id]?.repeat
    ? Math.max(0, Math.floor(state.stats[levelKey(id)] ?? 0))
    : state.stats[doneKey(id)] === 1
      ? 1
      : 0;

/** Gold the project asks for now: a repeatable one costs `growth` times more each level. */
export function priceOf(state: GameState, id: string): number {
  const p = projects[id];
  if (!p) return 0;
  if (!p.repeat) return p.gold;
  return Math.round((p.gold * p.repeat.growth ** projectLevel(state, id)) / 100) * 100;
}

export const projectIds = (): string[] => Object.keys(projects);

export const isProjectDone = (state: GameState, id: string): boolean =>
  state.stats[doneKey(id)] === 1;

/** Open for funding: not finished (a repeatable one never closes), and whatever it comes after is finished. */
export function isProjectOpen(state: GameState, id: string): boolean {
  const p = projects[id];
  if (!p || (isProjectDone(state, id) && !p.repeat)) return false;
  return p.after === undefined || isProjectDone(state, p.after);
}

export const goldGiven = (state: GameState, id: string): number =>
  Math.min(priceOf(state, id), state.stats[goldKey(id)] ?? 0);

export interface ItemNeed {
  item: string;
  need: number;
  given: number;
}

export function itemNeeds(state: GameState, id: string): ItemNeed[] {
  return (projects[id]?.items ?? []).map((n) => ({
    item: n.item,
    need: n.qty,
    given: Math.min(n.qty, state.stats[itemKey(id, n.item)] ?? 0),
  }));
}

/** How far along a project is, 0..1, counting gold and goods by their share of the price. */
export function projectProgress(state: GameState, id: string): number {
  const p = projects[id];
  if (!p) return 0;
  if (isProjectDone(state, id) && !p.repeat) return 1;
  const needs = itemNeeds(state, id);
  const parts = 1 + needs.length;
  const items = needs.reduce((n, x) => n + x.given / x.need, 0);
  return (goldGiven(state, id) / priceOf(state, id) + items) / parts;
}

/** Projects the player can see on the board: finished ones and open ones, in data order. */
export const visibleProjects = (state: GameState): string[] =>
  projectIds().filter((id) => isProjectDone(state, id) || isProjectOpen(state, id));

/** The project that a locked one waits for, so the board can say "after the Library". */
export const nextLocked = (state: GameState): { id: string; after: string } | null => {
  for (const id of projectIds()) {
    const after = projects[id]?.after;
    if (after && !isProjectDone(state, id) && !isProjectOpen(state, id)) return { id, after };
  }
  return null;
};

export type FundResult =
  | { ok: true; given: number; finished: boolean }
  | { ok: false; reason: 'unknown' | 'closed' | 'no_money' | 'nothing' };

/**
 * Finish the project if every coin and good is in. Grants it once: perks, landmark, stats. A repeatable
 * project instead goes up a level and starts collecting again (it never counts toward "all projects").
 */
function tryFinish(state: GameState, id: string): boolean {
  const p = projects[id] as ProjectDef;
  if ((isProjectDone(state, id) && !p.repeat) || goldGiven(state, id) < priceOf(state, id))
    return false;
  if (itemNeeds(state, id).some((n) => n.given < n.need)) return false;
  const first = !isProjectDone(state, id);
  state.stats[doneKey(id)] = 1;
  if (p.repeat) {
    const level = projectLevel(state, id) + 1;
    state.stats[levelKey(id)] = level;
    delete state.stats[goldKey(id)];
    for (const n of p.items ?? []) delete state.stats[itemKey(id, n.item)];
    addStat(state, 'projectLevels');
    toast(`${p.name}: level ${level}! ${p.reward}`, 'good');
  } else toast(`${p.name} is finished! ${p.reward}`, 'good');
  if (p.landmark && first) gameEvents.emit('placedChanged', { map: p.landmark.map });
  if (!p.repeat) addStat(state, 'projectsDone');
  return true;
}

/** Give up to `amount` gold (never more than the project still needs). */
export function donateGold(state: GameState, id: string, amount: number): FundResult {
  const p = projects[id];
  if (!p) return { ok: false, reason: 'unknown' };
  if (!isProjectOpen(state, id)) return { ok: false, reason: 'closed' };
  const give = Math.min(Math.floor(amount), priceOf(state, id) - goldGiven(state, id));
  if (give <= 0) return { ok: false, reason: 'nothing' };
  if (state.money < give) return { ok: false, reason: 'no_money' };
  state.money -= give;
  state.stats[goldKey(id)] = goldGiven(state, id) + give;
  gameEvents.emit('moneyChanged', { delta: -give });
  addStat(state, 'donated', give);
  return { ok: true, given: give, finished: tryFinish(state, id) };
}

/** Hand over every good the project still needs that you carry (lowest quality first). */
export function donateItems(state: GameState, id: string): FundResult {
  if (!projects[id]) return { ok: false, reason: 'unknown' };
  if (!isProjectOpen(state, id)) return { ok: false, reason: 'closed' };
  let given = 0;
  for (const n of itemNeeds(state, id)) {
    const take = Math.min(n.need - n.given, countItem(state, n.item));
    if (take <= 0 || !removeItem(state, n.item, take)) continue;
    state.stats[itemKey(id, n.item)] = n.given + take;
    given += take;
  }
  if (given === 0) return { ok: false, reason: 'nothing' };
  return { ok: true, given, finished: tryFinish(state, id) };
}

/** Could `donateItems` give anything right now? */
export const canGiveItems = (state: GameState, id: string): boolean =>
  isProjectOpen(state, id) &&
  itemNeeds(state, id).some((n) => n.given < n.need && countItem(state, n.item) > 0);

/**
 * Sum of a perk over finished projects (a repeatable one counts each level, up to its `perkLevels`).
 * Registered as a perk source by mechanics/projects.ts.
 */
export function projectPerk(state: GameState, key: string): number {
  let total = 0;
  for (const [id, p] of Object.entries(projects)) {
    const levels = Math.min(projectLevel(state, id), p.repeat?.perkLevels ?? 1);
    total += (p.perks[key] ?? 0) * levels;
  }
  return total;
}

/** Landmarks standing on a map (finished projects only). */
export function landmarksOn(
  state: GameState,
  map: string,
): { id: string; tx: number; ty: number; sprite: string; color: string }[] {
  const out: { id: string; tx: number; ty: number; sprite: string; color: string }[] = [];
  for (const [id, p] of Object.entries(projects))
    if (p.landmark?.map === map && isProjectDone(state, id)) out.push({ id, ...p.landmark });
  return out;
}

export const landmarkAt = (state: GameState, map: string, tx: number, ty: number): string | null =>
  landmarksOn(state, map).find((l) => l.tx === tx && l.ty === ty)?.id ?? null;

/** "2 Copper Bar" style line for a need, with what the player carries. */
export const needLabel = (state: GameState, n: ItemNeed): string =>
  `${items[n.item]?.name ?? n.item} ${n.given}/${n.need} (have ${countItem(state, n.item)})`;
