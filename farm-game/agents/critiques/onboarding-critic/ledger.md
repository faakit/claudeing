# Onboarding critique ledger (new-player critic)

Worktree under review: `C:/Users/andre/dev/tiny-acre/onboarding` (branch `onboarding/guided-start`), read-only.
Onboarding agent: `a702564cc14e4bb30`. Baseline commit: 1dffd97. Frozen builds: `round-N/`.

Status keys: OPEN, FIXED (verified by me), REJECTED-OK (agent's reason accepted), IGNORED (raised again), DEFERRED.

## Acceptance criteria (sent in round 0)

| id  | criterion                                                                                                       | status                                |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A1  | Naive bot following only on-screen guidance finishes day 1 on i13 and SE, right and left hand, no dead ends     | PASS r3 (12/12)                       |
| A2  | First real action (a tilled tile) within 30 s of New Game, first goal within 90 s, day 1 under ~6 min median    | PASS r2                               |
| A3  | No instruction longer than one line (186 px toast, one row); no more than one instruction on screen             | PASS r2                               |
| A4  | Every step completes by doing, never by reading or a "Next" button; none completes by itself                    | PASS r4 with minor (4.1)              |
| A5  | Skip (one tap, any time) and replay (from Options) both work; skipped state saves                               | PASS r3                               |
| A6  | Nothing blocks the world: no modal, no input lock, clock policy explicit                                        | PASS r3                               |
| A7  | Recovers when you wander off (other map, wrong plot, house) within 1 step; no stale hints                       | PASS r3                               |
| A8  | Text fits on SE and i13, both hands; coach marks point at the right thing mirrored for left hand                | PASS r2                               |
| A9  | Close/reopen mid-tutorial resumes the same step (save round-trip, unit tested)                                  | PASS r2 (6/6)                         |
| A10 | Each control taught when first needed: walk, Action, auto tool, paint row, ring, Menu, bag, sell, sleep, energy | PASS r4 (4.2 open: stick demo)        |
| A11 | Step machine unit-tested; e2e new-player run on both profiles and hands; perf budget holds; verify green        | PASS r3 (verify green on frozen copy) |

## Findings

| id   | round | sev     | summary                                                                                                                                                | status                                                                                   |
| ---- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 0.1  | 0     | blocker | Welcome sends you to grass near spawn; all of it is "Not your land yet. Buy it at a sign." (9/9 attempts). Home plot is off-screen; nothing says where | FIXED (r2)                                                                               |
| 0.2  | 0     | major   | Only pointer is an arrow after 14 s with _zero_ input; any touch hides it; 40 s hint has no location                                                   | FIXED (r2)                                                                               |
| 0.3  | 0     | major   | Conflicting/over-long intro: toast 2 (3 lines) says tap-walk-and-work, ring says "Drag to walk"; taps never till                                       | FIXED (r2)                                                                               |
| 0.4  | 0     | major   | Tapping own tilled soil waters it (no walk); "watered" counts empty soil, so "Water 5 plants" can complete before any seed                             | FIXED for the guide (r2: water done by state); soil-tap watering is the controls agent's |
| 0.5  | 0     | major   | Auto tool does not plant: Action on soil waters, then "Pick seeds on the hotbar first." Seeds never pointed at                                         | FIXED (r2)                                                                               |
| 0.6  | 0     | major   | Tip burst while learning to till: swipe tip at 2nd till, paint tip at 3rd (1.5 s apart); ring tip later; teaches tool swap before it is needed         | FIXED (r2)                                                                               |
| 0.7  | 0     | major   | Door: tap walks to it and stops; you must push into it. Bed opens by tap. Inconsistent, untaught                                                       | FIXED in play (r2: door step passes 10/10)                                               |
| 0.8  | 0     | major   | Day 2 morning report: 11 lines, stale "Hold the Action button to work a whole row", scolds "Nothing shipped" when selling was never taught             | FIXED (r2: 3-line morning)                                                               |
| 0.9  | 0     | minor   | "Drag to walk" ring stays (over the plot) until a drag, even after tap-walking for a minute                                                            | FIXED (r2)                                                                               |
| 0.10 | 0     | minor   | Bed allowed (and goal pushes it) at 7:53 AM: day 1 lasts ~1 min; bin, selling, energy never come up on day 1                                           | OPEN as 2.7                                                                              |
| 0.11 | 0     | minor   | Left-handed: never offered; switch buried in Menu > Opts                                                                                               | FIXED (r2)                                                                               |
| 0.12 | 0     | nit     | Clock runs at 2 game-min/s through the welcome; reopen gives no "where was I"                                                                          | FIXED (r2: resume shows the step)                                                        |

## Round 1: design note review (a426aba)

Agent answers: start at (14,11); Rosa's 3 ripe parsnips, step 1 = tap one; welcome toasts removed; paint/swipe tips
suppressed while the guide runs; idle hint and arrow paused under coach marks; done = stat delta from the guide start
or state; clock runs; one line of 184 px or less at the top; Skip = tap + confirm tap within 3 s; replay in
Options > Controls; Left hand toggle on the welcome strip; "Next" after 60 s; save v17. Door, own-soil watering and
the bed's top half are recorded as out of lane.

| id   | round | sev            | summary                                                                                                                                    | status                                             |
| ---- | ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1.1  | 1     | blocker (risk) | Door tap and bed top half are on the day-1 critical path but labelled out of lane                                                          | FIXED in play (r2)                                 |
| 1.2  | 1     | major          | Paint as a required day-1 step vs open controls 5.1 (still hold of 290 ms or more does nothing); need a fallback and a jittered-hold bench | FIXED (r2: paint optional, never-paint passes)     |
| 1.3  | 1     | major          | Refusal toasts near the dock plus the coach at the top = two instructions                                                                  | FIXED (r2) but see 2.6                             |
| 1.4  | 1     | major          | "Next" at 60 s: escalate at about 15 s first; Next only for optional steps                                                                 | FIXED (r2: 15 s escalation, Next only on optional) |
| 1.5  | 1     | major          | Day-2 morning budget (4 lines or fewer, stale hold tip removed everywhere) not in the note                                                 | FIXED (r2)                                         |
| 1.6  | 1     | minor          | Replay semantics on late saves (no goals, gold or crops touched)                                                                           | FIXED (r2: unit + played)                          |
| 1.7  | 1     | minor          | v17 migration unit tests per old early goal                                                                                                | FIXED (r2: unit tests)                             |
| 1.8  | 1     | minor          | At most one HUD tag at a time; goal bar agrees with the coach line                                                                         | PARTIAL (2.5)                                      |
| 1.9  | 1     | minor          | Spawn move vs wake/exit/fixtures; plot visible on SE                                                                                       | FIXED (r2)                                         |
| 1.10 | 1     | nit            | Skip-confirm tap must not fall through to the world; no leftover marks                                                                     | FIXED for welcome; line menu = 2.1                 |

Round-0 items addressed by design (verify at M1): 0.1, 0.2, 0.3, 0.5, 0.6, 0.9, 0.10, 0.11 (design only). 0.4 and 0.7 depend on 1.1. 0.8 depends on 1.5.

## Round 2: M1 (96af2f9) + M1.1 (50862db)

Numbers: 9/12 human-ish runs reach day 2 by guidance (8 to town); first harvest 9-21 s; day 1 clean 38-54 s, human 61-81 s; New Game to town 101-147 s; 0 multi-row lines; reopen 6/6 same step.

| id   | round | sev           | summary                                                                                                                                                     | status                                                         |
| ---- | ----- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 2.1  | 2     | BLOCKER       | Coach line tap opens [Skip guide][Back]: hides guidance, never closes, one-tap Skip with no confirm, "x" glyph, swallows world taps; 4/12 runs fail by this | FIXED (r3: r3-skip both hands; 0 accidental skips in 12 runs)  |
| 2.2  | 2     | major         | water2 "tap one" needs every crop: 23 taps / 38.6 s; one crop 6+ no-effect taps                                                                             | FIXED count/pond (r3); length = 3.2                            |
| 2.3  | 2     | major         | coach.debug().aim stale while the menu is open (e2e blind to 2.1)                                                                                           | FIXED (r3)                                                     |
| 2.4  | 2     | minor         | Ship all leaves the bin open, then "Close this to carry on."                                                                                                | FIXED (r3)                                                     |
| 2.5  | 2     | minor         | HUD tags with no reason (Energy at grow, Clock at sleep, gold at water2)                                                                                    | FIXED (r3)                                                     |
| 2.6  | 2     | minor         | "Can't get there." in the coach line at the sleep step, not reworded                                                                                        | FIXED (r3)                                                     |
| 2.7  | 2     | minor (owner) | Bed at about 7:45 AM; clock/energy/late/tired never on day 1; shop shut on arrival day 2                                                                    | FIXED by ruling (r3: clock/energy lines, errands, bed at 6 PM) |
| 2.8  | 2     | minor         | Day-2 goal bar mismatch (agent-known)                                                                                                                       | FIXED (r3: town line matches Buy goal)                         |
| 2.9  | 2     | nit           | Welcome + line covered y 73-170 on M1; verify M1.1 give-way                                                                                                 | FIXED (r3)                                                     |
| 2.10 | 2     | nit           | Idle hint after a skip still says Interact                                                                                                                  | FIXED (r3)                                                     |

## Round 3: M3 (42f363a) (M2 43c5b74 and M2.1 9ff96f2 superseded)

Numbers: 12/12 runs reach town on day 2 by guidance, 0 accidental skips; first harvest 9-19 s; New Game to waking on day 2: 157-175 s clean, 180-221 s human; to town: 228-350 s; 49 one-row lines; 34-38 s per run with nothing pointed. Verify (frozen copy, rerun): green; coach perf 1.2-1.5 ms, 2 draws per frame.

| id  | round | sev   | summary                                                                                              | status                                                                    |
| --- | ----- | ----- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 3.1 | 3     | major | First town line on day 2 is the rod intro (12/12) while the goal is Buy and Mara is on screen        | FIXED (r4: buySeeds 9/12 + "opens at 8 AM" 4; rod never in town)          |
| 3.2 | 3     | major | water2 26-84 s / 11-47 taps; empty can 7/12; row tip flips 4 ways; row painted with seeds = refusals | PARTIAL (r4: full can, fewer flips; never-paint wrong-tool = 4.1)         |
| 3.3 | 3     | minor | Free play waits 14 s for the goal arrow (34-38 s per run unpointed)                                  | FIXED (r4: idle 6-7 s per run)                                            |
| 3.4 | 3     | minor | "Close this to carry on." x12 (mail, wild goods, menu)                                               | PARTIAL (r4: mail fixed; Goal sheet kept on purpose; mailbox sheet = 4.4) |
| 3.5 | 3     | minor | Giving intro on day 1 gifts whatever is in hand (seeds -> neutral, gift spent)                       | FIXED (r4: day 3)                                                         |
| 3.6 | 3     | nit   | Left-hand "..." flush against the first word                                                         | FIXED (r4: "?" 4 px clear)                                                |
| 3.7 | 3     | nit   | Two identical "..." (line menu and Interact talk)                                                    | FIXED (r4)                                                                |
| 3.8 | 3     | nit   | controls.test thumb-lib parity test times out at 5 s under load (old test)                           | FIXED (r4: 20 s timeout)                                                  |

## Round 4 (final): M4 (fd9dcfc)

12/12 to town on day 2, 0 skips; first harvest 9-20 s; to waking on day 2 108-146 s clean, 139-204 s human; to town 156-336 s; nothing pointed 6-7 s per run. Verify green on the frozen copy (715 unit, 300 e2e, coach perf 1.03-1.43 ms). r4-skip i13 both hands: all line/menu/skip checks pass.

| id  | round | sev   | summary                                                                                                             | status                   |
| --- | ----- | ----- | ------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 4.1 | 4     | major | water2 with an empty seed slot (never-paint): "Tap the seed packet on the hotbar." while watering; 150 s / 104 taps | OPEN (final)             |
| 4.2 | 4     | major | Day-2 stick demo "drag down" into the stump from the NW farm: 115 s stall (2/12)                                    | OPEN (final)             |
| 4.3 | 4     | minor | water2 still the longest beat (12-101 s, median about 36 s); can dry 3/12; row tip 2-4 directions                   | OPEN (final)             |
| 4.4 | 4     | minor | Day-1 leek beside the mailbox: low tap opens an empty mailbox sheet                                                 | OPEN (final)             |
| 4.5 | 4     | minor | "Close this to carry on." after Menu > Goal (intended): reword                                                      | OPEN (final)             |
| 4.6 | 4     | minor | Bag hint "hold Action to keep working" (controls agent's string)                                                    | OPEN (final, other lane) |

## After the final round: 1d95c75 (agent-reported, NOT re-verified by me)

Agent says verify is green (717 unit tests). Reported: 4.1 fixed (water steps reword planting refusals as "Tap a dry crop to water it."), 4.2 fixed (stick lesson only when 4 clear tiles, else point at the gate), 4.4 fixed (leek moved to 10,13), 4.5 fixed ("Read your jobs, then tap Close."). 4.3 and 4.6 open in NEXT-STEPS-ONBOARDING.md. Status of 4.1, 4.2, 4.4, 4.5: REPORTED-FIXED (unverified). Re-run tools/human.mjs on 1d95c75 to confirm.
