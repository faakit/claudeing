# The autonomous development loop

How the game went from a plan document to a playable, extensible mobile-first farming sim without a human
in the loop between milestones.

## 0. Frame

1. Read the plan/goal. Write `GOAL.md` (definition of done, self-check question) and keep it short.
2. Create a task list (one task per milestone). Keep exactly one `in_progress`.
3. Decide structure up front: pure `systems/`, data-driven `src/data`, thin scenes. This is what makes
   later autonomy cheap, because behaviour can be tested without a browser.

## 1. Build a vertical slice, then widen

Order that worked: engine and input -> one complete loop (till, plant, water, sleep, harvest, ship, shop) ->
persistence -> juice (sound, particles, day/night) -> phone hardening -> portrait pivot -> new mechanics.
Never start the next layer while the current one is red.

## 2. The inner loop (repeat per feature)

0. **Stage it**: add the scenario(s) where the feature happens (`src/dev/scenarios/<name>.json`, lab or real map;
   `docs/EXTENDING.md` section 0). Everything below is done by opening it: `?scenario=<name>`.
1. **Design in data first**: add JSON rows and types; extend `validateContent` for new references.
2. **Rules next**: pure functions in `systems/`, events instead of Phaser calls.
3. **Wire**: a `mechanics/*` module registering into the registries + one import line.
4. **Test**: unit tests beside the rules (include failure paths and "no change on refusal").
5. **Render**: scene/UI code last. Reuse `Modal`, `row()`, menu tabs.
6. **See it**: open the scenario (dev server, `?scenario=<name>`; the DEV tab steps frames and shows the frame
   graph), or run a probe built on `scripts/lib/farm.mjs` (`agents/probes/scenario-template.mjs`) and look at the
   screenshots. Fix overlaps, clipping, readability.
7. **Check it**: e2e checks that open the scenario and wait on game events (`farm.act()`, `farm.panel('bin')`,
   `farm.idle()`), never on fixed timeouts. `npm run verify:fast` while iterating.
8. **Review it**: the critic gets the scenario names and cites one in every finding.
9. **Gate**: `npm run verify`.
10. **Record**: DECISIONS.md, docs, goals; commit; push.

## 3. How the agent sees the game

There is no human to look. Headless Chromium (Playwright) drives the real build through `window.__farm`
(enabled by `?debug`). Screenshots are read back as images and judged like a reviewer would.

- **Start from a scenario**, not from New Game plus teleports: `openScenario(browser, url, 'coop-hens', { profile:
'se', hand: 'left' })` (`scripts/lib/farm.mjs`). Need a new situation? Add a scenario file: one JSON file.
- **Wait on the game**: `farm.act()` resolves on the Action result, `farm.panel('npc')` when the sheet has settled,
  `farm.idle()` when nothing moves, `farm.ready()` after a door. Never `waitForTimeout`.
- **Freeze time for exact pictures**: `farm.strip(name, n, every)` steps the engine frame by frame
  (`__farm.dev.loop.step`); `__farm.dev.clock.pause()` keeps the light and the hour still.
- Quick taps can start and end between frames: record presses in event handlers, not by polling (the dev API's
  `actionDone` does).

## 4. Debugging discipline

- Reproduce with a minimal probe before changing code (`probes/debug-template.mjs`).
- Fix root causes: e.g. targeting picked the nearest actionable tile instead of the most valuable, so plans now
  carry the handler priority.
- When a test fails after an unrelated change, ask whether the _test_ encoded an accident (random stream, order)
  before touching the code. Say so in DECISIONS.md when a threshold moves.
- Measure, do not guess, for performance: hardware-independent budgets (draws, JS ms), not headless FPS.

## 5. Phone realism without a phone

CDP safe-area insets, device-pixel ratios, touch emulation, orientation overlay, offline service worker test,
touch-target size assertions (`scripts/e2e-mobile.mjs`). Anything that needs hardware goes on a manual checklist
(`docs/MOBILE.md`) and is reported as unverified.

## 6. Release

Build, republish the artifact (see PUBLISHING.md), commit, push, summarise honestly: what changed, what was
verified, what was not.

## 7. Milestone history (for orientation)

M0-M6 core loop and content; M7-lite procedural audio, particles, pixel font; M8 phone hardening (lifecycle,
haptics, PWA, Capacitor); P1-P2 portrait one-handed pivot; P3 extensibility core; P4 foraging, quality,
crafting, jars, orders, fishing, skills; V1-V3 animals and villagers. See `ROADMAP.md` for what is next.
