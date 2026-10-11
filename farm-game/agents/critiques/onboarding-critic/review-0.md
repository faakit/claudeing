# Review 0: baseline, before any onboarding change

Build: `onboarding/guided-start` at 1dffd97 (frozen in `round-0/`, served on :5191). Phones: iPhone 13 and SE, right hand
(left hand: switch measured only). Tools: `tools/r0-*.mjs` (real CDP touches; `?debug` read-only, used only to log state).
Shots: `round-0/shots/<run>/NN-*.png`.

## Runs

| run                 | what                                                              | result                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| firstlook (i13, se) | hands off for 12 s after New Game                                 | 2 toasts, each about 3 s, the 2nd is 3 lines; welcome gone before most people finish it; drag ring and toast 2 disagree; home plot not on screen (i13 edge, SE not at all)                                                                                 |
| naive (i13)         | does what the words say: Action, tap grass, Action, drag, Action  | 13 taps + 1 drag, 18 s, **0 tilled**; same refusal 9 times: "Not your land yet. Buy it at a sign."                                                                                                                                                         |
| naive2 (i13)        | gives up, waits                                                   | arrow after 14 s _with no input at all_ (tiny, at the bottom-left edge); 40 s hint repeats "press Action on bare ground" (no where); once on the plot: tilled 6 in 19 taps; walking taps on own soil **water it instead** (watered 5 with 0 seeds planted) |
| naive3/4 (i13)      | plant, house                                                      | Action with hoe on soil waters (auto tool) then "Pick seeds on the hotbar first."; tapping the door walks to it and stops (no Interact, no entry)                                                                                                          |
| day1 (i13)          | best case (knows the plot), close+reopen mid-tutorial, bed, day 2 | 4 goals in ~65 s / 19 gestures, bed at 7:53 AM; resume OK (Continue, state intact, no reminder of what to do); "Go to bed?" sheet by tapping the bed (good); morning report = 11 lines incl. stale "Hold the Action button to work a whole row"            |
| lefty (i13)         | left-handed newcomer                                              | no hand question; switch is Menu > Opts > toggle (3+ taps, never mentioned)                                                                                                                                                                                |

## Baseline numbers (to beat)

- Literal follower, first 60 s: 0 of 6 tiles tilled; 9 identical refusals; 0 fun.
- Best case day 1: 65 s, 19 gestures, 2 tricks not taught (plot location, push into door).
- Text: toast 2 = 3 lines; morning report = 11 lines; 4 tip toasts in the first 15 s of real work.
