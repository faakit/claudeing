// End-to-end smoke test: builds nothing, serves dist/ with `vite preview`, and plays the core
// loop in headless Chromium, in a portrait phone viewport. Run `npm run build` first. Needs a Chromium: set CHROMIUM_PATH
// (defaults to the Playwright cache location used in CI/cloud sandboxes).
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

// Override with E2E_PORT when another checkout runs its checks at the same time.
const PORT = Number(process.env.E2E_PORT ?? 4173);
const URL_ = `http://localhost:${PORT}/?debug`;
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

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
  // Count AudioContexts the page creates: Phaser must not make its own next to ours.
  await ctx.addInitScript(() => {
    const Orig = window.AudioContext;
    if (!Orig) return;
    window.__audioContexts = 0;
    window.AudioContext = class extends Orig {
      constructor(...args) {
        super(...args);
        window.__audioContexts++;
      }
    };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const audioFiles = { ok: 0, bad: [] };
  page.on('requestfinished', async (req) => {
    if (!req.url().includes('/assets/audio/')) return;
    const res = await req.response();
    if (res?.ok()) audioFiles.ok++;
    else audioFiles.bad.push(`${res?.status()} ${req.url()}`);
  });
  page.on('requestfailed', (req) => {
    if (req.url().includes('/assets/audio/')) audioFiles.bad.push(`failed ${req.url()}`);
  });

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
    'the next morning villagers post three jobs, the first a fishing job',
    s.jobs.list.length === 3 && s.jobs.list[0].id === 'fish' && s.jobs.day === 2,
    JSON.stringify(s.jobs),
  );
  check(
    'player wakes up in the house with full energy',
    s.player.map === 'house' && s.energy === 100,
    `${s.player.map} ${s.energy}`,
  );

  // 3b. Real audio: files are fetched and decoded, sounds and music play from samples, one context.
  await page
    .waitForFunction(() => (window.__farm.audio.debugInfo().decoded ?? 0) > 40, null, {
      timeout: 15000,
    })
    .catch(() => undefined);
  await page.keyboard.press('Digit1');
  await tap('Space'); // hoe swing: a recorded take, not the synth
  await page.waitForTimeout(2500);
  const au = await page.evaluate(() => ({
    ...window.__farm.audio.debugInfo(),
    contexts: window.__audioContexts,
  }));
  check('audio: exactly one AudioContext (Phaser has none)', au.contexts === 1, JSON.stringify(au));
  check(
    'audio: sound and music files are fetched without errors',
    audioFiles.ok >= 40 && audioFiles.bad.length === 0,
    `${audioFiles.ok} ok, bad: ${audioFiles.bad.slice(0, 3).join(' | ')}`,
  );
  check(
    'audio: files decode and the context runs',
    au.decoded > 40 && au.state === 'running',
    JSON.stringify(au),
  );
  check(
    'audio: sound effects play recorded takes and music plays sampled notes',
    au.sfx?.played > 0 && au.music?.sampled > 0 && !au.synthMusic,
    JSON.stringify(au),
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
  // Moving a building: chore taps never lift a coop with hens; the second tap opens the Move sheet and
  // its real "Move it" button picks the coop up with its hen parked for the next coop (critique 5, F3).
  await mTap('KeyE'); // a pat
  await mTap('KeyE'); // "All fed. ... Tap again to move it."
  await mTap('KeyE'); // the Move sheet
  m = await mState();
  const moveOpen = await mp.evaluate(() => window.__farm.game.scene.getScene('UI').move.isOpen);
  check(
    'a chore tap never lifts a coop with a hen: the Move sheet asks first',
    moveOpen && m.placed.farm.some((o) => o.type === 'coop'),
    JSON.stringify(m.placed.farm),
  );
  const moveBox = await mp.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { x: c.x, y: c.y, k: c.width / 200 };
  });
  await mp.mouse.click(moveBox.x + 100 * moveBox.k, moveBox.y + (400 - 130 + 74 + 12) * moveBox.k);
  await mp.waitForTimeout(400);
  m = await mState();
  check(
    'a coop with a hen can be picked up to move it, keeping the hen',
    !(m.placed.farm ?? []).some((o) => o.type === 'coop') &&
      m.inventory.slots.some((x) => x?.item === 'coop') &&
      m.stored.coop?.[0]?.house?.n === 1,
    JSON.stringify(m.stored),
  );
  // A feed silo: one Interact pours the bag's feed into it.
  await mp.evaluate(() => {
    const s = window.__farm.getState();
    s.inventory.slots[7] = { item: 'hay', qty: 20 };
    (s.placed.farm ??= []).push({ id: 11, type: 'silo', tx: 11, ty: 11, data: {} });
    s.nextPlacedId = 12;
    window.__farm.gameEvents.emit('placedChanged', { map: 'farm' });
  });
  await mPlace(11, 10, 'down');
  await mTap('KeyE');
  m = await mState();
  check(
    'Interact at a feed silo stores the feed from the bag',
    m.placed.farm.find((o) => o.type === 'silo')?.data.stock?.hay === 20 &&
      !m.inventory.slots.some((x) => x?.item === 'hay'),
    JSON.stringify(m.placed.farm),
  );
  // A garden bench: Interact sits down for a little energy, once a day.
  await mp.evaluate(() => {
    const s = window.__farm.getState();
    s.energy = 40;
    s.placed.farm.push({ id: 12, type: 'garden_bench', tx: 12, ty: 10, data: {} });
    s.nextPlacedId = 13;
    window.__farm.gameEvents.emit('placedChanged', { map: 'farm' });
  });
  await mPlace(11, 10, 'right');
  await mTap('KeyE');
  m = await mState();
  check('Interact at a garden bench gives a little energy', m.energy === 55, `energy ${m.energy}`);
  // A cooked dish in hand: Action eats it.
  await mp.evaluate(() => {
    const s = window.__farm.getState();
    s.energy = 30;
    s.inventory.slots[6] = { item: 'fish_stew', qty: 1 };
  });
  await mp.keyboard.press('Digit7');
  await mTap('Space');
  m = await mState();
  check(
    'Action with a dish in hand eats it for energy',
    m.energy === 80 && !m.inventory.slots.some((x) => x?.item === 'fish_stew'),
    `energy ${m.energy}`,
  );
  // From the 4th dish of a day a dish gives half (owner default, round 3).
  await mp.evaluate(() => {
    const s = window.__farm.getState();
    s.energy = 30;
    s.stats['ate.today'] = 3; // the stew above set today's day; count three eaten
    s.inventory.slots[6] = { item: 'fish_stew', qty: 1 };
  });
  await mp.keyboard.press('Digit7');
  await mTap('Space');
  m = await mState();
  check('the 4th dish of a day gives half its energy', m.energy === 55, `energy ${m.energy}`);
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
    window.__toasts = [];
    window.__farm.gameEvents.on('toast', (t) => window.__toasts.push(t.text));
  });
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
  await pClick(170, 150 + 96 + 11); // Wood Fence 15g (below the Bigger Bag and Kitchen rows)
  ps = await pState();
  check(
    'Home tab: the Bigger Bag adds 8 slots and a fence can be bought',
    ps.inventory.slots.length === 32 &&
      ps.upgrades.bag === 1 &&
      ps.inventory.slots.some((x) => x?.item === 'fence'),
    `slots ${ps.inventory.slots.length} money ${ps.money}`,
  );
  await ui(() => window.__farm.game.scene.getScene('UI').panels.get('shop').close());
  check(
    'the welcome tip does not replay after changing maps',
    !(await ui(() => window.__toasts.some((t) => t.startsWith('Welcome')))),
  );
  // "All" in a machine sheet fills every empty machine of that kind on the map.
  await ui(() => {
    const s = window.__farm.getState();
    s.placed.town = [1, 2, 3].map((i) => ({
      id: 300 + i,
      type: 'preserve_jar',
      tx: 20,
      ty: 4 + i,
      data: {},
    }));
    s.nextPlacedId = 400;
    s.inventory.slots[7] = { item: 'tomato', qty: 5 };
    window.__farm.game.scene.getScene('UI').jar.openFor(301);
  });
  await pp.waitForTimeout(400);
  await pClick(138, 150 + 34 + 11); // All
  ps = await pState();
  check(
    'machine sheet: All loads every empty jar in one tap',
    ps.placed.town.every((o) => o.data.jar) && ps.inventory.slots[7]?.qty === 2,
    JSON.stringify(ps.placed.town),
  );
  await ui(() => (window.__farm.getState().placed.town = []));
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
  check(
    'a special order is on the board the next morning',
    !!ps.special && ps.special.qty > 0 && ps.special.reward > 0,
    JSON.stringify(ps.special),
  );
  // The post: a welcome letter arrived overnight; Interact at the mailbox by the house opens it.
  check(
    'a welcome letter is in the mailbox on day 2',
    ps.mail.list.some((l) => l.title === 'Welcome to the valley' && !l.read),
    JSON.stringify(ps.mail),
  );
  await pp.evaluate(() => {
    const f = window.__farm;
    const s = f.getState();
    s.player.map = 'farm';
    s.player.x = 14 * 16 + 8;
    s.player.y = 9 * 16 + 11;
    s.player.facing = 'left';
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key === 'House')
      .scene.start('Farm');
  });
  await pp.waitForTimeout(1500);
  await pp.keyboard.down('KeyE');
  await pp.waitForTimeout(120);
  await pp.keyboard.up('KeyE');
  await pp.waitForTimeout(500);
  check(
    'Interact at the mailbox opens the mail sheet',
    await ui(() => window.__farm.game.scene.getScene('UI').panels.get('mail').isOpen),
  );
  // From day 8 the rival farmer fills one open request every afternoon (one that was up since yesterday).
  await ui(() => {
    const f = window.__farm;
    const u = f.game.scene.getScene('UI');
    u.panels.get('mail').close();
    const s = f.getState();
    s.time.day = 9;
    s.time.minutes = 600;
    f.gameEvents.emit('openPanel', { type: 'board' }); // the morning look posts the board
    u.panels.get('board').close();
    for (const o of s.orders.list) {
      o.from -= 1; // as if posted yesterday...
      o.until = o.from + 1; // ...and today is its last day
    }
    s.time.minutes = 900;
    f.gameEvents.emit('openPanel', { type: 'board' });
  });
  await pp.waitForTimeout(500);
  ps = await pState();
  check(
    'after 2 PM the rival has taken one of the requests',
    ps.orders.list.filter((o) => o.rival).length === 1 && ps.orders.day === 9 + 0,
    JSON.stringify(ps.orders),
  );
  // Critique 9, F1: the season's score has its own line on the board every day once Clay is about.
  const uiTexts = () =>
    ui(() => {
      const out = [];
      const vis = (o) => {
        for (let q = o; q; q = q.parentContainer) if (q.visible === false) return false;
        return true;
      };
      const walk = (o) => {
        if (o.type === 'BitmapText' && o.text && vis(o)) out.push(o.text);
        (o.list ?? []).forEach(walk);
      };
      window.__farm.game.scene.getScene('UI').children.list.forEach(walk);
      return out;
    });
  const tapLabel = async (label) => {
    const at = await pp.evaluate((label) => {
      const out = [];
      const vis = (o) => {
        for (let q = o; q; q = q.parentContainer) if (q.visible === false) return false;
        return true;
      };
      const walk = (o) => {
        if (o.list && o.list.some((c) => c.type === 'Zone') && vis(o)) {
          const words = [];
          const grab = (c) => {
            if (c.type === 'BitmapText' && c.text) words.push(c.text);
            if (c !== o && c.list?.some((d) => d.type === 'Zone')) return; // a nested button
            (c.list ?? []).forEach(grab);
          };
          o.list.forEach(grab);
          if (words.includes(label)) {
            const b = o.list.find((c) => c.type === 'Zone').getBounds();
            out.push({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
          }
        }
        (o.list ?? []).forEach(walk);
      };
      window.__farm.game.scene.getScene('UI').children.list.forEach(walk);
      return out[0] ?? null;
    }, label);
    if (at) await pClick(at.x, at.y);
    return !!at;
  };
  let texts = await uiTexts();
  check(
    'the board shows the season score on its own line once Clay is about',
    texts.some((t) => /^This season: you \d+, Clay \d+\.$/.test(t)),
    texts.join(' | '),
  );
  // Critique 9, F2: "Ship all produce" keeps what an open request wants, and says so.
  await ui(() => {
    const f = window.__farm;
    const s = f.getState();
    f.game.scene.getScene('UI').panels.get('board').close();
    window.__toasts = [];
    s.orders.list.push({
      id: 99,
      item: 'potato|0|',
      qty: 3,
      reward: 300,
      xp: 5,
      done: false,
      from: s.orders.day,
      until: s.orders.day + 2,
    });
    s.inventory.slots[7] = { item: 'potato', qty: 5 };
    s.special = null; // only the request wants potatoes here
    f.gameEvents.emit('openPanel', { type: 'bin' });
  });
  await pp.waitForTimeout(400);
  const tappedShip = await tapLabel('Ship all produce');
  await pp.waitForTimeout(200);
  // Critique 10, F1: a toast raised while a sheet is open is drawn above the sheet (depth over 210).
  const keptDepth = await ui(() => {
    const has = (o) =>
      (o.type === 'BitmapText' && o.text === 'Kept 3 Potato for the board.') ||
      (o.list ?? []).some(has);
    const hit = window.__farm.game.scene
      .getScene('UI')
      .children.list.find((o) => o.type !== 'Rectangle' && has(o));
    return hit?.depth ?? -1;
  });
  check('a toast over an open sheet is drawn above it', keptDepth > 210, `depth ${keptDepth}`);
  ps = await pState();
  check(
    '"Ship all produce" keeps the potatoes a request wants and ships the rest',
    tappedShip &&
      ps.inventory.slots.reduce((n, x) => (x?.item === 'potato' ? n + x.qty : n), 0) === 3 &&
      ps.shipping['potato|0|'] === 2 &&
      (await ui(() => window.__toasts.includes('Kept 3 Potato for the board.'))),
    `tapped ${tappedShip} shipping ${JSON.stringify(ps.shipping)} bag ${JSON.stringify(ps.inventory.slots[7])} toasts ${await ui(() => window.__toasts.join(' / '))} texts ${(await uiTexts()).join(' | ')}`,
  );
  await ui(() => {
    const f = window.__farm;
    const s = f.getState();
    f.game.scene.getScene('UI').panels.get('bin').close();
    s.orders.list = s.orders.list.filter((o) => o.id !== 99);
  });

  await ui(() => {
    const f = window.__farm;
    f.game.scene.getScene('UI').panels.get('board').close();
    const s = f.getState();
    s.stats['project.greenhouse'] = 1;
    s.time.season = 'winter';
    s.time.minutes = 600;
    s.farm.tiles['17,27'] = { watered: false, crop: null };
    s.inventory.slots[6] = { item: 'melon_seed', qty: 3 };
    s.player.map = 'farm';
    s.player.x = 17 * 16 + 8;
    s.player.y = 26 * 16 + 11;
    s.player.facing = 'down';
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key !== 'UI')
      .scene.restart();
  });
  await pp.waitForTimeout(1500);
  await pp.keyboard.press('Digit7');
  await pp.keyboard.down('Space');
  await pp.waitForTimeout(120);
  await pp.keyboard.up('Space');
  await pp.waitForTimeout(400);
  ps = await pState();
  check(
    'in the greenhouse a summer seed grows in winter',
    ps.farm.tiles['17,27']?.crop?.cropId === 'melon',
    JSON.stringify(ps.farm.tiles['17,27']),
  );
  // Harvest Fair: a basket entry through the real Add and Present buttons.
  await ui(() => {
    const f = window.__farm;
    const s = f.getState();
    s.time.season = 'fall';
    s.time.day = 16;
    s.inventory.slots[8] = { item: 'pumpkin', qty: 2 };
    f.gameEvents.emit('openPanel', { type: 'festival' });
  });
  await pp.waitForTimeout(500);
  const moneyBefore = (await pState()).money;
  await pClick(172, 150 + 58 + 11); // Add (first row)
  await pClick(100, 150 + 194 + 12); // Present the basket
  ps = await pState();
  check(
    'Harvest Fair: a basket is presented with Add and Present',
    ps.stats['fest.harvest_fair.y1'] === 1 && ps.money > moneyBefore,
    `money ${moneyBefore} -> ${ps.money}`,
  );
  // The Founder's Statue: once every project is done it stays open, a level at a time.
  await ui(() => {
    const f = window.__farm;
    const ui = f.game.scene.getScene('UI');
    ui.panels.get('festival').close();
    const s = f.getState();
    for (const id of [
      'canopy',
      'seedexchange',
      'fishladder',
      'library',
      'bathhouse',
      'fairhall',
      'market',
    ])
      s.stats[`project.${id}`] = 1;
    s.money = 50000;
    f.gameEvents.emit('openPanel', { type: 'projects' });
  });
  await pp.waitForTimeout(400);
  await pClick(172, 150 + 34 + 11); // Open on the first row: the statue leads the list (critique 6, F1)
  const opened = await ui(() => window.__farm.game.scene.getScene('UI').panels.get('projects').id);
  check(
    "the Founder's Statue opens from the projects list with a tap",
    opened === 'statue',
    opened,
  );
  await pClick(161, 150 + 168 + 11); // +10,000g
  ps = await pState();
  check(
    "the Founder's Statue takes gold once every project is done",
    ps.stats['fund.statue'] === 10000 && ps.money === 40000,
    `fund ${ps.stats['fund.statue']} money ${ps.money}`,
  );
  await ui(() => window.__farm.game.scene.getScene('UI').panels.get('projects').close());
  // Critique 9, F1: a season won on the board puts a trophy in the house.
  await ui(() => {
    const f = window.__farm;
    const s = f.getState();
    s.stats['boardWins'] = 1;
    s.player.map = 'house';
    s.player.x = 4 * 16 + 8;
    s.player.y = 4 * 16 + 11;
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key !== 'UI')
      .scene.start('House');
  });
  await pp.waitForTimeout(1500);
  check(
    'a season won on the board shows a trophy in the house',
    await ui(() =>
      window.__farm.game.scene
        .getScene('House')
        .children.list.some((o) => o.texture?.key === 'obj_trophy_board' && o.visible),
    ),
  );
  // Fishing Derby: handing in early asks first, so one stray tap cannot end the derby (critique 5, F4).
  await ui(() => {
    const f = window.__farm;
    const s = f.getState();
    s.time.season = 'summer';
    s.time.day = 22;
    s.time.minutes = 600;
    s.stats['fest.fishing_derby.y1.catch0'] = 80;
    s.stats['fest.fishing_derby.y1.fish0'] = 13; // a catfish
    f.gameEvents.emit('openPanel', { type: 'festival' });
  });
  await pp.waitForTimeout(500);
  await pClick(100, 150 + 194 + 12); // Hand in my catches
  ps = await pState();
  const asked = !ps.stats['fest.fishing_derby.y1'];
  await pClick(100, 150 + 194 + 12); // Sure? Tap to hand in
  ps = await pState();
  check(
    'Fishing Derby: an early hand-in asks first, the second tap hands in',
    asked && ps.stats['fest.fishing_derby.y1'] === 1,
    JSON.stringify(ps.stats),
  );
  // The traveling cart: on its days a few premium goods, bought with a real tap on Buy.
  await ui(() => {
    const f = window.__farm;
    const u = f.game.scene.getScene('UI');
    for (const m of u.panels.values()) if (m.isOpen) m.close();
    const s = f.getState();
    s.time.season = 'spring';
    s.time.day = 5;
    s.money = 5000;
    f.gameEvents.emit('openPanel', { type: 'cart' });
  });
  await pp.waitForTimeout(400);
  const moneyCart = (await pState()).money;
  await pClick(172, 400 - 196 + 34 + 11); // Buy on the first row
  ps = await pState();
  check(
    'the traveling cart sells with a tap on its days',
    ps.money < moneyCart && ps.stats.cartBought === 1,
    `money ${moneyCart} -> ${ps.money}`,
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
