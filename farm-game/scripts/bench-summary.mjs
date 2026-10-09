// Before/after table for the one-thumb benchmark: one row per task, profile, hand, stop mode and reaction
// time, with gestures, thumb travel, corrections, tool changes and seconds side by side.
//
//   node scripts/bench-summary.mjs agents/out/controls/bench.json agents/out/controls/bench-m1.json
//
// Rows are matched on (profile, hand, stop, reactionMs, task); a file from the old tool (no `stop`) counts as
// 'tile' unless its name says "human" (that run used STOP=center).
import { readFileSync } from 'node:fs';

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  console.error('usage: bench-summary.mjs <before.json> <after.json>');
  process.exit(2);
}
const load = (p) =>
  JSON.parse(readFileSync(p, 'utf8')).map((r) => ({
    ...r,
    stop: r.stop ?? (/human/.test(p) ? 'center' : 'tile'),
  }));
const key = (r) => `${r.task}|${r.profile}|${r.hand}|${r.stop}|${r.reactionMs}`;
const before = new Map(load(beforePath).map((r) => [key(r), r]));
const after = load(afterPath);

const cell = (b, a, f = (x) => x) => {
  if (a === undefined || a === null) return '';
  if (b === undefined || b === null) return `${f(a)}`;
  return b === a ? `${f(a)}` : `${f(b)} -> ${f(a)}`;
};
const secs = (r) => (typeof r?.detail?.seconds === 'number' ? r.detail.seconds : undefined);
const ok = (r) =>
  r.fails?.length ? `FAIL: ${r.fails.join('; ')}` : r.detail?.error ? 'error' : 'ok';

console.log(
  '| task | profile | hand | stop | reaction ms | gestures | travel mm | corrections | tool changes | seconds | result |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
const order = ['i13', 'pixel7', 'se', 'promax', 'fold'];
after
  .slice()
  .sort(
    (x, y) =>
      x.task.localeCompare(y.task) ||
      order.indexOf(x.profile) - order.indexOf(y.profile) ||
      x.hand.localeCompare(y.hand) ||
      x.reactionMs - y.reactionMs,
  )
  .forEach((a) => {
    const b = before.get(key(a));
    console.log(
      `| ${a.task} | ${a.profile} | ${a.hand} | ${a.stop} | ${a.reactionMs} | ${cell(b?.gestures, a.gestures)} | ${cell(b?.travelMm, a.travelMm)} | ${cell(b?.corrections, a.corrections)} | ${cell(b?.toolChanges, a.toolChanges)} | ${cell(secs(b), secs(a), (x) => x.toFixed(1))} | ${ok(a)} |`,
    );
  });
