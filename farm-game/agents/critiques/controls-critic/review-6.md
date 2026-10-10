# Review 6: controls round 3 (d8591ce, 9168924, 9e66c26)

**Verdict: owner items 1, 3, 4, 5 and 6 are met, and nothing regressed from the old blockers. Serpentine paint works open-loop at σ 1 mm on every phone with 0 strays. But a painted tile can appear (with its tick) and then vanish at a threshold or a turn, and that is what breaks a player who follows the preview.** There is also a new tap rule that walks you into the farmhouse from the front path about 1 time in 8.

## Method

- Frozen copies:
  - `round-6` = d8591ce;
  - `round-7` = 9168924;
  - `round-8` = 9e66c26 (paint corner rule only, per `git diff --stat`, so the ring, tap and reach results from round 7 carry over).
- Real CDP touches. Probes, all in `tools/`:
  - `r6-paint.mjs`: 2D wobble field as agreed (λ 12-25 mm, smoothed noise, 50 mm/s slowing to 40% near corners, r 0 or 2 mm, 0-2 mm end overshoot), open- and closed-loop;
  - `r8-closed.mjs`: closed-loop serpentine with a trace of every preview change;
  - `r8-turn.mjs`: deterministic turn;
  - `r6-freeze.mjs`: lateral drift on a long row;
  - `r4-probe.mjs`: ring, live `ringGeometry`, seeds 1 and 2;
  - `r6-flick.mjs`: ring dead zone;
  - `r5-probe.mjs`: press length and immediate roll;
  - `r7-stillroll.mjs`: roll after stillness;
  - `r3-probe.mjs`: world regressions;
  - `r6-taps.mjs`: door and facade;
  - `reach-map.mjs`.
- Event names were diffed against `integration/round2-2026-10-09`: identical.

## Owner items

| item                              | result                                                                                                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1 press-and-lift acts once       | **MET.** Still presses of 80, 180, 290, 400, 700 and 1500 ms gave exactly 1 use, 18/18 per phone (i13, Pixel 7, SE, both hands). The bag hint is fixed.                                                               |
| O2 serpentine, no accidental work | **PARTLY.** See F1 and F3. Open-loop σ 1: exact on 14-20 of 15-20 trials, 0 strays. Turns: drift 0/6, deliberate L 6/6, 3 mm arc 0/6 (d8591ce). The bench plot3x3 is 7 gestures, every touch comfortable, 199-286 mm. |
| O3 ring                           | **MET within noise.** Results below the table.                                                                                                                                                                        |
| O4 Options reach                  | **MET.** Sound and Vibrate are comfortable for both thumbs (i13). menu-opts has 5/19 targets outside comfort, all stretch, 0 hard. All screens: i13 80% for both hands.                                               |
| O5 rolled press                   | **MET.** An immediate 9.5-11 px roll gives a reject log entry and a vibration, 0 uses (16/16 per phone). Still for 150 ms then a 9.5-13 px roll: 1 use (12/12 on i13 and SE). Rolls under 9 px act once.              |
| O6 left-hand bag                  | **MET.** i13: 103 mm right, 83 left; Pixel 7: 108 / 87 (agent bench, tap-walk). With the column mirrored, left equals right.                                                                                          |
| Events                            | **MET.** Names unchanged. paintLine keeps dir and tiles, plus an optional path.                                                                                                                                       |
| Old blockers                      | **Hold.** Slow world taps worked 0 tiles in 112; rest-then-steer painted 0 of 96; hesitant stick drags armed 0 of 120. Ring acts: 0.                                                                                  |

O3 ring detail:

| check                                   | i13 right | i13 left | SE right              | SE left         |
| --------------------------------------- | --------- | -------- | --------------------- | --------------- |
| picks at σ 2 mm (seeds 1+2, 84 per row) | 80/84     | 83/84    | 73/84 (2 wrong, 2.4%) | 38/42 (1 wrong) |
| sticky tap                              | 27/28     | 27/28    | 22-25/28              | 26/28           |

- σ 1.2 mm on SE: 41/42 right and 42/42 left.
- Flick-and-lift goes sticky 16/16.

## Findings

1. **MAJOR: painted tiles flicker and retract, so following the preview fails.**
   - Evidence, closed-loop runs (the bot turns when the preview shows the leg's count; `round-8/closed-trace.log` and `closed-trace2.log`, i13 right, σ 2): **4 of 12 trials** failed.
     - Trial 4 (seed 1): `9,19` appeared at finger (-41, 15), and the bot turned right. One move later, at (-36, 14), it was gone. The line never started another leg.
     - Trial 1 (seed 1): `11,20` appeared at (-2, 28) and vanished at (-14, 27) on the next leg.
     - Trials 2 and 5 (seed 2): the 3rd tile `9,18` appeared at x = -40 and vanished at x = -39, a 1 px wobble. The serpentine then ran 2 wide.
   - Each appearance ticks the haptic, so the player feels a tile that then isn't there.
   - Round 7, 20 trials per row, closed-loop σ 2: exact 7-14/20 with 7-10 stray tiles per row. Most of those are this effect plus a few first-leg misreads.
   - Ask:
     - hysteresis on the tile count: a tile appears at the boundary and goes only when the finger is at least 0.4-0.5 step back along the leg;
     - a shown, ticked tile never retracts because of a perpendicular move or a corner re-average; only backtracking along the path removes it.
   - Accept: closed-loop σ 2 is exact >= 90% with 0 strays on i13 and SE, both hands, and ticks fired equal the final tile count.
2. **MAJOR: walk taps on the front path enter the farmhouse.**
   - Evidence: `r6-taps.mjs`, centre-aimed taps with σ 1.5 mm on the row just below the farmhouse wall (row 8, 3 tiles either side of the door at 14,7). The house was entered **3/24 on i13 and 3/24 on SE** (aimed at 12,8, 13,8 and 17,8).
   - Cause: a tap that lands on the wall's bottom row goes to the facade's door (`solidOwner`, FACADE_SIDE 4). That turns a walk into a scene change.
   - Ask: a tap on the bottom wall row more than 1 tile from the door resolves to the walkable tile below it (a walk). Roof and upper-wall taps, and the door's own column +-1, still lead to the door.
   - Accept: <= 1 entry in 50 walk taps on the front row, and taps on the door or upper art still enter >= 95%.
3. **MAJOR (agreed scope): open-loop serpentine at σ 2 still strays.**
   - On 9e66c26:
     - i13 right: 9/15 exact, 4 strays;
     - SE left: 6/15 exact, 6 strays.
   - On 9168924 (20 per row): 2-14/20 exact, 0-9 strays.
   - Typical stray: the first leg overshoots to 4 tiles and every row follows that span ("…8,18 8,19…9,20").
   - I accept your position that σ 2 belongs closed-loop and that the open-loop bar sits at σ 1 (met: 14-20/15-20, 0 strays everywhere). That acceptance depends on F1, because closed loop only helps if the preview is stable.
4. **MINOR: the ring dead zone is shorter on SE.**
   - Flick, rest 150 ms, lift: at 34 px the ring stays sticky on i13 (both hands) but **picks 4/4 on SE** (both hands). At 30 px it is sticky everywhere.
   - The aim correction is in mm, so it adds more px on SE.
   - Ask: test the dead zone on the raw finger distance, or scale it, so 22-35 px rests stay sticky on every phone.
5. **MINOR: sticky-tap picks on SE right are 22-25/28 (79-89%)**, with up to 3 wrong in a run; the bar is 90%. Pick-by-slide meets its bar.
6. **ACCEPTED: plot3x3 thumb travel** is 250-286 mm on i13 left and Pixel 7 (bar <= 250). The 16 px step trades about 40 mm for accuracy, and that's the right trade. SE is 199-218 mm.
7. **ACCEPTED: straight lines at σ 3 on SE** are below 85% (SE left: 11/15 on 9e66c26, 14/20 on 9168924). Your slope argument holds. The SE bar is now σ 2 >= 93% (14-20 of 15-20 measured).

## Notes

- Your first-leg misread (a vertical start) still produces 3-6-tile strays at σ 3 ("9,18 9,19 9,20", "8,19 8,20…"). Lowering the first leg's hysteresis from 1.6 to about 1.2 until it locks would let a diagonal start correct itself. Low priority.
- A deterministic left-then-down turn is clean (`r8-turn.mjs`), and a smooth lateral drift up to 13 px never freezes a row (`r6-freeze.mjs`).
