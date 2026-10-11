# Review 6 (onboarding round 2, milestone 1): 94cb9c3

Verdict: both regressions from the merge are fixed, and day 2 is now short. 14/14 runs reach town on day 2. One new
major: if you wander into the house during free time, nothing points you out of it.

Build `round-6/` (94cb9c3). Same bot (`tools/human.mjs`, with DIAG captures on stalls and idle). 12 seeds plus 2 clean
never-paint runs. Runs: `round-6/runs/*/`.

## Numbers

|                             | base 6d5e480 (round 5)           | 94cb9c3                                       |
| --------------------------- | -------------------------------- | --------------------------------------------- |
| reach town on day 2         | 9/12                             | **14/14**                                     |
| never-paint runs            | 1 dead end (540 s), 1 mail stall | 4/4 pass (clean never: 143 s, 158 s)          |
| mail step                   | 2 runs stuck 300+ s              | 0 stalls (lit-button pointer, gift loop gone) |
| waking to town on day 2     | water2 14-76 s, then the walk    | 28-50 s (rain morning)                        |
| New Game to waking on day 2 | 116-191 s                        | 111-166 s (one outlier 377 s, finding 1)      |
| clean-run steps over 45 s   | water2 in 3 runs                 | none                                          |

Bed offer ("All done! Sleep, or keep exploring." / "...at home, or explore." in town) showed in 13/14 runs, at 8:29-8:49 AM.

## Findings

1. **major. Free time inside the house is silent.** In se-right-s13-never the farmer was in the house (5,7) on goal 3
   (wild goods) for 282 s, with no coach step and no goal arrow, until the 6 PM bed step. Only the 40 s idle hint
   showed. The DIAG rerun reproduces it (`round-6/runs/diag-se-right-s13/log.txt`: step null, arrowVis false, map
   house, five times over 126 s). The goal has no `where` for the house, so nothing points at the door. Ask: on a map
   without a `where` for the current goal, the goal arrow (or an errand coach line) points at the exit toward the
   nearest map that has one.
2. **minor. Day 2's first town visit is a closed shop in 13/14 runs** (arrival 6:52-7:5x). The hand points at a
   locked door for about 30-40 s ("Mara's shop opens at 8 AM."). Ask: before 8, point at what you can do now (the
   wild goods at the gate if any are left, or the board), then Mara at 8.
3. **minor. Stale box on the mailbox during the Menu step.** Two marks show at once
   (`round-6/runs/i13-right-clean/21-step-menu.png`). Ask: clear the object box when the step changes.
4. **nit. The ring tip toast ("Tip: flick Action sideways...") fired while the coach line was up**
   (se-left-s2-human). Ask: hold controls tips back during the guided days, as tips.json already is.
5. **nit. "+1 Wild Leek" and the "GOAL COMPLETE +40g" banner overlap** at the top of the world view
   (`round-6/runs/se-left-clean/17-step-bedOffer.png`).

## Verified fixed

- 5.1 never-paint dead end: 0 refusal loops in 4 never-paint runs.
- 5.2 mail: 14/14 passed mail.
- 5.3 / 4.3 day-2 water: rain morning, step passes at once.

Not yet tested: the day-3 waterDaily intro (first dry morning). I'll run to day 3 next round.
