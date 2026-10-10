// Critique 9's unexplained stall: on day 31 a critic bot's bin and then bed would not open after "Inventory full!".
// The bot (critique-9 play3.mjs) mined with a full bag by teleporting next to every ore node and pressing Space,
// then teleported to the farm with scene.start and pressed E at the bin. This replays that, and two variants:
//   A. full bag, mine loop as the bot did it, then farm + E at the bin, then house + E at the bed
//   B. the same, but the last mine teleport stands on the mine's door (9,29) right before scene.start
//   C. a door walk and a scene.start in the same frame (two transitions at once)
// After each, it prints the active scenes, runtime flags, the world scene's own flags, and whether the clock ticks.
// Run from farm-game/ with a dev server: URL=http://localhost:5174/ node agents/probes/stall-day31.mjs
import { chromium } from 'playwright-core';

const URL_ = process.env.URL ?? 'http://localhost:5174/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const errs = [];

async function fresh() {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  ).newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(`${URL_}?debug`);
  await page.waitForTimeout(2000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  return page;
}

const KEYS = { farm: 'Farm', town: 'Town', woods: 'Woods', mine: 'Mine', house: 'House' };

/** The critic's goMap: set the player and start the target scene from the first active world scene. */
const goMap = (page, map, tx, ty, facing = 'down', wait = 1500) =>
  page
    .evaluate(
      ({ map, tx, ty, facing, KEYS }) => {
        const f = window.__farm;
        const s = f.getState();
        const cur = f.game.scene
          .getScenes(true)
          .find((x) => Object.values(KEYS).includes(x.scene.key));
        s.player.map = map;
        s.player.x = tx * 16 + 8;
        s.player.y = ty * 16 + 11;
        s.player.facing = facing;
        if (cur.scene.key !== KEYS[map]) cur.scene.start(KEYS[map]);
      },
      { map, tx, ty, facing, KEYS },
    )
    .then(() => page.waitForTimeout(wait));

const snap = (page, tx, ty, facing) =>
  page
    .evaluate(
      ({ tx, ty, facing }) => {
        const p = window.__farm.getState().player;
        p.x = tx * 16 + 8;
        p.y = ty * 16 + 11;
        if (facing) p.facing = facing;
      },
      { tx, ty, facing },
    )
    .then(() => page.waitForTimeout(120));

const report = (page, label) =>
  page
    .evaluate(
      ({ label, KEYS }) => {
        const f = window.__farm;
        const s = f.getState();
        const worlds = f.game.scene
          .getScenes(true)
          .filter((x) => Object.values(KEYS).includes(x.scene.key));
        const ui = f.game.scene.getScene('UI');
        const open = [...ui.panels.entries()].filter(([, p]) => p.isOpen).map(([k]) => k);
        const rt = f.runtime ?? {};
        return `${label}: worlds [${worlds.map((w) => `${w.scene.key}${w.transitioning ? ' (transitioning)' : ''}${w.inputLocked ? ' (inputLocked)' : ''}`).join(', ')}] map ${s.player.map} clock ${s.time.minutes} open [${open.join(',')}] runtime ${JSON.stringify({ modals: rt.modals, busy: rt.busy, suspended: rt.suspended })} bag free ${s.inventory.slots.filter((x) => !x).length}`;
      },
      { label, KEYS },
    )
    .then((line) => console.log(line));

const blocked = (page, tx, ty) =>
  page.evaluate(
    ({ tx, ty }) => {
      const sc = window.__farm.game.scene.getScenes(true).find((x) => x.grid);
      if (!sc) return true;
      const g = sc.grid;
      if (tx < 0 || ty < 0 || tx >= g.width || ty >= g.height) return true;
      return !!g.blocked[ty * g.width + tx];
    },
    { tx, ty },
  );

const FACE = { '1,0': 'left', '-1,0': 'right', '0,1': 'up', '0,-1': 'down' };

async function fillBag(page) {
  await page.evaluate(() => {
    const s = window.__farm.getState();
    for (let i = 0; i < s.inventory.slots.length; i++)
      if (!s.inventory.slots[i]) s.inventory.slots[i] = { item: 'wild_leek', qty: 99 };
    s.time.minutes = 8 * 60;
    // The ore nodes the critic's bot found in the mine that day (critique-9 race31 state).
    s.nodes.mine = {
      '3,19': 'copper_node',
      '8,22': 'rock_node',
      '14,5': 'rock_node',
      '13,16': 'rock_node',
      '13,11': 'rock_node',
      '12,15': 'iron_node',
      '11,19': 'rock_node',
      '10,7': 'rock_node',
      '5,18': 'rock_node',
      '10,18': 'copper_node',
      '6,14': 'rock_node',
      '13,18': 'rock_node',
      '9,14': 'rock_node',
      '12,9': 'rock_node',
      '14,7': 'copper_node',
      '16,11': 'iron_node',
      '9,5': 'rock_node',
      '7,18': 'gem_node',
      '4,8': 'copper_node',
      '13,19': 'rock_node',
      '12,22': 'copper_node',
      '9,8': 'rock_node',
    };
  });
}

async function mineLoop(page, { endOnDoor = false } = {}) {
  await goMap(page, 'mine', 9, 27, 'up');
  const nodes = await page.evaluate(() => Object.keys(window.__farm.getState().nodes.mine ?? {}));
  for (const k of nodes) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      if (await blocked(page, x + dx, y + dy)) continue;
      await snap(page, x + dx, y + dy, FACE[`${dx},${dy}`]);
      break;
    }
    await page.keyboard.press('Digit5');
    await page.keyboard.down('Space');
    await page.waitForTimeout(140);
    await page.keyboard.up('Space');
    await page.waitForTimeout(260);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  if (endOnDoor) await snap(page, 9, 29, 'down');
  return nodes.length;
}

async function binThenBed(page, label) {
  await report(page, `${label} after mining`);
  await goMap(page, 'farm', 12, 10, 'up');
  await snap(page, 12, 10, 'up');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  const bin = await page.evaluate(
    () => window.__farm.game.scene.getScene('UI').panels.get('bin')?.isOpen,
  );
  await report(page, `${label} at the bin (opened: ${bin})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await goMap(page, 'house', 3, 3, 'left');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  const bed = await page.evaluate(
    () => window.__farm.game.scene.getScene('UI').panels.get('sleep')?.isOpen,
  );
  await report(page, `${label} at the bed (opened: ${bed})`);
  return { bin, bed };
}

const results = {};

// A. the bot's sequence
{
  const page = await fresh();
  await fillBag(page);
  const n = await mineLoop(page);
  console.log(`A. mined ${n} nodes with a full bag`);
  results.A = await binThenBed(page, 'A');
  await page.context().close();
}

// B. the last mine teleport lands on the door, and scene.start follows at once
{
  const page = await fresh();
  await fillBag(page);
  await mineLoop(page, { endOnDoor: true });
  results.B = await binThenBed(page, 'B');
  await page.context().close();
}

// C. two transitions at once: walk onto the door and call scene.start in the same moment
{
  const page = await fresh();
  await goMap(page, 'mine', 9, 28, 'down');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(260); // step onto the door tile: the door's fade starts
  await page.keyboard.up('ArrowDown');
  await goMap(page, 'farm', 12, 10, 'up', 100); // ...and the bot's scene.start lands mid-fade
  await page.waitForTimeout(1500);
  results.C = await binThenBed(page, 'C');
  await page.context().close();
}

console.log(JSON.stringify(results), 'errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
