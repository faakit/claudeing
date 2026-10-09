# Review 5 (art round 2, pass 3: review-4 fixes, FX + pose, signatures), commit cd5bd9b, 2026-10-09

Frozen copy round-5/farm-game: build ok, shots round-5/shots (no console errors), perf 2-4 draws, <=1.22 ms JS at 1x.
Agent shots: round2/pass3/. Evidence: round-5/r5_door_glow.png, r5_mine_patches.png, r5_sheet0-1.png.

Verdict: the world now has a consistent warm night, a real winter and a signature title; two mine artefacts and the lantern
tint are what's left in the world art.

Fixed: R4-1 lime glow (warm rings, no clipping, window pools), R4-2 halo, R4-3 checker field, R4-4 winter roofs,
R4-5 winter ground + flora, R4-6 leaf litter, R4-7 summer cue, R4-8 evergreen window boxes.

1. major - mine: boulders inside the dark band sit on lighter tile-square patches (tile-edge artefact); dark band carries a
   regular row-of-dashes texture that reads as wallpaper; its organic outline reads as a stain/fog lake, not depth.
2. minor - wall lantern outer rings (red/wine) turn blue-grey stone pink-magenta and leave a soft horizontal band across the
   facade; core is a white checker diamond.
3. minor - winter: roof snow and ground snow share one value, so buildings lose mass (p3_farm_house_winter_day).
4. minor - title: perfectly symmetric twin triangle hills read as clip-art; logo is the UI font scaled up, no carved-sprout
   identity; New Game button still plum (walnut pass).
5. minor - tool pose head ~2 px smaller than the player (agent's note); fix when the pose sheet is redone.
