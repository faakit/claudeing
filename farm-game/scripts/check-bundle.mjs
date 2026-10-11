// Proves the dev tools (src/dev: scenarios, the lab map, clock control, the dev menu) stay out of what players
// load. Run after `npm run build`:
//
//   1. the entry bundle (what index.html loads) contains no dev code, only the lazy import behind ?debug;
//   2. the dev chunk exists (so check 1 is not vacuous) and the service worker never precaches it;
//   3. with --store, a store build (`VITE_DEVTOOLS=0`, `npm run build:store`) contains no dev code at all.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MARKER = 'tiny-acre-devtools'; // DEVTOOLS_MARKER in src/dev/devtools.ts
const LAB_MARK = 'lab_house_door'; // an object name only the lab map has
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
};

const jsFiles = (dir) => readdirSync(join(dir, 'assets')).filter((f) => f.endsWith('.js'));
const read = (dir, f) => readFileSync(join(dir, 'assets', f), 'utf8');

function entryOf(dir) {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  return [...html.matchAll(/assets\/([^"']+\.js)/g)].map((m) => m[1]);
}

if (!existsSync('dist/index.html')) {
  console.error('no dist/: run `npm run build` first');
  process.exit(1);
}
const entries = entryOf('dist');
const devChunks = jsFiles('dist').filter((f) => read('dist', f).includes(MARKER));
check(
  'the dev tools are built as their own chunk',
  devChunks.length === 1 && devChunks[0].startsWith('devtools-'),
  devChunks.join(),
);
const leaks = entries.filter((f) => {
  const t = read('dist', f);
  return t.includes(MARKER) || t.includes(LAB_MARK);
});
check(
  'the entry bundle players load has no dev code',
  entries.length > 0 && leaks.length === 0,
  leaks.join(),
);
const sw = readFileSync('dist/sw.js', 'utf8');
check('the service worker never precaches the dev chunk', !devChunks.some((f) => sw.includes(f)));

if (process.argv.includes('--store')) {
  const out = mkdtempSync(join(tmpdir(), 'tiny-acre-store-'));
  try {
    const r = spawnSync(
      process.execPath,
      ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir'],
      {
        env: { ...process.env, VITE_DEVTOOLS: '0' },
        encoding: 'utf8',
      },
    );
    check('a store build (VITE_DEVTOOLS=0) builds', r.status === 0, (r.stderr ?? '').slice(-400));
    if (r.status === 0) {
      const dirty = jsFiles(out).filter((f) => {
        const t = read(out, f);
        return t.includes(MARKER) || t.includes(LAB_MARK) || t.includes('devtools-');
      });
      check('a store build contains no dev code at all', dirty.length === 0, dirty.join());
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
console.log(failed === 0 ? '\nBUNDLE CHECK OK' : `\nBUNDLE CHECK FAILED (${failed})`);
process.exit(failed ? 1 : 0);
