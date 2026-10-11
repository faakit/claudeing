// Depth round 4: the settling-in pay (day-3 morning note and Goal tab) and the goal after an open legend goal.
//   URL=http://localhost:5174/ OUT=agents/out/ CHROMIUM_PATH=... node agents/probes/round4.mjs
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
await page.goto(`${process.env.URL ?? 'http://localhost:5174/'}?debug&tutorial=0`);
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const sleep = async (shot) => {
  await page.evaluate(() => window.__farm.gameEvents.emit('sleepRequest', { passedOut: false }));
  await page.waitForTimeout(3200);
  if (shot) await page.screenshot({ path: `${OUT}${shot}.png` });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
};
await sleep(); // day 2
await sleep('r4-1-day3-summary'); // day 3
const goalTab = async (shot) => {
  await page.evaluate(() => {
    const f = window.__farm;
    f.gameEvents.emit('openPanel', { type: 'menu' });
    f.game.scene.getScene('UI').menu.openTab('goals');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}${shot}.png` });
  await page.evaluate(() => window.__farm.game.scene.getScene('UI').menu.close());
  await page.waitForTimeout(300);
};
await goalTab('r4-2-day3-goal-tab');
const jobs3 = await page.evaluate(() => window.__farm.getState().jobs);
await page.evaluate(() => {
  const s = window.__farm.getState();
  s.goalIndex = 54; // "Catch a legendary fish"
  s.stats.boardWins = 0;
});
await goalTab('r4-3-goal-after-legend');
await page.evaluate(() => {
  const s = window.__farm.getState();
  s.stats.boardWins = 1; // win a season: board1 completes past the open legend
  window.__farm.gameEvents.emit('inventoryChanged', undefined);
});
await sleep(); // day 4 (goals checked overnight)
await goalTab('r4-4-goal-after-board-win');
console.log(JSON.stringify({ jobs3, goal: await page.evaluate(() => window.__farm.getState().goalIndex) }), errs);
await browser.close();
