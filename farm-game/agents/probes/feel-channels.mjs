// Feel probe for the channels' juice (fx/ChannelFx.ts): frame strips of a painted dig from the creek's bank, the
// water running into the cut, and the morning's run down the ditch; draws and JS ms while each plays.
//
//   URL=http://localhost:5331/ node agents/probes/feel-channels.mjs [dig|morning|all]
//   PROFILE=se HAND=left ...
//
// Strips go to agents/out/feel/channels (SHOTS=<dir> to change). Cite the scenario names.
import { launch, liveTargets, openScenario, serve } from '../../scripts/lib/farm.mjs';

const what = process.argv[2] ?? 'all';
const profile = process.env.PROFILE ?? 'i13';
const hand = process.env.HAND ?? 'right';
const dir = process.env.SHOTS ?? 'agents/out/feel/channels';
const { url, stop } = await serve(Number(process.env.PORT ?? 4895));
const browser = await launch();

/** Max draws and JS ms over the next `n` frames. */
async function meter(farm, n) {
  return farm.eval(async (n) => {
    const d = window.__farm.dev;
    let draws = 0;
    let js = 0;
    for (let i = 0; i < n; i++) {
      await d.wait.frames(1);
      const s = d.frameStats();
      draws = Math.max(draws, s.draws);
      js = Math.max(js, s.jsMs);
    }
    return { draws, js };
  }, n);
}

try {
  if (what === 'dig' || what === 'all') {
    const farm = await openScenario(browser, url, 'channels-first-dig', { profile, hand });
    const tag = `dig-${profile}-${hand}`;
    const action = (await liveTargets(farm.page)).find((t) => t.text === 'ACTION');
    await farm.frames(10);
    console.log('idle', JSON.stringify(await meter(farm, 30)));
    await farm.thumb.down(action.cx, action.cy);
    await farm.until((_s, w) => w.game.scene.getScene('UI').actionPress?.armed, null, 'arm');
    const sx = hand === 'left' ? 1 : -1;
    // westward from the bank: a right hand drags left; a left hand rests at the left edge (edge hold)
    for (let i = 1; i <= 6; i++) {
      await farm.thumb.move(action.cx - i * 14, action.cy);
      await farm.frames(3);
    }
    void sx;
    const m = meter(farm, 90);
    await farm.thumb.up();
    // the first cut: a strip of every 2nd frame from the lift
    await farm.strip(`${tag}`, 24, 2, dir);
    console.log('dig', JSON.stringify(await m));
    await farm.until(
      (_s, w) => {
        const sc = w.game.scene.getScene('Farm');
        return sc.work === null && sc.route === null;
      },
      null,
      'row dug',
      20000,
    );
    await farm.shot(`${tag}-done`, dir);
    console.log('errors', farm.errors);
    await farm.close();
  }
  if (what === 'morning' || what === 'all') {
    const farm = await openScenario(browser, url, 'channels-row', { profile, hand });
    const tag = `morning-${profile}-${hand}`;
    // load it again (a new state, so the run plays again) and catch the run from the map's first frames
    await farm.load('channels-row');
    await farm.strip(`${tag}`, 30, 3, dir);
    console.log('run', JSON.stringify(await meter(farm, 60)));
    await farm.shot(`${tag}-done`, dir);
    console.log('errors', farm.errors);
    await farm.close();
  }
} finally {
  await browser.close();
  stop();
}
