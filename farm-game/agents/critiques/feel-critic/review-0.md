# Review 0: baseline (integration/round3-2026-10-10, 6d5e480)

Frozen copy: `feel-critique/round-0/farm-game`, served on :5185. Raw data: `round-0/out/` (`motion.json`,
`motion-summary.json`, `pacing.json`, `scale.txt`, strips `*.png`).

Limits: headless Chromium, software GL. This host runs rAF at about 144 Hz (6.9 ms) at 1x, so 1x is a
high-refresh case. Absolute times are pessimistic; compare rounds against each other. The stepped motion probe is
exact: it calls `game.step()` at a fixed delta with `Date.now` virtualised, so frame-level numbers are deterministic.

## Frame pacing (rAF intervals, iPhone 13 profile)

|                                                           | 1x              | 4x                | 6x                          |
| --------------------------------------------------------- | --------------- | ----------------- | --------------------------- |
| Steady play (idle, walk, tap-walk, paint) p95 / p99 / max | 7.0 / 7.1 / 9.2 | 7.0 / 7.2 / 41.7  | 13.9 / 14.0 / 48.6          |
| Steady frames > 33 ms                                     | 0               | 1                 | 2                           |
| Worst map-change frame                                    | 7.9             | 48.6 (house>farm) | 69.5 (house>farm)           |
| Doors with a frame > 33 ms                                | 0/12            | 3/12              | 12/12 (2 frames on 2 doors) |
| Sheets (menu, bin, shop, board, mail) max / > 33          | 7.1 / 0         | 27.7 / 0          | 55.6 / 4                    |
| Coach marks p95 / max                                     | 7.0 / 7.1       | 7.0 / 20.9        | 20.8 / 55.5                 |
| Sleep + summary max                                       | 8.9             | 34.8              | 97.3                        |

The 6x frame rate halves to 72 Hz (p95 13.9). The hitch in a door is the new scene's `create()` (JS work up to
59 ms at 6x), which lands while the screen is black. The sleep spike is the day rollover.

## Camera and screen stability (stepped, exact)

On-screen player x (or y) during a steady 1 s walk, after 0.5 s of warm-up:

| Refresh | Right                                 | Left              | Down                                  | Up                  |
| ------- | ------------------------------------- | ----------------- | ------------------------------------- | ------------------- |
| 60 Hz   | 109..112, 3 moves/s                   | 95..98, 3 moves/s | 128..131, 3 moves/s                   | 113..116, 3 moves/s |
| 120 Hz  | **107/108, 80 moves/s, 79 reversals** | 100, still        | **126/127, 79 moves/s, 78 reversals** | 119, still          |
| 30 Hz   | 116..119                              | 89..92            | 135..138                              | 107..110            |

- At 120 Hz, walking right or down, the farmer shimmers 1 px back and forth every frame. Left and up are
  rock-steady. Cause: `startFollow(sprite, true, 0.12)`. Phaser floors the lerped scroll and floors the sprite
  position separately, and `floor` is asymmetric.
- Where the farmer rests depends on the last direction walked: x rests at 107 after walking right and 100 after
  walking left (7 px apart); y rests at 126 or 127 after walking down and 119 after walking up.
- The lerp is per frame, not per ms. The camera settles in 67 ms at 60 Hz and 300 ms at 30 Hz, and the lead is
  9 to 12 px at 60 Hz but 16 to 19 px at 30 Hz. The camera feels different on every phone and under load.
- Ground scroll at 60 Hz is a clean 1 px per frame. At 120 Hz it alternates 0 and 1, which is inherent to
  64 px/s.

## Walk cycle

Strips: `walk-cycle-frames.png`, `walk-right-60hz-world.png` (fixed to the world, so the ground is still).

- Side view: frames 0 and 2 are identical (legs apart), and so are frames 1 and 3 (legs together, 1 px up). It is
  a two-pose shuffle played at 8 fps.
- The farmer covers 8 px per animation frame (64 px/s at 8 fps). The drawn foot moves about 3 px between poses,
  so a planted foot slides about 5 px every 125 ms.
- The two-speed stick at half speed moves 31.5 px/s but still animates at 8 fps, so the feet skate at double
  cadence. Animation rate is fixed, not driven by distance.

## Action feel

Strips: `action-till-60hz.png`, `harvest-pop-30hz-strip.png`.

- The till lands on press frame 0: soil and dust appear while the pose shows the hoe raised overhead. That one
  wind-up frame is held for 16 frames (267 ms), then the farmer snaps to idle. There is no strike frame.
  Harvesting with the hoe selected shows the same hoe-raised pose.
- Action fires on release. On a touch held 90 ms, the response comes 111 to 145 ms after touch-down and 7 to
  17 ms after touch-up.
- Root after a swing: a stick push on the next frame first moves the farmer after 217 ms when pushed the same way
  as facing, and after 300 ms in a new direction (the 200 ms action lock plus the 100 ms turn-hold).
- Tap-to-walk responds in 1 frame (6.6 ms at 1x, 13.3 ms at 4x, 23 ms at 6x).

## Transitions

- Door: 22 frames (367 ms) from stepping on the door to a clear view. Fades are linear: 180 ms out, `create()`,
  180 ms in. While held, the stick stays locked until it is released; that is intended, so the farmer doesn't
  bounce back through the door. Taps during the fade are dropped (`onTap` returns while transitioning).
- Sheet open: 12 frames (200 ms) with Cubic.easeOut and the dim fading over 140 ms. Good.
- Sheet close: 0 frames. It pops out of existence. Strip: `sheet-bin-open-close.png`.
- Sleep: 650 ms fade to black, rollover, 500 ms wait, summary (must be acknowledged), 600 ms fade in.

## Calm mode (reduceMotion)

- Honoured by the "no" shake, ambient life, night glow, NPC idles and object idles.
- Not honoured by:
  - the sheet slide (frame-for-frame identical);
  - the soil pop, item pop, particles and level-up celebrate (peak live tweens 42 with Calm on, 33 with it off);
  - the camera lerp.

## Pixel integrity

Visible objects with a non-integer scale (rotation: none seen):

- `soil_tilled` pops from 0.70 to 1;
- `fx_px` particles at 0.7 to 2.35;
- the tile marker Graphics pulses from 1.30 to 1;
- in the UI: `item_hoe` at 1.90, `item_watering_can` tweening 1.88 to 2.35, `ui_bolt`/`ui_drop` at a static 0.80;
- `item_parsnip` at 0.50.

Sprite positions are integer on screen (`roundPixels` with integer camera zoom).

Canvas scale is non-integer on every profile (`scale.txt`), so game-pixel columns are uneven, and they crawl as
the world scrolls:

| Profile   | Device px per game px | Column widths | Spread |
| --------- | --------------------- | ------------- | ------ |
| iPhone 13 | 5.72                  | 5/6           | 20%    |
| Pixel 7   | 5.41                  | 5/6           | 20%    |
| iPhone SE | 3.24                  | 3/4           | 33%    |
| Pro Max   | 6.29                  | 6/7           | 17%    |
| Fold      | 4.20                  | 4/5           | 25%    |

## Taste

No camera shake anywhere. The only shake is the sprite's "no" wiggle, and Calm honours it. Keep it that way.
