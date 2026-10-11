// The quality gate, run in parallel where it is safe.
//
//   npm run verify        lint, typecheck, unit tests, build, bundle check, lab map check, then every browser suite
//                         (e2e, mobile, scenarios, controls, onboarding) side by side on their own ports, then perf
//                         alone (its JS-ms budget is CPU-sensitive, so nothing else runs beside it)
//   npm run verify:fast   lint, typecheck, unit tests, build, bundle check, and the scenario smoke e2e (one profile)
//   npm run verify:serial the old one-after-another chain (for comparison, or a very loaded machine)
//
// Env: VERIFY_JOBS (parallel jobs, default 4), the suites' own port variables (E2E_PORT, E2E_MOBILE_PORT,
// PERF_PORT, E2E_CONTROLS_PORT, E2E_ONBOARDING_PORT, E2E_SCENARIOS_PORT), CHROMIUM_PATH.
// Each job's output is printed in one piece when it ends; the summary at the end lists every job's time.
import { spawn } from 'node:child_process';

const FAST = process.argv.includes('--fast');
const MAX = Math.max(1, Number(process.env.VERIFY_JOBS ?? 4));
const node = (script, ...args) => [process.execPath, script, ...args];

/** name, command, jobs it waits for, and `alone` (runs with nothing else beside it). */
const ALL = [
  { name: 'lint', cmd: node('node_modules/eslint/bin/eslint.js', '.') },
  { name: 'typecheck', cmd: node('node_modules/typescript/bin/tsc', '--noEmit') },
  { name: 'test', cmd: node('node_modules/vitest/vitest.mjs', 'run') },
  { name: 'build', cmd: node('node_modules/vite/bin/vite.js', 'build') },
  { name: 'lab-map', cmd: node('scripts/generate-lab-map.mjs', '--check') },
  {
    name: 'bundle',
    cmd: node('scripts/check-bundle.mjs', ...(FAST ? [] : ['--store'])),
    deps: ['build'],
  },
  {
    name: 'e2e:scenarios',
    cmd: node('scripts/e2e-scenarios.mjs'),
    deps: ['build'],
    env: FAST ? { SMOKE: '1' } : {},
  },
  { name: 'e2e', cmd: node('scripts/e2e.mjs'), deps: ['build'], full: true },
  { name: 'e2e:mobile', cmd: node('scripts/e2e-mobile.mjs'), deps: ['build'], full: true },
  { name: 'e2e:controls', cmd: node('scripts/e2e-controls.mjs'), deps: ['build'], full: true },
  { name: 'e2e:onboarding', cmd: node('scripts/e2e-onboarding.mjs'), deps: ['build'], full: true },
  {
    name: 'perf',
    cmd: node('scripts/perf.mjs'),
    deps: ['build'],
    full: true,
    alone: true,
    last: true,
  },
];
const jobs = ALL.filter((j) => !FAST || !j.full);
// `last` jobs wait for every other job (perf measures on a quiet machine).
for (const j of jobs)
  if (j.last) j.deps = jobs.filter((o) => o !== j && !o.last).map((o) => o.name);

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
      st.status = code === 0 ? 'ok' : 'FAILED';
      running.delete(job.name);
      const secs = (st.ms / 1000).toFixed(1);
      console.log(`\n===== ${job.name}: ${st.status} in ${secs} s =====\n${out.trimEnd()}`);
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
      const aloneRunning = [...running].some((n) => jobs.find((j) => j.name === n)?.alone);
      if (aloneRunning || running.size >= MAX || (job.alone && running.size > 0)) continue;
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
    `${st.status.padEnd(8)} ${name.padEnd(16)} ${st.ms ? (st.ms / 1000).toFixed(1) + ' s' : ''}`,
  );
const bad = [...state.values()].filter((s) => s.status !== 'ok').length;
console.log(bad ? `\nVERIFY FAILED (${bad} job(s) failed or skipped)` : '\nVERIFY OK');
process.exit(bad ? 1 : 0);
