// End-to-end smoke test: builds nothing, serves dist/ (scripts/lib/static-server.mjs), and plays the core
// loop in headless Chromium, in a portrait phone viewport. Run `npm run build` first. Needs a Chromium: set CHROMIUM_PATH
// (defaults to the Playwright cache location used in CI/cloud sandboxes).
import { launch, liveTargets, startPreview } from './thumb-lib.mjs';

// Override with E2E_PORT when another checkout runs its checks at the same time.
const PORT = Number(process.env.E2E_PORT ?? 4173);
const URL_SUFFIX = '?debug&tutorial=0'; // a bare new game (no guided start)

// The preview of dist/ on PORT, or the one server a verify run shares (env URL).
const { url: SERVED, stop } = await startPreview(PORT);
const URL_ = `${SERVED}${URL_SUFFIX}`;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
};

/**
 * The dev API's awaits on a page (window.__farm.dev.wait, loaded by ?debug): every step waits on game state, never on
 * a fixed delay. `title()` resolves once the title takes input; `scene(key)` once that map and the UI run with no
 * fade, door or flow in progress; `panel(name)` once that sheet has slid in; `idle()` once nothing moves.
 */
const devWaits = (page) => {
  const w = (name, ...args) =>
    page.evaluate(([n, a]) => window.__farm.dev.wait[n](...a), [name, args]);
  return {
    title: async () => {
      await page.waitForFunction(
        () =>
          window.__farm?.dev?.readyState === 'ready' &&
          window.__farm.game.scene.getScene('Title')?.sys.isActive() &&
          window.__farm.game.scene.getScene('Title').buttons?.length > 0,
        null,
        { timeout: 30000 },
      );
      await w('frames', 10);
    },
    // ...and the new map has run its first update, which unlocks input (a scene started straight from a script is
    // "ready" before that, and a key pressed then is ignored)
    scene: async (key) => {
      await w('sceneReady', key);
      await page.waitForFunction(
        (k) => window.__farm.game.scene.getScene(k)?.inputLocked === false,
        key,
        { timeout: 10000 },
      );
    },
    panel: (name) => w('panelOpen', name),
    idle: (n = 3) => w('idle', n),
    frames: (n = 1) => w('frames', n),
  };
};

const browser = await launch();
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
  const wait = devWaits(page);
  const tap = async (key, ms = 120) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    await wait.idle();
  };

  // 1. Title -> New Game (Enter)
  await page.goto(URL_);
  await wait.title();
  check('title scene shows first', (await sceneKeys()).includes('Title'));
  await page.keyboard.press('Enter');
  await wait.scene('Farm');
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
  await wait.panel('summary');
  await page.keyboard.press('Enter');
  await wait.scene('House');
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
  await page
    .waitForFunction(
      () => {
        const a = window.__farm.audio.debugInfo();
        return a.sfx?.played > 0 && a.music?.sampled > 0;
      },
      null,
      { timeout: 10000 },
    )
    .catch(() => undefined);
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
  await wait.frames(5); // the pagehide save is written
  await page.reload();
  await wait.title();
  await page.keyboard.press('Enter'); // primary button is Continue now
  await wait.scene('House');
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
  await page.waitForTimeout(1000); // a second of real time: the clock must not move
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
  await page
    .waitForFunction(
      (t1) => {
        const t = window.__farm.getState().time;
        return t.minutes > t1.minutes || t.acc > t1.acc;
      },
      t1,
      { timeout: 10000 },
    )
    .catch(() => undefined);
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

  // 6b. The mechanics layer (forage, smart targeting, placeables, villagers, buildings, food, the mine, fishing) moved
  // to scripts/e2e-scenarios.mjs: same checks, on the farm-mechanics scenario with await helpers (no fixed waits).

  // 6c. Town projects: the board links to the fund; giving gold and goods finishes a project and
  // its perk (a 4th request) shows on the next morning's board.
  const pCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const pp = await pCtx.newPage();
  const pw = devWaits(pp);
  const pErrors = [];
  pp.on('console', (m) => m.type() === 'error' && pErrors.push(m.text()));
  pp.on('pageerror', (e) => pErrors.push(String(e)));
  const pState = () => pp.evaluate(() => JSON.parse(JSON.stringify(window.__farm.getState())));
  await pp.goto(URL_);
  await pw.title();
  await pp.keyboard.press('Enter');
  await pw.scene('Farm');
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
  await pw.scene('Town');
  await pp.keyboard.down('KeyE');
  await pp.waitForTimeout(120);
  await pp.keyboard.up('KeyE');
  await pw.panel('board').catch(() => undefined);
  const ui = (fn, arg) => pp.evaluate(fn, arg);
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
  await pw.panel('projects');
  const pBox = await pp.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { x: c.x, y: c.y, k: c.width / 200 };
  });
  const pClick = async (lx, ly) => {
    await pp.mouse.click(pBox.x + lx * pBox.k, pBox.y + ly * pBox.k);
    await pw.frames(4);
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
  await pw.panel('shop');
  // by the price on the live button, not a fixed point: the sheet's rows moved when its header grew
  const pPrice = async (label) => {
    const hit = (await liveTargets(pp)).find((t) => t.text === label);
    if (hit) await pClick(hit.cx, hit.cy);
    return !!hit;
  };
  await pPrice('1,500¤'); // Bigger Bag
  await pPrice('15¤'); // Wood Fence (the first decoration row, below the Bigger Bag and Kitchen)
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
  await pw.panel('jar');
  await pClick(138, 150 + 34 + 11); // All
  ps = await pState();
  check(
    'machine sheet: All loads every empty jar in one tap',
    ps.placed.town.every((o) => o.data.jar) && ps.inventory.slots[7]?.qty === 2,
    JSON.stringify(ps.placed.town),
  );
  await ui(() => (window.__farm.getState().placed.town = []));
  await pp.evaluate(() => window.__farm.gameEvents.emit('sleepRequest', { passedOut: false }));
  await pw.panel('summary');
  await pp.keyboard.press('Enter');
  await pw.scene('House');
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
  await pw.scene('Farm');
  await pp.keyboard.down('KeyE');
  await pp.waitForTimeout(120);
  await pp.keyboard.up('KeyE');
  await pw.panel('mail').catch(() => undefined);
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
  await pw.panel('board').catch(() => undefined);
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
    texts.some((t) =>
      /^(This season: you \d+, Clay \d+\.|You \d+, Clay \d+\. His crate tonight\.)$/.test(t),
    ),
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
  await pw.panel('bin');
  const tappedShip = await tapLabel('Ship all produce');
  await pw.frames(4);
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
  // Round 4: the Goal tab shows the settling-in pay on day 3, and the goal after an open legend goal.
  const savedTime = await ui(() => {
    const f = window.__farm;
    const s = f.getState();
    const was = { ...s.time, goalIndex: s.goalIndex, jobs: s.jobs };
    Object.assign(s.time, { year: 1, season: 'spring', day: 3 });
    s.jobs = {
      day: 3,
      list: [{ id: 'fish', giver: 'finn', stat: 'caught', base: 0, n: 2, reward: 72, done: false }],
    };
    s.goalIndex = 54; // "Catch a legendary fish"
    f.gameEvents.emit('openPanel', { type: 'menu' });
    f.game.scene.getScene('UI').panels.get('menu').openTab('goals');
    return was;
  });
  await pw.panel('menu');
  texts = await uiTexts();
  check(
    'Goal tab: day-3 jobs say double pay; the goal after a legend is current, the legend is also open',
    texts.includes("TODAY'S JOBS: DOUBLE PAY") &&
      texts.includes('Beat Clay on the board') &&
      texts.includes('ALSO OPEN') &&
      texts.includes('Catch a legendary fish'),
    texts.join(' | '),
  );
  await ui((was) => {
    const f = window.__farm;
    const s = f.getState();
    f.game.scene.getScene('UI').panels.get('menu').close();
    s.goalIndex = was.goalIndex;
    s.jobs = was.jobs;
    Object.assign(s.time, { year: was.year, season: was.season, day: was.day });
  }, savedTime);

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
  await pw.scene('Farm');
  await pp.keyboard.press('Digit7');
  await pp.keyboard.down('Space');
  await pp.waitForTimeout(120);
  await pp.keyboard.up('Space');
  await pw.idle();
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
  await pw.panel('festival');
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
  await pw.panel('projects');
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
  await pw.scene('House');
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
  await pw.panel('festival');
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
  await pw.panel('cart');
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

  // 6b. Ambient life anchored in the world moved to scripts/e2e-scenarios.mjs (spring-meadow scenario, stepped frames).

  // 7. Offline: after the first visit the whole game works with the network cut
  const offCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const off = await offCtx.newPage();
  const ow = devWaits(off);
  const offErrors = [];
  off.on('console', (m) => m.type() === 'error' && offErrors.push(m.text()));
  off.on('pageerror', (e) => offErrors.push(String(e)));
  await off.goto(URL_);
  await ow.title();
  const swReady = await off.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return Boolean(reg.active);
  });
  check('service worker installs and activates', swReady);
  // precache finishes during install; then claim() hands the page to the worker
  await off
    .waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 })
    .catch(() => undefined);
  await offCtx.setOffline(true);
  await off.reload();
  await ow.title().catch(() => undefined);
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
  await ow.scene('Farm').catch(() => undefined);
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
