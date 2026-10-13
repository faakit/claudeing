// QA item "Travar o joystick quando puxar pra andar" (lock the joystick when dragging to walk), and the critic's review
// C2-1 (a turn after a firm push): drive the floating stick like a thumb does and record, every frame, the direction
// the farmer is steered.
//
// - Hold gestures want one direction from the moment the stick engages to the lift: any frame steering elsewhere
//   (another way, or stopped) is a misbehaviour.
// - Turn gestures set a direction, then mean another: they report the finger travel (px) until the stick turns,
//   against the base game's numbers (a turn after a firm push within about 32 px, a reverse within about 35).
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

/** Move the finger along `pts(f)` (f 0..1) over `ms` at true speed (a still `pts` is a held finger). */
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

// Hold gestures: one direction throughout. An ease-back is 24 px (a thumb relaxing after its push); about 34 px back
// is the critic's reverse and turns the walk by design.
const HOLDS = {
  'push-relax': {
    want: 'up',
    run: async (t, x0, y0) => {
      await path(t, 180, (f) => [x0, y0 - 40 * f]);
      await path(t, 400, () => [x0, y0 - 40]);
      await path(t, 300, (f) => [x0, y0 - 40 + 24 * f]);
      await path(t, 700, () => [x0, y0 - 16]);
    },
  },
  'roll-side': {
    want: 'right',
    run: async (t, x0, y0) => {
      await path(t, 160, (f) => [x0 + 22 * f, y0]);
      await path(t, 1400, (f) => [x0 + 22, y0 + 11 * Math.sin(f * Math.PI * 4)]);
    },
  },
  'long-then-ease': {
    want: 'left',
    run: async (t, x0, y0) => {
      await path(t, 300, (f) => [x0 - 60 * f, y0]);
      await path(t, 300, () => [x0 - 60, y0]);
      await path(t, 400, (f) => [x0 - 60 + 24 * f, y0 + 4 * f]);
      await path(t, 600, () => [x0 - 36, y0 + 4]);
    },
  },
  'arc-drift': {
    want: 'down',
    run: async (t, x0, y0) => {
      await path(t, 200, (f) => [x0, y0 + 28 * f]);
      await path(t, 1200, (f) => [x0 + 16 * f, y0 + 28 - 6 * f]);
    },
  },
};

// Turn gestures (the critic's, qa-critique/probes/stick-turn.mjs): `a` is set first, then `mark()`, then the thumb
// means `b`. `max` is the bar in finger px.
const TURNS = {
  'turn-after-strong-push': {
    a: 'up',
    b: 'left',
    max: 32,
    run: async (t, x, y, mark) => {
      await path(t, 200, (f) => [x, y - 50 * f]);
      await path(t, 400, () => [x, y - 50]);
      await mark();
      await path(t, 900, (f) => [x - 60 * f, y - 50]);
      await path(t, 300, () => [x - 60, y - 50]);
    },
  },
  'turn-after-light-push': {
    a: 'up',
    b: 'left',
    max: 32,
    run: async (t, x, y, mark) => {
      await path(t, 150, (f) => [x, y - 22 * f]);
      await path(t, 400, () => [x, y - 22]);
      await mark();
      await path(t, 900, (f) => [x - 45 * f, y - 22]);
      await path(t, 300, () => [x - 45, y - 22]);
    },
  },
  'turn-arc-diagonal': {
    a: 'right',
    b: 'down',
    max: 32,
    run: async (t, x, y, mark) => {
      await path(t, 200, (f) => [x + 35 * f, y]);
      await path(t, 300, () => [x + 35, y]);
      await mark();
      await path(t, 900, (f) => [x + 35 - 20 * f, y + 45 * f]);
      await path(t, 300, () => [x + 15, y + 45]);
    },
  },
  'reverse-after-push': {
    a: 'up',
    b: 'down',
    max: 35,
    run: async (t, x, y, mark) => {
      await path(t, 200, (f) => [x, y - 40 * f]);
      await path(t, 300, () => [x, y - 40]);
      await mark();
      await path(t, 700, (f) => [x, y - 40 + 70 * f]);
      await path(t, 300, () => [x, y + 30]);
    },
  },
};

async function record(farm, hand, run) {
  await farm.load('joystick-walk');
  await farm.idle();
  await farm.eval(() => {
    const f = window.__farm;
    window.__js = { frames: [], on: true, mark: -1 };
    window.__jsHook ??= () => {
      if (!window.__js.on) return;
      const js = f.game.scene.getScene('UI').joystick;
      const p = f.game.input.activePointer;
      window.__js.frames.push({
        dir: f.inputHub.direction,
        engaged: js.engaged,
        px: Math.round(p.x),
        py: Math.round(p.y),
      });
    };
    f.game.events.off('postrender', window.__jsHook);
    f.game.events.on('postrender', window.__jsHook);
  });
  const x0 = hand === 'left' ? 110 : 100;
  const y0 = 230;
  await farm.thumb.down(x0, y0);
  const mark = () =>
    farm.eval(() => {
      window.__js.mark = window.__js.frames.length;
    });
  await run(farm.thumb, x0, y0, mark);
  await farm.thumb.up();
  await farm.frames(2);
  return farm.eval(() => {
    window.__js.on = false;
    return { frames: window.__js.frames, mark: window.__js.mark };
  });
}

let bad = 0;
let total = 0;
try {
  for (const profile of profiles)
    for (const hand of hands) {
      const farm = await openScenario(browser, url, 'joystick-walk', { profile, hand });
      for (const [name, g] of Object.entries(HOLDS)) {
        const { frames } = await record(farm, hand, g.run);
        const live = frames.filter((f) => f.engaged);
        const first = live.findIndex((f) => f.dir === g.want);
        const after = first < 0 ? [] : live.slice(first);
        const wrong = after.filter((f) => f.dir !== g.want);
        const ok = first >= 0 && wrong.length === 0;
        total++;
        if (!ok) bad++;
        console.log(
          JSON.stringify({
            profile,
            hand,
            gesture: name,
            want: g.want,
            ok,
            frames: after.length,
            wrong: wrong.length,
            wrongDirs: [...new Set(wrong.map((f) => f.dir ?? 'stop'))].join('/'),
          }),
        );
      }
      for (const [name, g] of Object.entries(TURNS)) {
        const { frames, mark } = await record(farm, hand, g.run);
        const before = frames.slice(0, mark);
        const after = frames.slice(mark);
        const i = after.findIndex((f) => f.dir === g.b);
        const start = after[0];
        const at = i < 0 ? null : after[i];
        const px = at && start ? Math.round(Math.hypot(at.px - start.px, at.py - start.py)) : null;
        const stops = after.slice(0, i < 0 ? after.length : i).filter((f) => f.dir == null).length;
        const ok = before.some((f) => f.dir === g.a) && px !== null && px <= g.max;
        total++;
        if (!ok) bad++;
        console.log(
          JSON.stringify({
            profile,
            hand,
            gesture: name,
            ok,
            fingerPxToTurn: px,
            max: g.max,
            stops,
          }),
        );
      }
      if (farm.errors.length) console.log('console errors:', farm.errors);
      await farm.close();
    }
} finally {
  await browser.close();
  stop();
}
console.log(`\n${total - bad}/${total} gestures within their bars`);
