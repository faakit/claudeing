# Frames wanted by the feel work (round 4)

> **Superseded (coordinator, round 4):** the art agent drew its own set and names (`art/round4` `a5c262f`,
> `agents/out/art-feel-frames.md` there): `player_walk_<dir>_0..7`, `player_tool_<tool>_<dir>_0..3` (contact
> on 2), `obj_door_open_0..3`, `crop_<id>_<s>_lean_l|r`, `<icon>_pop_0|1`. The feel branch wires those names,
> with fallbacks, and was checked on a local merge of both branches. The text below is the original request.

From the feel agent (branch `feel/smooth`) to the art agent (branch `art/round4`). These are the keys the code
will look for. Anything missing falls back to what exists today, so frames can land one group at a time. All
sizes are logical pixels at 1x, on the existing palette, in the existing atlases (no new atlas files needed).

The code checks for the frames at boot (`textures.get(atlas).has(frame)`), so no code change is needed when they
land: rebuild the atlas and the game picks them up. Please keep the names exactly as written.

## 1. Walk cycle: 8 frames (chars atlas)

| key | frames | size | anchor |
|---|---|---|---|
| `player_walk_{down,up,left,right}_{0..7}` | 8 per direction | 16x32 | feet at the bottom row, centred (same as `player_idle_*`) |

- Frame 0 and frame 4 are the **contact** frames (a foot plants); 2 and 6 are the passing frames (body 1 px
  higher). Footstep sounds fire on 0 and 4.
- **Timing is by distance, not by clock:** one frame per 4 px walked (walking speed is 64 px/s, so 16 fps; a
  full cycle is 32 px = two tiles, one step per tile). Half-speed walking runs the cycle at half rate, so the
  feet never slide.
- Today's 4-frame cycle (`_0.._3`) keeps working as the fallback: one frame per 8 px, contacts on 1 and 3.
- `left` may be the mirror of `right` if that is how you draw it; if `player_walk_left_7` is absent but
  `player_walk_right_7` exists, the code mirrors right.

## 2. Idle breathing: 2 frames (chars atlas)

| key | frames | size |
|---|---|---|
| `player_idle_{down,up,left,right}_{0,1}` | 2 per direction | 16x32 |

- Frame 1 = frame 0 with the head and shoulders 1 px lower (exhale). No other change.
- Timing: frame 0 for 1100 ms, frame 1 for 700 ms, looping, only after 1.5 s standing still. Calm mode (reduced
  motion) holds frame 0.
- Fallback until it lands: the code derives frame 1 at boot by moving the top 17 rows of frame 0 down 1 px (a
  placeholder; yours will be better).

## 3. Tool swings with anticipation (chars atlas)

| key | frames | size | anchor |
|---|---|---|---|
| `player_swing_{tool}_{down,left,right}_{0,1,2}` | 3 per tool and direction | 32x32 | feet bottom-centre, like `player_use_*` |

- `tool` is one of `hoe`, `can`, `scythe`, `pick`, `rod`.
- Frame 0 **anticipation** (tool drawn back / raised), frame 1 **impact** (tool meets the tile in front: the dust,
  splash, sound and haptic fire on this frame), frame 2 **follow-through** (recoil, settling).
- Timing: 0 for 50 ms, 1 for 100 ms, 2 for 110 ms, then idle (260 ms in all; a swing roots the farmer 200 ms, so
  the follow-through never delays the next press).
- `up` (back view) is optional; `left` may mirror `right` (the code flips `right` when `left` is absent).
- Fallback: today's single `player_use_hoe` / `_can` / `_rod` pose as the impact frame, no anticipation.

## 4. Doors that open (world atlas)

| key | frames | size | anchor |
|---|---|---|---|
| `obj_door_farmhouse_{0,1,2}` | 3 | 16x16 (or 16x32 if the frame above the door changes) | bottom-centre of the door tile (14,7 on the farm) |
| `obj_door_house_{0,1,2}` | 3 | 16x16 | bottom-centre of the house's door tile (5,8 in the house) |

- 0 = closed (must match the map's door tile exactly, so swapping the sprite in is invisible), 1 = ajar, 2 = open
  (dark doorway).
- Timing: on stepping onto the door, 0 -> 1 -> 2 at 50 ms each, then the screen wipe starts. On arrival through a
  door, the door you came through shows open (2) and closes 2 -> 1 -> 0 at 70 ms each as the wipe clears.
- Fallback: a code-drawn dark doorway (a rectangle that grows by whole pixels).

## Not needed

- Squash and stretch on harvest pops and pick-ups, crops bending, screen nudges and hit-stop are done in code on
  whole pixels. No frames needed.

Questions or a different naming you prefer: put them in your handover; the feel agent will follow your names.
