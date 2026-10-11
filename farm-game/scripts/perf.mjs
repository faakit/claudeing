// Frame-rate probe: plays a few worst-case scenes under CPU throttling and reports FPS.
// Headless Chromium renders with software GL, so absolute numbers are pessimistic; use this to
// compare before/after a change and to catch regressions, not as a device benchmark.
// Usage: npm run build && node scripts/perf.mjs [throttle=1,4,6]
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { frameStats, pacingInit, pacingRow, startPacing, stopPacing } from './pacing-lib.mjs';

// Override with PERF_PORT when another checkout runs its checks at the same time.
const PORT = Number(process.env.PERF_PORT ?? 4174);
const URL_ = `http://localhost:${PORT}/?debug&tutorial=0`; // a bare new game (no guided start)
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const throttles = (process.argv[2] ?? '1,4,6').split(',').map(Number);
// Which parts to run: `all` (default), `budget` (draws and JS per frame) or `pacing` (per-frame times in play).
const PARTS = process.argv[3] ?? 'all';
const runBudget = PARTS === 'all' || PARTS === 'budget';
const runPacingPart = PARTS === 'all' || PARTS === 'pacing';

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  {
    stdio: 'ignore',
  },
);
// With strictPort a busy port makes the preview exit: fail instead of testing someone else's server.
server.on('exit', (code) => {
  if (code) {
    console.error(`preview server exited (${code}): is port ${PORT} taken?`);
    process.exit(1);
  }
});
process.on('exit', () => server.kill());
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(URL_)).ok) break;
  } catch {
    /* wait */
  }
  await new Promise((r) => setTimeout(r, 200));
}

/**
 * Frame pacing in real play, one fresh game per throttle level: walking, a tap's walk, a painted row being worked,
 * sheets and the bag opening and closing, map changes through real doors, sleep and the morning summary, a
 * festival, and the guided start's coach marks. Records every frame (pacing-lib.mjs).
 */
async function runPacing(rate) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(pacingInit);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto(URL_);
  await page.waitForFunction(
    () => window.__farm?.game?.scene?.getScene('Title')?.sys.isActive(),
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(500 * Math.min(rate, 3));
  // From the title: New Game is part of what the player sees, so it is recorded too.
  await startPacing(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => window.__farm.game.scene.getScene('Farm')?.sys.isActive(),
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  const first = await stopPacing(page);
  pacing.push(pacingRow(`${rate}x`, 'new game: title -> farm', first.raf, first.work));
  pacingRaw.push({ rate, scene: 'new game', f: frameStats(first.raf) });
  await page.waitForTimeout(1000 * Math.min(rate, 3));

  const rec = async (label, run) => {
    await startPacing(page);
    await run();
    const res = await stopPacing(page);
    pacing.push(pacingRow(`${rate}x`, label, res.raf, res.work));
    pacingRaw.push({ rate, scene: label.split(':')[0], f: frameStats(res.raf) });
    return res;
  };
  const place = (tx, ty, facing = 'down') =>
    page.evaluate(
      ([tx, ty, facing]) => {
        const p = window.__farm.getState().player;
        p.x = tx * 16 + 8;
        p.y = ty * 16 + 11;
        p.facing = facing;
      },
      [tx, ty, facing],
    );
  const hold = async (key, ms) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };

  // 0. Standing still on the farm (the breathing idle, ambient life, the clock).
  await place(8, 19, 'down');
  await rec('idle: standing on the farm', () => page.waitForTimeout(2500));

  // 1. Walking: a loop with the keys (the stick's path through the same code), turns and stops included.
  await place(8, 19, 'right');
  await page.waitForTimeout(300);
  await rec('walk: a loop with stops', async () => {
    for (const [k, ms] of [
      ['ArrowRight', 1400],
      ['ArrowDown', 700],
      ['ArrowLeft', 1400],
      ['ArrowUp', 700],
    ]) {
      await hold(k, ms);
      await page.waitForTimeout(250);
    }
  });

  // 2. A tap's walk across the field (routes, path dots, arrival).
  await rec('tap-walk: long routes', async () => {
    for (const [x, y] of [
      [20, 170],
      [180, 270],
      [20, 270],
      [180, 170],
    ]) {
      await page.evaluate(([x, y]) => window.__farm.inputHub.emit('tap', { x, y }), [x, y]);
      await page.waitForTimeout(1300);
    }
  });

  // 3. A painted row worked tile by tile: till, plant, water (the seeds and the can come from the hotbar).
  await place(8, 21, 'right');
  await page.evaluate(() => {
    const s = window.__farm.getState();
    s.energy = 270;
    s.water = 40;
  });
  await page.waitForTimeout(300);
  await rec('paint: a 6-tile row worked', async () => {
    await page.evaluate(() => {
      const h = window.__farm.inputHub;
      h.emit('paintLine', { dir: null, tiles: 0 });
      h.emit('paintLine', { dir: 'right', tiles: 6, path: Array(6).fill('right') });
      h.emit('paintEnd', { commit: true });
    });
    await page.waitForTimeout(5500);
  });

  // 4. Sheets: the bag (menu), the shop, the bin, the board and the mail, opened and closed one after another.
  await rec('sheets: bag, shop, bin, board, mail', async () => {
    for (const type of ['menu', 'shop', 'bin', 'board', 'mail', 'menu']) {
      await page.evaluate((type) => window.__farm.gameEvents.emit('openPanel', { type }), type);
      await page.waitForTimeout(600);
      await page.evaluate(() => window.__farm.inputHub.emit('menu', undefined));
      await page.waitForTimeout(450);
    }
  });

  // 5. Map changes through real doors (fade, save, scene start): a loop through every map and back.
  const doors = [
    [14, 7, 'House'],
    [5, 8, 'Farm'],
    [14, 43, 'Town'],
    [0, 24, 'Woods'],
    [9, 0, 'Mine'],
    [9, 29, 'Woods'],
    [19, 14, 'Town'],
    [11, 0, 'Farm'],
  ];
  const worst = [];
  await rec('map changes: 8 doors, every map', async () => {
    for (const [tx, ty, to] of doors) {
      const i0 = await page.evaluate(() => window.__pace.raf.length);
      await place(tx, ty);
      await page.waitForFunction(
        (to) => {
          const sc = window.__farm.game.scene.getScene(to);
          return sc?.sys.isActive() && !sc.transitioning;
        },
        to,
        { timeout: 20000 },
      );
      await page.waitForTimeout(700);
      const xs = await page.evaluate((i0) => window.__pace.raf.slice(i0), i0);
      worst.push(`${to}:${Math.round(Math.max(...xs))}`);
      pacingRaw.push({ rate, scene: 'door', door: to, f: frameStats(xs) });
    }
  });
  doorWorst.push({ throttle: `${rate}x`, worst: worst.join(' ') });

  // 6. Sleep, the roll to the next day, the house, and the morning summary (acknowledged like Enter).
  await rec('sleep: night -> summary -> morning', async () => {
    await page.evaluate(() => window.__farm.gameEvents.emit('sleepRequest', { passedOut: false }));
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(400);
      const done = await page.evaluate(() => {
        const f = window.__farm;
        if (!f.runtime.busy) return true;
        f.inputHub.emit('confirm', undefined);
        return false;
      });
      if (done) break;
    }
    await page.waitForTimeout(600);
  });

  // 7. A festival day in town: the festival sheet opens and closes.
  await page.evaluate(() => {
    const f = window.__farm;
    const s = f.getState();
    s.time.season = 'fall';
    s.time.day = 16;
    s.time.minutes = 600;
    s.player.map = 'town';
    s.player.x = 11 * 16 + 8;
    s.player.y = 12 * 16 + 11;
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key !== 'UI')
      .scene.start('Town');
  });
  await page.waitForTimeout(1500);
  await rec('festival: fall fair sheet in town', async () => {
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'festival' }));
      await page.waitForTimeout(800);
      await page.evaluate(() => window.__farm.inputHub.emit('menu', undefined));
      await page.waitForTimeout(500);
    }
  });

  // 8. The guided start's coach marks on the farm (the row tip with its animated hand).
  await page.evaluate(() => {
    const f = window.__farm;
    const s = f.getState();
    s.time.season = 'spring';
    s.time.day = 3;
    s.player.map = 'farm';
    s.player.x = 13 * 16 + 8;
    s.player.y = 18 * 16 + 11;
    delete s.stats['tut.off'];
    s.stats['tut.on'] = 1;
    for (const id of ['harvest', 'seeds', 'plant', 'water']) s.stats[`tut.${id}`] = 1;
    s.stats['tut.seen.grow'] = 1;
    s.stats.tilled = 2;
    s.stats['tut.at.grow.tilled'] = 0;
    s.stats['tut.at.grow.painted'] = 0;
    s.stats.planted = 0;
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key !== 'UI')
      .scene.start('Farm');
  });
  await page.waitForTimeout(1500);
  await rec('guided start: coach marks', () => page.waitForTimeout(3000));

  if (errors.length) console.error(`${rate}x pacing page errors:`, errors.slice(0, 5));
  await ctx.close();
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const results = [];
/** Sound effects played from files during the storm scene, per throttle level. */
const sfxCounts = [];
const pacing = [];
/** The same recordings as numbers, for the frame-time budgets. */
const pacingRaw = [];
/** Per-door worst frame in the map-change run, per throttle. */
const doorWorst = [];
try {
  for (const rate of runBudget ? throttles : []) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    // Count GL draw calls: hardware-independent, so it predicts real-device cost better than FPS here.
    await page.addInitScript(() => {
      window.__draws = 0;
      for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
        for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced']) {
          const orig = C.prototype[fn];
          if (!orig) continue;
          C.prototype[fn] = function (...a) {
            window.__draws++;
            return orig.apply(this, a);
          };
        }
      }
    });
    await page.goto(URL_);
    await page.waitForTimeout(1500 * Math.min(rate, 3));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000 * Math.min(rate, 3));

    await cdp.send('Performance.enable');
    const metrics = async () =>
      Object.fromEntries(
        (await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
      );
    const sample = async (label, setup) => {
      if (setup) await setup();
      await page.waitForTimeout(1500);
      const m0 = await metrics();
      const d0 = await page.evaluate(() => window.__draws);
      const fps = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const loop = window.__farm.game.loop;
            const xs = [];
            const t = setInterval(() => xs.push(loop.actualFps), 250);
            setTimeout(() => {
              clearInterval(t);
              resolve(xs);
            }, 4000);
          }),
      );
      const m1 = await metrics();
      const d1 = await page.evaluate(() => window.__draws);
      const wall = m1.Timestamp - m0.Timestamp;
      const avg = fps.reduce((x, y) => x + y, 0) / fps.length;
      results.push({
        throttle: `${rate}x`,
        scene: label,
        fps: avg.toFixed(1),
        'JS ms/frame': (
          (((m1.ScriptDuration - m0.ScriptDuration) / (avg * wall)) * 1000) /
          rate
        ).toFixed(2),
        'draws/frame': ((d1 - d0) / (avg * wall)).toFixed(0),
      });
    };

    await sample('farm idle (spring, day)');
    await sample('farm rain + dusk tint', () =>
      page.evaluate(() => {
        const s = window.__farm.getState();
        s.weather = 'rain';
        s.time.minutes = 1150;
      }),
    );
    await sample('full field: 198 planted tiles + 24 weeds', async () => {
      await page.evaluate(() => {
        const s = window.__farm.getState();
        s.weather = 'sunny';
        s.time.minutes = 700;
        for (let y = 16; y < 27; y++) {
          for (let x = 5; x < 25; x++) {
            s.farm.tiles[`${x},${y}`] = {
              watered: x % 2 === 0,
              crop: { cropId: 'parsnip', stage: (x + y) % 5, daysInStage: 0, regrow: false },
            };
          }
        }
        for (let i = 0; i < 24; i++) s.farm.weeds[`${5 + i},${14}`] = true;
        s.player.x = 14 * 16 + 8;
        s.player.y = 20 * 16 + 11;
        window.__farm.gameEvents.emit('farmChanged', undefined);
      });
    });
    await sample('full field + holding Action (particles, swings)', async () => {
      await page.evaluate(() => {
        const s = window.__farm.getState();
        s.player.facing = 'down';
        window.__farm.inputHub.actionHeld = true;
      });
    });
    await page.evaluate(() => (window.__farm.inputHub.actionHeld = false));
    // Guided start: the coach line, a HUD tag, the row preview and the hand's press-and-drag animation over the
    // full field (the heaviest step to draw: the paint tip of "dig, plant, water").
    await sample('full field + guided start coach marks (row tip)', () =>
      page.evaluate(() => {
        const s = window.__farm.getState();
        delete s.stats['tut.off'];
        s.stats['tut.on'] = 1;
        for (const id of ['harvest', 'seeds', 'plant', 'water']) s.stats[`tut.${id}`] = 1;
        s.stats['tut.seen.grow'] = 1;
        s.stats.tilled = 2;
        s.stats['tut.at.grow.tilled'] = 0;
        s.stats['tut.at.grow.painted'] = 0;
        s.stats.planted = 0;
        s.player.x = 13 * 16 + 8;
        s.player.y = 18 * 16 + 11;
      }),
    );
    await page.evaluate(() => {
      const s = window.__farm.getState();
      s.stats['tut.off'] = 1;
    });
    // Sound-effect storm: 20 cues a second (tools, rewards, steps, touch ticks) on top of the full
    // field and the music, so the budget covers the sfx path (take choice, voice caps, node churn).
    const sfxBefore = await page.evaluate(() => window.__farm.audio.debugInfo().sfx?.played ?? 0);
    await sample('full field + 20 sound effects a second', () =>
      page.evaluate(() => {
        const cues = [
          'water',
          'till',
          'stepGrass',
          'harvest',
          'coin',
          'cut',
          'plant',
          'tick',
          'stepGrass',
          'swing',
        ];
        let i = 0;
        window.__sfxStorm = setInterval(
          () => window.__farm.audio.play(cues[i++ % cues.length]),
          50,
        );
      }),
    );
    await page.evaluate(() => clearInterval(window.__sfxStorm));
    const sfxPlayed =
      (await page.evaluate(() => window.__farm.audio.debugInfo().sfx?.played ?? 0)) - sfxBefore;
    sfxCounts.push({ throttle: `${rate}x`, played: sfxPlayed });
    // Tap-to-walk: the farmer keeps walking long routes across the field with path dots and a goal marker
    // (a new far tap every 1.2 s), and the tap planner (intent + breadth-first path) is timed.
    await sample('tap-walking long routes (path dots)', async () => {
      await page.evaluate(() => {
        const f = window.__farm;
        const corners = [
          [12, 160],
          [188, 280],
          [12, 280],
          [188, 160],
        ];
        let i = 0;
        clearInterval(window.__tapWalk);
        window.__tapWalk = setInterval(() => {
          const [x, y] = corners[i++ % corners.length];
          f.inputHub.emit('tap', { x, y });
        }, 1200);
      });
    });
    const planMs = await page.evaluate(() => {
      clearInterval(window.__tapWalk);
      const w = window.__farm.game.scene.getScenes(true).find((sc) => sc.grid);
      if (typeof w.planTap !== 'function') return 0;
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) w.planTap(i % 2 ? 12 : 188, i % 2 ? 160 : 280);
      return (performance.now() - t0) / 40;
    });
    results.push({
      throttle: `${rate}x`,
      scene: 'tap planner (intent + path), ms per tap',
      fps: '',
      'JS ms/frame': '',
      'draws/frame': '',
      'plan ms': (planMs / rate).toFixed(2),
    });
    // Atmosphere: night glow over the lit town, and ambient life (fireflies at night, petals and butterflies).
    const visit = (map, scene, tx, ty, minutes, season) =>
      page.evaluate(
        ([map, scene, tx, ty, minutes, season]) => {
          const f = window.__farm;
          const s = f.getState();
          s.weather = 'sunny';
          s.time.minutes = minutes;
          s.time.season = season;
          s.player.map = map;
          s.player.x = tx * 16 + 8;
          s.player.y = ty * 16 + 11;
          const active = f.game.scene.getScenes(true).find((x) => x.scene.key !== 'UI');
          active.scene.start(scene);
        },
        [map, scene, tx, ty, minutes, season],
      );
    await sample('town at night: lamps, windows, forge', () =>
      visit('town', 'Town', 11, 12, 1380, 'spring'),
    );
    await sample('woods summer night: fireflies + glow', () =>
      visit('woods', 'Woods', 11, 19, 1380, 'summer'),
    );
    await sample('woods spring day: petals + butterflies', () =>
      visit('woods', 'Woods', 11, 10, 700, 'spring'),
    );
    // The see-through hole (art round 3): a geometry mask over the overhead layer while a crown covers the
    // player, and over a placed fruit tree the player stands behind.
    await sample('farm: behind a lone tree (see-through hole)', async () => {
      await visit('farm', 'Farm', 7, 1, 700, 'spring');
      await page.waitForTimeout(800);
      await page.evaluate(() => (window.__farm.getState().player.facing = 'down'));
    });
    await sample('farm: behind a grown fruit tree (see-through hole)', () =>
      page.evaluate(() => {
        const f = window.__farm;
        const s = f.getState();
        s.placed.farm = [
          {
            id: 901,
            type: 'apple_sapling',
            tx: 14,
            ty: 20,
            data: { tree: { age: 20, timer: 0, fruit: 2 } },
          },
        ];
        s.player.x = 14 * 16 + 8;
        s.player.y = 19 * 16 + 11;
        s.player.facing = 'down';
        f.gameEvents.emit('placedChanged', { map: 'farm' });
      }),
    );
    // The budget above includes the audio engine's scheduling: report that music really was playing.
    const au = await page.evaluate(() => window.__farm.audio.debugInfo());
    console.log(
      `${rate}x audio during the run: ${JSON.stringify({ state: au.state, synth: au.synthMusic, music: au.music, sfx: au.sfx })}`,
    );
    await ctx.close();
  }
  for (const rate of runPacingPart ? throttles : []) await runPacing(rate);
} finally {
  await browser.close();
  server.kill();
}
if (results.length) console.table(results);
if (pacing.length) {
  console.log('Frame pacing (ms between frames; "work" is the game\'s own time per frame):');
  console.table(pacing);
  console.log('Map changes, worst frame per door:', JSON.stringify(doorWorst));
}

// The storm scene must really have played sound effects from files (not the synth, not nothing).
if (runBudget)
  console.log('sfx played from files during the storm scene:', JSON.stringify(sfxCounts));
const quiet = sfxCounts.filter((c) => c.played < 20);
if (quiet.length > 0) {
  console.error('PERF: the sound-effect scene played fewer than 20 sfx from files:', quiet);
  process.exit(1);
}

// Regression budgets (hardware-independent): fail loudly if the renderer gets heavier.
const BUDGET = { drawsPerFrame: 12, jsMsPerFrame: 3.5 }; // and a tap's planning <= 2 ms (CPU-normalised)
const bad = results.filter(
  (r) =>
    Number(r['draws/frame']) > BUDGET.drawsPerFrame ||
    Number(r['JS ms/frame']) > BUDGET.jsMsPerFrame ||
    Number(r['plan ms'] ?? 0) > 2,
);
if (bad.length > 0) {
  console.error(
    `PERF BUDGET EXCEEDED (max ${BUDGET.drawsPerFrame} draws/frame, ${BUDGET.jsMsPerFrame} ms JS/frame):`,
    bad,
  );
  process.exit(1);
}
if (runBudget)
  console.log(
    `Within budget (<= ${BUDGET.drawsPerFrame} draws/frame, <= ${BUDGET.jsMsPerFrame} ms JS/frame at 1x).`,
  );

// Frame-time budgets (ms between frames, headless software GL; set against the round-3 baseline with the feel
// critic, so a regression fails rather than hides under a loose bar):
//  - steady play (idle, walk, tap-walk, a painted row): p95 <= 8 at 1x, p99 <= 14 at 4x, no frame over 100 at 6x;
//  - other steady scenes (sheets, festival, coach marks): p95 <= 8 at 1x;
//  - a map change: worst frame <= 34 at 1x and 4x, <= 50 at 6x (the build runs while the wipe covers the world);
//  - sleep and the morning summary: no frame over 50 at 1x, 100 at 4x;
//  - a new game: no frame over 100 at 1x, 200 at 4x (the build runs under the title's wipe).
const STEADY = ['idle', 'walk', 'tap-walk', 'paint'];
const CALM = ['sheets', 'festival', 'guided start'];
const pacingBad = [];
for (const r of pacingRaw) {
  const f = r.f;
  const why = [];
  const over = (limit, what = 'max') =>
    f.max > limit && why.push(`${what} ${f.max.toFixed(0)} > ${limit}`);
  if (STEADY.includes(r.scene) || CALM.includes(r.scene)) {
    if (r.rate === 1 && f.p95 > 8) why.push(`p95 ${f.p95.toFixed(1)} > 8`);
    if (STEADY.includes(r.scene) && r.rate === 4 && f.p99 > 14)
      why.push(`p99 ${f.p99.toFixed(1)} > 14`);
    if (STEADY.includes(r.scene) && r.rate >= 6) over(100);
  } else if (r.scene === 'door') {
    over(r.rate >= 6 ? 50 : 34, r.door);
  } else if (r.scene === 'sleep') {
    if (r.rate === 1) over(50);
    if (r.rate === 4) over(100);
  } else if (r.scene === 'new game') {
    if (r.rate === 1) over(100);
    if (r.rate === 4) over(200);
  }
  if (why.length) pacingBad.push(`${r.rate}x ${r.scene}: ${why.join(', ')}`);
}
if (pacingBad.length) {
  console.error('FRAME PACING BUDGET EXCEEDED:', pacingBad);
  process.exit(1);
}
if (pacingRaw.length)
  console.log(
    'Frame pacing within budget (steady p95 <= 8 ms at 1x, p99 <= 14 at 4x; map changes <= 34 ms at 4x, 50 at 6x).',
  );
