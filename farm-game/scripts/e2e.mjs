// End-to-end smoke test: builds nothing, serves dist/ with `vite preview`, and plays the core
// loop in headless Chromium, in a portrait phone viewport. Run `npm run build` first. Needs a Chromium: set CHROMIUM_PATH
// (defaults to the Playwright cache location used in CI/cloud sandboxes).
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4173;
const URL_ = `http://localhost:${PORT}/?debug`;
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  {
    stdio: 'ignore',
  },
);
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
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
  await placePlayer(10, 17, 'down');
  await page.keyboard.press('Digit1');
  await tap('Space');
  let s = await state();
  check(
    'hoe tills a tile for 2 energy',
    Object.keys(s.farm.tiles).length === 1 && s.energy === 98,
    JSON.stringify(s.farm.tiles),
  );
  await page.keyboard.press('Digit6');
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

  // 5. Backgrounding the app freezes the clock and drops held input; foregrounding resumes it
  const setHidden = (hidden) =>
    page.evaluate((hidden) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await page.keyboard.down('ArrowLeft'); // a key held while the app is backgrounded...
  await page.waitForTimeout(100);
  await setHidden(true);
  await page.keyboard.up('ArrowLeft'); // ...whose key-up the page never sees
  await page.waitForTimeout(300); // let any in-flight frame finish
  const t0 = (await state()).time;
  await page.waitForTimeout(2500);
  const t1 = (await state()).time;
  check(
    'backgrounded app: clock frozen',
    t1.minutes === t0.minutes && t1.acc === t0.acc,
    `${JSON.stringify(t0)} -> ${JSON.stringify(t1)}`,
  );
  check(
    'backgrounded app: held input dropped',
    await page.evaluate(() => window.__farm.inputHub.direction === null),
  );
  await setHidden(false);
  await page.waitForTimeout(3000);
  const t2 = (await state()).time;
  check(
    'foregrounded app: clock runs again',
    t2.minutes > t1.minutes || t2.acc > t1.acc,
    JSON.stringify(t2),
  );

  // 6. Installability: the manifest is valid and every icon it names exists
  const manifestUrl = new URL('manifest.webmanifest', URL_).href;
  const manifest = await (await fetch(manifestUrl)).json();
  check(
    'manifest asks for fullscreen portrait',
    manifest.display === 'fullscreen' && manifest.orientation === 'portrait',
  );
  const iconResponses = await Promise.all(
    manifest.icons.map((i) => fetch(new URL(i.src, manifestUrl))),
  );
  check(
    'manifest icons all load',
    iconResponses.every((r) => r.ok && r.headers.get('content-type')?.includes('image/png')),
  );
  check(
    'manifest has a maskable icon and a 512px icon',
    manifest.icons.some((i) => i.purpose === 'maskable') &&
      manifest.icons.some((i) => i.sizes === '512x512'),
  );

  check('no console errors during the whole run', errors.length === 0, errors.join(' | '));

  // 6b. The mechanics layer, in a fresh game: forage, smart targeting, placeables, fishing
  const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const mp = await mCtx.newPage();
  const mErrors = [];
  mp.on('console', (m) => m.type() === 'error' && mErrors.push(m.text()));
  mp.on('pageerror', (e) => mErrors.push(String(e)));
  const mState = () => mp.evaluate(() => JSON.parse(JSON.stringify(window.__farm.getState())));
  const mPlace = (tx, ty, facing) =>
    mp.evaluate(
      ([tx, ty, facing]) => {
        const p = window.__farm.getState().player;
        p.x = tx * 16 + 8;
        p.y = ty * 16 + 11;
        p.facing = facing;
      },
      [tx, ty, facing],
    );
  const mTap = async (key) => {
    await mp.keyboard.down(key);
    await mp.waitForTimeout(120);
    await mp.keyboard.up(key);
    await mp.waitForTimeout(350);
  };
  await mp.goto(URL_);
  await mp.waitForTimeout(1500);
  await mp.keyboard.press('Enter');
  await mp.waitForTimeout(1500);
  await mp.evaluate(() => (window.__farm.getState().time.minutes = 600)); // villagers are out by 10:00
  await mPlace(13, 17, 'down');
  await mp.evaluate(() => {
    const f = window.__farm;
    f.getState().forage.farm = { '13,18': 'wild_leek', '12,18': 'daffodil' };
    f.gameEvents.emit('forageChanged', { map: 'farm' });
  });
  await mp.keyboard.press('Digit1');
  await mTap('Space');
  let m = await mState();
  const held = (id) => m.inventory.slots.some((x) => x?.item === id);
  check(
    'Action picks up the wild good in front, whatever is equipped',
    held('wild_leek') && !m.forage.farm?.['13,18'] && m.stats.foraged === 1,
    JSON.stringify(m.forage),
  );
  await mTap('Space');
  m = await mState();
  check(
    'smart targeting: Action then reaches the good beside the faced tile',
    held('daffodil') && m.stats.foraged === 2,
    JSON.stringify(m.forage),
  );
  await mp.evaluate(() => {
    const s = window.__farm.getState();
    s.inventory.slots[5] = { item: 'sprinkler', qty: 1 };
  });
  await mp.keyboard.press('Digit6');
  await mTap('Space');
  m = await mState();
  check(
    'a sprinkler can be placed on free ground',
    m.placed.farm?.length === 1 && m.placed.farm[0].type === 'sprinkler',
    JSON.stringify(m.placed),
  );
  await mTap('KeyE');
  m = await mState();
  check(
    'Interact picks the sprinkler back up',
    !m.placed.farm && m.inventory.slots.some((x) => x?.item === 'sprinkler'),
    JSON.stringify(m.placed),
  );
  // villagers and animals
  await mPlace(15, 12, 'right');
  await mTap('KeyE');
  m = await mState();
  const npcOpen = await mp.evaluate(() => window.__farm.game.scene.getScene('UI').npc.isOpen);
  check(
    'Interact talks to a villager: panel opens and friendship grows',
    npcOpen && m.friends.rosa?.points === 10 && m.stats.talked === 1,
    JSON.stringify(m.friends),
  );
  await mp.keyboard.press('Escape');
  await mp.waitForTimeout(300);
  // A real press-and-release on the on-screen Interact button must leave the sheet open
  // (the release lands on the dim backdrop; it used to count as "tap outside" and close it).
  await mPlace(15, 12, 'right');
  await mp.waitForTimeout(300);
  const box = await mp.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { x: c.x, y: c.y, k: c.width / 200 };
  });
  await mp.mouse.move(box.x + 125 * box.k, box.y + 343 * box.k);
  await mp.mouse.down();
  await mp.waitForTimeout(150);
  await mp.mouse.up();
  await mp.waitForTimeout(500);
  check(
    'tap on the Interact button opens the villager sheet and it stays open on release',
    await mp.evaluate(() => window.__farm.game.scene.getScene('UI').npc.isOpen),
  );
  await mp.keyboard.press('Escape');
  await mp.waitForTimeout(300);
  await mp.evaluate(() => {
    const s = window.__farm.getState();
    s.inventory.slots[5] = { item: 'chicken', qty: 1 };
    s.inventory.slots[6] = { item: 'chicken_feed', qty: 3 };
    s.placed.farm = [{ id: 9, type: 'coop', tx: 10, ty: 10, data: {} }];
    s.nextPlacedId = 10;
    window.__farm.gameEvents.emit('placedChanged', { map: 'farm' });
  });
  await mPlace(11, 10, 'left');
  await mTap('KeyE');
  m = await mState();
  check(
    'Interact at a coop moves the chicken in and feeds it',
    m.placed.farm[0].data.house?.n === 1 && m.placed.farm[0].data.house?.fed === true,
    JSON.stringify(m.placed.farm[0]),
  );
  // Swiping up on the Action button changes tool without reaching for the hotbar.
  await mp.keyboard.press('Digit1');
  const swipeBox = await mp.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { x: c.x, y: c.y, k: c.width / 200 };
  });
  await mp.mouse.move(swipeBox.x + 166 * swipeBox.k, swipeBox.y + 324 * swipeBox.k);
  await mp.mouse.down();
  await mp.mouse.move(swipeBox.x + 166 * swipeBox.k, swipeBox.y + 300 * swipeBox.k, { steps: 6 });
  await mp.mouse.up();
  await mp.waitForTimeout(200);
  m = await mState();
  check(
    'swiping up on the Action button selects the next tool',
    m.inventory.selected === 1,
    `selected ${m.inventory.selected}`,
  );
  // The mine: a pickaxe breaks a node and the ore lands in the bag.
  await mp.evaluate(() => {
    const f = window.__farm;
    const s = f.getState();
    s.nodes.mine = { '9,23': 'copper_node' };
    s.player.map = 'mine';
    s.player.x = 9 * 16 + 8;
    s.player.y = 24 * 16 + 11;
    s.player.facing = 'up';
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key === 'Farm')
      .scene.start('Mine');
  });
  await mp.waitForTimeout(1200);
  await mp.keyboard.press('Digit5'); // pickaxe
  await mTap('Space');
  m = await mState();
  check(
    'the pickaxe breaks a node in the mine and yields ore',
    !m.nodes.mine?.['9,23'] &&
      m.inventory.slots.some((x) => x?.item === 'copper_ore') &&
      m.stats.mined === 1,
    JSON.stringify(m.nodes),
  );
  await mp.evaluate(() => {
    const f = window.__farm;
    const s = f.getState();
    s.player.map = 'farm';
    s.player.x = 13 * 16 + 8;
    s.player.y = 17 * 16 + 11;
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key === 'Mine')
      .scene.start('Farm');
  });
  await mp.waitForTimeout(1200);
  await mPlace(18, 31, 'right');
  await mp.keyboard.press('Digit4'); // fishing rod
  const energyBefore = (await mState()).energy;
  await mTap('Space');
  m = await mState();
  const fishingOpen = await mp.evaluate(
    () => window.__farm.game.scene.getScene('UI').panels.get('fishing').isOpen,
  );
  check(
    'casting the rod at the pond opens the fishing game and costs energy',
    fishingOpen && m.energy < energyBefore,
    `open=${fishingOpen} energy ${energyBefore}->${m.energy}`,
  );
  check('mechanics run: no console errors', mErrors.length === 0, mErrors.join(' | '));
  await mCtx.close();

  // 6c. Town projects: the board links to the fund; giving gold and goods finishes a project and
  // its perk (a 4th request) shows on the next morning's board.
  const pCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const pp = await pCtx.newPage();
  const pErrors = [];
  pp.on('console', (m) => m.type() === 'error' && pErrors.push(m.text()));
  pp.on('pageerror', (e) => pErrors.push(String(e)));
  const pState = () => pp.evaluate(() => JSON.parse(JSON.stringify(window.__farm.getState())));
  await pp.goto(URL_);
  await pp.waitForTimeout(1500);
  await pp.keyboard.press('Enter');
  await pp.waitForTimeout(1500);
  await pp.evaluate(() => {
    const f = window.__farm;
    const s = f.getState();
    s.money = 3000;
    s.inventory.slots[6] = { item: 'fiber', qty: 25 };
    s.time.minutes = 600;
    s.player.map = 'town';
    s.player.x = 14 * 16 + 8;
    s.player.y = 12 * 16 + 11;
    s.player.facing = 'up';
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key === 'Farm')
      .scene.start('Town');
  });
  await pp.waitForTimeout(1500);
  await pp.keyboard.down('KeyE');
  await pp.waitForTimeout(120);
  await pp.keyboard.up('KeyE');
  await pp.waitForTimeout(500);
  const ui = (fn) => pp.evaluate(fn);
  check(
    'Interact at the town board opens the requests board',
    await ui(() => window.__farm.game.scene.getScene('UI').panels.get('board').isOpen),
  );
  await ui(() => {
    window.__farm.game.scene.getScene('UI').panels.get('board').close();
    window.__farm.gameEvents.emit('openPanel', { type: 'projects' });
    const panel = window.__farm.game.scene.getScene('UI').panels.get('projects');
    panel.id = 'canopy';
    panel.rebuild();
  });
  await pp.waitForTimeout(400);
  const pBox = await pp.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { x: c.x, y: c.y, k: c.width / 200 };
  });
  const pClick = async (lx, ly) => {
    await pp.mouse.click(pBox.x + lx * pBox.k, pBox.y + ly * pBox.k);
    await pp.waitForTimeout(250);
  };
  await pClick(99, 150 + 168 + 11); // +1,000g
  await pClick(99, 150 + 168 + 11); // +1,000g (gives only the 200 still needed)
  let ps = await pState();
  check(
    'project page: the +1,000g button gives gold, never more than needed',
    ps.money === 1800 && ps.stats['fund.canopy'] === 1200,
    `money ${ps.money} given ${ps.stats['fund.canopy']}`,
  );
  await pClick(53, 150 + 194 + 11); // Give goods
  ps = await pState();
  check(
    'giving the last goods finishes the project',
    ps.stats['project.canopy'] === 1 && ps.inventory.slots[6]?.qty === 5,
    JSON.stringify(ps.stats),
  );
  await ui(() => window.__farm.game.scene.getScene('UI').panels.get('projects').close());
  // The shop's Home tab: a Bigger Bag adds a row of slots; decorations are bought like seeds.
  await ui(() => {
    window.__farm.gameEvents.emit('openPanel', { type: 'shop' });
    const shop = window.__farm.game.scene.getScene('UI').panels.get('shop');
    shop.tab = 'home';
    shop.rebuild();
  });
  await pp.waitForTimeout(400);
  await pClick(163, 150 + 44 + 11); // Bigger Bag 1,500g
  await pClick(170, 150 + 70 + 11); // Wood Fence 15g
  ps = await pState();
  check(
    'Home tab: the Bigger Bag adds 8 slots and a fence can be bought',
    ps.inventory.slots.length === 32 &&
      ps.upgrades.bag === 1 &&
      ps.inventory.slots.some((x) => x?.item === 'fence'),
    `slots ${ps.inventory.slots.length} money ${ps.money}`,
  );
  await ui(() => window.__farm.game.scene.getScene('UI').panels.get('shop').close());
  await pp.evaluate(() => window.__farm.gameEvents.emit('sleepRequest', { passedOut: false }));
  await pp.waitForTimeout(3200);
  await pp.keyboard.press('Enter');
  await pp.waitForTimeout(1500);
  ps = await pState();
  check(
    'the Board Canopy posts a 4th request the next morning',
    ps.orders.list.length === 4,
    `orders ${ps.orders.list.length}`,
  );
  check('town projects: no console errors', pErrors.length === 0, pErrors.join(' | '));
  await pCtx.close();

  // 7. Offline: after the first visit the whole game works with the network cut
  const offCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const off = await offCtx.newPage();
  const offErrors = [];
  off.on('console', (m) => m.type() === 'error' && offErrors.push(m.text()));
  off.on('pageerror', (e) => offErrors.push(String(e)));
  await off.goto(URL_);
  await off.waitForTimeout(1500);
  const swReady = await off.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return Boolean(reg.active);
  });
  check('service worker installs and activates', swReady);
  await off.waitForTimeout(800); // precache finishes during install; give claim() a moment
  await offCtx.setOffline(true);
  await off.reload();
  await off.waitForTimeout(1800);
  const offScenes = await off.evaluate(() =>
    window.__farm?.game.scene
      .getScenes(true)
      .map((s) => s.scene.key)
      .join(),
  );
  check(
    'offline reload still boots to the title screen',
    offScenes?.includes('Title'),
    String(offScenes),
  );
  await off.keyboard.press('Enter');
  await off.waitForTimeout(1800);
  const offGame = await off.evaluate(() =>
    window.__farm?.game.scene
      .getScenes(true)
      .map((s) => s.scene.key)
      .join(),
  );
  check(
    'offline: a new game starts and the farm map loads',
    offGame === 'Farm,UI',
    String(offGame),
  );
  check('offline: no console errors', offErrors.length === 0, offErrors.join(' | '));
  await offCtx.close();
} finally {
  await browser.close();
  stop();
}
console.log(failed === 0 ? '\nE2E OK' : `\nE2E FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
