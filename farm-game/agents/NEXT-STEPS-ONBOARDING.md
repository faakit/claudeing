# Next steps: the guided start (onboarding)

Round 2 is on branch `onboarding/round2` (worktree `onboarding`), from `integration/round3-2026-10-10`. Round 1
(`onboarding/guided-start`) is merged into that base. Everything was measured in headless Chromium with emulated
touch (CDP) on emulated phone profiles. **There was no real phone and no real person**: the "naive player" is a bot
that follows what the screen draws. The critic's bot (`onboarding-critique/tools/human.mjs`) adds thumb spread,
wrong taps, wandering, reopening and players who never paint a row. `npm run verify` is green at the last commit.

## Round 2: what changed

- **Day 2 is a rain morning.** It is set by `day2Weather: "rain"` in `tutorial.json`, which `startTutorial`
  writes into the forecast of a guided new game.
  - Of the coordinator's three ideas, it is the only one that removes the chore for every player, painters and
    never-painters alike.
  - The sleep sheet already says "Tomorrow: Rain. No watering needed.", and the morning toast says the crops are
    watered.
  - Day 2 is now: the letter, Menu > Goal, the walk to town, and the shop.
  - Rosa still fills the can on that morning, without a note.
  - Daily watering is now the **`waterDaily` intro** on the first dry morning (day 3, on the farm). It reads
    "Sunny! Water your crops: N left." and offers the can, the pond, and a row tip of dry crops only. It ends
    when nothing is dry or when you leave the farm, so it never nags.
  - `water2` stays, for saves whose day 2 is sunny (an older day-1 save, or a replay).
- **The bed is offered after the errands** (owner): `bedOffer`, between the errands and the evening `sleep` step.
  - On the farm: "All done! Sleep, or keep exploring.", with the ring on the door.
  - In town, where the errands end: "All done! Sleep at home, or explore."
  - In the house: "Tap the bed to sleep, or explore."
  - It goes after 40 game minutes outside the house. The 6 PM and low-energy `sleep` step still nudges.
  - Rosa stays the greeter, and the stick is still taught on day 2 (owner).
- **The row tip** (`bestPaint`) now shows an unbroken row starting right beside the farmer.
  - Straight ahead wins (a plain Action press then works the row's first tile), else the longest row another way.
  - It is limited to the step's work kinds (`work: ["water"]` while watering; it used to preview grass to till).
  - It **gives way after 2 refusals in a row** (`TIP_YIELD_REFUSALS`; CoachMarks counts them, and they reset
    when the step's count moves or after 20 s). This was the round-5 blocker: a never-painter facing a planted
    tile pressed Action 376 times.
  - It is offered after 2 tiles tilled or 2 seeds planted one at a time.
  - While planting, "Something is already growing here." reads "Tap an empty spot, then Action."
- **Off-screen arrows follow the walk.** `CoachWorld.route` (the tap-to-walk BFS, cached per tile in
  `WorldScene.coachRoute`) puts the arrow on the farthest walk tile in view, so tapping it walks around the pond
  or the woodpile.
  - The stick shows only while the next 4 tiles of the walk run straight (`steerDir`). Town line: "Seeds are in
    town: drag to walk."
  - Probe from 6 awkward farm spots, including the critic's stall spot (8,4): all reach town in 8-17 s. The old
    arrow sat on the pond and did nothing.
- **Interact is pointed at when it is lit for the target.** The line reads "Tap the lit button to open it." (or
  "to talk"), and a box stays on the object. A tap a few px off the one-tile mailbox lands on the farmer's own
  tile; the feel agent is making such taps use the faced object.
- **Mail:** the step ends once a letter has been read and the sheet closed, so a gift left in a letter never loops
  back to the mailbox. With a gift waiting, it points at Take gift, else at Read ("A gift came! Open it and take
  it.").
- **Town before 8 AM:** the shop counter sells at any hour (Mara only stands there from 8). So the guide points at
  the counter ("Tap the counter to buy seeds."), not at "opens at 8".
  - The shop hours are unchanged, so no `shops.json` or `npcs.json` change was needed.
  - Probe: arriving at 6:51, the shop opened at 6:51.
- **Never silent indoors:** the early goals (`gift` to `buy`) have a `where` for the house (its door, 5,8) and for
  town (the farm gate), so the goal arrow leads out. This was review 6's major: 282 s in the house with nothing
  shown.
- **Gesture tips** (`TIPS.ring`, `TIPS.paint`) wait for the guided days like `tips.json` does (`tipsHeldNow`).
- **Depth round 4 intro:** `welcomeJobs` reads "Settling in: jobs pay extra today!", then Menu, then "Tap Goal:
  today's jobs pay extra."
  - It shows on depth's settling-in days (`game.welcomeJobs`, days 3-4) while a job is open.
  - It never shows if the data has no such days, so it is safe before and after depth merges.
  - The Goal tab's "ALSO OPEN" section does not affect the marks: they point at the Goal tab button and the
    sheet's Close.
- **Coach-mark art** (the art agent's round-3 sprites):
  - The line sits on `ui_coach_bubble` (nine-slice; ink text on parchment in the walnut skin; plum keeps its
    strip), and `ui_coach_bubble_tail` points toward the target.
  - `ui_coach_ring` is drawn at whole-pixel scales, with a stepped pulse to `ui_coach_ring_wide`.
  - The `ui_coach_hand` fingertip is at (4.5, 0).
  - Stand-ins of the same sizes are drawn only if the atlas is missing.
- **Toasts at the top while a sheet is open** (depth): three two-line toasts end at y 77, and the line starts at
  y 76, drawn above them. While a sheet is open, the HUD tag and the welcome strip are not drawn.
- **After the controls merge:**
  - The door tap and the bed's top half work (`tapIntent` and `pathToFaceAny`). The bed is offered in 13/14 of
    the critic's runs, and every run slept.
  - "Not your land yet. Follow the ring." is kept: "Buy it at a sign" would send a day-1 player shopping for
    land.
  - "Can't get there." now reads "Can't get there. Follow the ring." The ring may be on a button, not a tile.
  - The bag hint is fixed by controls ("hold Action, then drag, to work a whole plot").
- **e2e-onboarding** gained:
  - an SE-left never-paint run (it presses Action under the row tip);
  - a check that the tip never shows after 2 refusals in a row;
  - `ONB_TRACE=1`, which prints each coach line.

## Day 2 before and after

All runs used the critic's `human.mjs` with the same 8 seeds (i13/SE x right/left, human/never-paint, wander and
reopen), on a frozen build.

|                                 | base 6d5e480                                  | round 2 (milestone 2)    |
| ------------------------------- | --------------------------------------------- | ------------------------ |
| Reach town on day 2             | 7/8 (one 131 s mail loop)                     | 8/8, 0 stalls            |
| water2 (day 2's watering)       | median 68 s (33-172 s); 6/8 over 45 s         | gone (rain): 0 s         |
| Waking to town on day 2         | median 98 s (71-160 s)                        | median 32 s (28-43 s)    |
| New Game to town on day 2       | median 254 s (203-309 s, the 7 that arrived)  | median 168 s (143-226 s) |
| Row tip offered during watering | rows of grass to till (17 commits in one run) | dry crops only           |

The critic's round 6 on milestone 1 (94cb9c3): 14/14 reach town on day 2. Never-paint 4/4 with 0 refusal loops,
mail 0 stalls, waking to town 28-50 s, New Game to waking 111-166 s, no clean-run step over 45 s.

## How it works (from round 1, still true)

- **Steps** are `src/data/tutorial.json`, validated at load by `validateTutorial`. Rules are pure in
  `src/systems/tutorial.ts`, and `src/mechanics/tutorial.ts` has the stat watcher, the tip hold and the can hook.
  The format is in `docs/EXTENDING.md` section 10 (updated: `after`, `wet`, `work`, `day2Weather`, `route`).
- **The coach-mark layer** `src/ui/CoachMarks.ts` draws:
  - one line, with a ring and a hand on exactly one target;
  - edge arrows;
  - gesture demos;
  - a HUD outline.

  Only the "?" is a button: Skip guide (with a confirm), Next (optional steps, after 45 s) and Back.
- **Day 1:** harvest, seeds, plant, water, grow (5 planted), ship. Then the clock and energy lines, "Free time!",
  the errands (wild goods, hello), the bed offer, and the 6 PM bed step. The first morning keeps one note.
- **Day 2:** the letter, Menu, Goal, then town. Day 3+: introductions, each shown once (waterDaily, welcomeJobs,
  late, tired, forage, Mara, the shop, a villager, gifts, the board, Clay, the rod, casting, the mine, placing).
- **Progress is stats only** (`tut.*`; new this round: `tut.at.<id>.clock`). There is no save change: still v17,
  with `migrateV16` for the early goals.

## Edits outside my files (minimal, noted)

Round 2:

- `WorldScene`:
  - `coachWorld().route` and `coachRoute` (cached BFS);
  - the `standTiles` import;
  - the paint tip gated by `tipsHeldNow`.
- `UIScene`:
  - `coachFacts().interact` (the lit Interact type);
  - the ring tip gated by `tipsHeldNow`.
- `systems/goals.ts`: `tipsHeldNow`.
- `src/data/index.ts`: tutorial types and validation only.
- `goals.json`: the early goals' `where` (house and town).

Round 1 (still in place):

- `Hud.intercept`;
- the `Button.text` and `Label.text` getters;
- `MenuPanel.currentTab`;
- `runtime.coaching`;
- `WorldScene.coachWorld()`;
- the goal arrow pausing while coaching;
- the UIScene wiring;
- SummaryPanels' guided morning;
- the `ControlsTab` Replay button and help text;
- the `maps.json` start tile;
- the `?tutorial=0` harness URLs;
- the perf coach scenario.

## Open findings and next steps

1. **Review 6, item 3 ("a stale box on the mailbox during the Menu step"):** I argue it is not a coach mark. It is
   the world's own highlight of the faced interactable: Mara's unread letter keeps the mailbox lit and starred.
   The coach's box only goes with an `interact` pointer, and the layer clears every frame. Left as is.
2. **Review 6, item 5 ("+1 Wild Leek" over the "GOAL COMPLETE" banner):** this is Hud and FX (the feel and controls
   lanes), not the guide.
3. **The day-3 `waterDaily` intro** is unit-tested and probed: 5 crops watered in about 11 s by taps. It is not
   yet replayed by the critic, who plans a run to day 3.
4. **The evening `sleep` step and the bed offer's 40-minute expiry** are unit-tested only; an e2e would need
   about 6 real minutes.
5. **The stick demo draws its hand over the hotbar** (the stick home is just above it). This was cosmetic in
   round 1 and is still the same.
6. **A real phone pass:** use the critic's owner checklist in `agents/critiques/onboarding-critic/final.md`, plus:
   - Does day 2's rain read as a gift, not a skipped lesson?
   - Does day 3's "Sunny! Water your crops" land?
   - Does the bed offer feel optional?
