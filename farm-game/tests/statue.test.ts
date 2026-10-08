import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { projects } from '../src/data';
import { addItem } from '../src/systems/inventory';
import {
  donateGold,
  donateItems,
  goldGiven,
  isProjectDone,
  isProjectOpen,
  itemNeeds,
  landmarksOn,
  priceOf,
  projectLevel,
} from '../src/systems/projects';
import { perk } from '../src/systems/skills';
import { measureText } from '../src/ui/fontMetrics';
import { GLORY_LINE, repeatSub } from '../src/ui/panels/projectText';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';

/** Everything before the statue is finished (progress lives in stats). */
const lateGame = (): GameState => {
  const s = newState();
  for (const [id, p] of Object.entries(projects)) if (!p.repeat) s.stats[`project.${id}`] = 1;
  return s;
};

/** Fund one level of the statue: its gold, then its goods. */
function level(s: GameState): void {
  s.money += priceOf(s, 'statue');
  for (const n of itemNeeds(s, 'statue')) addItem(s, n.item, n.need - n.given);
  expect(donateGold(s, 'statue', priceOf(s, 'statue')).ok).toBe(true);
  expect(donateItems(s, 'statue')).toMatchObject({ ok: true, finished: true });
}

describe("the Founder's Statue: a repeatable late-game sink", () => {
  it('opens after the Market Road and never closes', () => {
    const s = newState();
    expect(isProjectOpen(s, 'statue')).toBe(false);
    const late = lateGame();
    expect(isProjectOpen(late, 'statue')).toBe(true);
    level(late);
    expect(isProjectDone(late, 'statue')).toBe(true);
    expect(isProjectOpen(late, 'statue')).toBe(true);
    expect(landmarksOn(late, 'town').some((l) => l.id === 'statue')).toBe(true);
  });

  it('each level costs half again as much, and gold and goods start over', () => {
    const s = lateGame();
    const first = priceOf(s, 'statue');
    expect(first).toBe(projects['statue']!.gold);
    level(s);
    expect(projectLevel(s, 'statue')).toBe(1);
    expect(priceOf(s, 'statue')).toBe(Math.round((first * 1.5) / 100) * 100);
    expect(goldGiven(s, 'statue')).toBe(0);
    expect(itemNeeds(s, 'statue').every((n) => n.given === 0)).toBe(true);
  });

  it('its perk stacks for five levels, then a level is for glory only', () => {
    const s = lateGame();
    const base = perk(s, 'sellBonus');
    for (let i = 0; i < 7; i++) level(s);
    expect(projectLevel(s, 'statue')).toBe(7);
    expect(perk(s, 'sellBonus') - base).toBeCloseTo(0.05);
    // "All projects" counts the ones finished once; statue levels are counted on their own.
    expect(s.stats['projectsDone'] ?? 0).toBe(0);
    expect(s.stats['projectLevels']).toBe(7);
  });

  it('is a sink, not an investment: a level pays itself back only after years', () => {
    // Even a tireless year (the sim's ~230k shipped) earns back 1% of it a year: 2,300g against 30,000g.
    const p = projects['statue']!;
    expect(p.gold / (230_000 * (p.perks['sellBonus'] ?? 0))).toBeGreaterThan(10);
  });

  it('its lines fit the sheet', () => {
    expect(measureText(repeatSub(12, 999_999, 9_999_999))).toBeLessThanOrEqual(
      200 - 8 - 28 - 43 - 2,
    );
    expect(measureText(GLORY_LINE)).toBeLessThanOrEqual(184);
  });
});
