// Which browser suites (and which e2e:scenarios blocks) cover a set of changed files: the map behind
// `npm run verify:changed`. Coarse on purpose: when in doubt a file selects more, never less. Lint, typecheck, the
// unit tests, the build, the bundle check, the lab-map check and the scenario smoke always run anyway.
//
//   import { select, changedFiles } from './lib/select.mjs';
//   select(['src/dev/scenarios/ripe-plot.json'], scenarioSource)  // { suites: ['scenarios'], blocks: [...], why }
import { execFileSync } from 'node:child_process';

/** Every browser suite verify knows, by its verify job name. */
export const SUITES = [
  'e2e',
  'e2e:mobile',
  'e2e:analytics',
  'e2e:scenarios',
  'e2e:onboarding',
  'e2e:controls',
  'e2e:feel',
  'e2e:joystick',
  'perf',
];

const ALL = 'all';
/**
 * First match wins. `suites` lists the suites a match selects (ALL: every one); `blocks` narrows e2e:scenarios to
 * named blocks (only when nothing else selects the whole suite). Paths are relative to farm-game/.
 */
export const RULES = [
  // words only: nothing in the browser can change
  {
    re: /^(docs\/|agents\/(?!probes\/)|art-src\/flow\/)|\.md$|^\.prettier|^\.gitignore$/,
    suites: [],
  },
  // the unit tests run in full anyway
  { re: /^tests\//, suites: [] },
  // the check scripts themselves, and the measuring tool
  { re: /^scripts\/(measure|bench-summary|check-bundle|generate-lab-map)\.mjs$/, suites: [] },
  // read by unit tests and the benchmark only
  { re: /^scripts\/(fixed-waits-baseline|bench-thresholds)\.json$/, suites: [] },
  { re: /^scripts\/lib\/select\.mjs$/, suites: [] },
  { re: /^scripts\/e2e\.mjs$/, suites: ['e2e'] },
  { re: /^scripts\/e2e-([a-z]+)\.mjs$/, suites: (m) => [`e2e:${m[1]}`] },
  { re: /^scripts\/(perf|pacing-lib)\.mjs$/, suites: ['perf'] },
  { re: /^scripts\/lib\/tow\.mjs$/, suites: [], blocks: ['towing', 'towingLane', 'weirTow'] },
  {
    re: /^scripts\/lib\/farm\.mjs$/,
    suites: ['e2e:scenarios', 'e2e:analytics', 'e2e:joystick'],
  },
  // bench-thumb and its probes are not in verify; thumb-lib serves and drives every suite
  { re: /^scripts\/(bench-thumb|frame-strip|shots-controls|make-icons|android)\.mjs$/, suites: [] },
  // one scenario's fixture: the blocks that open it (everyScenario opens them all)
  {
    re: /^src\/dev\/scenarios\/([\w-]+)\.json$/,
    suites: [],
    blocks: (m, src) => ['everyScenario', 'everyScenarioOdd', ...blocksUsing(src, m[1])],
  },
  // the guided start: its bot, and the scenario blocks of the coach
  {
    re: /^src\/(data\/tutorial\.json|ui\/(CoachMarks|coachGeometry|controlTips|titleLetter)\.ts)$/,
    suites: ['e2e:onboarding', 'e2e:scenarios', 'e2e:analytics'],
  },
  // touch, the stick and the floating controls
  {
    re: /^src\/(input\/|ui\/(reach|layout|hit|hotbarCells|ToolRing|Hud)\.ts)/,
    suites: [
      'e2e',
      'e2e:scenarios',
      'e2e:controls',
      'e2e:joystick',
      'e2e:feel',
      'e2e:onboarding',
      'e2e:mobile',
    ],
  },
  // analytics
  {
    re: /analytics/i,
    suites: ['e2e:analytics', 'e2e:onboarding', 'e2e:scenarios'],
  },
  // the page around the game: fit, safe areas, saves, the service worker, the manifest
  {
    re: /^(src\/platform\/|src\/main\.ts$|src\/game\/(persistence|lifecycleWiring|cloud\w*)\.ts$|scripts\/sw-plugin\.mjs$)/,
    suites: ['e2e', 'e2e:mobile', 'e2e:scenarios'],
  },
  // sound
  { re: /^src\/(audio\/|game\/audioWiring\.ts$)/, suites: ['e2e', 'e2e:scenarios', 'perf'] },
  // what is drawn every frame: perf's budgets and the feel checks
  {
    re: /^src\/(fx\/|scenes\/|art\/|game\/\w*Renderer\.ts$|game\/(TowController|weirTow)\.ts$)/,
    suites: ['e2e', 'e2e:scenarios', 'e2e:feel', 'perf', 'e2e:joystick'],
  },
  // the rules layer and its data: the scenario e2e plays them; the core loop too
  { re: /^src\/(systems|state|data|mechanics|i18n|dev)\//, suites: ['e2e', 'e2e:scenarios'] },
  // any other game code: the broad suites
  { re: /^src\//, suites: ['e2e', 'e2e:scenarios', 'e2e:mobile'] },
  // art and audio sources only matter once built into public/
  { re: /^(art-src|audio-src)\//, suites: [] },
  // anything else (package.json, vite config, public assets, index.html, thumb-lib...): everything
  { re: /./, suites: ALL },
];

/** The block names e2e:scenarios runs: its `blocks` list and its `alone` list. */
export function scenarioBlocks(src) {
  const lists = [...src.matchAll(/^\s+(?:: |const alone = SMOKE \? \[\] : )\[\n?([\s\w,]+)\]/gm)];
  return lists.flatMap((m) => m[1].split(',').map((x) => x.trim())).filter(Boolean);
}

/**
 * The e2e:scenarios blocks whose code names `scenario`: top-level functions (`async function name(`) that name it
 * in quotes, and when that function is a helper (sheetTapsOn, stoneWalk...), the blocks that call it.
 */
export function blocksUsing(src, scenario) {
  if (!src) return [];
  const blocks = new Set(scenarioBlocks(src));
  const heads = [...src.matchAll(/^(?:async function (\w+)\(|const (\w+) = \(\) =>)/gm)];
  const fns = heads.map((h, i) => ({
    name: h[1] ?? h[2],
    body: src.slice(h.index, heads[i + 1]?.index ?? src.length),
  }));
  const out = new Set();
  const seen = new Set();
  const climb = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    if (blocks.has(name)) out.add(name);
    else
      for (const f of fns)
        if (f.name !== name && new RegExp(`\\b${name}\\(`).test(f.body)) climb(f.name);
  };
  for (const f of fns) if (f.body.includes(`'${scenario}'`)) climb(f.name);
  return [...out];
}

/**
 * The suites and scenario blocks a set of changed files needs. `blocks` is null when e2e:scenarios runs whole
 * (or not at all); `why` says which file selected what.
 */
export function select(files, scenarioSource = '') {
  const suites = new Set();
  const blocks = new Set();
  const why = [];
  for (const f of files) {
    const rule = RULES.find((r) => r.re.test(f));
    const m = f.match(rule.re);
    let s = typeof rule.suites === 'function' ? rule.suites(m) : rule.suites;
    if (s === ALL) s = SUITES;
    s = s.filter((x) => SUITES.includes(x));
    const b =
      typeof rule.blocks === 'function' ? rule.blocks(m, scenarioSource) : (rule.blocks ?? []);
    s.forEach((x) => suites.add(x));
    b.forEach((x) => blocks.add(x));
    why.push(
      `${f} -> ${[...s, ...b.map((x) => `scenarios:${x}`)].join(', ') || 'unit and lint only'}`,
    );
  }
  const whole = suites.has('e2e:scenarios');
  if (!whole && blocks.size) suites.add('e2e:scenarios');
  return {
    suites: SUITES.filter((s) => suites.has(s)),
    blocks: whole || !blocks.size ? null : [...blocks],
    why,
  };
}

/**
 * The branch a lane merges into, when none is given: the upstream when it is another branch (a lane cut from
 * origin/integration/qa tracks it), else the newest origin/integration/* branch, else origin/main. A lane that
 * tracks its own pushed branch would diff against itself, so that upstream is skipped.
 */
export function defaultBase(git) {
  try {
    const up = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}');
    const here = git('rev-parse', '--abbrev-ref', 'HEAD');
    if (up && up.replace(/^[^/]+\//, '') !== here) return up;
  } catch {
    /* no upstream */
  }
  const integration = git(
    'for-each-ref',
    '--sort=-committerdate',
    '--count=1',
    '--format=%(refname:short)',
    'refs/remotes/origin/integration/',
  );
  return integration || 'origin/main';
}

/**
 * Files changed against the merge base with `base` (default: defaultBase), plus uncommitted and untracked ones,
 * relative to farm-game/.
 */
export function changedFiles(base) {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
  const ref = base || defaultBase(git);
  const mb = git('merge-base', 'HEAD', ref);
  const lines = [
    ...git('diff', '--name-only', '--relative', mb).split('\n'),
    ...git('ls-files', '--others', '--exclude-standard').split('\n'),
  ];
  return { ref, mergeBase: mb, files: [...new Set(lines.filter(Boolean))].sort() };
}
