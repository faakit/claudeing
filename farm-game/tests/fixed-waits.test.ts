/**
 * No new fixed waits in browser scripts: a `waitForTimeout(...)` or `sleep(...)` longer than 100 ms (or with a
 * computed duration) is how slow, flaky checks are made. Wait on game state instead: the dev API's await helpers
 * (`window.__farm.dev.wait.*`, wrapped by scripts/lib/farm.mjs).
 *
 * The waits that existed when this rule arrived are allowed per file (scripts/fixed-waits-baseline.json); a file
 * may only go down. After removing some, refresh the list: `UPDATE_WAITS=1 npx vitest run tests/fixed-waits`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['scripts', 'agents'];
const BASELINE = 'scripts/fixed-waits-baseline.json';
const LIMIT_MS = 100;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === 'node_modules' || name === 'out' || name.startsWith('.')) return [];
    if (statSync(p).isDirectory()) return files(p);
    return /\.(mjs|js|cjs|ts)$/.test(name) ? [p.split('\\').join('/')] : [];
  });
}

/** Fixed waits in a source text: [line, call] for each one over the limit (or not a literal). */
export function fixedWaits(text: string): [number, string][] {
  const out: [number, string][] = [];
  const re = /\b(waitForTimeout|sleep)\(\s*([^),]*)\s*[),]/g;
  text.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    for (const m of line.matchAll(re)) {
      const arg = (m[2] ?? '').trim();
      if (
        m[1] === 'sleep' &&
        /function|=>|^ms$/.test(line) &&
        /(const|function)\s+sleep\b/.test(line)
      )
        continue; // the definition of sleep itself
      const n = /^\d+(_\d+)*$/.test(arg) ? Number(arg.replace(/_/g, '')) : NaN;
      if (Number.isNaN(n) || n > LIMIT_MS) out.push([i + 1, m[0]]);
    }
  });
  return out;
}

function count(): Record<string, number> {
  const res: Record<string, number> = {};
  for (const root of ROOTS)
    for (const f of files(root)) {
      const n = fixedWaits(readFileSync(f, 'utf8')).length;
      if (n) res[f] = n;
    }
  return res;
}

describe('fixed waits in browser scripts', () => {
  it('finds fixed waits, and leaves short ones and the helpers alone', () => {
    const src = [
      'await page.waitForTimeout(1500);',
      'await page.waitForTimeout(80);',
      'await sleep(ms);',
      'await sleep(600);',
      '// await page.waitForTimeout(5000);',
      'export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));',
    ].join('\n');
    expect(fixedWaits(src).map(([l]) => l)).toEqual([1, 3, 4]);
  });

  it('adds none beyond the allowed list (wait on game events: window.__farm.dev.wait)', () => {
    const now = count();
    if (process.env.UPDATE_WAITS) {
      writeFileSync(BASELINE, JSON.stringify(now, null, 2) + '\n');
      return;
    }
    const allowed = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    const over = Object.entries(now)
      .filter(([f, n]) => n > (allowed[f] ?? 0))
      .map(([f, n]) => {
        const lines = fixedWaits(readFileSync(f, 'utf8'))
          .map(([l, c]) => `    ${f}:${l}  ${c}`)
          .join('\n');
        return `${f}: ${n} fixed waits, ${allowed[f] ?? 0} allowed\n${lines}`;
      });
    expect(
      over,
      `New fixed waits over ${LIMIT_MS} ms. Use the await helpers instead:\n${over.join('\n')}`,
    ).toEqual([]);
  });
});
