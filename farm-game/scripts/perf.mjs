// Frame-rate probe: plays a few worst-case scenes under CPU throttling and reports FPS.
// Headless Chromium renders with software GL, so absolute numbers are pessimistic; use this to
// compare before/after a change and to catch regressions, not as a device benchmark.
// Usage: npm run build && node scripts/perf.mjs [throttle=1,4,6]
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

// Override with PERF_PORT when another checkout runs its checks at the same time.
const PORT = Number(process.env.PERF_PORT ?? 4174);
const URL_ = `http://localhost:${PORT}/?debug`;
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const throttles = (process.argv[2] ?? '1,4,6').split(',').map(Number);

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

const browser = await chromium.launch({ executablePath: CHROMIUM });
const results = [];
/** Sound effects played from files during the storm scene, per throttle level. */
const sfxCounts = [];
try {
  for (const rate of throttles) {
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
    // Sound-effect storm: 20 cues a second (tools, rewards, steps, touch ticks) on top of the full
    // field and the music, so the budget covers the sfx path (take choice, voice caps, node churn).
    const sfxBefore = await page.evaluate(() => window.__farm.audio.debugInfo().sfx?.played ?? 0);
    await sample('full field + 20 sound effects a second', () =>
      page.evaluate(() => {
        const cues = ['water', 'till', 'stepGrass', 'harvest', 'coin', 'cut', 'plant', 'tick', 'stepGrass', 'swing'];
        let i = 0;
        window.__sfxStorm = setInterval(() => window.__farm.audio.play(cues[i++ % cues.length]), 50);
      }),
    );
    await page.evaluate(() => clearInterval(window.__sfxStorm));
    const sfxPlayed = (await page.evaluate(() => window.__farm.audio.debugInfo().sfx?.played ?? 0)) - sfxBefore;
    sfxCounts.push({ throttle: `${rate}x`, played: sfxPlayed });
    // The budget above includes the audio engine's scheduling: report that music really was playing.
    const au = await page.evaluate(() => window.__farm.audio.debugInfo());
    console.log(
      `${rate}x audio during the run: ${JSON.stringify({ state: au.state, synth: au.synthMusic, music: au.music, sfx: au.sfx })}`,
    );
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.table(results);

// The storm scene must really have played sound effects from files (not the synth, not nothing).
console.log('sfx played from files during the storm scene:', JSON.stringify(sfxCounts));
const quiet = sfxCounts.filter((c) => c.played < 20);
if (quiet.length > 0) {
  console.error('PERF: the sound-effect scene played fewer than 20 sfx from files:', quiet);
  process.exit(1);
}

// Regression budgets (hardware-independent): fail loudly if the renderer gets heavier.
const BUDGET = { drawsPerFrame: 12, jsMsPerFrame: 3.5 };
const bad = results.filter(
  (r) =>
    Number(r['draws/frame']) > BUDGET.drawsPerFrame ||
    Number(r['JS ms/frame']) > BUDGET.jsMsPerFrame,
);
if (bad.length > 0) {
  console.error(
    `PERF BUDGET EXCEEDED (max ${BUDGET.drawsPerFrame} draws/frame, ${BUDGET.jsMsPerFrame} ms JS/frame):`,
    bad,
  );
  process.exit(1);
}
console.log(
  `Within budget (<= ${BUDGET.drawsPerFrame} draws/frame, <= ${BUDGET.jsMsPerFrame} ms JS/frame at 1x).`,
);
