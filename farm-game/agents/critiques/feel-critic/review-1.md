# Review 1: M1 (b27830d) + M2 (2ba7c0d)

Frozen copies: `round-1/farm-game` (M1) and `round-2/farm-game` (M2). Numbers below are for M2 unless marked.
Raw data: `round-2/out/` (`motion-summary.json`, `pacing.json`, strips) and `round-1/out/`.

**Verdict:** accepted. The camera, pacing, transitions, Calm mode and pixel integrity meet the criteria.
0 blockers, 0 majors, 6 minors, 3 nits.

## Against the criteria

|                                                                              | Baseline                                                                   | M2                                                                         | Criterion                                                       |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| A. Steady 4x p95 / p99 / max / > 33 ms                                       | 7.0 / 7.2 / 41.7 / 1                                                       | 7.0 / 7.1 / 7.2 / 0                                                        | met                                                             |
| A. Steady 6x p95 / p99 / max / > 33 ms                                       | 13.9 / 14.0 / 48.6 / 2                                                     | 7.0 / 7.1 / 20.9 / 0                                                       | met                                                             |
| A. Walk JS work per frame, p95 at 4x                                         | 6.5 ms                                                                     | 2.3 ms                                                                     | (better)                                                        |
| B. Worst door frame, 4x / 6x                                                 | 48.6 / 69.5                                                                | 14.0 / 20.9                                                                | met                                                             |
| B. Sheets at 6x: max / frames > 33 ms                                        | 55.6 / 4                                                                   | 27.8 / 0                                                                   | met                                                             |
| B. Sleep worst frame at 6x                                                   | 97.3                                                                       | 55.4                                                                       | confirm it lands under full black                               |
| C. On-screen reversals in a steady walk (60 / 120 / 30 Hz, all 4 directions) | up to 79/s at 120 Hz                                                       | 0                                                                          | met                                                             |
| C. Rest spot (x / y)                                                         | 100 or 107 / 119 or 126-127                                                | always 100 / 119                                                           | met                                                             |
| C. Settle after a stop, 30 / 60 / 120 Hz                                     | 300 / 67 / 0 ms                                                            | 200 / 200 / 200 ms                                                         | met                                                             |
| D. Walk cadence at the half-speed stick (31.5 px/s)                          | 8 fps                                                                      | 4 fps                                                                      | met                                                             |
| D. Planted-foot slide at full speed                                          | about 5 px per frame                                                       | about 5 px per frame (fallback art)                                        | not met until the art merges (#3)                               |
| E. Something visible on touch-down                                           | 11.7 ms, button fades in over 8 frames                                     | 4.9 ms, button fully lit on the first frame                                | met                                                             |
| E. Stick moves the farmer after an Action press                              | 217 ms / 300 ms                                                            | 133 ms (83 ms after the strike)                                            | met                                                             |
| E. Impact on a strike frame                                                  | lands under the wind-up                                                    | wind-up 3 frames, strike plus 1 px dip                                     | met (art: #3)                                                   |
| F. Door, step to clear                                                       | 22 frames, 367 ms, linear fade                                             | 19 frames, 317 ms, dither wipe, HUD stays                                  | 17 ms over (#2)                                                 |
| F. Sheet open / close                                                        | 12 / 0 frames                                                              | 12 / 6 frames; instant in Calm                                             | met                                                             |
| G. Calm: peak live tweens on vs off                                          | not gated                                                                  | 7 vs 39                                                                    | met                                                             |
| H. Visible non-integer scale or rotation                                     | 10 kinds                                                                   | whole-pixel squash only                                                    | partly met (#4)                                                 |
| J. e2e:controls                                                              | OK                                                                         | OK (E2E_CONTROLS_PARALLEL=1)                                               | met                                                             |
| J. bench:thumb, i13 right / left                                             | plot3x3 7 gestures, 250/273 mm, 23.1/24.9 s; fish 9.1/10.4 s; toTown 9.1 s | plot3x3 7 gestures, 257/276 mm, 23.6/25.6 s; fish 7.2/11.4 s; toTown 9.0 s | met: gestures identical, the bot waits for the camera to centre |

Strips:

- `round-2/out/door-farm-house-60hz.png` (the wipe; good)
- `round-2/out/action-press-strip.png` vs `round-0/out/action-press-strip.png`
- `round-2/out/harvest-60hz-strip.png`
- `round-2/out/harvest-calm-60hz-strip.png`
- `round-1/out/action-till-60hz.png`

Probe note: the hit-stop runs on `window.setTimeout`. In my stepped probe, wall-clock time doesn't advance between
frames, so the tweens stay frozen. `harvest-strip.mjs` steps frames with real time in between, so it shows the
harvest as it plays.

## Findings

1. **[minor] The harvested item sits over the farmer's face.** In `harvest-60hz-strip.png`, the parsnip rises
   from the tile and then hovers over his face and chest from frame 6 to about frame 30 (400 ms) before fading.
   Ask: lift it clear above the head, so its bottom is at or above the top of his hair, and hold it there; or
   arc it to the bag. In Calm, a still icon above the head for about 300 ms would be enough (today Calm shows
   only the text).
2. **[minor] The door takes 317 ms; the target is 300.** Close 8 frames, covered 3, open 9. At 6x the build
   frame is only 20.9 ms now, so a single hold frame hides it. Ask: hold 1 frame, or open in 130 ms.
3. **[minor, art-dependent] The walk slide and the strike pose with today's art.** The 4-frame fallback still
   covers 8 px per animation frame at full speed (about 5 px slide). The settle glide (110 px/s) is capped at
   10 fps, so it covers 11 px per frame. The fallback strike swaps the hoe-overhead pose for the plain idle frame
   dipped 1 px, so the hoe vanishes at the moment of impact. Both should resolve with art round 4: 8 walk frames
   at 16 fps (4 px per frame) and a 4-frame swing. I'll measure the foot slide and the swing on the merge.
   Until then, consider letting the glide's fps go above the cap, or shortening the glide.
4. **[minor] The whole-pixel squash is still a non-integer scale.** Crops and `item_parsnip` go to 1.13 and 0.88:
   ±2 px on 16, which duplicates or drops columns for 110 ms. I accept your pushback for now. Close it with the
   art's `_pop` frames; where there are none, use a 1 px hop instead of a scale.
5. **[minor] Taps can drift while the camera centres at rest.** After every stop, the world moves up to 8 px over
   200 ms. `WorldTouch` sends the touch-down coordinates (`x0`, `y0`), but `WorldScene.worldPoint` resolves them
   through the camera at touch-up, so a tap made during the centring lands up to a few px from where the finger
   came down. Ask: convert to world coordinates at touch-down, or pause the at-rest centring while a finger is on
   the world. With that done, I accept the bench deltas: gestures are identical and mm is within 3%.
6. **[minor, watch] The first Action at 6x had a slow frame.** In one run, the first Action of the session spent
   67.5 ms of JS in one frame (53 ms from touch-up to the act). Later presses took 10 ms, and 1x and 4x were clean.
   Probably a first-use cost: the dust flipbook image, the pose texture or an audio take. Ask: prewarm it with the
   rest.
7. **[nit] The hit-stop runs on a wall-clock timer.** `window.setTimeout` plus `tweens.timeScale = 0` sits
   outside the game clock. If the scene goes inactive before the timer fires, the guard skips the restore and the
   scene object keeps `timeScale` 0 on its next visit. Ask: use `this.time.delayedCall` (the scene clock, which
   `tweens.timeScale` doesn't touch) and set `tweens.timeScale = 1` in `create()`.
8. **[nit] Confirm the toasts don't travel in Calm.** My tween scan still saw UI containers tweening `alpha+y`
   under Calm (65 frames, the same count as with Calm off). If that is a toast, it should fade in place.
9. **[nit] The camera nudge on level-up and goal complete is fine.** The 2 px spring is skipped in Calm. Keep it
   off routine actions, and keep goal completions rare enough that it stays a moment.

F13 (canvas scale): the coordinator's ruling is accepted. Pixel 7, Pro Max and Fold get whole pixels; i13 and
SE stay at fit because the loss or the target pitch rules them out. The uneven columns remain on the two most
important phones. Rendering at an integer multiple and downscaling smoothly is still an option for later.
I've recorded it as ruled, not open.
