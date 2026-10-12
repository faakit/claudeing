import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { fish, npcs, projects, valley } from '../src/data';
import { endDay } from '../src/systems/day';
import { addItem, countItem } from '../src/systems/inventory';
import { donateGold, donateItems, isProjectOpen, visibleProjects } from '../src/systems/projects';
import { migrate } from '../src/systems/save';
import { fishFor } from '../src/systems/fishing';
import { generateOrders, orderCandidates } from '../src/systems/orders';
import { npcLocation } from '../src/systems/npcs';
import {
  completeEvent,
  isGiftable,
  linesNow,
  pendingEvent,
  POINTS_PER_HEART,
} from '../src/systems/friendship';
import { isShippable } from '../src/systems/economy';
import {
  askHolds,
  buyPart,
  channelFlow,
  dryMaps,
  HEART_POINTS,
  interactSite,
  partOffer,
  revealPending,
  riverMomentDue,
  stageOf,
  takeRiverMoment,
  valleyRows,
  valleyStage,
  valleyStep,
  placesOpen,
  weirDefaults,
  workAt,
  workDone,
} from '../src/systems/valley';
import { measureText } from '../src/ui/fontMetrics';
import { valleyLines } from '../src/ui/panels/valleyText';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';
import { digChannel } from '../src/systems/channels';

const sleep = (s: GameState) => endDay(s, { passedOut: false, weedCandidates: [] });
const weir = valley.places['weir']!;
const SUMMER_15 = 28 + 15;

/** A year-one farmer after the Old Spring opened, with Finn at `hearts` hearts, on absolute day `day`. */
function farmer(day = SUMMER_15 - 1, hearts = 2): GameState {
  const s = newState();
  s.time.season = day > 28 ? 'summer' : 'spring';
  s.time.day = day > 28 ? day - 28 : day;
  s.stats['valley.farmGreen'] = 1;
  s.stats['valley.greenSeen'] = 1;
  s.stats['place.spring'] = 3;
  s.stats['place.spring.opened'] = 10;
  s.stats['valley.creekSeen'] = 1;
  s.stats['mail.welcome'] = 1;
  s.friends['finn'] = { points: hearts * POINTS_PER_HEART, talkedDay: 0, giftedDay: 0 };
  return s;
}
/** Finn asked for the weir this morning. */
function asked(): GameState {
  const s = farmer();
  sleep(s);
  expect(stageOf(s, 'weir')).toBe(1);
  return s;
}
function fund(s: GameState): void {
  s.money += 3000;
  addItem(s, 'stone', 60);
  expect(buyPart(s, 'orin').ok).toBe(true);
  donateItems(s, 'place_weir');
  donateGold(s, 'place_weir', 2500);
}
function opened(): GameState {
  const s = asked();
  fund(s);
  for (let d = 0; d < 4; d++) {
    expect(workAt(s, 'weir').ok).toBe(true);
    sleep(s);
  }
  return s;
}

describe('the Weir: asked by Finn', () => {
  it('needs the spring open, Finn at 2 hearts, and the forge lit or summer 15', () => {
    const base = farmer();
    expect(askHolds(base, weir.ask)).toBe(false); // the night before summer 15
    base.time.day += 1;
    expect(askHolds(base, weir.ask)).toBe(true);
    const noSpring = farmer(SUMMER_15);
    noSpring.stats['place.spring'] = 2;
    expect(askHolds(noSpring, weir.ask)).toBe(false);
    expect(askHolds(farmer(SUMMER_15, 1), weir.ask)).toBe(false);
    // the forge lit asks earlier (M5, optional)
    const forge = farmer(20);
    expect(askHolds(forge, weir.ask)).toBe(false);
    forge.stats['place.forge'] = 3;
    expect(askHolds(forge, weir.ask)).toBe(true);
    expect(HEART_POINTS).toBe(POINTS_PER_HEART);
  });

  it("is asked once, the morning summer 15 comes, with Finn's letter and the HUD line that day", () => {
    const s = asked();
    expect(valleyStep(s)?.text).toBe('Finn asked: the Weir');
    expect(s.mail.list.some((l) => l.from === 'finn' && l.title === 'The gorge')).toBe(true);
    sleep(s);
    expect(stageOf(s, 'weir')).toBe(1);
    expect(s.mail.list.filter((l) => l.title === 'The gorge')).toHaveLength(1);
    expect(interactSite(s, 'weir')).toEqual({ kind: 'fund', project: 'place_weir' });
  });

  it("before it is asked the site is a sign, and the fund is never on the town board's list", () => {
    const s = farmer();
    expect(interactSite(s, 'weir')).toEqual({ kind: 'say', text: weir.sign });
    expect(visibleProjects(asked())).not.toContain('place_weir');
  });
});

describe('the Weir: the fund and the sluice gate from Orin', () => {
  it('2,500g, 60 stone and a sluice gate', () => {
    const p = projects['place_weir']!;
    expect(p.gold).toBe(2500);
    expect(p.items).toEqual([
      { item: 'stone', qty: 60 },
      { item: 'sluice_gate', qty: 1 },
    ]);
    expect(valleyRows(asked())[1]?.next).toBe('fund 2,500g, 60 stone, sluice gate');
    expect(valleyLines(asked())[1]).toBe('Weir: 2,500g, 60 stone, sluice gate');
  });

  it("Orin offers the gate only while the asked weir's fund needs it and the bag holds none", () => {
    expect(partOffer(farmer(), 'orin')).toBeNull(); // not asked yet
    const s = asked();
    expect(partOffer(s, 'orin')).toEqual({ item: 'sluice_gate', price: 500 });
    expect(partOffer(s, 'mara')).toBeNull();
    // refused for gold or a full bag, and nothing changes
    s.money = 499;
    const before = JSON.stringify(s);
    expect(buyPart(s, 'orin')).toEqual({ ok: false, reason: 'gold' });
    expect(JSON.stringify(s)).toBe(before);
    s.money = 600;
    expect(buyPart(s, 'orin')).toEqual({ ok: true, item: 'sluice_gate' });
    expect(s.money).toBe(100);
    expect(countItem(s, 'sluice_gate')).toBe(1);
    expect(partOffer(s, 'orin')).toBeNull(); // one is enough
    // a key item: never sold, shipped or given
    expect(isShippable('sluice_gate')).toBe(false);
    expect(isGiftable({ item: 'sluice_gate' })).toBe(false);
    expect(valley.parts?.['sluice_gate']?.npc).toBe('orin');
  });

  it('funding takes the gate with the gold and stone, and the offer goes', () => {
    const s = asked();
    fund(s);
    expect(stageOf(s, 'weir')).toBe(2);
    expect(countItem(s, 'sluice_gate')).toBe(0);
    expect(partOffer(s, 'orin')).toBeNull();
  });

  it('restoration gold stays inside the year-one budget (WORLD-PLAN 9.2: 10,000g)', () => {
    const gold = Object.values(valley.places).reduce(
      (n, p) => n + (projects[p.project]?.gold ?? 0),
      0,
    );
    // parts a fund needs (the sluice gate); a tool a place opens (the timber hook, M7) is counted with them
    const parts = Object.values(valley.parts ?? {}).reduce((n, p) => n + p.price, 0);
    expect(gold + parts).toBeLessThanOrEqual(10000);
    expect(gold + parts).toBe(300 + 2500 + 500 + 250);
  });
});

describe('the Weir: four work days and the opening', () => {
  it('four work days, once a day, the last a towing beat (the beam hooked into the gap); then it opens, counted once', () => {
    const s = asked();
    fund(s);
    const tastes: string[] = [];
    for (let d = 1; d <= 4; d++) {
      const r = workAt(s, 'weir');
      expect(r.ok).toBe(true);
      if (r.ok) tastes.push(r.work.taste);
      expect(workAt(s, 'weir')).toEqual({ ok: false, reason: d < 4 ? 'today' : 'done' });
      expect(workDone(s, 'weir')).toBe(d);
      if (d < 4) sleep(s);
    }
    expect(tastes).toEqual(['pickaxe', 'pickaxe', 'pickaxe', 'tow']);
    const placesBefore = s.stats['placesDone'] ?? 0;
    const sum = sleep(s);
    expect(stageOf(s, 'weir')).toBe(3);
    expect(s.stats['placesDone']).toBe(placesBefore + 1);
    expect(sum.notes).toContain(weir.opening.note);
    expect(valleyStep(s)?.text).toBe('The Weir is open!');
  });

  it('the opening morning: Finn waits in the Heron at the town dock, his lines a scene in his sheet', () => {
    const s = opened();
    const at = weir.opening.at!;
    expect(npcLocation('finn', 9 * 60, s)).toEqual(at);
    expect(npcLocation('finn', 17 * 60, s)).toEqual(at);
    // the site itself just says what it does (Finn is not there), and what its upgrade waits for
    const site = interactSite(s, 'weir');
    expect(site.kind).toBe('say');
    expect(site.kind === 'say' && site.text.startsWith(weir.phrase)).toBe(true);
    const ev = pendingEvent(s, 'finn');
    expect(ev?.id).toBe('opening.weir');
    expect(ev?.lines).toEqual(weir.opening.lines);
    expect(completeEvent(s, 'finn').ok).toBe(true);
  });

  it('the river comes back: the town and the gorge change stage, the flow rises to 64, a moment once', () => {
    const s = opened();
    expect(valleyStage(s, 'town').variant).toBe('river');
    expect(valleyStage(s, 'wendhead').variant).toBe('restored');
    expect(dryMaps(s)).toEqual([]);
    expect(channelFlow(s)).toBe(64);
    // the dry tileset is held for the river's first morning in town, then released
    expect(riverMomentDue(s)).toBe(true);
    expect(revealPending(s)).toBe(true);
    expect(takeRiverMoment(s)).toBe(true);
    expect(takeRiverMoment(s)).toBe(false);
    expect(revealPending(s)).toBe(false);
    // the Fish Ladder is now on the weir's site sheet, off the board (after the canopy, as before)
    s.stats['project.canopy'] = 1;
    sleep(s);
    expect(isProjectOpen(s, 'fishladder')).toBe(true);
    expect(visibleProjects(s)).not.toContain('fishladder');
    expect(interactSite(s, 'weir')).toEqual({ kind: 'upgrade', project: 'fishladder' });
  });

  it('every text fits: the HUD plate, THE VALLEY, the work days, the lines, the banner', () => {
    for (const t of [
      weir.asked,
      `${weir.name}: ready to fund`,
      `Work at the ${weir.name} (4 of 4)`,
    ])
      expect(measureText(t), t).toBeLessThanOrEqual(182);
    for (const w of weir.work)
      expect(measureText(`${w.text} (4 of 4)`), w.text).toBeLessThanOrEqual(184 * 2);
    for (const l of weir.opening.lines) expect(measureText(`"${l}"`)).toBeLessThanOrEqual(184 * 3);
    const [title, line] = weir.banner!.split('\n');
    expect(measureText(title!, 2)).toBeLessThanOrEqual(190);
    expect(measureText(line!)).toBeLessThanOrEqual(190);
    const s = asked();
    for (const l of valleyLines(s)) expect(measureText(l), l).toBeLessThanOrEqual(184);
    expect(valleyLines(s).some((l) => l.includes('...') || l.includes('…'))).toBe(false);
  });

  it('the save round-trips at every stage', () => {
    const s = asked();
    const check = () => {
      const back = migrate(JSON.parse(JSON.stringify(s)));
      expect(stageOf(back, 'weir')).toBe(stageOf(s, 'weir'));
      expect(workDone(back, 'weir')).toBe(workDone(s, 'weir'));
      expect(valleyStage(back, 'town').variant).toBe(valleyStage(s, 'town').variant);
    };
    check();
    fund(s);
    check();
    workAt(s, 'weir');
    check();
    const o = opened();
    const back = migrate(JSON.parse(JSON.stringify(o)));
    expect(valleyStage(back, 'town').variant).toBe('river');
  });
});

describe('the river and its fish', () => {
  const river = ['trout', 'salmon', 'glimmer_trout', 'ice_pike'];
  const pool = (s: GameState, map: string) => fishFor(s, map).map((f) => f.item);

  it('trout, salmon and the two river legends wait on the weir; nothing else does', () => {
    expect(
      fish
        .filter((f) => f.place === 'weir')
        .map((f) => f.item)
        .sort(),
    ).toEqual([...river].sort());
    const s = newState();
    s.weather = 'rain';
    for (const season of ['spring', 'summer', 'fall', 'winter'] as const) {
      s.time.season = season;
      s.stats['place.weir'] = 0;
      for (const f of river) expect(pool(s, 'town'), `${season} dry`).not.toContain(f);
      s.stats['place.weir'] = 3;
      const back = fish.filter((f) => river.includes(f.item) && f.seasons.includes(season));
      for (const f of back) expect(pool(s, 'town'), `${season} river`).toContain(f.item);
    }
  });

  it('the dry town still has small fish in its trickle', () => {
    const s = newState();
    s.time.season = 'spring';
    expect(pool(s, 'town')).toContain('carp');
  });

  it('the board never asks for a river fish while the river is dry', () => {
    const s = newState();
    for (const season of ['spring', 'summer', 'fall', 'winter'] as const) {
      s.time.season = season;
      s.stats['place.weir'] = 0;
      const dry = orderCandidates(s).map((r) => r.item);
      for (const f of river) expect(dry, season).not.toContain(f);
      const posted = generateOrders(s);
      expect(posted.length, season).toBeGreaterThan(0);
      for (const o of posted) expect(river, season).not.toContain(o.item.split('|')[0]);
      s.stats['place.weir'] = 3;
      const wet = orderCandidates(s).map((r) => r.item);
      for (const f of fish.filter((x) => river.includes(x.item) && !x.legend))
        if (f.seasons.includes(season)) expect(wet, season).toContain(f.item);
    }
  });
});

describe('Finn, Clay and the river', () => {
  it("Finn's afternoon spot is the dock once the river is back, the woods lake before", () => {
    const s = newState();
    expect(npcLocation('finn', 16 * 60, s)).toEqual({ map: 'woods', tx: 11, ty: 17 });
    expect(npcLocation('finn', 13 * 60, s)).toEqual({ map: 'town', tx: 16, ty: 22 });
    s.stats['place.weir'] = 3;
    expect(npcLocation('finn', 16 * 60, s)).toEqual({ map: 'town', tx: 16, ty: 32 });
    expect(npcLocation('finn', 8 * 60, s)).toEqual({ map: 'woods', tx: 11, ty: 17 });
  });

  it('his lines follow the town: the mud and the trickle while it is dry, the river after', () => {
    const say = (weirStage: number, tier: 'stranger' | 'friend' | 'close') => {
      const s = newState();
      s.stats['place.weir'] = weirStage;
      return linesNow(s, npcs['finn']!.lines[tier]).join(' | ');
    };
    expect(say(0, 'stranger')).toMatch(/trickle/);
    expect(say(0, 'stranger')).not.toMatch(/river's back/);
    expect(say(3, 'stranger')).toMatch(/river's back/);
    expect(say(3, 'stranger')).not.toMatch(/trickle/);
    expect(say(0, 'friend')).toMatch(/on the mud/);
    expect(say(3, 'friend')).not.toMatch(/on the mud|high and dry/);
    expect(say(3, 'close')).not.toMatch(/ever runs full/);
  });

  it('"The Heron" replaces "A secret spot" at 4 hearts, its reward kept, a variant for each river', () => {
    const evs = npcs['finn']!.events!;
    expect(evs.some((e) => e.id === 'secret')).toBe(false);
    const heron = evs.filter((e) => e.id === 'heron');
    expect(heron).toHaveLength(2);
    for (const e of heron) {
      expect(e.title).toBe('The Heron');
      expect(e.hearts).toBe(4);
      expect(e.reward).toEqual({ item: 'catfish', qty: 2 });
    }
    const s = newState();
    s.friends['finn'] = { points: 4 * POINTS_PER_HEART, talkedDay: 0, giftedDay: 0 };
    s.stats['friend.finn.lake'] = 1;
    s.stats['event.finn.lake'] = 1;
    const dry = pendingEvent(s, 'finn');
    s.stats['place.weir'] = 3;
    const wet = pendingEvent(s, 'finn');
    expect(dry?.id).toBe('heron');
    expect(wet?.id).toBe('heron');
    expect(dry!.lines).not.toEqual(wet!.lines);
  });

  it("an old save's quiet weir counts as a place open, never as a place done", () => {
    const s = newState();
    delete s.stats['valley.weirOn'];
    weirDefaults(s.stats);
    expect(placesOpen(s)).toBe(1);
    expect(s.stats['placesDone'] ?? 0).toBe(0);
  });

  it('a save that saw "A secret spot" sees "The Heron" without its catfish again', () => {
    const play = (sawSecret: boolean) => {
      const s = newState();
      s.friends['finn'] = { points: 4 * POINTS_PER_HEART, talkedDay: 0, giftedDay: 0 };
      for (const ev of npcs['finn']!.events!)
        if (ev.id !== 'heron' && ev.hearts <= 4) s.stats[`event.finn.${ev.id}`] = 1;
      if (sawSecret) s.stats['event.finn.secret'] = 1;
      expect(pendingEvent(s, 'finn')?.id).toBe('heron');
      const before = s.stats['friendEvents'] ?? 0;
      const r = completeEvent(s, 'finn');
      return {
        r,
        counted: (s.stats['friendEvents'] ?? 0) - before,
        seen: s.stats['event.finn.heron'],
      };
    };
    const fresh = play(false);
    expect(fresh.r).toMatchObject({ ok: true, item: 'catfish', qty: 2 });
    expect(fresh.counted).toBe(1);
    const retold = play(true);
    expect(retold.r).toMatchObject({ ok: true, item: null, qty: 0, gold: 0 });
    expect(retold.counted).toBe(0);
    expect(retold.seen).toBe(1);
  });

  it("Clay's weir line is said only once the river is back", () => {
    const lines = [...npcs['clay']!.lines.stranger, ...npcs['clay']!.lines.friend];
    const weirLines = lines.filter((l) => typeof l !== 'string' && l.when.place === 'weir');
    expect(weirLines.length).toBeGreaterThan(0);
    for (const l of weirLines) expect(typeof l !== 'string' && l.when.min).toBe(3);
  });
});

describe('saves from before the Weir keep their river (coordinator ruling)', () => {
  const oldSave = (patch: (s: GameState) => void = () => {}) => {
    const s = newState();
    patch(s);
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.stats['valley.weirOn'];
    return migrate(raw);
  };

  it('an old save gets the weir restored, quietly: no count, no moment, no ask, no letter', () => {
    const o = oldSave((s) => {
      s.stats['projectsDone'] = 2;
      s.stats['placesDone'] = 1;
    });
    expect(stageOf(o, 'weir')).toBe(3);
    expect(o.stats['valley.weirOn']).toBe(1);
    expect(o.stats['projectsDone']).toBe(2);
    expect(o.stats['placesDone']).toBe(1);
    expect(riverMomentDue(o)).toBe(false);
    expect(valleyStage(o, 'town').variant).toBe('river');
    expect(valleyStep(o)).toBeNull();
    sleep(o);
    expect(o.mail.list.some((l) => l.title === 'The gorge')).toBe(false);
    expect(pendingEvent(o, 'finn')?.id ?? null).not.toBe('opening.weir');
  });

  it('with its spring not yet open: the gorge runs, the pool waits, the spring flow is unchanged', () => {
    const o = oldSave((s) => (s.stats['valley.farmGreen'] = 1));
    expect(stageOf(o, 'spring')).toBe(0);
    expect(valleyStage(o, 'wendhead').variant).toBe('gorge');
    expect(dryMaps(o)).toEqual(['wendhead']);
    sleep(o); // the spring is still asked the usual way
    expect(stageOf(o, 'spring')).toBe(1);
    o.stats['place.spring'] = 3;
    expect(valleyStage(o, 'wendhead').variant).toBe('restored');
    expect(channelFlow(o)).toBe(64);
  });

  it('a new game carries the marker: a reload never brings its river back early', () => {
    const s = newState();
    expect(s.stats['valley.weirOn']).toBe(1);
    s.time.day = 2;
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(stageOf(back, 'weir')).toBe(0);
    expect(valleyStage(back, 'town').variant).toBe('dry');
    expect(weirDefaults({ 'valley.weirOn': 1 })).toEqual({ 'valley.weirOn': 1 });
  });

  it('an old save round-trips with its river', () => {
    const o = oldSave();
    const back = migrate(JSON.parse(JSON.stringify(o)));
    expect(stageOf(back, 'weir')).toBe(3);
    expect(back.stats['valley.riverSeen']).toBe(1);
  });
});

describe('the morning the weir opens', () => {
  it('the channels already carry the weir flow (64): tiles past 24 are drawn wet and water their soil', () => {
    const s = newState();
    s.time.season = 'summer';
    s.time.day = 20;
    s.weather = 'sunny';
    s.forecast = 'sunny';
    Object.assign(s.stats, {
      'valley.farmGreen': 1,
      'valley.greenSeen': 1,
      'place.spring': 3,
      'place.spring.opened': 10,
      'valley.creekSeen': 1,
      'valley.compost': 1,
      'place.weir': 2,
      'site.weir.work': 4,
      'site.weir.last': 28 + 20,
      'place.weir.since': 28 + 20,
    });
    // a 30-tile channel west from the creek along y 10, then down x 0; soil beside tile 21 and tile 26
    for (let i = 1; i <= 26; i++) digChannel(s, 26 - i, 10);
    for (let i = 0; i < 4; i++) digChannel(s, 0, 11 + i);
    s.farm.tiles['5,9'] = { watered: false, crop: null };
    s.farm.tiles['0,9'] = { watered: false, crop: null };
    sleep(s);
    expect(stageOf(s, 'weir')).toBe(3);
    expect(channelFlow(s)).toBe(64);
    expect(s.farm.tiles['5,9']!.watered).toBe(true);
    expect(s.farm.tiles['0,9']!.watered).toBe(true);
  });
});
