# Art: next steps (handover, round 3, 2026-10-10)

Branch `art/round3` (from `integration/round2-2026-10-09`). `npm run verify` is green after every commit: 687 unit
tests, e2e (with a new ambient-anchor check), mobile e2e, controls e2e, and perf at 2-5 draws and at most 1.46-2.03 ms
of script per frame across runs (budget: 12 draws, 3.5 ms), including two see-through-hole scenarios. The art
critic accepted the round in reviews 9-12 (`C:/Users/andre/dev/tiny-acre/art-critique/review-8.md` to
`review-12.md`). Before and after shots are in `agents/out/art-shots/round3/` (git-ignored). Everything was judged
from **headless screenshots only**; nobody has looked at this on a phone.

## Shipped this round

1. **Butterflies and particles no longer follow the screen (owner's bug).** `src/fx/Ambient.ts`:
   - The emitter sits still at the world origin. Only its emit zone (`EmitArea`) follows the camera's view, so new
     petals, leaves, snow and dust appear in view while live ones keep their world position. (Since Phaser 3.60,
     live particles move with their emitter, so the old per-frame `setPosition` dragged them along.)
   - Butterflies (`Flock`, pure and seeded) fly in world space around flower patches. Each one roams about 20 px
     around its patch with steering and jitter, plus a 1 px flutter. When the player gets more than 230 px from its
     patch, it picks a patch near the player and enters from just outside the view. With no patch nearby, it uses
     open ground near the player.
   - The patches come from a new hidden `blooms` object group that `scripts/map-art.mjs` writes into every map:
     one point per 4x4 block with 2 or more flower tiles (ground flowers, bloom and patch flora, flower beds).
     The farm has 13, the town 19, the woods 13; the mine and the house have none.
   - **How it is proven:**
     - `tests/ambient-anchor.test.ts`: the emitter stays at (0,0) and is never repositioned while the zone tracks
       a scrolling view. A butterfly flies the identical path under a still camera and under a panning one. It
       re-homes off-screen when the player is far away. Reduced motion clears everything.
     - A new e2e check in `scripts/e2e.mjs` (step 6b) freezes the motes in a real browser, scrolls the camera 64 px
       and measures a mote shift of 0 px; the butterflies move less than 16 px, all of it their own flight.
     - `agents/probes/ambient-anchor.mjs` (with `SEASON=winter`) does the same with before and after shots.
   - Day and night, the seasons and reduced motion go through the same `ambientPlan`. Perf for "woods spring day:
     petals + butterflies" stays at 2 draws and 0.76-1.18 ms across the runs and throttles.
2. **The 21 placeholder keys now have art.** Each key got whichever version reads better at 1x and phone scale
   (bag comparison: `round3/bag-hand-vs-flow.png`).
   - **From the Flow sheet `items8`** (`sprites.json`, crops in `art-src/flow/crops/items8{a,b}/`):
     - variant b: tulip bulbs, tulip, parsnip soup (wooden bowl), baked potato, berry tart, kale salad;
     - variant a: fish stew (with a spoon; b's red broth read as tomato soup), Old Whiskers (a real catfish with
       whiskers), Ice Pike (frosty spines).
   - **Hand-drawn** in `art-src/tools/drawn.py` (character grids over the palette names, explicit ink outlines):
     - pumpkin pie: the Flow pies read as orange blobs at 16 px;
     - Glimmer Trout and Sun Carp: the Flow fish read as plain, ordinary fish;
     - the scarecrow item and 16x24 object: the hat, face and arms are clearer;
     - the tulip growth stages (stage 0 is the shared seed mound) and the Founder's Statue: no Flow source.
   - Unused from the sheet: hay bale, stump, mooring post.
   - The manifest has 361 entries, 360 with art; `fx_shadow` stays generated on purpose.
3. **The statue grows with its level.** There are five frames: `obj_landmark_statue` (a bust on a low plinth), then
   `obj_landmark_statue_2` to `_5` (the full figure, a plaque, a wreath and two tiers, then gold trim, the gold
   sprout and rose flowers at its foot).
   - `landmarkLevelKey()` in `src/art/manifest.ts` picks the frame from `project.statue.level`, capped at
     `repeat.perkLevels`, which is 5.
   - `ObjectsRenderer.syncLandmarkLevels()` swaps the frame when funding raises the level. After the first level,
     funding fires no map event, so this is a cheap per-frame check called from `WorldScene.update`.
   - Shots: `round3/after/r3_statue_l1.png` to `l5.png`.
4. **The doubled "New Game" label (R6-2): the real cause.**
   - `TitleScene` passes chrome tokens (`CH`) to `Button`, so the label was parchment (`CH.cream`) on the sand
     button face.
   - `Button` drops the drop shadow only for the content tokens (`C.cream` etc. are ink in walnut), so the light
     label got an ink 1 px shadow. Light letters with a dark offset on sand read as doubled.
   - Fix: the title buttons use the content tokens, like every in-game button. The labels are ink, Continue is leaf
     dark, and "Erase save?" is wine. `widgets.ts` is untouched.
   - Comparison: `round3/title-button-before-after.png`.
5. **Tool poses redone on the player's own frames (R5-5).** `player_use_hoe` (facing down, hoe overhead) and
   `player_use_can` and `player_use_rod` (facing right; left mirrors) are now `player_idle_down_0` or
   `player_idle_right_0` with edited arms and a drawn tool. The head is pixel-identical to the walking sprite.
   Shots: `round3/r3_poses.png`. The old Flow pose specs are gone from `sprites.json`.
6. **Coach-mark sprites for the onboarding agent (ui atlas, listed in `COACH_SPRITES`):**
   - `ui_coach_hand` (13x17): a pointing hand, finger up; flip Y to point down. The cuff is the player's blue.
   - `ui_coach_ring` (16x16): a gold ring with ink rims inside and out.
   - `ui_coach_ring_wide` (22x22): a thinner, broken lamp and gold ring, for a stepped pulse between the two frames
     (no soft glow).
   - `ui_coach_bubble` (12x12): a nine-slice source with 4 px corners, parchment with a plum-shadow bottom.
   - `ui_coach_bubble_tail` (7x4): sits under the bubble and overlaps its bottom outline row.
   - All are optional manifest entries, so nothing breaks if the names change at merge. Mock:
     `round3/coach-marks-mock.png`.
7. **Polish:**
   - **Winter water:** lilies and reeds clear in winter (new `aquatic` category in `seasons.py`), and the shore
     tiles freeze. Water becomes sky-blue ice on the `shore:` baked tiles only, so open water stays water. See
     `round3/town-pond-winter-after.png`.
   - **New decor props** from the Flow sheet `items7`:
     - a rose trellis by the farmhouse and by Rosa's cottage;
     - a stone lantern across the road from the town square;
     - two stalagmites against the mine walls.
       I left out the pump and the hook lantern, because they could suggest an interaction that doesn't exist.
   - **Town square:** the bench and one street lamp had been skipped since round 2, because the statue's reserved
     tiles covered them. They now stand one tile west, and the lamp is lit again (15 lights).
   - **A bench by the farm pond.**
   - **`MAP_OPEN=<map> node scripts/generate-maps.mjs`** prints where hand-placed props may go. Most open grass is
     reserved (weed, forage and ore zones, farm plots plus a margin, villager spots), so it is off-limits.
   - **`python art-src/tools/build.py --sprites`** rebuilds only the atlases, in about 1 minute instead of 5. The
     tileset and `atlases.json` are left alone.

8. **Proportions pass (owner's ask; the art critic's review 8, in its fix order, on one-tile footprints as the
   coordinator ruled).** Ruler: the player is 28 px tall. Shots are in
   `agents/out/art-shots/round3/proportions/`: `cmp_*.png` are the critic's lineups before and after,
   `before/` and `after/` hold whole-map renders, and `after/night_under_crowns.png` checks the fade.
   - **Trees.** Every map tree is now a crown in world pixels, baked per tile and layer by
     `art-src/tools/crowns.py` (recipe `crown:`) and placed by `scripts/map-art.mjs`. The old one-tile canopy
     balls are retired.
     - **The wood's edge** is a row of big trees, 32-40 px crowns with trunks every other cell. The mass behind is
       a darker back row. The side edges get a crown on every cell. The floor stops halfway down the south-edge
       cells, so the trunks stand on grass in their own shade.
     - **Lone trees** are oak about 30x44, birch 20x40 and pine 22x44 where two rows of free cells fit above the
       trunk, else medium (about 22x32). Nothing is left shorter than the player (review 9): where a forage zone
       leaves no room, a bush or a root stump stands on the tree tile instead. Over plots and other reserved
       cells the crown is drawn under the player; it never spreads over roofs or buildings.
     - **The old oak** is a crown about 60 px across, with a gnarled trunk on its one solid tile.
     - **Layering:** crowns of trees south of a tile go on the overhead layer (you walk behind them), the rest
       under the player. Over guarded cells the crown is drawn under the player and goods instead, so there is no
       hard cut and nothing is hidden. Test: `tests/proportions.test.ts`.
     - **Grown fruit trees** are 32x40 with outlined 4 px fruit (cherry blossom in rose). Young trees show three
       stages: seedling 8x10, sapling 12x20, young tree 20x28. That needed a sprite pick by age in
       `mechanics/fruitTree.ts` `sprite()`, which is art only. The ready star sits above the crown.
     - **See-through hole (review 9, replacing the 45% fade):** while a crown, an eave or a tall, wide placed
       object stands in front of the player or their target, it is cut away with an inverted geometry mask
       (`src/fx/SeeThrough.ts`). The cut is fully clear inside about 11 px of the player's body and 10 px of the
       target tile, with a 2 px checker rim. Nothing turns translucent, and the player is never tinted. The mask
       is applied only while something covers the player: `MapArt.follow` (only when an overhead tile lies under the hole itself, `holeTiles`) and `ObjectsRenderer.seeThrough`. Lamp, post and sign tops are on their own
       `lamps` overhead layer, and placed sprites under 20 px wide are left alone: they hide nothing.
   - **Facades.** Building blocks of 4 or more rows keep their two bottom rows as wall (32 px) under a shorter
     roof. Doors are 14x26 with a stone step, split over the two rows. The shop keeps its striped awning, now
     above head height. Windows, window boxes and the wall lantern are at head height. Same rectangles, same door
     tiles; window lights moved up with them.
   - **Animal houses, silo and animals** are rebuilt at native resolution from their Flow sources:
     - coop 23x24, shed 24x24, sty 21x19; the barn is 32x28 from the new Flow sheet `village3` (review 10's R9-4);
     - silo 16x40, its body grown on the native grid with the new `stretch` spec option;
     - cow 19x14, sheep 18x14, pig 18x12.
   - **Lamps:** the garden lamp is 10x36, and the town and farm lamps are three-tile props about 8x36 with the
     head above the player's head. Their lights moved up.
   - **Small things:** sprinkler 10x10, quality sprinkler 12x12, jar 12x14, flower pot 10x12.
   - **Landmarks** are 32x40 Flow art on their one tile, overhanging up and to the sides only: board canopy and
     seed exchange (`village3` a), fish ladder, hot spring (32x42) and market gate (`town3` a, native size), and,
     after review 11 (R11-1: house shapes with tiny doors read as dollhouses), the library as a lending-library
     book cabinet with a bench (`town4` a) and the fair hall as an open bandstand (`town4` b). Shots:
     `proportions/after/landmarks_*.png`, `landmarks_east_r11_zoom.png`.
   - **Ground items:** forage and the animal-house product bubbles use new 12 px `world_<item>` sprites drawn at
     1x. The twinkle star is at 1x too.
   - **The rest:**
     - scarecrow 16x30 (the placeable and the farm's decor scarecrow);
     - loom and furnace 16x22;
     - placeable fence 16x14, bench 16x14;
     - rowboat 12x32;
     - mature corn 12x26.
   - **Not done:**
     - the well at 20x30: it is wider than its tile, so the prop needs a 2-column form;
     - the HUD bolt and drop icons at 1x (`Hud.ts` is the controls agent's file);
     - (done later: the item pop now steps from half to full size on whole pixels; the baked map fences were
       already 14 px tall at their posts, so they needed no change)

## Flow usage

- Four prompts this round in the owner's Flow project "out. 08 - 07:06" (1:1, Nano Banana 2.1, x2): `items8`,
  `village3`, `town3` and `town4` (entries 25-28 in `art-src/flow/prompts.md`, with the variants used per key). No quota or
  error message appeared. Check the aspect before submitting: it had flipped to 16:9 once.
- **Download approval:** the owner approved autonomous downloads of the art agent's own Flow outputs ("yes, it
  should be autonomous", said to the coordinator on 2026-10-09). The approval covers only our own generations
  (signed flow-content URLs, fetched into `C:/Users/andre/dev/tiny-acre/flow-raw/`, outside the repo), not other
  downloads.
  - This session's rules accept a download approval only when the owner states it in the art agent's own chat.
    So the coordinator fetched `items8-a.jpg` and `items8-b.jpg` itself, and the art agent processed the files on
    disk.
  - In a future session, either the owner repeats the approval in the art chat, or the coordinator fetches the
    named files into `flow-raw/`.

## Merge notes (for the coordinator)

- Shared files I touched, each in a few lines:
  - `src/scenes/WorldScene.ts`: the `parseBlooms` import, the Ambient constructor argument, and a
    `syncLandmarkLevels` call next to `ambient.update`.
  - `src/game/ObjectsRenderer.ts`: `syncLandmarks` and the new `syncLandmarkLevels`.
  - `src/scenes/TitleScene.ts`: the button label tokens.
  - `scripts/e2e.mjs`: the new step 6b, in its own browser context before step 7.
- The maps changed: there is a new `blooms` group, new props, a moved bench and lamp, and the tile gids shifted
  because the tileset grew. After merging any branch that changes `scripts/generate-maps.mjs`, run
  `npm run art:maps` and commit the maps, the tilesets and `art-src/map-tiles.json`.
- **Coach-mark names:** the onboarding branch was told `ui_coach_hand` and `ui_coach_ring`. Mine add
  `ui_coach_ring_wide`, `ui_coach_bubble` and `ui_coach_bubble_tail`. Rename them in `COACH_SPRITES` and in
  `drawn.build()` if theirs differ.
- **depth/round3 keys, drawn here:** the statue as `obj_landmark_statue_1` to `_6` (16x32 canvases; `_1` is the
  bust, `_6` the gilded figure on the level 5 pedestal; `obj_landmark_statue` stays as an alias of `_1`) and the
  house trophies `obj_trophy_board` (carved sprout plaque with a rosette), `obj_trophy_festival` (gold cup) and
  `obj_trophy_legends` (golden fish plaque), 16x16, all in `drawn.py` and as optional manifest entries. At merge,
  take depth's statue naming and point `landmarkLevelKey`/`syncLandmarks` at `_1`..`_6` (or keep the alias).
- **Optional, for the depth agent:** emitting `placedChanged` on every statue level-up in `systems/projects.ts`
  would let the renderer drop the per-frame level check.
- **Proportions pass, shared files:**
  - `src/mechanics/fruitTree.ts` `sprite()`: a sapling stage by age, art only;
  - `ObjectsRenderer`: the forage and bubble sprites at 1x, the ready star above tall sprites, and `seeThrough`;
  - `WorldScene`: creates the `SeeThrough` hole and passes it, with the facing tile, to `MapArt.follow` and
    `ObjectsRenderer.seeThrough`;
  - maps: a new `lamps` tile layer after `overhead` (`ART_LAYERS` in `generate-maps.mjs`, `MAP_ART_LAYERS`).
- **Recommendation for the depth agent (coordinator ruling: out of scope this round):** real footprints, so the
  art can reach the critic's ideal sizes. These change placement rules and saves:
  - coop 2x2 (32x32);
  - barn 3x2 (48x40);
  - shed 2x2;
  - the town-project landmarks 2x2 (32 wide by 32-40 tall).

## Open items (by priority)

1. **The proportions pass, what is left** (review 10 accepted it; the barn and landmarks now come from Flow,
   `village3`/`town3`):
   - nit: the well at 20x30 needs a three-column map prop (a 20 px well overhangs both neighbours); its Flow
     source is in `flow-raw/village3-*.jpg`;
   - real 2x2/3x2 footprints remain the owner's and depth agent's decision.
   - Perf now has two see-through-hole scenarios (behind a lone tree, behind a grown fruit tree; review 10's ask).
2. **The critic's eye on the rest of round 3:** the hand-drawn dishes and fish, the statue's growth, the new poses, the coach
   marks (mock only: the onboarding UI isn't merged here), and the winter ice rim.
3. **Poses:**
   - add a hoe pose for left and right (`toolPose` still shows the hoe only facing down);
   - add back-view poses, then drop the rule that facing up has no pose;
   - add scythe and pickaxe poses.
     Draw them in `drawn.poses()` on `player_walk_*` frames.
4. **Statue:** it is 16 px wide, so even level 5 is modest in the square. If the coordinator allows, a 2-tile-wide
   level 5 needs a footprint change (`projects.json` landmark plus collision).
5. **Earlier batches still open:** mine depth (ore veins baked into rock faces, crystal glints in steps), woods
   glade clusters (keep the mushroom ring off forage zones, or skip it, since mushrooms are forage), and the
   unused `fx2a` ember, glint and glow.
6. **Winter:** paths keep their summer sand (the `path` category isn't snowed). Consider a light snow remap on
   `creep:path` and the path base.

How to run things: `npm run art:maps` (maps plus baked tiles), `python art-src/tools/build.py` (everything, about 5
minutes on this machine) or `--sprites`, `python art-src/tools/mapview.py <dir> 2 [tileset.png]` (whole maps),
`node art-src/tools/shots2.mjs` and `shots.mjs` (views), `node agents/probes/art-round3.mjs` (this round's staged
shots), `node agents/probes/ambient-anchor.mjs` (the anchor proof), `node agents/probes/proportions-night.mjs`
(crowns at night, the fade, fruit trees).

## Questions for the owner

- **Footprints:** may the animal houses and town landmarks get real 2x2 or 3x2 footprints (a depth-agent change
  to placement and saves)? That is the only way to reach the critic's ideal sizes for them.
- **Look on a phone:** everything since round 2 has been judged only from headless screenshots.
- **Ponds, art-added collision, Flow licensing:** these are unchanged from round 2 (see `ASSETS.md`); this is
  not legal advice.
