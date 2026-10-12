// Towing (M7 spike) played like a person, against the critic's bar (scripts/lib/tow.mjs): every run lands with tap
// scatter, under 20 s, at most 6 inputs, at most 7 draws while towing, no tap in the 'hard' thumb zone, none ignored,
// no stall, and no frame over 33 ms (game JS from PRE_STEP to POST_RENDER, and the rAF gap) while towing. Prints
// one line per run and a summary; non-zero exit when a run misses the bar. Run the 4x pass on a quiet machine.
//
//   URL=http://localhost:5331/ node agents/probes/tow-spike.mjs                       (dev server; else a preview)
//   SCENARIOS=tow-lane-long PROFILES=i13,se HANDS=right,left STRATEGIES=wait,chain,water,action RUNS=2 THROTTLE=4
//   SHOTS=agents/out/feel/tow STRIP=1  a frame strip of the snag per run
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';
import { playTow, towBar } from '../../scripts/lib/tow.mjs';

const list = (v, d) => (v ?? d).split(',');
const scenarios = list(process.env.SCENARIOS, 'tow-spike,tow-spike-long,tow-lane-long');
const profiles = list(process.env.PROFILES, 'i13,se');
const hands = list(process.env.HANDS, 'right,left');
const strategies = list(process.env.STRATEGIES, 'wait,chain,water,action');
const runs = Number(process.env.RUNS ?? 1);
const throttle = Number(process.env.THROTTLE ?? 1);
const dir = process.env.SHOTS ?? 'agents/out/feel/tow';
const { url, stop } = await serve(Number(process.env.PORT ?? 4896));
const browser = await launch();
let seed = Number(process.env.SEED ?? 1);
let failed = 0;
let total = 0;
const worst = { ms: 0, inputs: 0, draws: 0, jsMax: 0, gapMax: 0, over33: 0, jsOver33: 0 };
try {
  for (const scenario of scenarios)
    for (const profile of profiles)
      for (const hand of hands)
        for (const strategy of strategies)
          for (let run = 0; run < runs; run++) {
            const farm = await openScenario(browser, url, scenario, { profile, hand });
            if (throttle !== 1)
              await farm.cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
            const tag = `${scenario} ${profile} ${hand} ${strategy} #${run}`;
            if (process.env.STRIP) {
              // the snag, frame-exact (the engine is paused while the strip is taken)
              void farm
                .until((_s, w) => w.dev.tow()?.log.snagged, null, 'the snag', 30000)
                .then(() => farm.strip(`${tag.replace(/[ #]/g, '-')}-snag`, 6, 4, dir))
                .catch(() => {});
            }
            const r = await playTow(farm, { strategy, seed: 1000 + seed++ * 7919 });
            const bad = towBar(r);
            const jsOver = r.jsMax > 33 ? 1 : 0;
            if (throttle > 1 && (r.over33 || jsOver)) bad.push(`frames over 33 ms: ${r.over33}`);
            total++;
            if (bad.length) failed++;
            worst.ms = Math.max(worst.ms, r.ms ?? Infinity);
            worst.inputs = Math.max(worst.inputs, r.inputs);
            worst.draws = Math.max(worst.draws, r.draws);
            worst.jsMax = Math.max(worst.jsMax, r.jsMax);
            worst.gapMax = Math.max(worst.gapMax, r.gapMax);
            worst.over33 += r.over33;
            worst.jsOver33 += jsOver;
            console.log(
              `${bad.length ? 'MISS' : 'ok  '} ${tag}: ${r.status}, ${r.inputs} inputs, ` +
                `${r.ms === null ? '-' : (r.ms / 1000).toFixed(1)} s, lane ${r.laneTiles} tiles, draws ${r.draws}, ` +
                `js p95 ${r.jsP95} max ${r.jsMax}, gap max ${r.gapMax} (>33: ${r.over33}), stalls ${r.stalls}, ` +
                `silent ${r.silent} | ${r.zones}${bad.length ? ` | ${bad.join('; ')}` : ''}` +
                (farm.errors.length ? ` | errors: ${farm.errors.slice(0, 2).join(' | ')}` : ''),
            );
            await farm.close();
          }
} finally {
  await browser.close();
  stop();
}
console.log(
  `\n${total - failed}/${total} runs met the bar at ${throttle}x CPU. Worst: ${(worst.ms / 1000).toFixed(1)} s, ` +
    `${worst.inputs} inputs, ${worst.draws} draws, JS max ${worst.jsMax.toFixed(1)} ms ` +
    `(${worst.jsOver33} runs over 33), rAF gap max ${worst.gapMax.toFixed(1)} ms (${worst.over33} frames over 33)`,
);
process.exit(failed ? 1 : 0);
