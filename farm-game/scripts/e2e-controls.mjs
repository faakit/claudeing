// Controls e2e: real CDP touches on phone profiles (iPhone 13 and SE, right and left hand) against the production
// build. Checks the one-thumb rules that unit tests cannot see end to end: dock hit ownership, release-acting
// Menu, tap vs stick, hold under a rolling pad, swipes, the target marker, silent taps, haptics and latency.
// Run `npm run build` first. Headless emulation only: it proves the rules, not how a real hand feels.
import {
  PROFILES,
  Thumb,
  dock,
  launch,
  openGame,
  sleep,
  startPreview,
  tileScreen,
} from './thumb-lib.mjs';

const PORT = Number(process.env.E2E_CONTROLS_PORT ?? Number(process.env.E2E_PORT ?? 4173) + 10);
const which = (process.env.PROFILES ?? 'i13,se').split(',');
const hands = (process.env.HANDS ?? 'right,left').split(',');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
};

const { url, stop } = await startPreview(PORT);
const browser = await launch();

/** Seeded jitter, so a failure reproduces. */
function rng(seed) {
  let s = seed >>> 0;
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  return { u, g: () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()) };
}

const place = (page, tx, ty, facing = 'down', extra = '') =>
  page.evaluate(
    ({ tx, ty, facing, extra }) => {
      const f = window.__farm;
      const s = f.getState();
      f.game.scene
        .getScene('UI')
        .allModals()
        .forEach((m) => m.isOpen && m.close());
      s.player.x = tx * 16 + 8;
      s.player.y = ty * 16 + 11;
      s.player.facing = facing;
      s.energy = 100;
      s.water = 20;
      s.time.minutes = 600;
      s.farm.tiles = {};
      s.inventory.selected = 0;
      s.inventory.slots[5] = { item: 'parsnip_seed', qty: 10 };
      for (let i = 6; i < 8; i++) s.inventory.slots[i] = null;
      if (extra) new Function('s', 'f', extra)(s, f);
      f.gameEvents.emit('farmChanged', undefined);
      f.gameEvents.emit('inventoryChanged', undefined);
    },
    { tx, ty, facing, extra },
  );
const player = (page) =>
  page.evaluate(() => {
    const p = window.__farm.getState().player;
    return {
      x: p.x,
      y: p.y,
      facing: p.facing,
      tx: Math.floor(p.x / 16),
      ty: Math.floor((p.y - 3) / 16),
    };
  });
const soil = (page) => page.evaluate(() => Object.keys(window.__farm.getState().farm.tiles).length);
const selected = (page) => page.evaluate(() => window.__farm.getState().inventory.selected);
const openSheets = (page) =>
  page.evaluate(() => {
    const ui = window.__farm.game.scene.getScene('UI');
    return ui.allModals().filter((m) => m.isOpen).length;
  });
const closeSheets = (page) =>
  page.evaluate(() =>
    window.__farm.game.scene
      .getScene('UI')
      .allModals()
      .forEach((m) => m.isOpen && m.close()),
  );

try {
  for (const p of PROFILES.filter((x) => which.includes(x.id)))
    for (const hand of hands) {
      const tag = `${p.id} ${hand}`;
      const { page, cdp, geo, ctx, errors } = await openGame(browser, url, p, {
        leftHanded: hand === 'left',
      });
      const L = await dock(page);
      const t = new Thumb(cdp, geo, p, hand);
      const r = rng(hand === 'left' ? 17 : 5);
      const mm = 1 / (geo.k * ((25.4 / p.ppi) * p.dpr)); // logical px per mm

      // --- Action owns its disc: a touch on Action's edge toward Interact presses Action, with Interact showing.
      await place(page, 12, 10, 'up'); // the bin is in reach: Interact shows
      await sleep(400);
      const interactOn = await page.evaluate(
        () => window.__farm.game.scene.getScene('UI').interactButton.isEnabled,
      );
      const toward = Math.atan2(L.interact.y - L.action.y, L.interact.x - L.action.x);
      const edge = {
        x: L.action.x + Math.cos(toward) * (L.action.r - 1),
        y: L.action.y + Math.sin(toward) * (L.action.r - 1),
      };
      await t.tap(edge.x, edge.y, 60);
      await sleep(400);
      check(
        `${tag}: Action's edge facing Interact presses Action, not Interact`,
        interactOn && (await openSheets(page)) === 0,
        `interact showing ${interactOn}, sheets ${await openSheets(page)}`,
      );
      await closeSheets(page);
      // A clean tap on Interact opens the bin on release.
      await t.down(L.interact.x, L.interact.y);
      await sleep(140);
      const beforeUp = await openSheets(page);
      await t.up();
      await sleep(250);
      check(
        `${tag}: Interact acts on release (not on touch-down)`,
        beforeUp === 0 && (await openSheets(page)) === 1,
        `down ${beforeUp}, after ${await openSheets(page)}`,
      );
      await closeSheets(page);

      // --- Menu: a drag that starts on it never opens it (jittered, 9-20 px); a clean tap always does.
      await place(page, 10, 17, 'down');
      await sleep(300);
      let opens = 0;
      for (let i = 0; i < 20; i++) {
        const sx = L.menu.x + r.g() * 3;
        const sy = L.menu.y + r.g() * 3;
        const len = 9.5 + r.u() * 10.5;
        const ang = r.u() * Math.PI * 2;
        await t.drag(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, 120, 5);
        await sleep(120);
        if ((await openSheets(page)) > 0) opens++;
        await closeSheets(page);
      }
      check(
        `${tag}: 20 jittered drags starting on Menu open nothing`,
        opens === 0,
        `${opens} opened`,
      );
      let tapOpens = 0;
      for (const ms of [120, 150, 180]) {
        await t.tap(L.menu.x + r.g() * 2, L.menu.y + r.g() * 2, ms);
        await sleep(300);
        if ((await openSheets(page)) > 0) tapOpens++;
        await closeSheets(page);
        await sleep(150);
      }
      check(
        `${tag}: clean taps on Menu (120-180 ms) open it every time`,
        tapOpens === 3,
        `${tapOpens}/3`,
      );

      // --- A tap never walks, a drag never acts.
      await place(page, 10, 17, 'down');
      await sleep(1200); // let the camera settle before mapping tiles to the screen
      const below = await tileScreen(page, 10, 18);
      const a = await player(page);
      await t.down(below.x, below.y);
      await t.move(below.x + 4, below.y + 2);
      await t.move(below.x + 7, below.y);
      await sleep(90);
      await t.up();
      await sleep(350);
      const b = await player(page);
      check(
        `${tag}: a tap that rolls 7 px acts once and moves 0 px`,
        (await soil(page)) === 1 && Math.abs(b.x - a.x) + Math.abs(b.y - a.y) < 0.01,
        `soil ${await soil(page)}, moved ${(b.x - a.x).toFixed(1)},${(b.y - a.y).toFixed(1)}`,
      );
      await place(page, 10, 17, 'down');
      await sleep(400);
      const c0 = await player(page);
      await t.down(below.x, below.y);
      await t.move(below.x + 11, below.y);
      await sleep(90);
      await t.up();
      await sleep(350);
      const c1 = await player(page);
      check(
        `${tag}: a touch that strays 11 px engages the stick and never acts`,
        (await soil(page)) === 0 && (c1.x !== c0.x || c1.facing !== c0.facing),
        `soil ${await soil(page)}, moved ${(c1.x - c0.x).toFixed(1)} facing ${c1.facing}`,
      );

      // --- No silent taps: a tap two tiles away answers with a ring on that tile.
      await place(page, 10, 17, 'down');
      await sleep(400);
      const far = await tileScreen(page, 12, 17);
      await t.tap(far.x, far.y, 70);
      await sleep(60);
      const ring = await page.evaluate(() => {
        const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
        return w.highlight.ring.visible;
      });
      check(`${tag}: a tap with nothing to do shows a ring (never silent)`, ring);

      // --- The marker says yes or no.
      await place(page, 10, 17, 'down');
      await sleep(200);
      const hoeMark = await page.evaluate(
        () => window.__farm.game.scene.getScenes(true).find((s) => s.grid).highlight.shown,
      );
      await page.evaluate(() => (window.__farm.getState().inventory.selected = 5));
      await sleep(200);
      const seedMark = await page.evaluate(
        () => window.__farm.game.scene.getScenes(true).find((s) => s.grid).highlight.shown,
      );
      check(
        `${tag}: marker shows "work" for the hoe on grass and "none" for seeds on grass`,
        hoeMark === 'work' && seedMark === 'none',
        `${hoeMark} / ${seedMark}`,
      );

      // --- Hold under a rolling pad works 3 tiles in 1.2 s.
      for (const [label, dx, dy] of [
        ['2.5 mm vertical roll', 0, 2.5 * mm],
        ['3 mm diagonal roll', 0.6 * 3 * mm, 0.8 * 3 * mm],
      ]) {
        await place(page, 10, 17, 'down');
        await sleep(200);
        await t.down(L.action.x, L.action.y);
        await sleep(40);
        await t.move(L.action.x + dx, L.action.y + dy);
        await sleep(1160);
        await t.up();
        await sleep(250);
        const n = await soil(page);
        check(`${tag}: holding Action with a ${label} works 3 tiles`, n === 3, `${n} tiles`);
      }

      // --- Swipes never use the old tool; hoe -> seeds is one swipe down (empty slots skipped).
      let uses = 0;
      const usedAt = [];
      for (const ms of [60, 150, 300, 500]) {
        await place(page, 10, 17, 'down');
        await sleep(150);
        // At true speed: 18 px in `ms`, however slow the harness is to deliver each move.
        await t.timedDrag(L.action.x, L.action.y, L.action.x, L.action.y - 18, ms);
        await sleep(300);
        const n = await soil(page);
        if (n) usedAt.push(ms);
        uses += n;
      }
      check(
        `${tag}: swipes of 60-500 ms change tool and never use the old one`,
        uses === 0,
        `${uses} uses at ${usedAt.join(',')} ms`,
      );
      await place(page, 10, 17, 'down');
      await sleep(150);
      await t.drag(L.action.x, L.action.y, L.action.x, L.action.y + 18, 150, 6);
      await sleep(250);
      check(
        `${tag}: hoe -> seeds is one swipe down`,
        (await selected(page)) === 5,
        `slot ${await selected(page)}`,
      );

      // --- Haptics: ticks at most 1 per 120 ms during a held action; vibrate off means none at all.
      await place(page, 10, 17, 'down');
      await page.evaluate(() => (window.__vibrations = []));
      await t.hold(L.action.x, L.action.y, 1300);
      await sleep(200);
      const vib = await page.evaluate(() => window.__vibrations.map((v) => v.t));
      const gaps = vib.slice(1).map((v, i) => v - vib[i]);
      check(
        `${tag}: a held action pulses, never faster than 1 per 120 ms`,
        vib.length >= 1 && gaps.every((g) => g >= 119),
        `${vib.length} pulses, gaps ${gaps.map(Math.round).join(',')}`,
      );
      await place(page, 10, 17, 'down');
      await page.evaluate(() => {
        window.__farm.getState().settings.vibrate = false;
        window.__farm.haptics.setHapticsEnabled(false);
        window.__vibrations = [];
      });
      await t.hold(L.action.x, L.action.y, 800);
      await sleep(200);
      check(
        `${tag}: with vibration off there are 0 vibrate calls`,
        (await page.evaluate(() => window.__vibrations.length)) === 0,
        `${await page.evaluate(() => window.__vibrations.length)} calls`,
      );
      await page.evaluate(() => {
        window.__farm.getState().settings.vibrate = true;
        window.__farm.haptics.setHapticsEnabled(true);
      });

      // --- Latency in frames (game loop): stick and Action press <= 2, hotbar 0. iPhone 13 right only.
      if (p.id === 'i13' && hand === 'right') {
        // Frames are counted in the page: from the frame the touch event reached the canvas to the first
        // rendered frame where the response is visible (as feel-probe.mjs measured the baseline).
        await page.evaluate(() => {
          const g = window.__farm.game;
          window.__lat = { down: null, hit: null };
          document
            .querySelector('canvas')
            .addEventListener('touchstart', () => (window.__lat.down = g.loop.frame), true);
          g.events.on('postrender', () => {
            const L = window.__lat;
            if (L.down !== null && L.hit === null && window.__probeOk?.()) L.hit = g.loop.frame;
          });
        });
        const frames = async (setup, act) => {
          await page.evaluate(setup);
          await page.evaluate(() => (window.__lat = { down: null, hit: null }));
          await act();
          await sleep(300);
          const L = await page.evaluate(() => window.__lat);
          return L.hit === null || L.down === null ? 99 : L.hit - L.down;
        };
        await place(page, 10, 17, 'down');
        await sleep(300);
        const stick = await frames(
          () => {
            const x0 = window.__farm.getState().player.x;
            window.__probeOk = () => window.__farm.getState().player.x !== x0;
          },
          async () => {
            await t.down(L.stickHome.x, L.stickHome.y);
            await t.move(L.stickHome.x + 20, L.stickHome.y);
          },
        );
        await t.up();
        const press = await frames(
          () => {
            window.__probeOk = () =>
              window.__farm.game.scene.getScene('UI').controls[0].view.scale < 0.99;
          },
          () => t.down(L.action.x, L.action.y),
        );
        await t.up();
        await sleep(300);
        const slot = await frames(
          () => {
            window.__probeOk = () => window.__farm.getState().inventory.selected === 1;
          },
          () => t.down(40.5, 383.5),
        );
        await t.up();
        console.log(`      frames: stick ${stick}, action ${press}, hotbar ${slot}`);
        check(
          `${tag}: frames from touch to response: stick <= 2, Action <= 2, hotbar <= 1`,
          stick <= 2 && press <= 2 && slot <= 1,
          `stick ${stick}, action ${press}, hotbar ${slot}`,
        );
      }

      check(`${tag}: no console errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
} finally {
  await browser.close();
  stop();
}
console.log(failed === 0 ? '\nCONTROLS E2E OK' : `\nCONTROLS E2E FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
