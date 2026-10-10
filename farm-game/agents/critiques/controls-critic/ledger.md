# Controls critique ledger (one-thumb playtester)

Worktree under review: `C:/Users/andre/dev/tiny-acre/controls` (branch `controls/one-thumb`), read-only.
Controls agent: `a05b759beedb99e5b`. Plan: `farm-game/agents/PLAN-CONTROLS.md` (base commit e632754).

Status keys: OPEN, FIXED (verified by me), REJECTED-OK (agent's reason accepted), IGNORED (raised again).

## Round 0: opening risks (sent 2026-10-08)

| id | risk | severity | status |
|---|---|---|---|
| R1 | One touch-down, four meanings (tap / preview / long-press paint / stick); duration alone must not change a still touch's outcome; TAP_MAX_MS 250 == paint 250 ms | blocker-class | OPEN |
| R2 | Surprise acts from tap+auto tool+snap: a snap miss must degrade to walk, never a wrong act; nothing destructive by tap | blocker-class | OPEN |
| R3 | Turn-hold makes weaving sluggish; plan's "100 ms flick moves 0 px" contradicts TURN_HOLD 90 ms | major | OPEN |
| R4 | Action carries hold + vertical swipe + horizontal ring flick under a rolling thumb; ring at right edge meets Android back | major | OPEN |
| R5 | Menu moved into the thumb arc becomes a graze/joystick-start target | major | OPEN |
| R6 | Left-hand parity drifts (ring, paint, sheets, Menu, bench numbers) | major | OPEN |
| R7 | iOS web has no vibration: every haptic event needs a visual twin; reduced motion; colour-only marker | major | OPEN |
| R8 | Perf/regressions: path dots, paint queue, ring vs 12 draws / 3.5 ms; v15->16 migration | major | OPEN |

Agent ack (before M1): committed to (R1) one pure world-touch state machine; a still touch's outcome is duration-independent except for the paint arm, and travel past the deadzone before the arm locks the touch to the stick. (R3) The turn hold applies only from standstill. Verify both at M1/M2/M5.

## Findings

| id | round | sev | summary | status |
|---|---|---|---|---|
| 1.1 | 1 | major | Tap tile taken from release point; rolled taps hit wrong tile (SE 15-19/30 at 1.5 mm roll) | FIXED (r2) |
| 1.2 | 1 | major | Dead band: max travel 8-9 px is neither tap nor stick; no act/no ring 0-5/30 | FIXED (r2) |
| 1.3 | 1 | major | Rubber-band nudges: 120-160 ms same-dir walk 8-12 px then slide back; step needs >=200/300 ms | FIXED (r2) |
| 1.4 | 1 | major | Settle window vs reaction variance: 180+-30 -> 81% on target; bench needs REACTION_SD + anticipatory | REJECTED-OK (r2: 18 px spread > 16 px tile; owner checklist) |
| 1.5 | 1 | major | Taps during 200 ms swing lock dropped silently (2/3 at 150-200 ms spacing) | FIXED (r2) |
| 1.6 | 1 | minor | Menu tap only 82% on SE; 7.3 mm hit radius in stick-start area | FIXED (r2: SE 36/40) |
| 1.7 | 1 | minor | Interact steal 1.3% on SE (bound <=1% only tested on i13) | FIXED (r2) |
| 1.8 | 1 | minor | bench bagUse fails at REACTION 180 in every row ("Use now" missing) | FIXED (r2, real bug: bag cursor) |
| 1.9 | 1 | nit | Fold swipe used old tool once under load; HOLD_SETTLE 60 ms gap = settled | FIXED (r2, unit test) |
| 1.10 | 1 | nit | "none" marker dots faint | FIXED (r2, not re-shot) |
| 2.1 | 2 | major | Tap-to-act tills grass / plants empty soil on "walk" taps (2/30 random farm taps tilled) | FIXED (r3, ruling 1; but see 3.1) |
| 2.2 | 2 | major | Interact magnet 3 mm > half tile: centre taps beside bin/mailbox open them 5-6/6 | FIXED (r3, ruling 4: magnets removed) |
| 2.3 | 2 | major | Auto tool deviates from plan (explicit hoe -> chain till+plant+water; seed fallback "first on hotbar") | FIXED (r3, rulings 2-3; paint chain = ruling 5) |
| 2.4 | 2 | major | Bench sell/machine rows fail (bench bugs; left machine taps under dock) -> M4 errand acceptance unmeasured | FIXED (r3: sell 3, villager 4, machine 3) |
| 2.5 | 2 | minor | Crop bar restated: different-kind wrong-tile acts <=1% at 2.5 mm (was 0-5%) | ACCEPTED (r3) |
| 2.6 | 2 | minor | Fish fixed cost still 7 (target 5 moves to M6) | DEFERRED to M6 |
| 2.7 | 2 | minor | Perf has no tap-route/path-dot scenario or BFS timing | DEFERRED to M7 |
| 2.8 | 2 | nit | No tip teaches tap-to-walk yet (M7) | DEFERRED to M7 |
| 3.1 | 3 | BLOCKER | Slow still tap (>=240 ms) on tillable grass arms paint and tills 1 tile (R1) | FIXED (r5: 0/112) |
| 3.2 | 3 | BLOCKER | Rest/hesitation >=~200 ms before steering arms paint (reststeer 4/4; stickonsoil 9-10/30) | FIXED (r5: 0/96 painted, 0/120 armed) |
| 3.3 | 3 | major | Wobbly paint drag adds neighbour-row tiles (2 mm: 4-6/6 exact; 3 mm: 0-1/6) | FIXED (r5, straight lines) |
| 3.4 | 3 | major | Dragging back to origin commits 1 tile (loopBack 16/16) | FIXED (r5: back to start = 0) |
| 3.5 | 3 | minor | plot3x3 travel 229-252 mm > 150 target; hop taps in stretch | OPEN as owner trade-off (r5: 15 gestures, 470-612 mm) |
| 3.6 | 3 | nit | 9 vibrations per 3-tile paint | FIXED (r5: 2-3 per row) |
| 4.1 | 4 | BLOCKER | Ring open fires Action (hold rule ignores dx; 8/8 exact picks tilled; dead-centre lift taps) | FIXED (r5: 0 acts in 460+ ring gestures) |
| 4.2 | 4 | major | Flick-and-lift (22-44 px) silently picks slot 5 (4/4) | FIXED (r5: sticky 16/16); residual 5.5 |
| 4.3 | 4 | major | Ring pick accuracy 57-71% at 2 mm, 83-88% at 1.2 mm; +1 index bias | FIXED (r5: 98-100% at 1.2 mm; 81-93% at 2 mm, see 5.4) |
| 4.4 | 4 | minor | Options 7/19 outside comfort, volume +/- hard | PARTLY (r5: volume ok, toggles hard; see 5.6) |
| 4.5 | 4 | nit | SE bag cells 37 px: accepted (geometry); suggest gapless hit cells | REJECTED-OK |
| 5.1 | 5 | major | Still Action press >=290 ms does nothing (arm then cancel); 2 stale "Hold Action to keep working" strings | OPEN (final) |
| 5.2 | 5 | major | plot3x3 15 gestures / 470-612 mm vs plan 8 / 150 (owner trade-off) | OPEN (final) |
| 5.3 | 5 | major | Late stops at 180+-30 ms (accepted trade-off) | ACCEPTED |
| 5.4 | 5 | minor | Ring sigma 2 mm SE left 81% | OPEN (final) |
| 5.5 | 5 | minor | Ring slide-rest 22-35 px out picks 180-deg item | OPEN (final) |
| 5.6 | 5 | minor | Options toggles hard (Sound R, Vibrate L) | OPEN (final) |
| 5.7 | 5 | minor | Action press rolling >=9 px does nothing silently | OPEN (final) |
| 5.8 | 5 | minor | bagUse travel left hand 195 vs 119 mm | OPEN (final) |
| 5.9 | 5 | nit | Paint step comment 14 px vs code 10 px | OPEN (final) |

Deviations accepted in round 1: Interact <=1% (i13/Pixel 7), 250 ms reaction bar dropped, STOP=center default, 20 Menu drags in e2e.

Baselines for final report:
- plot3x3, human stop at 180 ms: 51 gestures / 25 corrections (M1) -> 26 / 0 (M2, Pixel 7 L/R + SE right; SE left 28 / 2).
- Menu opens from drags: 0 / 500.
- Hoe -> seeds: 5 -> 1 swipe.
- Sell: 6 -> 4 gestures.

- Round 2 (bebb9a9): plot3x3 perfect = 24 gestures, 0 tool changes, 0 marker mismatches (was 26 / 2). Villager 5 -> 4.
- Nudges: same-dir 120 ms push 0 tiles + 8-12 px rubber band (r1) -> 1 tile, 0 slide-back (r2). Rapid taps 2/3 -> 3/3. Menu tap on SE 82% -> 90%.
- Tap latency: preview 104 ms after down, walk 1 frame after lift.
- Round 3 (931b9d8, M5): plot3x3 5 gestures / 229-252 mm / 16 s (was 26 / 933 mm / 20 s at M1). Sell 3, villager 4.
- Round 4 (1962f0b, M6): left-thumb all-screen comfortable 55% -> 79% (= right). Left sheet targets outside comfort (bin/board/gift/jar) 13 -> 0. Opts 11/18 -> 7/19. Fish fixed 7 -> 4.
- Final (9457256): see final.md for the before/after table. Bench 36/36 ok (i13, SE, both hands); e2e Pixel 7/Pro Max/Fold OK; perf OK; 579 unit tests.

## Round 6+ (new agent aad54cc5ba6eaeb86, branch controls/round3 from integration/round2-2026-10-09)

Owner items and my acceptance bars (sent 2026-10-09):

| id | item | bar | status |
|---|---|---|---|
| O1 | Action press-lift with no drag acts once at any duration; no stale hold hints | 1 use at 80-1500 ms; 0 stale strings | MET (r6-8) |
| O2 | Serpentine paint, no accidental work | plot3x3 <=8 gestures, <=250 mm; wobble bars 95/95/85%; 0 turns from drift; 0 stray tiles at 2 mm | PARTLY (r8): see 6.1, 6.3 |
| O3 | Ring dead zone ~36 px, accuracy | rest at 22-35 px = 0 picks; 2 mm: i13/P7 >=90%, SE >=85%, wrong <=2% | MET within noise (r7); minor 6.4/6.5 |
| O4 | Options Sound/Vibrate in reach | comfortable for both hands; 0 hard in menu-opts | MET (r7 reach) |
| O5 | Rolled Action press feedback/intent | 0 silent outcomes at 9-13 px roll | MET (r8: reject + still-roll acts) |
| O6 | Left bagUse travel | <=130 mm i13, <=135 Pixel 7; right no worse | MET (agent bench 103/83 mm) |
| O7 | Event names for onboarding | diff against integration/round2 each round | MET (names identical) |

Round 6-8 findings (review-6.md; game code at 9e66c26 = f6f86d5):

| id | sev | summary | status |
|---|---|---|---|
| 6.1 | major | Painted tiles flicker/retract at thresholds and turns (closed-loop 4/12 fail, ticks for vanished tiles) | OPEN |
| 6.2 | major | Walk taps on the front path enter the farmhouse 3/24 (facade bottom row -> door) | OPEN |
| 6.3 | major | Open-loop serpentine sigma 2 strays (agreed: bar moves to closed loop, conditional on 6.1) | OPEN |
| 6.4 | minor | Ring dead zone short on SE (34 px rest picks) | OPEN |
| 6.5 | minor | Sticky tap SE right 79-89% | OPEN |
| 6.6 | - | plot3x3 travel 250-286 mm i13L/Pixel 7 | ACCEPTED |
| 6.7 | - | Straight sigma 3 on SE below 85% | ACCEPTED (bar sigma 2 >= 93%) |
