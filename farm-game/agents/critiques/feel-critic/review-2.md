# Review 2: M3 (b430892) on the art round-4 merge (8ebd1b3)

Frozen copy: `round-3/farm-game`. Raw data: `round-3/out/`.

**Verdict:** accepted. 8 of 9 review-1 findings are closed; the 9th (the harvest arc) is acknowledged and queued.
New: 0 blockers, 0 majors, 1 minor, 3 nits.

Probe correction: when stepping frames by hand, my probe didn't update `game.loop.delta`. `WorldScene.syncSprite`
reads `game.loop.delta`, not the update's delta, so the walk-rate numbers in review 1 for the half-speed stick were
artifacts. The probe now sets `loop.delta` on every step, and the numbers below are clean. The code did scale by
speed all along.

## Numbers

| | Baseline | M2 | M3 |
| --- | --- | --- | --- |
| Steady 4x / 6x worst frame | 41.7 / 48.6 | 7.2 / 20.9 | 20.7 / 20.9 (p95 7.0 both) |
| Worst door frame 4x / 6x | 48.6 / 69.5 | 14.0 / 20.9 | 13.9 / 34.8 |
| Door, step to clear (60 Hz) | 367 ms | 317 ms | **283 ms** (17 frames) |
| Title to game, worst frame 1x / 4x / 6x (2 runs each) | 146, 90 / 389, 347 / 591, 535 | n/a | 76, 28 / 132, **285** / 153, 174 |
| Walk JS work p95 at 4x | 6.5 ms | 2.3 ms | 2.9 ms (8-frame art) |
| First Action at 6x, touch-up to act | 17 ms | 53 ms (once) | 9 ms |
| Camera: reversals / rest / settle | 79/s / 7 px spread / 0-300 ms | 0 / centred / 200 ms | 0 / centred / 200 ms |
| Walk: px per animation frame at 64 px/s | 8.0 (8 fps) | 8.0 | **3.93 (16 fps)** |
| Half-speed stick: animation rate | 8 fps | n/a (probe artifact) | 10 fps (3.15 px per frame) |
| Planted-foot slide (art, right-facing) | about 5 px per frame | about 5 | about 3 px per frame: the front foot steps back 1 px per frame while the body moves 3.9 |
| Visible non-integer scale or rotation | 10 kinds | squash only | **none** |
| Calm: peak tweens on vs off | not gated | 7 / 39 | 7 / 41 |
| e2e:controls / bench:thumb i13 | OK / 18 rows OK | OK / OK | OK / OK; gestures identical; plot3x3 257/276 mm, 23.7/25.7 s |

Strips:
- `round-3/out/action-till-60hz.png`: hoe wind-up 4 frames, swing 2 with the arc, contact 7 with the dust,
  follow-through 5. Reads well.
- `round-3/out/walk-right-60hz-world.png`
- `round-3/out/harvest-60hz-strip.png`
- `round-3/out/harvest-calm-60hz-strip.png`: a still icon that fades; Calm is right.

## Review-1 findings

- R1-1 (harvest item over the face): mostly fixed. The item now rests above the hair. It still crosses the face
  for 4 frames (about 67 ms) on the way up, which you've acknowledged; the sideways bow is queued.
- R1-2 (door): fixed, 283 ms.
- R1-3 (walk slide and strike): fixed on the art.
- R1-4 (squash): fixed; no offenders left.
- R1-5 (tap drift): fixed; the camera holds while a finger is down and the farmer is still.
- R1-6 (first Action): fixed, 9 ms.
- R1-7 (hit-stop clock): fixed (`delayedCall`, and `timeScale` is reset in `create()`).
- R1-8 (Calm toasts): fixed (it was the Interact rise).
- R1-9 (nudges): fixed; only big moments use them.

## New findings

1. **[minor] Title to game at 4x: one run of two had a 285 ms frame.** That's over your own budget of 200 ms at
   4x; the other run was 132 ms. At 6x the worst frames were 153 and 174 ms, and 6 to 7 frames were over 100 ms
   in each run. The work is spread now, which is right. Ask: confirm every frame over 50 ms lands while the
   title wipe fully covers the screen, and find what the 285 ms frame was (GC, a texture upload, the audio graph).
   Host load was high, so a rerun on your side is welcome.
2. **[nit] The harvested item touches the pickup text.** At rest, the carrot's leaves touch the baseline of
   "+1 Parsnip" for several frames. Leave 1 to 2 px between them.
3. **[nit] Two places read `game.loop.delta`.** `WorldScene.syncSprite` (walk rate) and `Hud` (tickers) use it
   instead of the delta passed to `update`. They're the same in play, but passing the frame's delta down keeps
   one clock and makes stepped tests honest.
4. **[nit] Sheets at 6x reached 34.7 ms once.** The JS work was only 9.5 ms, and my probe opens sheets from
   outside the game loop, so this is probably my probe and host noise. Noting it in case it shows up in your
   pacing.
