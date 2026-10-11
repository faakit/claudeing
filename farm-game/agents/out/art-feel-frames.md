# Animation frames for the feel agent (art round 4)

Branch `art/round4`. Every key below is packed in the existing atlases (`chars`, `world`, `ui`; all at or under
1024 px). New keys are **optional** manifest entries unless noted, so nothing breaks if a frame is missing. Helpers
live in `src/art/manifest.ts`. Frames are built in code: `art-src/tools/anim.py` (walk), `toolanim.py` (tool
use) and `motion.py` (everything else); `python art-src/tools/strips.py` writes review strips and onion skins to
`agents/out/art-shots/round4/strips/`.

Timings below are suggestions in ms; the wiring and the final timing are yours. Everything was judged from
headless renders only.

## 0. Your names from `frames-wanted.md` (feel/smooth): all present

Your spec arrived after pass 1; every key it lists now exists, mostly as **atlas aliases** (a second frame name
on the same rect in the atlas JSON: no extra pixels, `textures.get(atlas).has(name)` is true, and each is also a
single-image texture key):

| your key | is | notes |
|---|---|---|
| `player_walk_{dir}_{0..7}` | real frames | contacts on 0 and 4, passing on 2 and 6 (see 1 for the bob) |
| `player_idle_{dir}_1` | real frames | exhale: one torso row goes, the head and shoulders sink 1 px, feet fixed |
| `player_swing_{tool}_{down,left,right}_{0,1,2}` | aliases of `player_tool_{tool}_{dir}_{0,2,3}` | 0 anticipation, 1 impact (my contact frame), 2 follow-through; hoe and pick also have `up` |
| `obj_door_farmhouse_{0,1,2}` | aliases of `obj_door_open_{0,1,3}` | 16 x 32 over the farmhouse's two door tiles (14,6 and 14,7): bottom-centre on the door tile (14,7) |
| `obj_door_house_{0,1,2}` | real frames | 16 x 16, the house's `door` tile (5,8): 0 is the tile itself, pixel for pixel |

- Walk bob: your note says the passing frames are 1 px higher. Mine keep contact, passing and up at the same
  height and drop the body 1 px on the down frames (1 and 5), as the art critic asked ("1 px head bob on the
  down frames"). Relative to the down frames the passing frames are 1 px higher, so it reads the same; tell me if
  you need a different shape.
- Your 3-frame swing skips my smear frame (`player_tool_*_1`). If you want it, play
  `toolAnimFrames(item, dir)` (4 frames: 50, 40, 100, 110 ms fits your 260-300 ms).
- Squash and stretch, crop bending: you do them in code on whole pixels. The authored frames (sections 4 and 6)
  stay available if the critic prefers them; they cost one atlas shelf.

## 1. Player walk: 8 frames per direction (required keys)

- Frames: `player` texture, `player_walk_<dir>_0..7`, dir in down, up, right, left (left mirrors right).
  `PLAYER_WALK_FRAMES = 8`, `playerWalkFrames(dir)` returns all 8.
- Order: 0 contact, 1 down, 2 passing, 3 up, 4 contact (other foot), 5 down, 6 passing, 7 up.
- Head: pixel-identical to `player_idle_<dir>_0` in every frame, 0 px or 1 px lower (1 px only on the down
  frames 1 and 5). A foot is on the bottom row in every frame (tested).
- Stride: side view, the feet are 7 px apart at contact (about 3.5 px each side of the hips); front and back, the
  lifted foot rises 2 px on the passing frame and 1 px on the up frame.
- **Cadence (the art critic's decision, review 13):** 16 fps for the 8-frame cycle at base speed (64 px/s),
  scaled with the actual speed and clamped to 10-20 fps; accept the residual slide. (Your "one frame per 4 px"
  is the same thing at base speed.)
- Speed match: your plan (one frame per 4 px walked, so 16 fps at 64 px/s, 32 px per cycle) is what Preload's
  default also gives (`WALK_FPS * 8 / 4 = 16` fps). A cycle moves the body 32 px while a planted foot is drawn
  still for about 2 frames (8 px of travel), so some slide remains at 1x; truly planted feet would need about
  37 fps, which reads as a scurry. 16 fps, all frames equal (62 ms), is my suggestion too.
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
- The body moves with the swing (review 13): on the wind-up (frame 0) head and torso lean 1 px back (side) or
  rise 1 px (front and back views); on the contact (frame 2) they sink 1 px; legs stay planted. Raised arms are
  at most about 11 px; the tool handle carries the height.
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

## Draw calls: a note for your effects

Town at night measured 7 draws in pass 1 (4 before). Cause: the perf scenario stands the player at (11,12), next
to the new well (9,12); the well's 4 px roof eave on tile (10,11) sat on the `overhead` layer, so the see-through
hole (`MapArt.follow`, `holeTiles`) found an overhead tile inside its circles and switched the geometry mask on,
which costs about 3 draws. Fixed in pass 2: the side eaves are on the never-cut `lamps` layer. In general, any
overhead tile within about 13 px of the player's body or the target tile turns the mask on: effects that pile
up near trees and roofs pay that cost on top.

## Hooks I need from you (or the coordinator)

- Tool use: play `toolAnimFrames(item, facing)` instead of the single pose in `WorldScene.toolPose`, and spawn the
  action fx on frame 2.
- Doors: an overlay sprite at the door when the player enters (WorldScene door warp), using `doorOpenKey`.
- Crops: swap to the lean frames in `FarmRenderer` when the player walks through a tile with a crop of stage 2+.
- Water: `fx.splash` and the bobber can use `fx_splash_*` and `fx_ripple_*`.
- Harvest: `fx.itemPop` can step through `popFrames(icon)` instead of the scale tween.
- Animals: `ObjectsRenderer` can loop `animalIdleFrames`.
