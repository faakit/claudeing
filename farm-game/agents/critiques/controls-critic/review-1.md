# Review 1: M1 (933d6b9) + M2 (f015781)

**Verdict: M1 and M2 pass their headline numbers, and the M2 stop fix is the biggest feel win so far. Taps are not yet reliable for a rolling human thumb, and short stick pushes rubber-band.** Five major findings need fixing before M4 builds tap-to-walk on top of them.

## Method

- Frozen copy of `f015781` in `round-1/farm-game`, served on port 5181.
- Probe `tools/r1-probe.mjs`, using real CDP touches.
- Human imperfection modelled as:
  - Gaussian aim jitter of 2.5 mm, plus a 1.5 mm offset toward the thumb base;
  - pad roll with σ of 1, 1.5 or 2 mm;
  - releases at 120-180 ms;
  - reaction time with a 30 ms SD.
- Raw results: `round-1/probe-a.log` (i13 and SE, both hands), `probe-b.log` (Pixel 7, both hands) and `probe-c.log` (timing on i13 and Pixel 7, both hands).
- Other runs:
  - `e2e:controls` on Pixel 7, Pro Max and Fold: `round-1/e2e-controls-others.log`;
  - bench with STOP=center at 120 and 180 ms on Pixel 7 and SE, both hands: `round-1/bench/`;
  - `vitest`: 519 passed;
  - `npm run perf`: within budget, at most 3 draws and 1.61 ms.

## What is good (verified)

- **Menu drag guard:** 0 opens in 100 jittered drags of 9.5-35 px starting on Menu, on every profile and hand (500 drags in total).
- **Action taps** of 50-280 ms give exactly 1 use each, on i13 and SE, both hands.
- **Action-edge ownership:** Interact opened on 0-1 of 150 jittered taps on i13 and Pixel 7.
- **e2e:controls** is all green on Pixel 7, Pro Max and Fold, apart from one swipe sample under CPU load (see F9).
- **Human stops, M2 vs M1:**
  - the bench plot3x3 at 180 ms is 26 gestures with 0 corrections on Pixel 7 for both hands and on SE right, and 28 gestures with 2 corrections on SE left;
  - M1 was 51 gestures with 25 corrections. That is the main feel win so far.
- **Stop probe:** with 120 ± 30 ms reaction, the player stopped on the target tile in 32 of 32 trials.

## Findings

1. **MAJOR: a tap's tile is taken from the release point, so a rolling pad taps the wrong tile.**
   - Evidence:
     - `UIScene.setupTaps` emits `tap` with `p.x, p.y` on `pointerup`.
     - In the probe, adjacent-tile taps on soil (down-point jitter 1 mm, plus a roll) acted at these rates:

       | profile | roll 1 mm | roll 1.5 mm | roll 2 mm |
       |---|---|---|---|
       | i13 | 28-29 / 30 | 20-23 / 30 | 19-24 / 30 |
       | Pixel 7 | 28-29 / 30 | 20-26 / 30 | 20-24 / 30 |
       | SE | 25-28 / 30 | 15-19 / 30 | 15-16 / 30 |

     - Most misses were a ring on a different tile: SE right showed 5 such rings at a 1 mm roll and 9 at 2 mm.
   - Ask: use the touch-down point (or the mean of the first 50 ms) as the tap position. M4's tap-to-walk will inherit this.
   - Accept when, at a 1.5 mm roll, taps act >= 90% on i13 and Pixel 7 and >= 85% on SE.
2. **MAJOR: a rolled tap can be neither tap nor stick.**
   - Evidence:
     - `PressTrack.still` means max travel <= 8, while the stick engages at a current length >= 9.
     - A touch whose max travel lands in (8, 9), or that strays to 8.5 and comes back, does nothing.
     - In the probe, 0-5 of 30 taps per condition ended with no act and no ring.
   - Ask: make it one threshold: a world touch is a tap if and only if the stick never engaged.
   - Accept: 0 touches end with no act, no walk and no ring.
3. **MAJOR: short stick pushes rubber-band.**
   - Evidence (`probe-c.log`, nudge section, the same on i13 and Pixel 7, both hands):
     - from a standstill, a push in the facing direction for 120-160 ms walks 8.4-11.6 px (2.7-3.8 mm) and then slides back 8.4-11.6 px;
     - a single step needs 200 ms or more;
     - a push in a new direction for 200-260 ms walks 8.4-12.4 px and slides all the way back;
     - a step in a new direction needs about 300 ms.
   - Two effects: the farmer visibly walks most of a tile and returns, and quick steps are swallowed.
   - Ask: on the first tile of a walk from a standstill, settle to the nearest centre, or commit forward at 6 px or more. Keep the 13 px back-settle only once this walk has passed a centre, which still absorbs late releases.
   - I'm relaxing my own bar from "new-direction flicks <= 200 ms stay" to "<= 150 ms stay".
   - Accept when:
     - a same-direction push of 100 ms or more steps exactly 1 tile;
     - a new-direction push of 150 ms or less moves 0 tiles;
     - no push under 250 ms slides back more than 4 px.
4. **MAJOR: the settle window ignores human reaction variance.**
   - Evidence (stop probe: walk 3 tiles and release at sprite centre plus reaction ± 30 ms, 8 trials per row):
     - at 120 ms: 32 of 32 on target;
     - at 180 ms: 26 of 32 on target, with every miss exactly 1 tile long;
     - at 220 ms: 5 of 32 on target.
   - The window runs from 3 px early to 13 px late, which is 47 ms early to 203 ms late. The bench uses a fixed reaction, so it reports 0 corrections at 180 ms.
   - Ask: add `REACTION_SD` (default 30) to the bench, plus an anticipatory mode (release at -40 ± 30 ms). Then tune `SETTLE_BACK_PX` (14-15?) to minimise misses across both.
   - Accept when, at 180 ± 30, on-target is >= 90%, with >= 95% at 120 ± 30 and in anticipatory mode.
5. **MAJOR: taps during the 200 ms swing lock are dropped silently.**
   - Evidence:
     - `WorldScene.onTap` returns early when `actionLock > 0`, before the ring and the sound.
     - In the probe, three taps on adjacent tiles at 150 and 200 ms spacing acted on 2 of 3, in all 4 runs (i13 and Pixel 7, both hands).
     - At 250 and 320 ms spacing, all 3 acted.
   - Ask: buffer the latest tap, run it when the lock ends, and never drop one silently. M4 errands make this more common.
   - Accept: 3 of 3 at 150 ms spacing.
6. **MINOR: Menu tap reliability on SE, and its large hit circle in the stick-start area.**
   - Evidence:
     - intended taps (2.5 mm jitter plus 1.5 mm offset, 120-180 ms, 1 mm roll) opened Menu 47-48 of 50 times on i13 and Pixel 7, but only 41 of 50 (82%) on SE, for both hands;
     - still touches 5-9 mm from Menu's centre opened it 19-23 of 40 times on i13 and Pixel 7; its hit radius of 22 px is about 7.3 mm.
   - Ask: bring SE to >= 90%, for example drawn radius 16 and hit 24 on screens with less than 0.3 mm per px, while keeping the drag guard.
7. **MINOR: Interact still steals touches on SE at 1.3%.**
   - Evidence: 2 of 150 Interact opens in both jitter conditions on SE right, and 1-2 on SE left. Your <= 1% figure was measured on i13.
   - Deviation 1 (the geometry limit) is accepted for i13 and Pixel 7.
   - Ask: run the same statistic on SE in e2e and either meet <= 1% or justify it.
8. **MINOR: bench bagUse fails in every row at REACTION 180.**
   - Evidence: `no target /^Use now$/` on Pixel 7 and SE, both hands, in `round-1/bench/run.log`. The same failure appears in your `bench-m1-human.md`; at 120 ms it passes.
   - Ask: fix it or explain it. Find out whether it is a bench bug or a real stop putting the player somewhere unexpected.
9. **NIT: one swipe used the old tool under load.**
   - Evidence: Fold right, a 150 ms swipe used the old tool once while my probes were loading the CPU. It did not reproduce in 2 solo runs.
   - The cause is that `HOLD_SETTLE_MS` treats any 60 ms without movement as "settled", so a 60 ms touchmove gap mid-swipe (a GC pause or a dropped frame) starts the hold.
   - Ask: consider requiring both a gap of 60 ms or more and at least 2 rendered frames with no input since the last move. If you think this is over-engineering, say so; it is a nit.
10. **NIT: the "none" marker is faint.** In `m2/i13-marker-none.png` the 4 corner dots are barely visible, and the "Drag to walk" hint overlaps them. The shapes do differ, so this passes R7; consider 2x2 dots at 70% alpha.

## Deviations

| # | Deviation | Decision | Reason |
|---|---|---|---|
| 1 | Interact <= 1% instead of 0 | Accepted for i13 and Pixel 7 | Geometry. SE is followed up in F7. |
| 2 | 250 ms reaction cannot reach 0 corrections | Accepted | It is a full tile. Replaced by the variance-based ask in F4. |
| 3 | Bench default is now STOP=center | Accepted | |
| 4 | 20 Menu drags per profile in e2e | Accepted | I ran 100 per profile and hand: 0 opens. |

## Risk ledger movement

- R1 (still touch duration-independent): partly addressed. F1 and F2 remain.
- R3 (turn delay): weaving is fine, but F3 shows the rubber band.
- R5 (Menu): the drag guard is proven. Size on SE is F6.
- R8 (perf): holds.
