// End-to-end smoke test: builds nothing, serves dist/ with `vite preview`, and plays the core
// loop in headless Chromium. Run `npm run build` first. Needs a Chromium: set CHROMIUM_PATH
// (defaults to the Playwright cache location used in CI/cloud sandboxes).
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4173;
const URL_ = `http://localhost:${PORT}/?debug`;
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});
const stop = () => server.kill();
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(URL_)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
};

await waitForServer();
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__farm.getState())));
  const sceneKeys = () =>
    page.evaluate(() => window.__farm.game.scene.getScenes(true).map((s) => s.scene.key));
  const placePlayer = (tx, ty, facing) =>
    page.evaluate(
      ([tx, ty, facing]) => {
        const p = window.__farm.getState().player;
        p.x = tx * 16 + 8;
        p.y = ty * 16 + 11;
        p.facing = facing;
      },
      [tx, ty, facing],
    );
  const tap = async (key, ms = 120) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    await page.waitForTimeout(300);
  };

  // 1. Title -> New Game (Enter)
  await page.goto(URL_);
  await page.waitForTimeout(1500);
  check('title scene shows first', (await sceneKeys()).includes('Title'));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  check('new game enters the farm with the UI overlay', (await sceneKeys()).join() === 'Farm,UI');

  // 2. Till, plant, water on the farm
  await placePlayer(14, 17, 'down');
  await page.keyboard.press('Digit1');
  await tap('Space');
  let s = await state();
  check(
    'hoe tills a tile for 2 energy',
    Object.keys(s.farm.tiles).length === 1 && s.energy === 98,
    JSON.stringify(s.farm.tiles),
  );
  await page.keyboard.press('Digit4');
  await tap('Space');
  s = await state();
  check(
    'seeds plant on tilled soil',
    Object.values(s.farm.tiles).some((t) => t.crop),
    '',
  );
  await page.keyboard.press('Digit2');
  await tap('Space');
  s = await state();
  check(
    'can waters the crop',
    Object.values(s.farm.tiles).every((t) => t.watered) && s.water === 19,
    `water ${s.water}`,
  );

  // 3. Sleep: confirm dialog + summary both driven by Enter
  await page.evaluate(() => window.__farm.gameEvents.emit('sleepRequest', { passedOut: false }));
  await page.waitForTimeout(3200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2200);
  s = await state();
  check(
    'sleeping advances the day and grows the crop',
    s.time.day === 2 && Object.values(s.farm.tiles)[0].crop.stage === 1,
    JSON.stringify(s.time),
  );
  check(
    'player wakes up in the house with full energy',
    s.player.map === 'house' && s.energy === 100,
    `${s.player.map} ${s.energy}`,
  );

  // 4. Persistence: reload -> Continue restores the same world
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForTimeout(1800);
  await page.keyboard.press('Enter'); // primary button is Continue now
  await page.waitForTimeout(1500);
  const after = await state();
  check(
    'continue restores day, farm and map',
    after.time.day === 2 &&
      Object.keys(after.farm.tiles).length === 1 &&
      after.player.map === 'house',
  );

  check('no console errors during the whole run', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  stop();
}
console.log(failed === 0 ? '\nE2E OK' : `\nE2E FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
