// New-player e2e: a bot that only follows the guided start's coach marks (where the hand points, what the line
// says to do) plays a fresh game from the title screen to town on day 2, with real CDP touches on iPhone 13 and
// SE, right and left hand. No debug shortcuts: the page is read (`?debug`) to see where the hand points, the
// same thing a player sees, and never written. Run `npm run build` first.
//
// Env: PROFILES=i13,se  HANDS=right,left  SHOTS=<dir> (a screenshot per step)  E2E_ONBOARDING_PORT
// Headless emulation only: it proves the guide never dead-ends, not that a person finds it pleasant.
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  PROFILES,
  Thumb,
  geometry,
  launch,
  liveTargets,
  sleep,
  startPreview,
} from './thumb-lib.mjs';

const PORT = Number(process.env.E2E_ONBOARDING_PORT ?? Number(process.env.E2E_PORT ?? 4173) + 20);
const which = (process.env.PROFILES ?? 'i13,se').split(',');
const hands = (process.env.HANDS ?? 'right,left').split(',');
const SHOTS = process.env.SHOTS ?? '';
const STALL_MS = 50_000;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
};

const { url, stop } = await startPreview(PORT);
const browser = await launch();
const results = [];

async function run(p, hand, deviant = false) {
  const tag = `${p.id} ${hand}${deviant ? ' wanderer' : ''}`;
  const ctx = await browser.newContext({
    viewport: { width: p.w, height: p.h },
    deviceScaleFactor: p.dpr,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: p.insets });
  await page.goto(`${url}?debug`);
  await page.waitForFunction(
    () => window.__farm?.game?.scene?.getScene('Title')?.sys.isActive(),
    null,
    {
      timeout: 20000,
    },
  );
  await sleep(600);
  const geo = await geometry(page);
  const t = new Thumb(cdp, geo, p, hand);
  const shotDir = SHOTS ? `${SHOTS}/${p.id}-${hand}${deviant ? '-wanderer' : ''}` : '';
  if (shotDir) mkdirSync(shotDir, { recursive: true });
  const shot = async (name) => shotDir && page.screenshot({ path: `${shotDir}/${name}.png` });

  const coach = () =>
    page.evaluate(() => {
      const f = window.__farm;
      const ui = f.game.scene.getScene('UI');
      const s = f.getState();
      return {
        coach: ui?.coach?.debug?.() ?? null,
        map: s.player.map,
        x: s.player.x,
        y: s.player.y,
        day: s.time.day,
        minutes: s.time.minutes,
        goal: ui?.hud?.goalLabel?.main?.text ?? '',
        sheets: ui
          ? ui
              .allModals()
              .filter((m) => m.isOpen)
              .map((m) => m.constructor.name)
          : [],
        left: s.settings.leftHanded,
        action: ui?.layout?.action,
      };
    });
  const tapText = async (re) => {
    const target = (await liveTargets(page)).find((x) => re.test(x.text));
    if (!target) return false;
    await t.tap(target.cx, target.cy, 70);
    return true;
  };
  /** Wait until the farmer stops moving (a tap's walk ended), at most `max` ms. */
  const settle = async (max = 7000) => {
    let last = null;
    let still = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < max) {
      const c = await coach();
      const k = `${c.map}:${Math.round(c.x)},${Math.round(c.y)}:${c.sheets.length}`;
      still = k === last ? still + 1 : 0;
      last = k;
      if (still >= 3) return;
      await sleep(120);
    }
  };

  // Title -> New Game, by touch (the only button on a first launch, 150 x 30 at y 200).
  await t.tap(100, 215, 70);
  await page.waitForFunction(() => window.__farm.game.scene.getScene('UI')?.sys.isActive(), null, {
    timeout: 20000,
  });
  await sleep(1200);
  const t0 = Date.now();
  t.reset();
  const timeline = [];
  let first = await coach();
  check(
    `${tag}: a new game opens on the first coach step with Rosa's welcome`,
    first.coach?.step === 'harvest' && first.coach?.welcome,
    JSON.stringify(first.coach),
  );
  await shot('00-start');
  if (hand === 'left') {
    // A left-handed player answers the welcome strip's question.
    check(`${tag}: the welcome strip offers Left hand`, await tapText(/^Left hand/));
    await sleep(500);
    first = await coach();
    check(
      `${tag}: Left hand mirrors the dock`,
      first.left && first.action.x < 100,
      JSON.stringify(first.action),
    );
  }

  if (deviant) {
    // A player who ignores the guide at first: presses Action on the wrong grass and wanders south.
    const L = first.action;
    await t.tap(L.x, L.y, 70);
    await sleep(400);
    const k = await coach();
    check(
      `${tag}: a refusal shows in the coach line, not as a second message`,
      k.coach?.refusals === 1,
      JSON.stringify(k.coach),
    );
    for (let i = 0; i < 3; i++) {
      await t.tap(150, 280, 70);
      await sleep(250);
      await settle();
    }
  }
  let openedMenu = false;
  let barTested = false;
  let rodTested = false;
  let step = null;
  let stepSince = Date.now();
  let firstHarvestS = null;
  let firstGoalS = null;
  let lastGoal = first.goal;
  let guard = 0;
  let paintSeen = false;
  const infoLines = [];
  let freeTaps = 0;
  let stickUsed = false;
  let dayOne = null;
  while (guard++ < 1500) {
    const c = await coach();
    if (c.day === 2 && !dayOne) dayOne = { s: Math.round((Date.now() - t0) / 1000), ...t.ledger() };
    if (c.goal !== lastGoal && firstGoalS === null) firstGoalS = (Date.now() - t0) / 1000;
    lastGoal = c.goal;
    // The morning summary is a sheet to acknowledge (no coach mark): tap its Wake up button.
    if (!c.coach?.visible && (await liveTargets(page)).some((x) => /^Wake up$/.test(x.text))) {
      await sleep(400);
      await shot('09-morning');
      await tapText(/^Wake up$/);
      await sleep(900);
      continue;
    }
    const k = c.coach;
    if (k?.step !== step) {
      if (step) timeline.push({ step, s: Math.round((Date.now() - stepSince) / 100) / 10 });
      if (step === 'harvest' && firstHarvestS === null) firstHarvestS = (Date.now() - t0) / 1000;
      step = k?.step ?? null;
      stepSince = Date.now();
      if (step) await shot(`${String(timeline.length + 1).padStart(2, '0')}-${step}`);
    }
    if (c.map === 'town' && c.day >= 2) break;
    if (Date.now() - t0 > 8 * 60_000) {
      check(
        `${tag}: reaches town on day 2 within 8 minutes`,
        false,
        `${step} ${JSON.stringify(k)}`,
      );
      break;
    }
    if (step && Date.now() - stepSince > STALL_MS) {
      check(`${tag}: never stalls on a step`, false, `stuck on ${step}: ${JSON.stringify(k)}`);
      break;
    }
    if (k?.visible && k.pointer?.kind === 'hud' && !k.aim) {
      // An info line (clock, energy, errands): read it, then simply carry on playing (a tap on the world).
      infoLines.push(k.step);
      await sleep(1600);
      await t.tap(100, 230, 70);
      await sleep(500);
      continue;
    }
    if (!k || !k.visible || !k.aim) {
      // Free play: no coach mark. Follow what else the screen offers: the goal's own arrow (it appears after
      // a quiet spell) and, for "Sleep in bed when you're ready", the bed sheet's Sleep button.
      if (/^Sleep in bed/.test(c.goal) && (await tapText(/^Sleep$/))) {
        await sleep(1500);
        continue;
      }
      // A sheet left open after an introduction: a player closes it.
      if (await tapText(/^(Close|Done|Not now|Leave it)$/)) {
        await sleep(500);
        continue;
      }
      const arrow = await page.evaluate(() => {
        const w = window.__farm.game.scene.getScenes(true).find((x) => x.grid);
        const g = w?.arrow;
        if (!g?.visible) return null;
        const cam = w.cameras.main;
        return { x: Math.round(g.x + cam.x), y: Math.round(g.y + cam.y) };
      });
      if (arrow) {
        freeTaps++;
        if (process.env.DEBUG)
          console.log(
            `      free ${tag} goal "${c.goal}" ${c.map} @${Math.round(c.x / 16)},${Math.round(c.y / 16)} ${c.minutes} arrow ${arrow.x},${arrow.y}`,
          );
        await t.tap(arrow.x, arrow.y, 70);
        await sleep(250);
        await settle();
        continue;
      }
      await sleep(400);
      continue;
    }
    if (deviant && k.step === 'water' && !rodTested) {
      // ...picks the rod on the hotbar by mistake: the coach asks for the can first.
      rodTested = true;
      await t.tap(88.5, 383.5, 70);
      await sleep(500);
      const kr = (await coach()).coach;
      check(
        `${tag}: with the rod in hand, the coach points at the can`,
        kr?.text === 'Tap the can on the hotbar first.' && kr.pointer?.kind === 'slot',
        JSON.stringify(kr),
      );
      continue;
    }
    if (deviant && k.step === 'grow' && !barTested) {
      // A stray tap on the coach line itself, then on its "..." button: neither hides the guide for good.
      barTested = true;
      const bar = await page.evaluate(() => {
        const ui = window.__farm.game.scene.getScene('UI');
        const z = ui.coach.barZone;
        return { gx: z.x, gy: z.y };
      });
      await t.tap(100, bar.gy, 70);
      await sleep(500);
      const k1 = (await coach()).coach;
      check(
        `${tag}: a stray tap on the coach line leaves the guide showing`,
        k1?.visible && !!k1.aim && k1.step === 'grow',
        JSON.stringify(k1),
      );
      await t.tap(bar.gx, bar.gy, 70);
      await sleep(400);
      const k2 = (await coach()).coach;
      const menuShown = await page.evaluate(
        () => window.__farm.game.scene.getScene('UI').coach.menuOpen,
      );
      check(
        `${tag}: the "..." opens Skip guide / Back (and no hand meanwhile)`,
        menuShown && !k2.aim,
        JSON.stringify(k2),
      );
      await sleep(4600);
      const k3 = (await coach()).coach;
      const menuAfter = await page.evaluate(
        () => window.__farm.game.scene.getScene('UI').coach.menuOpen,
      );
      check(
        `${tag}: the line's menu closes by itself and the hand returns`,
        !menuAfter && !!k3.aim && k3.visible,
        JSON.stringify(k3),
      );
      continue;
    }
    if (deviant && k.step === 'ship' && !openedMenu) {
      // ...and opens the Menu in the middle of a step: the coach must lead back out.
      openedMenu = true;
      const L =
        c.coach && (await page.evaluate(() => window.__farm.game.scene.getScene('UI').layout.menu));
      await t.tap(L.x, L.y, 70);
      await sleep(600);
      const k2 = await coach();
      check(
        `${tag}: with the Menu open mid-step, the coach points at its close button`,
        k2.coach?.text === 'Close this to carry on.' && k2.coach?.aim,
        JSON.stringify(k2.coach),
      );
      continue;
    }
    const a = k.aim;
    if (a.x < 0 || a.x > 200 || a.y < 0 || a.y > 400)
      check(`${tag}: the hand points on screen`, false, JSON.stringify(a));
    await sleep(250); // a moment to read
    if (a.kind === 'tap' || a.kind === 'edge') {
      await t.tap(a.x, a.y, 70);
      await sleep(250);
      await settle();
    } else if (a.kind === 'paint') {
      paintSeen = true;
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[a.dir];
      await t.down(a.x, a.y);
      await sleep(420); // hold still until it arms
      for (let i = 1; i <= 10; i++) {
        await t.move(a.x + d[0] * 4 * i, a.y + d[1] * 4 * i);
        await sleep(30);
      }
      await sleep(80);
      await t.up();
      await sleep(400);
      await settle(9000);
    } else if (a.kind === 'stick') {
      // steer: push the way the hand drags and hold it for a moment
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[a.dir];
      await t.down(a.x, a.y);
      for (let i = 1; i <= 6; i++) {
        await t.move(a.x + d[0] * 5 * i, a.y + d[1] * 5 * i);
        await sleep(20);
      }
      await sleep(1500);
      await t.up();
      await sleep(300);
      stickUsed = true;
    } else if (a.kind === 'ring') {
      const dx = a.dir === 'left' ? -1 : 1;
      await t.drag(a.x, a.y, a.x + dx * 50, a.y, 140, 6);
      await sleep(400);
    } else await sleep(300);
  }
  if (step) timeline.push({ step, s: Math.round((Date.now() - stepSince) / 100) / 10 });
  const end = await coach();
  const seconds = Math.round((Date.now() - t0) / 1000);
  const ledger = t.ledger();
  const dayOneSteps = [
    'harvest',
    'seeds',
    'plant',
    'water',
    'grow',
    'ship',
    'clock',
    'energy',
    'errands',
    'sleep',
  ];
  const stats = await page.evaluate(() => window.__farm.getState().stats);
  check(
    `${tag}: every day-1 step done by doing it`,
    dayOneSteps.every((s) => stats[`tut.${s}`]),
    JSON.stringify(timeline),
  );
  check(
    `${tag}: reaches day 2 and walks into town by following the coach`,
    end.day === 2 && end.map === 'town',
    `${end.map} day ${end.day}`,
  );
  check(
    `${tag}: the first harvest within 30 s`,
    firstHarvestS !== null && firstHarvestS <= 30,
    `${firstHarvestS}`,
  );
  check(
    `${tag}: the first goal within 90 s`,
    firstGoalS !== null && firstGoalS <= 90,
    `${firstGoalS}`,
  );
  check(`${tag}: the row tip was offered`, paintSeen || !!stats['painted'], '');
  check(`${tag}: the long walk to town teaches the stick`, stickUsed, '');
  check(
    `${tag}: the clock, energy and errands lines each showed and went with a touch`,
    ['clock', 'energy', 'errands'].every((id) => infoLines.includes(id)),
    JSON.stringify(infoLines),
  );
  check(`${tag}: day-1 free play followed the goals' own arrows`, freeTaps > 0, `${freeTaps}`);
  await shot('20-town');
  check(`${tag}: no console errors`, errors.length === 0, errors.join(' | '));
  const r = {
    profile: p.id,
    hand,
    seconds,
    ...ledger,
    refusals: end.coach?.refusals ?? null,
    timeline,
  };
  console.log(
    `      ${tag}: ${seconds} s, ${ledger.gestures} gestures (${ledger.taps} taps, ${ledger.drags} drags, ${ledger.holds} holds), first harvest ${firstHarvestS} s, first goal ${firstGoalS} s; day 1: ${dayOne?.s} s, ${dayOne?.gestures} gestures`,
  );
  results.push(r);
  await ctx.close();
}

const combos = [];
for (const p of PROFILES.filter((x) => which.includes(x.id)))
  for (const hand of hands) combos.push([p, hand, false]);
// One player who wanders off and opens the Menu mid-step (recovery).
if (which.includes('i13') && hands.includes('right')) combos.push([PROFILES[0], 'right', true]);
const PARALLEL = Number(process.env.E2E_ONBOARDING_PARALLEL ?? 3);
try {
  const queue = [...combos];
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      while (queue.length) {
        const [p, hand, deviant] = queue.shift();
        await run(p, hand, deviant).catch((e) =>
          check(`${p.id} ${hand}: run finished`, false, String(e)),
        );
      }
    }),
  );
} finally {
  await browser.close();
  stop();
}
if (process.env.RESULTS) writeFileSync(process.env.RESULTS, JSON.stringify(results, null, 1));
console.log(failed === 0 ? '\nONBOARDING E2E OK' : `\nONBOARDING E2E FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
