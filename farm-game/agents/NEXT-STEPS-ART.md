# Art: next steps (handover, round 4, 2026-10-10)

Branch `art/round4` (from `integration/round3-2026-10-10`). `npm run verify` is green after every commit: 787 unit
tests, e2e, mobile e2e, controls e2e, onboarding e2e, and perf at 2-5 draws and at most 1.84 ms of script per
frame across runs (budget: 12 draws, 3.5 ms). Atlases: world 512x256, ui 512x128, chars 512x512 (the limit is
1024). Everything was judged from **headless renders only**; nobody has watched these animations on a phone.
Reviews: `C:/Users/andre/dev/tiny-acre/art-critique/review-13.md` (6 findings, all fixed) and `review-14.md`
(accepted; its one minor, R14-1, is fixed), then `review-15.md`: round 4 closed, nothing open.

The frame list for the feel agent, with timings and hooks, is `agents/out/art-feel-frames.md` (start there).

## Shipped this round

1. **Animation frames, all built in code on the idle sprites** (so heads never drift between frames):
   - `art-src/tools/anim.py`: the player's 8-frame walk per direction (contact, down, passing, up, x2). The head
     is pixel-identical to the idle frame (1 px lower on the down frames only), a foot is always on the bottom
     row, the hands swing 2 px in the front and back views, and left is an exact mirror of right (the idle too).
   - `art-src/tools/toolanim.py`: tool use, 32 x 32, 4 frames (wind-up, swing with a smear, contact = frame 2,
     follow-through) for the hoe, pickaxe, can, scythe and rod, facing down and sideways (hoe and pickaxe also
     facing up). Arms and tools are separate parts with their own ink rings; raised arms are about 11 px; the
     body leans 1 px back on the wind-up and sinks 1 px on contact. Facing down, the hoe and pickaxe frames are
     32 x 36 so the blade bites 3 px into the tile in front (origin y = 32 / height; see `art-feel-frames.md`).
     The round-3 `player_use_*` keys are now the contact frames (kept 32 x 32), so the game already shows them.
   - `art-src/tools/motion.py`: door opening (the tall facade door and the house's door tile), crop leans for every
     grown stage, a ripple flipbook and a redrawn splash crown, squash and stretch harvest pops, 4-frame villager
     idles (breath, blink, one beat each: Mara nods, Finn lifts his hat, Orin shifts his weight, Rosa lifts and tips
     her hat, Clay tilts his head), two more animal idle frames, and the player's exhale frame.
   - The feel agent's names from `feel/smooth` `frames-wanted.md` all exist; the swing and farmhouse-door names are
     **atlas aliases** (a second name on the same rect, written by `build.py` from `motion.aliases()`).
   - Wired here (Boot/Preload, art files only): the 8-frame walk (`PLAYER_WALK_FRAMES`) and the villager idle loop
     (`NPC_IDLE_SEQUENCE`, ms per frame). Everything else is helpers in `src/art/manifest.ts` for the feel agent.
2. **The town well** is a 24 x 32 three-tile prop, hand-drawn (`drawn.WELL`: gabled roof, winch and crank, rope and
   bucket, a coursed stone ring). The base tile is solid exactly as before; the base row's side tiles are a
   walkable overhang; the roof's centre tile is overhead and its 4 px side eaves are on the never-cut `lamps` layer
   (so standing beside the well does not switch the see-through mask on). New `m_*` prop kind in
   `scripts/map-art.mjs`. The farm keeps its small well: seasonal clumps and a crown leave no room beside it.
3. **Seasons fix (found this round):** the round-3 baked tree crowns (`crown:*` tiles) had no season category, so
   oaks and birches stayed summer green in winter and fall. `seasons.category` now seasons them (pines stay
   evergreen). Shots: `agents/out/art-shots/round4/crowns_winter_before.png`, `crowns_winter_fall_after.png`.
4. **Review tooling:** `python art-src/tools/strips.py` writes frame strips (6x, grass and parchment, baseline and
   crown guides), onion skins and 1x/4x preview GIFs to `agents/out/art-shots/round4/strips/`.
   `tests/animation-frames.test.ts` checks head identity, planted feet, villager feet, every round-4 manifest
   frame packed at its size, and zero off-palette or semi-transparent pixels in every atlas.

## Flow usage

None this round: every frame was drawn in code on existing sprites, and the well was hand-drawn (the Flow
`village3` well lost its winch and bucket at 24 px).

## Merge notes (for the coordinator)

- Shared files touched, a few lines each:
  - `src/scenes/PreloadScene.ts`: the walk anim uses 8 frames at `WALK_FPS * 8 / 4` fps; the villager idle uses
    `NPC_IDLE_SEQUENCE` with per-frame durations. The feel agent may own the timing; keep its numbers if they
    conflict.
  - `src/art/placeholders.ts`: the stand-in player sheet has 8 walk frames, the villagers 4 idle frames.
  - `scripts/map-art.mjs`: the `m_*` three-wide prop kind, the town well.
- Maps and tileset changed (new well tiles). After merging a branch that touches `scripts/generate-maps.mjs`, run
  `npm run art:maps` and commit the maps, the tilesets and `art-src/map-tiles.json`.
- `fx_splash_*` changed size (manifest `FX_SPRITES` updated); nothing in `src/` used them before.
- Python edits on Windows: write files with `newline='\n'`, or git warns about CRLF.

## Open items (by priority)

1. **Wiring (feel agent / coordinator):** tool sequences in `WorldScene.toolPose`, door overlays at the warp, crop
   leans in `FarmRenderer`, ripple and splash in `fx`, pops in `fx.itemPop`, animal loops in `ObjectsRenderer`.
   The hooks are listed at the end of `art-feel-frames.md`.
2. **Side walk stride:** the critic offered 9 px instead of 7 at contact, to cut the slide; that needs the side leg
   grids in `anim.SIDE_FRAMES` redrawn.
3. **Facing up:** only the hoe and pickaxe have back-view tool frames; the can, scythe and rod keep the walk sprite.
4. **Statue:** 16 px wide, so even level 5 is modest; a 2-tile level needs a footprint change.
5. **Earlier batches:** mine depth (ore veins, crystal glints), woods glade clusters, the unused `fx2a` ember and
   glow, and a light snow remap on winter paths.
6. **Real footprints** (2x2 coop, 3x2 barn, 2x2 landmarks) remain the owner's and depth agent's decision.

How to run things: `python art-src/tools/build.py` (everything, about 5 minutes) or `--sprites` (about 2),
`npm run art:maps`, `python art-src/tools/strips.py`, `python art-src/tools/mapview.py <dir> 1`,
`node art-src/tools/shots2.mjs` (dev server on 5175).

## Questions for the owner

- **Look on a phone:** the animations were judged only from headless renders and GIFs.
- **Footprints:** may the animal houses and town landmarks get real 2x2 or 3x2 footprints?
