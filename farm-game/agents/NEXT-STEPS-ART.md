# Art: next steps (handover, 2026-10-08)

Branch `art/atlas`. Read `agents/out/art-2026-10-08.md` (session report) and `agents/briefs/BRIEF-ART.md` first.
Art direction decisions come from the art critic; its notes live outside the repo in
`C:/Users/andre/dev/tiny-acre/art-critique/` (`decisions.md`, `review-1.md`, `round-1/shots/`).

## Done

- **Loader:** packed atlases (`world`, `ui`, `chars`) plus a tileset load behind the existing texture keys, with the
  generated placeholder as fallback (`src/art/atlasLoader.ts`, `artPlan.ts`, `manifest.ts`). Test: `tests/art.test.ts`.
- **Pipeline:** Flow crops become grid-true pixel art on the 32-colour palette in `art-src/tools/` (`extract.py`,
  `pixelart.py`, `build.py`, `authored.py`, `tiles_extra.py`). Rebuild everything with `python art-src/tools/build.py`;
  add `--prune` only at the end (it deletes crops no sprite uses).
- **Art:** item icons, crops, buildings and machines, trees, nodes, animals (2-frame idles), the player, 5 villagers on
  one body style, landmarks, mailbox, depth-branch placeables, terrain tiles, red clay roofs with a sand ridge cap,
  ground tufts, UI glyphs.
- **Palette v2** (approved by the critic), with slot 0 `ink` as the outline.
- **Walnut/parchment UI skin** behind `?skin=walnut`. Plum is still the default.
- **Records:** `ASSETS.md` holds the provenance and terms record; `art-src/flow/prompts.md` and `edits.md` log every
  prompt and every hand change.

## Coverage

296 of 297 manifest keys have art (`agents/out/art-manifest.md`). Still on the generated fallback: `fx_shadow` (a
semi-transparent ellipse, kept on purpose). The depth branch keeps adding keys. They appear in the manifest
automatically after a merge and show placeholders until art is made (rerun `node art-src/tools/manifest.mjs`).

## Critic decisions: state

1. **Palette:** v2 is in use. Optional nudges of up to about 10 per channel are allowed, keeping the ramps; log any
   nudge in DECISIONS.md.
2. **UI skin:** walnut/parchment is APPROVED as the direction. Flip the default in `readSkin()` (`src/ui/theme.ts`)
   only after these round-1 fixes:
   - BLOCKER: no grain behind text. HUD plates must be flat walnut, and the dock flat or regular planks (full-width
     boards 12-16 px, 1 px ink seam with a 1 px wood highlight, at most 2 knots). See `drawPanel` chrome branch and
     `Hud.ts` dock.
   - MAJOR: hotbar slots use the bag's sand recessed slot (`drawSlot` chrome currently uses plum shadow; thin tools
     lose their outline).
   - MAJOR: one selection style everywhere: gold ring, 2 px ink notches, ledge. The bag tab and slot currently show
     wine.
   - MAJOR: enabled button text in ink. Dim text only for disabled buttons, plus a shape cue (hatch or strike).
   - minor: prices and "Gold" in ink with the coin glyph; wine only for unaffordable.
   - minor: letterbox and the energy/water bar row in ink or walnut, not navy.
   - Also: the title screen mixes skins (TitleScene uses `CH`, while its Buttons use the content `C`).
3. **Villagers:** done and accepted (Orin's 24x32 frame, mirrored left, chest-dip idle). Open:
   - MAJOR: recolour Clay to a signature rival colour (rust jacket or wine waistcoat), and give his side view a
     marker (cap, cowlick or a straw).
   - minor: hand-fix the side-view seams from the row trims (Mara's blob behind the skirt and stub legs, Finn's
     ink hip patch, Rosa's hem specks), and log the fixes in `art-src/flow/edits.md`.
4. **Licensing:** keep using Flow. The ASSETS.md record is done. The owner must re-verify Google's terms before any
   store release.

## Critic final round (246fdf6): new findings

Notes: `art-critique/review-2.md` and `final.md`. All round-1 items stay open.

- **R2-1, MAJOR, clay roofs** (`round-2/r2_roof_zoom.png`). They read as 1-row red/orange stripes, the loudest thing on
  screen, and the 1 px sand ridge cap doesn't read. Redo `roof()` in `art-src/tools/authored.py` before roofs spread
  through the map layers:
  - staggered tiles about 4 px wide, in 3 px courses offset by half a tile;
  - a 1 px wine shadow under each course;
  - orange only as a small highlight on each tile;
  - a 2-3 px sand ridge cap with an ink outline;
  - eaves: an ink line plus a 1-2 px shadow on the wall below.
- **R2-2, minor, edge lips** (`round-2/r2_tileset_3x.png`, rows 2-3). Grass-to-path/plot transitions use a dark,
  ink-like lip; use leaf dark or teal shade instead (`creep()` in `tiles_extra.py`). Ink is for objects and
  interactive things only.
- **R2-3, minor:** tree/bush tiles with a grass base square go on grass only (the pond bush again).

Acceptance for the next session:
- walnut becomes the default only after R1-1..R1-4 and R1-6;
- the maps pass is judged on R1-10, R2-1 and R2-2;
- the atmosphere pass is judged on R1-9.

## Next batches, in priority order

1. **Critic round-1 UI fixes, then make walnut the default** (list above). Verify, screenshot farm HUD, bag, shop and
   title at 390x844, and send the critic the hash.
2. **Clay recolour and side-view fixes** (item 3 above). This is a palette remap in `build.py`: add a `recolor` spec
   option mapping palette slots, then hand-edit pixels via a small `pixfix` spec list (x, y, slot) and log it.
3. **Maps pass.** A working draft is in `art-src/drafts/map-art.mjs`, not wired in yet. It computes these layers per
   map from the ground grid:
   - `detail`: grass creeping onto paths and plots, shorelines, carved mine walls with faces, ground variants.
   - `shade`: dithered drop shadows, rose-pink wildflowers (the valley's signature), pebbles, puddles, rubble, the
     house rug.
   - `roof`: red clay roofs, slate for the shop.
   - `props`: tree bases, bushes, lamps, barrels, a well, a laundry line, furniture, crystals and torches; these are
     solid and are added to collision.
   - `overhead`: canopies, lamp tops and roof eaves to walk behind.
   - A `lights` list for the glow pass.

   Its tiles already exist in `public/assets/tilesets/tiles.png` (rows 2+, names in `tiles.json`, built by
   `tiles_extra.py`).

   To wire it in:
   1. Move it to `scripts/map-art.mjs` and fix its `../../` paths back to `../`.
   2. In `generate-maps.mjs`, call `artLayers(name, m, objects)` in `write()`, OR its `solid` set into the collision
      layer, and write the five tile layers plus a `lights` objectgroup. Set the tileset `tilecount`, `columns` and
      `imageheight` from its result.
   3. In `WorldScene`, create `detail` (depth 0.02), `shade` (0.03), `roof` (0.1), `props` (0.06) and `overhead`
      (about 5000, tinted per tile with the season tint) when the map has them and `atlases.json` says the tileset
      exists.
   4. Remove the runtime `addRoofs` and ground decor in `src/art/decor.ts` (and the `decor_roof_*` and
      `decor_grass_*` atlas frames and manifest entries) once the layers are in.
   5. Run `npm test` (`tests/maps.test.ts` checks connectivity, spawns, villager spots and landmarks), regenerate,
      look at every map at 1x and phone scale, and save `agents/out/art-shots/maps-*` before/after pairs.

   Placements the draft skips today: mine beams at (8,27)/(11,27) and the house lamp at (3,2); move them.

   Critic expectations for the maps pass:
   - Object tiles need a transparent base: no grass square in the woods pond. Use the tree/bush bases only on grass.
   - The pond needs a shoreline (dark rim and 1 px foam) plus lily and reed props.
   - The woods need overhead canopy, trunk clusters and a walked path.
   - The mine needs wall top-faces, floor cracks and rubble, and lantern pockets.
   - The farmhouse needs a ridge cap, an eaves shadow row, 2 windows, a chimney (still to draw) and the clay roof.
4. **Atmosphere pass:**
   - Ambient particles by season, time and map: petals, fireflies, leaves, snow, dust motes, water sparkles,
     butterflies. Sprites are already cropped in `art-src/flow/crops/ambient1a`; re-extract if pruned:
     `python art-src/tools/extract.py ../../flow-raw/ambient1-a.jpg ambient1a fx_butterfly_w0,... --min 60 --gap 10`.
     Use one or two emitters on the ui atlas, capped. Respect `settings.reduceMotion`.
   - Night glow with additive stepped, dithered light shapes at the draft's `lights` positions, plus a halo around
     the player. Fade it with `src/ui/daylight.ts`, and unit-test the intensity curve.
   - Add a night + particles scenario to `scripts/perf.mjs`.
   - Critic item 9: per-season tilesets as palette swaps of the authored terrain (`tiles_summer/fall/winter`).
     Drop the SEASON_TINT multiply where a tileset exists, and soften the dusk keys toward rose/plum.
5. **FX and the tool-use pose:**
   - Sparkle, dust and splash sprites (ambient1 and animals1 crops) to replace or augment the `fx_px` bursts in
     `src/fx/Effects.ts`.
   - Tool-use pose: Flow sheet `npcs4-a/b` row 3 has the player raising a hoe, pouring a can and casting a rod
     (facing down). These need wider frames and a hook in `actionFx`/`WorldScene`.
6. **Signature touches:**
   - Rose-pink wildflower on the title screen and the town board.
   - Hand-lettered wooden signs with a carved sprout emblem.
   - A sand ridge cap on every roof (done for the runtime roofs).

## Flow usage

19 generations by the art agent this session (2 images each, 1:1), plus the owner's test image. No quota, credit or
error message ever appeared (Flow said generations use 0 credits). Concurrent submissions work: type the next prompt
and click send while others run, then match results by the `Expires` timestamp order. All prompts:
`art-src/flow/prompts.md`.

Images already generated but not used yet (none pending in Flow):
- `npcs2` (superseded).
- `npcs4` row 3 (tool poses).
- `interior1` and `ambient1` (only the rug, window, flowerbox and decor bits are used in the draft tiles).
- `items5`/`items6`/`land1` decor (used by the draft tiles).

Raw files are in `C:/Users/andre/dev/tiny-acre/flow-raw/`.

## Questions for the owner

- When the critic's fixes land, is it fine to flip the default UI to walnut/parchment without a separate sign-off?
- Commercial use of the Flow output: please re-verify Google's terms before a store release (record in ASSETS.md).
- Should per-season tilesets replace the season tint completely (the critic recommends it), or keep a light tint on
  top?
