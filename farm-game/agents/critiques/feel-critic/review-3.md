# Review 3 (closing round): cbcc60d

Frozen copy: `round-4/farm-game`. Raw data: `round-4/out/`. `npm run verify` is green on my frozen copy:
815 tests, e2e, mobile, controls (`E2E_CONTROLS_PARALLEL=1`), onboarding, feel, and perf with its frame budgets.

**Verdict:** accepted as final. Every criterion is met except where the coordinator ruled otherwise (canvas scale
on iPhone 13 and SE). Open: 1 nit.

- **R1-1 (harvest arc):** fixed. The item rises beside and behind the farmer and rests above his hair; the face
  stays clear in every frame (`harvest-60hz-strip.png`).
- **R2-1 (title to game):** fixed. Worst frame over 2 runs: 1x 56 / 21 ms; 4x 69 / 62 ms, under the 200 ms budget
  (baseline 389 / 347); 6x 118 / 111 ms (baseline 591 / 535). The agent reports every long frame lands under the
  wipe except the tap's own frame, which creates the AudioContext inside the gesture (iOS unlock design).
  Accepted.
- **R2-2 (item touches the text):** still open as a nit. In the first about 10 frames of the rest (about 170 ms),
  the carrot's leaves still overlap the bottom row of "+1 Parsnip" (`harvest-text-zoom.png`); they clear once the
  text rises.
- **R2-3 (one clock):** fixed; no `game.loop.delta` reads are left.
- **R2-4 (sheet frame at 6x):** 27.8 ms max in both of my final runs, with no frame over 33 ms. Closed.

Pacing in the first final run had two lone spikes with little game work in those frames: a 229 ms frame while
walking at 1x (1.1 ms of JS) and 97 ms on the woods-to-town door at 6x (15.7 ms of JS). A rerun at 1x and 6x was
clean: steady max 7.2 / 13.9 ms, doors max 21 / 20.9 ms. They were host stalls; the machine is shared with other
agents.

Bench: i13 18 rows OK with identical gestures. That's my run on i13 only; the 5-phone run is the agent's. The
handover says I re-ran it "on the art merge"; I ran i13 only.

`scale.txt` note: my tool divides the measured CSS width, so whole scales show as 4.99999 and round badly. Pixel 7
(5.000), Pro Max (6.000) and Fold (4.000) are whole-pixel; iPhone 13 (5.72) and SE (3.24) stay at fit, as ruled.
