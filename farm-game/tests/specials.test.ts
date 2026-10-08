import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { game, items, specials } from '../src/data';
import { endDay } from '../src/systems/day';
import { pointsOf } from '../src/systems/friendship';
import { addItem, countItem } from '../src/systems/inventory';
import { migrate } from '../src/systems/save';
import {
  giveToSpecial,
  makeSpecial,
  morningSpecial,
  SPECIAL_FRIENDSHIP,
  SPECIAL_MULT,
  specialCandidates,
  specialLabel,
  specialSub,
} from '../src/systems/specials';
import { absoluteDay } from '../src/systems/time';
import { measureText } from '../src/ui/fontMetrics';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';

const sleep = (s: GameState) => endDay(s, { passedOut: false, weedCandidates: [] });

describe('special orders', () => {
  it('one is posted when the season has room, due its last day, worth more than the bin', () => {
    const s = newState();
    s.time.day = 5;
    const news = morningSpecial(s);
    expect(news).toMatch(/^Special order: /);
    const sp = s.special!;
    expect(sp.due).toBe(absoluteDay(s) + game.seasonLength - 5);
    const value = sp.qty * items[sp.item]!.sellPrice!;
    expect(sp.reward).toBeGreaterThanOrEqual(Math.floor(value * SPECIAL_MULT) - 50);
    expect(morningSpecial(s)).toBeNull(); // one at a time
  });

  it('is not posted late in a season, nor for things you cannot make yet', () => {
    const s = newState();
    s.time.day = 25;
    expect(morningSpecial(s)).toBeNull();
    expect(specialCandidates(s).map((x) => x.id)).not.toContain('berries');
    expect(specialCandidates(s).map((x) => x.id)).not.toContain('eggs');
    s.stats['project.seedexchange'] = 1;
    expect(specialCandidates(s).map((x) => x.id)).toContain('berries');
  });

  it('takes goods a bit at a time and pays reward and friendship at the end', () => {
    const s = newState();
    s.special = makeSpecial(
      s,
      specials.find((x) => x.id === 'potato')!,
    );
    const sp = s.special;
    expect(giveToSpecial(s)).toEqual({ ok: false, reason: 'nothing' });
    addItem(s, 'potato', 5);
    expect(giveToSpecial(s)).toEqual({ ok: true, gave: 5, finished: false });
    expect(sp.given).toBe(5);
    addItem(s, { item: 'potato', q: 2 }, sp.qty);
    const money = s.money;
    expect(giveToSpecial(s)).toMatchObject({ ok: true, finished: true });
    expect(countItem(s, 'potato')).toBe(5);
    expect(s.money).toBe(money + sp.reward);
    expect(pointsOf(s, 'rosa')).toBe(SPECIAL_FRIENDSHIP);
    expect(s.special).toBeNull();
    expect(s.stats['specialsDone']).toBe(1);
  });

  it('runs out after its due day and pays the goods given at bin price', () => {
    const s = newState();
    s.time.day = 20;
    s.special = makeSpecial(
      s,
      specials.find((x) => x.id === 'potato')!,
    );
    addItem(s, 'potato', 4);
    giveToSpecial(s);
    const money = s.money;
    for (let d = 0; d < 9; d++) sleep(s);
    expect(s.money).toBeGreaterThanOrEqual(money + 4 * items['potato']!.sellPrice!);
    expect(s.special?.id).not.toBe('potato-expired');
  });

  it('survives a save; v14 saves start without one', () => {
    const s = newState();
    s.time.day = 3;
    morningSpecial(s);
    s.special!.given = 2;
    expect(migrate(JSON.parse(JSON.stringify(s))).special).toEqual(s.special);
    const v14 = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    v14['version'] = 14;
    delete v14['special'];
    expect(migrate(v14).special).toBeNull();
  });

  it('labels fit the board row', () => {
    const s = newState();
    for (const def of specials) {
      const sp = makeSpecial(s, def);
      // The board row leaves 125 px of text beside its 34 px Give button.
      expect(measureText(specialLabel(sp)), def.id).toBeLessThanOrEqual(125);
      expect(measureText(specialSub({ ...sp, given: sp.qty })), def.id).toBeLessThanOrEqual(125);
    }
  });
});
