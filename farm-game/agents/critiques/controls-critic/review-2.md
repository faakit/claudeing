# Review 2: M3 (911e5c8) + M4 and review-1 fixes (bebb9a9)

**Verdict: the review-1 fixes hold up and tap-to-walk feels quick (walk starts 1 frame after lift). But tap-to-act does unasked work on the farm, and a tap beside the bin or mailbox opens them instead of walking.** These two predictability problems should be fixed before M5 builds paint on the same intent rules. The bench's errand rows are broken, so the M4 acceptance numbers for sell and machine are unverified.

## Method

- Frozen `bebb9a9` in `round-2/farm-game` on port 5181.
- Probes:
  - `tools/r2-probe.mjs` (field misses, walk intent, dock misses, latency, cancel, fix re-checks, auto hold);
  - `tools/r2-diag.mjs` (fixed rolls, random taps with their routes);
  - `tools/r2-magnet.mjs` (taps on tiles beside interactables);
  - `tools/r2-bin.mjs` (bench sell repro);
  - `tools/r1-probe.mjs` (nudge and stop, re-run).
- Logs are in `round-2/`.
- Bench: all tasks with the perfect stop, i13 and Pixel 7, both hands (`round-2/bench/`).
- Also run: `vitest` (564 passed) and `npm run perf` (within budget: at most 3 draws, 1.16 ms at 6x).

## Review-1 follow-ups

| #                   | status      | evidence                                                                                                                                                                                        |
| ------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 tap = down point | FIXED       | Fixed rolls of 0-8.5 px (up to 2.7 mm on i13) hit the right tile 8/8 at every size (`diag.log`). Random rolls at σ 1 mm hit the right tile 29-30/30 on i13 and Pixel 7.                         |
| F2 one threshold    | FIXED       | Rolls of 9.5 px or more engage the stick, which turns the farmer: a visible response. No touch in the probe ended with no visible outcome.                                                      |
| F3 rubber band      | FIXED       | A same-direction push of 120-230 ms is exactly 1 tile, with at most 0.4 px slide-back. A new-direction 120 ms flick is 0 tiles (3 px wobble); 160 ms is 1 tile (i13 and SE right, `nudge.log`). |
| F4 settle window    | REJECTED-OK | The arithmetic holds: 18 px of spread for a 16 px tile. Re-measured on target: 120±30 gave 16/16; 180±30 gave 14/16. The owner's phone checklist will carry it.                                 |
| F5 tap during lock  | FIXED       | 3/3 acts at 150, 200 and 250 ms spacing, on 6 runs.                                                                                                                                             |
| F6 Menu on SE       | FIXED       | Intended jittered taps open it 36/40 (90%) on SE and 37-38/40 on i13 and Pixel 7. Misses do nothing; 1/160 walked.                                                                              |
| F7 Interact on SE   | FIXED       | Interact-aimed taps open 38-40/40. The Action steal statistic is in the unit test (trusted, not re-measured).                                                                                   |
| F8 bag cursor       | FIXED       | bagUse passes in every row.                                                                                                                                                                     |
| F9 hold settle      | FIXED       | Unit test (trusted).                                                                                                                                                                            |
| F10 marker dots     | FIXED       | Not re-screenshotted.                                                                                                                                                                           |

## Findings

1. **MAJOR: tap-to-act does landscaping you didn't ask for.**
   - `tapIntent` puts "act" before "walk", and `actKind` is the full auto tool, so:
     - a tap on tillable grass walks there and tills it;
     - a tap on tilled empty soil plants the auto-picked seed.
   - Evidence:
     - 30 random "walk there" taps on the farm view: 2 tilled grass (9,19 and 10,18, in the home plot) for 4 energy (`probe-a.log` and `probe-b.log`, walkintent rows). Across a real field it would be every grass tile.
     - Field misses at σ 2.5 mm on SE tilled grass beside the plot in 1 of 20 ripe trials and 1 of 20 dry trials.
   - Ask: by tap, act only where the act is obvious and reversible-cheap: harvest, water a dry crop, clear weeds and debris, mine, and interact. Till and plant happen only via Action (and M5 paint), or when that item is explicitly selected. Stardew taps grass to walk.
   - Accept: 0 tills or plants in 30 random walk taps across a tilled plot, and the M4 errand numbers unchanged.
2. **MAJOR: interact magnets swallow walk taps beside the bin and mailbox.**
   - `SNAP_MM` = 3 mm is more than half a tile (tiles are 4.7-5.6 mm), so a centre tap on any 4-neighbour of an interactable snaps to it.
   - Evidence (`magnet.log`, i13, centre taps with 1 mm jitter):
     - below the bin: 6/6 opened the bin;
     - beside the mailbox: 5-6/6 opened the mailbox;
     - the far sides: 2-3/6.
   - Those are the tiles in front of the house, which the player crosses daily. In random farm taps, 3-7 of 30 opened a sheet (`diag.log`: "tap tile 15,12 -> interact@16,12", "tap 11,10 -> interact@12,9").
   - Ask: apply the magnet only within about 1.5 mm of the target tile's edge (the outer part of a neighbour tile), or only when the tapped tile is blocked. A tile-centre tap must walk.
   - Accept: centre taps on tiles beside the bin and mailbox walk >= 90% (σ 1 mm), and bin taps still >= 85% at σ 1.5 mm.
3. **MAJOR: the auto tool deviates from the plan without declaring it.**
   - Plan M3.1: "the **equipped item if it can act** ... (explicit beats auto)". The build's `autoMode` treats a selected hoe as "auto". So holding Action for 2 s on grass with the hoe selected tilled, planted and watered 3 tiles, using 3 parsnip seeds the player never selected (`autohold` in `smoke.json`).
   - The seed fallback "else the first on the hotbar" was not in the plan, which said "else none ... 'Pick seeds on the hotbar'".
   - Ask: either restore "explicit beats auto", or keep the chain (it is efficient) with two limits:
     - seeds come only from the selected seed or `lastSeed`, never "first on hotbar";
     - the Action icon shows the seed before the first plant happens.
   - Record the decision in DECISIONS.md. I'd accept the chain with those two limits.
4. **MAJOR (bench): errand rows fail, so M4's sell 3 / machine 2 acceptance is unmeasured.**
   - `sell` and `machine` FAIL in all 4 rows (i13 and Pixel 7, both hands). Your `bench-m3.md` also shows plot3x3 "task did not complete" plus sell, villager and machine failing.
   - The game itself works: `r2-bin.mjs` opened the bin in one tap from (14,8) after 300 ms and 1500 ms, and from (14,15).
   - The left-hand `machine` row opened the **Menu**: the jar tile (16,15) maps under the dock for that camera, so the bench tapped the dock.
   - Ask: fix the bench (wait for the camera, refuse targets outside the world view, cancel routes in `fresh`), then report sell, villager, machine and fish at 1.5 mm and 2.5 mm jitter.
5. **MINOR: crop accuracy and wrong-tile acts, restated.**
   - Your single-crop numbers (64-86% at 1.5 mm, 36-49% at 2.5 mm) are below my 95/85 bar, which is physically out of reach on 4-5 mm tiles. I'm dropping that bar for crops.
   - In a 3x3 field, misses act on a **neighbour of the same kind**: 15-35% at 1.5 mm and 55-75% at 2.5 mm, harvesting or watering the next crop. That is productive and harmless.
   - New bar: wrong-tile acts of a **different kind** (tilling, planting, opening) <= 1% at 2.5 mm. It was 0-5% (SE). F1 above fixes most of it.
6. **MINOR: fishing's fixed cost is still 7, not 5.**
   - Bench `fish`: 3 taps and 4 drags (3 of them tool swipes) plus 3-8 reel holds.
   - Tapping water with the rod in hand does walk and cast, but reaching the rod still costs 3 swipes until M6's ring.
   - Ask: keep the "7 -> 5" acceptance for M6 and say so in bench-thresholds.json.
7. **MINOR: perf doesn't cover tap routes.** `npm run perf` passes, but none of its scenarios walks a tapped route with path dots, or measures BFS time.
   - Ask: add one perf row (a long route on the farm, path dots visible).
   - Accept: <= 12 draws, <= 3.5 ms, and BFS <= 2 ms on the biggest map.
8. **NIT: nothing teaches tap-to-walk yet.** The welcome tip still says "Pick the hoe and tap Action". Fine until M7, but log it now: a first-run tip "Tap a spot to walk there" once the player has used the stick 3 times.

## Verified good

- Latency (i13 right, 5 runs): the preview appeared 104-105 ms after touch-down (within 1 frame of the 100 ms threshold), and the walk started 1 frame after lift.
- A tap followed by the stick 150 ms later: 0 acts in 8 trials.
- Rapid taps are buffered (F5).
- plot3x3 with the perfect stop: 24 gestures, 0 tool changes, 37 acts with **0 marker mismatches** on i13 and Pixel 7, both hands. Thumb travel was 966-1009 mm, which is still the shuttle; M5 should remove it.
- villager: 4 gestures, which meets the target.
- Dock misses never act in the world: 0/320 world acts from Menu- or Interact-aimed taps.
- The save v15->16 fixture test and sanitize are present. 564 unit tests pass.
