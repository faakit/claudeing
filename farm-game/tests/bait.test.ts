import { afterEach, describe, expect, it } from 'vitest';
import '../src/mechanics';
import { fish as fishTable, game, items, recipes, shops } from '../src/data';
import { performAction } from '../src/systems/actions';
import { endDay } from '../src/systems/day';
import { gameEvents } from '../src/systems/events';
import {
  BAIT_ON,
  BAIT_PICK,
  STARTER_BAIT,
  baitItems,
  baitOf,
  biteDelay,
  currentBait,
  digWorms,
  fishOdds,
  nextBait,
  refundBait,
  reelSize,
  resolveCatch,
} from '../src/systems/fishing';
import { addStat } from '../src/systems/goals';
import { addItem, countItem, removeItem } from '../src/systems/inventory';
import { migrate } from '../src/systems/save';
import { setLocale, t } from '../src/i18n';
import { measureText } from '../src/ui/fontMetrics';
import { COACH_LINE_PX } from '../src/systems/tutorial';
import type { GameState } from '../src/state/GameState';
import { FULL_INVENTORY, equip, newState, pond } from './helpers';

const sleep = (s: GameState) => endDay(s, { passedOut: false, weedCandidates: [] });

/** Cast at the farm pond; returns the bait the cast used (null: no cast). */
function cast(s: GameState): { ok: boolean; message?: string; bait: string | null } {
  let bait: string | null = null;
  const off = gameEvents.on('startFishing', (e) => (bait = e.bait));
  const r = performAction(s, pond(18, 31));
  off();
  return { ok: r.ok, message: r.message as string | undefined, bait };
}

const dropAll = (s: GameState, item: string) => removeItem(s, item, countItem(s, item));
/** Put a bait stack on the last hotbar slot (baits go to the bag; a player can move one onto the bar). */
const toBar = (s: GameState, item: string, qty: number) =>
  (s.inventory.slots[game.hotbarSlots - 1] = { item, qty });

describe('bait: casting needs one and uses one', () => {
  it('a new game starts with worms in the bag (not the hotbar), enough for the day-2 fishing job', () => {
    const s = newState();
    expect(countItem(s, 'worms')).toBe(STARTER_BAIT.qty);
    expect(s.inventory.slots.findIndex((x) => x?.item === 'worms')).toBeGreaterThanOrEqual(
      game.hotbarSlots,
    );
    addItem(s, 'bait', 5); // a bought bait goes to the bag too
    expect(s.inventory.slots.findIndex((x) => x?.item === 'bait')).toBeGreaterThanOrEqual(
      game.hotbarSlots,
    );
    expect(s.stats[BAIT_ON]).toBe(1);
    expect(game.startingItems.some((i) => i.item === 'worms')).toBe(true);
  });

  it('with no bait the cast is refused in one line and nothing changes', () => {
    const s = newState();
    dropAll(s, 'worms');
    equip(s, 'fishing_rod');
    const before = JSON.stringify(s);
    const r = cast(s);
    expect(r.ok).toBe(false);
    expect(r.bait).toBeNull();
    expect(r.message).toBe(t('fishing.needBait'));
    expect(JSON.stringify(s)).toBe(before);
  });

  it('each cast uses one bait and remembers it', () => {
    const s = newState();
    equip(s, 'fishing_rod');
    const r = cast(s);
    expect(r).toMatchObject({ ok: true, bait: 'worms' });
    expect(countItem(s, 'worms')).toBe(STARTER_BAIT.qty - 1);
    expect(s.stats[BAIT_PICK]).toBe(baitOf('worms')!.code);
  });

  it('a bait in hand casts with that bait; the rod then keeps using it', () => {
    const s = newState();
    toBar(s, 'glow_grub', 2);
    equip(s, 'glow_grub');
    expect(cast(s).bait).toBe('glow_grub');
    equip(s, 'fishing_rod');
    expect(cast(s).bait).toBe('glow_grub');
    // run out of the remembered bait: the plainest one carried goes on next, never a dearer one by surprise
    addItem(s, 'bait', 3);
    expect(cast(s).bait).toBe('worms');
  });

  it('a bait in hand away from water says to cast at the water', () => {
    const s = newState();
    dropAll(s, 'worms');
    toBar(s, 'worms', STARTER_BAIT.qty);
    equip(s, 'worms');
    const r = performAction(s, {
      map: 'farm',
      tx: 5,
      ty: 5,
      kind: 'grass',
      tillable: true,
      blocked: false,
      farmland: true,
    });
    expect(r.ok).toBe(false);
    expect(countItem(s, 'worms')).toBe(STARTER_BAIT.qty);
  });

  it('the fallback order is by code, plainest first', () => {
    const codes = baitItems().map((id) => baitOf(id)!.code);
    expect(codes).toEqual([...codes].sort((a, b) => a - b));
    expect(baitItems()[0]).toBe('worms');
    const s = newState();
    dropAll(s, 'worms');
    addItem(s, 'glow_grub', 1);
    addItem(s, 'bait', 1);
    expect(currentBait(s)).toBe('bait');
  });

  it('every bait can be had: dug, bought or made', () => {
    const sold = new Set(shops['town_general_store']!.stock.map((x) => x.item));
    const made = new Set(Object.values(recipes).map((r) => r.output.item));
    for (const id of baitItems())
      expect(id === STARTER_BAIT.item || sold.has(id) || made.has(id), id).toBe(true);
  });
});

describe('bait: the fishing sheet switches the next bait in one tap', () => {
  it('cycles through the baits you carry, plainest first, and the rod then uses it', () => {
    const s = newState();
    expect(nextBait(s)).toBeNull(); // worms only: nothing to switch to
    addItem(s, 'bait', 2);
    addItem(s, 'glow_grub', 1);
    expect(nextBait(s)).toBe('bait');
    expect(nextBait(s)).toBe('glow_grub');
    expect(nextBait(s)).toBe('worms');
    expect(nextBait(s)).toBe('bait');
    equip(s, 'fishing_rod');
    expect(cast(s).bait).toBe('bait');
  });

  it('with a bait in hand it switches the hand too, so the next cast really changes', () => {
    const s = newState();
    addItem(s, 'bait', 2);
    toBar(s, 'glow_grub', 2);
    equip(s, 'glow_grub');
    expect(currentBait(s)).toBe('glow_grub');
    // the next after the grub wraps to worms, which are in the bag: the hand goes to the rod
    expect(nextBait(s)).toBe('worms');
    expect(currentBait(s)).toBe('worms');
    expect(s.inventory.slots[s.inventory.selected]?.item).toBe('fishing_rod');
    expect(cast(s).bait).toBe('worms');
  });

  it('leaving before a bite gives the bait back', () => {
    const s = newState();
    refundBait(s, 'worms');
    expect(countItem(s, 'worms')).toBe(STARTER_BAIT.qty + 1);
    refundBait(s, 'carp'); // not a bait: nothing
    expect(countItem(s, 'carp')).toBe(0);
  });
});

describe('bait: each changes the wait and the odds', () => {
  it('bite waits: Glow Grub < Bait Mix < Fish Chum < Worms', () => {
    const w = (b: string) => biteDelay(0.5, b);
    expect(w('glow_grub')).toBeLessThan(w('bait'));
    expect(w('bait')).toBeLessThan(w('chum'));
    expect(w('chum')).toBeLessThan(w('worms'));
  });

  it('worms are the plain bait: the odds of the old bare hook', () => {
    const s = newState();
    const plain = fishOdds(s, 'farm', null);
    const worms = fishOdds(s, 'farm', 'worms');
    for (const [f, p] of plain) expect(worms.get(f)).toBeCloseTo(p, 9);
  });

  it('Glow Grub makes a legend about twice as likely; chum lifts the harder river fish', () => {
    const s = newState();
    s.time.season = 'summer';
    const legend = (b: string) => fishOdds(s, 'farm', b).get('sun_carp')!;
    expect(legend('glow_grub') / legend('worms')).toBeGreaterThan(1.7);
    expect(legend('glow_grub') / legend('worms')).toBeLessThan(3);
    s.time.season = 'fall';
    s.stats['place.weir'] = 3;
    const salmon = (b: string) => fishOdds(s, 'town', b).get('salmon')!;
    expect(salmon('chum')).toBeGreaterThan(salmon('worms') * 1.2);
    expect(salmon('glow_grub')).toBeGreaterThan(salmon('chum'));
  });

  it('finer baits roll finer catches; Bait Mix and Glow Grub widen the bar', () => {
    const q = (b: string) => {
      const s = newState();
      let fine = 0;
      for (let i = 0; i < 400; i++) {
        const r = resolveCatch(s, 'carp', { caught: true, perfect: false }, b);
        if (r.q > 0) fine++;
        s.inventory.slots = s.inventory.slots.map((x) => (x?.item === 'carp' ? null : x));
      }
      return fine;
    };
    expect(q('glow_grub')).toBeGreaterThan(q('worms'));
    const s = newState();
    expect(reelSize(s, 0.5, 'bait')).toBeGreaterThan(reelSize(s, 0.5, 'worms'));
  });

  it('bait is a small gold sink, not a wall: a bought cast costs under a quarter of the plainest fish', () => {
    const carp = items['carp']!.sellPrice!;
    expect(items['bait']!.buyPrice!).toBeLessThan(carp / 4);
    // Fish Chum: one carp and a fiber make five casts
    const chum = recipes['chum']!;
    expect(chum.output.qty).toBeGreaterThanOrEqual(5);
    // the premium bait costs about a plain fish: dear enough to save for legend water
    expect(items['glow_grub']!.buyPrice!).toBeGreaterThan(carp);
    expect(items['glow_grub']!.buyPrice!).toBeLessThan(fishTable.length * carp);
  });
});

describe('bait: worms from the hoe and the scythe', () => {
  it('about one in six tiles tilled turns up worms, from day 3, without touching the RNG', () => {
    const s = newState();
    digWorms(s); // first look: remembers the counts
    addStat(s, 'tilled', 60); // day 1: kept quiet (the guided start)
    s.time.day = 2;
    addStat(s, 'tilled', 60); // day 2 too: the walk to town
    expect(countItem(s, 'worms')).toBe(STARTER_BAIT.qty);
    s.time.day = 3;
    s.weather = 'sunny';
    const rng = s.rng;
    addStat(s, 'tilled', 120);
    const got = countItem(s, 'worms') - STARTER_BAIT.qty;
    expect(got).toBeGreaterThan(10);
    expect(got).toBeLessThan(32);
    expect(s.rng).toBe(rng);
    s.weather = 'rain';
    const before = countItem(s, 'worms');
    addStat(s, 'cleared', 120);
    expect(countItem(s, 'worms') - before).toBeGreaterThan(got);
  });

  it('a full bag finds none and loses nothing', () => {
    const s = newState();
    s.time.day = 3;
    digWorms(s);
    dropAll(s, 'worms');
    addItem(s, 'melon', FULL_INVENTORY);
    addStat(s, 'tilled', 60);
    expect(countItem(s, 'worms')).toBe(0);
  });
});

describe('bait: old saves fished without bait', () => {
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    const stats = raw['stats'] as Record<string, number>;
    delete stats[BAIT_ON];
    const inv = raw['inventory'] as { slots: ({ item: string } | null)[] };
    inv.slots = inv.slots.map((x) => (x?.item === 'worms' ? null : x));
    return raw;
  };

  it('get the starter worms once, and Finn writes why the next morning', () => {
    const s = migrate(oldSave());
    expect(countItem(s, 'worms')).toBe(STARTER_BAIT.qty);
    expect(s.stats[BAIT_ON]).toBe(1);
    const again = migrate(JSON.parse(JSON.stringify(s)));
    expect(countItem(again, 'worms')).toBe(STARTER_BAIT.qty);
    sleep(again);
    expect(again.mail.list.some((l) => l.title === 'Picky fish' && !l.gift)).toBe(true);
    expect(again.mail.list.some((l) => l.title === 'Worms for you')).toBe(false);
  });

  it("with a full bag the worms come in Finn's letter instead", () => {
    const raw = oldSave();
    const inv = raw['inventory'] as { slots: ({ item: string; qty: number } | null)[] };
    inv.slots = inv.slots.map((x) => x ?? { item: 'melon', qty: 99 });
    const s = migrate(raw);
    expect(countItem(s, 'worms')).toBe(0);
    sleep(s);
    const letter = s.mail.list.find((l) => l.title === 'Worms for you');
    expect(letter?.gift).toEqual({ item: 'worms', qty: STARTER_BAIT.qty });
  });

  it('a new game is never given them again and gets no letter', () => {
    const s = newState();
    const m = migrate(JSON.parse(JSON.stringify(s)));
    expect(countItem(m, 'worms')).toBe(STARTER_BAIT.qty);
    sleep(m);
    expect(m.mail.list.some((l) => l.title === 'Picky fish' || l.title === 'Worms for you')).toBe(
      false,
    );
  });
});

describe('bait: text fits in both languages', () => {
  afterEach(() => setLocale('en'));
  it.each(['en', 'pt-BR'] as const)(
    '%s: the refusal fits a coach line, the switch its button',
    (lang) => {
      setLocale(lang);
      expect(measureText(t('fishing.needBait'))).toBeLessThanOrEqual(COACH_LINE_PX);
      expect(measureText(t('fishing.dugWorms', { n: 3 }))).toBeLessThanOrEqual(COACH_LINE_PX);
      for (const id of baitItems()) {
        const line = t('fishing.nextBait', { bait: items[id]!.name, n: 99 });
        expect(measureText(line), line).toBeLessThanOrEqual(176);
        expect(measureText(items[id]!.name), id).toBeLessThanOrEqual(90); // the sheet's top-right label
      }
    },
  );
});
