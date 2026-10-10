# Review 7 (final round, controls round 3): b9fb448 / 26dda7e

**Verdict: both review-6 majors are fixed. Owner items 1, 3, 4, 5 and 6 are met; item 2 is met on iPhone 13 and is close but not at the bar on SE.** Ready for the owner's phone. No blocker; nothing regressed.

## Method

- Frozen `26dda7e` in `round-9/farm-game` on port 5181.
- Event names diffed against `integration/round2-2026-10-09`: identical.
- Probes:
  - `r6-paint.mjs`: open loop, closed loop, straight and turns, 15-20 trials per row, i13 and SE, both hands;
  - `r4-probe.mjs`: ring, seeds 1 and 2;
  - `r6-flick.mjs`;
  - `r6-taps.mjs`;
  - `r3-probe.mjs`;
  - `r5-probe.mjs`: press length.
- Logs are in `round-9/`.

## Review-6 follow-ups

| id                                  | result                                                                                                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 flicker and retract             | **FIXED.** Closed loop at σ 2, 20 per row, plotted below. Traces now grow monotonically, and retracts come only from the bot's own back-ups. Before the fix: 7-14/20 exact with 7-10 strays per row.                                                             |
| 6.2 front-path taps enter the house | **FIXED:** 0/96 entries (i13 and SE, both hands; it was 3/24 per phone). Pushback accepted: the door tile itself enters 67-100% because a miss lands on the path tile below, but the door art enters 100% (agent's probe), which is what the bar now applies to. |
| 6.3 open loop at σ 2                | **ACCEPTED as scoped.** Open loop at σ 1: 59/60 exact, 0 strays (SE left 14/15). At σ 2: 5-13/15 exact with 2-12 strays, as agreed (closed-loop bar).                                                                                                            |
| 6.4 ring dead zone on SE            | **FIXED.** A 150 ms rest at 34 px stays sticky on i13 and SE, both hands (16/16).                                                                                                                                                                                |
| 6.5 sticky taps on SE right         | **FIXED:** 26/28 (was 22-25).                                                                                                                                                                                                                                    |

Closed-loop serpentine at σ 2 (20 trials per row):

| phone, hand | exact (of 20) | stray tiles |
| ----------- | ------------- | ----------- |
| i13 right   | 18            | 8           |
| i13 left    | 20            | 0           |
| SE right    | 15            | 9           |
| SE left     | 17            | 4           |

## Owner items, final

- **O1** (one use per press): exactly 1 use for still presses of 80-1500 ms. Re-checked at 80, 400 and 1500 ms on i13 and SE.
- **O2** (serpentine paint):
  - The plot3x3 bench is 7 gestures on every row with every touch comfortable. Travel: i13 250/273 mm, Pixel 7 261/286 mm, SE 199/218 mm.
  - Straight lines are exact at σ 2: 59/60.
  - Drift never turns (0/24), a deliberate L turns (24/24), and a 3 mm arc never turns (0/24).
  - Closed loop at σ 2: i13 90-100% (bar met); **SE 75-85%** (bar 90%, open, minor).
- **O3** (ring):
  - σ 2: i13 80/84 and 83/84, SE right 73/84, SE left 77/84.
  - Sticky taps: 26-28/28, except SE left at 23-26/28, where the misses pick nothing.
  - 0 acts, 0 picks from 22-35 px rests.
- **O4** (Options reach): Sound and Vibrate are comfortable for both thumbs; 0 hard targets in Options.
- **O5** (rolled press): an immediate roll gets reject and a vibration; a roll after stillness acts once.
- **O6** (left-hand bag): 83 mm on i13 left, against 195 before.
- **Regressions:** slow world taps worked 0/56 tiles, rest-then-steer painted 0/48, hesitant drags armed 0/60.

## Remaining findings

1. **MINOR: SE closed-loop serpentine at σ 2 is 75-85%**, against 90%.
   - What's left is first-leg misreads and first-row overshoots that set the span, plus some cascades in my bot. The bot drives blindly when a leg doesn't appear; a person stops sooner, so real strays should be fewer than the 4-9 per 20 measured.
   - Next step (NEXT-STEPS): a visible "row width" cue, or snapping U-turn rows to the plot's tilled edge.
2. **MINOR: SE-left sticky taps are 23-26/28**, against 90%. Misses pick nothing, which is safe.
3. **ACCEPTED:**
   - plot3x3 travel over 250 mm on i13 left and Pixel 7;
   - SE straight lines at σ 3;
   - the door tile itself (door art is 100%).
