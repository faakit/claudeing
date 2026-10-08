// Art review screenshots: a fixed set of staged scenes, each at 1x (200x400 canvas = 1 screen px per art px)
// and at phone scale (390x844 CSS px, DPR 2). Usage (dev server running):
//   CHROMIUM_PATH=... URL=http://localhost:5175/ node art-src/tools/shots.mjs <outDir> <prefix>
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = process.argv[2] ?? 'agents/out/art-shots';
const PREFIX = process.argv[3] ?? 'shot';
const URL_ = (process.env.URL ?? 'http://localhost:5175/') + '?debug';
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
mkdirSync(OUT, { recursive: true });

const SIZES = {
  x1: { viewport: { width: 200, height: 400 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
};

/** Staged scenes: each gets a fresh new game, then a state set-up run in the page. */
const SCENES = {
  title: null,
  farm: () => {
    const f = window.__farm;
    const s = f.getState();
    s.time.minutes = 600;
    s.player.x = 12 * 16 + 8;
    s.player.y = 15 * 16 + 11;
    s.player.facing = 'down';
    const ids = [
      'parsnip',
      'potato',
      'cauliflower',
      'tomato',
      'melon',
      'corn',
      'pumpkin',
      'kale',
      'yam',
    ];
    ids.forEach((cropId, i) => {
      for (let st = 0; st <= 4; st++) {
        const x = 7 + st;
        const y = 16 + i;
        s.farm.tiles[`${x},${y}`] = {
          watered: st % 2 === 1,
          crop: {
            cropId,
            stage: Math.min(st, cropId === 'yam' ? 3 : 4),
            daysInStage: 0,
            regrow: false,
          },
        };
      }
    });
    s.farm.tiles['13,16'] = { watered: false, crop: null };
    s.farm.tiles['13,17'] = { watered: true, crop: null };
    f.gameEvents.emit('farmChanged', undefined);
  },
  objects: () => {
    const f = window.__farm;
    const s = f.getState();
    s.time.minutes = 600;
    s.player.x = 13 * 16 + 8;
    s.player.y = 11 * 16 + 11;
    s.player.facing = 'right';
    const tree = (age, fruit) => ({ tree: { age, timer: 0, fruit } });
    s.placed.farm = [
      { id: 1, type: 'coop', tx: 9, ty: 9, data: { house: { n: 2, fed: true, ready: 1, joy: 3 } } },
      {
        id: 2,
        type: 'barn',
        tx: 12,
        ty: 9,
        data: { house: { n: 2, fed: false, ready: 0, joy: 0 } },
      },
      {
        id: 3,
        type: 'shed',
        tx: 15,
        ty: 9,
        data: { house: { n: 2, fed: true, ready: 0, joy: 0 } },
      },
      { id: 4, type: 'sprinkler', tx: 9, ty: 13, data: {} },
      { id: 5, type: 'quality_sprinkler', tx: 10, ty: 13, data: {} },
      { id: 6, type: 'preserve_jar', tx: 11, ty: 13, data: {} },
      { id: 7, type: 'keg', tx: 12, ty: 13, data: {} },
      { id: 8, type: 'bee_house', tx: 9, ty: 15, data: {} },
      { id: 9, type: 'loom', tx: 10, ty: 15, data: {} },
      { id: 10, type: 'furnace', tx: 11, ty: 15, data: {} },
      { id: 11, type: 'cherry_sapling', tx: 14, ty: 15, data: tree(2, 0) },
      { id: 12, type: 'peach_sapling', tx: 15, ty: 15, data: tree(12, 2) },
      { id: 13, type: 'apple_sapling', tx: 16, ty: 15, data: tree(12, 3) },
      { id: 14, type: 'plum_sapling', tx: 17, ty: 15, data: tree(12, 0) },
    ];
    s.nextPlacedId = 15;
    f.gameEvents.emit('placedChanged', { map: 'farm' });
    f.getState().forage.farm = { '13,13': 'wild_leek', '14,13': 'daffodil', '15,13': 'mushroom' };
    f.gameEvents.emit('forageChanged', { map: 'farm' });
  },
  town: () => {
    const f = window.__farm;
    const s = f.getState();
    s.time.minutes = 730;
    s.player.map = 'town';
    s.player.x = 11 * 16 + 8;
    s.player.y = 13 * 16 + 11;
    s.player.facing = 'left';
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key === 'Farm')
      .scene.start('Town');
  },
  mine: () => {
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
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key === 'Farm')
      .scene.start('Mine');
  },
  inventory: () => {
    const f = window.__farm;
    const s = f.getState();
    const pick = [
      'parsnip_seed',
      'tomato',
      'cauliflower',
      'pumpkin',
      'egg',
      'milk',
      'honey',
      'wool',
      'jam',
      'wine',
      'cloth',
      'copper_bar',
      'ruby',
      'carp',
      'salmon',
      'daffodil',
      'mushroom',
      'apple',
      'cherry_sapling',
      'sprinkler',
    ];
    s.inventory.slots = s.inventory.slots.map((v, i) =>
      i < 4 ? v : pick[i - 4] ? { item: pick[i - 4], qty: 1 + (i % 7) } : v,
    );
    f.gameEvents.emit('inventoryChanged', undefined);
    f.gameEvents.emit('openPanel', { type: 'menu' });
  },
};

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
for (const [name, setup] of Object.entries(SCENES)) {
  if (ONLY && !ONLY.includes(name)) continue;
  for (const [size, opts] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ ...opts, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
    await page.goto(URL_);
    await page.waitForTimeout(1500);
    if (setup) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      await page.evaluate(setup);
      await page.waitForTimeout(1300);
    }
    await page.screenshot({ path: `${OUT}/${PREFIX}_${name}_${size}.png` });
    await ctx.close();
  }
}
await browser.close();
if (errors.length) console.log('ERRORS\n' + [...new Set(errors)].join('\n'));
console.log('done');
