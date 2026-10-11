import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { mail, projects, tutorial, valley } from '../src/data';
import { advance, startTutorial, type CoachFacts, type CoachWorld } from '../src/systems/tutorial';
import { endDay } from '../src/systems/day';
import { addItem } from '../src/systems/inventory';
import { donateGold, donateItems, visibleProjects } from '../src/systems/projects';
import { migrate } from '../src/systems/save';
import { absoluteDay } from '../src/systems/time';
import {
  canFundNow,
  canWork,
  FARM_GREEN,
  fundLeft,
  interactSite,
  siteSprite,
  stageOf,
  valleyRows,
  valleyStep,
  workAt,
  takeCreekMoment,
  workDone,
} from '../src/systems/valley';
import { completeEvent, pendingEvent } from '../src/systems/friendship';
import { measureText } from '../src/ui/fontMetrics';
import { valleyLines } from '../src/ui/panels/valleyText';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';

const sleep = (s: GameState) => endDay(s, { passedOut: false, weedCandidates: [] });
const spring = valley.places['spring']!;

/** The first-green morning: the farm is green and Rosa has asked for the spring. */
function asked(): GameState {
  const s = newState();
  s.time.day = 5;
  s.stats['shipped'] = 5;
  s.stats['mail.welcome'] = 1;
  sleep(s);
  return s;
}
function fund(s: GameState): void {
  s.money += 1000;
  addItem(s, 'stone', 20);
  donateItems(s, 'place_spring');
  donateGold(s, 'place_spring', 300);
}

describe('the Old Spring: the restoration pattern', () => {
  it('is asked on the first-green morning, with the HUD line that day only', () => {
    const s = asked();
    expect(s.stats[FARM_GREEN]).toBe(1);
    expect(stageOf(s, 'spring')).toBe(1);
    expect(valleyStep(s)?.text).toBe('Rosa asked: the Old Spring');
    s.money = 0;
    sleep(s);
    expect(valleyStep(s)).toBeNull(); // nothing to do today (cannot fund): the goal chain shows
  });

  it('"ready to fund" once the purse and bag hold it; the fund is never on the board', () => {
    const s = asked();
    sleep(s);
    s.money = 300;
    expect(canFundNow(s, 'spring')).toBe(false);
    addItem(s, 'stone', 20);
    expect(canFundNow(s, 'spring')).toBe(true);
    expect(valleyStep(s)?.text).toBe('Old Spring: ready to fund');
    expect(visibleProjects(s)).not.toContain('place_spring');
    expect(fundLeft(s, 'spring')).toEqual({ gold: 300, items: [{ item: 'stone', qty: 20 }] });
  });

  it('funding moves it on without counting a project; Interact before then opens the fund', () => {
    const s = asked();
    expect(interactSite(s, 'spring')).toEqual({ kind: 'fund', project: 'place_spring' });
    const done = s.stats['projectsDone'] ?? 0;
    fund(s);
    expect(stageOf(s, 'spring')).toBe(2);
    expect(s.stats['projectsDone'] ?? 0).toBe(done);
  });

  it('three work days, once a day, 20 energy each; missed days cost nothing; the sprite changes', () => {
    const s = asked();
    fund(s);
    const sprites = [siteSprite(s, 'spring')];
    const e = s.energy;
    const r1 = interactSite(s, 'spring');
    expect(r1.kind).toBe('work');
    expect(s.energy).toBe(e - spring.energy);
    sprites.push(siteSprite(s, 'spring'));
    // once a day: nothing changes on a second tap
    const again = interactSite(s, 'spring');
    expect(again).toEqual({ kind: 'say', text: 'Enough for today. Back tomorrow.' });
    expect(s.energy).toBe(e - spring.energy);
    expect(workDone(s, 'spring')).toBe(1);
    // four days away: nothing lost
    for (let i = 0; i < 4; i++) sleep(s);
    expect(workDone(s, 'spring')).toBe(1);
    expect(workAt(s, 'spring').ok).toBe(true);
    sprites.push(siteSprite(s, 'spring'));
    sleep(s);
    s.energy = 10;
    expect(canWork(s, 'spring')).toBe('energy');
    expect(interactSite(s, 'spring').kind).toBe('say');
    expect(workDone(s, 'spring')).toBe(2);
    s.energy = 100;
    const r3 = interactSite(s, 'spring');
    expect(r3.kind === 'work' && r3.work.taste).toBe('channel');
    sprites.push(siteSprite(s, 'spring'));
    expect(new Set(sprites).size).toBe(4);
    expect(stageOf(s, 'spring')).toBe(2); // opens the next morning, not on the spot
  });

  it('opens the morning after the last work day: counted once in placesDone and projectsDone', () => {
    const s = asked();
    fund(s);
    for (let d = 0; d < 3; d++) {
      expect(workAt(s, 'spring').ok).toBe(true);
      if (d < 2) sleep(s);
    }
    const before = s.stats['projectsDone'] ?? 0;
    const sum = sleep(s);
    expect(stageOf(s, 'spring')).toBe(3);
    expect(s.stats['placesDone']).toBe(1);
    expect(s.stats['projectsDone']).toBe(before + 1);
    expect(sum.notes).toContain(spring.opening.note);
    expect(valleyStep(s)?.text).toBe('The Old Spring is open!');
    expect(siteSprite(s, 'spring')).toBe(spring.sprites[3]);
    expect(interactSite(s, 'spring')).toEqual({
      kind: 'lines',
      npc: 'rosa',
      lines: spring.opening.lines,
    });
    sleep(s);
    expect(s.stats['placesDone']).toBe(1);
    expect(s.stats['projectsDone']).toBe(before + 1);
    // the morning after the opening: an unsigned sack of fertilizer (Clay)
    const sack = s.mail.list.find((l) => l.title === 'A sack at the gate');
    expect(sack?.from).toBe('unsigned');
    expect(sack?.gift?.item).toBe('fertilizer');
    expect(valleyStep(s)).toBeNull();
  });

  it("the opening morning's lines are a scene in Rosa's sheet; it is not a heart event", () => {
    const s = asked();
    fund(s);
    for (let d = 0; d < 3; d++) {
      workAt(s, 'spring');
      sleep(s);
    }
    const ev = pendingEvent(s, 'rosa');
    expect(ev?.id).toBe('opening.spring');
    expect(ev?.lines).toEqual(spring.opening.lines);
    const before = s.stats['friendEvents'] ?? 0;
    expect(completeEvent(s, 'rosa').ok).toBe(true);
    expect(s.stats['friendEvents'] ?? 0).toBe(before);
    expect(pendingEvent(s, 'rosa')?.id).not.toBe('opening.spring');
    sleep(s); // the next day it is over
    expect(pendingEvent(s, 'rosa')?.id ?? null).not.toBe('opening.spring');
    // the creek's first morning plays once
    expect(takeCreekMoment(s)).toBe(true);
    expect(takeCreekMoment(s)).toBe(false);
  });

  it('a valley step with no progress for 3 days waits (off the HUD, still in THE VALLEY)', () => {
    const s = asked();
    fund(s);
    expect(valleyStep(s)?.text).toBe('Work at the Old Spring (1 of 3)');
    for (let i = 0; i < 3; i++) sleep(s);
    expect(valleyStep(s)).toBeNull();
    expect(valleyLines(s)).toEqual(['Old Spring: work day 1 of 3']);
    // working again brings it back the next day
    workAt(s, 'spring');
    sleep(s);
    expect(valleyStep(s)?.text).toBe('Work at the Old Spring (2 of 3)');
  });

  it("THE VALLEY's rows say each step and fit the sheet", () => {
    const s = asked();
    expect(valleyRows(s)[0]?.next).toBe('fund 300g, 20 stone');
    fund(s);
    workAt(s, 'spring');
    expect(valleyLines(s)).toEqual(['Old Spring: worked today (1 of 3)']);
    for (const l of valleyLines(s)) expect(measureText(l)).toBeLessThanOrEqual(184);
    for (const t of [
      spring.asked,
      `${spring.name}: ready to fund`,
      `Work at the ${spring.name} (3 of 3)`,
    ])
      expect(measureText(t), t).toBeLessThanOrEqual(182); // the goal plate (its count sits on the bar row)
    for (const w of spring.work) expect(measureText(w.text), w.text).toBeLessThanOrEqual(184 * 2);
    for (const l of spring.opening.lines)
      expect(measureText(`"${l}"`)).toBeLessThanOrEqual(184 * 3);
  });

  it('restoration gold stays small (under 500 for the spring)', () => {
    expect(projects['place_spring']!.gold).toBeLessThan(500);
  });

  it('the save round-trips at every stage; old saves start at stage 0', () => {
    const s = asked();
    const check = () => {
      const back = migrate(JSON.parse(JSON.stringify(s)));
      expect(stageOf(back, 'spring')).toBe(stageOf(s, 'spring'));
      expect(workDone(back, 'spring')).toBe(workDone(s, 'spring'));
    };
    check();
    fund(s);
    check();
    workAt(s, 'spring');
    check();
    const old = JSON.parse(JSON.stringify(newState()));
    delete old.stats['valley.on'];
    old.stats.shipped = 50;
    const o = migrate(old);
    expect(stageOf(o, 'spring')).toBe(0);
    sleep(o); // an old green farm is asked the next morning
    expect(stageOf(o, 'spring')).toBe(1);
    expect(absoluteDay(o)).toBeGreaterThan(1);
    expect(mail.letters.some((l) => l.id === 'spring_compost')).toBe(true);
  });
});

describe('valley intros', () => {
  /** A guided game whose day-1 and day-2 tracks are done (intros may show). */
  function afterGuide(): GameState {
    const s = asked();
    startTutorial(s, { on: true, gift: false });
    for (const st of tutorial.steps) if (st.track !== 'intro') s.stats[`tut.${st.id}`] = 1;
    for (const st of tutorial.steps)
      if (st.track === 'intro' && !st.valley) s.stats[`tut.${st.id}`] = 1; // other intros out of the way
    return s;
  }
  const world = (map: string): CoachWorld => ({
    map,
    tile: { tx: 5, ty: 15 },
    facing: 'right',
    action: null,
    objects: [{ type: 'site', tx: 6, ty: 15, w: 1, h: 1 }],
    npcs: [],
    blocked: () => false,
    actKind: () => null,
    inView: () => true,
  });
  const NO_SHEET: CoachFacts = { panel: null, tab: null };

  it('the ask points up through the gate; a second valley intro waits for the next morning', () => {
    const s = afterGuide();
    expect(advance(s, world('farm'), NO_SHEET).current?.id).toBe('valleyAsk');
    // the same morning, at the spring with the fund in: the work intro would apply, but waits a day
    fund(s);
    expect(advance(s, world('wendhead'), NO_SHEET).current?.id ?? null).toBeNull();
    sleep(s);
    expect(advance(s, world('wendhead'), NO_SHEET).current?.id).toBe('siteWork');
    workAt(s, 'spring');
    expect(advance(s, world('wendhead'), NO_SHEET).current?.id ?? null).toBeNull();
  });
});
