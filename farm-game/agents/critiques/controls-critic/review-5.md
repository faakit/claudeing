# Review 5 (final round): Action paint, forgiving ring, M7 (cb5dce5 + docs 9457256)

**Verdict: every blocker from reviews 3 and 4 is fixed and verified, and the build is safe to hand to the owner's phone.** One major predictability issue remains on Action: a still press of about 290 ms or more does nothing, and two hints still say "Hold Action to keep working". The plot loop's 15 gestures is a declared trade-off for the owner to decide.

## Method

- Frozen `9457256` in `round-5/farm-game` on port 5181.
- Probes:
  - `tools/r3-probe.mjs` (world slow taps, rest-then-steer, hesitant stick on soil);
  - `tools/r5-probe.mjs` (Action press length, rolled Action taps, paint line length and direction);
  - `tools/r5-cancel.mjs`;
  - `tools/r4-probe.mjs` and `r4-acts.mjs`, updated to the new ring (7 items, r 56, 270 to 100 degrees);
  - `tools/r5-flick.mjs`.
- Phones: i13, SE and Pixel 7, both hands.
- Also run:
  - bench, all tasks on i13 and SE, both hands: 36/36 ok;
  - `e2e:controls` on Pixel 7, Pro Max and Fold: OK;
  - `npm run perf`: within budget, with the tap-route row at 0.96 ms and 2 draws;
  - `vitest`: 579 passed;
  - reach map: `round-5/reach/tables.md`.

## Earlier findings, re-tested

| id                         | result                                                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 slow tap tills         | FIXED: still world touches of 120-450 ms on tillable grass work 0 tiles (112/112 walk only; i13 and SE, both hands).                                              |
| 3.2 rest-then-steer paints | FIXED: rests of 100-500 ms, then steer: walked 96/96. Hesitant stick drags on soil arm 0/120.                                                                     |
| 3.3 wobble adds rows       | FIXED by design: lines are straight from the farmer. Direction is right 17-20/20 at σ 2 mm lateral wobble; the misses are very short drags.                       |
| 3.4 loop back commits      | FIXED: dragging back to the start works 0 (8/8). Dragging back halfway works the shorter line (2 tiles, 8/8).                                                     |
| 3.5 travel                 | OPEN as an owner question: plot3x3 is 15 gestures and 470-612 mm (see F2).                                                                                        |
| 3.6 haptic density         | FIXED: 2-3 vibrations per painted row (arm, tiles, commit), none during the work.                                                                                 |
| 4.1 ring fires Action      | FIXED: 0 acts in 7/7 exact picks per hand, 0 in 168 jittered picks, and 0 in 112 sticky picks.                                                                    |
| 4.2 flick-and-lift picks   | FIXED for real flicks: lift at once, or after 40 ms, leaves the sticky menu 16/16 with 0 tool changes. A pause of 120 ms or more before lifting still picks (F5). |
| 4.3 ring accuracy          | FIXED at σ 1.2 mm: 41-42/42 on i13 and Pixel 7, both hands. At σ 2 mm: 38-39/42 on i13 and 34-38/42 on SE (F4). Sticky tap picks: 23-27/28.                       |
| 4.4 Options reach          | PARTLY: volume now comfortable; toggles moved up: Sound hard (right), Vibrate hard (left); 7-8/19 outside comfort (F6).                                           |

## Findings (final round)

1. **MAJOR: a slow press on Action does nothing.**
   - Evidence (`press2.log` and `a.log`, i13, Pixel 7 and SE, both hands, 3 presses each): still presses of 80, 180 and 260 ms each work 1 tile; presses of **290, 320, 400 and 600 ms work 0**. The arm ticks, and lifting without a drag cancels.
   - Two hints still teach the old behaviour:
     - `MenuPanel.ts:271` "Tip: hold Action to keep working.";
     - `UIScene.ts:215`, the welcome toast when tap-to-walk is off: "Hold Action to keep working".
   - Ask (owner question 3 in NEXT-STEPS-CONTROLS): an armed press lifted without a drag acts once, like a tap. Fix the two strings either way.
2. **MAJOR (owner trade-off): the plot loop costs more than planned.** plot3x3 is 15 gestures, 470-612 mm and about 21 s, against the plan's <= 8 gestures and <= 150 mm. M0 was 26 / 933 mm; world paint briefly reached 5 / 230 mm.
   - The serpentine continuation in NEXT-STEPS step 3 is the right next experiment.
3. **MAJOR (accepted trade-off): late stops.** On target: 180 ± 30 ms gave 14-15/16 in my round-2 probe (movement unchanged since; 78% in the agent's model); 120 ± 30 gave 16/16. The owner checklist covers it.
4. **MINOR: ring accuracy at σ 2 mm on SE left is 34/42 (81%)**, against the 85% bar; 6 of the 8 misses picked nothing, which is safe. i13 is 90-93%.
5. **MINOR: a slide that rests short of the items picks one.** A flick of 22-44 px followed by a pause of 120 ms or more before lifting picked the 180-degree item 4/4. The finger was 22-35 px from Action's centre, short of the item ring at 56.
   - Ask: a slide pick needs the finger at least about 36 px out; nearer, a rest leaves the sticky menu.
6. **MINOR: Options toggles are hard to reach.** menu-opts has 7/19 (right) and 8/19 (left) targets outside comfort: Sound hard for the right thumb, Vibrate hard for the left.
7. **MINOR: a press that rolls 9 px or more does nothing, silently.** That is 3 mm on i13 and 2.4 mm on SE (`rolltap`: 0/16 work and 0 tool changes at 9.5 and 11 px). This is consistent with the single threshold. Ask: a faint "no" pulse on the button, so it is not silent.
8. **MINOR: bagUse thumb travel rose for the left hand**: 195 mm against 119 mm before on i13 (Pixel 7: 203 vs 125), because of the ring Bag item and the left layout. The gesture count is the same (5).
9. **NIT:** the `ActionPress` comment says "one per 14 px"; the code uses `PAINT_STEP_PX = 10`.

## Accepted, recorded by the agent

- SE bag cells at 37 px.
- Bin tap accuracy without magnets: SE 64-68% at 1.5 mm (owner ruling 4).
- Shop top tabs outside comfort.
