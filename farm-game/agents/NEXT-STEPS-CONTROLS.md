# Next steps: one-thumb controls

Branch `controls/one-thumb` (worktree `controls`), from the integration branch plus the plan (`e632754`).
Everything below was measured in headless Chromium with emulated touch (CDP) on emulated phone profiles. **No
real phone and no real hand were involved**; the thumb zones are a geometric model (`src/ui/reach.ts`) and the
"human" in the benchmark is a bot with modelled reaction times and aim spread. `npm run verify` is green at the
last commit (579 unit tests, e2e, mobile e2e, controls e2e on iPhone 13 and SE with both hands, perf within 12
draws and 3.5 ms; verify takes about 7 minutes).

## What shipped, per milestone

| milestone | commit | what |
|---|---|---|
| M1 quick wins | `933d6b9` | Pure dock layout (`ui/layout.ts`): Action owns its disc and touch circle, 12 px off the edge; Interact clear of it; **Menu moved into thumb reach**, acting on a clean release and pass-through (a drag starting on it is the stick). One still/stick threshold (9 px). Swipe skips empty slots. Marker yes/no by shape. No silent world taps. Haptics: medium kind, per-kind throttle, merge. Bin "Ship all produce". `npm run bench:thumb`, `npm run e2e:controls` (in verify). |
| M2 grid feel | `f015781` | Turn in place from a standstill (100 ms); settle on release to a tile centre (13 px back window); first tile of a walk commits after 4 px (no rubber-band nudges); axis hysteresis 1.6. |
| M3 auto tool | `911e5c8` | `systems/autoTool.ts` + `registerAutoItem`: with a farm item in hand Action uses the hotbar farm item that fits the tile; the rod, placeables and goods stay explicit. **Save v16** (`settings.controls`, `controls.lastSeed`). Options > Controls page. Debug log `window.__farm.controls` (marker vs act). |
| M4 tap to walk | `bebb9a9` | `WorldTouch`, `systems/tapIntent.ts`, `systems/pathfind.ts`, `stepRoute`: tap a tile to walk there and do the obvious thing; preview after 100 ms; touch-offset compensation; stick cancels, a second tap retargets, taps in a swing are buffered. Review-1 fixes. Marker depth pinned under every sprite. |
| Owner rulings 1 + M5 | `931b9d8` | Taps only do harmless obvious things (never till or plant); no magnets; a hold repeats only its first step kind; explicit item wins; seeds only from the selected slot or the last planted. (World long-press painting, since removed.) |
| M6 reach | `1962f0b` | Tool ring on a sideways flick; sheet rows mirrored for the left hand (`rowLayout`); Options rows low. |
| Ruling 2 + M7 | `cb5dce5` | **Rows are painted from Action** (hold 300 ms, drag a straight line, lift) via the pure `ActionPress`; world touches never paint or till by duration. Forgiving ring (filled slots only, aim correction, sector gaps, tap-menu fallback). Options volume rows by the tabs. Help card in Options (two taps), first-run paint and ring tips, Fine stick (two-speed, off by default), perf tap-route scenario. |

Design record: `DECISIONS.md`, section "One-thumb controls" (every milestone, each ruling, and what each
superseded). Plan: `agents/PLAN-CONTROLS.md` (the rulings are summarised at its top).

## Save versions

- **v16** (this branch): `settings.controls = { autoTool, tapToMove, paint, stickSize, twoSpeed }` (defaults on,
  on, on, 'm', off) and `controls.lastSeed`. Migration `migrateV15` in `src/systems/save.ts`, per-field
  `sanitizeControlSettings` / `sanitizeLastSeed` in `src/systems/settings.ts`, tested from a real v15 save
  fixture (`tests/fixtures/save-v15.json`). If another branch also took 16, renumber this one at merge; nothing
  else in the state changed. No later milestone changed the save.

## Benchmark: before and after

`npm run bench:thumb` (perfect stop unless noted; per-milestone tables in `agents/out/controls/bench-m1.md` to
`bench-m4.md`, the final run in `bench-final.md`). Before = the plan's measurement on the integration build.

| task | profile | hand | before: gestures, mm, s | after: gestures, mm, s | tool changes after |
|---|---|---|---|---|---|
| plot3x3 | i13 | right | 26, 933, 20.0 | 15, 590, 21.2 | 1 |
| plot3x3 | i13 | left | 26, 927, 20.1 | 15, 612, 20.8 | 1 |
| plot3x3 | pixel7 | right | 26, 974, 20.0 | 15, 616, 20.9 | 1 |
| plot3x3 | pixel7 | left | 26, 969, 20.0 | 15, 639, 21.1 | 1 |
| plot3x3 | se | right | 26, 744, 20.1 | 15, 470, 20.8 | 1 |
| plot3x3 | se | left | 26, 740, 20.1 | 15, 488, 20.8 | 1 |
| sell | i13 | right | 6, 165 | 3, 69 | 0 |
| sell | i13 | left | 6, 172 | 3, 64 | 0 |
| sell | pixel7 | right | 6, 172 | 3, 72 | 0 |
| sell | pixel7 | left | 6, 180 | 3, 67 | 0 |
| sell | se | right | 6, 132 | 3, 55 | 0 |
| sell | se | left | 6, 137 | 3, 51 | 0 |
| villager | i13 | right | 5, 185 | 4, 152 | 0 |
| villager | i13 | left | 5, 169 | 4, 137 | 0 |
| villager | pixel7 | right | 5, 193 | 4, 159 | 0 |
| villager | pixel7 | left | 5, 177 | 4, 144 | 0 |
| villager | se | right | 5, 147 | 4, 121 | 0 |
| villager | se | left | 5, 135 | 4, 110 | 0 |
| machine | i13 | right | 3, 100 | 3, 33 | 0 |
| machine | i13 | left | 3, 107 | 3, 51 | 0 |
| machine | pixel7 | right | 3, 105 | 3, 35 | 0 |
| machine | pixel7 | left | 3, 112 | 3, 53 | 0 |
| machine | se | right | 3, 80 | 3, 26 | 0 |
| machine | se | left | 3, 85 | 3, 41 | 0 |
| fish | i13 | right | 13, 148, 11.9 | 11, 107, 9.1 | 1 |
| fish | i13 | left | 11, 148, 8.4 | 8, 105, 8.8 | 1 |
| fish | pixel7 | right | 14, 154, 11.5 | 10, 112, 9.8 | 1 |
| fish | pixel7 | left | 12, 154, 9.3 | 10, 110, 8.6 | 1 |
| fish | se | right | 10, 118, 5.9 | 11, 85, 11.2 | 1 |
| fish | se | left | 16, 118, 16.7 | 13, 84, 13.9 | 1 |
| bagUse | i13 | right | 5, 135 | 5, 156 | 0 |
| bagUse | i13 | left | 5, 119 | 5, 195 | 0 |
| bagUse | pixel7 | right | 5, 141 | 5, 163 | 0 |
| bagUse | pixel7 | left | 5, 125 | 5, 203 | 0 |
| bagUse | se | right | 5, 107 | 5, 124 | 0 |
| bagUse | se | left | 5, 95 | 5, 155 | 0 |
| switchHotbar | i13 | right | 2, 30 | 2, 30 | 2 |
| switchHotbar | i13 | left | 2, 30 | 2, 30 | 2 |
| switchHotbar | pixel7 | right | 2, 32 | 2, 32 | 2 |
| switchHotbar | pixel7 | left | 2, 32 | 2, 32 | 2 |
| switchHotbar | se | right | 2, 24 | 2, 24 | 2 |
| switchHotbar | se | left | 2, 24 | 2, 24 | 2 |
| toTown | i13 | right | 1, 23, 9.6 | 1, 17, 9.0 | 0 |
| toTown | i13 | left | 1, 23, 9.6 | 1, 17, 9.1 | 0 |
| toTown | pixel7 | right | 1, 24, 9.6 | 1, 18, 9.0 | 0 |
| toTown | pixel7 | left | 1, 24, 9.6 | 1, 18, 9.0 | 0 |
| toTown | se | right | 1, 18, 9.6 | 1, 14, 9.1 | 0 |
| toTown | se | left | 1, 18, 9.6 | 1, 14, 9.0 | 0 |

The 3x3 plot loop under the final ruling is two hop taps from the door, one tap on the seeds, then for each of
the 3 rows a tap beside it and one paint from Action, twice (prepare, harvest). With world-painting (M5, removed
by the ruling) it was 5 gestures and about 230 mm. Human-like stops (release 120 / 180 ms after the sprite
looks centred, M2 on): 0 corrections everywhere (51 gestures and 25 corrections at 180 ms before M2).

## Open critic findings (controls critic, rounds 1-4), by severity

The critic's write-ups are in `C:/Users/andre/dev/tiny-acre/controls-critique/review-*.md`; its final round on
`cb5dce5` had not reported when this was written.

- **Major, design (not yet re-tested by the critic):** the Action-paint design of the last ruling is new; the
  critic was asked to re-test it from scratch (arming under jitter, line switching under 2-3 mm wobble,
  cancellation, haptic count).
- **Major, accepted trade-off:** a released stick stop lands one tile late for reactions over about 200 ms (the
  settle window is 13 px; reaction spread is wider than a tile at 4 tiles/s). Measured: 78% on target at
  180 +- 30 ms in the model. The Fine stick and tap-to-walk are the mitigations.
- **Major, open:** the 3x3 plot by Action-paint costs 15 gestures and about 600 mm of thumb travel (the plan's
  goal was 8 and 150 mm). See owner question 1.
- **Minor:** SE bag cells are 37 CSS px (8 columns cannot reach 44 px on a 323 px canvas).
- **Minor:** tap accuracy without magnets is the tile itself: the bin opens on 97% / 80% of 1 / 1.5 mm-spread
  taps on an iPhone 13 (SE 88% / 64-68%); a crop tile 83-86% at 1.5 mm, with 0 wrong-tile acts.
- **Minor:** the shop's top tabs (and one page arrow) are the only sheet targets outside the left thumb's
  comfortable zone on an iPhone 13.
- **Fixed, verified by the critic in later rounds:** review-1 F1-F3, F5-F10; review-2 via the rulings;
  review-3 blockers and the review-4 ring blockers are addressed by the last ruling's redesign (to be confirmed
  in its final round).

## Next steps (start here)

1. **Read** `DECISIONS.md` "One-thumb controls", then `src/input/gesture.ts` (`ActionPress`, `PressTrack`),
   `src/input/WorldTouch.ts`, `src/scenes/UIScene.ts` (`actionEvents`), `src/scenes/WorldScene.ts`
   (tap-to-move, `onPaintLine` / `onPaintEnd`, `startNextWork`, `arrive`).
2. **Run** `npm run build && npm run e2e:controls` (two phones at a time; set `E2E_CONTROLS_PARALLEL=1` on a slow
   machine) and `PROFILES=i13,pixel7,se npm run bench:thumb`; the thresholds for the current design are the
   `M7` block in `scripts/bench-thresholds.json`.
3. **Plot cost (owner question 1):** if the owner wants the 3x3 loop near 5 gestures again, the smallest change
   is letting a painted line turn: after the line is drawn, a pause of ~250 ms with the finger still, then a drag
   at right angles, starts a second straight segment from the line's end (serpentine), still never adding
   neighbours by wobble. `ActionPress.paintMove` would keep a list of segments; `WorldScene.paintLineTiles`
   builds the tiles from them; tests in `tests/action-press.test.ts`.
4. **Real-phone pass** (below) before tuning numbers: arm time (300 ms), paint step (8 px + 10 px per tile),
   ring sector (0.44), settle window (13 px), turn hold (100 ms), touch compensation (0.7 mm).
5. **Native haptics:** `src/platform/native.ts` maps tick to a light impact, medium to a medium impact, error to
   the error notification. Tune on a phone with the owner.
6. **Native edge gestures:** on Android, exclude the dock from system gestures
   (`View.setSystemGestureExclusionRects`) so a flick on Action never triggers "back" (plan M6 note).
7. **Bag on the SE:** gapless bag cells (hit areas that meet) would make the 37 px cells easier to hit without
   changing the 8-column layout.
8. **Hotbar (owner decision 5):** the benchmark now changes tools 0-1 times per loop; slots 1 and 8 stay a
   stretch on big phones. Revisit the 8-slot row once the owner has played with the ring.

## Real-phone checklist (owner)

Do each with the right thumb only, then the left thumb only (Left hand on), phone held normally.

- [ ] Tap a tile 4-6 tiles away: does the farmer walk there? Tap a dry crop, a ripe crop, the bin, a villager.
- [ ] Tap grass and empty soil: it should only walk, never till or plant. Tap your own tile: a small ring.
- [ ] Hold Action still until it ticks (about a third of a second), drag toward the middle of the screen, lift:
      is the row the one you meant? Drag back to the start before lifting: nothing should happen.
- [ ] Hold Action still and lift without dragging: nothing should happen. Quick taps on Action: one use each.
- [ ] Flick Action sideways and lift at once: the ring stays open; tap an item. Flick, slide to an item, rest,
      lift. Did a miss ever pick the neighbour?
- [ ] Swipe Action up and down: tool changes only; never a swing of the old tool.
- [ ] Drag anywhere on the world to steer; stop on a tile you choose five times. How many corrections?
- [ ] Rest your thumb on the world, then steer: did anything get worked?
- [ ] Menu (upper left of the dock for the right hand): can you open it without regripping? Did a stick drag
      ever open it?
- [ ] Options: the help card at the top, the volume -/+ by the tabs, Options > Controls switches.
- [ ] With vibration on (Android web or the native app): are the ticks light enough? Is the paint confirm clear?
- [ ] iPhone: does a swipe up from the hotbar ever trigger the home gesture? Android: does a flick from Action
      toward the edge ever trigger "back"?

## Questions for the owner

1. The straight-line Action paint costs 15 gestures for a 3x3 plot. Allow a line to turn (serpentine, next steps
   3), allow a 3-wide swath, or keep it strictly straight?
2. Should painting keep working each tile "until done for today" (till, plant, water in one pass), or one step
   per tile like a hold? (`WORK_USES_PER_TILE` in `WorldScene.ts`.)
3. Holding Action on touch no longer repeats the action (the hold arms painting). Is that the feel you want, or
   should a still hold that is not dragged repeat the step after the arm?
4. The settle window favours late releases (up to about 200 ms). Do you release early or late when you stop the
   farmer on a tile?
5. Which phone do you play on? The bench can weight that profile.
