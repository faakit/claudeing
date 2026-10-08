// Daily jobs: the morning summary that announces them and the Goal tab that tracks them.
//   URL=http://localhost:5174/ OUT=agents/out/ CHROMIUM_PATH=... node agents/probes/jobs.mjs
import { chromium } from 'playwright-core';
const OUT = process.env.OUT ?? 'agents/out/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.URL ?? 'http://localhost:5173/'}?debug`);
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => window.__farm.gameEvents.emit('sleepRequest', { passedOut: false }));
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}jobs-1-summary.png` });
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  const fish = s.jobs.list.find((j) => j.id === 'fish');
  s.stats.caught = (s.stats.caught ?? 0) + fish.n; // as if the fish were caught
  f.gameEvents.emit('openPanel', { type: 'menu' });
  f.game.scene.getScene('UI').menu.openTab('goals');
});
await page.waitForTimeout(500);
await page.evaluate(() => window.__farm.gameEvents.emit('inventoryChanged', undefined));
await page.screenshot({ path: `${OUT}jobs-2-goal-tab.png` });
console.log(JSON.stringify(await page.evaluate(() => window.__farm.getState().jobs)), errs);
await browser.close();
