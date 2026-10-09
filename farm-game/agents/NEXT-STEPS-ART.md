# Art: next steps (handover, round 3, 2026-10-09)

Branch `art/round3` (from `integration/round2-2026-10-09`). `npm run verify` is green after every commit: 684 unit
tests, e2e (with a new ambient-anchor check), mobile e2e, controls e2e, and perf at 2-5 draws and at most 1.88 ms JS
per frame (the busiest farm scene; machine noise varies it run to run) (budget: 12 draws, 3.5 ms). Before and after shots are in `agents/out/art-shots/round3/`
(git-ignored). Everything was judged from **headless screenshots only**; nobody has looked at this on a phone.

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
2. **The 21 placeholder keys now have art.** There were no Flow downloads (see below), so everything is drawn by
   hand in `art-src/tools/drawn.py`: character grids over the palette names, with explicit ink outlines. The keys:
   - tulip bulbs, the tulip, and the tulip growth (stage 0 is the shared seed mound);
   - parsnip soup, baked potato, fish stew, berry tart, kale salad, pumpkin pie;
   - the four legendary fish (Glimmer Trout, Sun Carp, Old Whiskers, Ice Pike);
   - the scarecrow item and the placed 16x24 object;
   - the Founder's Statue.
     The manifest now has 361 entries, 360 with art; `fx_shadow` stays generated on purpose.
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

## Flow usage

- One prompt (`items8`: tulips, dishes, legends, scarecrow) was submitted in the owner's Flow project
  "out. 08 - 07:06". No quota or error message appeared. It is logged as entry 25 in `art-src/flow/prompts.md`.
- **Nothing was downloaded.** My safety rules require the owner's own go-ahead in chat before downloading files,
  and a coordinator instruction doesn't count. So I stopped generating and drew the keys by hand.
- The two outputs are still in the Flow project if the owner wants Flow versions. To use them: download to
  `flow-raw/items8-{a,b}.jpg`, run `extract.py`, and add `src` specs to `sprites.json`. The hand-drawn versions
  are overridden only if their keys are dropped from `drawn.build()`.

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
- **Optional, for the depth agent:** emitting `placedChanged` on every statue level-up in `systems/projects.ts`
  would let the renderer drop the per-frame level check.

## Open items (by priority)

1. **The critic's eye on round 3:** the hand-drawn dishes and fish, the statue's growth, the new poses, the coach
   marks (mock only: the onboarding UI isn't merged here), and the winter ice rim.
2. **Poses:**
   - add a hoe pose for left and right (`toolPose` still shows the hoe only facing down);
   - add back-view poses, then drop the rule that facing up has no pose;
   - add scythe and pickaxe poses.
     Draw them in `drawn.poses()` on `player_walk_*` frames.
3. **Statue:** it is 16 px wide, so even level 5 is modest in the square. If the coordinator allows, a 2-tile-wide
   level 5 needs a footprint change (`projects.json` landmark plus collision).
4. **Earlier batches still open:** mine depth (ore veins baked into rock faces, crystal glints in steps), woods
   glade clusters (keep the mushroom ring off forage zones, or skip it, since mushrooms are forage), and the
   unused `fx2a` ember, glint and glow.
5. **Winter:** paths keep their summer sand (the `path` category isn't snowed). Consider a light snow remap on
   `creep:path` and the path base.

How to run things: `npm run art:maps` (maps plus baked tiles), `python art-src/tools/build.py` (everything, about 5
minutes on this machine) or `--sprites`, `python art-src/tools/mapview.py <dir> 2 [tileset.png]` (whole maps),
`node art-src/tools/shots2.mjs` and `shots.mjs` (views), `node agents/probes/art-round3.mjs` (this round's staged
shots), `node agents/probes/ambient-anchor.mjs` (the anchor proof).

## Questions for the owner

- **Flow downloads:** may I download Flow outputs in future rounds? If so, say so in chat yourself. Until then,
  art is drawn by hand.
- **Look on a phone:** everything since round 2 has been judged only from headless screenshots.
- **Ponds, art-added collision, Flow licensing:** these are unchanged from round 2 (see `ASSETS.md`); this is
  not legal advice.
