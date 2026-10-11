// The camera follows a long floating-stick walk (owner, round 5: "the camera doesn't follow the character when
// walking with the joystick"). Real CDP touches: the thumb goes down in the dock's stick zone, drags, and holds for
// more than 3 s while the farmer walks across the farm (east) and along a town street (south), on iPhone 13 and SE,
// both hands. Every rendered frame the farmer's on-screen position is read; it must stay within a few px of the
// view's centre the whole walk (the camera trails by about 8 px while walking). Scenario: joystick-walk.
// Run `npm run build` first. Port: E2E_JOYSTICK_PORT (default E2E_PORT + 35).
import { checker, dock, launch, openScenario, serve } from './lib/farm.mjs';

const PORT = Number(process.env.E2E_JOYSTICK_PORT ?? Number(process.env.E2E_PORT ?? 4800) + 35);
const result = checker();
const { check } = result;
const { url, stop } = await serve(PORT);
const browser = await launch();
/** How far (px) the farmer may sit from the centre while walking: the eased lag (about 8) plus a margin. */
const NEAR = 12;
/** Px walked that must have been covered (3 s and more at 64 px/s is about 200). */
const WALK_PX = 200;

async function walk(farm, tag, map, tx, ty, axis, sign) {
  await farm.mutate(
    (s, f, a) => {
      s.player.map = a.map;
      s.player.x = a.tx * 16 + 8;
      s.player.y = a.ty * 16 + 11;
      s.player.facing = a.axis === 'x' ? 'right' : 'down';
      s.time.minutes = 480;
      const active = f.game.scene.getScenes(true).find((x) => x.scene.key !== 'UI');
      const want = a.map === 'farm' ? 'Farm' : 'Town';
      if (active.scene.key !== want) active.scene.start(want);
    },
    { map, tx, ty, axis },
  );
  await farm.ready(map === 'farm' ? 'Farm' : 'Town');
  await farm.idle(10);
  // Record every frame: the farmer's drawn pixel minus the camera's scroll, against the view's centre.
  await farm.eval(() => {
    const f = window.__farm;
    window.__walk = { frames: [], on: true };
    if (window.__walkHook) f.game.events.off('postrender', window.__walkHook);
    window.__walkHook = () => {
      if (!window.__walk.on) return;
      const w = f.game.scene.getScenes(true).find((s) => s.grid);
      if (!w?.sprite) return;
      const cam = w.cameras.main;
      const p = f.getState().player;
      window.__walk.frames.push({
        t: performance.now(),
        x: Math.floor(w.sprite.x) - cam.scrollX,
        y: Math.floor(w.sprite.y) - cam.scrollY,
        px: p.x,
        py: p.y,
      });
    };
    f.game.events.on('postrender', window.__walkHook);
  });
  const centre = await farm.eval(() => {
    const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
    const cam = w.cameras.main;
    return { x: Math.floor(w.sprite.x) - cam.scrollX, y: Math.floor(w.sprite.y) - cam.scrollY };
  });
  const s0 = await farm.state();
  const L = await dock(farm.page);
  const home = L.stickHome;
  await farm.thumb.down(home.x, home.y);
  await farm.thumb.move(
    home.x + (axis === 'x' ? 12 : 0) * sign,
    home.y + (axis === 'y' ? 12 : 0) * sign,
  );
  await farm.thumb.move(
    home.x + (axis === 'x' ? 26 : 0) * sign,
    home.y + (axis === 'y' ? 26 : 0) * sign,
  );
  // Hold the drag until the farmer has walked WALK_PX (about 3.2 s), the finger down the whole time.
  const k = axis === 'x' ? 'x' : 'y';
  await farm
    .until(
      (s, f, a) => Math.abs(s.player[a.k] - a.v0) >= a.d,
      { k, v0: s0.player[k], d: WALK_PX },
      'the walk',
      9000,
    )
    .catch(() => undefined);
  const heldMs = await farm.eval(() => {
    const fr = window.__walk.frames;
    return fr.length ? fr[fr.length - 1].t - fr[0].t : 0;
  });
  await farm.thumb.up();
  const fr = await farm.eval(() => {
    window.__walk.on = false;
    return window.__walk.frames;
  });
  const walked = Math.abs((axis === 'x' ? fr.at(-1).px - fr[0].px : fr.at(-1).py - fr[0].py) || 0);
  // From 300 ms in (the camera has taken up its trail), every frame while the finger is down.
  const t0 = fr[0].t + 300;
  const off = fr
    .filter((f) => f.t >= t0)
    .map((f) => Math.max(Math.abs(f.x - centre.x), Math.abs(f.y - centre.y)));
  const worst = off.length ? Math.max(...off) : 999;
  check(
    `${tag}: a ${(heldMs / 1000).toFixed(1)} s stick walk (${walked.toFixed(0)} px) keeps the farmer within ${NEAR} px of centre`,
    walked >= WALK_PX - 8 && heldMs >= 3000 && worst <= NEAR,
    `walked ${walked.toFixed(0)} px, held ${heldMs.toFixed(0)} ms, worst ${worst} px off centre`,
  );
}

try {
  for (const profile of ['i13', 'se'])
    for (const hand of ['right', 'left']) {
      const farm = await openScenario(browser, url, 'joystick-walk', { profile, hand });
      const tag = `${profile} ${hand}`;
      await walk(farm, `${tag} farm east`, 'farm', 9, 22, 'x', 1);
      await walk(farm, `${tag} town south`, 'town', 12, 9, 'y', 1);
      check(
        `${tag}: no console errors`,
        farm.errors.length === 0,
        farm.errors.slice(0, 3).join(' | '),
      );
      await farm.ctx.close();
    }
} finally {
  await browser.close();
  stop();
}
if (result.failed) {
  console.error(`E2E JOYSTICK FAILED (${result.failed})`);
  process.exit(1);
}
console.log(`e2e joystick: ${result.passed} checks passed`);
