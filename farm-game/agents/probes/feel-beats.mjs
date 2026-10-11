// Feel probe for the restoration beats: frame strips of a work day at the Old Spring (Interact at the site) and of
// the reveals (the first green, the creek's first morning), plus draws and JS while each plays.
//
//   URL=http://localhost:5331/ node agents/probes/feel-beats.mjs [work|work3|funded|reveal|creek|opened]
//
// Strips go to agents/out/feel/beats (SHOTS=<dir> to change). Cite the scenario names.
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';

const what = process.argv[2] ?? 'work';
const profile = process.env.PROFILE ?? 'i13';
const dir = process.env.SHOTS ?? 'agents/out/feel/beats';
const every = Number(process.env.EVERY ?? 6);
const count = Number(process.env.COUNT ?? 36);
const SCEN = {
  work: 'spring-site-work',
  work3: 'spring-site-work-3',
  funded: 'spring-site-funded',
  reveal: 'valley-farm-green-reveal',
  creek: 'farm-creek-first-morning',
  opened: 'spring-opened',
};
const { url, stop } = await serve(Number(process.env.PORT ?? 4897));
const browser = await launch();
try {
  const farm = await openScenario(browser, url, SCEN[what], { profile });
  const tag = `${what}-${profile}`;
  if (what.startsWith('work') || what === 'funded') {
    await farm.frames(10);
    await farm.eval(() => window.__farm.dev.loop.pause());
    await farm.page.keyboard.down('KeyE');
    await farm.eval(() => window.__farm.dev.loop.step(2));
    await farm.page.keyboard.up('KeyE');
    await farm.eval(() => window.__farm.dev.loop.resume());
  } else if (what === 'reveal' || what === 'creek') {
    // load again frozen from its first frame
    await farm.load(SCEN[what]);
  }
  await farm.strip(tag, count, every, dir);
  console.log(
    'stats',
    JSON.stringify(await farm.eval(() => window.__farm.dev.frameStats())),
    'errors',
    farm.errors.length ? farm.errors : 'none',
  );
  await farm.close();
} finally {
  await browser.close();
  stop();
}
