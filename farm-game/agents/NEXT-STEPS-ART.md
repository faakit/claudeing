# Art: next steps (handover, M7 "Towing and the first homecoming", 2026-10-12)

Branch `art/m7`, from the deployed `integration/dry-year-2` (8f92664). Nothing else was merged in: the M7 builder's
`valley/m7` (worktree `depth`, agent a9473ed2c0031ec21) merges this branch on its side and reruns `art:maps`. Art
critic: add45bc37ac10f5da. Every item was judged in its scenario at the iPhone 13 and SE sizes in headless Chromium.
Nobody has looked at it on a real phone.

## Shipped this round

The critic accepted all five items. Three checks wait for the builder's merge (see "Next steps").

1. **Towing art** (e3f58ea; R30-1 and R30-2 fixed in 233ae24 and adb599f). Accepted.
   - `art-src/tools/towart.py`, all drawn in code:
     - `tow_log` (16x8) and `tow_log_long` (32x10: a branch stub on its back, so the long log differs by
       silhouette), each with a `_v` (north-south) and a `_tilt` (snag) frame.
     - The logs have a 2 px night-navy waterline and no translucent water over them.
     - `_tilt` raises the west end 2 px in two 1 px steps and shows the earth-dark underside. `_v_tilt` kicks the south
       end 2 px west. The controller flips the frame so that end is at the snag.
     - `tow_rope_dot`: a 2x2 stamp (wood over ink) laid every 1 px. The critic ruled a two-tone 2 px stroke isn't a
       1 px line.
     - `tow_slip` (16x32, the water north of the bank, as in town) and `tow_slip_s` (the water south, as in the lab).
       Full-width planks on a 5 px pitch step darker toward the river, with a 2 px foam line and a sill beam. No posts
       (R30-1).
     - `tow_rock` is the town's R27 `rockspur` tile, so "rock = snag" carries over.
     - Action icons: `tow_icon_hook`, `tow_icon_home` (a log's sawn end on a ramp, R30-2) and `tow_icon_tug`.
   - `p_timberstack`: a tileset prop of landed timber. The builder places it at town (21,32), in the river and marls
     stages, next to the slip.
   - `TOW_SPRITES` in `src/art/manifest.ts`.
   - The feel critic's condition 3 is kept: the tilt, a 2x2 ice-white foam crest, the ripple, and the three verb
     icons.
2. **The Marls' house in stages, as one kit** (233ae24). Accepted.
   - `art-src/tools/houses.py` draws `obj_house_marls_0..4`, each 96x48 over the house's wall rows plus the roof row.
     Origin (0,1) is at world (224,112).
     - 0: scaffolding begun. 1: scaffolding up (deck, brace, ladder, two stacks). 2: boards off, the door and dark
       windows in.
     - 3: built, windows dark. 4 (optional): home by day, lamp panes.
   - The built facade is composed from the house's final map (`town.tmj` tile layers and the tileset), so it matches
     the tiles exactly.
   - `scaffold()`, `ladder()` and the stack take any width. Each house is one `HOUSES` entry: map, rect, pole x's,
     deck and ledger rows, window and door cells, stacks, ladder. Tobin's rooms (town SW wall 2,15) and Wren's cottage
     (woods) are one entry each when the builder fixes their positions.
   - `HOUSE_SPRITES` in the manifest is exact-size, because `artPlan.frameFits` only lets non-exact frames up to 64 px
     stand in.
   - The builder shows stages 0-3 only in the town's new `river` stage (house boarded, chimney cold). The `marls` stage
     is today's facade with its night lights, plus stage 4 if it wants a daytime warm window.
3. **Senna Marl** (3af9578; R32-1 in 93729e9). Accepted.
   - `art-src/tools/senna.py` draws her down, right and up frame 0 over Mara's, so the sisters share a face and the red
     hair.
   - Her own silhouette:
     - a dusk-blue headscarf knotted at the nape, with its tails standing out (no bun);
     - a green dress with rolled sleeves;
     - a long flour-dusted apron;
     - a flour sack on her hip.
   - `motion.villager_idles` makes her breathe, blink and beat (a head tip toward the knot). Her eye boxes are Mara's.
   - She passed the critic's flat-silhouette lineup in every view.
   - The manifest lists her through `RETURNING_NPCS` (unioned with `npcs.json` in a Set), so the builder's `npcs.json`
     entry merges with no duplicates.
4. **The turning mill wheel and R27-4** (1be02ae). Accepted.
   - `obj_millwheel_0..3`: `towntiles.millwheel(P, turn)` at 0, 11.25, 22.5 and 33.75 degrees. Frame 0 equals the
     static tile.
   - `map-art.mjs` gained keep-clear rects: a crown that would reach into one shrinks and settles toward its trunk,
     else is left out. The town keeps `[21, 30, 2, 26/16]` clear, so the bottom border's crown no longer hides the
     wheel.
5. **Leftovers** (93729e9; R29-1 in c5d2014). Accepted, except R29-1, which the critic hasn't seen.
   - R24-1: the `valleyMoment` event takes a `delay`. The creek's first-morning plate waits 1.2 s
     (`CREEK_BANNER_DELAY` in WorldScene).
   - R27-2: the aground Heron's high flank shows 2 px of hull side in shadow, and mud is banked against the low flank.
   - R27-3: `weir_span_<dry|wet>_<0..2>_<t|b>` tiles (`sites.weir_span`) carry the weir's wall across Wendhead's gorge
     (19-21, rows 10-11), from the site's abutment to the far bank.
     - Placement: map-art wendhead `weirSpan`; dry in the `dry` and `spring` stages, wet (the river sheeting over it)
       in `gorge` and `restored`.
     - They are props-layer decor. The gorge is solid in every stage, so collision is unchanged.
   - R32-1: Senna's hair under the scarf's point in red with a rose highlight.
   - R29-1 (the optional nit): plant right frames 1-3 have a knee fold and the seat dropped back over the heels.

## Atlases now

| file | size | change |
|---|---|---|
| world | 512x512 | was 512x256 (towing, houses, the wheel) |
| ui | 512x256 | unchanged size (+3 tow icons) |
| chars | 512x512 | unchanged size (+16 Senna frames) |
| chars2 | 512x512 | unchanged |
| tiles | 512x1184 | unchanged size (+p_timberstack, +12 weir span tiles, re-baked crowns) |

Each atlas is still one texture. Perf was within budget in the critic's runs.

## Next steps (open, by priority)

1. **The critic's three checks, once `valley/m7` has merged this branch** (the builder reruns `art:maps` there):
   - the town's real slip next to `p_timberstack`, in `tow-first-log` and `tow-snag` (or `tow-east-lane`);
   - the house stages in place: `tow-house-marls` (5 of 6, stage 2) and `marls-arrive`, plus `marls-home` for the
     lit window;
   - the wheel's playback: about 180 ms a frame, static on frame 0 in Calm, created only in the `marls` stage, no
     extra draws.
2. **R30-3 (builder's wiring):** in `tow-spike` the rock drew over the vertical snagged log and hid its tilt. The
   builder says its TowController draws logs at depth 1.2 over the rock's 1 (and over the town's shade and props
   layers). Check the strip after the merge and send it to the builder if the rock still covers the log.
3. **R29-1:** the critic hasn't reviewed the knee fold yet (c5d2014).
4. **Houses for M8-M10:** add `HOUSES` entries for Tobin's rooms (above the forge) and Wren's cottage when the builder
   gives their positions and keys (`obj_house_tobin_N`, `obj_house_wren_N`, in valley.json `houses`). The Holt wing is
   off-map.
5. **Older open items** (from the last handover):
   - Wendhead's look: the hillside, ferns and gorge banks.
   - Per-tile dry detail (the only reason to bake the dry palette, D25-1).
   - R23-1: the title sky's 1 px dithers.
   - Perf on a quiet machine.

## Rulings standing

- D20-1: channels hide flora and decals.
- D21-1: the crisp rim stays.
- D21-2: the glint is static.
- D23-1: the letter's fold stays inside 8 px.
- D24-1: the river plate keeps its width.
- D25-1: the dry palette is not baked.
- This round:
  - the tilt's 1 px stair reads as tilted;
  - a 2x2 two-tone rope stamp is not a 1 px line;
  - the long log may be 32x10;
  - house stages 3 and 4 may differ only in the panes;
  - scaffold standards may rise into the roof row.

## Agreements with the M7 builder (keys and positions)

- Towing keys are as listed in `TOW_SPRITES`.
- The slip is drawn as an object at the northern of its two tiles, origin (0,0): town water (19,31), world (304,496).
  It uses `tow_slip_s` when the water is south and the texture exists. The slip stand is (18,32): the tree at (20,32)
  stays, because the M6 fixture pins `town.tmj`'s ground.
- `obj_house_marls_0..3` (4 optional) at world (224,112), origin (0,1). Decor only.
- Senna: npc id `senna`, `npc_senna_<dir>_<0..3>`.
- `obj_millwheel_0..3`: top-left at (21,30), depth 0.07, animated in scene code.
- The builder makes all of M7's town edits in map-art: the row-32 props, the Heron at [18,28], and `variants.river`.

## Merge notes (for the coordinator)

- **Map rebuild:** every `.tmj` changed in its gids (new tiles, re-baked crowns).
  - In `scripts/map-art.mjs`, keep both sides: the builder's town block, plus my town `clear` line, the keep-clear
    crown pass in `artLayers`, wendhead's `weirSpan` and `variants`, and the weirSpan loop.
  - Then run `npm run art:maps` and commit the maps and tilesets. The sprite atlases don't need a rebuild.
- **Shared files touched:**
  - `src/scenes/WorldScene.ts`: the creek banner delay.
  - `src/ui/Hud.ts`: the delayed `valleyMoment`.
  - `src/systems/events.ts`: `valleyMoment.delay`.
  - `src/art/manifest.ts`: `TOW_SPRITES`, `HOUSE_SPRITES`, `RETURNING_NPCS`, the wheel.
  - `scripts/map-art.mjs`: `clear` and the crown pass, `weirSpan`.
  - `art-src/tools/motion.py`: Senna's idles.
  - `art-src/tools/towntiles.py`: the wheel's turn and the Heron.
  - `art-src/tools/codeacts.py`: R29-1.
- I never edited `src/dev/towSpike.ts`. My judging patch for it lives outside the repo, in
  `C:/Users/andre/dev/tiny-acre/art-scratch/m7/judge.patch`.
- **Text baked into images:** none.

## Verified and not verified

- **Verified:**
  - `verify:fast` was green before every commit.
  - The full `npm run verify` at c5d2014: every phase OK (lint, typecheck, test, build, all six e2e suites,
    e2e:scenarios, bundle, lab-map, perf 1x/4x/6x), 514 s. Perf within budget (at most 12 draws, 3.5 ms JS a frame at
    1x; pacing within budget at 4x and 6x).
  - Scenario shots at i13 and SE for every item, in `C:/Users/andre/dev/tiny-acre/art-scratch/m7/`.
  - Until the builder's code lands, the in-game judging of the houses, Senna and the wheel used debug images placed at
    the agreed origins and depths, and the towing used `judge.patch` in the lab spike.
- **Not verified:**
  - Everything wired by the builder (see Next steps 1-2).
  - A real phone.

## Flow usage this round

None. Every new asset is drawn in code, reusing existing art where it can: Mara's face for Senna, the town map for the
house facades, the rockspur for the snag rock. Flow came out as gravel at this size in earlier rounds.
