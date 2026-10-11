// The quality gate, run in parallel where it is safe.
//
//   npm run verify        1. lint, typecheck, unit tests, build, then the browser suites side by side on their own
//                            ports: e2e, mobile, scenarios, onboarding (all five of its runs at once), plus the
//                            bundle and lab map checks;
//                         2. the controls suite alone (four phones at once): its gesture-timing checks flake
//                            beside other suites;
//                         3. perf's three CPU-throttle levels side by side, with nothing else running (its
//                            JS-ms budget is CPU-sensitive).
//   npm run verify:fast   lint, typecheck, unit tests, build, bundle check, and the scenario smoke e2e (one profile)
//   npm run verify:serial the old one-after-another chain (for comparison, or a very loaded machine)
//
// Env: VERIFY_JOBS (jobs at once in phase 1, default 4), VERIFY_SUITE_PARALLEL (onboarding runs at once, default 5),
// E2E_ONBOARDING_PARALLEL / E2E_CONTROLS_PARALLEL (win over the defaults), the suites' own ports (E2E_PORT,
// E2E_MOBILE_PORT, PERF_PORT and PERF_PORT+41/+42 for the 4x and 6x runs, E2E_CONTROLS_PORT, E2E_ONBOARDING_PORT,
// E2E_SCENARIOS_PORT, E2E_JOYSTICK_PORT), CHROMIUM_PATH. A suite marked retryAlone that fails beside others runs once more alone; if
// it then passes the summary says FLAKY and lists the first failures. Each job's output prints in one piece.
import { spawn } from 'node:child_process';

const FAST = process.argv.includes('--fast');
const MAX = Math.max(1, Number(process.env.VERIFY_JOBS ?? 4));
const node = (script, ...args) => [process.execPath, script, ...args];

/** name, command, jobs it waits for, and `alone` (runs with nothing else beside it). */
// Browser suites that run several phones at once inside one process get more of them here (env overrides win).
const SUITE_PAR = Number(process.env.VERIFY_SUITE_PARALLEL ?? 5);
const perfPort = Number(process.env.PERF_PORT ?? 4174);

/**
 * name, command, jobs it waits for, and `quiet`: a group that runs with nothing outside the group beside it (perf
 * measures JS ms per frame, which other load would inflate). Long suites come first so they start first.
 */
const ALL = [
  { name: 'lint', cmd: node('node_modules/eslint/bin/eslint.js', '.') },
  { name: 'typecheck', cmd: node('node_modules/typescript/bin/tsc', '--noEmit') },
  { name: 'test', cmd: node('node_modules/vitest/vitest.mjs', 'run') },
  { name: 'build', cmd: node('node_modules/vite/bin/vite.js', 'build') },
  {
    name: 'e2e:onboarding',
    cmd: node('scripts/e2e-onboarding.mjs'),
    deps: ['build'],
    full: true,
    env: { E2E_ONBOARDING_PARALLEL: process.env.E2E_ONBOARDING_PARALLEL ?? String(SUITE_PAR) },
  },
  {
    name: 'e2e:controls',
    cmd: node('scripts/e2e-controls.mjs'),
    deps: ['build'],
    full: true,
    // Its gesture-timing checks (500 ms swipes, 300 ms holds) flaked in 3 of 4 runs beside the other suites and
    // passed every time alone, so it gets a quiet phase of its own, four phones at once (111 s, measured twice
    // green). Should it still fail, it runs once more alone and the summary says FLAKY.
    quiet: 'controls',
    retryAlone: true,
    env: { E2E_CONTROLS_PARALLEL: process.env.E2E_CONTROLS_PARALLEL ?? '4' },
  },
  {
    name: 'e2e:feel',
    cmd: node('scripts/e2e-feel.mjs'),
    deps: ['build'],
    full: true,
    // Frame-timing and transition checks: like the controls gestures, measured with nothing beside them.
    quiet: 'feel',
    retryAlone: true,
  },
  {
    name: 'e2e:joystick',
    cmd: node('scripts/e2e-joystick.mjs'),
    deps: ['build'],
    full: true,
    // A held stick walk timed in real frames (the camera must follow it): measured beside e2e:feel only.
    quiet: 'feel',
    retryAlone: true,
  },
  { name: 'e2e', cmd: node('scripts/e2e.mjs'), deps: ['build'], full: true },
  { name: 'e2e:mobile', cmd: node('scripts/e2e-mobile.mjs'), deps: ['build'], full: true },
  {
    name: 'e2e:scenarios',
    cmd: node('scripts/e2e-scenarios.mjs'),
    deps: ['build'],
    env: FAST ? { SMOKE: '1' } : {},
  },
  {
    name: 'bundle',
    cmd: node('scripts/check-bundle.mjs', ...(FAST ? [] : ['--store'])),
    deps: ['build'],
  },
  { name: 'lab-map', cmd: node('scripts/generate-lab-map.mjs', '--check') },
  // The three CPU-throttle levels of perf, side by side on their own ports, with nothing else running.
  ...[1, 4, 6].map((rate, i) => ({
    name: `perf ${rate}x`,
    cmd: node('scripts/perf.mjs', String(rate)),
    deps: ['build'],
    full: true,
    quiet: 'perf',
    last: true,
    env: { PERF_PORT: String(i === 0 ? perfPort : perfPort + 40 + i) },
  })),
];
const jobs = ALL.filter((j) => !FAST || !j.full);
// `last` jobs wait for every other job; other quiet jobs wait for every job that is not quiet.
for (const j of jobs)
  if (j.last) j.after = jobs.filter((o) => o !== j && !o.last).map((o) => o.name);
  else if (j.quiet) j.after = jobs.filter((o) => !o.quiet).map((o) => o.name);

const t0 = Date.now();
const state = new Map(jobs.map((j) => [j.name, { status: 'waiting', ms: 0 }]));
const running = new Set();

function run(job) {
  const st = state.get(job.name);
  st.status = 'running';
  running.add(job.name);
  const start = Date.now();
  return new Promise((resolve) => {
    const [cmd, ...args] = job.cmd;
    const child = spawn(cmd, args, {
      env: { ...process.env, ...(job.env ?? {}) },
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
        job.quiet = 'retry'; // again, with nothing beside it
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
      if (clash || (running.size >= MAX && !job.quiet)) continue;
      void run(job).then(tick);
    }
    if ([...state.values()].every((s) => !['waiting', 'running'].includes(s.status))) done();
  };
  tick();
});

const total = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  `\n===== verify${FAST ? ':fast' : ''} summary (${total} s, up to ${MAX} jobs at once) =====`,
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
