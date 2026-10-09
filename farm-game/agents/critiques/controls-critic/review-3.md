# Review 3: owner rulings + M5 paint a row (931b9d8)

**Verdict: the rulings land well, and paint makes field work 5 gestures (from 26). But the 250 ms arm on a world tile collides with how thumbs rest and hesitate: a slow tap or a pause before steering hoes the field.** That is my R1 blocker, now reproduced. Two blockers and two majors.

## Method

- Frozen `931b9d8` in `round-3/farm-game` on port 5181.
- Probe: `tools/r3-probe.mjs` (sections slowtap, reststeer, row, cancel and stickonsoil).
- Phones: i13 and SE, both hands.
- Logs: `round-3/a.log` and `round-3/b.log`.
- Agent bench read: `agents/out/controls/bench-m5.md`.
- Tillable plot used: x 9-12, y 16-23 (`workable near plot` in a.log). The player stands at (10,16).

## Follow-ups from review 2

| # | status | note |
|---|---|---|
| 2.1 tap landscaping | FIXED (ruling 1) | Taps of 120-200 ms on grass walk only (16/16). But see B1: a slower still touch tills. |
| 2.2 magnets | FIXED (ruling 4) | Accepted, with the agent's tile-size accuracy numbers replacing my 85% bar. |
| 2.3 explicit wins / seeds | FIXED (rulings 2-3) | Paint keeps the chain as owner ruling 5. Accepted. |
| 2.4 bench errands | FIXED | sell 3, villager 4, machine 3 (one hop tap; jar off-screen), from bench-m5.md. |
| 2.5 wrong-kind acts | ACCEPTED | |
| 2.6 fish | moved to M6 | |
| 2.7 perf route | deferred to M7 | Tracked. |
| 2.8 tap tip | deferred to M7 | Tracked. |

## Findings

1. **BLOCKER: a slow still tap on tillable grass tills it.**
   - Evidence (slowtap; 4 trials per duration, still touch with 0.5 mm jitter on (9,19)):
     - 120 and 200 ms: walk only, 4/4 on i13 and SE, both hands;
     - 240 ms: till, 3-4/4;
     - 270, 300, 350 and 450 ms: till, 4/4 everywhere.
   - The arm accepts any `actKindAt` tile (the full auto tool), and a long-press without a drag "works one tile". After ruling 1, that is no longer "the same as a tap".
   - Deliberate or slow thumb taps often last 250-350 ms, so the same gesture gives two outcomes depending on its length. This breaks R1.
   - Ask: a paint that never left its first tile commits as a tap (walk, plus a TAP_ACTS act if one applies), never a till or plant.
   - Accept: still touches of 240-600 ms on grass or empty soil walk only, with 0 tiles worked.
2. **BLOCKER: a rest or hesitation before steering paints instead of walking.**
   - Evidence:
     - reststeer (i13 right): the thumb lands on a plot tile, rests, then drags about 30 px.
       - Rest 100 ms: walked 4/4.
       - Rest 200, 240, 280, 350 and 500 ms: **painted 4/4** each.
       - Measured rests include about 20-40 ms of CDP latency, and the drag reaches 9 px only on its 2nd move, about 60-80 ms in.
     - stickonsoil: a stick drag starting on tilled soil after a natural 60-230 ms pause, with a slow start (5 px steps), armed paint in **9-10 of 30** on i13 and SE, both hands. Your e2e had 0 of 6 because it starts moving at once.
   - The stick zone is now the whole world view (THUMB_ZONE_Y = HUD_H). When the farmer stands in the field, the bottom of the view, where the thumb rests, is field.
   - Ask: separate "rest, then steer" from "press, then paint". Options:
     - (a) Touches that start in the thumb's rest band never arm: the lower part of the world view (roughly where the stick usually starts) and the dock. The farmer, and the tiles you'd paint, sit mid-screen.
     - (b) After the arm, a first movement that is a push (leaves the armed tile and keeps going in a straight line faster than about 1 tile per 100 ms) disarms back to the stick.
     - (c) A longer arm (300-350 ms) combined with (a).
   - If none of these meet the bar, tell the coordinator, so the owner can reconsider the plan's alternative of starting paint from Action.
   - Accept:
     - rest-then-steer from the lower half of the world view with rests of 100-500 ms walks >= 95%;
     - stick drags with a natural hesitation (60-230 ms pause, slow start) arm 0 of 100;
     - a deliberate paint (hold 300 ms mid-screen on the plot, then drag) arms >= 95%.
3. **MAJOR: a wobbly drag paints the neighbouring row.**
   - Evidence (row; arm on (9,18), drag to (11,18) with sinusoidal lateral wobble):
     - 1 mm wobble: exact 6/6 everywhere;
     - 2 mm wobble: exact 4-6/6, with extra tiles 10,17 / 9,17 / 11,17 / 10,19 / 9,19;
     - 3 mm wobble: exact 0-1/6, with 7-15 extra tiles and, on SE right, some tiles missing.
   - Every extra tile gets till, plant and water, so it costs seeds and energy.
   - Ask: axis lock with hysteresis. Once two tiles define a line, an off-line tile joins only when the finger is at least 0.75 tile (about 12 px) off the line's centre. L-shaped rows still work with a deliberate move.
   - Accept: a 3-tile row with 2 mm wobble is exact >= 95%, and with 3 mm >= 80%, on i13 and SE.
4. **MAJOR: dragging back to the origin still works one tile.**
   - Evidence: in the cancel section's loopBack (paint 9 to 11, drag back over 10 to 9, lift), 1 tile was worked in every trial: 4/4 on i13 and SE, both hands.
   - Backtracking un-queues tiles, so the queue collapses to the origin, which then commits like a long-press.
   - Lifting on the dock does cancel: 0 tiles, all 16 trials. Backtracking to 2 tiles works exactly 2.
   - Ask: once a queue has held 2 or more tiles, ending with only the origin cancels.
   - Accept: loopBack works 0.
5. **MINOR: plot3x3 thumb travel is 229-252 mm against the M5 target of <= 150 mm.**
   - Evidence: bench-m5.md, i13 and Pixel 7, both hands. One touch is in the stretch zone (the hop taps high on the screen, as you noted).
   - Ask: report travel split into "hop to plot" and "paint". If the paint gestures are <= 150 mm, re-scope the threshold to them and say so. Otherwise, bring the hops lower.
6. **NIT: haptic density.** A 3-tile paint fired 9 vibrations (arm, tiles added, then every till, plant and water use); with wobble, 11-16. Every one is throttled, but owner decision 6 says "light".
   - Ask: during auto work, tick once per finished tile, not per use.

## Accepted and verified

- Known gap: paint arms only under 9 px of roll. This follows from the single threshold; I accept it.
- Lifting on the dock cancels (16/16).
- Backtracking un-queues correctly.
- Ruling 1 for normal-length taps (16/16 walk only).
- bench-m5: plot3x3 is 5 gestures with 1 tool change (the seed tap), down from 26 at M1. sell is 3 (was 6), villager 4 (was 5).
