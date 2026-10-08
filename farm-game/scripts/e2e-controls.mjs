// Controls e2e: real CDP touches on phone profiles (iPhone 13 and SE, right and left hand) against the production
// build. Checks the one-thumb rules that unit tests cannot see end to end: dock hit ownership, release-acting
// Menu, tap vs stick, hold under a rolling pad, swipes, the target marker, silent taps, haptics and latency.
// Run `npm run build` first. Headless emulation only: it proves the rules, not how a real hand feels.
import {
  PROFILES,
  Thumb,
  dock,
  launch,
  openGame,
  sleep,
  startPreview,
  tileScreen,
} from './thumb-lib.mjs';

const PORT = Number(process.env.E2E_CONTROLS_PORT ?? Number(process.env.E2E_PORT ?? 4173) + 10);
const which = (process.env.PROFILES ?? 'i13,se').split(',');
const hands = (process.env.HANDS ?? 'right,left').split(',');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
};

const { url, stop } = await startPreview(PORT);
const browser = await launch();

/** Seeded jitter, so a failure reproduces. */
function rng(seed) {
  let s = seed >>> 0;
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  return { u, g: () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()) };
}

const place = (page, tx, ty, facing = 'down', extra = '') =>
  page.evaluate(
    ({ tx, ty, facing, extra }) => {
      const f = window.__farm;
      const s = f.getState();
      f.game.scene
        .getScene('UI')
        .allModals()
        .forEach((m) => m.isOpen && m.close());
      s.player.x = tx * 16 + 8;
      s.player.y = ty * 16 + 11;
      s.player.facing = facing;
      s.energy = 100;
      s.water = 20;
      s.time.minutes = 600;
      s.farm.tiles = {};
      s.inventory.selected = 0;
      s.inventory.slots[5] = { item: 'parsnip_seed', qty: 10 };
      for (let i = 6; i < 8; i++) s.inventory.slots[i] = null;
      if (extra) new Function('s', 'f', extra)(s, f);
      f.gameEvents.emit('farmChanged', undefined);
      f.gameEvents.emit('inventoryChanged', undefined);
    },
    { tx, ty, facing, extra },
  );
const player = (page) =>
  page.evaluate(() => {
    const p = window.__farm.getState().player;
    return {
      x: p.x,
      y: p.y,
      facing: p.facing,
      tx: Math.floor(p.x / 16),
      ty: Math.floor((p.y - 3) / 16),
    };
  });
const soil = (page) => page.evaluate(() => Object.keys(window.__farm.getState().farm.tiles).length);
const selected = (page) => page.evaluate(() => window.__farm.getState().inventory.selected);
const openSheets = (page) =>
  page.evaluate(() => {
    const ui = window.__farm.game.scene.getScene('UI');
    return ui.allModals().filter((m) => m.isOpen).length;
  });
const closeSheets = (page) =>
  page.evaluate(() =>
    window.__farm.game.scene
      .getScene('UI')
      .allModals()
      .forEach((m) => m.isOpen && m.close()),
  );

try {
  for (const p of PROFILES.filter((x) => which.includes(x.id)))
    for (const hand of hands) {
      const tag = `${p.id} ${hand}`;
      const { page, cdp, geo, ctx, errors } = await openGame(browser, url, p, {
        leftHanded: hand === 'left',
      });
      const L = await dock(page);
      const t = new Thumb(cdp, geo, p, hand);
      const r = rng(hand === 'left' ? 17 : 5);
      const mm = 1 / (geo.k * ((25.4 / p.ppi) * p.dpr)); // logical px per mm

      // --- Action owns its disc: a touch on Action's edge toward Interact presses Action, with Interact showing.
      await place(page, 12, 10, 'up'); // the bin is in reach: Interact shows
      await sleep(400);
      const interactOn = await page.evaluate(
        () => window.__farm.game.scene.getScene('UI').interactButton.isEnabled,
      );
      const toward = Math.atan2(L.interact.y - L.action.y, L.interact.x - L.action.x);
      const edge = {
        x: L.action.x + Math.cos(toward) * (L.action.r - 1),
        y: L.action.y + Math.sin(toward) * (L.action.r - 1),
      };
      await t.tap(edge.x, edge.y, 60);
      await sleep(400);
      check(
        `${tag}: Action's edge facing Interact presses Action, not Interact`,
        interactOn && (await openSheets(page)) === 0,
        `interact showing ${interactOn}, sheets ${await openSheets(page)}`,
      );
      await closeSheets(page);
      // A clean tap on Interact opens the bin on release.
      await t.down(L.interact.x, L.interact.y);
      await sleep(140);
      const beforeUp = await openSheets(page);
      await t.up();
      await sleep(250);
      check(
        `${tag}: Interact acts on release (not on touch-down)`,
        beforeUp === 0 && (await openSheets(page)) === 1,
        `down ${beforeUp}, after ${await openSheets(page)}`,
      );
      await closeSheets(page);

      // --- Menu: a drag that starts on it never opens it (jittered, 9-20 px); a clean tap always does.
      await place(page, 10, 17, 'down');
      await sleep(300);
      let opens = 0;
      for (let i = 0; i < 20; i++) {
        const sx = L.menu.x + r.g() * 3;
        const sy = L.menu.y + r.g() * 3;
        const len = 9.5 + r.u() * 10.5;
        const ang = r.u() * Math.PI * 2;
        await t.drag(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, 120, 5);
        await sleep(120);
        if ((await openSheets(page)) > 0) opens++;
        await closeSheets(page);
      }
      check(
        `${tag}: 20 jittered drags starting on Menu open nothing`,
        opens === 0,
        `${opens} opened`,
      );
      let tapOpens = 0;
      for (const ms of [120, 150, 180]) {
        await t.tap(L.menu.x + r.g() * 2, L.menu.y + r.g() * 2, ms);
        await sleep(300);
        if ((await openSheets(page)) > 0) tapOpens++;
        await closeSheets(page);
        await sleep(150);
      }
      check(
        `${tag}: clean taps on Menu (120-180 ms) open it every time`,
        tapOpens === 3,
        `${tapOpens}/3`,
      );

      // --- A tap never walks, a drag never acts.
      await place(page, 10, 17, 'down');
      await sleep(1200); // let the camera settle before mapping tiles to the screen
      const below = await tileScreen(page, 10, 18);
      const a = await player(page);
      await t.down(below.x, below.y);
      await t.move(below.x + 4, below.y + 2);
      await t.move(below.x + 7, below.y);
      await sleep(90);
      await t.up();
      await sleep(350);
      const b = await player(page);
      check(
        `${tag}: a tap that rolls 7 px acts once and moves 0 px`,
        (await soil(page)) === 1 && Math.abs(b.x - a.x) + Math.abs(b.y - a.y) < 0.01,
        `soil ${await soil(page)}, moved ${(b.x - a.x).toFixed(1)},${(b.y - a.y).toFixed(1)}`,
      );
      await place(page, 10, 17, 'down');
      await sleep(400);
      const c0 = await player(page);
      await t.down(below.x, below.y);
      await t.move(below.x + 11, below.y);
      await sleep(90);
      await t.up();
      await sleep(350);
      const c1 = await player(page);
      check(
        `${tag}: a touch that strays 11 px engages the stick and never acts`,
        (await soil(page)) === 0 && (c1.x !== c0.x || c1.facing !== c0.facing),
        `soil ${await soil(page)}, moved ${(c1.x - c0.x).toFixed(1)} facing ${c1.facing}`,
      );

      // --- No silent taps: a tap on your own tile (nothing to do there) answers with a ring.
      await place(page, 10, 17, 'down');
      await sleep(400);
      // a solid tile with nothing on it (the house wall at 11,7)
      await place(page, 11, 9, 'up');
      await sleep(1300);
      const own = await tileScreen(page, 11, 7);
      await t.tap(own.x, own.y, 70);
      await sleep(60);
      const ring = await page.evaluate(() => {
        const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
        return w.highlight.ring.visible;
      });
      check(`${tag}: a tap with nothing to do shows a ring (never silent)`, ring);

      // --- The marker lies on the ground: under characters, animals and walk-behind objects.
      const depths = await page.evaluate(() => {
        const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
        const marker = w.highlight.gfx.depth;
        const list = w.children.list;
        // every sprite (the farmer, villagers, animals) draws above the marker
        const spritesBelow = list.filter((o) => o.type === 'Sprite' && o.depth <= marker).length;
        return {
          marker,
          player: w.sprite.depth,
          ground: w.ground.depth,
          spritesBelow,
          sprites: list.filter((o) => o.type === 'Sprite').length,
        };
      });
      check(
        `${tag}: the target marker draws above the ground and below the player, villagers and y-sorted objects`,
        depths.marker > depths.ground &&
          depths.marker < depths.player &&
          depths.spritesBelow === 0 &&
          depths.sprites > 0,
        JSON.stringify(depths),
      );

      // --- Tap to move (M4): one tap walks to the bin and opens it; Rosa likewise.
      await place(page, 14, 13, 'down');
      await sleep(1300); // camera settles
      t.reset();
      const bin = await tileScreen(page, 12, 9);
      await t.tap(bin.x, bin.y, 70);
      await page
        .waitForFunction(
          () =>
            window.__farm.game.scene
              .getScene('UI')
              .allModals()
              .some((m) => m.isOpen),
          null,
          {
            timeout: 6000,
          },
        )
        .catch(() => undefined);
      check(
        `${tag}: one tap on the bin 4 tiles away walks there and opens it`,
        (await openSheets(page)) === 1 && t.ledger().gestures === 1,
        `sheets ${await openSheets(page)}, gestures ${t.ledger().gestures}`,
      );
      await closeSheets(page);

      // A tap on a far grass tile walks next to it and tills it; the preview shows before the finger lifts.
      await place(page, 10, 17, 'down');
      await sleep(1300);
      const g = await tileScreen(page, 12, 19);
      await t.down(g.x, g.y);
      await sleep(180);
      const previewShown = await page.evaluate(() => {
        const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
        return w.highlight.plan.visible;
      });
      const stillThere = await player(page);
      await t.up();
      await page
        .waitForFunction(() => !!window.__farm.getState().farm.tiles['12,19'], null, {
          timeout: 5000,
        })
        .catch(() => undefined);
      check(
        `${tag}: a held tap previews its path, and on release walks there and works the tile`,
        previewShown && stillThere.tx === 10 && (await soil(page)) === 1,
        `preview ${previewShown}, soil ${await soil(page)}`,
      );

      // The stick cancels a walk at once, with no act afterwards; a second tap retargets.
      await place(page, 10, 17, 'down');
      await sleep(1300);
      const far2 = await tileScreen(page, 12, 22); // in the home plot (9-12 x 16-23)
      await t.tap(far2.x, far2.y, 60);
      await sleep(250);
      await t.down(L.stickHome.x, L.stickHome.y);
      await t.move(L.stickHome.x, L.stickHome.y - 16);
      await sleep(120);
      const routeGone = await page.evaluate(
        () => window.__farm.game.scene.getScenes(true).find((s) => s.grid).route === null,
      );
      await t.up();
      await sleep(1500);
      check(
        `${tag}: a stick push cancels a tap's walk at once and nothing is worked afterwards`,
        routeGone && (await soil(page)) === 0,
        `route cleared ${routeGone}, soil ${await soil(page)}`,
      );
      await place(page, 10, 17, 'down');
      await sleep(1300);
      const a1 = await tileScreen(page, 12, 22);
      await t.tap(a1.x, a1.y, 60);
      await sleep(200);
      const a2 = await tileScreen(page, 9, 22); // the camera follows the walk: map the tile now
      await t.tap(a2.x, a2.y, 60);
      await page
        .waitForFunction(() => Object.keys(window.__farm.getState().farm.tiles).length > 0, null, {
          timeout: 5000,
        })
        .catch(() => undefined);
      await sleep(400);
      const worked = await page.evaluate(() => Object.keys(window.__farm.getState().farm.tiles));
      check(
        `${tag}: a second tap mid-walk retargets: only the new tile is worked`,
        worked.length === 1 && worked[0] !== '12,22', // the first target is never worked
        worked.join(' '),
      );

      // Grazes on the dock and hotbar never reach the world.
      await place(page, 10, 17, 'down');
      await sleep(300);
      const before = await player(page);
      for (const [gx, gy] of [
        [L.stickHome.x, 300],
        [100, 366],
        [L.action.x - 40, 360],
        [30, 395],
      ]) {
        await t.tap(gx, gy, 70);
        await sleep(150);
      }
      await sleep(500);
      const after = await player(page);
      check(
        `${tag}: taps on the dock and hotbar never walk the farmer`,
        after.tx === before.tx && after.ty === before.ty && (await soil(page)) === 0,
        `${before.tx},${before.ty} -> ${after.tx},${after.ty}`,
      );

      // Tap accuracy, in the page's real camera: Gaussian thumbs (1.5 and 2.5 mm, 1.5 mm toward the thumb
      // base) at the bin and at a ripe crop resolve to that target; crop misses never act on another tile.
      await place(
        page,
        14,
        13,
        'down',
        "s.farm.tiles = { '13,17': { watered: true, crop: { cropId: 'parsnip', stage: 9, daysInStage: 0, regrow: false } } }; s.placed.farm = [{ id: 950, type: 'preserve_jar', tx: 16, ty: 15, data: {} }]; f.gameEvents.emit('placedChanged', { map: 'farm' });",
      );
      await sleep(1300);
      const acc = await page.evaluate(
        ({ mm, hand }) => {
          const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
          let seed = 7;
          const u = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
          const g = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
          const cam = w.cameras.main;
          const out = {};
          for (const [name, tx, ty, kind] of [
            ['bin', 12, 9, 'interact'],
            ['jar', 16, 15, 'interact'],
            ['crop', 13, 17, 'act'],
          ])
            for (const sigma of [1.5, 2.5]) {
              let hit = 0;
              let wrongAct = 0;
              let otherSheet = 0;
              for (let i = 0; i < 200; i++) {
                const off = 1.06 * mm; // 1.5 mm toward the thumb base, split over x and y
                const sx =
                  tx * 16 +
                  8 -
                  cam.scrollX +
                  cam.x +
                  g() * sigma * mm +
                  (hand === 'left' ? -off : off);
                const sy = ty * 16 + 8 - cam.scrollY + cam.y + g() * sigma * mm + off;
                const plan = w.planTap(sx, sy);
                const i2 = plan?.intent;
                const onTarget =
                  i2 && i2.target.tx === tx && i2.target.ty === ty && i2.kind === kind;
                if (onTarget) hit++;
                else if (i2?.kind === 'act' && i2.plan !== 'till') wrongAct++;
                else if (i2?.kind === 'interact') otherSheet++;
              }
              out[`${name}@${sigma}`] = {
                hit: hit / 200,
                otherSheet: otherSheet / 200,
                wrongAct: wrongAct / 200,
              };
            }
          return out;
        },
        { mm, hand },
      );
      console.log(`      ${tag} tap accuracy: ${JSON.stringify(acc)}`);
      // The jar stands alone: it must catch >= 95% / 85%. The bin has the mailbox right beside it, so a miss
      // there may open the mailbox: still a sheet, never an act; bin-or-sheet must meet the same bar.
      check(
        `${tag}: taps at a machine resolve to it >= 95% at 1.5 mm and >= 85% at 2.5 mm`,
        acc['jar@1.5'].hit >= 0.95 && acc['jar@2.5'].hit >= 0.85,
        JSON.stringify(acc),
      );
      check(
        `${tag}: taps at the bin open the bin (or the mailbox beside it) >= 95% / 85%`,
        acc['bin@1.5'].hit + acc['bin@1.5'].otherSheet >= 0.95 &&
          acc['bin@2.5'].hit + acc['bin@2.5'].otherSheet >= 0.85,
        JSON.stringify(acc),
      );
      check(
        `${tag}: taps near a ripe crop never harvest, water or plant a different tile`,
        acc['crop@1.5'].wrongAct === 0 && acc['crop@2.5'].wrongAct === 0,
        JSON.stringify(acc),
      );

      // --- Grid feel (M2): a flick in a new direction turns in place; every release rests on a tile centre.
      const flickFails = [];
      let flickSkipped = 0;
      for (const ms of [60, 90, 120, 150]) {
        for (const [dir, dx, dy] of [
          ['right', 1, 0],
          ['up', 0, -1],
        ]) {
          await place(page, 10, 17, 'down');
          await sleep(150);
          const f0 = await player(page);
          await page.evaluate(() => (window.__touchLog = []));
          await t.down(L.stickHome.x, L.stickHome.y);
          await t.move(L.stickHome.x + dx * 16, L.stickHome.y + dy * 16);
          await sleep(Math.max(0, ms - 25)); // the touch takes ~25 ms more to reach the page than this
          await t.up();
          await sleep(300);
          const f1 = await player(page);
          // The push the game saw: from the move that left the deadzone to the lift, measured in the page.
          const log = await page.evaluate(() => window.__touchLog);
          const mv = log.find((e) => e.type === 'touchmove');
          const end = log.find((e) => e.type === 'touchend');
          const actual = mv && end ? end.t - mv.t : 0;
          if (actual > 150) {
            flickSkipped++;
            continue; // the harness lagged past the 150 ms bar; not a fair sample
          }
          if (f1.tx !== f0.tx || f1.ty !== f0.ty || f1.facing !== dir)
            flickFails.push(
              `${dir} ${ms}ms (${Math.round(actual)} measured) -> ${f1.tx},${f1.ty} ${f1.facing}`,
            );
        }
      }
      check(
        `${tag}: flicks of 60-150 ms in a new direction turn without leaving the tile`,
        flickFails.length === 0 && flickSkipped <= 2,
        `${flickFails.join('; ')} (${flickSkipped} skipped: harness lag)`,
      );
      const offCentre = [];
      for (const ms of [180, 260, 340, 420, 610]) {
        await place(page, 6, 17, 'right');
        await sleep(150);
        await t.down(L.stickHome.x, L.stickHome.y);
        await t.move(L.stickHome.x + 16, L.stickHome.y);
        await sleep(ms);
        await t.up();
        await sleep(350);
        const q = await page.evaluate(() => window.__farm.getState().player);
        const cx = Math.floor(q.x / 16) * 16 + 8;
        if (Math.abs(q.x - cx) > 1) offCentre.push(`${ms}ms x=${q.x.toFixed(1)}`);
      }
      check(
        `${tag}: after every stick release the farmer rests on a tile centre (+-1 px)`,
        offCentre.length === 0,
        offCentre.join('; '),
      );

      // --- The marker says yes or no.
      await place(page, 10, 17, 'down');
      await sleep(200);
      const hoeMark = await page.evaluate(
        () => window.__farm.game.scene.getScenes(true).find((s) => s.grid).highlight.shown,
      );
      // The rod in hand is an explicit choice: on grass it can do nothing, and the marker says so.
      await page.evaluate(() => (window.__farm.getState().inventory.selected = 3));
      await sleep(200);
      const rodMark = await page.evaluate(
        () => window.__farm.game.scene.getScenes(true).find((s) => s.grid).highlight.shown,
      );
      check(
        `${tag}: marker shows "work" for the hoe on grass and "none" for the rod on grass`,
        hoeMark === 'work' && rodMark === 'none',
        `${hoeMark} / ${rodMark}`,
      );
      await t.tap(L.action.x, L.action.y, 60);
      await sleep(350);
      check(
        `${tag}: Action with the rod on grass never swings the hoe`,
        (await soil(page)) === 0 && (await selected(page)) === 3,
        `soil ${await soil(page)}`,
      );

      // --- Auto tool (M3): hoe in hand, tilled soil in front -> Action shows and uses the seeds.
      await place(
        page,
        10,
        17,
        'down',
        "s.farm.tiles = { '10,18': { watered: false, crop: null } };",
      );
      await sleep(250);
      const icon = await page.evaluate(() => {
        const ui = window.__farm.game.scene.getScene('UI');
        return ui.actionIcon.texture.key;
      });
      const seedIcon = await page.evaluate(() => {
        const s = window.__farm.getState();
        return window.__farm.game.textures.exists('item_parsnip_seed')
          ? 'item_parsnip_seed'
          : s.inventory.slots[5]?.item;
      });
      await t.tap(L.action.x, L.action.y, 60);
      await sleep(350);
      const planted = await page.evaluate(
        () => !!window.__farm.getState().farm.tiles['10,18']?.crop,
      );
      check(
        `${tag}: auto tool shows the seeds on Action and plants with the hoe still selected`,
        planted && (await selected(page)) === 0 && icon !== 'item_hoe',
        `icon ${icon} (seed icon ${seedIcon}), planted ${planted}, slot ${await selected(page)}`,
      );

      // --- Hold under a rolling pad works 3 tiles in 1.2 s.
      for (const [label, dx, dy] of [
        ['2.5 mm vertical roll', 0, 2.5 * mm],
        ['3 mm diagonal roll', 0.6 * 3 * mm, 0.8 * 3 * mm],
      ]) {
        await place(page, 10, 17, 'down');
        await sleep(200);
        await page.evaluate(() => window.__farm.controls.clear());
        await t.down(L.action.x, L.action.y);
        await sleep(40);
        await t.move(L.action.x + dx, L.action.y + dy);
        await sleep(1160);
        await t.up();
        await sleep(250);
        // Uses at 110, 310 ... 1110 ms. (Auto tool works the front tile through till, plant and water before
        // the sides, so count uses, not tiles.) A cancelled hold would give 1.
        const n = await page.evaluate(
          () => window.__farm.controls.entries.filter((e) => e.kind === 'act' && e.ok).length,
        );
        check(
          `${tag}: holding Action 1.2 s with a ${label} keeps working (>= 5 uses)`,
          n >= 5,
          `${n} uses`,
        );
      }

      // --- Swipes never use the old tool; hoe -> seeds is one swipe down (empty slots skipped).
      let uses = 0;
      const usedAt = [];
      let stalls = 0;
      for (const ms of [60, 150, 300, 500]) {
        // A loaded machine can stall the harness between touch events, so the finger really is still for
        // 110 ms and a hold is correct. Such samples are retried (up to 3 times) and counted.
        for (let attempt = 0; attempt < 3; attempt++) {
          await place(page, 10, 17, 'down');
          await sleep(150);
          await page.evaluate(() => (window.__touchLog = []));
          await t.timedDrag(L.action.x, L.action.y, L.action.x, L.action.y - 18, ms);
          await sleep(300);
          const log = await page.evaluate(() => window.__touchLog);
          const times = log.filter((e) => e.type !== 'touchend').map((e) => e.t);
          const maxGap = Math.max(...times.slice(1).map((v, k) => v - times[k]));
          if (maxGap > 90 && attempt < 2) {
            stalls++;
            continue;
          }
          const n = await soil(page);
          if (n) usedAt.push(ms);
          uses += n;
          break;
        }
      }
      if (stalls)
        console.log(`      ${tag}: ${stalls} swipe samples retried (harness stalled > 90 ms)`);
      check(
        `${tag}: swipes of 60-500 ms change tool and never use the old one`,
        uses === 0,
        `${uses} uses at ${usedAt.join(',')} ms`,
      );
      await place(page, 10, 17, 'down');
      await sleep(150);
      await t.drag(L.action.x, L.action.y, L.action.x, L.action.y + 18, 150, 6);
      await sleep(250);
      check(
        `${tag}: hoe -> seeds is one swipe down`,
        (await selected(page)) === 5,
        `slot ${await selected(page)}`,
      );

      // --- Haptics: ticks at most 1 per 120 ms during a held action; vibrate off means none at all.
      await place(page, 10, 17, 'down');
      await page.evaluate(() => (window.__vibrations = []));
      await t.hold(L.action.x, L.action.y, 1300);
      await sleep(200);
      const vibs = await page.evaluate(() => window.__vibrations);
      // Ticks (8 ms) at most 1 per 120 ms; any other pulse within 80 ms must be a stronger one replacing it.
      const vib = vibs.filter((v) => v.pattern === 8).map((v) => v.t);
      const gaps = vib.slice(1).map((v, i) => v - vib[i]);
      const all = vibs.map((v) => v.t);
      const close = all.slice(1).filter((v, i) => v - all[i] < 79 && vibs[i + 1].pattern === 8);
      check(
        `${tag}: a held action ticks at most 1 per 120 ms and never doubles up`,
        vib.length >= 1 && gaps.every((g) => g >= 119) && close.length === 0,
        `${vib.length} pulses, gaps ${gaps.map(Math.round).join(',')}, patterns ${vibs.map((v) => JSON.stringify(v.pattern)).join(' ')}`,
      );
      await place(page, 10, 17, 'down');
      await page.evaluate(() => {
        window.__farm.getState().settings.vibrate = false;
        window.__farm.haptics.setHapticsEnabled(false);
        window.__vibrations = [];
      });
      await t.hold(L.action.x, L.action.y, 800);
      await sleep(200);
      check(
        `${tag}: with vibration off there are 0 vibrate calls`,
        (await page.evaluate(() => window.__vibrations.length)) === 0,
        `${await page.evaluate(() => window.__vibrations.length)} calls`,
      );
      await page.evaluate(() => {
        window.__farm.getState().settings.vibrate = true;
        window.__farm.haptics.setHapticsEnabled(true);
      });

      // --- Latency in frames (game loop): stick and Action press <= 2, hotbar 0. iPhone 13 right only.
      if (p.id === 'i13' && hand === 'right') {
        // Frames are counted in the page: from the frame the touch event reached the canvas to the first
        // rendered frame where the response is visible (as feel-probe.mjs measured the baseline).
        await page.evaluate(() => {
          const g = window.__farm.game;
          window.__lat = { down: null, hit: null };
          document
            .querySelector('canvas')
            .addEventListener('touchstart', () => (window.__lat.down = g.loop.frame), true);
          g.events.on('postrender', () => {
            const L = window.__lat;
            if (L.down !== null && L.hit === null && window.__probeOk?.()) L.hit = g.loop.frame;
          });
        });
        const frames = async (setup, act) => {
          await page.evaluate(setup);
          await page.evaluate(() => (window.__lat = { down: null, hit: null }));
          await act();
          await sleep(300);
          const L = await page.evaluate(() => window.__lat);
          return L.hit === null || L.down === null ? 99 : L.hit - L.down;
        };
        // Walking the way you face starts at once; a new direction turns at once (and walks after the hold).
        await place(page, 10, 17, 'right');
        await sleep(300);
        const stick = await frames(
          () => {
            const x0 = window.__farm.getState().player.x;
            window.__probeOk = () => window.__farm.getState().player.x !== x0;
          },
          async () => {
            await t.down(L.stickHome.x, L.stickHome.y);
            await t.move(L.stickHome.x + 20, L.stickHome.y);
          },
        );
        await t.up();
        await place(page, 10, 17, 'down');
        await sleep(300);
        const turn = await frames(
          () => {
            window.__probeOk = () => window.__farm.getState().player.facing === 'right';
          },
          async () => {
            await t.down(L.stickHome.x, L.stickHome.y);
            await t.move(L.stickHome.x + 20, L.stickHome.y);
          },
        );
        await t.up();
        const press = await frames(
          () => {
            window.__probeOk = () =>
              window.__farm.game.scene.getScene('UI').controls[0].view.scale < 0.99;
          },
          () => t.down(L.action.x, L.action.y),
        );
        await t.up();
        await sleep(300);
        const slot = await frames(
          () => {
            window.__probeOk = () => window.__farm.getState().inventory.selected === 1;
          },
          () => t.down(40.5, 383.5),
        );
        await t.up();
        console.log(`      frames: stick ${stick}, turn ${turn}, action ${press}, hotbar ${slot}`);
        check(
          `${tag}: frames from touch to response: stick walk <= 2, turn <= 2, Action <= 2, hotbar <= 1`,
          stick <= 2 && turn <= 2 && press <= 2 && slot <= 1,
          `stick ${stick}, action ${press}, hotbar ${slot}`,
        );
      }

      check(`${tag}: no console errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
} finally {
  await browser.close();
  stop();
}
console.log(failed === 0 ? '\nCONTROLS E2E OK' : `\nCONTROLS E2E FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
