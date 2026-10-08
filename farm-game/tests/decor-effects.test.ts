import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { game, mail } from '../src/data';
import { performAction } from '../src/systems/actions';
import { crowVisit, guarded, unguardedCrops } from '../src/systems/crows';
import { endDay } from '../src/systems/day';
import { maxEnergy } from '../src/systems/energy';
import { addItem } from '../src/systems/inventory';
import { interactWith, placeObject } from '../src/systems/placeables';
import type { GameState } from '../src/state/GameState';
import { equip, grass, newState } from './helpers';

/** A field of `n` parsnips in a row on the home plot and around it, from day 10. */
function field(n: number): GameState {
  const s = newState();
  s.time.day = 10;
  s.weather = 'sunny';
  for (let i = 0; i < n; i++)
    s.farm.tiles[`${9 + (i % 4)},${16 + Math.floor(i / 4)}`] = {
      watered: false,
      crop: { cropId: 'parsnip', stage: 1, daysInStage: 0, regrow: false },
    };
  return s;
}

describe('decorations with a small use (owner: mostly cosmetic)', () => {
  it('crows: only after the first week, on dry days, on a big unwatched field', () => {
    const cfg = game.crows!;
    const big = field(cfg.minCrops);
    let ate = 0;
    for (let i = 0; i < 200; i++) {
      const s = structuredClone(big);
      s.rng = i + 1;
      if (crowVisit(s)) ate += 1;
    }
    expect(ate / 200).toBeGreaterThan(cfg.chance * 0.6);
    expect(ate / 200).toBeLessThan(cfg.chance * 1.4);
    const small = field(cfg.minCrops - 1);
    for (let i = 0; i < 50; i++) expect(crowVisit(small)).toBeNull();
    const early = field(cfg.minCrops);
    early.time.day = cfg.startDay - 1;
    for (let i = 0; i < 50; i++) expect(crowVisit(early)).toBeNull();
    const wet = field(cfg.minCrops);
    wet.weather = 'rain';
    for (let i = 0; i < 50; i++) expect(crowVisit(wet)).toBeNull();
  });

  it('a scarecrow watches the crops within four tiles, and then crows never come', () => {
    const s = field(32);
    expect(unguardedCrops(s)).toHaveLength(32);
    addItem(s, 'scarecrow', 1);
    equip(s, 'scarecrow');
    expect(performAction(s, grass(13, 20))).toMatchObject({ ok: true });
    expect(guarded(s, 9, 16)).toBe(true);
    expect(guarded(s, 18, 20)).toBe(false);
    expect(unguardedCrops(s)).toHaveLength(0);
    for (let i = 0; i < 100; i++) expect(crowVisit(s)).toBeNull();
  });

  it('the morning summary says when a crow came', () => {
    let seen = false;
    for (let seed = 1; seed < 40 && !seen; seed++) {
      const s = field(20);
      s.rng = seed;
      s.forecast = 'sunny';
      const sum = endDay(s, { passedOut: false, weedCandidates: [] });
      seen = !!sum.notes?.some((n) => n.startsWith('A crow ate a parsnip'));
    }
    expect(seen).toBe(true);
  });

  it('Rosa sends a scarecrow before the crows come', () => {
    const letter = mail.letters.find((l) => l.id === 'crows')!;
    expect(letter.gift?.item).toBe('scarecrow');
    expect(letter.when.day).toBeLessThan(game.crows!.startDay);
  });

  it('a garden bench gives a little energy once a day, then is just a bench', () => {
    const s = newState();
    const bench = placeObject(s, 'farm', 4, 4, 'garden_bench');
    s.energy = 50;
    expect(interactWith(s, bench)).toEqual({ kind: 'message', text: '' });
    expect(s.energy).toBe(65);
    expect(interactWith(s, bench)).toMatchObject({ kind: 'message' });
    expect(s.energy).toBe(65); // once a day, whichever bench
    const other = placeObject(s, 'farm', 6, 4, 'garden_bench');
    interactWith(s, other);
    expect(s.energy).toBe(65);
    // Never above full, and a full player is not "rested" (the sit is saved for later).
    const t = newState();
    t.energy = maxEnergy(t);
    const b2 = placeObject(t, 'farm', 4, 4, 'garden_bench');
    interactWith(t, b2);
    expect(t.stats['rested.day']).toBeUndefined();
  });
});
