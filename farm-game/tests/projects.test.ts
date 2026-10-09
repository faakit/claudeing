import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { goals, orders as ordersCfg, projects } from '../src/data';
import { endDay } from '../src/systems/day';
import { maxEnergy } from '../src/systems/energy';
import { addItem, countItem } from '../src/systems/inventory';
import { generateOrders } from '../src/systems/orders';
import {
  canGiveItems,
  donateGold,
  donateItems,
  goldGiven,
  isProjectDone,
  isProjectOpen,
  landmarkAt,
  landmarksOn,
  nextLocked,
  projectPerk,
  projectProgress,
  visibleProjects,
} from '../src/systems/projects';
import { addXp, perk, xpOf } from '../src/systems/skills';
import { migrate } from '../src/systems/save';
import { measureText } from '../src/ui/fontMetrics';
import { PROJECTS_INTRO, projectSub } from '../src/ui/panels/projectText';
import { newState } from './helpers';
import type { GameState } from '../src/state/GameState';

/** Give a project everything it needs, as a player would: gold first, then goods. */
function finish(s: GameState, id: string): void {
  const p = projects[id]!;
  s.money += p.gold;
  for (const n of p.items ?? []) addItem(s, n.item, n.qty);
  expect(donateGold(s, id, p.gold).ok).toBe(true);
  if (p.items?.length) expect(donateItems(s, id)).toMatchObject({ ok: true, finished: true });
  expect(isProjectDone(s, id)).toBe(true);
}

describe('town projects', () => {
  it('only first projects are open on a new game; later ones wait for theirs', () => {
    const s = newState();
    expect(isProjectOpen(s, 'canopy')).toBe(true);
    expect(isProjectOpen(s, 'library')).toBe(false);
    expect(visibleProjects(s)).toEqual(['canopy']);
    expect(nextLocked(s)).toMatchObject({ after: 'canopy' });
  });

  it('gold is given in steps, never more than needed, and refused when you are short', () => {
    const s = newState();
    s.money = 1000;
    expect(donateGold(s, 'canopy', 100)).toEqual({ ok: true, given: 100, finished: false });
    expect(s.money).toBe(900);
    expect(goldGiven(s, 'canopy')).toBe(100);
    expect(donateGold(s, 'canopy', 10000)).toEqual({ ok: false, reason: 'no_money' });
    expect(s.money).toBe(900); // nothing changed on refusal
    s.money = 5000;
    expect(donateGold(s, 'canopy', 10000)).toMatchObject({ ok: true, given: 1100 });
    expect(s.money).toBe(3900);
    expect(donateGold(s, 'canopy', 100)).toEqual({ ok: false, reason: 'nothing' });
    expect(isProjectDone(s, 'canopy')).toBe(false); // the fiber is still missing
    expect(projectProgress(s, 'canopy')).toBeCloseTo(0.5);
  });

  it('goods are handed over from the bag, and the last one finishes the project', () => {
    const s = newState();
    s.money = 1200;
    donateGold(s, 'canopy', 1200);
    expect(canGiveItems(s, 'canopy')).toBe(false);
    expect(donateItems(s, 'canopy')).toEqual({ ok: false, reason: 'nothing' });
    addItem(s, 'fiber', 12);
    expect(donateItems(s, 'canopy')).toEqual({ ok: true, given: 12, finished: false });
    expect(countItem(s, 'fiber')).toBe(0);
    addItem(s, 'fiber', 30);
    expect(donateItems(s, 'canopy')).toEqual({ ok: true, given: 8, finished: true });
    expect(countItem(s, 'fiber')).toBe(22); // only what was still needed
    expect(isProjectDone(s, 'canopy')).toBe(true);
    expect(s.stats['projectsDone']).toBe(1);
    expect(donateGold(s, 'canopy', 100)).toEqual({ ok: false, reason: 'closed' });
    expect(isProjectOpen(s, 'library')).toBe(true);
    expect(isProjectOpen(s, 'fishladder')).toBe(true);
  });

  it('finished projects grant their perks through perk()', () => {
    const s = newState();
    expect(perk(s, 'orderSlots')).toBe(0);
    finish(s, 'canopy');
    expect(projectPerk(s, 'orderSlots')).toBe(1);
    expect(perk(s, 'orderSlots')).toBe(1);
    expect(generateOrders(s)).toHaveLength(ordersCfg.perDay + 1);
  });

  it('the library speeds up XP and the hot spring adds energy', () => {
    const s = newState();
    finish(s, 'canopy');
    finish(s, 'library');
    addXp(s, 'farming', 100);
    expect(xpOf(s, 'farming')).toBe(115);
    const before = maxEnergy(s);
    finish(s, 'bathhouse');
    expect(maxEnergy(s)).toBe(before + 30);
  });

  it('a finished project raises a landmark in town', () => {
    const s = newState();
    expect(landmarksOn(s, 'town')).toEqual([]);
    finish(s, 'canopy');
    const l = projects['canopy']!.landmark!;
    expect(landmarkAt(s, 'town', l.tx, l.ty)).toBe('canopy');
    expect(landmarksOn(s, 'farm')).toEqual([]);
  });

  it('the morning summary says when you could finish a project today', () => {
    const s = newState();
    s.money = 5000;
    addItem(s, 'fiber', 20);
    const sum = endDay(s, { passedOut: false, weedCandidates: [] });
    expect(sum.notes?.some((n) => n.includes('Board Canopy'))).toBe(true);
  });

  it('progress survives a save and a load (it lives in stats)', () => {
    const s = newState();
    s.money = 500;
    donateGold(s, 'canopy', 300);
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(goldGiven(back, 'canopy')).toBe(300);
  });

  it('project text fits the sheet', () => {
    expect(measureText(PROJECTS_INTRO)).toBeLessThanOrEqual(184);
    for (const p of Object.values(projects)) {
      expect(measureText(p.name), p.name).toBeLessThanOrEqual(120);
      expect(measureText(`When done: ${p.reward}`), p.name).toBeLessThanOrEqual(184 * 2);
      expect(measureText(p.blurb), p.name).toBeLessThanOrEqual(184 * 2);
      expect(measureText(projectSub(p.gold, p.gold, false, p.perks))).toBeLessThanOrEqual(150);
      const done = projectSub(p.gold, p.gold, true, p.perks);
      expect(measureText(done), done).toBeLessThanOrEqual(184 - 28);
    }
  });

  it('every project chain can be finished, and all of them together are a real late sink', () => {
    const s = newState();
    for (let round = 0; round < 10; round++)
      for (const id of Object.keys(projects))
        if (isProjectOpen(s, id) && !isProjectDone(s, id)) finish(s, id);
    expect(Object.keys(projects).every((id) => isProjectDone(s, id))).toBe(true);
    const once = Object.entries(projects).filter(([, p]) => !p.repeat);
    const total = once.reduce((n, [, p]) => n + p.gold, 0);
    expect(total).toBeGreaterThan(80000);
    // "All projects" means the ones you finish once; the repeatable statue never counts.
    expect(goals.find((g) => g.id === 'projectAll')?.target).toBe(once.length);
    expect(s.stats['projectsDone']).toBe(once.length);
  });
});

describe('save migration v7 -> v8', () => {
  it('keeps a saved goal index on the same goal after new goals were inserted', () => {
    const v7 = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    v7['version'] = 7;
    v7['goalIndex'] = 23; // "jars" in the v7 chain, which now comes after the project goal
    const s = migrate(v7);
    expect(goals[s.goalIndex]?.id).toBe('jars');
    v7['goalIndex'] = 39; // every v7 goal done: continue with the first goal added after them
    expect(goals[migrate(v7).goalIndex]?.id).toBe('projectAll');
    v7['goalIndex'] = 0; // "till": since v17 (the guided start) a save on it moves to "plant"
    expect(goals[migrate(v7).goalIndex]?.id).toBe('plant');
  });
});
