# Art: next steps (handover, round 2, 2026-10-09)

Branch `art/round2` (from `integration/agents-2026-10-08`), last code commit b321e29, `npm run verify` green (478
unit tests, e2e, mobile e2e, perf 2-4 draws and <= 1.12 ms JS per frame). Session report:
`agents/out/art-round2-2026-10-09.md`. Critic notes for this round: `C:/Users/andre/dev/tiny-acre/art-critique/`
`review-3.md` to `review-6.md` (+ its final round). All judging was done from headless screenshots; nobody has
looked at this on a phone.

## Shipped this round

- **Maps pass (R1-10, the owner's main ask).** `scripts/map-art.mjs` writes five art layers (`detail`, `shade`,
  `props`, `roof`, `overhead`) and a hidden `lights` object group into every map; `src/art/mapLayers.ts` draws them
  (one shared tileset texture; overhead tiles fade to 45% around the player). The runtime `decor.ts` is gone.
  - Transitions are **baked in world space**: the generator lists the tiles it needs in `art-src/map-tiles.json`,
    and `art-src/tools/bake.py` renders them: forest crowns (mixed oak, birch and pine) with trunks and a
    walk-behind overhang; shores with 14 px rounded corners, coves and foam; grass creeping onto paths; mine rock
    with faces; dark floor bands; world-space water. After any map change, run **`npm run art:maps`** (it
    generates, renders the new tiles, then generates again). A test fails if a requested tile is missing.
  - Composition per map lives in `COMPOSITION` in `map-art.mjs`:
    - Farm: yard vignettes, chimney and weathervane, window boxes, copses at the fence.
    - Town: the square with its well and bench, lamps, Mara's stock, Orin's forge facade with anvil and coal,
      Rosa's planters, Finn's boat and net rack, sprout signs.
    - Woods: groves, the old oak, the cave mouth, ferns at the grove edges.
    - Mine: bays, beams, the rail, torches, wall crystals.
    - House: wallpaper, bed, furniture, rug, and an ink void around the room.
  - **Gameplay geometry is unchanged.** New collision comes only from props, groves and bays. They sit on open
    ground outside every zone, door, door spawn, plot (+1), plot sign, landmark, mailbox, start/wake and villager
    spot; a test checks this. Water tiles are untouched (coordinator ruling: ponds stay rounded rectangles drawn
    in the visual layers).
- **Roofs (R2-1):** staggered courses, a wine shadow under each course, orange glints, a 3 px sand ridge cap
  outlined in ink and drawn overhead, an eave line and a facade shadow.
- **Clay (R1-7):** a red jacket, a cream cravat, a cowlick and a straw in side view.
- **Seams (R1-8)** fixed on Mara, Finn and Rosa, using new `recolor` and `pixfix` spec options in `build.py`;
  logged in `art-src/flow/edits.md`.
- **Atmosphere (R1-9):**
  - Per-season tilesets replace the season multiply. They are palette swaps by category
    (`art-src/tools/seasons.py`), with drawn winter roofs as snow masses and seasonal clumps under trees (dry
    grass, leaf litter, drifts).
  - Dusk keys moved to rose-lilac.
  - A stepped night glow (`src/fx/NightGlow.ts`) is drawn in the UI scene above the day tint: warm-ramp rings,
    window light as stripes on the ground, a wall-lantern kind, fireflies.
  - Ambient particles (`src/fx/Ambient.ts`).
  - Reduced motion is respected; there are 3 new perf scenarios.
- **FX:** sparkle, dust and splash flipbooks, and **tool-use poses** (hoe, can, rod) for about 260 ms after a tool
  action.
- **Signatures:** the title backdrop is on the palette, with hills, a farmhouse, a row of roses and an embossed wood
  logo with the carved sprout; the town board and the plot signs carry the carved sprout.
- **Walnut is the default skin** (approved by the critic in review 6): flat plates, a plank dock, sand slots, one
  selection style, ink button text, hatched disabled buttons, ink headings and prices, an ink letterbox and a
  walnut toast plate. `?skin=plum` keeps the old UI. Only tokens, colours and drawing helpers changed.
- **New art for the depth branch's keys:** the rare crops (strawberry, blueberry, cranberry, snow pea), their
  items, and the seed exchange landmark.

## Coverage

331 of 332 manifest keys have art (`agents/out/art-manifest.md`); `fx_shadow` stays generated on purpose. New keys
from other branches show up in the manifest after a merge (`node art-src/tools/manifest.mjs`).

## Merge notes (for the coordinator)

- A trial merge of `origin/controls/one-thumb` conflicts only in `src/scenes/WorldScene.ts`, in 3 small hunks: the
  imports, a const block above the class, and the `playActionFx` call. There, art passes `posed` from
  `toolPose()` and controls adds haptics and hold counting; keep both.
- `theme.ts`, `widgets.ts` and `Hud.ts` merged cleanly. The UIScene hook is 4 lines (`NightGlow` at depth 1.5).
- After merging, run `npm run art:maps` only if a branch changed `scripts/generate-maps.mjs`, then commit the
  regenerated maps, the tileset and `art-src/map-tiles.json`.

## Open critic findings (by severity)

Nothing is blocking. The critic's final round may add to this list.

**Minor.** All of these were addressed once in b321e29; the critic has not judged them again yet:

- Mine darkness now follows the outer wall and the bays, with a straight falloff from the torches. Check that it no
  longer reads as a stain and that ore nodes stay readable inside the band.
- Wall lantern on stone: a new `wall` glow kind (orange and earth-dark rings, a solid core). Check the farmhouse
  door at night again.
- Winter roof against the ground: a sky band on the lower roof slope and cast shadows on the snow. Check that the
  house keeps its mass; the roof may read a little striped (lumps plus band), so simplify it if needed.
- Title: the hills, the farmhouse and the embossed logo with the sprout are new; judge them at phone scale.
- Tool-pose head: about 2 px smaller than the player's (the Flow pose sheet's proportions). Fix it when the poses
  are redone.

**Accepted per coordinator rulings:**

- R3-1: ponds stay rounded rectangles.
- R3-2: woods groves only outside the forage zones.
- R3-6: the target marker belongs to the controls agent.

## Next batches (priority order)

1. **The critic's final round:** address its findings first (shots in `agents/out/art-shots/round2/final/`).
2. **Skin the controls agent's new UI after the merge** (tool ring, target-marker states, help card, controls tab)
   through the `C`, `CH` and `select` tokens and `drawSlot`, `drawSelection` and `drawPanel`, with no geometry
   changes. Check the toast plate, the ring and the marker over grass, snow and night.
3. **Redo the tool poses:**
   - A Flow sheet with the player as the reference image, in all 4 directions: hoe, can, rod, scythe, pickaxe.
   - Build it on the native grid with `noscale` and `drop_rows`, like the villagers.
   - The hook is `WorldScene.toolPose()` with `TOOL_POSES`. Then drop the rule that facing up has no pose.
4. **Maps polish:**
   - A few more landmarks per map: a fishing pier in town (only if the coordinator allows a walkable tile change),
     mushroom and stump clusters in the woods glade.
   - Seasonal water: a winter ice edge on shore tiles only.
   - Lilies and reeds cleared in winter, via `seasons.py` categories.
5. **Mine depth:** ore veins in the wall faces (bake them into the `rock` tiles), stalagmites from the unused
   `items7` crop, and crystal glints animated in steps.
6. **Unused generated art** (crops in `art-src/flow/crops/`):
   - `items7a`: stalagmite, hook lantern, crystals, water pump, stone lantern, rose trellis (good for the town and
     the farm yard).
   - `nature2a`: the mushroom ring. Keep it off forage zones, where it would pass for forage. (The daisy,
     buttercup and lavender patches are already used.)
   - `fx2a`: ember, glint and glow.

How to run things:

- `npm run art:maps`: maps plus baked tiles.
- `python art-src/tools/build.py`: everything (about 2 minutes).
- `python art-src/tools/mapview.py <dir> 2`: whole-map renders.
- `node art-src/tools/shots2.mjs <dir> <prefix>`: every view at day, dusk and night, every season, 1x and phone.
  Filter with `VIEWS`, `TIMES`, `SEASONS` and `SIZES`.
- `ONLY=title,farm,inventory,shop,board node art-src/tools/shots.mjs <dir> <prefix>`: UI shots.

Keep raw Flow files in `C:/Users/andre/dev/tiny-acre/flow-raw/`, and log prompts in `art-src/flow/prompts.json`
(then run `prompts_md.py`).

Windows notes: write files from Python with `newline=''` (CRLF crept in once), and shell heredocs collapse
backslashes, so put any script that contains `\n` in a file.

## Flow usage

5 generations this round, 2 images each, 1:1, model Nano Banana 2.1, on the owner's account in the project
"out. 08 - 07:06": `village2`, `nature2`, `fx2`, `crops4`, `items7`. No quota, credit or error message appeared.
The browser pane was signed out at first, so nothing was generated then; the owner signed in again mid-session.
24 prompts are logged in total (`art-src/flow/prompts.md`).

## Questions for the owner

- **Look on a phone:** the maps, the night glow and the walnut UI were judged only from headless screenshots.
- **Ponds:** keep the rectangular water tiles (fishing) with visual rounding, or allow reshaping the water tiles so
  ponds can be truly round? That needs the fishing spots checked again.
- **New collision from art:** props, copses and rock bays add a little collision on open, unreserved ground (never
  in zones, plots or paths). Keep it, or should art never add collision?
- **Flow licensing before any store release:** re-verify Google's terms (see `ASSETS.md`). This is not legal
  advice.
