# Next steps: one-thumb controls

Round 3 branch `controls/round3` (worktree `controls`), from `integration/round2-2026-10-09`. Everything below
was measured in headless Chromium with emulated touch (CDP) on emulated phone profiles. **No real phone and no
real hand were involved.** The thumb zones are a geometric model (`src/ui/reach.ts`), the "human" in the
benchmark is a bot with modelled reaction times and aim spread, and the paint accuracy numbers come from the
controls critic's wobble model, implemented in `tests/paintModel.ts`. `npm run verify` is green at the last
commit (lint, typecheck, 694 unit tests, e2e, mobile e2e, controls e2e on iPhone 13 and SE with both hands,
perf within 12 draws and 3.5 ms; about 7 minutes).

Round 2's handover (milestones M1-M7, rulings, the save at v16) is in git history and in `DECISIONS.md`
("One-thumb controls"). Round 3 is the section "Round 3 owner decisions" at the end of it.

## What shipped in round 3

| item | commit | what |
|---|---|---|
| 1. Action press-and-lift | `d8591ce` | A still press acts once however long it was held (an armed lift with no drag is `cancel` + `tap`). Holding never repeats on touch. A paint dragged out and back to the start cancels. Bag hint fixed. |
| 2. Serpentine paint | `d8591ce`, `9168924`, `9e66c26`, `b9fb448` | Painted paths turn corners: a 14 px sideways move off the leg's trend line, made sideways, starts a new leg; corners land where the finger ran while veering; never revisits, 16 tiles max, rows boxed to the first row, a U-turn steps one row. Paint step 10 -> 16 px. A leg stops growing only past 13 px off its line, and the lift settles the last leg to where the finger went (`9168924`). A corner cut round still counts (`9e66c26`). Shown tiles never flicker or retract: a tile goes only half a step back past its boundary, and corners never take one back (`b9fb448`, critic review 6). |
| 3. Ring | `d8591ce`, `9168924`, `b9fb448` | Radius 64 on a wider arc (285 -> 105), dead zone 36 px, picks by nearest item (clearly nearer than the next by 15% of the spacing, within 30 px) instead of by angle, ring aims correct the full modelled thumb-base pull; the dead centre is judged on the raw finger and sticky taps use the slide rule (`b9fb448`). |
| 4. Options | `d8591ce` | Rows lower, mirrored for the left hand; Sound and Vibrate on the thumb's side in the two lowest rows. |
| 5. Rolled press | `d8591ce` | 9-13 px roll after 100 ms still: acts once. A cut-short swipe or flick: error pulse + 2 px shake, never acts (`press: reject` in the log). |
| 6. Left-hand bag | `d8591ce`, `727de0e` | A second tap on a bag item brings it to hand; the bench now mirrors the item's column by hand. |
| 7. Stale comment | `d8591ce` | `ActionPress` doc rewritten (the step is now 16 px). |
| Coordinator: taps | `d8591ce`, `b9fb448` | Door tiles walk through; solid art leads to its door or interactable (the farmhouse's door art, the wall above the bed); multi-tile things are reached from any open side (the bed's top half). A tap low on a wall's bottom edge walks to the ground below, so front-path taps no longer enter the house (critic review 6). |
| e2e robustness | `6d67337` | Lagged ring flicks and grid flicks are retried, latency is best of 3 frame counts (bars unchanged), after depth saw two flakes under load. |

Audio cues wired by the coordinator are untouched and still fire: `ringOpen`/`ringClose`/`confirm` in
`ToolRing.ts`, `tick` per painted tile and `confirm` on commit in `UIScene.ts`, `target` on a tap route in
`WorldScene.ts`.

### Events (for the onboarding agent)

No inputHub or gameEvents name was added, renamed or removed. `paintLine` keeps `dir` (the last tile's
direction, which is the current leg's once it has tiles) and `tiles` (the path's length) and gains an optional
`path` (one direction per tile from the farmer). `paintEnd` is unchanged. An armed press lifted without a drag
now emits `paintEnd { commit: false }` and then acts once. The debug hook `window.__farm.controls` gains
`paintGeometry` ({step, deadzone, turn}) and `ringGeometry` ({radius, from, to, dead}) for probes, and log
entries `{ kind: 'press', detail: 'reject' }`.

### Save

Unchanged (v16). No new setting.

## Benchmark: before and after

`npm run bench:thumb`, perfect stop, i13 / Pixel 7 / SE, both hands, thresholds `R3` in
`scripts/bench-thresholds.json`: 54/54 rows ok at `9168924` (`bench-r3-m2.md`) and 90/90 on five phones at
`d8d8c35` (`agents/out/controls/bench-r3-final.md`, identical within 3 mm)
(and `bench-r3-m1.md`, the bag task still walking by stick); round 2's in `bench-final.md`. Human-like stops
(`REACTION_MS=180`): `bench-r3-human.md`. Gestures, mm of thumb travel.

| task | profile | hand | round 2 final | round 3 |
|---|---|---|---|---|
| plot3x3 | i13 | right | 15, 590 | **7, 250** |
| plot3x3 | i13 | left | 15, 612 | **7, 271** |
| plot3x3 | pixel7 | right | 15, 616 | **7, 261** |
| plot3x3 | pixel7 | left | 15, 639 | **7, 283** |
| plot3x3 | se | right | 15, 470 | **7, 199** |
| plot3x3 | se | left | 15, 488 | **7, 216** |
| bagUse, stick walk | i13 | right | 5, 156 | 5, 126 |
| bagUse, stick walk | i13 | left | 5, 195 | 5, 126 (item in the mirrored column; 171 in the old slot) |
| bagUse, stick walk | pixel7 | right | 5, 163 | 5, 132 |
| bagUse, stick walk | pixel7 | left | 5, 203 | 5, 132 (179 in the old slot) |
| bagUse, tap walk (new task default) | i13 | right / left | - | 5, 101 / 5, 80 |
| bagUse, tap walk | pixel7 | right / left | - | 5, 106 / 5, 84 |
| bagUse, tap walk | se | right / left | - | 5, 81 / 5, 64 |
| plot3x3 | promax / fold | right | - | 7, 275 / 7, 218 |
| plot3x3 | promax / fold | left | - | 7, 298 / 7, 236 |

The bag task now walks onto the field by a tap (the default way to move) instead of a stick drag, and places
the sprinkler in the column one in from the thumb's edge for each hand; the stick-walk rows are the like-for-like
comparison with round 2.

Every other task (sell, villager, machine, fish, hotbar, swipe, toTown) is unchanged within noise. The 3x3 plot
is: a hop and a tap to stand by the plot's bottom corner, the seeds (hotbar for the right thumb, ring for the
left), one serpentine paint; a tap and a paint to harvest. Every touch is in the comfortable zone, one tool
change (the seeds).

### Paint accuracy (model)

The controls critic's human model (`humanPath` in `tests/paintModel.ts`): a 2D wobble field (sinusoids of
12-25 mm plus smoothed noise), 50 mm/s slowing to 40% near corners, corners cut with a 2 mm radius, 0-2 mm end
overshoot, open loop (the bot does not watch the preview). A 3x3 serpentine, 200 trials, exact path / stray
tiles outside the plot:

| phone | σ 1 mm | σ 1.5 mm | σ 2 mm |
|---|---|---|---|
| iPhone 13 | 100%, 0 | 91%, 4 | 67%, 21 |
| iPhone SE | 90%, 0 | 57%, 18 | 35%, 55 |
| Galaxy Fold cover | 96%, 0 | 69%, 13 | 45%, 37 |
| iPhone Pro Max | 100%, 0 | 95%, 2 | 76%, 10 |

With the old 10 px step the same model gave 8% (i13) and 2% (SE) at σ 2 mm, and 85% even with no wobble at all
(the end overshoot alone). Straight 3-tile lines with lateral wobble only: 100% at σ 1-2 mm on i13, SE and Fold,
0 turns; 77-100% at σ 3 mm. A 3 mm thumb arc over 9 tiles never turns; a slow 3 mm drift never turns; a
deliberate 6 mm sideways move turns on every phone (unit tests in `tests/action-press.test.ts`). Those open-loop
numbers predate `b9fb448`; since then a rare first-row overshoot is no longer trimmed at the corner (about 3 in
100 at σ 1 on an SE).

**Closed loop** (the critic's painter: it turns when the preview shows the leg's tiles, carries on 6 px, backs up
when it shows too many; `closedLoop` in `tests/paintModel.ts`), 200 trials at `b9fb448`: σ 1 mm 100% with 0
strays and one tick per final tile on every phone; σ 2 mm 89-91% on i13, 81-85% on SE, 86-87% on the Fold,
91-94% on the Pro Max (about 60% before shown tiles stopped retracting).

### Ring accuracy (model, 7 items, the critic's 1.5 mm thumb-base pull)

σ 2 mm right / neighbour: i13 98% / 0.3%, SE 93% / 1.2%, Fold 95% / 0.9%; σ 1.2 mm 99-100% (unit test in
`tests/controls.test.ts`). A slide resting 22-35 px out picks nothing. The critic's own probe (42 seeded
trials) on `9168924` at σ 2 mm: i13 40-41, Pixel 7 40-42, SE right 37 (2 wrong), SE left 35 (7 none, each a
finger 4-5 mm from its item, halfway to a neighbour); at σ 1.2 mm 41-42 everywhere.

### Options reach (model)

Sound and Vibrate are comfortable for either thumb on i13, Pixel 7 and SE; no hard target in Options on those
phones. Pro Max: Quit to title is still hard for either thumb (89 mm from the pivot).

## Critic's verdict (review 7, on `26dda7e`)

Ready for the owner's phone; no blocker; nothing regressed. Review-6 majors fixed (tiles no longer flicker or
retract; front-path taps enter the house 0/96). Owner items 1, 3, 4, 5, 6 met; item 2 met on iPhone 13 and close
on SE. The critic's own measurements: one use per press at 80-1500 ms; straight lines exact 59/60 at σ 2 mm;
drift turns 0/24, a deliberate L 24/24, a 3 mm arc 0/24; closed-loop serpentine at σ 2 mm i13 18/20 and 20/20,
SE 15/20 and 17/20; ring at σ 2 mm i13 80/84 and 83/84, SE 73/84 and 77/84, 0 picks from 22-35 px rests, 0
acts; sticky taps 26-28/28 (SE left 23-26); Options 0 hard targets; world-touch blockers still hold (slow taps
0/56 tiles, rest-then-steer 0/48, hesitant drags 0/60). Write-ups: `agents/critiques/controls-critic/` and
`C:/Users/andre/dev/tiny-acre/controls-critique/review-6.md`, `review-7.md`.

## Open findings

- **Paint step vs reach (trade-off):** 16 px steps buy margin against wobble at every corner and row end, at the
  cost of reach toward the screen edge on the thumb's side (3 tiles, was 4) and about 20 mm more drag per 3x3.
  The plot3x3 travel is 199-283 mm; the critic's bar was 250 mm (aim 150). Owner question 1.
- **σ 2 mm serpentine:** the critic agreed (review 6) that the open-loop bar belongs at σ 1 mm and σ 2 mm is
  judged closed loop. Closed loop is 81-94% at σ 2 mm (bar 90% on i13 and SE): the remaining misses are mostly a
  first leg that the 2 mm field sends the wrong way or vertical in its first 8 px, which a person would correct
  and the bot does not.
- **Minor (critic):** SE closed-loop serpentine at σ 2 mm is 75-85% (bar 90%); SE-left sticky taps 23-26/28
  (misses pick nothing).
- **Door tile taps (accepted):** taps aimed at the farmhouse door tile itself enter 40/48 (the misses land on the path tile
  below the door and walk there); the door's art above enters 48/48 and front-path taps enter 0/96.
- **Late stops** (round 2, accepted): about 1 in 5 stick stops at 180 +- 30 ms reaction land a tile late.
- **SE bag cells** 37 px (accepted, geometry).
- **Pro Max Options:** Quit to title is hard (secondary phone).

## Next steps

0. **Serpentine row width (critic's suggestion):** a visible cue for the first row's width while painting, or
   snapping U-turn rows to the edge of the tilled plot, would remove most remaining SE misses (a first row that
   overshoots sets every row's span).
1. **Real-phone pass** (checklist below) before tuning any number: paint step (16 px), turn threshold (14 px),
   veer/hold (6/13 px), ring radius/gap/reach (64, 15%, 30 px) and pull (0.9 / 1.2 mm), arm time (300 ms), roll dwell
   (100 ms).
2. If the owner wants long rows toward the screen edge back, a per-direction step (10 px toward the edge on
   the thumb's side, 16 elsewhere) is the smallest change; corners would then be less sure on that side.
3. Native edge gestures on Android (`View.setSystemGestureExclusionRects` for the dock), from round 2.
4. Native haptic strength with the owner (`src/platform/native.ts`).
5. Gapless SE bag cells (hit areas that meet), from round 2.

## Real-phone checklist (owner)

Right thumb only, then left thumb only (Options > Left hand ON), phone held normally.

- [ ] Press Action and lift, quickly and slowly (up to 2 s): one use each time, never more.
- [ ] Press Action and let the pad roll as you lift: one use, or a little shake and buzz (nothing done). Which
      did you get, and did it match what you meant?
- [ ] Hold Action until it ticks, then drag a row toward the middle of the screen and lift: the row you meant?
- [ ] Now a whole plot: hold, drag along the first row, turn up (or down) a row, drag back, turn, drag across,
      lift. Did it turn where you turned? Did a wobble ever turn it? Did it ever paint outside the plot?
- [ ] Drag a long row (6+ tiles) in one sweep: did your thumb's natural curve ever make it turn?
- [ ] Drag back along the path: it should un-paint tile by tile; back to the start does nothing.
- [ ] Flick Action sideways, slide to an item, rest, lift. Rest short of the items: nothing picked (the tap
      menu stays). Any wrong picks?
- [ ] Options: Sound and Vibrate without regripping?
- [ ] Bag: tap an item, tap it again: it comes to hand.
- [ ] Tap the farmhouse door (or the wall above it): you walk in. Inside, tap the top of the bed: you walk to it
      and the sleep sheet opens. Tap the house door: you walk out.
- [ ] iPhone: does a swipe up from the hotbar trigger the home gesture? Android: does a flick from Action
      toward the edge trigger "back"?

## Questions for the owner

1. Paint step: 16 px (sure corners, 3 tiles toward the screen edge) or 10 px (4 tiles toward the edge, corners
   less sure)? Or 10 toward the edge and 16 elsewhere?
2. A rolled press: is "one use" right when your pad rolls after a press, and is the little "no" shake clear when
   a swipe falls short?
3. A U-turn in a painted path always steps exactly one row, and later rows never run past the first row: is
   that the serpentine you want, or do you ever paint L shapes or gappy rows?
4. Which phone do you play on? The bench can weight that profile.
