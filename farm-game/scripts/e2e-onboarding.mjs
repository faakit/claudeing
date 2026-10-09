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

async function run(p, hand) {
  const tag = `${p.id} ${hand}`;
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
  const shotDir = SHOTS ? `${SHOTS}/${p.id}-${hand}` : '';
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

  let step = null;
  let stepSince = Date.now();
  let firstHarvestS = null;
  let firstGoalS = null;
  let lastGoal = first.goal;
  let guard = 0;
  let paintSeen = false;
  while (guard++ < 400) {
    const c = await coach();
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
    if (c.map === 'town') break;
    if (Date.now() - stepSince > STALL_MS) {
      check(`${tag}: never stalls on a step`, false, `stuck on ${step}: ${JSON.stringify(k)}`);
      break;
    }
    if (!k || !k.visible || !k.aim) {
      await sleep(400);
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
  const dayOneSteps = ['harvest', 'seeds', 'plant', 'water', 'grow', 'ship', 'sleep'];
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
  await sleep(1500);
  const town = await coach();
  check(
    `${tag}: town shows one introduction (Mara, a wild good or the rod)`,
    ['townHello', 'forage', 'fish'].includes(town.coach?.step) && town.coach.visible,
    JSON.stringify(town.coach),
  );
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
    `      ${tag}: ${seconds} s, ${ledger.gestures} gestures (${ledger.taps} taps, ${ledger.drags} drags, ${ledger.holds} holds), first harvest ${firstHarvestS} s, first goal ${firstGoalS} s`,
  );
  results.push(r);
  await ctx.close();
}

const combos = [];
for (const p of PROFILES.filter((x) => which.includes(x.id)))
  for (const hand of hands) combos.push([p, hand]);
const PARALLEL = Number(process.env.E2E_ONBOARDING_PARALLEL ?? 2);
try {
  const queue = [...combos];
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      while (queue.length) {
        const [p, hand] = queue.shift();
        await run(p, hand).catch((e) => check(`${p.id} ${hand}: run finished`, false, String(e)));
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
