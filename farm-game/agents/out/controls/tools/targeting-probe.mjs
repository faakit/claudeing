// Smart targeting: where it picks a tile the player did not mean, and how readable the target marker is.
// Each case sets up the ground (state only), then presses the real Action button once (CDP touch) and records
// which tile changed versus the tile in front. Also saves zoomed marker crops. Writes targeting.json.
//   CHROMIUM_PATH=... node agents/out/controls/tools/targeting-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { OUT, PROFILES, Thumb, launch, openGame, sleep } from './lib.mjs';

const p = PROFILES.find((x) => x.id === 'i13');
const ACTION = { x: 166, y: 324 };
mkdirSync(`${OUT}targeting/`, { recursive: true });
const browser = await launch();
const out = { cases: [] };
try {
  const { page, cdp, geo, ctx } = await openGame(browser, p);
  const thumb = new Thumb(cdp, geo, p);
  const setup = (code) =>
    page.evaluate((code) => {
      const f = window.__farm;
      const s = f.getState();
      s.farm.tiles = {};
      s.placed.farm = [];
      s.player.x = 10 * 16 + 8;
      s.player.y = 17 * 16 + 11;
      s.player.facing = 'down';
      s.energy = 100;
      s.water = 20;
      new Function('s', 'f', code)(s, f);
      f.gameEvents.emit('farmChanged', undefined);
      f.gameEvents.emit('placedChanged', { map: 'farm' });
      f.gameEvents.emit('inventoryChanged', undefined);
    }, code);
  const snapshot = () =>
    page.evaluate(() => {
      const s = window.__farm.getState();
      const w = window.__farm.game.scene.getScenes(true).find((x) => x.grid);
      const marker = w.actionTile();
      return {
        tiles: JSON.parse(JSON.stringify(s.farm.tiles)),
        placed: (s.placed.farm ?? []).map((o) => `${o.type}@${o.tx},${o.ty}`),
        marker: `${marker.tile.tx},${marker.tile.ty}${marker.works ? '' : ' (no action)'}`,
      };
    });
  const diff = (a, b) => {
    const changed = [];
    for (const k of new Set([...Object.keys(a.tiles), ...Object.keys(b.tiles)]))
      if (JSON.stringify(a.tiles[k]) !== JSON.stringify(b.tiles[k])) changed.push(k);
    for (const o of b.placed) if (!a.placed.includes(o)) changed.push(o);
    return changed;
  };
  const CASES = [
    {
      name: 'hoe, front already tilled: tills a side tile instead',
      code: "s.inventory.selected = 0; s.farm.tiles['10,18'] = { watered: false, crop: null };",
    },
    {
      name: 'seeds, front planted: plants the left neighbour',
      code: "s.inventory.selected = 5; s.farm.tiles['10,18'] = { watered: false, crop: { cropId: 'parsnip', stage: 0, daysInStage: 0, regrow: false } }; s.farm.tiles['9,18'] = { watered: false, crop: null }; s.farm.tiles['11,18'] = { watered: false, crop: null };",
    },
    {
      name: 'can, front watered: waters a side tile',
      code: "s.inventory.selected = 1; for (const x of [9,10,11]) s.farm.tiles[x + ',18'] = { watered: x === 10, crop: null };",
    },
    {
      name: 'seeds in hand, ripe crop at the side: harvests the side, does not plant the front',
      code: "s.inventory.selected = 5; s.farm.tiles['10,18'] = { watered: false, crop: null }; s.farm.tiles['11,18'] = { watered: false, crop: { cropId: 'parsnip', stage: 4, daysInStage: 0, regrow: false } };",
    },
    {
      name: 'sprinkler, front holds a jar: placed on a side tile',
      code: "s.inventory.slots[6] = { item: 'sprinkler', qty: 1 }; s.inventory.selected = 6; s.placed.farm = [{ id: 990, type: 'preserve_jar', tx: 10, ty: 18, data: {} }]; s.nextPlacedId = 991;",
    },
    {
      name: 'hoe on open grass, hold 1 s: works a 3-wide strip, not a line',
      code: 's.inventory.selected = 0;',
      hold: 1000,
    },
  ];
  for (const c of CASES) {
    await setup(c.code);
    await sleep(500);
    const before = await snapshot();
    if (c.hold) await thumb.hold(ACTION.x, ACTION.y, c.hold);
    else await thumb.tap(ACTION.x, ACTION.y, 60);
    await sleep(400);
    const after = await snapshot();
    out.cases.push({
      case: c.name,
      front: '10,18',
      markerBefore: before.marker,
      changed: diff(before, after),
    });
  }

  // Marker readability: crop 5x5 tiles around the player for "will work" and "will not work" with the hoe.
  const crop = async (name) => {
    const box = await page.evaluate(() => {
      const w = window.__farm.game.scene.getScenes(true).find((x) => x.grid);
      const c = w.cameras.main;
      const pl = window.__farm.getState().player;
      return { x: pl.x - c.scrollX + c.x, y: pl.y - c.scrollY + c.y };
    });
    const k = geo.k;
    await page.screenshot({
      path: `${OUT}targeting/${name}.png`,
      clip: {
        x: geo.left + (box.x - 40) * k,
        y: geo.top + (box.y - 40) * k,
        width: 80 * k,
        height: 80 * k,
      },
    });
  };
  await setup('s.inventory.selected = 0;');
  await sleep(900);
  await crop('marker-hoe-will-till');
  await setup(
    "s.inventory.selected = 0; s.player.x = 14 * 16 + 8; s.player.y = 12 * 16 + 11; s.player.facing = 'right';",
  );
  await sleep(900);
  await crop('marker-hoe-wont-work-not-owned');
  await setup(
    "s.inventory.selected = 1; s.water = 0; s.farm.tiles['10,18'] = { watered: false, crop: null };",
  );
  await sleep(900);
  await crop('marker-can-empty-wont-work');
  out.markerNote =
    'Marker = 1 logical px corner brackets (about 0.3 mm on an iPhone 13). "free" (white) is drawn both when the ' +
    'action will work and when it will not but the tile is walkable; only blocked tiles get the faint "solid" style.';
  await ctx.close();
} finally {
  await browser.close();
}
writeFileSync(`${OUT}targeting.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
