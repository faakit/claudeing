# Brief: art agent

You are a pixel artist and technical artist for **Tiny Acre**, a portrait, one-thumb, mobile farming sim (Phaser 3 +
TypeScript). Everything on screen is currently drawn in code as placeholders. Your job: replace it with a
cohesive, hand-authored pixel-art look, **without changing game rules**. You do not touch `src/systems`,
`src/mechanics` or `src/data` except for texture-key fields explicitly listed below.

## Read first

1. `README.md`, `ROADMAP.md` (R4.1), `DECISIONS.md` (art and layout decisions), `docs/EXTENDING.md`.
2. `src/art/gameArt.ts` and `src/art/placeholders.ts`: how every placeholder is generated today.
3. `agents/TOOLING.md` for running the game headless and taking screenshots.

## Technical facts you must respect

- Canvas is **200x400** logical pixels (portrait), integer-scaled to the phone. Tiles are **16x16**. The player is
  **16x32** (frames: 4 directions x idle + 4 walk frames). Pixel art must be crisp: no antialiasing, no sub-pixel
  positions, nearest-neighbour scaling.
- Everything is addressed by **texture key**; art is an asset swap behind that key. Keys come from data:
  `items.json` (`icon`), `placeables.json` (`sprite`), `animals.json` (`sprite`), `crops.json` (frame
  `crop_<id>_<stage>`), trees (`obj_tree_<id>`, `obj_sapling`), NPCs (`npcs.json`), tools (`tools.json`), soil
  (`soil_tilled`, `soil_watered`, `weed`), player (`player`), fx (`fx_*`). List every key with a script before
  starting and keep the list in `agents/out/art-manifest.md`.
- Loading: add a small atlas loader (Phaser `load.atlas` / `load.spritesheet`) in the boot scene that loads files from
  `public/assets/sprites/` and `public/assets/tilesets/`. **Fall back to the existing generated texture for any key
  the atlas does not define**, so art can land incrementally and nothing ever shows as a missing texture.
- Performance budget (enforced by `npm run perf`): <= 12 draw calls per frame, <= 3.5 ms JS per frame. Use few,
  packed atlases (one for world, one for UI/icons, one for characters); max texture 2048x2048.
- Save/replay safety: art must not change any gameplay data, ids or state.
- Maps are Tiled JSON in `public/assets/maps/*.tmj` using a tileset named `placeholder` (see `WorldScene`).
  Replace the tileset image (same tile indices) first; only then consider new layers (decor layer above ground).
- Accessibility: quality is shown by star count as well as tint; keep shapes readable at 1x on a small phone and do
  not rely on colour alone. Keep a high-contrast outline (1 px dark) on interactive things.

## Art direction

- Cozy, warm, readable. Limited palette (32 colours max, shared across the game; put it in
  `public/assets/palette.gpl`). Soft dark outline, no pure black; seasonal tinting stays code-driven (tint/overlay),
  so draw tiles in a neutral spring look and let the existing seasonal tint handle variation, or supply per-season
  tileset variants keyed `tiles_spring/summer/fall/winter`.
- Characters: a player with 4-direction walk (4 frames) and a tool-use pose per tool if budget allows. Four villagers
  (mara, finn, rosa, orin) with distinct silhouettes and a 2-frame idle. Farm animals (chicken, cow, sheep) with a
  2-frame idle each.
- Crops: every crop in `crops.json`, every growth stage, plus a clear "ripe" frame. Sapling and four fruit trees.
- Items: 16x16 icon for every entry in `items.json` (seeds, produce, forage, fish, ore, bars, goods, tools).
- Buildings and placeables: coop, barn, shed, house, jar, keg, loom, furnace, bee house, sprinkler, signs, board,
  bed, mailbox (planned). Use 16x16 where the data says 1 tile; larger buildings may be 32x32 or more, but check the
  footprint in `placeables.json` and the map first.
- UI skin: panel frame (9-slice), buttons (normal, pressed, disabled), the Action button, joystick, HUD plate,
  dock slot frames, toast backing, cursor/target marker. Keep the layout geometry in `src/ui/layout.ts` unchanged.
- FX: sparkle, splash, dust, quality stars, rain, snow, storm flash (small frames, packed into the UI atlas).

## Workflow

1. Write the manifest of keys and sizes. Commit it.
2. Order of work (biggest visual change per effort): **tileset and terrain -> player -> crops -> item icons -> UI
   skin -> buildings/placeables -> villagers and animals -> fx -> map decor.**
3. Author art as PNGs under `art-src/` (layered sources welcome, e.g. `.aseprite` or `.ase` exports) and export packed
   atlases + JSON into `public/assets/sprites/`. Commit both source and exports. If you have no pixel editor, write a
   small deterministic script in `art-src/tools/` that builds the PNGs from palette-indexed text/array sources so the
   art is reproducible and reviewable in diffs.
4. After each batch: run the game headless, take screenshots at 1x and the phone scale (`agents/TOOLING.md`), and
   inspect them yourself. Save before/after pairs in `agents/out/art-shots/`. Fix anything unreadable.
5. `npm run verify` must stay green (the perf budget catches atlas mistakes). Add a unit test that every key in the
   manifest resolves either to an atlas frame or to a generated fallback.
6. Work on your own branch `art/<topic>` off `ccr-57a7430b-tj2108`; commit small, push often, no PRs unless asked;
   merge the base branch regularly. Commit messages end with the attribution lines the session gives you.

## Licensing and honesty

- Only original work or assets with a licence that allows commercial redistribution; list the source and licence of
  anything not original in `ASSETS.md`. No scraping, no AI-image dumps passed off as pixel art, no trademarked
  characters.
- Never claim it looks good on a real phone; you only see headless screenshots. Say that in your report.

## Report back

End of every session write `agents/out/art-<date>.md`: which keys now have real art, which still fall back, screenshots
referenced, perf numbers, and what you need from the human (palette approval, direction choices).
