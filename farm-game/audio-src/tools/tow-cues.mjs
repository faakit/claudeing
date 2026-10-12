// When the tow cues really fire: plays the tow scenarios like a person (scripts/lib/tow.mjs) and logs every
// audio.play call with the tow phase at that frame, so the cue lengths can be checked against the verb (the gap
// from a tug to the next tug, from the freeing tug's water to the landing, and so on). Audio itself may stay
// locked in headless Chromium: only the calls are logged.
//
//   URL=http://localhost:5311/ CHROMIUM_PATH=... node audio-src/tools/tow-cues.mjs [OUT.json]
//   SCENARIOS=tow-lane-long,tow-spike-long STRATEGIES=action,chain,water,wait HANDS=right,left
import { writeFileSync } from 'node:fs';
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';
import { playTow } from '../../scripts/lib/tow.mjs';

const list = (v, d) => (v ?? d).split(',');
const scenarios = list(process.env.SCENARIOS, 'tow-lane-long,tow-spike-long');
const strategies = list(process.env.STRATEGIES, 'action,chain,water,wait');
const hands = list(process.env.HANDS, 'right,left');
const TOW = new Set(['logHook', 'logTug', 'logKnock', 'logLand', 'water', 'swing', 'till']);
const { url, stop } = await serve(Number(process.env.PORT ?? 4170));
const browser = await launch();
const runs = [];
let seed = 1;
try {
  for (const scenario of scenarios)
    for (const hand of hands)
      for (const strategy of strategies) {
        const farm = await openScenario(browser, url, scenario, { profile: 'i13', hand });
        await farm.eval(() => {
          const w = window.__farm;
          const log = (window.__cues = []);
          const play = w.audio.play.bind(w.audio);
          w.audio.play = (name) => {
            const t = w.dev.tow();
            log.push({
              t: performance.now(),
              name,
              phase: t?.phase,
              state: t?.state,
              tugs: t?.tugs,
            });
            return play(name);
          };
        });
        const r = await playTow(farm, { strategy, seed: 1000 + seed++ * 7919 });
        const cues = await farm.eval(() => window.__cues);
        const t0 = cues.find((c) => c.name === 'logHook')?.t ?? cues[0]?.t ?? 0;
        const seq = cues
          .filter((c) => TOW.has(c.name))
          .map((c) => ({ ...c, t: Math.round(c.t - t0) }));
        runs.push({ scenario, hand, strategy, status: r.status, ms: r.ms, seq });
        console.log(
          `${scenario} ${hand} ${strategy}: ${r.status} | ` +
            seq.map((c) => `${c.name}@${c.t}${c.phase ? `(${c.phase})` : ''}`).join(' '),
        );
        await farm.close();
      }
} finally {
  await browser.close();
  stop();
}
// gaps that matter for cue lengths
const gaps = { tugToTug: [], tugToLand: [], waterToLand: [], knockToTug: [], hookToKnock: [] };
for (const r of runs) {
  const s = r.seq;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1];
    const b = s[i];
    const d = b.t - a.t;
    if (a.name === 'logTug' && b.name === 'logTug') gaps.tugToTug.push(d);
    if (a.name === 'logTug' && b.name === 'logLand') gaps.tugToLand.push(d);
    if (a.name === 'water' && b.name === 'logLand') gaps.waterToLand.push(d);
    if (a.name === 'logKnock' && b.name === 'logTug') gaps.knockToTug.push(d);
    if (a.name === 'logHook' && b.name === 'logKnock') gaps.hookToKnock.push(d);
  }
}
for (const [k, v] of Object.entries(gaps))
  console.log(
    `${k}: n ${v.length}${v.length ? `, min ${Math.min(...v)} ms, median ${v.sort((x, y) => x - y)[v.length >> 1]} ms` : ''}`,
  );
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify({ runs, gaps }, null, 1));
