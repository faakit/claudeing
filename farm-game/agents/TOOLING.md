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

| Command                 | What it runs                                                                                                                                                                                                                    | Time    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `npm run verify:fast`   | lint, typecheck, unit tests, build, bundle check, lab-map check, scenario smoke e2e (one phone)                                                                                                                                 | ~30 s   |
| `npm run verify`        | Phase 1: lint, types, unit, build, then e2e, mobile, scenarios, onboarding (five phones at once) and the bundle check side by side. Phase 2: controls, alone. Phase 3: feel, alone. Phase 4: perf at 1x, 4x and 6x CPU throttle | ~6 min  |
| `npm run verify:serial` | the same suites one after another, for a busy machine                                                                                                                                                                           | ~15 min |

Run `verify:fast` for each commit and `verify` before a merge. Run `verify` in the background, because it takes
longer than a foreground command may. On a loaded machine, use `VERIFY_JOBS=2`, `VERIFY_SUITE_PARALLEL=2` or
`E2E_CONTROLS_PARALLEL=2`. A suite marked `retryAlone` that fails beside others runs once more alone, and the
summary then says FLAKY.

Single suites: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run e2e`, `e2e:mobile`,
`e2e:scenarios`, `e2e:controls`, `e2e:feel`, `e2e:onboarding`, `perf`, `check:bundle`, `format:check`. The browser
suites run against `dist/`, so run `npm run build` first.

## Ports

| What                                         | Default                                 | Env to change it                                            |
| -------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `npm run dev` (Vite)                         | 5173, or the next free port             | `npx vite --port N --strictPort`                            |
| `e2e`                                        | 4173                                    | `E2E_PORT`                                                  |
| `e2e:controls`, `e2e:onboarding`, `e2e:feel` | `E2E_PORT` + 10, + 20, + 25             | `E2E_CONTROLS_PORT`, `E2E_ONBOARDING_PORT`, `E2E_FEEL_PORT` |
| `e2e:scenarios`                              | 4830 (`E2E_PORT` + 30 when that is set) | `E2E_SCENARIOS_PORT`                                        |
| `e2e:mobile`                                 | 4178                                    | `E2E_MOBILE_PORT`                                           |
| `perf` (1x; 4x and 6x at + 41, + 42)         | 4174                                    | `PERF_PORT`                                                 |
| `bench:thumb`                                | 5180                                    | `BENCH_PORT`                                                |

A second worktree running suites at the same time moves all of them at once:

```sh
E2E_PORT=4400 E2E_MOBILE_PORT=4450 PERF_PORT=4460 BENCH_PORT=5280 npm run verify
```

That puts e2e on 4400, controls, onboarding, feel and scenarios on 4410-4430, mobile on 4450, and perf on 4460,
4501 and 4502.

## The dev sandbox

Use it to build, tune, test and review features against named game states. The rules are in
[AGENTS.md](AGENTS.md), and the format is in `docs/EXTENDING.md` section 0.

- **Scenarios** (`src/dev/scenarios/<name>.json`, 18 so far): open one with `npm run dev`, then
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
