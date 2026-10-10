# Next steps: the guided start (onboarding)

Branch `onboarding/guided-start` (worktree `onboarding`), from `integration/round2-2026-10-09`. Everything was
measured in headless Chromium with emulated touch (CDP) on emulated phone profiles. **No real phone, no real
person**: the "naive player" is a bot that follows what the screen draws, and the critic's bot adds thumb spread,
wrong taps, wandering and reopening. `npm run verify` is green at the last commit.

## What shipped

- **A data-driven tutorial system.** Steps are `src/data/tutorial.json`, validated at load by `validateTutorial`
  (unknown conditions, targets with two kinds, gifts outside the home plot and reserved ids all fail loudly).
  Rules are pure in `src/systems/tutorial.ts` (step machine, conditions, target resolution, replay, skip).
  `src/mechanics/tutorial.ts` registers a stat watcher, so a step finishes the moment its stat moves, and holds
  first-time tips back until the guided days are over. Format: `docs/EXTENDING.md` section 10.
- **The coach-mark layer** `src/ui/CoachMarks.ts`. It draws one line at the top of the world view, or at the
  bottom while the target sits right under the top. It adds a pulsing ring and a hand on exactly one target (a
  world tile, a dock button, a hotbar slot, a button in an open sheet), an edge arrow for off-screen targets,
  gesture demos (press-hold-drag for a row, a sideways flick for the tool ring, a stick drag), and a HUD outline
  where the line is about a HUD element. Only the line's "..." is a button. It opens Skip guide (with a confirm
  tap), Next (on optional steps after 45 s) and Back, and the menu closes after 4 s or on any other touch.
  Left-handed play mirrors the marks; Calm stills them.
- **Day 1:**
  - Rosa's welcome strip offers Left hand and Skip. Then the guide walks through:
    1. Pick 3 ripe parsnips (tap to walk and act).
    2. Seeds on the hotbar.
    3. Action plants, then Action waters.
    4. "Press Action: dig, plant, water" until 5 seeds are planted. The row tip is offered, never required.
    5. Bin, then Ship all.
  - The clock line comes next, then the energy line, then "Free time!".
  - The goal bar then suggests two errands: 3 wild goods (one by the house, two at the town gate) and say hello to
    a villager.
  - The bed step comes at 6 PM, or earlier below 25% energy. Sleeping earlier is fine.
  - The first morning has one news line.
- **Day 2:** water the dry crops (with a count, the row tip and the pond when the can is empty), the letter,
  Menu > Goal (jobs), and the walk to town taught with the stick.
- **Later introductions,** each shown once when it matters: late night, low energy, wild goods in view, Mara and
  the shop, a new villager, gifts, the board, Clay's board race (day 8, in town), the rod through the tool ring, casting, the mine, placing a
  machine.
- **Never trapped:**
  - Skip from the strip or the line's menu. A toast says where to replay it: Options > Controls > Replay guide.
    A replay never touches goals, gold or crops.
  - Nothing is modal. The clock runs. The guide recovers from wandering, open sheets and other maps.
  - Refusals appear in the coach line, reworded where they would mislead.
- **Known onboarding bugs fixed:**
  - The welcome toasts are gone. They replayed on map changes and taught the old "hold Action".
  - The summary tip now reads "hold Action, then drag".
  - The swipe tip moved from the 2nd till to day 4.
  - There is forage on day 1 (by the house and at the town gate), and the coach points at it.
  - The "Drag to walk" ring no longer contradicts tap-to-walk.
  - The bag hint ("Tip: hold Action to keep working." in `MenuPanel.ts`) is the controls agent's, still open on
    this branch.

## Before and after (naive player, day 1)

|                               | before (1dffd97)                                        | after                                                                                            |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Moments of confusion on day 1 | 10 (C1-C10 in `agents/out/onboarding/before/notes.md`)  | 0 in the bot runs; see the critic's reviews for a human-ish bot                                  |
| First thing done              | first till after about 3.5 min (2 refusals, 15 s stuck) | first harvest at 4.4-5.1 s (bot), 9-21 s (critic's bot)                                          |
| Day 1 steps taught            | till, plant, water, sleep (by goals only)               | tap to walk, hotbar, Action, auto tool, row tip, bin, clock, energy, errands, stick (day 2), bed |
| Day 1 gestures / time         | 21 gestures, about 4.5 min (41 s of it stuck)           | 42-49 gestures, 110-121 s including the town errand (bot)                                        |
| Refusals on day 1             | 4                                                       | 0 (1 for the wanderer, shown in the coach line)                                                  |

Bot runs (`npm run e2e:onboarding`, New Game to town on day 2): i13 R 146 s / 61 gestures, i13 L 148 / 62, SE R
145 / 61, SE L 146 / 62, wanderer 157 / 68. Screenshots: `agents/out/onboarding/after/`.

## Save versions

- **v17:** early goals reordered (`gift`, `plant`, `ship1`, `forage`, `talk`, `sleep`, then `buy`...). Migration
  `migrateV16` in `src/systems/save.ts`: "till" moves to "plant", "water" and "sleep" move to "forage", everything
  else is remapped by id. Unit-tested per old early goal. Tutorial progress itself is stats only (`tut.*`).
  Renumber at merge if another branch took 17.

## Texture keys for the art agent

- `ui_coach_ring` (32x32, a gold ring)
- `ui_coach_hand` (15x17, a pointing glove, fingertip at 4,1)

Both are code-drawn placeholders in `ensureCoachTextures`; a real texture under the same key replaces them.

## Edits outside my files (minimal, noted)

- `Hud.intercept` (toast hook)
- `Button.text` and `Label.text` getters
- `MenuPanel.currentTab`
- `runtime.coaching`
- `WorldScene.coachWorld()` and its water-tile cache, plus the goal arrow pausing while coaching
- UIScene wiring: drag hint, idle hint, `paintEnd` → `notePainted`
- SummaryPanels: the short guided morning
- `ControlsTab`: Replay guide button and help card text
- `maps.json` start tile
- Harness URLs: `?tutorial=0` in `e2e.mjs`, `e2e-mobile.mjs`, `perf.mjs`, `thumb-lib.mjs`
- `perf.mjs`: a coach-marks scenario

## Open findings and next steps

The critic's reviews are in `C:/Users/andre/dev/tiny-acre/onboarding-critique/` (ledger.md, review-*.md).
Round 2b ran on 9ff96f2. Two human-like runs reached town on day 2. Two stalled on water2 because the rod was in
hand (taps and Action then only fish). That case is fixed after 9ff96f2: the coach points at the can, or at the
seeds, first. The critic was cut off by a usage limit before it wrote review 3.

1. **Re-test with a human-like bot** (thumb spread, wrong taps, reopening) on the final build. That is the
   critic's `tools/human.mjs`. The in-repo e2e follows the hand exactly.
2. **The evening bed step** is unit-tested only. An e2e would need about 6 real minutes of play. Day 1 in the
   e2e ends when the bot chooses to sleep after the errands.
3. **After the depth branch merges:**
   - While a sheet is open, toasts draw at the top of the screen. Check they do not collide with the coach line
     (y 76-94) and move the line if they do.
   - Clay's day-7 letter: the day-8 intro points at the board in town. It could also point at the letter.
4. **After the controls branch merges:**
   - Remove the "Not your land" and "Can't get there" rewordings if the new refusals read well.
   - Re-check the door tap and the bed's top half.
   - Fix the bag tab's stale "hold Action to keep working".
5. **Day 2's goal bar** ("Buy 5 items") and the water, letter and menu steps still say different things. Only the
   walk to town matches it.
6. **Art:** replace the `ui_coach_ring` and `ui_coach_hand` placeholders, and give the hand a back-of-hand pose
   for drags.
7. **Real phone pass:**
   - Is the top line readable at arm's length?
   - Is the "..." reachable, and is it found?
   - Does the hand animation read as "hold, then drag"?
   - Is the clock policy (never paused) right for a slow reader?

## Questions for the owner

1. Rosa greets you (she is the neighbour in the data). The brief suggested Mara. One field in `tutorial.json`
   (`speaker`) switches it.
2. Day 1: the guided part ends mid-morning, then the errands. Is free play until 6 PM right, or should the bed
   step come once the errands are done?
3. Should the guide teach the stick earlier than day 2's long walk?
