# Tiny Acre game feel: final critique (feel/smooth at cbcc60d)

Baseline `integration/round3-2026-10-10` (6d5e480) against final `feel/smooth` cbcc60d (M1 b27830d, M2 2ba7c0d,
art round-4 merge 8ebd1b3, M3 b430892, 48b2300, cbcc60d). Rounds: `review-0.md` to `review-3.md`; tracking in
`ledger.md`. Frozen copies are in `round-0` to `round-4`; tools are in `tools/`.

**Verdict:** ship it. The game now moves like one piece:
- the camera is locked to the farmer's pixel;
- the walk is driven by speed, with the art's 8 frames;
- tool swings have anticipation and impact;
- map changes are a 280 ms dither wipe;
- sheets slide both ways;
- Calm mode is real;
- hitches are hidden or gone.

The controls are unchanged in gestures, and verify is green.

## How it was measured, and what that can't tell you

- **Stepped motion probe (exact):** Phaser's loop is stopped and `game.step()` is called at a fixed 60, 120 or
  30 Hz, with `Date.now` and `loop.delta` set to the virtual clock. It reads on-screen positions, camera scroll,
  animation frames and pixel-integrity offenders per frame, and composes frame strips from the real WebGL output.
- **Real-time pacing:** rAF intervals and per-frame game JS on an iPhone 13 profile, at 1x, 4x and 6x CPU throttle.
- **Limits:**
  - headless Chromium with software GL;
  - this host's rAF runs at 144 Hz;
  - the machine was shared with other agents, so some single spikes were host stalls (each one was checked with a
    rerun);
  - no real phone, no native build, no haptics.

## Before and after

| | Baseline | Final |
| --- | --- | --- |
| **Frame pacing (rAF ms)** | | |
| Steady play 4x: p95 / p99 / max / frames > 33 ms | 7.0 / 7.2 / 41.7 / 1 | 7.0 / 7.1 / 41.7 / 1 in the first run (one tap-walk spike, 3.9 ms JS); 6x rerun max 13.9 |
| Steady play 6x: p95 / p99 / max | 13.9 / 14.0 / 48.6 | 7.0 / 7.1 / 13.9 |
| Game JS per frame while walking, p95 at 4x | 6.5 ms | 2.2 ms |
| Worst map-change frame 4x / 6x | 48.6 / 69.5 | 7.2 / 20.9 |
| Title to game, worst frame 1x / 4x / 6x | 146 / 389 / 591 | 56 / 69 / 118, long frames under the wipe except the tap |
| Sleep + summary worst frame at 6x | 97 | 49-56, under full black |
| Sheets worst frame at 6x | 55.6, 4 frames > 33 ms | 27.8, none |
| **Camera (stepped)** | | |
| On-screen reversals in a steady walk | 79 per s at 120 Hz walking right or down | 0 in all directions at 30, 60 and 120 Hz |
| Rest spot after walking right / left | x 107 / 100 (7 px apart) | always 100 / 119 (centred) |
| Settle after a stop at 30 / 60 / 120 Hz | 300 / 67 / 0 ms | 200 / 200 / 200 ms |
| **Animation** | | |
| Walk | 4-frame shuffle (frames 0=2, 1=3) at 8 fps; 8 px per frame, about 5 px foot slide | 8 frames at 16 fps; 3.9 px per frame, about 3 px slide; half speed 10 fps |
| Tool use | impact under a held wind-up frame (267 ms), snap to idle | wind-up, swing with arc, contact with dust (impact here), follow-through |
| Stick after an Action | 217 ms (same direction), 300 ms (new direction) | 133 ms (83 ms after contact) |
| Action button on touch-down | fades in over 8 frames | fully lit on the first frame (4.3 ms) |
| Harvest | hoe pose, item stuck on the face | item arcs beside and behind, rests above the head; 34 ms hit-stop |
| **Transitions** | | |
| Door, step to clear | 367 ms, linear black fade, taps dropped | 283 ms, 4x4 dither wipe with HUD kept; farmhouse door opens and closes |
| Sheet open / close | 200 ms / pops shut | 200 ms / 6-frame slide out, input back at once |
| **Calm mode** | only the "no" wiggle | slides, particles, pops, floats, swings, hit-stop, nudges all off; peak tweens 7 vs 34 |
| **Pixel integrity** | 10 kinds of visible non-integer scale (soil pop, particles, marker, UI icons 0.8/1.9/2.3x...) | none |
| **Canvas** | non-integer on all 5 profiles | whole device pixels on Pixel 7 (5x), Pro Max (6x), Fold (4x); iPhone 13 (5.72) and SE (3.24) stay at fit (coordinator ruling) |
| **Controls** | e2e:controls OK; bench i13 plot3x3 7 gestures, 250/273 mm, 23.1/24.9 s | e2e:controls OK; identical gestures; 256/276 mm, 23.7/25.5 s (the bot now waits for the camera to finish centring) |
| `npm run verify` | green | green, plus `e2e:feel` and frame-time budgets in `perf` |

## Open findings

- **Blockers:** none.
- **Majors:** none.
- **Minors:** none.
- **Nits:**
  - R2-2: for about 170 ms at the start of a harvest's rest, the item's leaves overlap the bottom row of
    "+1 Parsnip". They clear once the text rises.
- **Ruled, not open:** F13, the canvas scale. On iPhone 13 and SE, game-pixel columns are still uneven (5/6 and
  3/4 device px), so fine patterns can crawl slightly while scrolling. Rendering at an integer multiple and
  downscaling smoothly would fix it without moving touch targets, if it ever bothers you.
- **Watch:** the tap that starts a new game creates the AudioContext inside the gesture (60-110 ms at 4-6x in
  headless). It's the iOS unlock design and was left as the audio agent built it.

## What to feel for on a real phone

1. **The walk on a 120 Hz phone** (recent iPhone Pro, most Android flagships). Walk right and down across the farm
   and watch the farmer, not the world. He should sit dead still on screen while the ground scrolls; before, he
   buzzed by 1 px every frame. Stop and he should glide to centre in about 0.2 s, the same after every direction.
2. **Feet.** At normal speed the 8-frame walk should read as stepping, not skating. Try the gentle half-speed push
   (Options, two-speed stick): the legs should slow down with the body.
3. **A hoe swing.** Press Action on grass: you should see the hoe go up, come down, and the soil and dust appear on
   the strike. The button should light the instant your thumb lands. Push the stick right after: you should be
   walking in about an eighth of a second.
4. **Doors.** Walk in and out of the farmhouse a few times. A quick dither in and out (under 0.3 s) with the HUD
   and dock staying put, and no stutter as the new room appears.
5. **Harvest.** The crop should arc up beside the farmer and sit above his head with a tiny pause; nothing should
   cover his face. Check that the "+1" text doesn't collide with the item (the one known nit).
6. **Calm mode** (Options). Repeat 3 to 5: the pops, particles and slides should go; fades remain.
7. **Haptics** (native build only). The tick should land on the strike, not on the press. Nothing headless can
   check this.
8. **Pixel crawl on iPhone 13 or SE.** Slowly scroll over the grass and fences. If you see shimmering columns,
   that's the canvas-scale ruling, not a bug.
9. **A cold start.** Tap the title and watch for a hitch as the farm appears; only the tap itself should show a
   pause.
