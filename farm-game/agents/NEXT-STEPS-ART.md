# Art: next steps (handover, The Dry Year round 2, 2026-10-12)

Branch `art/dry-year-2` (from `integration/dry-year-2` 7222bb3, with `origin/integration/dry-year-2` 022d0e7 merged
in at the end; the merge had no conflicts and touched no map or art file). Art critic: add45bc37ac10f5da (reviews
22-27 in `C:/Users/andre/dev/tiny-acre/art-critique/`). Every item was judged in its scenario at the iPhone 13 and SE
sizes in headless Chromium. Nobody has looked at it on a real phone.

## Shipped this round

The critic accepted items 1, 2, 3, 5, 6 and 7. Item 4 was closed by ruling D25-1 (no bake).

1. **The Old Spring site and the Warm Pool** (c76ed7b, R22-1 fix in 7477736). Accepted in review 22.
   - `obj_site_spring_0..3` (32x32, a 2x2 footprint, base on the bottom row) are drawn in code in
     `art-src/tools/sites.py`, not from Flow. The `site_spring` sheets pixelized to about 36 native px, a heap of
     1-2 px gravel.
   - The same stones run through all four stages:
     - 0: the full heap, as tall as the farmer;
     - 1: the crown and front stones off, one gap and some glints;
     - 2: the mouth clear, the stones rolled aside, a trickle;
     - 3: mossed stones and an open pool, which spills out of the sprite's south-east toward the map's pool (R22-1).
   - `obj_landmark_bathhouse` is now the Warm Pool (32x40): the same stones round a pool, a lantern (the one warm
     accent), a bench and solid steam wisps. It replaces the Flow pavilion, by the critic's ruling (a).
   - Code changes:
     - A site also blocks the tile east of it (`WorldScene`, since its sprite covers that tile).
     - The opening-morning villager now waits at site+2 (`systems/valley.ts` `siteVisit`).
     - A new scenario, `warm-pool-built`.
2. **Rosa's letter paper and the Ilse icons** (0482cf4). Accepted in review 23.
   - `ui_letter_*` (`letterpaper.py`) is a 9-slice: flat parchment, a deckled 2 px soil edge, a sand margin and a
     folded top-right corner.
     - `src/ui/sheetSkin.ts` now has one 9-slice composer, shared by `sheetTexture` and the new `letterTexture`.
     - `TitleScene` uses `letterTexture` (tiled, never stretched) and draws the letter in ink with no shadow.
     - Slice spec: `LETTER_SLICE` in the manifest.
   - Icons:
     - `item_ilse_tin` and `item_spade` are drawn in `drawn.py`. There is now one spade drawing for the hotbar, the
       Action button and the swing.
     - `item_ilse_journal` comes from Flow `icons_ilse` b (crop `ilse1b/journal1`).
   - Ruling D23-1: the fold stays inside the 8 px slice. Don't trade text overlap for a bigger fold.
3. **Valley banner contrast** (f636585). Accepted in review 24.
   - `Hud.valleyMoment` draws the gold title and the parchment line on a solid walnut plate: a 2 px ink edge, a lit
     top, sized to the text, opaque at rest.
   - `WorldScene.valleyMoment` sends `farmerY`, the farmer's feet in screen px. When the farmer stands in the
     plate's slot (the town's clamped north edge on the river morning), the plate drops below them.
   - Ruling D24-1: keep the river plate as wide as it is.
4. **Baked dry palette: not baked**, by ruling D25-1 (no commit).
   - A bake with the `art/dryPalette.ts` table gives the same pixels as the runtime remap, which already runs hidden
     under the title wipe or the sleep fade. A bake would add about 600 KB for nothing.
   - The only reason ever to bake would be per-tile dry detail (cracked turf, dead tufts) that a slot remap can't
     draw.
5. **R21 fixes** (7477736). Accepted in review 25.
   - R21-1: a 2 px earth-dark rim outside the lit south and east lips (`channeltiles.rim`), so crops beside a
     channel no longer melt into the wood.
   - R21-2: winter wet channels and mouths get their own winter tiles through `tiles_extra.SEASON_OVERRIDES`: dark
     water, a 2 px ice-white edge and sand lips.
   - R21-3: culvert headwalls are 6 px deep and 4 px wider than the cut, with a lintel over the south mouth.
   - R21-4 is closed: the critic saw the channels in game.
6. **M6 visuals** (e6b6aca, R27-1 fix in f6664db). Accepted in review 27.
   - `obj_site_weir_0..4` (`sites.py`): a masonry wall and its gap, in five silhouettes.
     - 0: rubble heaped in the gap;
     - 1: the rubble's top out;
     - 2: the gap cleared to the footings;
     - 3: Orin's gate set, one beam short;
     - 4: the beam in.
   - `item_sluice_gate` is drawn in `drawn.py`.
   - `art-src/tools/towntiles.py` adds tileset tiles, appended at the end of `tiles_extra`:
     - `heron_t/_b` (afloat, with a 2 px navy waterline) and `heron_aground_t/_b` (leaning, sunk in a mud bank,
       with a dry hull line);
     - boarded facade pieces (`f_window_boarded`, `f_window_hi_boarded`, `f_door_boarded`,
       `f_doortop_red_boarded`, `f_doorlow_red_boarded`), where the door has planks crossing it (R27-1);
     - `reeds_bed`, `rockspur` and a static 2x2 `millwheel`.
   - `scripts/map-art.mjs`:
     - The town's boat uses the Heron tiles.
     - A two-storey boarded facade is boarded piece by piece, with no window light.
     - A new town config key, `river`, places the reed bed (18,24), the rock spurs (19,26 and 21,27) and the mill
       wheel (21-22, 30-31). They go on water tiles only, so collision is unchanged. The key is empty in the `dry`
       variant.
   - Maps were regenerated with `npm run art:maps`. `tiles.png` is now 512x1184 (it was 512x1136).
7. **The missing action facings** (845a0cb).
   - `codeacts.py` adds `plant` right (left mirrors it) and `harvest` up, both drawn on the idle head.
   - The crop in harvest up is Flow's harvest-down sprig, drawn behind the head.
   - `actFrames.json` now lists every facing. `chars2` grew to 512x512 (78 frames).
   - Accepted in review 29.

## Atlases now

| file | size | change |
|---|---|---|
| world | 512x256 | unchanged size |
| ui | 512x256 | was 512x128 |
| chars | 512x512 | unchanged |
| chars2 | 512x512 | was 512x256 |
| tiles | 512x1184 | was 512x1136 |

Each atlas is still one texture, and draws are unchanged.

## Next steps (open findings, by priority)

1. **R27-2 (minor):** the aground Heron's lean is hard to read at phone scale. Show 2-4 px of hull side in shadow on
   one flank, and bank a mud wedge against the low side. The code is in `towntiles.heron(P, aground=True)`.
2. **R27-3 (minor):** the weir only shows its west abutment, because the sprite ends at the gorge. Stages 3-4 need a
   span across the gorge (x 19-21, y 11) in tiles. That means a delta region in `generate-maps.mjs` `wendhead`:
   - Keep the walkability rule: a stage blocks exactly like its water stage.
   - A test enforces that rule.
3. **R24-1 (minor):** THE CREEK RUNS covers the creek's upper reach for about 3 s. Fade the plate in about 1.2 s
   later, once the water front has passed the top of the view. The code is in `Hud.valleyMoment`, with
   `farm-creek-first-morning` as the scenario.
4. **Wendhead's look:** it is still a fenced meadow (the hillside, ferns and gorge banks are not done). The tiles
   are this lane's job; placement is in `function wendhead(v)`.
5. **Per-tile dry detail** (cracked turf, dead tufts): the only case where baking the dry palette would pay
   (ruling D25-1).
6. **Nits:**
   - R27-4: the bottom tree border hides most of the mill wheel.
   - R23-1: the title sky's band edges use 1 px checker dithers, in TitleScene's sky.
7. **R29-1 (nit):** plant right's crouch reads through the arm only. Give frames 1-3 a 2 px knee fold; that needs a
   side-crouch body in `toolanim`.
8. **Perf on a quiet machine:** rerun `npm run perf`. The critic measured up to 2.99 ms JS a frame at 1x while this
   lane's full verify was running; the budget is 3.5 ms.

## Rulings standing

- D20-1: channels hide flora and decals.
- D21-1: the crisp rim stays.
- D21-2: the glint is static.
- D23-1: the letter's fold stays inside 8 px.
- D24-1: the river plate keeps its width.
- D25-1: the dry palette is not baked.
- The critic's acceptance criteria are in reviews 22-27.

## Merge notes (for the coordinator)

- **Map rebuild:** the tileset grew (new tiles at the end of `tiles_extra`), so every `.tmj` changed in its gids.
  - If another branch changes `art-src/map-tiles.json`, `generate-maps.mjs` or `map-art.mjs`, merge it first. Then
    run `npm run art:maps` and commit the maps and tilesets.
  - Channel tiles are read by name, so they don't care about the order.
- **Shared files touched:**
  - `src/scenes/WorldScene.ts`: site blocking and the `valleyMoment` helper.
  - `src/systems/valley.ts`: `siteVisit` +2.
  - `src/systems/events.ts`: `valleyMoment.farmerY`.
  - `src/ui/Hud.ts`: the plate.
  - `src/ui/sheetSkin.ts`: the shared 9-slice composer.
  - `src/scenes/TitleScene.ts`: the letter.
  - `scripts/map-art.mjs`: Heron, boarded and `river`.
  - `src/art/manifest.ts`: site and letter entries.
- **Text baked into images:** none.

## Verified and not verified

- **Verified:**
  - `verify:fast` was green before every commit. One run had an i18n unit test time out at 5 s under load; it
    passed alone.
  - Scenario shots at i13 and SE for every item (in `C:/Users/andre/dev/tiny-acre/art-scratch/r1..r7`).
  - In-game action strips for item 7.
  - The full `npm run verify` after the merge, with these results:
    - Every phase passed except two.
    - `e2e:scenarios` failed one check that the merge had just made able to fail: it expected Rosa at 7,15 on the
      spring's opening morning. It now expects 8,15, two tiles east (the site's sprite covers 6-7), and
      `e2e:scenarios` passes alone.
    - `perf 6x` was flaky beside the other suites and passed alone.
    - Perf at 1x and 4x was within budget (at most 12 draws and 3.5 ms JS a frame).
- **Not verified:**
  - A real phone.
  - The winter wet channels in game: water doesn't run on the winter day the scenario shows, so the winter look was
    judged from the tile sheet.
  - The Warm Pool next to the spring site in other seasons.

## Flow usage this round

None. Every new asset is drawn in code. The one Flow crop added is `ilse1b/journal1`, from the `icons_ilse-b` sheet
generated last round.
