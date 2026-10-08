// Town projects: the board with its Town projects button, the project list, a project page, and the
// landmark that appears in town once a project is finished.
//   URL=http://localhost:5174/ OUT=agents/out/ CHROMIUM_PATH=... node agents/probes/projects.mjs
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
const ui = (fn) => page.evaluate(fn);
await ui(() => {
  const f = window.__farm;
  const s = f.getState();
  s.money = 3000;
  s.inventory.slots[6] = { item: 'fiber', qty: 25 };
  s.player.map = 'town';
  s.player.x = 14 * 16 + 8;
  s.player.y = 12 * 16 + 11;
  s.player.facing = 'up';
  s.time.minutes = 600;
  f.game.scene
    .getScenes(true)
    .find((x) => x.scene.key === 'Farm')
    .scene.start('Town');
});
await page.waitForTimeout(1500);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}projects-1-board.png` });
await ui(() => {
  const p = window.__farm.game.scene.getScene('UI').panels;
  p.get('board').close();
  window.__farm.gameEvents.emit('openPanel', { type: 'projects' });
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}projects-2-list.png` });
await ui(() => {
  const panel = window.__farm.game.scene.getScene('UI').panels.get('projects');
  panel.id = 'canopy';
  panel.rebuild();
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}projects-3-detail.png` });
// press +1,000g and Give goods through the real buttons (canvas coordinates, 200 logical px wide)
const box = await page.evaluate(() => {
  const c = document.querySelector('canvas').getBoundingClientRect();
  return { x: c.x, y: c.y, k: c.width / 200 };
});
const click = async (lx, ly) => {
  await page.mouse.click(box.x + lx * box.k, box.y + ly * box.k);
  await page.waitForTimeout(250);
};
// sheet is 250 tall at the bottom of 400: buttons at sheet y 168 (gold) and 194 (goods)
await click(8 + 62 + 29, 150 + 168 + 11); // +1,000g
await click(8 + 62 + 29, 150 + 168 + 11); // +1,000g (only 200 more needed)
await page.screenshot({ path: `${OUT}projects-4-gold-given.png` });
await click(8 + 45, 150 + 194 + 11); // Give goods: finishes it
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}projects-5-finished-list.png` });
const st = await ui(() => ({
  done: window.__farm.getState().stats['project.canopy'],
  money: window.__farm.getState().money,
}));
await ui(() => window.__farm.game.scene.getScene('UI').panels.get('projects').close());
await ui(() => {
  const s = window.__farm.getState();
  s.player.x = 16 * 16 + 8;
  s.player.y = 15 * 16 + 11;
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}projects-6-landmark.png` });
console.log(JSON.stringify(st), errs);
await browser.close();
