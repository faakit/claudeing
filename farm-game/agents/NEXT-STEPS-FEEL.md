# Next steps: game feel (round 4)

Branch `feel/smooth` (worktree `controls`), from `integration/round3-2026-10-10`. Everything below was measured in
headless Chromium (software GL, a 144 Hz rAF on this host) with CDP CPU throttling, on a machine shared with
other agents (often 80% CPU busy). **No real phone was used**, and headless GL is software-rendered, so absolute
frame times say little about a phone: judge by the relative change against the same harness on the round-3 tree.
`npm run verify` is green at the last commit (the feel critic accepted `cbcc60d` as final: 0 blockers, 0 majors;
`C:/Users/andre/dev/tiny-acre/feel-critique/final.md`) (it now also runs `e2e:feel`, and `perf` enforces frame-time budgets).

Decisions and the measurements behind them: `DECISIONS.md`, "Game feel (feel agent, round 4)" and "Whole-pixel
canvas scale". Frame strips (every rendered frame of a moment, `scripts/frame-strip.mjs`):
`agents/out/feel/strips/` (`before/` is the round-3 tree, `m1/` and `m1-crop/` this branch before the art merge,
`art-merge/` after merging `art/round4`).

## What changed

| area | what | where |
|---|---|---|
| Camera | Pixel-locked follow: the camera sits on the farmer's drawn pixel minus an eased whole-pixel lag (frame-rate independent; hysteresis while walking; a faster catch-up, a pixel a frame, once still; a soft 16 px knee at map edges; a cut on teleports). No shimmer, rest always centred, centred about 200 ms after a stop. | `fx/PixelCamera.ts`, `fx/feel.ts` |
| Map changes | A 4x4 ordered-dither wipe in the palette ink over the world view (HUD and dock stay): 130 ms close, held 1 frame after the new map draws, 140 ms open. The next map is parsed on the frame the door is stepped on; the save snapshot, the scene stop and the new build each get their own covered frame; the new map's first update is skipped. The farmhouse door opens (the art's `obj_door_open_0..3`) and closes behind you on the way out. | `fx/Wipe.ts`, `fx/DoorFx.ts`, `scenes/mapCache.ts`, `WorldScene.useDoor` |
| New game | The title dithers away; HUD and dock are built on one frame and the world on the next, under the wipe; the title prewarms the generated textures, the number formatter and the map parser; the reverb impulse is built after the unlocking tap (and with one multiply per sample instead of a pow). | `fx/prewarm.ts`, `TitleScene.ts`, `audio/graph.ts` |
| Walk | The cycle rate follows the speed actually walked (art critic: 16 fps at 64 px/s, held to 10-20 fps; the art's 8-frame cycle is merged); footsteps on contact frames; a placeholder breathing idle after 1.5 s still. | `WorldScene.syncSprite`, `fx/feel.walkFps`, `fx/playerFrames.ts` |
| Tool use | Wind-up, swing, contact, follow-through (the art's 4 frames, merged; origin from the frame height, so the 36 px hoe and pickaxe frames keep the feet still); particles, sound, haptic and the field change land together on the contact frame; only a tool's own use poses. The stick walks 120 ms after a use, without the turn-in-place wait stacked on. Hit-stop (34 ms) on a single harvest or the first of a hold or row. | `WorldScene.toolSwing`, `tryAction` |
| UI motion | Press-down states on the touch's own frame (1 px sink and glow); sheets slide in from the frame after their build and slide out while the world already takes input; toasts ease in; gold, energy and water tick; the hotbar selection rises in two steps; the coach line fades in per step; the goal banner rises in whole pixels. | `input/TouchButton.ts`, `ui/widgets.ts`, `ui/Hud.ts`, `ui/CoachMarks.ts` |
| Juice | 2 px view nudges on level-ups and completed goals only; crops lean when walked through (the art's lean frames); pops hop 1 px (the art's stretch and squash frames for gathered items, which rest above the farmer's head); ripples on a cast; animal idles loop the art's breath and head-dip frames. | `fx/Effects.ts`, `game/FarmRenderer.ts`, `game/ObjectsRenderer.ts` |
| Pixel integrity | No fractional scales or free rotation on pixel art: Action icon 2x, HUD bolt and drop 1x, particles 1-2 px squares, the marker pulse is a flash, the tap ring is redrawn by radius, tool icons turn in quarter turns, the tool ring fades in. | various |
| Calm | Sheet slides, particles, item hops, floating text, pops, swings, hit-stop, hotbar rise, toast and banner rise, drag-hint pulse, crop lean. | various |
| Canvas | Whole device pixels per game pixel where that costs at most 10% and keeps the hotbar over 38 CSS px (coordinator ruling): Pixel 7 5x, Pro Max 6x, Fold 4x; iPhone 13 and SE keep the fit. Walnut margins split top and bottom. | `platform/displayFit.ts`, `main.ts`, `index.html` |
| Input | A tap on your own tile uses the faced tile (Interact or a harmless act, never till or plant): the mailbox case from the new-player critic. | `systems/tapIntent.ownTileTap` |
| Perf | Dock buttons and Interact icons baked to textures (live Graphics circles were re-tessellated by earcut every frame, about a quarter of the frame's JS). | `fx/bake.ts` |
| Tooling | Frame pacing in `perf` (per-frame p50/p95/p99/max across real play at 1x, 4x and 6x, budgets set against the baseline with the critic); `e2e:feel`; `scripts/frame-strip.mjs`. | `scripts/` |

## Frame pacing: before and after

`node scripts/perf.mjs 1,4,6 pacing`, ms between animation frames (rAF; 6.9 ms = one 144 Hz frame). Baseline is
the round-3 tree on the same host. Max frame per scene:

| scene | 1x before | 1x now | 4x before | 4x now | 6x before | 6x now |
|---|---|---|---|---|---|---|
| new game (title to farm) | 167 | 21 | 514 | 63 | 625 | 118 |
| map changes, worst door | 7 | 7 | 35 | 14 | 63 | 21 |
| sleep and morning summary | 14 | 21 | 42 | 28 | 77 | 49 |
| sheets (bag, shop, bin, board, mail) | 7 | 7 | 21 | 14 | 42 | 35 |
| idle | - | 14 | - | 7 | - | 7 |
| walk | 7 | 7 | 7 | 7 | 28 | 7 |
| tap-walk | 7 | 7 | 14 | 202 (one host stall: game work max 6 ms; p99 7.1) | 35 | 14 |
| painted row | 7 | 7 | 14 | 7 | 28 | 14 |
| coach marks (p95) | 7.0 | 7.0 | 7.0 | 7.0 | 13.9 | 7.0 |

Every frame of a new game over 50 ms now lands while a wipe fully covers the screen at 1x and 4x, except the tap's
own frame (the AudioContext is created inside the gesture, about 60-110 ms at 4-6x on this host); at 6x one more
frame right after the tap is about 70 ms (a probe that marks each long frame covered or in view; see DECISIONS.md).

Game work per frame (Phaser pre-step to post-render, p95, 4x): walk 4.7 -> 2.1 ms, coach marks 7.5 -> 3.5 ms.
Camera (`e2e:feel`, and a probe on the round-3 tree): walking right, the farmer's screen position reversed 125
times in 350 frames; now 0 in all four directions. Rest after walking right / left: x 100 / 108; now always centred.

Budgets now in `npm run perf` (agreed with the feel critic): steady play (idle, walk, tap-walk, painted row) p95 <= 8
at 1x, p99 <= 14 at 4x, max <= 100 at 6x; doors <= 34 at 1x and 4x, <= 50 at 6x; sleep <= 50 at 1x, <= 100 at 4x;
a new game <= 100 at 1x, <= 200 at 4x.

## One-thumb numbers

`bench:thumb` on five phones and both hands: 89/90 rows ok at M1 (after the art merge the feel critic re-ran
i13 only, 18 rows with both hands: OK, identical gestures) (the miss, SE right fish 17 gestures, is the reel
minigame's random fish; re-runs gave 10 and 12). Gestures are identical to round 3 in every task. Time is up
0.4-0.7 s on plot3x3 (i13) because the bench waits for the camera to stop before each tap and the camera now
finishes centring (see DECISIONS.md); the game itself works a painted row in the same 1710 ms. `e2e:controls` is
green (run with `E2E_CONTROLS_PARALLEL=1` on the busy host; with two combos in parallel one lagged ring flick in a
retry was read as hold-then-drag twice).

## Unverified

- No real phone and no native build: the 16 fps walk, haptic timing on the contact frame, the dither on a real
  panel and the whole-pixel canvas on real screens are judged from strips, timers and emulated profiles only.
- Headless GL is software-rendered and the host was shared with other agents: numbers are relative.
- `art/round4` (350cf1a) is merged into this branch (8ebd1b3); the coordinator's integration merge may still
  differ.

## Next steps

1. Owner's phone pass (below), then tune: camera rate (0.12 walking, 0.2 still), wipe times (130/150 ms), tool
   timing, walk fps band.
2. Strips of the door with the art's `obj_door_open_*` (the farmer covers most of it when he stands on the
   door tile; the arrival close is the visible part).
3. The coach marks' pulsing ring scales smoothly (onboarding's file): a whole-pixel pulse would match the rest.
4. Some placed objects still sit at a static 0.8 / 0.62 scale (placeholder sizes): art or depth to redraw at 1x.
5. The bench could tap while the camera eases (as people do) instead of waiting for a still camera.

## Owner questions

1. The world camera now trails you by about 8 px while walking and centres 200 ms after you stop. Snappier
   (less trail) or floatier?
2. Map changes: the dither wipe keeps the HUD and dock on screen. Do you want the old fade back anywhere (sleep
   still fades to black)?
3. On Pixel 7, Pro Max and Fold-size phones the game is drawn 5-8% smaller so every pixel is the same size
   (walnut bands above and below). Keep that, or prefer filling the screen with uneven pixels?
4. Tool swings: the hoe's dust lands about 100 ms after you lift your thumb (wind-up first). Snappier?
