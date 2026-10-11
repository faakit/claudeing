# Feel critique ledger (Tiny Acre, branch feel/smooth)

Critic: game-feel critic. Feel agent: a9abfa07ef9e79bb8, worktree `C:/Users/andre/dev/tiny-acre/controls`.
Baseline: `integration/round3-2026-10-10` (6d5e480), frozen at `feel-critique/round-0/farm-game`.

Tools (all in `feel-critique/tools/`):

- `motion.mjs`: stops Phaser's rAF loop and steps `game.step()` by hand at 60/120/30 Hz with `Date.now`
  virtualised (Phaser 3.60+ tweens run on `Date.now`). Records player world/screen position, camera scroll,
  animation frame, action lock and pixel-integrity offenders per frame, and composes frame strips from the
  real WebGL output. `analyze-motion.mjs` summarises it.
- `pacing.mjs`: real-time rAF intervals, Phaser loop delta and per-frame JS work per scripted phase at 1x/4x/6x
  CPU throttle, plus touch-to-response latency over CDP touch events.
- Host note: this headless Chromium runs rAF at about 144 Hz (6.9 ms) at 1x, so 1x is a high-refresh case.

## Rounds

| Round | Build                                  | Verdict                                                               | Review                |
| ----- | -------------------------------------- | --------------------------------------------------------------------- | --------------------- |
| 0     | baseline 6d5e480                       | measured; opening message sent (13 findings, criteria A-J)            | review-0.md           |
| 1     | M1 b27830d + M2 2ba7c0d                | accepted; 0 blockers, 0 majors, 6 minors, 3 nits                      | review-1.md           |
| 2     | M3 b430892 (art round-4 merge 8ebd1b3) | accepted; 8/9 R1 closed; new: 1 minor, 3 nits                         | review-2.md           |
| 3     | final cbcc60d                          | accepted as final; open: 1 nit (R2-2); verify green on my frozen copy | review-3.md, final.md |
| 4     | 875eda6 (R2-2 text fix)                | checked: R2-2 closed; nothing open                                    | final.md (addendum)   |

## Findings

Status: open / fixed (round) / wontfix (agreed) / disputed.

| ID   | Sev                | Finding                                                                                                                                                                                                    | Status                                                                                                    |
| ---- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| F1   | major              | 120 Hz camera shimmer: walking right/down, the player's screen position flips 1 px every frame (80 moves/s, 79 reversals); left/up are still. Floor-biased follow lerp.                                    | fixed (M1/M2): 0 reversals, rest 100/119, settle 200 ms at 30/60/120 Hz                                   |
| F2   | major              | Rest position depends on last walk direction: 7 px apart in x (107 vs 100) and in y (126/127 vs 119).                                                                                                      | fixed (M1/M2): 0 reversals, rest 100/119, settle 200 ms at 30/60/120 Hz                                   |
| F3   | major              | Camera lerp is per frame: settles in 67 ms at 60 Hz vs 300 ms at 30 Hz; lead 9-12 vs 16-19 px.                                                                                                             | fixed (M1/M2): 0 reversals, rest 100/119, settle 200 ms at 30/60/120 Hz                                   |
| F4   | major              | Action impact lands under the wind-up pose (no strike frame); pose held 267 ms then snaps to idle; harvest shows hoe pose.                                                                                 | fixed (M3, art): wind-up 4 frames, swing 2, contact 7 with dust, follow 5                                 |
| F5   | major              | Action fires on release: 111-145 ms from touch-down with no anticipation in the world.                                                                                                                     | fixed (M1): button lit in 4.9 ms on touch-down; the act stays on release by design                        |
| F6   | major              | Root after a swing: 217 ms (same dir) / 300 ms (new dir) before the stick moves the farmer.                                                                                                                | fixed (M1): 133 ms from press (83 ms after the strike)                                                    |
| F7   | major              | Walk animation fixed at 8 fps: about 5 px foot slide per frame; half-speed stick skates at full cadence; side cycle is a two-pose shuffle (art frames 0=2, 1=3).                                           | fixed (M3, art): 3.93 px per anim frame at 16 fps, about 3 px slide; half speed 10 fps                    |
| F8   | minor              | Door transition 367 ms (22 frames), linear 180+180; taps during the fade are dropped.                                                                                                                      | fixed (M3): 283 ms                                                                                        |
| F9   | minor              | Sheet close pops in 0 frames (open is a good 200 ms Cubic.easeOut).                                                                                                                                        | fixed (M1): close in 6 frames; instant in Calm                                                            |
| F10  | major              | Calm mode ignores sheet slides, soil/item pops, particles and the celebrate (peak tweens 42 on vs 33 off).                                                                                                 | fixed (M1/M2): peak tweens 7 Calm vs 39 off                                                               |
| F11  | minor              | Non-integer scale on visible pixel art: soil_tilled 0.70 to 1 pop, fx_px 0.7-2.35, marker 1.30 to 1, UI item_hoe 1.90, item_watering_can 1.88-2.35, ui_bolt/ui_drop 0.80, item_parsnip 0.50.               | fixed (M3): no offenders                                                                                  |
| F12  | minor              | Hitches: map change worst 48.6 ms at 4x / 69.5 ms at 6x (under black); sheets at 6x up to 55.6 ms (4 frames > 33); sleep 97 ms at 6x; coach marks p95 20.8 ms at 6x.                                       | fixed (M1/M2): doors 14/20.9 ms at 4x/6x, sheets 6x 27.8, 4x steady max 7.2                               |
| F13  | major (owner call) | Canvas scale is non-integer on every profile (iPhone 13 5.72 device px per game px, SE 3.24): uneven pixel columns crawl as the world scrolls.                                                             | ruled (coordinator): whole px on Pixel 7, Pro Max, Fold; i13 and SE stay fit                              |
| F14  | major              | (feel agent's find) Title to game hitch: 167 / 514 / 625 ms at 1x / 4x / 6x, a hard cut; audio unlock (reverb impulse plus noise buffers, about 220 ms at 4x) plus Farm.create and UI.create in one frame. | fixed (cbcc60d): worst 1x 56/21, 4x 69/62, 6x 118/111 vs baseline 146/389/591                             |
| F15  | minor              | (feel agent's find) About 26% of steady step time is earcut re-tessellating TouchButton circles every frame, plus chooseAction/updateHighlight every frame.                                                | fixed (M1): dock and interact icons baked; walk work p95 4x 6.5 to 2.3 ms                                 |
| P1   | process            | The agent's perf budgets (1x steady p95 <= 18, doors <= 100 at every throttle) are 2-3x looser than baseline; asked for relative budgets.                                                                  | fixed (M1): budgets tightened as asked                                                                    |
| R1-1 | minor              | Harvested item hovers over the farmer's face about 400 ms.                                                                                                                                                 | fixed (48b2300): arcs beside/behind, face clear in every frame                                            |
| R1-2 | minor              | Door 317 ms, over the 300 ms target (hold 1 frame or open in 130 ms).                                                                                                                                      | fixed (M3): 283 ms                                                                                        |
| R1-3 | minor              | Fallback art: about 5 px foot slide at full speed, glide 11 px/frame; strike makes the hoe vanish. Recheck on the art round-4 merge.                                                                       | fixed (M3, art)                                                                                           |
| R1-4 | minor              | Whole-pixel squash = scales 1.13/0.88 (column duplication); fix with _pop frames or a 1 px hop.                                                                                                            | fixed (M3)                                                                                                |
| R1-5 | minor              | Tap drift: touch-down coordinates resolved through the camera at touch-up while it centres.                                                                                                                | fixed (M3): camera holds while a finger is down and the farmer is still                                   |
| R1-6 | minor              | First Action at 6x: one 67.5 ms JS frame; prewarm first-use costs.                                                                                                                                         | fixed (M3): 9 ms at 6x                                                                                    |
| R1-7 | nit                | Hit-stop on window.setTimeout; can leave timeScale 0 on a scene revisit.                                                                                                                                   | fixed (M3)                                                                                                |
| R1-8 | nit                | Confirm toasts don't travel (y) in Calm.                                                                                                                                                                   | fixed (M3)                                                                                                |
| R1-9 | nit                | Camera nudge: keep it to big moments only.                                                                                                                                                                 | fixed (M3)                                                                                                |
| R2-1 | minor              | Title to game 4x: one run 285 ms (budget 200); 6x 6-7 frames > 100 ms; confirm all under the wipe.                                                                                                         | fixed (cbcc60d): 4x 69/62 ms, 6x 118/111; long frames under the wipe except the tap                       |
| R2-2 | nit                | Harvested item's leaves touch the pickup text baseline.                                                                                                                                                    | fixed (875eda6): no overlap; leaf tips touch the text bottom edge (0 px gap) for a few frames, acceptable |
| R2-3 | nit                | syncSprite and Hud read game.loop.delta instead of the update delta.                                                                                                                                       | fixed (cbcc60d)                                                                                           |
| R2-4 | nit                | Sheets at 6x 34.7 ms once (probably probe/host noise).                                                                                                                                                     | closed: 27.8 ms max at 6x, no frame > 33                                                                  |

Probe note (round 2): the stepped probe now sets game.loop.delta; the review-1 half-speed walk numbers were artifacts.

## Baseline numbers to beat (round 0)

- Pacing steady (p95/p99/max/>33): 1x 7.0/7.1/9.2/0; 4x 7.0/7.2/41.7/1; 6x 13.9/14.0/48.6/2.
- Door worst frame: 1x 7.9; 4x 48.6; 6x 69.5 (12/12 doors over 33 ms at 6x).
- Tap-to-walk response: 1 frame. Action response: down+111-145 ms / up+7-17 ms.
- e2e:controls OK. bench:thumb OK (18 rows, R3), i13: plot3x3 7 gestures 250/273 mm 23.1/24.9 s; toTown 9.1 s;
  fish 11/9 gestures 9.1/10.4 s; villager 4 gestures 152/137 mm.
