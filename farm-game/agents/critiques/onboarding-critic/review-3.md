# Review 3: M3 (42f363a), covering M2 (43c5b74) and M2.1 (9ff96f2)

Verdict: the blocker is fixed and A1 now passes. 12 of 12 human-ish runs reach town on day 2 with the guide on. What's
left is polish, plus one wrong intro on arriving in town.

Build `round-3/` (42f363a). Bot `tools/human.mjs`, updated: in free play it also follows the goal arrow when it is
drawn, gives an info line its touch, does the day-2 stick drag, and taps the obvious button on a sheet (Sleep, Wake
up...). Skip/line checks: `tools/r3-skip.mjs` (SE, both hands). Runs: `round-3/runs/*/` (result.json, log.txt, shots).
Round-2b runs on 9ff96f2 (`round-2b/runs/`) showed the rod-in-hand water2 stall that M3 fixes.

## Numbers

|                                                                                         | round 0             | M1.1 (review 2)                  | M3                                                                              |
| --------------------------------------------------------------------------------------- | ------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| reach day 2 by guidance (12 runs: i13/SE, R/L, wrong taps, wander, reopen, never-paint) | 0 tiles in 60 s     | 9/12                             | **12/12**, 0 accidental skips                                                   |
| first harvest step                                                                      | n/a                 | 9-21 s                           | 9-19 s                                                                          |
| New Game to waking on day 2, clean / human                                              | 65 s (with secrets) | 38-54 s / 61-81 s (no free play) | 157-175 s / 180-221 s (includes the clock and energy lines, errands, town gate) |
| New Game to town on day 2, clean / human                                                | n/a                 | 101-124 / 130-147 s              | 228-242 / 234-350 s                                                             |
| distinct coach lines, all one row                                                       | n/a                 | 24                               | 49, all one row                                                                 |
| time with nothing pointed (waiting for the 14 s goal arrow)                             | 41 s                | n/a                              | 34-38 s in every run                                                            |

Line checks (r3-skip, SE right and left): a mid-line tap walks the player (11,16) to (11,10), with no menu, and the guide stays. "..." opens
[Skip guide][Back], mirrored for the left hand, and aim is null while it's open. It closes itself by 4.6 s and the hand comes back. One Skip tap
gives "Sure? Skip"; wait 3.6 s and nothing is skipped. Two taps skip and show "Guide off. Replay it: Menu > Opts > Controls."
All of review-2 #1 (a-g) and #3 are verified.

## Findings

1. **major. The wrong intro on arriving in town (A10).** In 12/12 runs, the first line in town on day 2 is "Flick
   Action sideways: pick the rod." (ring and hand on Action). Meanwhile the goal bar says "Buy 5 items at the General
   Store", the walk line just said "Seeds are in town", and Mara with her "!" is on screen. townHello showed in 1/12.
   Shot: `round-3/runs/i13-left-clean/26-town.png`. Ask: on the first town visit, townHello and shop come first; fish
   only after the shop has been seen, or when standing near water, and never on day 2's arrival.
2. **major. Day 2's water chore is long and keeps going wrong (A4, the feel).** water2 ran 26-84 s (median about
   52 s) and took 11-47 taps. It went over 45 s in 8/12 runs, including i13-left-clean with zero wrong taps (51.8 s).
   Why:
   - painted rows on day 1 leave 5-9 crops;
   - "Your can is empty: tap the pond." in 7/12 runs, including clean ones (the can isn't refilled since day 1);
   - the row tip flips direction 4 times in one step (up, left, right, down);
   - the row is painted with the seed packet still in hand, so it plants or refuses instead of watering: "Something
     is already growing here." ×2 and "Till the soil first." ×1 in the coach line.

   Ask:
   - start day 2 with a full can (Rosa filled it, one line in the morning note), or teach the pond at the end of
     day 1;
   - the water-row tip first points at the can when the can isn't in hand (as your rod fix does);
   - keep one row direction per crop group.

3. **minor. Free play still waits 14 s for the goal arrow.** That's 34-38 s per run with nothing pointed, after
   "Free time! Try the errand up top." and again after the forage and villager intros. Ask: while the guided days run,
   show the goal arrow at once (or after 3 s) when no coach step is up, and hide it only while a step shows.
4. **minor. "Close this to carry on." ×12** after the letter, the bag, a wild-good sheet and the menu. Each one is an
   extra tap that teaches nothing. Ask: close the sheet when its step finishes (as ship now does) for mail and
   wild goods.
5. **minor. The giving intro right after the first hello on day 1** points at Gift with whatever is in hand. In
   se-left-clean that was the seed packet: Rosa "Oh. Thank you." (neutral), and the day's gift is spent. Ask: show it
   only when the player holds something giftable that isn't seeds, or move it to day 3+.
6. **nit. Left-hand "..." is flush against the first word.** It reads as an ellipsis: "...Flick Action sideways:
   pick the rod." Ask: a gap of 4 px or more, or a small plate behind the glyph.
7. **nit. Two "..." on screen.** The line's glyph and the Interact talk bubble look identical
   (`se-left-clean/08-step-clock.png`). Consider "?" or a cog for the line's menu.
8. **nit. Verify on my copy:** the first run failed on `controls.test.ts` "thumb-lib and reach.ts describe the same
   phones" (5 s timeout importing playwright-core under load). It's an old test, not yours. The rerun was green. Ask: give that test a 20 s timeout.

## Acceptance status

A1 PASS (12/12). A2 PASS. A3 PASS (49 lines, one row). A4 PARTIAL (water2). A5 PASS. A6 PASS (only the glyph is a
button; the menu closes itself). A7 PASS. A8 PASS (nits 6-7). A9 PASS (reopen 9/9 on the same step). A10 PARTIAL (town
intro order). A11 PASS (my verify rerun on the frozen copy: 713 unit tests, 300 e2e checks, 0 FAIL, EXIT 0; coach-marks perf 1.20-1.47 ms JS and 2 draws per frame at 1x/4x/6x) (tutorial tests 32, plus the e2e wanderer covering a stray bar tap and
the rod).
