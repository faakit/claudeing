// The quality gate, run in parallel where it is safe, within a budget of browser pages so the machine stays usable.
//
//   npm run verify          everything, before a merge or a release: lint, typecheck, unit tests, build, bundle and
//                           lab-map checks, then every browser suite (e2e, mobile, analytics, scenarios, onboarding),
//                           then the timing suites each with nothing beside them: controls; feel and joystick; perf at
//                           1x, 4x and 6x CPU throttle.
//   npm run verify:changed  for a commit: lint, typecheck, unit tests, build, bundle and lab-map checks, the scenario
//                           smoke, and only the browser suites (and scenario blocks) that cover the files changed
//                           since the merge base (scripts/lib/select.mjs). `--base=<ref>` or VERIFY_BASE picks the
//                           base (default: the branch's upstream, else origin/main).
//   npm run verify:fast     lint, typecheck, unit tests, build, bundle and lab-map checks, the scenario smoke.
//   npm run verify:serial   the old one-after-another chain (for comparison).
//
// Load: one static server of dist/ serves every suite (port VERIFY_PORT, default E2E_PORT, else 4173), and one Chromium
// serves every suite that runs beside others (each suite opens its own browser contexts in it); the timing suites
// (controls, feel, joystick, perf) and a retry alone get a Chromium of their own, as before.
// VERIFY_SHARED_BROWSER=0 gives every suite its own Chromium again. VERIFY_PAGES (default: half the logical cores,
// 2 to 8) caps the game pages open at once across all suites, and a suite's own parallelism is cut to fit it;
// VERIFY_JOBS (default: a quarter of the logical cores, 1 to 4) caps the jobs. Raise both on a big idle machine,
// lower them on a busy one. The suites' own knobs still win: SCENARIO_PARALLEL, E2E_ONBOARDING_PARALLEL (or the
// older VERIFY_SUITE_PARALLEL), E2E_CONTROLS_PARALLEL. CHROMIUM_PATH as for the suites.
//
// A suite marked retryAlone that fails beside others runs once more alone; if it then passes the summary says
// FLAKY and lists the first failures. Each job's output prints in one piece.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { chromium } from 'playwright-core';
import { changedFiles, select } from './lib/select.mjs';
import { CHROMIUM, startPreview } from './thumb-lib.mjs';

const argv = process.argv.slice(2);
const FAST = argv.includes('--fast');
const CHANGED = argv.includes('--changed');
const BASE = argv.find((a) => a.startsWith('--base='))?.slice(7) ?? process.env.VERIFY_BASE;
const env = process.env;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const CORES = os.availableParallelism?.() ?? os.cpus().length;
const MAX = Math.max(1, Number(env.VERIFY_JOBS ?? clamp(Math.floor(CORES / 4), 1, 4)));
const PAGES = Math.max(1, Number(env.VERIFY_PAGES ?? clamp(Math.floor(CORES / 2), 2, 8)));
const SHARED_BROWSER = env.VERIFY_SHARED_BROWSER !== '0';
const MODE = FAST ? 'verify:fast' : CHANGED ? 'verify:changed' : 'verify';
const node = (script, ...args) => [process.execPath, script, ...args];
/** A suite's own parallelism: its env knob, else its default cut to the page budget. */
const par = (knob, def) => Math.max(1, Number(knob ?? Math.min(def, PAGES)));

// The onboarding bot reads and waits between taps: its six pages kept about 1.2 cores busy, against about 0.4 core
// for a scenario page, so each counts as half a page and all six run at once (3 of the budget).
const ONB_PAGE = 0.5;
const onbPar = Math.max(
  1,
  Number(env.E2E_ONBOARDING_PARALLEL ?? env.VERIFY_SUITE_PARALLEL ?? Math.min(6, PAGES / ONB_PAGE)),
);
// The scenario pool leaves room for the onboarding players beside it on a machine with 8 pages or more (it is the
// longest suite, so the rest runs while it does); on a smaller one it takes the whole budget and they follow it.
const scnPar = par(env.SCENARIO_PARALLEL, PAGES >= 8 ? Math.max(4, PAGES - 3) : 8);
const ctlPar = par(env.E2E_CONTROLS_PARALLEL, 4);

// Which browser suites this run needs: all, none beyond the smoke, or the ones the changed files select.
let picked = null;
let why = [];
if (CHANGED) {
  const { ref, mergeBase, files } = changedFiles(BASE);
  picked = select(files, readFileSync('scripts/e2e-scenarios.mjs', 'utf8'));
  why = [`changed since ${ref} (${mergeBase.slice(0, 7)}): ${files.length} file(s)`, ...picked.why];
}
const wants = (suite) => (FAST ? false : picked ? picked.suites.includes(suite) : true);
const scenarioFull = wants('e2e:scenarios');

/**
 * name, command, `deps` (jobs that must pass first), `pages` (game pages it keeps open at once), `browser` (it uses
 * the shared server), `shared` (it uses the shared Chromium), `quiet`: a group that runs with nothing outside the
 * group beside it (timing checks; perf measures JS ms per frame, which other load would inflate), `last` (after
 * everything else), `on: false` (not needed this run). Long suites come first so they start first.
 */
const ALL = [
  {
    name: 'lint',
    cmd: node(
      'node_modules/eslint/bin/eslint.js',
      '.',
      '--cache',
      '--cache-location',
      'node_modules/.cache/eslint/',
    ),
  },
  {
    name: 'typecheck',
    cmd: node(
      'node_modules/typescript/bin/tsc',
      '--noEmit',
      '--incremental',
      '--tsBuildInfoFile',
      'node_modules/.cache/tsc/tsbuildinfo',
    ),
  },
  { name: 'test', cmd: node('node_modules/vitest/vitest.mjs', 'run') },
  { name: 'build', cmd: node('node_modules/vite/bin/vite.js', 'build') },
  {
    name: 'e2e:onboarding',
    cmd: node('scripts/e2e-onboarding.mjs'),
    pages: onbPar * ONB_PAGE,
    on: wants('e2e:onboarding'),
    retryAlone: true,
    env: { E2E_ONBOARDING_PARALLEL: String(onbPar) },
  },
  {
    name: 'e2e:scenarios',
    cmd: node('scripts/e2e-scenarios.mjs'),
    pages: scenarioFull ? scnPar : 1,
    retryAlone: true,
    env: {
      SCENARIO_PARALLEL: String(scnPar),
      ...(scenarioFull ? {} : { SMOKE: '1' }),
      ...(picked?.blocks ? { BLOCKS: picked.blocks.join(',') } : {}),
    },
  },
  {
    name: 'e2e:controls',
    cmd: node('scripts/e2e-controls.mjs'),
    pages: ctlPar,
    on: wants('e2e:controls'),
    // Its gesture-timing checks (500 ms swipes, 300 ms holds) flaked in 3 of 4 runs beside the other suites and
    // passed every time alone, so it gets a quiet phase of its own. Should it still fail, it runs once more alone
    // and the summary says FLAKY.
    quiet: 'controls',
    retryAlone: true,
    env: { E2E_CONTROLS_PARALLEL: String(ctlPar) },
  },
  {
    name: 'e2e:feel',
    cmd: node('scripts/e2e-feel.mjs'),
    on: wants('e2e:feel'),
    // Frame-timing and transition checks: like the controls gestures, measured with nothing beside them.
    quiet: 'feel',
    retryAlone: true,
  },
  {
    name: 'e2e:joystick',
    cmd: node('scripts/e2e-joystick.mjs'),
    on: wants('e2e:joystick'),
    // A held stick walk timed in real frames (the camera must follow it): measured beside e2e:feel only.
    quiet: 'feel',
    retryAlone: true,
  },
  // Browser suites that wait on real frames: a failure beside other suites reruns once alone (owner ruling: a pass
  // alone counts, and the summary says FLAKY).
  { name: 'e2e', cmd: node('scripts/e2e.mjs'), on: wants('e2e'), retryAlone: true },
  // Analytics on the dev provider: consent on the title, the opt-out switch, off by default.
  {
    name: 'e2e:analytics',
    cmd: node('scripts/e2e-analytics.mjs'),
    on: wants('e2e:analytics'),
    retryAlone: true,
  },
  {
    name: 'e2e:mobile',
    cmd: node('scripts/e2e-mobile.mjs'),
    on: wants('e2e:mobile'),
    retryAlone: true,
  },
  {
    name: 'bundle',
    cmd: node('scripts/check-bundle.mjs', ...(FAST ? [] : ['--store'])),
    deps: ['build'],
  },
  { name: 'lab-map', cmd: node('scripts/generate-lab-map.mjs', '--check') },
  // The three CPU-throttle levels of perf, side by side, with nothing else running.
  ...[1, 4, 6].map((rate) => ({
    name: `perf ${rate}x`,
    cmd: node('scripts/perf.mjs', String(rate)),
    on: wants('perf'),
    quiet: 'perf',
    last: true,
    // 4x and 6x frame pacing drifts when the other throttle levels share the machine: rerun once alone.
    retryAlone: true,
  })),
];
for (const j of ALL)
  if (j.name.startsWith('e2e') || j.name.startsWith('perf')) {
    j.deps = ['build'];
    j.browser = true;
    j.pages ??= 1;
    j.shared = SHARED_BROWSER && !j.quiet;
  }
const jobs = ALL.filter((j) => j.on !== false);
// `last` jobs wait for every other job; other quiet jobs wait for every job that is not quiet.
for (const j of jobs)
  if (j.last) j.after = jobs.filter((o) => o !== j && !o.last).map((o) => o.name);
  else if (j.quiet) j.after = jobs.filter((o) => !o.quiet).map((o) => o.name);

// The one preview server and the one shared Chromium, started when the first suite needs them.
let server = null;
let shared = null;
const serverUrl = async () =>
  (await (server ??= startPreview(Number(env.VERIFY_PORT ?? env.E2E_PORT ?? 4173)))).url;
const sharedWs = async () =>
  (await (shared ??= chromium.launchServer({ executablePath: CHROMIUM }))).wsEndpoint();

const t0 = Date.now();
const state = new Map(jobs.map((j) => [j.name, { status: 'waiting', ms: 0 }]));
const running = new Set();
const pagesInUse = () =>
  [...running].reduce((n, r) => n + (jobs.find((j) => j.name === r)?.pages ?? 0), 0);

async function run(job) {
  const st = state.get(job.name);
  st.status = 'running';
  running.add(job.name);
  const start = Date.now();
  const extra = {};
  if (job.browser) extra.URL = await serverUrl();
  if (job.shared) extra.BROWSER_WS = await sharedWs();
  return new Promise((resolve) => {
    const [cmd, ...args] = job.cmd;
    const child = spawn(cmd, args, {
      env: { ...env, ...(job.env ?? {}), ...extra },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => {
      st.ms = Date.now() - start;
      running.delete(job.name);
      const secs = (st.ms / 1000).toFixed(1);
      if (code !== 0 && job.retryAlone && !st.firstFails) {
        st.firstFails = out.split('\n').filter((l) => l.startsWith('FAIL'));
        st.status = 'waiting';
        job.quiet = `retry:${job.name}`; // again, with nothing beside it (not even another retry)
        job.shared = false; // and in a Chromium of its own
        console.log(
          `\n===== ${job.name}: failed beside other suites in ${secs} s, retrying alone =====\n${out.trimEnd()}`,
        );
        return resolve();
      }
      st.status = code === 0 ? 'ok' : 'FAILED';
      if (code === 0 && st.firstFails) st.flaky = true;
      const note = st.flaky ? ' (alone, after a failure beside other suites)' : '';
      console.log(`\n===== ${job.name}: ${st.status}${note} in ${secs} s =====\n${out.trimEnd()}`);
      resolve();
    });
  });
}

if (why.length) console.log(`${MODE}\n  ${why.join('\n  ')}\n`);
console.log(
  `${MODE}: ${jobs.map((j) => j.name).join(', ')}` +
    `${picked?.blocks ? ` (scenario blocks ${picked.blocks.join(', ')})` : scenarioFull ? '' : ' (scenario smoke)'}` +
    `; up to ${MAX} jobs and ${PAGES} game pages at once`,
);

try {
  await new Promise((done) => {
    const tick = () => {
      for (const job of jobs) {
        const st = state.get(job.name);
        if (st.status !== 'waiting') continue;
        const deps = (job.deps ?? []).map((d) => state.get(d)?.status);
        if (deps.some((s) => s === 'FAILED' || s === 'skipped')) {
          st.status = 'skipped';
          continue;
        }
        if (deps.some((s) => s !== 'ok')) continue;
        // `after`: wait for these to end, pass or fail (a failed e2e still lets perf report).
        if ((job.after ?? []).some((d) => ['waiting', 'running'].includes(state.get(d)?.status)))
          continue;
        const groups = [...running].map((n) => jobs.find((j) => j.name === n)?.quiet);
        const clash =
          groups.some((g) => g !== job.quiet) || (job.quiet && groups.some((g) => g !== job.quiet));
        if (clash) continue;
        // Within the job and page budgets; a job bigger than the page budget still runs, alone.
        if (running.size && !job.quiet && running.size >= MAX) continue;
        if (running.size && pagesInUse() + (job.pages ?? 0) > PAGES) continue;
        void run(job).then(tick);
      }
      if ([...state.values()].every((s) => !['waiting', 'running'].includes(s.status))) done();
    };
    tick();
  });
} finally {
  if (server) (await server).stop();
  if (shared) await (await shared).close();
}

const total = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  `\n===== ${MODE} summary (${total} s, up to ${MAX} jobs and ${PAGES} game pages at once) =====`,
);
for (const [name, st] of state)
  console.log(
    `${(st.flaky ? 'FLAKY' : st.status).padEnd(8)} ${name.padEnd(16)} ${st.ms ? (st.ms / 1000).toFixed(1) + ' s' : ''}`,
  );
for (const [name, st] of state)
  if (st.flaky)
    console.log(
      `\nFLAKY: ${name} failed beside other suites and passed alone. First failures:\n  ${st.firstFails.join('\n  ')}`,
    );
const bad = [...state.values()].filter((s) => s.status !== 'ok').length;
console.log(bad ? `\nVERIFY FAILED (${bad} job(s) failed or skipped)` : '\nVERIFY OK');
process.exit(bad ? 1 : 0);
