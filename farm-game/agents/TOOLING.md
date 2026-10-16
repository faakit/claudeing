# Tooling

How to set up, run, test and inspect Tiny Acre on the owner's machine: Windows 11 with Git Bash. Every command
runs from `farm-game/` unless it says otherwise.

## Stack

Phaser 3.90, TypeScript 6 (strict, `noUncheckedIndexedAccess`), Vite 8, Vitest 5, ESLint and typescript-eslint,
Prettier, playwright-core (headless Chromium for every browser check), Capacitor 8 (Android and iOS). The art and
audio pipelines are Python 3 scripts (`art-src/tools/`, `audio-src/tools/`).

## Setup (Windows, Git Bash)

1. Install Node 22 or newer (CI uses 22), Python 3.10 or newer, and Git for Windows.
2. Run `npm ci` in `farm-game/`.
3. Get a Chromium for the browser suites. The scripts default to `/opt/pw-browsers/chromium`, which doesn't exist
   on Windows, so set `CHROMIUM_PATH`:

   ```sh
   npx playwright-core install chromium
   export CHROMIUM_PATH="$LOCALAPPDATA/ms-playwright/chromium-1217/chrome-win64/chrome.exe"   # use the folder you have
   ```

   Put the `export` in `~/.bashrc`. Without it, `verify:fast` fails at `e2e:scenarios`.

4. Check the setup with `npm run verify:fast`.

Each lane works in its own git worktree under `C:/Users/andre/dev/tiny-acre/<lane>`. Two worktrees that run browser
suites at the same time must use different ports (see below).

## Gates

| Command                  | What it runs                                                                                                                                                                                                              | Time        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `npm run verify:fast`    | lint, typecheck, unit tests, build, bundle check, lab-map check, scenario smoke e2e (one phone)                                                                                                                           | ~17 s       |
| `npm run verify:changed` | `verify:fast`, plus the browser suites (and `e2e:scenarios` blocks) that cover the files changed since the merge base with the branch's upstream (`--base=<ref>` or `VERIFY_BASE` to pick another)                        | 16 s-11 min |
| `npm run verify`         | everything: lint, types, unit, build, bundle, lab-map, then e2e, mobile, analytics, scenarios and onboarding within the page budget; then controls alone; then feel and joystick; then perf at 1x, 4x and 6x CPU throttle | ~11 min     |
| `npm run verify:serial`  | the same suites one after another                                                                                                                                                                                         | ~17 min     |

When to use which:

- **While you work:** `verify:fast`, or the one suite you are changing (`BLOCKS=towing npm run e2e:scenarios`).
- **Each commit:** `verify:changed`. It prints which file selected which suite. Docs, `agents/` notes and unit tests
  alone need no browser; a scenario fixture runs only the blocks that open it; game code runs `e2e` and
  `e2e:scenarios` plus whatever its area touches (input: controls, joystick, feel, onboarding; drawing: perf and feel;
  the guided start: onboarding); `package.json`, the Vite config, `public/` and `thumb-lib` run everything. The map
  is `scripts/lib/select.mjs` (tested in `tests/select.test.ts`); add a rule there when a new area gets its own suite.
- **Before a merge, and before a release:** `verify`, in the background (it takes longer than a foreground command
  may). A release also runs `npm run bench:thumb` when the controls changed (it is not in `verify`).

Load: `verify` starts one static server of `dist/` and one shared Chromium for every suite that runs beside others
(each suite opens its own browser contexts in it). The timing suites (controls, feel, joystick, perf) and any retry
get a Chromium of their own and run with nothing else beside them. At most `VERIFY_PAGES` game pages are open at once
across all suites (default: half the logical cores, 2 to 8) and at most `VERIFY_JOBS` jobs (a quarter of the cores, 1
to 4); a suite's own parallelism is cut to fit the page budget. An onboarding page counts as half a page (the bot
mostly reads and waits), so all six players run beside a scenario pool of five. On a laptop the defaults are 4 pages
and 2 jobs; on the owner's 16-thread desktop 8 and 4. Raise them on a big idle machine
(`VERIFY_PAGES=12 VERIFY_JOBS=6`), lower them when the machine is busy (`VERIFY_PAGES=2`). The suites' own knobs still win:
`SCENARIO_PARALLEL`, `E2E_ONBOARDING_PARALLEL`, `E2E_CONTROLS_PARALLEL`. `VERIFY_SHARED_BROWSER=0` gives every suite
its own Chromium again. A suite marked `retryAlone` that fails beside others runs once more alone, and the summary
then says FLAKY.

Single suites: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run e2e`, `e2e:mobile`,
`e2e:scenarios`, `e2e:controls`, `e2e:feel`, `e2e:onboarding`, `e2e:analytics`, `perf`, `check:bundle`,
`format:check`. The browser suites run against `dist/`, so run `npm run build` first. Lint and typecheck keep caches
in `node_modules/.cache/` (a warm run takes about 1.5 s each).

Measuring: `npm run measure -- <label> -- node scripts/e2e.mjs` prints the wall time and the CPU of the command's
whole process tree, split by process kind (renderer, GPU, browser, node), and appends it to
`agents/out/test-speed.jsonl`. `BLOCK_TIMES=1 npm run e2e:scenarios` prints each block's time. The numbers behind the
current gates are in `agents/out/test-speed.md` (scratch, not tracked) and `DECISIONS.md` ("Faster, lighter tests").

## Ports

`verify` serves every suite from one port: `VERIFY_PORT`, else `E2E_PORT`, else 4173. A second worktree running
`verify` at the same time needs only `E2E_PORT=4400 npm run verify`.

Run alone, each suite starts its own server (in process, no extra process) on its own port:

| What                                         | Default                                 | Env to change it                                            |
| -------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `npm run dev` (Vite)                         | 5173, or the next free port             | `npx vite --port N --strictPort`                            |
| `e2e`                                        | 4173                                    | `E2E_PORT`                                                  |
| `e2e:controls`, `e2e:onboarding`, `e2e:feel` | `E2E_PORT` + 10, + 20, + 25             | `E2E_CONTROLS_PORT`, `E2E_ONBOARDING_PORT`, `E2E_FEEL_PORT` |
| `e2e:scenarios`                              | 4830 (`E2E_PORT` + 30 when that is set) | `E2E_SCENARIOS_PORT`                                        |
| `e2e:mobile`                                 | 4178                                    | `E2E_MOBILE_PORT`                                           |
| `perf`                                       | 4174                                    | `PERF_PORT`                                                 |
| `bench:thumb`                                | 5180                                    | `BENCH_PORT`                                                |
| `e2e:analytics`, `e2e:joystick`              | `E2E_PORT` + 35                         | `E2E_ANALYTICS_PORT`, `E2E_JOYSTICK_PORT`                   |

Any suite also takes `URL=http://localhost:5173/` to run against a server already running (a dev server), and
`VITE_PREVIEW=1` to serve with `vite preview` as before.

## The dev sandbox

Use it to build, tune, test and review features against named game states. The rules are in
[AGENTS.md](AGENTS.md), and the format is in `docs/EXTENDING.md` section 0.

- **Scenarios** (`src/dev/scenarios/<name>.json`, 24 so far): open one with `npm run dev`, then
  `http://localhost:5173/?scenario=coop-hens`. A build needs `?debug&scenario=<name>`. A scenario page is a
  sandbox: saves stay in memory, and the real save is never touched. The format is `ScenarioDef` in
  `src/dev/scenarios.ts`.
- **The lab** (`?scenario=lab`): a debug-only map with every crop stage, soil state, placeable, machine, ore node,
  forage good, water, the shop front, the board, the bin and a door. `npm run gen:lab` regenerates it.
- **`window.__farm.dev`** (typed in `src/dev/api.ts`): `load(name)`, `clock.pause/resume/scale`,
  `loop.pause/resume/step(n)`, `seed(n)`, `time.set(...)`, `time.skipDays(n)`, `goto(map, tx, ty)`,
  `frameStats()`, and the awaits `wait.until / frames / event / sceneReady / transitionDone / panelOpen /
panelClosed / actionDone / idle`.
- **The DEV tab** (top left): always on in `npm run dev`, and on with `?scenario=` or `?devmenu`. The backquote
  key toggles it. It offers scenarios, maps, clock speed, frame stepping, the frame graph (fps, ms, JS ms, draws),
  the tile grid and "next day". It is plain HTML, so it costs no draw call.
- **Analytics** (`?debug&analytics=dev`, the default in `npm run dev`; `?analytics=0` turns it off): the dev
  provider keeps every event in the page, and the DEV tab's Analytics page shows the install's retention and churn,
  the queue and the last events, with consent, offline and flush switches. `&consent=ask` makes the title ask as a
  production build does. `window.__farm.analytics.log()` returns what was delivered. See agents/PUBLISHING.md.
- **`scripts/lib/farm.mjs`**: `serve(port)` (or `URL=` for a running dev server), `launch()`,
  `openScenario(browser, url, name, { profile, hand })`, then `farm.act()`, `interact()`, `tapTile()`,
  `tapButton()`, `panel(name)`, `idle()`, `shot(name)`, `strip(name, n, every)` and `checker()`. Screenshots go to
  `agents/out/shots/` (`SHOTS=<dir>` to change it).
- **Probes** (`agents/probes/`): one-off scripts that drive the running game. Start new ones from
  `scenario-template.mjs` (see [probes/README.md](probes/README.md)).
- **Production stays clean**: the dev tools are a lazy chunk loaded only in dev or with `?debug`.
  `npm run check:bundle` proves it, and `npm run build:store` (used by `cap:sync`) leaves the chunk out entirely.

## Other tools

- **One-thumb benchmark:** `npm run bench:thumb` (`PROFILES=i13,se`, `HANDS=right,left`, `LABEL=<name>`). It writes
  `agents/out/controls/bench-<label>.json` and `.md` and exits 1 below the thresholds in
  `scripts/bench-thresholds.json`. Compare two runs with
  `node scripts/bench-summary.mjs agents/out/controls/bench-r3-final.json agents/out/controls/bench-<label>.json`.
- **Frame strips:** `node scripts/frame-strip.mjs <url> <outDir> [door newgame sheet harvest walk ...]` stitches
  every rendered frame of a moment into one PNG.
- **Perf parts:** `node scripts/perf.mjs 1,4,6 pacing` gives per-frame times only. `budget` gives draws and JS ms.
- **Maps:** `npm run gen:maps` and `npm run art:maps` (maps plus tiles; run them after changing
  `scripts/generate-maps.mjs`).
- **Art:** `python art-src/tools/build.py` (everything, about 5 min) or `--sprites`; `python art-src/tools/strips.py`
  (animation strips); `node art-src/tools/manifest.mjs` (the list of texture keys).
- **Audio:** see the audio section of [NEXT-STEPS.md](NEXT-STEPS.md) and `docs/EXTENDING.md` section 9.
- **Native:** `npm run cap:android`, `npm run cap:ios` (see `docs/MOBILE.md`).

## Conventions the tools rely on

- `?debug` exposes `window.__farm = { game, getState, gameEvents, inputHub, audio, ..., dev }`. `dev` appears once
  the lazy chunk has loaded: wait for `__farm.dev.readyState === 'ready'`.
- `?tutorial=0` starts a bare new game, without the guided start.
- Keyboard: WASD or arrows move, Space is Action (hold to repeat), E is Interact, 1-8 pick a hotbar slot, Esc or M
  opens the menu, Enter confirms.
- Hotbar slots 0-3 are the tools (hoe, can, scythe, rod), so Digit5 is the first free slot.
- `agents/out/` is git-ignored scratch. Never `git add -f` into it. The only tracked files there are the
  round-3 bench baseline and two frame specs that code comments cite.

## Gotchas

| Symptom                                                | Fix                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| A browser suite fails at launch                        | `CHROMIUM_PATH` is not set (see Setup)                                                                |
| A port is in use                                       | another worktree or an old server is on it: set the port env vars, or stop the old server             |
| A scripted edit silently does nothing                  | Prettier reflowed the code: check that the old string exists before replacing it, then re-run `tsc`   |
| A Node test crashes on `measureText`                   | import the pure maths from `ui/fontMetrics.ts`, not a file that imports Phaser                        |
| Python edits leave CRLF line endings                   | write files with `newline='\n'`; run the Python tools with `python -I`                                |
| Headless frame rates look slow                         | headless GL is software-rendered: judge by draws and JS ms per frame, and compare runs on one machine |
| Software-GL warnings in the console                    | harmless; filter to `error` level in checks                                                           |
| A gesture-timing check flakes when the machine is busy | run that suite alone, or lower the parallelism (see Gates)                                            |
| No phone and no native toolchain                       | sync the native projects anyway, and list the result as unverified in `docs/MOBILE.md`                |
