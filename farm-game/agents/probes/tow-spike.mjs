// The towing spike by real touches (scenario tow-spike): tap the log, tap the slip, tug when it snags (a tap on the
// log, or Action with TUG=action), and wait for the landing. Prints taps, time from the first tap to the landing,
// and the most draws and JS ms while towing; shots and a strip of the snag and landing.
//
//   URL=http://localhost:5331/ PROFILE=se HAND=left node agents/probes/tow-spike.mjs
//   SCENARIO=tow-spike-long TUG=action ...
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';

const scenario = process.env.SCENARIO ?? 'tow-spike';
const profile = process.env.PROFILE ?? 'i13';
const hand = process.env.HAND ?? 'right';
const dir = process.env.SHOTS ?? 'agents/out/feel/tow';
const { url, stop } = await serve(Number(process.env.PORT ?? 4896));
const browser = await launch();
try {
  const farm = await openScenario(browser, url, scenario, { profile, hand });
  const tag = `${scenario}-${profile}-${hand}`;
  const tow = () => farm.eval(() => window.__farm.dev.tow());
  await farm.frames(10);
  await farm.shot(`${tag}-0-start`, dir);
  // draws and JS while the spike runs, sampled every frame in the page until landed
  const meter = farm
    .eval(async () => {
      const d = window.__farm.dev;
      let draws = 0;
      let js = 0;
      let gap = 0;
      for (let i = 0; i < 60 * 40; i++) {
        await d.wait.frames(1);
        const t = d.tow();
        if (t?.phase === 'towing') {
          const s = d.frameStats();
          draws = Math.max(draws, s.draws);
          js = Math.max(js, s.jsMs);
          gap = Math.max(gap, s.frameMs);
        }
        if (t?.landed) break;
      }
      return { draws, js, gap };
    })
    .catch((e) => ({ meterError: String(e).slice(0, 80) }));
  const t0 = Date.now();
  let t = await tow();
  await farm.tapTile(Math.floor(t.log.x / 16), Math.floor(t.log.y / 16));
  await farm.until((_s, w) => w.dev.tow()?.phase === 'towing', null, 'hooked', 15000);
  await farm.shot(`${tag}-1-hooked`, dir);
  await farm.tapTile(13, 28); // the slip
  const what = await farm.until(
    (_s, w) => {
      const x = w.dev.tow();
      return x?.log.snagged ? 'snagged' : x?.landed ? 'landed' : null;
    },
    null,
    'snag or landing',
    20000,
  );
  if (what === 'snagged') {
    await farm.idle();
    await farm.shot(`${tag}-2-snagged`, dir);
    const tugs = scenario.includes('long') ? 2 : 1;
    for (let i = 0; i < tugs; i++) {
      t = await tow();
      if (process.env.TUG === 'action') await farm.tapButton('ACTION');
      else await farm.tapTile(Math.floor(t.log.x / 16), Math.floor(t.log.y / 16));
      await farm.frames(12);
    }
    await farm.strip(`${tag}-3-tug`, 8, 3, dir);
  }
  await farm.until((_s, w) => w.dev.tow()?.landed > 0, null, 'landed', 20000);
  await farm.strip(`${tag}-4-land`, 8, 3, dir);
  t = await tow();
  const m = await meter;
  console.log(
    JSON.stringify({
      tag,
      taps: t.taps,
      actions: t.actions,
      tugs: t.tugs,
      firstToLandMs: t.ms,
      wallMs: Date.now() - t0,
      ...m,
    }),
  );
  console.log('errors', farm.errors.length ? farm.errors : 'none');
  await farm.close();
} finally {
  await browser.close();
  stop();
}
