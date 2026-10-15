/**
 * The guided start: a data-driven step machine (steps in `data/tutorial.json`). Pure rules, no Phaser.
 *
 * Progress lives in stats, so it is saved with no new state:
 * - `tut.on` the guide runs for this save; `tut.off` it was skipped;
 * - `tut.<id>` a step is done (or was passed); `tut.seen.<id>` it has shown;
 * - `tut.at.<id>.<stat>` a stat's value when that step first showed (for `fresh` conditions);
 * - `tut.base.<stat>` a stat's value when the guide was replayed (for `stat` conditions);
 * - `tut.gift` the new-game gift (ripe crops, wild goods) was laid out.
 *
 * The scene supplies a `CoachWorld` (what the world looks like right now) and `CoachFacts` (which sheet is
 * open); `advance` marks steps done and returns the current one, `coachView` says what to show for it.
 */
import {
  crops,
  game,
  items,
  jobs as jobDefs,
  mapsData,
  npcs,
  plots,
  projects,
  reveal,
  tools,
  tutorial,
} from '../data';
import type {
  TutorialCond,
  TutorialData,
  TutorialHud,
  TutorialKind,
  TutorialStep,
  TutorialTarget,
} from '../data';
import type { Direction, GameState } from '../state/GameState';
import { autoMode } from './autoTool';
import { isProduce, isShippable } from './economy';
import { maxEnergy } from './energy';
import { gameEvents } from './events';
import { isMature, tileKey } from './farming';
import { addStat, currentGoal, stat } from './goals';
import { absoluteDay } from './time';
import { baitKinds, fishingResultShown, hasBait } from './fishing';
import { festivalToday, hasEntered } from './festivals';
import { countItem } from './inventory';
import { isTaken, jobReady, PAID_AT_PAYOUT, postedJobs } from './jobs';
import { isWet } from './weather';
import { introduced, revealOn, startReveal, topicRead } from './reveal';
import { t, toEnglish, type Key } from '../i18n';

export interface Tile {
  tx: number;
  ty: number;
}

/** A thing on the map the coach can point at (bin, bed, mailbox, board, shop, door). */
export interface CoachObject extends Tile {
  type: string;
  w: number;
  h: number;
  /** Doors: the map they lead to. */
  to?: string;
}

/** The world as the coach sees it (supplied by the scene each frame). */
export interface CoachWorld {
  map: string;
  tile: Tile;
  facing: Direction;
  /** What Action would do right now, and where. */
  action: { plan: string | null; tx: number; ty: number } | null;
  objects: readonly CoachObject[];
  npcs: readonly (Tile & { id: string })[];
  blocked(tx: number, ty: number): boolean;
  /** What Action would do on that tile with the auto tool (null: nothing). */
  actKind(tx: number, ty: number): string | null;
  /** Is the tile inside the world view? */
  inView(tx: number, ty: number): boolean;
  /** Water tiles of this map (to refill the can). */
  water?: readonly Tile[];
  /** The walk from the farmer to a tile (or beside it when solid), both ends included; null if none. */
  route?(tx: number, ty: number): readonly Tile[] | null;
}

/** UI facts the scene knows: the open sheet and the menu tab. */
export interface CoachFacts {
  panel: string | null;
  tab: string | null;
  /** Touches on the screen since `touchStep` showed on screen (an info line goes on the next touch). */
  touches?: number;
  touchStep?: string | null;
  /** Refusals in a row on this step without progress (the row tip yields after two). */
  refused?: number;
  /** What the lit Interact button would open now (`mailbox`, `bed`, `npc:mara`...), if anything. */
  interact?: string | null;
  /** With `panel: 'npc'`: whose sheet it is. */
  npc?: string | null;
}

/** After this many refusals in a row, the row tip gives way to the one-tile pointer. */
export const TIP_YIELD_REFUSALS = 2;

export type Pointer =
  /** A world tile; `face` is the way to face from it (a standing spot for Action). */
  | { kind: 'tile'; tx: number; ty: number; face?: Direction }
  | { kind: 'ui'; id: 'action' | 'menu' | 'interact'; tile?: Tile }
  | { kind: 'slot'; slot: number }
  | { kind: 'paint'; dir: Direction; tiles: Tile[] }
  | { kind: 'ring' }
  /** Steer with the stick (a drag on the world) this way: the target is far off screen. */
  | { kind: 'stick'; dir: Direction }
  | { kind: 'button'; pattern: string }
  | { kind: 'hud'; id: TutorialHud };

export interface CoachView {
  step: TutorialStep;
  text: string;
  pointer: Pointer | null;
  /** The target is on another map: the pointer is the door that leads there. */
  away: boolean;
  tag: TutorialHud | null;
  count: string | null;
}

const data = (): TutorialData => tutorial;

/** The coach line is one row: the widest text it may show (tests measure every line). */
export const COACH_LINE_PX = 184;
/** The labels sheets give their close button (Modal.closeButton), in English: buttons match through `toEnglish`. */
export const CLOSE_BUTTON = '^(Close|Done|Not now|Leave it)$'; // i18n-ok: a pattern over English labels
/** The shopkeeper's sheet's Shop button (NpcPanel), in English. */
export const SHOP_BUTTON = '^Shop$'; // i18n-ok: a pattern over English labels
/** The welcome strip's text box (two lines at most). */
export const WELCOME_PX = 158;
const DIRS: Direction[] = ['up', 'down', 'left', 'right'];
const VEC: Record<Direction, Tile> = {
  up: { tx: 0, ty: -1 },
  down: { tx: 0, ty: 1 },
  left: { tx: -1, ty: 0 },
  right: { tx: 1, ty: 0 },
};
/** A map's name with its article, inside a coach line ("Head back to the farm"). */
const mapName = (map: string): string => t(`mapTo.${map}` as Key);

// ---------------------------------------------------------------- on, off, replay

export const tutorialStep = (id: string): TutorialStep | undefined =>
  data().steps.find((st) => st.id === id);
export const tutorialOn = (s: GameState): boolean => s.stats['tut.on'] === 1 && !s.stats['tut.off'];
export const stepDone = (s: GameState, id: string): boolean => (s.stats[`tut.${id}`] ?? 0) > 0;

/** A fresh save that has never decided about the guide (day 1 of year 1, nothing done yet). */
export function isFreshGame(s: GameState): boolean {
  return (
    s.stats['tut.on'] === undefined &&
    s.stats['tut.off'] === undefined &&
    s.goalIndex === 0 &&
    s.time.year === 1 &&
    s.time.season === 'spring' &&
    s.time.day === 1 &&
    !s.stats['tilled'] &&
    !s.stats['harvested']
  );
}

/** Lay out the new-game gift once: ripe crops in the home plot and wild goods by the house. */
export function layGift(s: GameState): boolean {
  if (s.stats['tut.gift']) return false;
  s.stats['tut.gift'] = 1;
  const g = data().gift;
  const stages = crops[g.crop]?.stageDays.length ?? 1;
  for (const [tx, ty] of g.tiles) {
    const key = tileKey(tx, ty);
    if (s.farm.tiles[key]) continue;
    delete s.farm.weeds[key];
    s.farm.tiles[key] = {
      watered: false,
      crop: { cropId: g.crop, stage: stages, daysInStage: 0, regrow: false },
    };
  }
  for (const f of g.forage) {
    const map = f.map ?? g.map;
    const key = tileKey(f.tile[0], f.tile[1]);
    if (map === 'farm' && s.farm.tiles[key]) continue;
    (s.forage[map] ??= {})[key] = f.item;
  }
  gameEvents.emit('farmChanged', undefined);
  for (const map of new Set(g.forage.map((f) => f.map ?? g.map)))
    gameEvents.emit('forageChanged', { map });
  return true;
}

/** Start the guide on a new game (or not, `on` false), laying out the gift unless `gift` is false. */
export function startTutorial(s: GameState, opts: { on: boolean; gift: boolean }): void {
  if (opts.on) {
    s.stats['tut.on'] = 1;
    // a guided game meets its systems over days and weeks (systems/reveal.ts); a bare game sees them all
    startReveal(s);
  } else s.stats['tut.off'] = 1;
  if (opts.gift) layGift(s);
  // Day 2 is the letter and the walk to town: a rain morning waters day 1's crops (the sleep sheet says
  // "Tomorrow: Rain. No watering needed."), and daily watering is taught on the first dry morning instead.
  if (opts.on && data().day2Weather) s.forecast = data().day2Weather!;
}

/** Skip the whole guide (saved; Options can replay it). */
export function skipTutorial(s: GameState): void {
  s.stats['tut.off'] = 1;
  s.stats['tut.on'] = 1;
  gameEvents.emit('tutorialSkipped', undefined);
}

/** Skip just this step (offered after a long stall on an optional step). */
export function skipStep(s: GameState, id: string): void {
  if (stepDone(s, id)) return;
  s.stats[`tut.${id}`] = 1;
  const st = tutorialStep(id);
  if (st) gameEvents.emit('tutorialStep', { id, track: st.track, skipped: true });
}

/**
 * Run the guide again from the top: forget which steps were done, count every stat from now, and never touch
 * goals, gold, crops or the gift. Steps that cannot be done now (no ripe crop, nothing to ship) are passed.
 */
export function replayTutorial(s: GameState): void {
  for (const k of Object.keys(s.stats))
    if (k.startsWith('tut.') && k !== 'tut.gift') delete s.stats[k];
  for (const name of referencedStats()) s.stats[`tut.base.${name}`] = stat(s, name);
  s.stats['tut.on'] = 1;
}

/** Every stat any step reads (so a replay can count them from now). */
export function referencedStats(steps: readonly TutorialStep[] = data().steps): string[] {
  const out = new Set<string>();
  const walk = (c: TutorialCond | undefined): void => {
    if (!c) return;
    if (c.stat) out.add(c.stat);
    c.any?.forEach(walk);
    c.all?.forEach(walk);
    walk(c.not);
  };
  for (const st of steps) {
    st.done.forEach(walk);
    walk(st.when);
    walk(st.skip);
    st.alt?.forEach((a) => walk(a.when));
    if (st.count) out.add(st.count.stat);
  }
  return [...out];
}

/** The last world the scene described (so a stat watcher can advance the guide the moment a stat moves). */
let lastContext: { world: CoachWorld; facts: CoachFacts } | null = null;
export function setCoachContext(world: CoachWorld | null, facts: CoachFacts): void {
  lastContext = world ? { world, facts } : null;
}
export const coachContext = (): { world: CoachWorld; facts: CoachFacts } | null => lastContext;

/** A row was committed from Action (counted as a stat; the guide and future goals can read it). */
export function notePainted(s: GameState): void {
  addStat(s, 'painted');
}

// ---------------------------------------------------------------- conditions

interface Ctx {
  s: GameState;
  world: CoachWorld;
  facts: CoachFacts;
  step: TutorialStep;
  /** The step showed for the first time in this very check (its touch count belongs to the step before). */
  justSeen?: boolean;
}

const relStat = (s: GameState, name: string): number =>
  stat(s, name) - (s.stats[`tut.base.${name}`] ?? 0);
const freshStat = (s: GameState, id: string, name: string): number =>
  stat(s, name) - (s.stats[`tut.at.${id}.${name}`] ?? stat(s, name));
/** The game clock as one number (minutes since the first morning), for "minutes since this step showed". */
const clockNow = (s: GameState): number => absoluteDay(s) * 1440 + s.time.minutes;

function selectedIs(s: GameState, what: string): boolean {
  const st = s.inventory.slots[s.inventory.selected];
  const def = st ? items[st.item] : undefined;
  if (!def) return false;
  if (what.startsWith('tool:'))
    return def.type === 'tool' && tools[def.tool ?? '']?.action === what.slice(5);
  return def.type === what;
}

function soils(s: GameState): [string, GameState['farm']['tiles'][string]][] {
  return Object.entries(s.farm.tiles);
}

/** Does the world hold any of this kind right now? */
export function hasKind(s: GameState, kind: TutorialKind, world?: CoachWorld): boolean {
  switch (kind) {
    case 'ripe':
      return soils(s).some(([, t]) => !!t.crop && isMature(t.crop));
    case 'dry':
      return (
        s.weather === 'sunny' &&
        soils(s).some(([, t]) => !!t.crop && !t.watered && !isMature(t.crop))
      );
    case 'crops':
      return soils(s).some(([, t]) => !!t.crop);
    case 'wetCrop':
      return soils(s).some(([, t]) => !!t.crop && t.watered && !isMature(t.crop));
    case 'emptySoil':
      return soils(s).some(([, t]) => !t.crop);
    case 'seeds':
      return s.inventory.slots.some((st) => !!st && items[st.item]?.type === 'seed');
    case 'shippable':
      return s.inventory.slots.some((st) => !!st && isProduce(st.item) && isShippable(st));
    case 'forage':
      return Object.keys(s.forage[world?.map ?? 'farm'] ?? {}).length > 0;
    case 'unread':
      return s.mail.list.some((l) => !l.read);
    case 'readLetter':
      return s.mail.list.some((l) => l.read);
    case 'letterGift':
      return s.mail.list.some((l) => l.read && !!l.gift && !l.taken);
    case 'emptyCan':
      return s.water <= 0;
    case 'explicitHand':
      // the rod, a placeable or goods in hand: Action and taps do only what that item does (no auto tool)
      return !autoMode(s);
    case 'placeable':
      return s.inventory.slots.some((st, i) => !!st && i < 8 && items[st.item]?.placeable === true);
    case 'bait':
      return hasBait(s);
    case 'rocks':
      return Object.values(s.nodes[world?.map ?? 'mine'] ?? {}).some((n) => n === 'rock_node');
  }
}

/** A villager standing in view whom you have never talked to. */
export function newNpcInView(s: GameState, world: CoachWorld): (Tile & { id: string }) | null {
  let best: (Tile & { id: string }) | null = null;
  let bd = Infinity;
  for (const n of world.npcs) {
    const f = s.friends[n.id];
    if ((f && (f.talkedDay > 0 || f.points > 0)) || !world.inView(n.tx, n.ty)) continue;
    const d = dist(world.tile, n);
    if (d < bd) [best, bd] = [n, d];
  }
  return best;
}

/**
 * The settling-in days (depth round 4, `game.welcomeJobs`): today's jobs pay extra and one is still open. False
 * when the data has no such days, so the intro simply never shows.
 */
export function welcomeJobsToday(s: GameState): boolean {
  const w = (game as { welcomeJobs?: { from: number; to: number; factor: number } }).welcomeJobs;
  const day = absoluteDay(s);
  if (!w || w.factor <= 1 || day < w.from || day > w.to) return false;
  return s.jobs.day === day && s.jobs.list.some((j) => !j.done);
}

/** A project's goods are short: what the bag holds plus what was already given is under what it asks. */
export function goodsShort(s: GameState, project: string, item: string): boolean {
  const need = projects[project]?.items?.find((i) => i.item === item)?.qty ?? 0;
  return countItem(s, item) + (s.stats[`fund.${project}.${item}`] ?? 0) < need;
}

function forageInView(s: GameState, world: CoachWorld): boolean {
  return Object.keys(s.forage[world.map] ?? {}).some((k) => {
    const [x, y] = k.split(',').map(Number) as [number, number];
    return world.inView(x, y);
  });
}

export function holds(c: TutorialCond, ctx: Ctx): boolean {
  const { s, world, facts, step } = ctx;
  if (c.stat !== undefined || c.fresh !== undefined) {
    const v = c.fresh !== undefined ? freshStat(s, step.id, c.fresh) : relStat(s, c.stat!);
    if (c.min !== undefined && v < c.min) return false;
    if (c.max !== undefined && v > c.max) return false;
  }
  if (c.map !== undefined && world.map !== c.map) return false;
  if (c.day !== undefined && absoluteDay(s) < c.day) return false;
  if (c.panel !== undefined && facts.panel !== c.panel) return false;
  if (c.tab !== undefined && (facts.panel !== 'menu' || facts.tab !== c.tab)) return false;
  if (c.selected !== undefined && !selectedIs(s, c.selected)) return false;
  if (c.has !== undefined && !s.inventory.slots.some((st) => st?.item === c.has)) return false;
  if (c.none !== undefined && hasKind(s, c.none, world)) return false;
  if (c.some !== undefined && !hasKind(s, c.some, world)) return false;
  if (c.energyBelow !== undefined && s.energy >= maxEnergy(s) * c.energyBelow) return false;
  if (c.minute !== undefined && s.time.minutes < c.minute) return false;
  if (c.job !== undefined) {
    const today = s.jobs.day === absoluteDay(s) ? s.jobs.list : [];
    if (!today.some((j) => !j.done && j.stat === c.job && isTaken(s, j))) return false;
  }
  if (c.fact === 'jobsPosted' && postedJobs(s).length === 0) return false;
  if (
    c.fact === 'jobReady' &&
    !s.jobs.list.some((j) => jobReady(s, j) && !PAID_AT_PAYOUT.has(j.stat))
  )
    return false;
  if (c.fact === 'baitKinds' && baitKinds(s) < 2) return false;
  if (c.fact === 'fishResult' && !fishingResultShown()) return false;
  if (c.fact === 'festivalToday') {
    const f = festivalToday(s);
    if (!f || hasEntered(s, f.id)) return false;
  }
  if (c.short !== undefined && !goodsShort(s, c.short.project, c.short.item)) return false;
  if (c.daysSince !== undefined) {
    const at = s.stats[`tut.at.${c.daysSince.step}.clock`];
    if (at === undefined || absoluteDay(s) - Math.floor(at / 1440) < c.daysSince.min) return false;
  }
  if (c.npc !== undefined && !world.npcs.some((n) => n.id === c.npc)) return false;
  if (c.goal !== undefined && currentGoal(s)?.id !== c.goal) return false;
  if (c.fact === 'npcNew' && !newNpcInView(s, world)) return false;
  if (
    c.touched !== undefined &&
    (ctx.justSeen || facts.touchStep !== step.id || (facts.touches ?? 0) < c.touched)
  )
    return false;
  if (c.fact === 'forageInView' && !forageInView(s, world)) return false;
  if (c.fact === 'welcomeJobs' && !welcomeJobsToday(s)) return false;
  if (c.wet !== undefined && isWet(s.weather) !== c.wet) return false;
  // an intro waits for its feature's morning (the note and letter), not just for the tab
  if (c.revealed !== undefined && !(revealOn(s) && introduced(s, c.revealed))) return false;
  if (c.read !== undefined && !topicRead(s, c.read)) return false;
  if (c.after !== undefined) {
    const at = s.stats[`tut.at.${step.id}.clock`];
    if (at === undefined || clockNow(s) - at < c.after) return false;
  }
  if (c.any && !c.any.some((x) => holds(x, ctx))) return false;
  if (c.all && !c.all.every((x) => holds(x, ctx))) return false;
  if (c.not && holds(c.not, ctx)) return false;
  return true;
}

// ---------------------------------------------------------------- the machine

/** Remember when a step first showed, and the stats its `fresh` conditions count from. */
function markSeen(s: GameState, st: TutorialStep): boolean {
  if (s.stats[`tut.seen.${st.id}`]) return false;
  s.stats[`tut.seen.${st.id}`] = 1;
  for (const k of st.teaches ?? []) s.stats[k] = 1;
  const fresh = new Set<string>();
  const walk = (c: TutorialCond | undefined): void => {
    if (!c) return;
    if (c.fresh) fresh.add(c.fresh);
    c.any?.forEach(walk);
    c.all?.forEach(walk);
    walk(c.not);
  };
  st.done.forEach(walk);
  walk(st.skip);
  st.alt?.forEach((a) => walk(a.when));
  for (const name of fresh) s.stats[`tut.at.${st.id}.${name}`] = stat(s, name);
  s.stats[`tut.at.${st.id}.clock`] = clockNow(s);
  return true;
}

function finish(s: GameState, st: TutorialStep, out: string[]): void {
  s.stats[`tut.${st.id}`] = 1;
  out.push(st.id);
  gameEvents.emit('tutorialStep', { id: st.id, track: st.track, skipped: false });
}

/** The guided steps (the day-1 and day-2 tracks, not the one-off intros) in order: the tutorial funnel. */
export const guidedStepIds = (steps: readonly TutorialStep[] = data().steps): string[] =>
  steps.filter((st) => st.track !== 'intro').map((st) => st.id);

/** The day a paced intro (any intro but a `need` one) first showed: one new one a day. */
export const PACE_DAY = 'tut.paceDay';
const paced = (st: TutorialStep): boolean => st.track === 'intro' && !st.need;
/** The reveal feature an intro belongs to: the one its `when` waits for, the valley's, or none. */
function topicOf(st: TutorialStep): string | null {
  if (st.valley) return 'valley';
  let found: string | null = null;
  const walk = (c: TutorialCond | undefined): void => {
    if (!c || found) return;
    if (c.revealed) found = c.revealed;
    c.any?.forEach(walk);
    c.all?.forEach(walk);
  };
  walk(st.when);
  return found;
}
/** The feature this morning introduced, if any. */
function arrivedToday(s: GameState): string | null {
  if (!revealOn(s)) return null;
  const day = absoluteDay(s);
  return reveal.features.find((f) => s.stats[`reveal.${f.id}`] === day)?.id ?? null;
}

/** Mark finished steps done; return the step to show now (null: nothing to coach) and what finished. */
export function advance(
  s: GameState,
  world: CoachWorld,
  facts: CoachFacts,
  steps: readonly TutorialStep[] = data().steps,
): { current: TutorialStep | null; completed: string[] } {
  const completed: string[] = [];
  if (!tutorialOn(s)) return { current: null, completed };
  outer: for (const track of ['day1', 'day2'] as const) {
    for (const st of steps) {
      if (st.track !== track || stepDone(s, st.id)) continue;
      const ctx: Ctx = { s, world, facts, step: st };
      const on = !st.when || holds(st.when, ctx);
      if (on) ctx.justSeen = markSeen(s, st);
      // A day-1 step done early (the bed before evening) still counts; day-2 steps wait for their day.
      const over = (st.skip && holds(st.skip, ctx)) || st.done.some((c) => holds(c, ctx));
      if ((on || track === 'day1') && over) {
        finish(s, st, completed);
        continue;
      }
      if (!on) break outer; // the track waits for this step's moment; meanwhile introductions may show
      return { current: st, completed };
    }
  }
  // No track step to show: one-off introductions. One already leading the player to another map (shown, not done,
  // its target on a map) keeps the floor while its moment holds, so an intro on the way (Clay's in town) cannot
  // hijack the walk to the mine (critic D2-4). Otherwise the first that applies.
  const leading = steps.filter(
    (st) =>
      st.track === 'intro' &&
      !stepDone(s, st.id) &&
      s.stats[`tut.seen.${st.id}`] &&
      (st.target?.map ?? st.target?.else?.map) !== undefined,
  );
  for (const st of leading) {
    const ctx: Ctx = { s, world, facts, step: st };
    if (st.when && !holds(st.when, ctx)) continue;
    if ((st.skip && holds(st.skip, ctx)) || st.done.some((c) => holds(c, ctx))) {
      finish(s, st, completed);
      continue;
    }
    return { current: st, completed };
  }
  for (const st of steps) {
    if (st.track !== 'intro' || stepDone(s, st.id)) continue;
    // at most one new paced intro a day (all but the `need` ones): another waits for tomorrow,
    // unmarked meanwhile (tutorial review: one new thing a morning, never two systems at once); on the morning a
    // feature arrives, a paced intro of another topic waits too (critic C1-5: fishing and the spring's ask)
    if (paced(st) && !s.stats[`tut.seen.${st.id}`]) {
      if (s.stats[PACE_DAY] === absoluteDay(s)) continue;
      const today = arrivedToday(s);
      if (today && topicOf(st) !== today) continue;
    }
    const ctx = { s, world, facts, step: st };
    const on = !st.when || holds(st.when, ctx);
    if (!on) {
      if (st.leave && s.stats[`tut.seen.${st.id}`]) finish(s, st, completed);
      continue;
    }
    (ctx as Ctx).justSeen = markSeen(s, st);
    if (paced(st) && (ctx as Ctx).justSeen) s.stats[PACE_DAY] = absoluteDay(s);
    if ((st.skip && holds(st.skip, ctx)) || st.done.some((c) => holds(c, ctx))) {
      finish(s, st, completed);
      continue;
    }
    return { current: st, completed };
  }
  return { current: null, completed };
}

/** Are the day-1 and day-2 guided tracks finished (intros may follow)? */
export function guidedTracksDone(
  s: GameState,
  steps: readonly TutorialStep[] = data().steps,
): boolean {
  return steps.every((st) => st.track === 'intro' || stepDone(s, st.id));
}

/** Is the day-1 guided morning (the first wake-up of a guided save) the one being summarised? */
export function guidedMorning(s: GameState): boolean {
  return tutorialOn(s) && absoluteDay(s) === 2 && !stepDone(s, 'town');
}

/** The one morning note a guided first morning keeps: the letter if there is one, else the first. */
export function guidedNotes(notes: readonly string[]): string[] {
  // notes are in the player's language; the letter one is found by its English
  const letter = notes.find((n) => /letter/i.test(toEnglish(n)));
  const can = notes.find((n) => n === canNote());
  const out = letter ? [letter] : notes.filter((n) => n !== canNote()).slice(0, 1);
  return can ? [can, ...out] : out;
}

/** The first guided morning: Rosa fills the can, so day 2's watering never starts at an empty can. */
export const canNote = (): string => t('tutorial.canNote');
export function guidedMorningCan(s: GameState, capacity: number): boolean {
  if (!tutorialOn(s) || absoluteDay(s) !== 2 || s.stats['tut.can']) return false;
  s.stats['tut.can'] = 1;
  if (s.water >= capacity) return false;
  s.water = capacity;
  // On a rain morning the can is filled quietly: the note would only be noise next to "crops are watered".
  return !isWet(s.weather);
}

// ---------------------------------------------------------------- what to show

const dist = (a: Tile, b: Tile): number => Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);

function nearest<T extends Tile>(from: Tile, list: readonly T[]): T | null {
  let best: T | null = null;
  let bd = Infinity;
  for (const t of list) {
    const d = dist(from, t);
    if (d < bd) [best, bd] = [t, d];
  }
  return best;
}

const keyTiles = (rec: Record<string, unknown>): Tile[] =>
  Object.keys(rec).map((k) => {
    const [tx, ty] = k.split(',').map(Number) as [number, number];
    return { tx, ty };
  });

/** Tiles of the farm the player owns (the plots), for "workable" searches. */
function ownedTiles(s: GameState): Tile[] {
  const out: Tile[] = [];
  for (const id of s.plots) {
    const p = plots[id];
    if (!p || p.greenhouse) continue;
    const [x, y, w, h] = p.rect;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) out.push({ tx: i, ty: j });
  }
  return out;
}

const WORK = ['till', 'plant', 'water'];

/** The things a `find` target means, on the current map. */
function findAll(s: GameState, world: CoachWorld, find: string): Tile[] {
  const farm = world.map === 'farm';
  const soil = (pred: (t: GameState['farm']['tiles'][string]) => boolean): Tile[] =>
    farm ? keyTiles(Object.fromEntries(soils(s).filter(([, t]) => pred(t)))) : [];
  switch (find) {
    case 'ripe':
      return soil((t) => !!t.crop && isMature(t.crop));
    case 'dry':
      return soil((t) => !!t.crop && !t.watered && !isMature(t.crop));
    case 'emptySoil':
      return soil((t) => !t.crop);
    case 'workable':
      return farm
        ? ownedTiles(s).filter((t) => WORK.includes(world.actKind(t.tx, t.ty) ?? ''))
        : [];
    case 'forage':
      return keyTiles(s.forage[world.map] ?? {});
    case 'node':
      return keyTiles(s.nodes[world.map] ?? {});
    case 'water':
      return [...(world.water ?? [])];
    case 'npcNew': {
      const n = newNpcInView(s, world);
      return n ? [n] : [];
    }
  }
  return [];
}

/** A free tile beside `t` to stand on and face it from (the player's own tile counts), nearest first. */
function standBeside(world: CoachWorld, t: Tile): Pointer | null {
  let best: Pointer | null = null;
  let bd = Infinity;
  for (const d of DIRS) {
    const v = VEC[d];
    const at = { tx: t.tx - v.tx, ty: t.ty - v.ty };
    const own = at.tx === world.tile.tx && at.ty === world.tile.ty;
    if (!own && world.blocked(at.tx, at.ty)) continue;
    const dd = dist(world.tile, at);
    if (dd < bd) [best, bd] = [{ kind: 'tile', tx: at.tx, ty: at.ty, face: d }, dd];
  }
  return best;
}

/** One tile of a (possibly multi-tile) object that has a free side, nearest the player. */
function objectTile(world: CoachWorld, o: CoachObject): Tile {
  const tiles: Tile[] = [];
  for (let j = 0; j < o.h; j++)
    for (let i = 0; i < o.w; i++) {
      const t = { tx: o.tx + i, ty: o.ty + j };
      const free = DIRS.some((d) => {
        const n = { tx: t.tx + VEC[d].tx, ty: t.ty + VEC[d].ty };
        const inside = n.tx >= o.tx && n.ty >= o.ty && n.tx < o.tx + o.w && n.ty < o.ty + o.h;
        return !inside && !world.blocked(n.tx, n.ty);
      });
      if (free) tiles.push(t);
    }
  return nearest(world.tile, tiles) ?? { tx: o.tx, ty: o.ty };
}

/**
 * The row tip: an unbroken line of at least two tiles of work starting right beside the farmer. Straight ahead
 * (from the faced tile) wins, so a player who ignores the tip and presses Action still works the row's first
 * tile and the direction does not flip while the farmer stands still (round-4 critic: 2-4 directions in one
 * step); else the longest such row another way (a press there may be refused: two refusals and the tip gives
 * way, see TIP_YIELD_REFUSALS). Only `kinds` count: while watering, a row is dry crops, never grass to till (it
 * used to preview a tilling row).
 */
export function bestPaint(
  world: CoachWorld,
  max = 5,
  kinds: readonly string[] = WORK,
): { dir: Direction; tiles: Tile[] } | null {
  const row = (d: Direction): Tile[] => {
    const tiles: Tile[] = [];
    for (let i = 1; i <= max; i++) {
      const t = { tx: world.tile.tx + VEC[d].tx * i, ty: world.tile.ty + VEC[d].ty * i };
      if (!kinds.includes(world.actKind(t.tx, t.ty) ?? '')) break;
      tiles.push(t);
    }
    return tiles;
  };
  const ahead = row(world.facing);
  if (ahead.length >= 2) return { dir: world.facing, tiles: ahead };
  let best: { dir: Direction; tiles: Tile[] } | null = null;
  for (const d of DIRS) {
    if (d === world.facing) continue;
    const tiles = row(d);
    if (tiles.length >= 2 && (!best || tiles.length > best.tiles.length)) best = { dir: d, tiles };
  }
  return best;
}

/**
 * The way to drag the stick toward a far door: the direction the real walk takes for its next 4 tiles. When the
 * walk turns sooner (a woodpile, a stump, the pond in the way: round-4 critic, a 115 s stall), null: the tap and
 * its arrow, which follow the walk around obstacles, lead on instead. Without a route, the straight way must be
 * open for 4 tiles.
 */
export function steerDir(world: CoachWorld, to: Tile): Direction | null {
  const STRAIGHT = 4;
  const path = world.route?.(to.tx, to.ty);
  if (path) {
    if (path.length <= STRAIGHT) return null;
    let dir: Direction | null = null;
    for (let i = 1; i <= STRAIGHT; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const d = DIRS.find((k) => VEC[k].tx === b.tx - a.tx && VEC[k].ty === b.ty - a.ty) ?? null;
      if (!d || (dir && d !== dir)) return null;
      dir = d;
    }
    return dir;
  }
  const dx = to.tx - world.tile.tx;
  const dy = to.ty - world.tile.ty;
  const dir: Direction =
    Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  const clear = [1, 2, 3, 4].every(
    (i) => !world.blocked(world.tile.tx + VEC[dir].tx * i, world.tile.ty + VEC[dir].ty * i),
  );
  return clear ? dir : null;
}

/**
 * Where an off-screen target's arrow goes: the farthest tile of the walk to it that is still in view, so a tap
 * on the arrow walks the real way (round 2: an arrow on the straight line landed on the pond and did nothing).
 * Null without a route (the caller falls back to where the straight line leaves the view).
 */
export function routeWaypoint(
  world: CoachWorld,
  to: Tile,
  visible: (t: Tile) => boolean,
): Tile | null {
  const path = world.route?.(to.tx, to.ty);
  if (!path || path.length < 2) return null;
  let best: Tile | null = null;
  for (let i = 1; i < path.length; i++) {
    const t = path[i]!;
    if (!visible(t)) break;
    // a plain walk tile: a tap there walks, it never works soil or picks something up on the way
    if (!world.actKind(t.tx, t.ty)) best = t;
  }
  return best;
}

function slotOf(s: GameState, pred: (item: string) => boolean): number | null {
  const last = s.controls.lastSeed;
  for (let i = 0; i < 8; i++) {
    const st = s.inventory.slots[i];
    if (st && pred(st.item) && (!last || st.item === last)) return i;
  }
  for (let i = 0; i < 8; i++) {
    const st = s.inventory.slots[i];
    if (st && pred(st.item)) return i;
  }
  return null;
}

/** Resolve a target to a pointer on the current map (null when there is nothing to point at). */
export function resolveTarget(s: GameState, world: CoachWorld, g: TutorialTarget): Pointer | null {
  if (g.action) {
    if (world.action?.plan && g.action.includes(world.action.plan))
      return { kind: 'ui', id: 'action', tile: { tx: world.action.tx, ty: world.action.ty } };
    return g.else ? resolveTarget(s, world, g.else) : null;
  }
  if (g.find) {
    const t = nearest(world.tile, findAll(s, world, g.find));
    if (!t) return null;
    return g.stand ? standBeside(world, t) : { kind: 'tile', ...t };
  }
  if (g.npc) {
    const n = world.npcs.find((x) => x.id === g.npc);
    return n ? { kind: 'tile', tx: n.tx, ty: n.ty } : null;
  }
  if (g.object) {
    const os = world.objects.filter((o) => o.type === g.object);
    const o = nearest(world.tile, os);
    return o ? { kind: 'tile', ...objectTile(world, o) } : null;
  }
  if (g.door) {
    const d = nearest(
      world.tile,
      world.objects.filter((o) => o.type === 'door' && o.to === g.door),
    );
    return d ? { kind: 'tile', tx: d.tx, ty: d.ty } : null;
  }
  if (g.steer) {
    // A long walk to a door: teach the stick (a drag on the world steers); once the door shows, tap it.
    const d = nearest(
      world.tile,
      world.objects.filter((o) => o.type === 'door' && o.to === g.steer),
    );
    if (!d) return null;
    if (world.inView(d.tx, d.ty) && dist(world.tile, d) <= 6)
      return { kind: 'tile', tx: d.tx, ty: d.ty };
    const dir = steerDir(world, d);
    return dir ? { kind: 'stick', dir } : { kind: 'tile', tx: d.tx, ty: d.ty };
  }
  if (g.ui === 'canSlot') {
    const i = slotOf(s, (it) => tools[items[it]?.tool ?? '']?.action === 'water');
    return i === null ? null : { kind: 'slot', slot: i };
  }
  if (g.ui === 'seedSlot') {
    const i = slotOf(s, (it) => items[it]?.type === 'seed');
    return i === null ? null : { kind: 'slot', slot: i };
  }
  if (g.ui === 'spadeSlot') {
    const i = slotOf(s, (it) => it === 'spade');
    return i === null ? null : { kind: 'slot', slot: i };
  }
  if (g.ui === 'hoeSlot' || g.ui === 'pickSlot') {
    const action = g.ui === 'hoeSlot' ? 'till' : 'mine';
    const i = slotOf(s, (it) => tools[items[it]?.tool ?? '']?.action === action);
    return i === null ? null : { kind: 'slot', slot: i };
  }
  if (g.ui === 'placeSlot') {
    const i = slotOf(s, (it) => items[it]?.placeable === true);
    return i === null ? null : { kind: 'slot', slot: i };
  }
  if (g.ui) return { kind: 'ui', id: g.ui };
  if (g.gesture === 'ring') return { kind: 'ring' };
  if (g.gesture === 'paint') {
    const p = bestPaint(world, 5, g.work ?? WORK);
    return p ? { kind: 'paint', dir: p.dir, tiles: p.tiles } : null;
  }
  if (g.button) return { kind: 'button', pattern: g.button };
  if (g.hud) return { kind: 'hud', id: g.hud };
  return null;
}

/** The door from this map toward `map` (direct, else back through the farm, else the town). */
/** The next map on the shortest walk from `from` to `to` through the maps' doors (`maps.json` links), if any. */
export function nextMapToward(from: string, to: string): string | null {
  if (from === to) return null;
  const prev = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const next of mapsData.maps[at]?.links ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, at);
      if (next === to) {
        let hop = next;
        while (prev.get(hop) !== from) hop = prev.get(hop)!;
        return hop;
      }
      queue.push(next);
    }
  }
  return null;
}

function doorToward(world: CoachWorld, map: string): CoachObject | null {
  const doors = world.objects.filter((o) => o.type === 'door');
  // the door on the way (farm -> town -> woods -> mine), never a door back the way you came (critic D2-1)
  const hop = nextMapToward(world.map, map);
  for (const to of hop ? [hop] : [map, 'farm', 'town']) {
    const d = nearest(
      world.tile,
      doors.filter((o) => o.to === to),
    );
    if (d) return d;
  }
  return null;
}

function fill(text: string, s: GameState, world: CoachWorld, pointer: Pointer | null): string {
  let out = text;
  if (out.includes('{dir}'))
    out = out.replace('{dir}', t(`dir.${pointer?.kind === 'paint' ? pointer.dir : 'down'}` as Key));
  if (out.includes('{dry}')) {
    const n = soils(s).filter(([, t]) => !!t.crop && !t.watered && !isMature(t.crop)).length;
    out = out.replace('{dry}', String(n));
  }
  if (out.includes('{npc}')) {
    const n = newNpcInView(s, world);
    out = out.replace('{npc}', n ? (npcs[n.id]?.name ?? n.id) : t('tutorial.them'));
  }
  return out;
}

/** What the coach shows for the current step: the line, the pointer and the HUD tag. */
export function coachView(
  s: GameState,
  world: CoachWorld,
  facts: CoachFacts,
  st: TutorialStep,
): CoachView {
  const ctx = { s, world, facts, step: st };
  let text = st.text;
  let target = st.target;
  let fromAlt = false;
  for (const a of st.alt ?? []) {
    // Never leave a player looping on a refusal: once Action was refused twice, no row tip (round 5 blocker:
    // a never-painter facing a planted tile pressed Action 376 times under the tip).
    if (a.target?.gesture === 'paint' && (facts.refused ?? 0) >= TIP_YIELD_REFUSALS) continue;
    if (holds(a.when, ctx)) {
      text = a.text;
      target = a.target;
      fromAlt = true;
      break;
    }
  }
  let pointer: Pointer | null = null;
  let away = false;
  // A target on another map (and not in an open sheet): point at the door that leads there.
  const wantMap = target?.map ?? target?.else?.map;
  if (target && wantMap && wantMap !== world.map && !target.button) {
    const d = doorToward(world, wantMap);
    pointer = d ? { kind: 'tile', tx: d.tx, ty: d.ty } : null;
    away = true;
    // A one-off intro keeps its own line (it says why: "The spring wants stone: the mine.") while the pointer
    // leads to the door; the guided days' steps say where to head.
    if (st.track !== 'intro')
      text =
        world.map === 'house'
          ? t('tutorial.doorOutside')
          : t('tutorial.headBack', { map: mapName(wantMap) });
  } else if (target) {
    pointer = resolveTarget(s, world, target);
    // The line follows the pointer: with Action not ready, the "else" line says where to go first.
    if (target.action && pointer?.kind !== 'ui' && st.elseText) text = st.elseText;
    if (target.gesture === 'paint' && !pointer && fromAlt) {
      // the row tip has no good line from here: fall back to the step's own target
      text = st.text;
      pointer = st.target ? resolveTarget(s, world, st.target) : null;
      if (st.target?.action && pointer?.kind !== 'ui' && st.elseText) text = st.elseText;
    }
  }
  // Right by the thing (the Interact button lit for it): point at that button too, since a tap that lands a few
  // pixels off the one-tile mailbox hits the farmer's own tile and does nothing (round 5: 300 s on mail).
  const lit = facts.interact ?? null;
  if (
    pointer?.kind === 'tile' &&
    lit &&
    !away &&
    ((target?.object && lit === target.object) ||
      (target?.npc && (lit === `npc:${target.npc}` || lit === 'npc')))
  ) {
    pointer = { kind: 'ui', id: 'interact', tile: { tx: pointer.tx, ty: pointer.ty } };
    text = t(target?.npc ? 'tutorial.litTalk' : 'tutorial.litOpen');
  }
  // The step points at a villager whose own sheet is open: the way on is inside it, never Close. A shopkeeper's
  // sheet leads on through its Shop button (owner bug: "when you tap Mara it shows to tap on Close").
  const sheetNpc =
    target?.npc && facts.panel === 'npc' && facts.npc === target.npc ? target.npc : null;
  if (sheetNpc && npcs[sheetNpc]?.role === 'shop') {
    pointer = { kind: 'button', pattern: SHOP_BUTTON };
    text = t('tutorial.tapShop');
    away = false;
  }
  // A sheet is open but the step wants the world: say how to get back to it.
  if (
    facts.panel &&
    facts.panel !== 'summary' &&
    pointer?.kind !== 'button' &&
    pointer?.kind !== 'hud'
  ) {
    text =
      facts.panel === 'menu' && facts.tab === 'goals'
        ? t('tutorial.readJobs')
        : t('tutorial.closeToCarryOn');
    pointer = { kind: 'button', pattern: CLOSE_BUTTON };
    away = false;
  }
  const count = st.count
    ? `${Math.min(st.count.of, Math.max(0, relStat(s, st.count.stat)))}/${st.count.of}`
    : null;
  return {
    step: st,
    text: fill(text, s, world, pointer),
    pointer,
    away,
    tag: st.tag ?? null,
    count,
  };
}

/** A refusal said in the coach line, in the guide's words where the game's would mislead a beginner. */
export function rewriteRefusal(text: string, stepId?: string | null): string {
  const st = stepId ? tutorialStep(stepId) : undefined;
  // the refusal maps are keyed by the game's English refusal (tutorial.json); their values are translated
  const en = toEnglish(text);
  return st?.refusals?.[en] ?? data().refusals?.[en] ?? text;
}

/** The speaker's name and the welcome line (shown while the first step runs). */
export function welcome(): { name: string; npc: string; text: string } {
  const d = data();
  return { name: npcs[d.speaker]?.name ?? d.speaker, npc: d.speaker, text: d.welcome };
}

/** Every line the coach can show (tests prove each fits one row). */
export function allLines(steps: readonly TutorialStep[] = data().steps): string[] {
  const out: string[] = [];
  for (const st of steps) {
    out.push(st.text);
    if (st.elseText) out.push(st.elseText);
    for (const a of st.alt ?? []) out.push(a.text);
  }
  const dirs = (['up', 'down', 'left', 'right'] as const).map((d) => t(`dir.${d}` as Key));
  out.push(...Object.values(data().refusals ?? {}));
  for (const st of steps) out.push(...Object.values(st.refusals ?? {}));
  out.push(
    t('tutorial.readJobs'),
    t('tutorial.litOpen'),
    t('tutorial.litTalk'),
    t('tutorial.closeToCarryOn'),
    t('tutorial.tapShop'),
    t('tutorial.doorOutside'),
    ...['farm', 'town', 'woods', 'mine'].map((m) => t('tutorial.headBack', { map: mapName(m) })),
  );
  const names = Object.values(npcs).map((n) => n.name);
  return out
    .map((t) => t.replace('{dry}', '12'))
    .flatMap((t) =>
      t.includes('{dir}')
        ? dirs.map((d) => t.replace('{dir}', d))
        : t.includes('{npc}')
          ? names.map((n) => t.replace('{npc}', n))
          : [t],
    );
}

/** Jobs a step can point at exist (data sanity used by tests). */
export const jobStats = (): string[] => jobDefs.map((j) => j.stat);
