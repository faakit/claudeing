# Art: next steps (handover, The Dry Year, 2026-10-11)

Branch `art/dry-year` (from `integration/dry-year-core` db29f2a). The owner asked every lane to wrap up after item 1.
`npm run verify:fast` was green before each commit. Perf stays at 2-5 draws. Everything was judged from headless
renders at the iPhone 13 and SE sizes; nobody has looked at it on a real phone.

## Shipped this round

1. **The chars atlas split** (128ef5d). The 68 player action frames (`player_act_*`) moved to a second chars atlas,
   `chars2` (512x256). `chars` is now 512x512, with room for new character frames. Frames load by name across
   atlases, so no texture key changed.
   - `build.py` has a `chars2` group, and `drawn.py` routes the action frames to it.
   - `manifest.ts` has `ATLAS_FILES.chars2`, and the action entries are in group `chars2`.
   - `tests/animation-frames.test.ts` reads both chars atlases.
   - New character art (villagers, the missing action facings) goes into `chars2`.
2. **Channel tiles** (0dd9a35): item 1, the valley critic's R5-3.
   - **Drawn in code:** `art-src/tools/channeltiles.py`. As with the creek, an autotile comes out better in code
     than from Flow.
   - **Tiles:**
     - `chan:<wet|dry>:<mask>`: the ditch, autotiled by its four neighbours;
     - `culvert:<mask>`: stone headwalls on a path cell;
     - `chanmouth:<n|e|s|w>`: the cut through the creek bank.

     The mask is N1 E2 S4 W8. A bit is set where that neighbour is a channel or creek water.

   - **Shape:** the cut is 10 px wide, with a 3 px shadowed north face, a 2 px west face, and a 2 px lit lip on the
     south and east sides.
     - Dry bed: earth dark with clods and pebbles.
     - Wet bed: water, a 2 px dusk-blue shade and a 3x2 sky glint.
     - No 1 px features and no alpha.
   - **Placement:** `authored.build` appends the tiles at the END of the tileset, after the baked map tiles, so no
     map gid moved.
     - The game looks them up by name in `src/art/channelTiles.ts` (`channelMask`, `channelTileName`,
       `culvertTileName`, `mouthTileName`, `tileGid`, `isGroundDecal`, `CHANNEL_WATER_BAND`).
     - The tileset grew to 512x1136. The `.tmj` files changed only in their tileset header (imageheight and
       tilecount, from `npm run gen:maps`).
   - **WorldScene** (a shared file):
     - `paintChannel` now autotiles each cell and repaints its painted neighbours.
     - It hides ground decals (flowers, tufts) on a channel cell and restores them when the channel is filled in.
       This follows the critic's ruling: the hiding is worked out at draw time and nothing is saved.
     - It draws culverts and creek mouths in the shade layer.
     - The new public `channelGid(tx, ty, look)` is for the feel lane's water fx.
     - A few new lines in `create` index the gids beyond the `.tmj` tile count. Phaser's `putTileAt` needs that
       for tiles past the map's own count.
   - **Seasons:** wet channels and mouths use the `shore` category (in winter: ice water and sand lips). Dry channels
     use `ground`. The dry palette doesn't touch them, because they contain no grass ramp.
   - **Scenario:** `channels-serpentine` has corners, a T, a cross, a culvert under the 2-wide path, the creek
     mouth, and a dry tail past flow 24.
   - **Tests:** `tests/channel-tiles.test.ts`, plus an e2e check in the `channels` block of
     `scripts/e2e-scenarios.mjs`.
3. **Flow sources for items 2 and 3**, generated and downloaded to `flow-raw/` but not built yet. They are recorded
   as entries 42-45 in `art-src/flow/prompts.json`:
   - `site_spring-a/b`: the Old Spring in four stages. Both are good; b sits on a hillside.
   - `warm_pool-a/b`: the Warm Pool, dry and full. In a, both versions are clean.
   - `icons_ilse-a/b`: the seed tin, the journal and the spade. b has six small, clean icons.
   - `letter_paper-a/b`: parchment with a cherry blossom, a fold and a tea stain.

   **Reference images can now be uploaded:**
   - The prompt box accepts a dropped file. Build a `File` in the page with `javascript_tool`, then dispatch
     `dragenter`, `dragover` and `drop` on the prompt's contenteditable.
   - Base64 pasted into the tool call got corrupted at 16 KB. Send it in chunks of about 1.5 KB, each with a CRC32
     check (see `C:/Users/andre/dev/tiny-acre/art-scratch/refs/`), then upscale it in a canvas before the drop.
   - The upload `tiny-acre-farm-reference.png` is in the Flow project "out. 08 - 07:06". Attach it with the +
     picker; the attachment clears after each submit.

## Merge notes (for the coordinator)

- **Merge order and map rebuild:** merge `art/dry-year` after any branch that changes `art-src/map-tiles.json` (the
  M6 builder). Then run `npm run art:maps` and commit the maps, the tilesets and `map-tiles.json`. The channel tiles
  stay last whatever the maps add, because the game reads them by name.
- **WorldScene conflict with `feel/dry-year`:** both lanes touched the channel code.
  - Keep this branch's `paintChannel`, `drawChannelCell` and `channelGid`.
  - Point the feel lane's `ChannelFx` `src` callback at `channelGid(tx, ty, look)`, and its foam band at
    `CHANNEL_WATER_BAND`. The feel lane noted this in NEXT-STEPS-FEEL.md.
- **Other shared files:** `scripts/e2e-scenarios.mjs` (the serpentine check), `art-src/tools/seasons.py` (two
  categories) and `tests/animation-frames.test.ts`.
- **Text baked into images (for i18n):** none. No shipped image contains text.
  - Rosa's letter paper is blank by design, and the game draws its text.
  - Once the paper ships, `TitleScene.drawLetter` must draw the letter in ink instead of cream, which is unreadable
    on parchment.

## Next steps (the rest of the Dry Year list, by priority)

1. **The critic's follow-ups on channels**, if any arrive after this handover. Options already weighed:
   - a grassy rim: tried as 2 px leaf-dark tufts, removed because they read as weeds over the field's dirt;
   - wider culvert walls on the 2-wide path;
   - a whole-frame glint swap: the tiles are static today, like the map's water.
2. **The Old Spring site in four stages**, `obj_site_spring_0..3`.
   - 32x32: a 2x2 rockfall at the pool's mouth. Build it from `site_spring-b` with the pixelize pipeline (crop,
     `sprites.json`, `build.py --sprites`).
   - Judge it in `spring-site-ask`, `spring-site-funded`, `spring-site-work` and `spring-opened`.
   - The Warm Pool landmark (`obj_landmark_bathhouse`) comes from `warm_pool-a`.
3. **Rosa's letter paper** (`ui_letter_paper`; scenario `title-first-launch`).
   - Build it from `letter_paper-a` as a 9-slice, like `ui/sheetSkin.ts`. The card is 184 px wide and its height
     varies with the text, and `setDisplaySize` would stretch the pixels.
   - Switch the letter text to ink in `TitleScene` (a few lines in the onboarding lane's file).
   - The seed tin, journal and spade icons come from `icons_ilse-b`.
4. **Bake the dry palette** in `seasons.py` from the table in `art/dryPalette.ts`. Keep it only if it looks at least
   as good as the runtime remap: `valley-farm-dry` must stay straw-coloured, never orange.
5. **Wendhead's look.** Today it is a fenced meadow with a pool, generated into `wendhead.tmj`.
   - It needs the hillside, the spring under the rockfall, ferns, and the dry gorge for M6.
   - This lane makes the tiles. The map owner places them, in `function wendhead(v)` in `generate-maps.mjs`.
6. **M6 visuals**, with the M6 builder (`valley/m6`):
   - town `dry`: D1 cracked mud and the boarded north-east house;
   - town `river`: reeds, rocks and the mill wheel;
   - the Heron afloat;
   - Wendhead restored.
7. **The missing action facings:** the harvest back view and the plant side view, into `chars2`.

## Flow usage this round

Four prompts in "out. 08 - 07:06" (Nano Banana 2.1, x2 each). The first three use the uploaded farm reference; the
letter uses none. One reference upload. No quota message.

## Verified and not verified

- **Verified:**
  - `verify:fast` was green at 128ef5d and at 0dd9a35. The full `verify` result is in the summary to the
    coordinator.
  - Headless shots of `channels-row`, `channels-flow-cap` and `channels-serpentine` at the iPhone 13 and SE sizes.
- **Not verified:**
  - a real phone and the native builds;
  - the channels' winter, summer and fall looks, which were never shot in-game. They come from `seasons.py`
    automatically.
