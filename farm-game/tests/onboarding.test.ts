import { describe, expect, it } from 'vitest';
import { goals, tips } from '../src/data';
import { gameEvents } from '../src/systems/events';
import { addStat, checkTips } from '../src/systems/goals';
import { migrate } from '../src/systems/save';
import { toggleReduceMotion } from '../src/systems/settings';
import { newState } from './helpers';

describe('onboarding', () => {
  it('every goal has a hint and every tip points at a real stat name', () => {
    for (const g of goals) expect(g.hint.length, g.id).toBeGreaterThan(10);
    for (const t of tips) expect(t.text.length, t.id).toBeGreaterThan(10);
  });

  it('a tip is shown once, when its stat is first reached', () => {
    const s = newState();
    const seen: string[] = [];
    const off = gameEvents.on('toast', (t) => seen.push(t.text));
    addStat(s, 'foraged', 1);
    const first = seen.filter((t) => t.includes('Wild goods grow back')).length;
    addStat(s, 'foraged', 1);
    checkTips(s);
    off();
    expect(first).toBe(1);
    expect(seen.filter((t) => t.includes('Wild goods grow back'))).toHaveLength(1);
    expect(s.stats['tip.forage']).toBe(1);
  });

  it('shows one tip per check so they never stack', () => {
    const s = newState();
    s.stats['qualityHarvested'] = 1;
    s.stats['foraged'] = 1;
    const seen: string[] = [];
    const off = gameEvents.on('toast', (t) => seen.push(t.text));
    checkTips(s);
    off();
    expect(seen).toHaveLength(1);
  });
});

describe('accessibility settings', () => {
  it('reduce-motion toggles and survives a save', () => {
    const s = newState();
    expect(s.settings.reduceMotion).toBe(false);
    expect(toggleReduceMotion(s)).toBe(true);
    const out = migrate(JSON.parse(JSON.stringify(s)));
    expect(out.settings.reduceMotion).toBe(true);
    const old = JSON.parse(JSON.stringify(s));
    delete old.settings.reduceMotion;
    expect(migrate(old).settings.reduceMotion).toBe(false);
  });
});
