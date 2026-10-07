import { describe, expect, it, vi } from 'vitest';
import { recipes, skills } from '../src/data';
import { gameEvents } from '../src/systems/events';
import {
  addXp,
  isRecipeUnlocked,
  levelOf,
  levelProgress,
  maxLevel,
  perk,
  unlockedRecipes,
  xpOf,
} from '../src/systems/skills';
import { maxEnergy } from '../src/systems/energy';
import { newState } from './helpers';

describe('skills', () => {
  it('start at level 1 with no XP', () => {
    const s = newState();
    expect(levelOf(s, 'farming')).toBe(1);
    expect(xpOf(s, 'farming')).toBe(0);
  });

  it('levels follow the XP table exactly at each threshold', () => {
    const s = newState();
    const table = skills['farming']!.xpTable;
    for (let i = 1; i < table.length; i++) {
      s.skills['farming'] = (table[i] as number) - 1;
      expect(levelOf(s, 'farming')).toBe(i);
      s.skills['farming'] = table[i] as number;
      expect(levelOf(s, 'farming')).toBe(i + 1);
    }
    s.skills['farming'] = 10_000_000;
    expect(levelOf(s, 'farming')).toBe(maxLevel('farming'));
    expect(levelProgress(s, 'farming')).toBeNull();
  });

  it('reports progress into the current level', () => {
    const s = newState();
    s.skills['farming'] = 100; // level 2 starts at 60, level 3 at 150
    expect(levelProgress(s, 'farming')).toEqual({ have: 40, need: 90 });
  });

  it('addXp emits one levelUp per level crossed, even for a big jump', () => {
    const s = newState();
    const seen: number[] = [];
    const off = gameEvents.on('levelUp', (e) => e.skill === 'farming' && seen.push(e.level));
    addXp(s, 'farming', 300); // crosses levels 2, 3 and 4 (thresholds 60, 150, 280)
    off();
    expect(seen).toEqual([2, 3, 4]);
    expect(s.stats['level.farming']).toBe(4);
  });

  it('ignores unknown skills and non-positive XP', () => {
    const s = newState();
    const fn = vi.fn();
    const off = gameEvents.on('levelUp', fn);
    addXp(s, 'basketweaving', 100);
    addXp(s, 'farming', 0);
    addXp(s, 'farming', -5);
    off();
    expect(s.skills).toEqual({});
    expect(fn).not.toHaveBeenCalled();
  });

  it('perks sum across every level reached and across skills', () => {
    const s = newState();
    expect(perk(s, 'qualityBonus')).toBe(0);
    s.skills['farming'] = skills['farming']!.xpTable[3]!; // level 4: +0.03 at 2, +0.04 at 4
    expect(perk(s, 'qualityBonus')).toBeCloseTo(0.07);
    s.skills['foraging'] = skills['foraging']!.xpTable[4]!; // level 5: +5 energy
    s.skills['farming'] = skills['farming']!.xpTable[4]!; // level 5: +5 +5 energy
    expect(perk(s, 'maxEnergy')).toBe(15); // farming levels 3 and 5, foraging level 5
    expect(maxEnergy(s)).toBe(100 + 15);
  });

  it('unknown perk keys are simply zero (mechanics can add perks in data alone)', () => {
    expect(perk(newState(), 'telepathy')).toBe(0);
  });

  it('recipes unlock at the skill levels data asks for', () => {
    const s = newState();
    expect(unlockedRecipes(s)).toEqual(expect.arrayContaining(['fertilizer', 'bait']));
    expect(unlockedRecipes(s)).not.toContain('sprinkler');
    s.skills['farming'] = skills['farming']!.xpTable[1]!;
    expect(isRecipeUnlocked(s, recipes['sprinkler']!)).toBe(true);
    expect(isRecipeUnlocked(s, recipes['quality_sprinkler']!)).toBe(false);
  });

  it('every skill perk level is reachable and the tables are sane', () => {
    for (const [id, sk] of Object.entries(skills)) {
      expect(sk.xpTable.length, id).toBeGreaterThanOrEqual(5);
      for (const lvl of Object.keys(sk.perks))
        expect(Number(lvl)).toBeLessThanOrEqual(sk.xpTable.length);
    }
  });
});
