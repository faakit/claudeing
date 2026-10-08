// Movement feel, targeting, gesture conflicts and touch-to-response latency, driven by real CDP touches.
// Writes feel.json (and prints a summary). One profile (iPhone 13/14) unless PROFILE=<id> is set.
//
//   CHROMIUM_PATH=... node agents/out/controls/tools/feel-probe.mjs
//
// Frames are counted on the game's own loop (game.loop.frame) between the touch event reaching the canvas and
// the first rendered frame where the response is visible. Headless Chromium, software GL: a real phone adds its
// touch-sampling and display latency on top (typically several frames), which this cannot see.
import { writeFileSync } from 'node:fs';
import { OUT, PROFILES, Thumb, launch, mmPerCss, openGame, sleep } from './lib.mjs';

const p = PROFILES.find((x) => x.id === (process.env.PROFILE ?? 'i13'));
const out = { profile: p.name, mmPerCssPx: mmPerCss(p) };
const browser = await launch();

/** In-page instrumentation: frame of touchstart/touchend, and the first rendered frame each probe holds. */
async function instrument(page) {
  await page.evaluate(() => {
    const f = window.__farm;
    const g = f.game;
    const L = (window.__lat = { down: null, up: null, probes: [] });
    const c = document.querySelector('canvas');
    c.addEventListener(
      'touchstart',
      () => (L.down = { frame: g.loop.frame, t: performance.now() }),
      true,
    );
    c.addEventListener(
      'touchend',
      () => (L.up = { frame: g.loop.frame, t: performance.now() }),
      true,
    );
    g.events.on('postrender', () => {
      for (const pr of L.probes)
        if (pr.frame === null && pr.fn()) {
          pr.frame = g.loop.frame;
          pr.t = performance.now();
        }
    });
    window.__probe = (name, src) => {
      L.probes.push({ name, fn: new Function(`return (${src})()`), frame: null, t: 0 });
    };
    window.__probeResult = () =>
      L.probes.map((pr) => ({
        name: pr.name,
        fromDownFrames: pr.frame === null || !L.down ? null : pr.frame - L.down.frame,
        fromUpFrames: pr.frame === null || !L.up ? null : pr.frame - L.up.frame,
        fromDownMs: pr.frame === null || !L.down ? null : Math.round(pr.t - L.down.t),
      }));
    window.__probeReset = () => {
      L.down = L.up = null;
      L.probes = [];
    };
  });
}

const place = (page, tx, ty, facing = 'down', extra = '') =>
  page.evaluate(
    ({ tx, ty, facing, extra }) => {
      const s = window.__farm.getState();
      s.player.map = 'farm';
      s.player.x = tx * 16 + 8;
      s.player.y = ty * 16 + 11;
      s.player.facing = facing;
      s.energy = 100;
      s.water = 20;
      if (extra) new Function('s', extra)(s);
    },
    { tx, ty, facing, extra },
  );
const player = (page) =>
  page.evaluate(() => {
    const pl = window.__farm.getState().player;
    return {
      x: pl.x,
      y: pl.y,
      facing: pl.facing,
      tx: Math.floor(pl.x / 16),
      ty: Math.floor((pl.y - 3) / 16),
    };
  });
const soil = (page) => page.evaluate(() => Object.keys(window.__farm.getState().farm.tiles).length);
const selected = (page) => page.evaluate(() => window.__farm.getState().inventory.selected);
const select = (page, i) =>
  page.evaluate((i) => (window.__farm.getState().inventory.selected = i), i);
const clearSoil = (page) => page.evaluate(() => (window.__farm.getState().farm.tiles = {}));

// Dock geometry (right-handed, logical px): Action (166,324) r28, Interact (125,343) r21, Menu (22,314) r14.
const ACTION = { x: 166, y: 324 };
const JOY = { x: 70, y: 335 }; // free dock area left of Interact: where a right thumb starts a drag

try {
  const { page, cdp, geo, ctx } = await openGame(browser, p);
  const t = new Thumb(cdp, geo, p);
  await instrument(page);
  out.fps = await page.evaluate(() => Math.round(window.__farm.game.loop.actualFps));
  out.cssPerLogical = geo.k;

  // ---------- joystick numbers ----------
  out.joystick = {
    deadzoneLogical: 6,
    deadzoneMm: +(6 * geo.k * mmPerCss(p)).toFixed(1),
    radiusLogical: 24,
    radiusMm: +(24 * geo.k * mmPerCss(p)).toFixed(1),
    speedTilesPerS: 4,
    directions: 4,
    analogSpeed: false,
  };

  // Smallest drag that moves the player.
  const moveThreshold = [];
  for (const d of [3, 5, 6, 7, 9]) {
    await place(page, 10, 17);
    const a = await player(page);
    await t.drag(JOY.x, JOY.y, JOY.x + d, JOY.y, 60, 3, true);
    await sleep(250);
    await t.up();
    const b = await player(page);
    moveThreshold.push({
      dragLogical: d,
      dragMm: +(d * geo.k * mmPerCss(p)).toFixed(1),
      movedPx: +(b.x - a.x).toFixed(1),
    });
  }
  out.joystick.moveThreshold = moveThreshold;

  // Latency: touch down then a 20 px move right away -> first frame the player has moved.
  await place(page, 10, 17);
  await page.evaluate(() => window.__probeReset());
  await page.evaluate(() => {
    const x0 = window.__farm.getState().player.x;
    window.__probe('player moved', `() => window.__farm.getState().player.x !== ${x0}`);
  });
  await t.down(JOY.x, JOY.y);
  await t.move(JOY.x + 20, JOY.y);
  await sleep(400);
  await t.up();
  out.latencyJoystick = await page.evaluate(() => window.__probeResult());

  // Diagonal drag: 4-way only, so a 40-degree drag walks one axis.
  await place(page, 10, 17);
  {
    const a = await player(page);
    const ang = (-40 * Math.PI) / 180;
    await t.drag(JOY.x, JOY.y, JOY.x + Math.cos(ang) * 20, JOY.y + Math.sin(ang) * 20, 80, 4, true);
    await sleep(600);
    await t.up();
    const b = await player(page);
    out.diagonal40deg = { dxPx: +(b.x - a.x).toFixed(1), dyPx: +(b.y - a.y).toFixed(1) };
  }

  // Stop-and-turn: a quick flick to face the next tile always walks too. Flick durations a thumb produces.
  const flicks = [];
  for (const ms of [60, 100, 140, 180, 250, 320]) {
    for (const off of [0, 5, 10]) {
      // start at different sub-tile offsets
      await place(page, 10, 17, 'down');
      await page.evaluate((off) => (window.__farm.getState().player.x += off - 5), off);
      const a = await player(page);
      await t.down(JOY.x, JOY.y);
      await t.move(JOY.x + 12, JOY.y);
      await sleep(ms);
      await t.up();
      await sleep(120);
      const b = await player(page);
      flicks.push({
        holdMs: ms,
        startOffsetPx: off - 5,
        movedPx: +(b.x - a.x).toFixed(1),
        tileChanged: b.tx !== a.tx,
        facing: b.facing,
      });
    }
  }
  out.stopAndTurnFlicks = flicks;

  // Turning by tapping the adjacent tile instead (exists today): does it act, does it move?
  await place(page, 10, 17, 'down');
  await select(page, 0);
  await sleep(1200); // let the follow camera settle before mapping tiles to the screen
  {
    const cam = await page.evaluate(() => {
      const w = window.__farm.game.scene.getScenes(true).find((s) => s.scene.key === 'Farm');
      const c = w.cameras.main;
      return { x: c.x, y: c.y, sx: c.scrollX, sy: c.scrollY };
    });
    const tileCenter = (tx, ty) => ({
      x: tx * 16 + 8 - cam.sx + cam.x,
      y: ty * 16 + 8 - cam.sy + cam.y,
    });
    const right = tileCenter(11, 17);
    const far = tileCenter(12, 17);
    await clearSoil(page);
    await t.tap(far.x, far.y);
    await sleep(300);
    const farSoil = await soil(page);
    const a = await player(page);
    await t.tap(right.x, right.y);
    await sleep(300);
    const b = await player(page);
    out.tapTile = {
      tapTwoTilesAway: { soilChanged: farSoil, feedback: 'none (no sound, no marker)' },
      tapAdjacent: { soil: await soil(page), facing: b.facing, movedPx: +(b.x - a.x).toFixed(1) },
      tileOnScreenMm: +(16 * geo.k * mmPerCss(p)).toFixed(1),
    };
    // Tap with a 7 px wobble (a normal thumb tap rolls 1-2 mm): counts as a tap AND as a joystick drag?
    await clearSoil(page);
    await place(page, 10, 17, 'down');
    await sleep(600);
    const c0 = await player(page);
    const below = tileCenter(10, 18);
    await t.down(right.x, right.y);
    await t.move(right.x + 7, right.y);
    await sleep(90);
    await t.up();
    await sleep(300);
    const c1 = await player(page);
    out.tapWobble7 = {
      soil: await soil(page),
      movedPx: +(c1.x - c0.x).toFixed(1),
      facing: c1.facing,
      note: 'tap at the tile right of the player, finger rolls 7 logical px',
    };
    void below;
  }

  // ---------- Action button ----------
  // Tap latency: down -> button press visual; up -> soil change.
  await clearSoil(page);
  await place(page, 10, 17, 'down');
  await select(page, 0);
  await page.evaluate(() => window.__probeReset());
  await page.evaluate(() => {
    window.__probe(
      'action pressed (scaled)',
      '() => window.__farm.game.scene.getScene("UI").controls[0].view.scale < 0.99',
    );
    window.__probe(
      'tile tilled',
      '() => Object.keys(window.__farm.getState().farm.tiles).length > 0',
    );
  });
  await t.tap(ACTION.x, ACTION.y, 80);
  await sleep(400);
  out.latencyActionTap = await page.evaluate(() => window.__probeResult());

  // Hold: first tool use and repeat rate.
  await clearSoil(page);
  await place(page, 10, 17, 'down');
  await page.evaluate(() => window.__probeReset());
  await page.evaluate(() => {
    window.__probe(
      'first use',
      '() => Object.keys(window.__farm.getState().farm.tiles).length > 0',
    );
    window.__probe(
      'second use',
      '() => Object.keys(window.__farm.getState().farm.tiles).length > 1',
    );
    window.__probe(
      'third use',
      '() => Object.keys(window.__farm.getState().farm.tiles).length > 2',
    );
  });
  await t.hold(ACTION.x, ACTION.y, 1200);
  await sleep(200);
  out.latencyActionHold = await page.evaluate(() => window.__probeResult());
  out.holdStill1200ms = { tilesWorked: await soil(page) };

  // Hold with natural thumb jitter (a press settles 1-2 mm): drift >= 4 logical px cancels the pending hold.
  for (const jitter of [2, 3, 5, 8]) {
    await clearSoil(page);
    await place(page, 10, 17, 'down');
    await t.down(ACTION.x, ACTION.y);
    await sleep(40);
    await t.move(ACTION.x + jitter * 0.6, ACTION.y + jitter * 0.8); // diagonal roll of the pad
    await sleep(1160);
    await t.up();
    await sleep(200);
    (out.holdJitter ??= []).push({
      jitterLogical: jitter,
      jitterMm: +(jitter * geo.k * mmPerCss(p)).toFixed(1),
      tilesWorkedIn1200ms: await soil(page),
      toolChanged: (await selected(page)) !== 0,
    });
    await select(page, 0);
  }

  // Swipe speeds: does a swipe ever use the old tool? (critique 3 F5 regression check)
  for (const ms of [60, 150, 300, 500]) {
    await clearSoil(page);
    await place(page, 10, 17, 'down');
    await select(page, 0);
    await t.drag(ACTION.x, ACTION.y, ACTION.x, ACTION.y - 18, ms, 8);
    await sleep(300);
    (out.swipe ??= []).push({
      swipeMs: ms,
      toolUses: await soil(page),
      selected: await selected(page),
    });
  }
  // Swipe step and how far 4 tools away is.
  out.swipeStep = {
    logical: 14,
    mm: +(14 * geo.k * mmPerCss(p)).toFixed(1),
    mmToGoFromSlot1To6: +(5 * 14 * geo.k * mmPerCss(p)).toFixed(1),
    note: 'Action is ~36 logical px from the dock top edge: at most 2 steps up fit before the thumb leaves the dock',
  };

  // A drag that starts on Action never walks (it is a tool swipe), even horizontally.
  await place(page, 10, 17, 'down');
  {
    const a = await player(page);
    await t.drag(ACTION.x, ACTION.y, ACTION.x - 50, ACTION.y, 200, 8, true);
    await sleep(400);
    await t.up();
    const b = await player(page);
    out.dragFromAction = { movedPx: +(b.x - a.x).toFixed(1), selected: await selected(page) };
  }
  await select(page, 0);

  // Joystick drag that drifts onto Action and lifts there: does Action fire? Does walking continue?
  await clearSoil(page);
  await place(page, 10, 17, 'right');
  {
    const a = await player(page);
    await t.drag(110, 330, 160, 330, 300, 10, true);
    await sleep(300);
    const mid = await player(page);
    await t.up();
    await sleep(300);
    out.joystickOntoAction = { keptWalking: mid.x > a.x, soilAfterLiftOnAction: await soil(page) };
  }

  // Interact overlapping Action: share of the Action's drawn disc that a touch would give to Interact.
  {
    let stolen = 0;
    let n = 0;
    for (let dx = -28; dx <= 28; dx += 2)
      for (let dy = -28; dy <= 28; dy += 2) {
        if (dx * dx + dy * dy > 28 * 28) continue;
        n++;
        const x = ACTION.x + dx;
        const y = ACTION.y + dy;
        if (Math.hypot(x - 125, y - 343) <= 29) stolen++;
      }
    out.interactOverlap = { shareOfActionDiscGoingToInteract: +(stolen / n).toFixed(3) };
    // Verify with a real touch at the overlap: lower-left of the Action disc, while Interact is showing.
    await place(page, 12, 10, 'up'); // mailbox/bin in reach
    await sleep(300);
    await page.evaluate(() => window.__probeReset());
    const before = await page.evaluate(
      () => window.__farm.game.scene.getScene('UI').interactButton.enabled,
    );
    await t.tap(ACTION.x - 20, ACTION.y + 14, 60);
    await sleep(400);
    out.interactOverlap.realTouch = {
      interactShowing: before,
      opened: await page.evaluate(() => {
        const ui = window.__farm.game.scene.getScene('UI');
        return [...ui.panels.entries()].filter(([, m]) => m.isOpen).map(([k]) => k);
      }),
    };
    await page.evaluate(() =>
      window.__farm.game.scene
        .getScene('UI')
        .allModals()
        .forEach((m) => m.isOpen && m.close()),
    );
  }

  // Menu acts on touch-down: a joystick drag that starts on its hit circle opens the menu.
  await place(page, 10, 17, 'down');
  await t.drag(26, 318, 60, 318, 200, 6);
  await sleep(300);
  out.dragStartingOnMenu = {
    menuOpened: await page.evaluate(() => window.__farm.game.scene.getScene('UI').menu.isOpen),
  };
  await page.evaluate(() => window.__farm.game.scene.getScene('UI').menu.close());

  // Hotbar slot latency (acts on touch-down).
  await page.evaluate(() => window.__probeReset());
  await page.evaluate(() =>
    window.__probe('slot 2 selected', '() => window.__farm.getState().inventory.selected === 1'),
  );
  await t.tap(40.5, 383.5, 80);
  await sleep(300);
  out.latencyHotbar = await page.evaluate(() => window.__probeResult());
  await select(page, 0);

  // Sheet button latency (acts on release): open the sleep sheet and tap its Close.
  await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'sleep' }));
  await sleep(400);
  const closeBtn = await page.evaluate(() => {
    const ui = window.__farm.game.scene.getScene('UI');
    const z = ui.input._list.filter(
      (o) => o.input?.enabled && o.parentContainer?.parentContainer?.parentContainer?.visible,
    );
    const b = z.map((o) => o.getBounds()).sort((a, b) => b.y - a.y)[0];
    return { x: b.centerX, y: b.centerY };
  });
  await page.evaluate(() => window.__probeReset());
  await page.evaluate(() =>
    window.__probe(
      'sheet closed',
      '() => !window.__farm.game.scene.getScene("UI").allModals().some((m) => m.isOpen)',
    ),
  );
  await t.tap(closeBtn.x, closeBtn.y, 90);
  await sleep(300);
  out.latencySheetButton = await page.evaluate(() => window.__probeResult());

  // Walk farmhouse door -> town exit with the joystick, steering by state (a perfect thumb).
  await place(page, 14, 8, 'down');
  {
    const t0 = Date.now();
    t.reset();
    await t.down(JOY.x, JOY.y);
    await t.move(JOY.x, JOY.y + 20);
    let map = 'farm';
    while (Date.now() - t0 < 20000) {
      await sleep(100);
      map = await page.evaluate(() => window.__farm.getState().player.map);
      if (map !== 'farm') break;
    }
    await t.up();
    out.walkHouseToTown = {
      seconds: +((Date.now() - t0) / 1000).toFixed(1),
      reached: map,
      ledger: t.ledger(),
      note: 'straight down the farm path: one held drag, ~35 tiles',
    };
  }
  await ctx.close();
} finally {
  await browser.close();
}
writeFileSync(`${OUT}feel.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
