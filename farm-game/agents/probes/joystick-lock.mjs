// QA item "Travar o joystick quando puxar pra andar" (lock the joystick while dragging to walk): drive the floating
// stick like a thumb does and record, every frame, the stick's anchor and the direction the farmer is steered.
// Each gesture holds one intended direction from the moment the stick engages to the lift, so any frame steering
// elsewhere (another way, or stopped) is a misbehaviour.
//
//   URL=http://localhost:5281/ node agents/probes/joystick-lock.mjs
//   PROFILES=i13,se HANDS=right,left node agents/probes/joystick-lock.mjs     (dist/, needs npm run build)
//
// Scenario: joystick-walk.
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';

const profiles = (process.env.PROFILES ?? 'i13,se').split(',');
const hands = (process.env.HANDS ?? 'right,left').split(',');
const { url, stop } = await serve(Number(process.env.PORT ?? 4891));
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Move the finger along `pts(f)` (f 0..1) over `ms` at true speed. */
async function path(thumb, ms, pts) {
  const t0 = Date.now();
  for (;;) {
    const f = Math.min(1, (Date.now() - t0) / ms);
    const [x, y] = pts(f);
    await thumb.move(x, y);
    if (f >= 1) break;
    await sleep(8);
  }
}

// Every gesture starts at (x0, y0) in the open world and wants one direction throughout.
const GESTURES = {
  // Push hard (40 px), then relax the thumb back to 16 px out: a thumb's natural rest after the first push.
  'push-relax': {
    want: 'up',
    run: async (t, x0, y0) => {
      await path(t, 180, (f) => [x0, y0 - 40 * f]);
      await path(t, 400, () => [x0, y0 - 40]); // held there
      await path(t, 300, (f) => [x0, y0 - 40 + 24 * f]);
      await path(t, 700, () => [x0, y0 - 16]);
    },
  },
  // Drag right, then the pad rolls sideways about 2 mm either way while holding.
  'roll-side': {
    want: 'right',
    run: async (t, x0, y0) => {
      await path(t, 160, (f) => [x0 + 22 * f, y0]);
      await path(t, 1400, (f) => [x0 + 22, y0 + 11 * Math.sin(f * Math.PI * 4)]);
    },
  },
  // A long drag out (60 px), then the thumb slides back halfway while still meaning "keep going".
  'long-then-ease': {
    want: 'left',
    run: async (t, x0, y0) => {
      await path(t, 300, (f) => [x0 - 60 * f, y0]);
      await path(t, 300, () => [x0 - 60, y0]);
      await path(t, 400, (f) => [x0 - 60 + 34 * f, y0 + 4 * f]);
      await path(t, 600, () => [x0 - 26, y0 + 4]);
    },
  },
  // The thumb's arc: dragged down, the pad drifts sideways as it holds (a pivot at the thumb's base).
  'arc-drift': {
    want: 'down',
    run: async (t, x0, y0) => {
      await path(t, 200, (f) => [x0, y0 + 28 * f]);
      await path(t, 1200, (f) => [x0 + 16 * f, y0 + 28 - 6 * f]);
    },
  },
};

const rows = [];
try {
  for (const profile of profiles)
    for (const hand of hands) {
      const farm = await openScenario(browser, url, 'joystick-walk', { profile, hand });
      for (const [name, g] of Object.entries(GESTURES)) {
        await farm.load('joystick-walk');
        await farm.idle();
        await farm.eval(() => {
          const f = window.__farm;
          window.__js = { frames: [], on: true };
          window.__jsHook ??= () => {
            if (!window.__js.on) return;
            const js = f.game.scene.getScene('UI').joystick;
            window.__js.frames.push({
              dir: f.inputHub.direction,
              ox: Math.round(js.origin.x),
              oy: Math.round(js.origin.y),
              engaged: js.engaged,
            });
          };
          f.game.events.off('postrender', window.__jsHook);
          f.game.events.on('postrender', window.__jsHook);
        });
        const x0 = 100;
        const y0 = 230;
        await farm.thumb.down(x0, y0);
        await g.run(farm.thumb, x0, y0);
        await farm.thumb.up();
        await farm.frames(2);
        const frames = await farm.eval(() => {
          window.__js.on = false;
          return window.__js.frames;
        });
        const live = frames.filter((f) => f.engaged);
        const first = live.findIndex((f) => f.dir === g.want);
        const after = first < 0 ? [] : live.slice(first);
        const wrong = after.filter((f) => f.dir !== g.want);
        const anchors = new Set(live.map((f) => `${f.ox},${f.oy}`));
        let changes = 0;
        for (let i = 1; i < after.length; i++) if (after[i].dir !== after[i - 1].dir) changes++;
        const row = {
          profile,
          hand,
          gesture: name,
          want: g.want,
          frames: after.length,
          wrong: wrong.length,
          wrongDirs: [...new Set(wrong.map((f) => f.dir ?? 'stop'))].join('/'),
          changes,
          anchorMoves: anchors.size - 1,
        };
        rows.push(row);
        console.log(JSON.stringify(row));
      }
      if (farm.errors.length) console.log('console errors:', farm.errors);
      await farm.close();
    }
} finally {
  await browser.close();
  stop();
}
const bad = rows.filter((r) => r.wrong > 0);
console.log(
  `\n${rows.length - bad.length}/${rows.length} gestures steered one way from engage to lift`,
);
