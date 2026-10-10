# Review 1: design note (a426aba, DECISIONS.md "## Guided start")

Verdict: approve the direction (harvest first, one line at the top, done by doing, progress kept in stats). Three
risks on the critical path need answers before M1.

1. **blocker (risk).** The door and the bed are on the day-1 critical path, and the fixes are labelled out of lane.
   In round 0, tapping the door walks to it and stops (round-0/shots/naive4-i13-right/05-tap-door.png). Your own
   C10 shows the bed's top half saying "Can't get there". If "tap the door" and "tap the bed" don't work, A1 fails.
   Ask: fix both in this branch, or make the coach teach what works (walk into the door). The e2e must tap the
   door and the bed's top half.
2. **major.** Paint as a required day-1 step. The controls critic's final round left 5.1 open: a still Action press
   of 290 ms or more does nothing. That is exactly the hesitant hold a beginner makes. Ask: the paint step also
   completes after 3 single Action works (teach the row, don't gate on it). Show the row preview before the drag.
   Bench it with a jittered human hold (200-450 ms).
3. **major.** Two text channels. Refusal toasts still appear near the dock while the coach line sits at the top
   ("Not your land yet", "Pick seeds on the hotbar first", "Nothing to water here"). Ask: while a step runs, the
   game's refusal toast for that step is either rewritten into the coach line or suppressed, so there is only ever
   one instruction.
4. **major.** "Next" after 60 s contradicts A4, and 60 s is a long time to be lost. Ask: escalate first, by about
   15 s (re-pulse, a hand that moves to the target, an edge arrow when off screen). Show "Next" only after the
   escalation fails, and only for optional steps (paint, forage), never for harvest, plant or sleep.
5. **major.** A day-2 morning budget is missing from the note. Ask: the guided day-2 summary has at most 4 lines
   (what sold, the weather, one news line, one pointer). The stale "Hold the Action button..." line goes in every
   path, guide or not. Jobs and the special order wait until the Goal intro.
6. **minor.** Replay semantics. Options > Controls > replay on a day-30 save: does Rosa leave parsnips again, do
   goals move, does the strip appear at night or indoors? Ask: replay never touches goals, gold or crops, and
   starts at the first step whose action is possible. Unit test it.
7. **minor.** Save v17 goal migration. Ask: a unit test for an old save sitting on each old early goal (till at 3/6,
   plant, water, sleep, forage) mapping to a sensible new goal without re-paying rewards, plus a v16 save
   mid-day 1.
8. **minor.** Tags plus coach line plus goal bar make three texts. Ask: at most one HUD tag at a time, and only
   when its step starts. The goal bar text must agree with the coach line on every step (seeds and paint both sit
   under the "plant" goal).
9. **minor.** The spawn moved to (14,11). Check that wake-up, the house exit and the e2e/bench fixtures that
   hard-code (14,9) or `place()` still agree, and that the plot top row is visible on SE (it wasn't before).
10. **nit.** The Skip confirm "Sure? Skip" lasts 3 s. Make sure the second tap can't land on a world tile when the
    strip shrinks, and that skipping mid-step leaves no ring or hand behind.

Track at M1: A1, A2, A3, A4 and A8 on i13/SE in both hands, with the naive bot (round-1).
