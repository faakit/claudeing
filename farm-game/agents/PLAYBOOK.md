# The development loop

This is how a feature gets built, checked and merged without a human in the loop between milestones. The rules it
follows are in [AGENTS.md](AGENTS.md).

## A round

1. The owner sets the direction (`docs/VISION.md`), and the design lane turns it into milestones
   (`docs/MILESTONES.md`).
2. Lanes work in parallel, each on its own branch and worktree, cut from the latest `integration/<round>-<date>`
   branch. Some lanes pair with a critic.
3. At the end, a coordinator merges the lanes into a new integration branch, runs `npm run verify`, and deploys it
   (see [PUBLISHING.md](PUBLISHING.md)). Each lane rewrites its section of [NEXT-STEPS.md](NEXT-STEPS.md).

## The inner loop (for each feature)

0. **Stage it.** Add the scenario(s) where the feature happens (`src/dev/scenarios/<name>.json`, on the lab or a
   real map; see `docs/EXTENDING.md` section 0). Every step below opens it with `?scenario=<name>`.
1. **Design in data first.** Add the JSON rows and types, and extend `validateContent` for new references.
2. **Write the rules.** Pure functions in `systems/` that emit events instead of calling Phaser.
3. **Wire it.** A `mechanics/*` module that registers into the registries, plus one import line.
4. **Test it.** Unit tests beside the rules, including failure paths and "nothing changes on a refusal".
5. **Render it.** Scene and UI code come last. Reuse `Modal`, `row()` and the menu tabs.
6. **Look at it.** Open the scenario (the DEV tab steps frames and shows the frame graph), or run a probe built on
   `scripts/lib/farm.mjs` and read the screenshots. Fix overlaps, clipping and readability.
7. **Check it.** Write e2e checks that open the scenario and wait on game events (`farm.act()`,
   `farm.panel('bin')`, `farm.idle()`), never on fixed timeouts. Run `npm run verify:fast` while iterating.
8. **Review it.** The critic gets the scenario names and cites one in every finding.
9. **Gate it.** `npm run verify`.
10. **Record it.** Update DECISIONS.md and the docs, then commit and push.

## How an agent sees the game

There is no human to look. Headless Chromium (playwright-core) drives the real build through `window.__farm`
(enabled by `?debug`), and screenshots are read back as images and judged the way a reviewer would.

- **Start from a scenario,** not from New Game plus teleports, with `openScenario(browser, url, 'coop-hens', opts)`
  (`opts` picks the phone profile and hand). Need a new situation? Add a scenario file.
- **Wait on the game:** `farm.act()` resolves on the Action result, `farm.panel('npc')` when the sheet has
  settled, `farm.idle()` when nothing moves, and `farm.ready()` after a door.
- **Freeze time for exact pictures:** `farm.strip(name, n, every)` steps the engine frame by frame, and
  `__farm.dev.clock.pause()` holds the light and the hour still.
- Quick taps can start and end between two frames, so record presses in event handlers rather than by polling.

## Debugging discipline

- Reproduce the bug with a minimal probe (`agents/probes/debug-template.mjs`) or a scenario before changing code.
- Fix root causes. For example, targeting once picked the nearest actionable tile instead of the most valuable
  one, so plans now carry the handler priority.
- When a test fails after an unrelated change, ask whether the test encoded an accident (a random stream, an
  order) before touching the code. Say so in DECISIONS.md when a threshold moves.
- Measure performance; don't guess. Use hardware-independent budgets (draws, JS ms per frame), not headless FPS.

## Phone realism without a phone

`scripts/e2e-mobile.mjs` emulates safe-area insets, device-pixel ratios, touch, the landscape overlay, offline
mode and touch-target sizes on five phone profiles. Whatever needs hardware goes on the manual checklists
(`docs/MOBILE.md` and [OPEN-FINDINGS.md](OPEN-FINDINGS.md)) and is reported as unverified.
