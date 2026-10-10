// Controls e2e: real CDP touches on phone profiles (iPhone 13 and SE, right and left hand) against the production
// build. Checks the one-thumb rules that unit tests cannot see end to end: dock hit ownership, release-acting
// Menu, tap vs stick, hold under a rolling pad, swipes, the target marker, silent taps, haptics and latency.
// Run `npm run build` first. Headless emulation only: it proves the rules, not how a real hand feels.
import {
  PROFILES,
  Thumb,
  dock,
  launch,
  liveTargets,
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

/** Every check for one phone and hand, in its own browser context. */
async function runCombo(p, hand) {
  {
    {
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

      // --- A tap never walks, a drag never acts. (A dry crop below: a tap waters it from where you stand.)
      const dryBelow =
        "s.farm.tiles = { '10,18': { watered: false, crop: { cropId: 'parsnip', stage: 1, daysInStage: 0, regrow: false } } };";
      const wetBelow = () =>
        page.evaluate(() => !!window.__farm.getState().farm.tiles['10,18']?.watered);
      await place(page, 10, 17, 'down', dryBelow);
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
        (await wetBelow()) && Math.abs(b.x - a.x) + Math.abs(b.y - a.y) < 0.01,
        `watered ${await wetBelow()}, moved ${(b.x - a.x).toFixed(1)},${(b.y - a.y).toFixed(1)}`,
      );
      await place(page, 10, 17, 'down', dryBelow);
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
        !(await wetBelow()) && (c1.x !== c0.x || c1.facing !== c0.facing),
        `watered ${await wetBelow()}, moved ${(c1.x - c0.x).toFixed(1)} facing ${c1.facing}`,
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

      // A tap on grass only walks (a tap never tills or plants); the preview shows before the finger lifts.
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
      await sleep(1500);
      const walked = await player(page);
      check(
        `${tag}: a held tap on grass previews its path, then walks there and works nothing`,
        previewShown &&
          stillThere.tx === 10 &&
          walked.tx === 12 &&
          walked.ty === 19 &&
          (await soil(page)) === 0,
        `preview ${previewShown}, at ${walked.tx},${walked.ty}, soil ${await soil(page)}`,
      );

      // A tap on a dry crop walks next to it and waters it (an obvious act).
      const dry = (keys) =>
        `s.farm.tiles = {${keys
          .map(
            (k) =>
              `'${k}': { watered: false, crop: { cropId: 'parsnip', stage: 1, daysInStage: 0, regrow: false } }`,
          )
          .join(', ')}};`;
      await place(page, 10, 17, 'down', dry(['12,22', '9,22']));
      await sleep(1300);
      const crop = await tileScreen(page, 12, 22);
      await t.tap(crop.x, crop.y, 60);
      await page
        .waitForFunction(() => window.__farm.getState().farm.tiles['12,22']?.watered, null, {
          timeout: 5000,
        })
        .catch(() => undefined);
      const wet = () =>
        page.evaluate(() =>
          Object.entries(window.__farm.getState().farm.tiles)
            .filter(([, v]) => v.watered)
            .map(([k]) => k),
        );
      check(
        `${tag}: a tap on a dry crop walks there and waters it`,
        (await wet()).join() === '12,22',
        (await wet()).join(),
      );

      // The stick cancels a walk at once, with no act afterwards; a second tap retargets.
      await place(page, 10, 17, 'down', dry(['12,22', '9,22']));
      await sleep(1300);
      const far2 = await tileScreen(page, 12, 22);
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
        routeGone && (await wet()).length === 0,
        `route cleared ${routeGone}, watered ${(await wet()).join()}`,
      );
      await place(page, 10, 17, 'down', dry(['12,22', '8,22', '9,22', '10,22']));
      await sleep(1300);
      const a1 = await tileScreen(page, 12, 22);
      await t.tap(a1.x, a1.y, 60);
      await sleep(200);
      const a2 = await tileScreen(page, 9, 22); // the camera follows the walk: map the tile now
      await t.tap(a2.x, a2.y, 60);
      await page
        .waitForFunction(
          () => Object.values(window.__farm.getState().farm.tiles).some((v) => v.watered),
          null,
          { timeout: 5000 },
        )
        .catch(() => undefined);
      await sleep(400);
      check(
        `${tag}: a second tap mid-walk retargets: one crop of the new row is watered, never the first`,
        (await wet()).length === 1 && !(await wet()).includes('12,22'),
        (await wet()).join(),
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
            ['belowBin', 12, 10, 'walk'],
            ['besideMailbox', 14, 9, 'walk'],
            ['crop', 13, 17, 'act'],
          ])
            for (const sigma of [1.0, 1.5, 2.5]) {
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
      // No magnets (owner ruling): only the target's own tile or sprite opens it, so the tiles in front of
      // the house walk.
      // Bars by screen: the SE's tiles are 4.0 mm (the hard check), the iPhone 13's 5.0 mm.
      const small = p.id === 'se' || p.id === 'fold';
      check(
        `${tag}: centre taps (1 mm) on the tiles beside the bin and mailbox walk >= ${small ? 85 : 90}%`,
        acc['belowBin@1'].hit >= (small ? 0.85 : 0.9) &&
          acc['besideMailbox@1'].hit >= (small ? 0.85 : 0.9),
        JSON.stringify(acc),
      );
      // Without magnets accuracy is the tile's own size: about 80% at 1.5 mm on a 5 mm tile with the critic's
      // 1.5 mm offset. The bar is the owner's ruling (own tile or sprite only), not a magnet-era number.
      check(
        `${tag}: taps at the bin open it (own tile and sprite only) >= ${small ? '60% at 1.5 mm, 85%' : '75% at 1.5 mm, 95%'} at 1 mm`,
        acc['bin@1.5'].hit >= (small ? 0.6 : 0.75) && acc['bin@1'].hit >= (small ? 0.85 : 0.95),
        JSON.stringify(acc),
      );
      check(
        `${tag}: taps near a ripe crop never harvest, water or plant a different tile`,
        acc['crop@1.5'].wrongAct === 0 && acc['crop@2.5'].wrongAct === 0,
        JSON.stringify(acc),
      );

      // --- Tool ring: a sideways flick on Action opens the ring and never acts; slide, rest, lift picks.
      await place(page, 10, 17, 'down');
      await sleep(300);
      const inward = hand === 'left' ? 1 : -1; // toward the middle of the screen
      const ringItemAt = (slot) =>
        page.evaluate(
          ({ slot, left }) => {
            const ui = window.__farm.game.scene.getScene('UI');
            const s = window.__farm.getState();
            const items = [];
            for (let i = 0; i < 8; i++) if (s.inventory.slots[i]) items.push(i);
            items.push('bag');
            const n = items.length;
            const i = items.indexOf(slot);
            const t = n <= 1 ? 0.5 : i / (n - 1);
            const R = window.__farm.controls.ringGeometry;
            let deg = R.from + (R.to - R.from) * t;
            if (left) deg = 180 - deg;
            const r = (deg * Math.PI) / 180;
            const L = ui.layout;
            return {
              x: L.action.x + Math.cos(r) * R.radius,
              y: L.action.y + Math.sin(r) * R.radius,
            };
          },
          { slot, left: hand === 'left' },
        );
      const ringOpen = () =>
        page.evaluate(() => window.__farm.game.scene.getScene('UI').ring.isOpen);
      await page.evaluate(() => window.__farm.controls.clear());
      // slow and fast flicks (14 px reached at 60-200 ms), each slid to the can and rested on it
      // A loaded machine can stall the page between the slide and the lift (the rest then looks shorter than
      // 80 ms to the game): a missed pick is retried up to twice, and at most 2 retries in all are allowed, so a
      // real fault (which misses every time) still fails.
      let picked = 0;
      let ringRetries = 0;
      for (const ms of [60, 120, 200]) {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) {
            ringRetries++;
            await page.evaluate(() => window.__farm.game.scene.getScene('UI').ring.close());
            await sleep(150);
          }
          await page.evaluate(() => (window.__farm.getState().inventory.selected = 0));
          await t.timedDrag(
            L.action.x,
            L.action.y,
            L.action.x + inward * 18,
            L.action.y + 1,
            ms * 1.3,
            true,
          );
          const can = await ringItemAt(1);
          await t.move(can.x, can.y);
          await sleep(140);
          await t.up();
          await sleep(200);
          if ((await selected(page)) === 1) {
            picked++;
            break;
          }
        }
      }
      const ringActs = await page.evaluate(
        () => window.__farm.controls.entries.filter((e) => e.kind === 'act').length,
      );
      check(
        `${tag}: flicks of 60-200 ms open the ring, slide-rest-lift picks the can, and nothing is used`,
        picked === 3 && ringRetries <= 2 && ringActs === 0 && (await soil(page)) === 0,
        `picked ${picked}/3 (${ringRetries} retries), acts ${ringActs}, soil ${await soil(page)}`,
      );
      // flick and lift at once: the ring stays open as a tap menu; a tap on Bag opens the bag
      await page.evaluate(() => (window.__farm.getState().inventory.selected = 0));
      await t.timedDrag(L.action.x, L.action.y, L.action.x + inward * 30, L.action.y, 70);
      await sleep(150);
      const stuck = (await ringOpen()) && (await selected(page)) === 0;
      const bagAt = await ringItemAt('bag');
      await t.tap(bagAt.x, bagAt.y, 70);
      await sleep(450);
      const bagOpen = await page.evaluate(
        () => window.__farm.game.scene.getScene('UI').menu.isOpen,
      );
      await closeSheets(page);
      // and a tap away from the items closes it, changing nothing
      await t.timedDrag(L.action.x, L.action.y, L.action.x + inward * 30, L.action.y, 70);
      await sleep(150);
      await t.tap(100, 150, 70);
      await sleep(200);
      check(
        `${tag}: a flick lifted at once leaves the ring open as a tap menu (no silent pick); taps pick or close`,
        stuck && bagOpen && !(await ringOpen()) && (await selected(page)) === 0,
        `stuck ${stuck}, bag ${bagOpen}, open ${await ringOpen()}, slot ${await selected(page)}`,
      );
      // vertical swipes never open the ring
      let ringFromSwipe = 0;
      for (const ms of [80, 200]) {
        await t.timedDrag(
          L.action.x,
          L.action.y,
          L.action.x + inward * 6,
          L.action.y - 18,
          ms,
          true,
        );
        if (await ringOpen()) ringFromSwipe++;
        await t.up();
        await sleep(150);
      }
      check(
        `${tag}: vertical swipes on Action never open the ring`,
        ringFromSwipe === 0,
        `${ringFromSwipe}`,
      );

      // Mirrored sheets: in left-handed mode the bin's row buttons sit on the left.
      await place(page, 12, 10, 'up', "s.inventory.slots[9] = { item: 'parsnip', qty: 3 };");
      await sleep(300);
      await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'bin' }));
      await sleep(400);
      const allX = await page.evaluate(() => {
        const ui = window.__farm.game.scene.getScene('UI');
        const bin = ui.panels.get('bin');
        const out = [];
        const walk = (n) => {
          if (n.list) n.list.forEach(walk);
          if (n.zone && n.label?.main?.text === 'All') out.push(n.x);
        };
        walk(bin.content);
        return out;
      });
      await closeSheets(page);
      check(
        `${tag}: sheet rows put their buttons on the thumb's side`,
        allX.length > 0 && allX.every((x) => (hand === 'left' ? x < 100 : x > 100)),
        allX.join(','),
      );

      // --- M7: the help card is two taps away (Menu, then the Opts tab).
      await place(page, 10, 17, 'down');
      await sleep(300);
      await t.tap(L.menu.x, L.menu.y, 70);
      await sleep(450);
      const opts = (await liveTargets(page)).find((x) => /^Opts$/.test(x.text));
      if (opts) await t.tap(opts.cx, opts.cy, 70);
      await sleep(400);
      const helpShown = await page.evaluate(() => {
        const m = window.__farm.game.scene.getScene('UI').menu;
        const texts = [];
        const walk = (n) => {
          if (n.main?.text) texts.push(n.main.text);
          if (n.list) n.list.forEach(walk);
        };
        walk(m.content);
        return texts.includes('Tap a tile:') && texts.includes('Hold Action,');
      });
      await closeSheets(page);
      check(`${tag}: the controls help card is two taps away (Menu, Opts)`, !!opts && helpShown);

      // --- M7: the two-speed stick walks at half speed when pushed gently (Options > Fine stick).
      const gentle = async () => {
        await place(page, 6, 17, 'right');
        await sleep(200);
        const a0 = await player(page);
        await t.down(L.stickHome.x, L.stickHome.y);
        await t.move(L.stickHome.x + 10, L.stickHome.y);
        await sleep(600);
        const a1 = await player(page);
        await t.up();
        await sleep(300);
        return a1.x - a0.x;
      };
      const full = await gentle();
      await page.evaluate(() => (window.__farm.getState().settings.controls.twoSpeed = true));
      const fine = await gentle();
      await page.evaluate(() => (window.__farm.getState().settings.controls.twoSpeed = false));
      check(
        `${tag}: with Fine stick on, a gentle push walks about half as fast`,
        fine > 4 && fine < full * 0.7,
        `full ${full.toFixed(1)} px, fine ${fine.toFixed(1)} px in 600 ms`,
      );

      // --- Paint a row from Action (ruling 2026-10-09): hold Action still 300 ms, drag, lift.
      const paintDone = () =>
        page
          .waitForFunction(
            () => {
              const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
              return w.work === null && w.route === null && w.painting === null;
            },
            null,
            { timeout: 15000, polling: 100 },
          )
          .catch(() => undefined);
      const tiles = () =>
        page.evaluate(() => Object.keys(window.__farm.getState().farm.tiles).sort());
      /** Hold Action `holdMs`, then drag through `path` (dx, dy from Action) at ~a tile per 100 ms, lift. */
      const paintFromAction = async (holdMs, path) => {
        await t.down(L.action.x, L.action.y);
        await sleep(holdMs);
        for (const [dx, dy] of path) {
          await t.move(L.action.x + dx, L.action.y + dy);
          await sleep(50);
        }
        await t.up();
        await paintDone();
      };
      // three tiles of row 17 inside the home plot (x 9-12), drawn toward the middle of the screen (right hand:
      // left from 12,17; left hand: right from 9,17), with a 2.5 mm wobble across the line
      const toMid = hand === 'left' ? 1 : -1;
      await place(page, hand === 'left' ? 9 : 12, 17, 'down');
      await sleep(300);
      await page.evaluate(() => (window.__vibrations = []));
      await t.down(L.action.x, L.action.y);
      await sleep(250);
      const armedEarly = await page.evaluate(() => {
        const ui = window.__farm.game.scene.getScene('UI');
        return ui.actionPress?.armed ?? false;
      });
      await sleep(90);
      const armedLate = await page.evaluate(
        () => window.__farm.game.scene.getScene('UI').actionPress?.armed ?? false,
      );
      const wob = 2.5 * mm;
      for (const [dx, dy] of [
        [8, 0],
        [20, wob],
        [32, -wob],
        [42, wob],
        [48, 0],
      ]) {
        await t.move(L.action.x + toMid * dx, L.action.y + dy);
        await sleep(60);
      }
      const shown = await page.evaluate(
        () =>
          window.__farm.game.scene.getScenes(true).find((s) => s.grid).highlight.paintGfx.visible,
      );
      await t.up();
      await paintDone();
      const vibs = await page.evaluate(() => window.__vibrations.length);
      check(
        `${tag}: Action held 300 ms arms painting; a wobbly drag right paints exactly the 3 tiles of that line`,
        !armedEarly &&
          armedLate &&
          shown &&
          (await tiles()).join(' ') ===
            (hand === 'left' ? '10,17 11,17 12,17' : '10,17 11,17 9,17') &&
          vibs <= 3 + 2,
        `armed ${armedEarly}/${armedLate}, preview ${shown}, tiles ${(await tiles()).join(' ')}, buzzes ${vibs}`,
      );
      // A still press acts exactly once however long it is held (owner decision, round 3): hesitant holds
      // included, since the guided start teaches Action early. Holding never repeats.
      const pressUses = [];
      for (const ms of [80, 180, 290, 400, 700, 1500]) {
        await place(page, 10, 17, 'down');
        await sleep(300);
        await page.evaluate(() => window.__farm.controls.clear());
        await t.hold(L.action.x, L.action.y, ms);
        await sleep(450);
        pressUses.push(
          await page.evaluate(
            () => window.__farm.controls.entries.filter((e) => e.kind === 'act' && e.ok).length,
          ),
        );
      }
      check(
        `${tag}: still Action presses of 80-1500 ms act exactly once each`,
        pressUses.every((n) => n === 1),
        `uses per press ${pressUses.join(',')}`,
      );
      // Armed, dragged out a tile and back to the start: nothing at all.
      await place(page, 10, 17, 'down');
      await sleep(300);
      await page.evaluate(() => window.__farm.controls.clear());
      await paintFromAction(340, [
        [-14, 0],
        [-30, 0],
        [-10, 0],
        [-2, 0],
      ]);
      const cancelActs = await page.evaluate(
        () => window.__farm.controls.entries.filter((e) => e.kind === 'act').length,
      );
      check(
        `${tag}: a paint dragged out and back to the start does nothing`,
        (await tiles()).length === 0 && cancelActs === 0,
        `tiles ${(await tiles()).join(' ')}, acts ${cancelActs}`,
      );

      // World touches never paint or till by duration: slow taps on grass and rest-then-steer just walk.
      let slowWorked = 0;
      for (const ms of [240, 350, 600]) {
        await place(page, 10, 17, 'down');
        await sleep(1300);
        const one = await tileScreen(page, 11, 19);
        await t.hold(one.x, one.y, ms);
        await sleep(900);
        slowWorked += (await tiles()).length;
      }
      let restWorked = 0;
      for (const rest of [100, 300, 500]) {
        await place(page, 10, 17, 'down');
        await sleep(1300);
        const r0 = await tileScreen(page, 10, 19);
        await t.down(r0.x, r0.y);
        await sleep(rest);
        for (const d of [5, 10, 16, 23, 30]) {
          await t.move(r0.x + d, r0.y);
          await sleep(16);
        }
        await sleep(300);
        await t.up();
        await sleep(500);
        restWorked += (await tiles()).length;
      }
      check(
        `${tag}: still world touches of 240-600 ms and rest-then-steer drags work 0 tiles`,
        slowWorked === 0 && restWorked === 0,
        `slow taps ${slowWorked}, rest-then-steer ${restWorked}`,
      );

      // --- Grid feel (M2): a flick in a new direction turns in place; every release rests on a tile centre.
      const flickFails = [];
      let flickSkipped = 0;
      for (const ms of [60, 90, 120, 150]) {
        for (const [dir, dx, dy] of [
          ['right', 1, 0],
          ['up', 0, -1],
        ]) {
          // A sample where the harness lagged past the 150 ms bar is not fair; it is retried (up to 3 times)
          // and counted as skipped only if it never ran in time.
          let fair = false;
          for (let attempt = 0; attempt < 3 && !fair; attempt++) {
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
            if (actual > 150) continue;
            fair = true;
            if (f1.tx !== f0.tx || f1.ty !== f0.ty || f1.facing !== dir)
              flickFails.push(
                `${dir} ${ms}ms (${Math.round(actual)} measured) -> ${f1.tx},${f1.ty} ${f1.facing}`,
              );
          }
          if (!fair) flickSkipped++;
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

      // --- Auto tool (M3): the scythe in hand (nothing to cut), tilled soil in front, parsnips planted before
      // -> Action shows and uses the seeds, and the scythe stays selected.
      await place(
        page,
        10,
        17,
        'down',
        "s.farm.tiles = { '10,18': { watered: false, crop: null } }; s.controls.lastSeed = 'parsnip_seed'; s.inventory.selected = 2;",
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
        `${tag}: auto tool shows the seeds on Action and plants with the scythe still selected`,
        planted && (await selected(page)) === 2 && icon !== 'item_scythe',
        `icon ${icon} (seed icon ${seedIcon}), planted ${planted}, slot ${await selected(page)}`,
      );

      // --- Action under a rolling pad (round 3): a press that stays within 9 px acts once, armed or not; one
      // that rolls 9 px or more after being still acts once too; one that moves at once (a swipe or flick cut
      // short) says no, with the error pulse and a shake, and never acts.
      for (const [label, dx, dy, stillMs, want] of [
        ['2 mm diagonal roll', 0.6 * 2 * mm, 0.8 * 2 * mm, 40, 'act'],
        ['2 mm sideways roll', 2 * mm, 0, 40, 'act'],
        ['3.5 mm roll after a still press', 0.6 * 3.5 * mm, 0.8 * 3.5 * mm, 160, 'act'],
        ['3.5 mm roll at once', 0.6 * 3.5 * mm, 0.8 * 3.5 * mm, 30, 'no'],
      ]) {
        await place(page, 10, 17, 'down');
        await sleep(200);
        await page.evaluate(() => {
          window.__farm.controls.clear();
          window.__vibrations = [];
        });
        await t.down(L.action.x, L.action.y);
        await sleep(stillMs);
        await t.move(L.action.x + dx, L.action.y + dy);
        await sleep(400 - stillMs);
        await t.up();
        await sleep(250);
        const r = await page.evaluate(() => ({
          acts: window.__farm.controls.entries.filter((e) => e.kind === 'act' && e.ok).length,
          no: window.__farm.controls.entries.filter(
            (e) => e.kind === 'press' && e.detail === 'reject',
          ).length,
          buzz: window.__vibrations.length,
        }));
        check(
          `${tag}: Action pressed with a ${label} ${want === 'act' ? 'acts once' : 'says no (pulse + shake) and acts 0 times'}`,
          want === 'act' ? r.acts === 1 && r.no === 0 : r.acts === 0 && r.no === 1 && r.buzz >= 1,
          `acts ${r.acts}, no ${r.no}, vibrations ${r.buzz}`,
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
          if (maxGap > 55 && attempt < 2) {
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
        console.log(
          `      ${tag}: ${stalls} swipe samples retried (harness gap > 55 ms: a phone reports a moving finger every 8-16 ms)`,
        );
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

      // --- Haptics: quick taps on Action tick at most 1 per 120 ms and never double up; vibrate off = none.
      await place(page, 10, 17, 'down');
      await page.evaluate(() => (window.__vibrations = []));
      for (let i = 0; i < 4; i++) {
        await t.tap(L.action.x, L.action.y, 60);
        await sleep(90);
      }
      await sleep(200);
      const tapVibs = await page.evaluate(() => window.__vibrations);
      const vib = tapVibs.filter((v) => v.pattern === 8).map((v) => v.t);
      const gaps = vib.slice(1).map((v, i) => v - vib[i]);
      const all = tapVibs.map((v) => v.t);
      const close = all.slice(1).filter((v, i) => v - all[i] < 79 && tapVibs[i + 1].pattern === 8);
      check(
        `${tag}: quick Action taps tick at most 1 per 120 ms and never double up`,
        vib.length >= 1 && gaps.every((g) => g >= 119) && close.length === 0,
        `${vib.length} pulses, gaps ${gaps.map(Math.round).join(',')}, patterns ${tapVibs.map((v) => JSON.stringify(v.pattern)).join(' ')}`,
      );
      await place(page, 10, 17, 'down');
      await page.evaluate(() => {
        window.__farm.getState().settings.vibrate = false;
        window.__farm.haptics.setHapticsEnabled(false);
        window.__vibrations = [];
      });
      await t.tap(L.action.x, L.action.y, 60);
      await sleep(300);
      await paintFromAction(340, [
        [-10, 0],
        [-20, 0],
      ]);
      check(
        `${tag}: with vibration off there are 0 vibrate calls (taps, a paint arm and a painted row)`,
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
        // Best of up to 3 tries: another browser on the machine can stretch one sample by a frame, but a slow
        // response path is slow every time, so the bar itself is unchanged.
        const frames = async (setup, act, reset) => {
          let best = 99;
          for (let attempt = 0; attempt < 3 && best > 2; attempt++) {
            if (attempt > 0 && reset) await reset();
            await page.evaluate(setup);
            await page.evaluate(() => (window.__lat = { down: null, hit: null }));
            await act();
            await sleep(300);
            const L = await page.evaluate(() => window.__lat);
            best = Math.min(best, L.hit === null || L.down === null ? 99 : L.hit - L.down);
          }
          return best;
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
          async () => {
            await t.up();
            await place(page, 10, 17, 'right');
            await sleep(300);
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
          async () => {
            await t.up();
            await place(page, 10, 17, 'down');
            await sleep(300);
          },
        );
        await t.up();
        const press = await frames(
          () => {
            window.__probeOk = () =>
              window.__farm.game.scene.getScene('UI').controls[0].view.scale < 0.99;
          },
          () => t.down(L.action.x, L.action.y),
          async () => {
            await t.up();
            await sleep(400);
          },
        );
        await t.up();
        await sleep(300);
        const slot = await frames(
          () => {
            window.__probeOk = () => window.__farm.getState().inventory.selected === 1;
          },
          () => t.down(40.5, 383.5),
          async () => {
            await t.up();
            await page.evaluate(() => (window.__farm.getState().inventory.selected = 0));
            await sleep(300);
          },
        );
        await t.up();
        console.log(`      frames: stick ${stick}, turn ${turn}, action ${press}, hotbar ${slot}`);
        check(
          `${tag}: frames from touch to response: stick walk <= 2, turn <= 2, Action <= 2, hotbar <= 1`,
          stick <= 2 && turn <= 2 && press <= 2 && slot <= 1,
          `stick ${stick}, action ${press}, hotbar ${slot}`,
        );
      }

      // --- Taps on doors and on tall or multi-tile things (guided-start findings, round 3): the door's top half
      // (drawn on the wall) walks in; the top half of the bed (against the wall) opens the bed; the house door
      // walks back out.
      await place(page, 14, 10, 'down');
      await sleep(1300);
      const doorArt = await tileScreen(page, 14, 6);
      await t.tap(doorArt.x, doorArt.y, 70);
      const inHouse = await page
        .waitForFunction(
          () =>
            window.__farm.game.scene.getScenes(true).find((s) => s.grid)?.mapId === 'house' &&
            window.__farm.getState().player.map === 'house',
          null,
          { timeout: 10000 },
        )
        .then(() => true)
        .catch(() => false);
      let bedOpened = false;
      let outAgain = false;
      if (inHouse) {
        await sleep(800);
        await place(page, 5, 6, 'up');
        await sleep(1300);
        const bed = await tileScreen(page, 2, 2);
        await t.tap(bed.x, bed.y - 4, 70); // the bed's top half
        bedOpened = await page
          .waitForFunction(
            () =>
              window.__farm.game.scene
                .getScene('UI')
                .allModals()
                .some((m) => m.isOpen),
            null,
            { timeout: 8000 },
          )
          .then(() => true)
          .catch(() => false);
        await closeSheets(page);
        await sleep(400);
        const door = await tileScreen(page, 5, 8);
        await t.tap(door.x, door.y, 70);
        outAgain = await page
          .waitForFunction(() => window.__farm.getState().player.map === 'farm', null, {
            timeout: 10000,
          })
          .then(() => true)
          .catch(() => false);
        await sleep(1200);
      }
      check(
        `${tag}: a tap on the farmhouse door's art walks in; a tap on the bed's top half opens the bed; a tap on the house door walks out`,
        inHouse && bedOpened && outAgain,
        `in ${inHouse}, bed ${bedOpened}, out ${outAgain}`,
      );

      check(`${tag}: no console errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  }
}

// Phones and hands run two at a time (each in its own context), so the suite fits the verify budget.
const combos = [];
for (const p of PROFILES.filter((x) => which.includes(x.id)))
  for (const hand of hands) combos.push([p, hand]);
const PARALLEL = Number(process.env.E2E_CONTROLS_PARALLEL ?? 2);
try {
  const queue = [...combos];
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      while (queue.length) {
        const [p, hand] = queue.shift();
        await runCombo(p, hand);
      }
    }),
  );
} finally {
  await browser.close();
  stop();
}
console.log(failed === 0 ? '\nCONTROLS E2E OK' : `\nCONTROLS E2E FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
