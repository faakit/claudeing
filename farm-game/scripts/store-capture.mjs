// Google Play store screenshots and promo-video frames, captured from real gameplay in scenarios.
// Not part of any gate: run by hand after `npm run build`.
//
//   node scripts/store-capture.mjs shots [en|pt-BR|all] [moment ...]
//   node scripts/store-capture.mjs video [en|pt-BR] [moment ...]
//   node scripts/store-capture.mjs audio <options.json> <out.wav>   (the game's real mix, rendered offline)
//   node scripts/store-capture.mjs wide <scenario> <map> <tx> <ty>   (a 1023x500 view at 3x for the feature graphic)
//
// The game is a fixed 200x400 canvas. Shots and video frames use a 200x400 CSS viewport at DPR 4, so every game
// pixel is exactly 4x4 device pixels (800x1600); art-src/tools/store_art.py then sets them into the 1080x1920
// (9:16) store frame with a caption band. The DEV tab is hidden. Everything is written outside the repo, under
// $STORE_OUT (default C:/Users/andre/dev/tiny-acre/marketing): raw/<locale>/<moment>.png and
// video/frames/<moment>/<n>.png. Video frames are stepped with the dev loop (2 game frames per video frame, 30 fps),
// so they are exact and repeatable, never a screen recording.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, openScenario, serve } from './lib/farm.mjs';

const OUT = process.env.STORE_OUT ?? 'C:/Users/andre/dev/tiny-acre/marketing';
const PORT = Number(process.env.STORE_PORT ?? 3700);
const PHONE = {
  id: 'store',
  name: 'store 1:2 at 4x',
  w: 200,
  h: 400,
  dpr: 4,
  ppi: 460,
  chin: 0,
  insets: { top: 0, left: 0, bottom: 0, right: 0 },
};
const HIDE_DEV = '.tadev-tab,.tadev-sheet,.tadev-overlay{display:none!important}';

async function open(browser, url, scenario, lang, profile = PHONE) {
  const farm = await openScenario(browser, url, scenario, { profile, query: `&lang=${lang}` });
  await farm.page.addStyleTag({ content: HIDE_DEV });
  await farm.eval(() => window.__farm.dev.seed(7));
  return farm;
}

/** Run n game frames (the loop paused), 16.7 ms each. */
const step = (farm, n) => farm.eval((k) => window.__farm.dev.loop.step(k), n);
const pause = (farm) => farm.eval(() => window.__farm.dev.loop.pause());
/** Move the player (the loop runs while the scene restarts, then pauses again). */
async function goto(farm, ...at) {
  await farm.eval(() => window.__farm.dev.loop.resume());
  await farm.eval((a) => window.__farm.dev.goto(...a), at);
  await pause(farm);
}
const tow = (farm) => farm.eval(() => window.__farm.dev.tow());
/** The fishing sheet's phase and reel, read off the live panel. */
const fishing = (farm) =>
  farm.eval(() => {
    for (const sc of window.__farm.game.scene.getScenes(true))
      for (const v of Object.values(sc))
        if (v && typeof v === 'object' && 'reel' in v && 'phase' in v && 'fishId' in v)
          return { phase: v.phase, reel: { ...v.reel } };
    return null;
  });

/**
 * Each moment: the scenario, then `drive(farm, t)` brings the game to the shot through the timeline `t`
 * (t.frame() is one video frame, 2 game frames). Drives run with the loop paused, so the same inputs always give
 * the same frames. The still is taken at `shotAt` (a video frame index), at the drive's t.mark(), or at its end.
 */
const MOMENTS = {
  // Rosa's letter on the title, a first launch.
  letter: {
    scenario: 'title-first-launch',
    shotAt: 60,
    async drive(_farm, t) {
      await t.hold(90);
    },
  },
  // The straw farm turning green as the farmer steps out (the dissolve, FIRST GREEN).
  green: {
    scenario: 'valley-farm-green-reveal',
    shotAt: 22,
    async drive(_farm, t) {
      await t.hold(120);
    },
  },
  // A full summer field: a swing of the scythe through the ripe tomatoes.
  field: {
    scenario: 'store-full-field',
    shotAt: 30,
    async drive(farm, t) {
      await goto(farm, 'farm', 13, 18, 'left');
      await t.hold(20);
      await t.press(6);
      await t.hold(70);
    },
  },
  // Towing a log down the restored river: hook it, walk it home, tug it off the snag.
  tow: {
    scenario: 'tow-first-log',
    async drive(farm, t) {
      await t.hold(10);
      let lastPress = -99;
      for (let i = 0; i < 900; i++) {
        const m = await tow(farm);
        if (!m || m.landed) break;
        // Action does what the tow needs next (hook, home, tug), as a one-thumb player presses it.
        const walking = m.phase === 'hooking' || (m.goal && !m.log.snagged);
        // a reaction between presses (a press the game has not acted on yet must not be repeated)
        if (!walking && ['hook', 'home', 'tug'].includes(m.verb) && t.count - lastPress > 14) {
          lastPress = t.count;
          await t.press(2);
        } else await t.frame();
        // the still: the log hooked and on its way, past the reed bed
        if (m.log.hooked && m.log.y > m.spawn.ty * 16 + 56) t.mark();
        if (t.marked && t.sinceMark() > 60) break;
      }
    },
  },
  // The town the morning the weir opened: the river home, the Heron afloat.
  town: {
    scenario: 'weir-opened-town',
    shotAt: 70,
    async drive(farm, t) {
      await goto(farm, 'town', 14, 28, 'up');
      await t.hold(100);
    },
  },
  // The river's first morning: the dry town dissolves into the river town under THE RIVER IS BACK.
  river: {
    scenario: 'river-first-morning',
    shotAt: 20,
    async drive(_farm, t) {
      await t.hold(120);
    },
  },
  // Senna's homecoming: stepping into town the morning after her house was finished.
  senna: {
    scenario: 'marls-arrive',
    shotAt: 80,
    async drive(farm, t) {
      await goto(farm, 'town', 14, 6, 'right');
      await t.hold(120);
    },
  },
  // Fishing the pond on a summer evening: the cast, the bite, the reel.
  fishing: {
    scenario: 'store-fishing',
    async drive(farm, t) {
      await t.hold(12);
      await t.press(4);
      for (let i = 0; i < 400 && (await fishing(farm))?.phase !== 'bite'; i++) await t.frame();
      await t.hold(6);
      // the reel as a player plays it: hold while the bar sits under the fish, let go when it is over it
      let down = false;
      for (let i = 0; i < 400; i++) {
        const f = await fishing(farm);
        if (!f || (f.phase !== 'reel' && i > 4)) break;
        const r = f.reel;
        const want = i < 4 || r.bar + r.size / 2 + r.barVel * 0.3 < r.fish;
        if (want !== down) {
          down = want;
          if (down) await farm.page.keyboard.down('Space');
          else await farm.page.keyboard.up('Space');
        }
        await t.frame();
        if (i === 40) t.mark();
      }
      await farm.page.keyboard.up('Space');
      await t.hold(45);
    },
  },
};

/** A timeline over a paused game: each frame steps 2 game frames, then the hook runs (save a PNG, take the still). */
function timeline(farm, onFrame) {
  let n = 0;
  let markAt = -1;
  const t = {
    get count() {
      return n;
    },
    get marked() {
      return markAt >= 0;
    },
    mark() {
      if (markAt < 0) markAt = n;
    },
    sinceMark: () => n - markAt,
    async frame() {
      await step(farm, 2);
      await onFrame(n, t);
      n++;
    },
    async hold(frames) {
      for (let i = 0; i < frames; i++) await t.frame();
    },
    /** Hold Space for `frames` video frames, as a short real press. */
    async press(frames = 3) {
      await farm.page.keyboard.down('Space');
      await t.hold(frames);
      await farm.page.keyboard.up('Space');
    },
  };
  return t;
}

const [mode = 'shots', which = 'all', ...names] = process.argv.slice(2);
const locales = which === 'all' ? ['en', 'pt-BR'] : [which];
const picked = names.length ? names : Object.keys(MOMENTS);

const { url, stop } = await serve(PORT);
const browser = await launch();
const problems = [];
try {
  if (mode === 'shots' || mode === 'video') {
    for (const lang of mode === 'video' ? locales.slice(0, 1) : locales) {
      for (const name of picked) {
        const m = MOMENTS[name];
        if (!m) throw new Error(`no moment "${name}" (have ${Object.keys(MOMENTS).join(', ')})`);
        const farm = await open(browser, url, m.scenario, lang);
        await pause(farm);
        const shotDir = join(OUT, 'raw', lang);
        const vidDir = join(OUT, 'video', 'frames', name);
        mkdirSync(shotDir, { recursive: true });
        if (mode === 'video') {
          rmSync(vidDir, { recursive: true, force: true });
          mkdirSync(vidDir, { recursive: true });
        }
        let taken = false;
        const take = async () => {
          if (taken) return;
          taken = true;
          await farm.shot(name, shotDir);
        };
        const t = timeline(farm, async (n, tl) => {
          if (mode === 'video')
            await farm.page.screenshot({ path: join(vidDir, `${String(n).padStart(4, '0')}.png`) });
          else if (n === m.shotAt || (m.shotAt === undefined && tl.marked && tl.sinceMark() === 0))
            await take();
        });
        await m.drive(farm, t);
        if (mode === 'shots') await take();
        else
          writeFileSync(join(vidDir, 'frames.json'), JSON.stringify({ frames: t.count, fps: 30 }));
        if (farm.errors.length) problems.push(`${lang} ${name}: ${farm.errors.join(' | ')}`);
        console.log(`${mode} ${lang} ${name}: ${t.count} frames`);
        await farm.close();
      }
    }
  } else if (mode === 'wide') {
    // The town in a wide view for the feature graphic: the canvas widened, the world camera over the river, the
    // HUD and controls hidden. Arguments: tile x and y to centre on (default 15 27).
    // STORE_VIEW=cssW,cssH,gameW,gameH,zoom,dpr picks another view (default: 1023x500 at 3x)
    const [cw, ch, gw, gh, zoom, dpr] = (process.env.STORE_VIEW ?? '1024,530,341,167,3,1')
      .split(',')
      .map(Number);
    const wide = { ...PHONE, w: cw, h: ch, dpr };
    const [map, tx, ty] = names.length
      ? [names[0], Number(names[1]), Number(names[2])]
      : ['town', 15, 27];
    const farm = await open(browser, url, which === 'all' ? 'weir-opened-town' : which, 'en', wide);
    await goto(farm, map, tx, ty, 'down');
    await farm.eval(
      (v) => {
        const g = window.__farm.game;
        g.scale.setGameSize(v.gw, v.gh);
        g.scale.setZoom(v.zoom);
        const ui = g.scene.getScene('UI');
        if (ui) ui.sys.setVisible(false);
        const world = g.scene.getScenes(true).find((s) => 'tilemap' in s && s.tilemap);
        world.cameras.main.setViewport(0, 0, v.gw, v.gh);
        const c = g.canvas;
        c.style.left = '0px';
        c.style.top = '0px';
      },
      { gw, gh, zoom },
    );
    await step(farm, 30);
    const dir = join(OUT, 'raw', 'wide');
    mkdirSync(dir, { recursive: true });
    await farm.page.screenshot({
      path: join(dir, `${gw > gh ? 'wide' : 'tall'}-${farm.scenario}-${map}-${tx}-${ty}.png`),
      clip: { x: 0, y: 0, width: gw * zoom, height: gh * zoom },
    });
    if (farm.errors.length) problems.push(`wide: ${farm.errors.join(' | ')}`);
    await farm.close();
  } else if (mode === 'audio') {
    // The video's soundtrack: the game's own music, sfx and ambience code, rendered offline (src/audio/render.ts)
    // with the options in the JSON file (cues timed to the cut). Written as 16-bit stereo WAV.
    const [optsFile, wavFile] = [which, names[0]];
    const page = await browser.newPage();
    await page.goto(`${url}?debug`);
    await page.waitForFunction(() => window.__farm?.audio, null, { timeout: 30000 });
    const o = JSON.parse(readFileSync(optsFile, 'utf8'));
    const res = await page.evaluate((opts) => window.__farm.audio.renderOffline(opts), o);
    const data = Buffer.from(res.pcm16, 'base64');
    const h = Buffer.alloc(44);
    h.write('RIFF', 0);
    h.writeUInt32LE(36 + data.length, 4);
    h.write('WAVEfmt ', 8);
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20);
    h.writeUInt16LE(2, 22);
    h.writeUInt32LE(res.sampleRate, 24);
    h.writeUInt32LE(res.sampleRate * 4, 28);
    h.writeUInt16LE(4, 32);
    h.writeUInt16LE(16, 34);
    h.write('data', 36);
    h.writeUInt32LE(data.length, 40);
    writeFileSync(wavFile, Buffer.concat([h, data]));
    console.log(`audio ${wavFile}: ${o.seconds} s, ${res.realtimeRatio.toFixed(1)}x realtime`);
    await page.close();
  } else throw new Error(`unknown mode "${mode}" (shots, video, audio, wide)`);
} finally {
  await browser.close();
  stop();
}
if (problems.length) {
  console.log(`console errors:\n${problems.join('\n')}`);
  process.exit(1);
}
