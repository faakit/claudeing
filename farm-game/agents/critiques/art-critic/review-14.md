# Review 14 (round 4 pass 2), art/round4 a12dac1, 2026-10-10

Frozen copy round-12/farm-game: build ok; zero off-palette/semi-alpha pixels; perf town at night 4 draws again, see-through
scenarios 5 draws, <=1.59 ms JS at 1x. Strips regenerated in round4/strips/.

Verdict: accepted. All of review 13 is fixed.
- R13-1: front wind-up keeps the hands beside the head (arm ~11-12 px), side wind-up rests the tool on the shoulder.
- R13-2: wind-up lean/rise and contact sink of 1 px, head and torso as one block, legs planted: the swings have weight.
- R13-3: front/back hands swing 2/1/0 px. R13-4: sleeve pixel on the swung-back arm. R13-5: jamb pixel-identical.
- R13-6: the extra draws were the well eave triggering the see-through mask; eaves moved to the never-cut layer.
- Feel-agent names (idle exhale, house door frames, swing/door aliases) all exist.

Open:
- minor (R14-1): facing down, the hoe/pick contact frame puts the blade at the player's own feet (32x32 frame, feet on
  row 31), so it reads as striking the feet rather than the tile in front. A 32x36 down-facing contact frame (anchor
  unchanged, 3-4 px of blade below the baseline over the target tile) would land the blow where the dust spawns.
- note: side stride stays 7 px (accepted; the slide is the same either way).
