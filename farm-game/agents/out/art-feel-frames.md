# Animation frames for the feel agent (art round 4)

Branch `art/round4`. Every key below is packed in the existing atlases (`chars`, `world`, `ui`; all at or under
1024 px). New keys are **optional** manifest entries unless noted, so nothing breaks if a frame is missing. Helpers
live in `src/art/manifest.ts`. Frames are built in code: `art-src/tools/anim.py` (walk), `toolanim.py` (tool
use) and `motion.py` (everything else); `python art-src/tools/strips.py` writes review strips and onion skins to
`agents/out/art-shots/round4/strips/`.

Timings below are suggestions in ms; the wiring and the final timing are yours. Everything was judged from
headless renders only.

## 1. Player walk: 8 frames per direction (required keys)

- Frames: `player` texture, `player_walk_<dir>_0..7`, dir in down, up, right, left (left mirrors right).
  `PLAYER_WALK_FRAMES = 8`, `playerWalkFrames(dir)` returns all 8.
- Order: 0 contact, 1 down, 2 passing, 3 up, 4 contact (other foot), 5 down, 6 passing, 7 up.
- Head: pixel-identical to `player_idle_<dir>_0` in every frame, 0 px or 1 px lower (1 px only on the down
  frames 1 and 5). A foot is on the bottom row in every frame (tested).
- Stride: side view, the feet are 7 px apart at contact (about 3.5 px each side of the hips); front and back, the
  lifted foot rises 2 px on the passing frame and 1 px on the up frame.
- Speed match: `PLAYER_SPEED` is 64 px/s. A full cycle (2 steps) covers 2 x 7 = 14 px of foot travel at most
  if the feet were not to slide, which would need about 4.6 cycles/s (37 fps): not a cozy walk. In practice
  pick a cycle time for the feel (Preload now uses `WALK_FPS * 8 / 4 = 16` fps, the old cycle time, 0.5 s per
  cycle, 32 px per cycle). For less visible sliding, 18-20 fps (0.4-0.44 s per cycle) is the upper end before it
  reads as a jog. Suggested: 16 fps (62 ms per frame), all frames equal.
- `PreloadScene` builds `player_walk_<dir>` from the 8 frames at `WALK_FPS * 8 / 4`; retune freely.

## 2. Tool use: 4 frames, 32 x 32 single-image keys

- Keys: `player_tool_<tool>_<dir>_<i>`, built with `toolAnimFrames(itemId, dir)` (returns [] where a facing has
  no frames). `TOOL_ANIMS` maps item ids to frame names:
  - `hoe` -> `hoe` (down, up, right, left)
  - `pickaxe` -> `pick` (down, up, right, left)
  - `watering_can` -> `can` (down, right, left)
  - `scythe` -> `scythe` (down, right, left)
  - `fishing_rod` -> `rod` (down, right, left)
- Frames: 0 wind-up (anticipation), 1 swing (with a smear on hoe, pick, scythe and rod), 2 **contact**
  (`TOOL_CONTACT_FRAME = 2`: spawn the dust, leaves or splash on this frame), 3 follow-through. End on the idle
  frame (settle).
- Placement: the same as the round-3 pose, `origin(0.5, 1)` at the player's feet; the body sits at x 8..23 of the
  32 px canvas, the head pixel-identical to the idle frame. Left: use the `_left_` keys (already mirrored).
- Suggested timing (total about 300-340 ms, inside `ACTION_LOCK_MS.ok + 60`):
  - hoe, pick: 0 = 90, 1 = 50, 2 = 110, 3 = 80
  - scythe: 0 = 70, 1 = 40, 2 = 90, 3 = 90
  - can: 0 = 80, 1 = 60, 2 = 120, 3 = 120 (2 and 3 alternate the water drops; loop 2-3 for a longer pour)
  - rod: 0 = 120, 1 = 50, 2 = 120, 3 = hold while the line is out
- Facing up: only hoe and pick. For the rest keep the walk sprite (as before).
- The round-3 keys `player_use_hoe`, `player_use_can` and `player_use_rod` still exist (WorldScene shows them)
  and are now the contact frames `player_tool_hoe_down_2`, `player_tool_can_right_2`, `player_tool_rod_right_2`.

## 3. Doors: 4 frames

- `obj_door_open_0..3` (16 x 32): drawn over a tall facade door's two tiles, top-left at the top tile's corner
  (the door tile pair `f_doortop_*` above `f_doorlow_*`). `doorOpenKey(i)`.
- `obj_door_open_low_0..3` (16 x 16): the ground tile only, for the shop (its top tile is the awning).
  `doorOpenKey(i, true)`.
- 0 closed (identical to the baked door, so it can sit on top before the swing), 1 ajar, 2 half, 3 open. Hinge on
  the left; the leaf swings inward; the frame and the step never change.
- Suggested: 0 = 0 (show on the tap), 1 = 60, 2 = 60, 3 = hold until the transition covers it. Reverse to close.

## 4. Crops leaning when walked through

- `crops` texture frames `crop_<id>_<s>_lean_l` and `crop_<id>_<s>_lean_r` for every stage `s >= 2`
  (`CROP_LEAN_FROM_STAGE`), `cropLeanFrame(frame, 'l' | 'r')`. The top half of the plant leans 1 px; the
  bottom half and the base never move.
- Suggested: lean away from the player as they pass (`_l` when the player moves left through it), hold about
  120 ms, back to the plain frame for 80 ms, then the other lean for 80 ms (a small spring), then rest.
  Stagger idle sway phases per tile (hash of tx, ty) if you sway the field in wind; with reduced motion, never
  swap crop frames.

## 5. Water: ripple and splash

- `fx_ripple_0..2` (5 x 3, 9 x 5, 12 x 7): stepped rings in sky and ice white, no ink, no alpha. Centre them on
  the bobber, the cast point or a step in shallow water. Suggested 120 ms each, then remove. Reduced motion: show
  `fx_ripple_1` still, or nothing.
- `fx_splash_0..3` (9 x 4, 11 x 7, 13 x 10, 13 x 8), **redrawn**: 0 bulge, 1 crown, 2 crown with droplets
  flying, 3 droplets falling back and a flat ring. Bottom-centre on the water line. Suggested 70, 70, 90, 90 ms.
  The crown has ink; the loose droplets do not (an outlined 1 px droplet reads as a dark speck).

## 6. Harvest pop: squash and stretch

- `<icon>_pop_0` (14 x 18, stretch) and `<icon>_pop_1` (18 x 14, squash), then the plain `<icon>` (16 x 16), for
  every crop, forage and animal product (`popFrames(icon)`). Same bottom line as the icon: anchor them
  bottom-centre (origin 0.5, 1) at the icon's bottom so nothing jumps.
- Suggested: pop_0 for 60 ms as it leaves the plant, pop_1 for 60 ms at the top of the hop, then the icon. No
  scale tween on top (integer pixels only).

## 7. Idles

- Villagers: `npc_<id>_<dir>_0..3` (required keys now; `NPC_IDLE_FRAMES = 4`). 0 rest, 1 breathe in (the chest
  grows 1 px and the head rises 1 px; the feet stay), 2 blink (from behind it equals 0), 3 the villager's beat:
  Mara nods, Finn lifts his hat a pixel, Orin shifts his weight, Rosa lifts and tips her hat, Clay tilts his head.
  `PreloadScene` builds `npc_<id>_idle_<dir>` from `NPC_IDLE_SEQUENCE` (frame, ms):
  0 1800, 1 500, 0 1500, 2 110, 0 1700, 3 700, 0 700, 1 500 (about 7.5 s). `NpcRenderer` already holds frame 0
  under reduced motion.
- Animals: `animal_<a>` and `animal_<a>_1` as before, plus `animal_<a>_2` (breath: the back rises 1 px) and
  `animal_<a>_3` (head dip), for chicken, cow, sheep and pig (`animalIdleFrames(sprite)`). ObjectsRenderer still
  toggles 0 and 1 only; suggested loop: 0 1200, 2 400, 0 900, 1 600 (graze/peck), 0 800, 3 300.

## Hooks I need from you (or the coordinator)

- Tool use: play `toolAnimFrames(item, facing)` instead of the single pose in `WorldScene.toolPose`, and spawn the
  action fx on frame 2.
- Doors: an overlay sprite at the door when the player enters (WorldScene door warp), using `doorOpenKey`.
- Crops: swap to the lean frames in `FarmRenderer` when the player walks through a tile with a crop of stage 2+.
- Water: `fx.splash` and the bobber can use `fx_splash_*` and `fx_ripple_*`.
- Harvest: `fx.itemPop` can step through `popFrames(icon)` instead of the scale tween.
- Animals: `ObjectsRenderer` can loop `animalIdleFrames`.
