// The mine: nodes on the cavern floor, a mining action, and the bar-gated Upgrades tab.
import { chromium } from 'playwright-core';
const OUT = process.env.OUT ?? 'agents/out/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (
  await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: 2,
  })
).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto((process.env.URL ?? 'http://localhost:5173/') + '?debug');
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  s.player.map = 'mine';
  s.player.x = 9 * 16 + 8;
  s.player.y = 24 * 16 + 11;
  s.player.facing = 'up';
  s.nodes.mine = {
    '9,23': 'copper_node',
    '7,22': 'iron_node',
    '11,21': 'gem_node',
    '8,20': 'rock_node',
    '12,24': 'copper_node',
    '6,25': 'rock_node',
  };
  s.skills.mining = 400;
  s.inventory.selected = 4; // pickaxe
  f.game.scene
    .getScenes(true)
    .find((x) => x.scene.key === 'Farm')
    .scene.start('Mine');
});
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + 'mine.png' });
await page.keyboard.down('Space');
await page.waitForTimeout(150);
await page.keyboard.up('Space');
await page.waitForTimeout(500);
console.log(
  await page.evaluate(() =>
    JSON.stringify({
      n: window.__farm.getState().nodes,
      inv: window.__farm.getState().inventory.slots.slice(4, 10),
    }),
  ),
);
await page.screenshot({ path: OUT + 'mine_after.png' });
await page.evaluate(() => {
  window.__farm.gameEvents.emit('openPanel', { type: 'shop' });
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const sp = window.__farm.game.scene.getScene('UI').panels.get('shop');
  sp.tab = 'upgrades';
  sp.rebuild();
});
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + 'upgrades.png' });
console.log(errors);
await browser.close();
