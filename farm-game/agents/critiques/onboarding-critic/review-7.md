# Review 7 (onboarding round 2, milestone 2): c031793

Verdict: every round-6 finding is fixed or accepted. 16/16 runs reach town on day 2, including 2 that wander into the
house during free time. The day-3 watering intro works. Two small gaps are left, both after the guided days.

Build `round-7/` (c031793). 12 seeds, 2 clean never-paint runs, 2 house wanders (WANDER_TO=house at forage/errands),
and 2 runs to day 3 (END=day3, one never-paint). Runs: `round-7/runs/*/`.

## Numbers

| | round 5 (base) | round 6 | round 7 |
|---|---|---|---|
| reach town on day 2 | 9/12 | 14/14 | **16/16** (+2 house wanders) |
| waking to town on day 2 | water2 14-76 s, then the walk | 28-50 s | 28-50 s |
| New Game to town on day 2 | 166-273 s | 142-215 s | 142-214 s |
| silent time in the house during free play | n/a | 282 s (1 run) | goal arrow after 5.5 s, out the door |
| day-3 waterDaily | n/a | n/a | 2/2: "Sunny! Water your crops: 5 left." to done in 11-12 s, row tip once |

## Verified

- 6.1 FIXED: the house has a `where`, and the arrow leads out.
- 6.2 FIXED: "Tap the counter to buy seeds." 16/16, and the counter sells before 8.
- 6.4 FIXED: 0 controls tips during the guided days.
- 6.3 REJECTED-OK: the box is the world's faced-interactable highlight, not a coach mark. Accepted.
- 6.5 noted in the other lane (Hud/FX).

## Findings

1. **minor. "It's late! Sleep before 2 AM." has no way home.** In both day-3 runs the farmer was in town at 10-11 PM
   on day 2. The line outlines the clock only (`aim: null`), and it took 120-125 s to reach bed (my STALL on `late`).
   Shot: `round-7/runs/day3-i13-right/56-stall-late.png`, 11:31 PM in town. Ask: point the way home, as the sleep step
   does (gate, then door, then bed): "Head home: tap the gate."
2. **minor. Waking in the house on day 3, nothing for about 17 s** before waterDaily, which needs the farm. DIAG at
   809 s: step null, arrowVis false, map house (`round-7/runs/day3-i13-right/log.txt`). Ask: waterDaily (and the
   coming welcomeJobs) point at the door while you're indoors, as mail does ("Tap the door to go outside.").
3. **nit. On day 2 the bot bought 1 of 5 items, then followed the goal arrow to the counter and closed the shop
   again for hours of game time.** That's my bot (it taps Close), not a player. But "Tap a price to buy seeds." only
   shows for the first purchase. Consider keeping it, with a count ("Buy 4 more."), while the goal is buy and the
   shop is open.
