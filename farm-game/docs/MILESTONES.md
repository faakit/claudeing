# The Dry Year: milestones

The build order for [VISION.md](VISION.md) and [WORLD-PLAN.md](WORLD-PLAN.md). Each milestone is small, ships on
its own (the game stays complete and fun if the work stops after it), and is built scenario-first
([EXTENDING.md](EXTENDING.md) section 0): scenarios before code, rules in `systems/` with unit tests, wiring in
`mechanics/`, data validated at load, text proven to fit, e2e on the scenarios with the await helpers and no fixed
waits, `npm run verify:fast` per commit, `npm run verify` before merge.

Owner areas: **depth** (rules, data, balance), **art** (maps, tiles, sprites), **onboarding** (title, guided start,
intro steps), **audio**, **feel** (motion and juice). "Villagers" means the living-villagers plan
(`agents/PLAN-NPC-LLM.md` on `plan/npc-llm`); its milestones are referenced as NPC-M1 and so on, not repeated here.

Global rules for every milestone:

- Perf: no scenario above 12 draws or 3.5 ms JS per frame (target: 6 draws); pacing gates unchanged.
- The guided start: `npm run e2e:onboarding` stays 16/16 reaching day 2, and the median time to day 2 does not grow
  by more than 5 s against the round-4 baseline.
- Save: version bumps only where listed; every bump has a migration test. Version numbers are taken in merge order
  (NPC-M2 also wants 18).
- Goals: nothing inserted into `goals.json`; places live in THE VALLEY section.
- Balance: `tests/sim.test.ts` medians stay inside their bands; every new income source gets a guard-rail test
  (WORLD-PLAN 9.2).

## Order at a glance

| # | Milestone | Owner areas | Depends on | Premise felt |
| - | --------- | ----------- | ---------- | ------------ |
| M1 | The letter and the first green | onboarding, art, depth | - | The reason to be here, and the first visible change in week one |
| M2 | Talk rules in the valley's voice | depth (with Villagers NPC-M1) | NPC-M1 or built together | Villagers speak from their loss, and change when it is mended |
| M3 | Map variants | art, depth | M1 | The engine for every later change; the dry creek bed on the farm |
| M4 | The restoration pattern and the Old Spring | depth, art, onboarding | M3 | The first mended place: the creek runs |
| M5 | Channels | depth, feel, onboarding | M4 | The first new verb |
| M6 | Memory and barks that notice the valley | depth (with NPC-M2, NPC-M3) | M2, M4 | "They noticed what I did" |
| M7 | The Cold Forge: strike in time | depth, feel, audio, art | M4 | The town's first sound of life |
| M8 | The Weir: the river returns, rowing | depth, art, feel, audio | M3, M7 | The biggest reshape: the town river |
| M9 | Grandmother's Orchard: grafting | depth, art | M4, M7 | Dead trees bud |
| M10 | The Seed House: seed saving; Clay's turn | depth, art | M4, M7 | The rival becomes an ally |
| M11 | The Market Square: market day | depth, art, audio | M7, M8 (families) | Stalls fill, families visible |
| M12 | Lantern Hill, the Watermark, the year-end | depth, onboarding, art, audio | M4 to M11 | The ending and the reason to return |

Audio runs alongside: A1 (thinned dry arrangement and a dry wind bed) with M1 or M3, A2 (creek and river loops) with
M4 and M8, A3 (anvil and bellows) with M7, A4 (market murmur) with M11, A5 (the Lantern Night piece) with M12.

---

## M1. The letter and the first green

- **Goal:** a first-time player knows why they are here before pressing New game, sees a parched farm on day 1, and
  sees the farm turn green in the first week, without day 1 getting longer.
- **Owner:** onboarding (title, strip line), art (dry palette), depth (trigger, letters).
- **Files and data:**
  - `src/data/valley.json` (new, minimal): `letter` (the title text), `farmGreen` rule (`stat: shipped, min: 5`,
    `minDay: 4`), `maps.farm` with two entries: `{ palette: "dry", when: farmGreen 0 }` and the default. No variant
    files yet: same `farm.tmj`, only the palette changes.
  - `src/systems/valley.ts` (new, pure): `mapLook(state, map) -> { file, palette }`, `checkFarmGreen(state)`.
  - `src/mechanics/valley.ts` (new): a `start` day hook sets `valley.farmGreen`, adds the morning note.
  - `src/scenes/TitleScene.ts`: the letter card on a first launch (no save), New game beneath it; nothing new with
    a save.
  - `src/art/mapLayers.ts`: `tilesetFor(textures, season, outdoor, palette)`; the dry tilesets loaded lazily (only
    while a dry palette is wanted).
  - `art-src/tools/seasons.py`: a `dry` remap (grass and foliage ramps to straw and grey-green; water, paths, roofs
    untouched) writing `tiles_dry.png` and `tiles_<season>_dry.png`.
  - `src/data/tutorial.json`: the welcome strip text "You came! I'm Rosa. The farm's yours."
  - `src/data/mail.json`: Mara's day-2 letter reworded (gift unchanged); Rosa's "first green" letter
    (`when: { stat: "valley.farmGreen", min: 1 }`); Rosa's rainy-day line in `npcs.json`.
  - Old saves: `sanitize` sets `valley.farmGreen` = 1 when `shipped` is at least 5 (a default, no version bump).
- **Scenarios:** `title-first-launch` (no save, title), `valley-farm-dry` (day 1, guided start running, dry palette),
  `valley-farm-green-eve` (day 5 evening, 5 shipped), `valley-farm-green` (day 6 morning, green, note and letter).
- **Tests:** `mapLook` picks the palette; the trigger fires once, never before day 4, never without 5 shipped; the
  title letter and the strip line fit (pure `measureText`); a save round trip keeps the stat; old-save default;
  e2e: open each scenario, assert the tileset key in use (`tiles_dry` versus `tiles`), the morning note text, the
  letter in the mailbox.
- **Acceptance:** onboarding e2e 16/16 to day 2 and median time to day 2 within +5 s; draws unchanged in
  `valley-farm-dry` versus `day1-fresh`; the dry texture is not loaded in `valley-farm-green`; owner and critic agree
  the dry farm reads as dry, not as autumn (shots of both palettes in all four seasons in `agents/out/`).
- **Depends on:** nothing.

## M2. Talk rules in the valley's voice

- **Goal:** the five villagers speak from what they lost while their place is broken, and differently once it is
  mended; today's "booming town" lines stop contradicting the premise.
- **Owner:** depth, on top of Villagers NPC-M1 (the dialogue database). If NPC-M1 has not landed, build it here as
  that plan specifies, then add this content.
- **Files and data:** `src/data/dialogue.json` (valley rules); `src/mechanics/valley.ts` registers talk facts
  (`place.<id>`, `variant.<map>`, `valley.farmGreen`, `placesDone`, `arrived.<family>`); `npcs.json` events reworded
  where WORLD-PLAN 5.1 says (Rosa "Know your soil", Mara "The ledger", Orin "The forge"; titles and rewards kept;
  "Blossom" and "The Heron" wait for M9 and M8); Clay's day-7 letter reworded (rules text unchanged).
- **Content:** per villager about 8 valley rules: 4 "dry" rules (`place` of theirs at most 2), 2 for the first
  green, 2 for after their place (written now, unreachable until it ships; the reachability test allows a list of
  `pending` places). Today's cheerful lines gain conditions so they appear only after the matching restoration.
- **Scenarios:** `talk-dry-mara` (town, day 3), `talk-green-rosa` (farm, day 6, green), `talk-clay-day7`.
- **Tests:** NPC-M1's fit, glyph and determinism tests cover the new rules; a test that no line in the dry tier
  mentions a thriving town (a small banned-phrase list: "booming", "whole valley is talking").
- **Acceptance:** in `talk-dry-mara` and the sim's 28-day talk run, no villager says a thriving-town line before its
  place is restored; the critic reads all five villagers' dry lines as specific to their loss.
- **Depends on:** NPC-M1 (or built together). Independent of M1, but best after it.

## M3. Map variants

- **Goal:** maps can change shape with the valley's state, safely; the farm shows its dry creek bed.
- **Owner:** art (generator, baking), depth (selection, rules, tests).
- **Files and data:**
  - `scripts/generate-maps.mjs`: map blocks become `function farm(v)`, a `VARIANTS` table, `delta` objects written in
    every variant, one `.tmj` per variant (`farm@dry.tmj`, `farm@waking.tmj`, `farm.tmj`). The farm's east strip
    (x 26-27, y 3-30) becomes the creek bed (dry in `dry` and `waking`, water in `restored`); its two trees move.
  - `scripts/map-art.mjs`, `art-src/tools/bake.py`: bake per variant; new tiles: dry stream bed, cracked mud and
    their edges, a dead crown.
  - `valley.json` `maps.farm` gets `variant` names; `systems/valley.ts mapLook` returns the file.
  - `src/scenes/mapCache.ts` keyed by file; `src/scenes/WorldScene.ts` loads `mapLook(...).file`.
  - Placement refusal in delta regions (`systems/placeables.ts`), text "The old creek bed. Best left clear."
  - `src/dev/scenarios.ts`: a semantic `valley` key (place stats and `farmGreen`); the dev menu lists variants.
- **Scenarios:** `farm-variant-dry`, `farm-variant-waking`, `farm-variant-restored` (pinned with `valley`; the
  restored one is only reachable from a scenario until M4).
- **Tests:** per-variant map tests (walkable spawns, connectivity, every fixed spot reachable); outside delta rects
  ground and collision identical across variants; no fixed spot, plot, sign, zone tile or scenario tile in a delta
  rect (unless the scenario pins the variant); doors identical across variants; placement refused in delta rects;
  `tests/dev-scenarios.test.ts` loads every scenario in its pinned variant; baked tiles present for every variant.
- **Acceptance:** `npm run verify` green; draws unchanged per variant; map files total under 400 KB; a player who
  loads a scenario standing in the creek bed of a `restored` farm is moved to the nearest door spawn.
- **Depends on:** M1 (valley.json, `mapLook`).

## M4. The restoration pattern and the Old Spring

- **Goal:** the first mended place, end to end: asked by a person, a small fund, three work days you can see, an
  opening morning, and the farm's creek running.
- **Owner:** depth (pattern, data), art (Spring Hollow, site sprites, creek water), onboarding (THE VALLEY section,
  intro step), audio (A2 creek loop).
- **Files and data:**
  - `valley.json` `places.spring` (ask day 3, project `place_spring`, `workDays: 3`, sprites, `journal: 1`).
  - `projects.json` row `place_spring` (300g, 20 stone, `"place": "spring"`, hidden from the board list).
  - `systems/valley.ts`: place stages, ask, funded, work day (once a day, 20 energy, one game hour), opening;
    `mechanics/valley.ts`: site interactable (sign, project sheet, work), `start` hook for openings, perk source.
  - `generate-maps.mjs`: `hollow` map (16x24, `dry` and `restored`), the farm's north-east gap door (28,3).
  - Items: Ilse's seed tin and journal (key items, not sellable, not giftable); Rosa's day-3 letter brings them.
  - `ui/panels/MenuPanel.ts` Goal tab: THE VALLEY section above the goals (each asked place and its next step); the
    HUD goal line shows "Work at the Old Spring (n of 3)" on a day not yet worked.
  - `tutorial.json`: intro `valleyAsk` (first ask: points at Menu > Goal), intro `siteWork` (first funded site).
  - Stats: `place.spring`, `site.spring.work`, `site.spring.last`, `placesDone`.
- **Scenarios:** `spring-site-ask` (hollow, day 3, sign), `spring-site-funded`, `spring-site-work` (work day 2),
  `spring-opened` (opening morning, Rosa at the site), `farm-creek-running`.
- **Tests:** stage transitions (ask only when its condition holds; work once a day; missed days cost nothing; opening
  the next morning); the project row is hidden from the board and opens from the site; the farm variant follows
  `place.spring`; THE VALLEY text fits; save round trip at every stage; old saves start at stage 0.
- **Acceptance:** from `spring-site-ask` a scripted player funds, works three days and wakes to a running creek;
  each work day changes the site sprite (shots in `agents/out/`); restoration gold under 500; onboarding e2e
  unchanged (the ask letter is day 3).
- **Depends on:** M3.

## M5. Channels

- **Goal:** the first new verb: dig a channel off the creek and the water waters your crops every morning.
- **Owner:** depth (rules), feel (dig and water-arrival juice), onboarding (intro), art (channel tiles, spade).
- **Files and data:** `SoilTile.channel?: true` (**save version 18**: sanitize accepts it; migration is a no-op);
  `systems/channels.ts` (flow walk, watering; pure); `mechanics/channels.ts` (action handler `dig-channel` priority
  45, `registerToolAction('dig')`, `pre-growth` day hook); the spade (`items.json`, `tools.json`, handed over at the
  spring's opening); `valley.json` `spring.flow: [24, 64]`; soil renderer draws channels (dry or flowing); paint
  gesture digs lines (the existing paint path with `work: ["dig"]`); intro `channels` in `tutorial.json`.
- **Scenarios:** `channels-first-dig` (farm, spade in hand beside the running creek, east field tilled),
  `channels-row` (paint a channel line), `channels-flow-cap` (60 tiles dug, flow 24), `channels-morning` (the
  morning after: watered soil beside channels).
- **Tests:** flow reaches exactly `flow` tiles breadth-first; watering marks tilled tiles beside reached channels
  only; filling a channel back; refusal when not next to water; channels never on plots' signs or fixed spots; a
  balance test (watered tiles at most 2 x flow; value under the same tiles' quality-sprinkler value); auto tool
  unchanged (the spade is never auto-picked); migration 17 to 18.
- **Acceptance:** in `channels-first-dig` one paint drag digs a 6-tile channel and the next morning the crops beside
  it are watered without the can; sim medians in band; draws unchanged.
- **Depends on:** M4.

## M6. Memory and barks that notice the valley

- **Goal:** villagers remember restorations and work you did with them, and the world talks differently as it heals.
- **Owner:** depth, on top of Villagers NPC-M2 (memory) and NPC-M3 (barks).
- **Files and data:** memory fact kinds `placeAsked`, `workedAt` (with the villager present), `placeOpened`,
  `arrived`, later `forged`, `grafted`, `seedDrawer`, `marketSold` (each milestone adds its own); about 20 memory
  rules and 15 barks keyed on `variant.<map>` and `place.<id>`; Villagers NPC-M5 `ties` for the families when they
  exist.
- **Scenarios:** `memory-worked-spring` (Rosa, the day after a work day together), `barks-dry-town` (town dry,
  Mara near the square), `barks-green-farm` (Rosa, farm green).
- **Tests:** the plan's memory and bark tests; each valley hook records once.
- **Acceptance:** in `memory-worked-spring` Rosa's line names the spring; barks change between `barks-dry-town` and
  the same scene with a restored town (a scenario variant).
- **Depends on:** M2, M4, NPC-M2, NPC-M3.

## M7. The Cold Forge: strike in time

- **Goal:** the town's first sound of life and the second verb: forge the parts later places need with a four-beat
  rhythm tap.
- **Owner:** depth (rules, recipes, place), feel (strike timing feel, hammer and glow motion), audio (A3 anvil and
  bellows, tuned to the piece's key), art (forge view, smoke, deadwood, charcoal, kiln, part icons).
- **Files and data:** `valley.json` `places.forge` (ask summer 1 or spring restored and Orin 2 hearts; fund 1,500g,
  5 copper bars, 10 charcoal; 3 work days) and `forge` (`bpm`, `great: 90`, `good: 180`); deadwood forage
  (`forage.json`, on `dry` variants only) and the charcoal kiln (`machines.json` row, `jar` behaviour, a recipe);
  `recipes.json` rows with `"station": "forge"`, `"beats": 4` (sluice gate, grafting knife, stall frame, lantern
  frame, iron hinge; parts refused by the bin); `systems/forge.ts` (score from press timestamps; pure);
  `ui/panels/ForgePanel.ts` (recipe list, anvil view, one wide Strike button low on the sheet); the forge as a
  fixed interactable; Opts "Easy strike"; Calm mode static ring; forge smoke and night glow as stat-keyed objects
  and a `lights` point; intro `forge`.
- **Scenarios:** `forge-cold`, `forge-work`, `forge-first-strike` (sheet open, bars and charcoal in the bag),
  `forge-calm`, `kiln-deadwood`.
- **Tests:** scoring windows (press times from the event, not the frame); four strikes always finish a piece (no
  failure); quality from the average; Easy strike gives Good; parts not sellable; deadwood only on dry variants;
  the ForgePanel fits on the SE and Pro Max profiles; e2e strikes four times through `farm.tapButton`.
- **Acceptance:** a piece takes under 10 s; on the critic's thumb model a Great rate of 60%+ at σ 40 ms; draws in
  `forge-first-strike` at most 6; the anvil cue measured at its target level.
- **Depends on:** M4 (pattern). Independent of M5 and M6.

## M8. The Weir: the river returns, and rowing

- **Goal:** the biggest reshape: the town river comes back, the Heron floats, and you can row it.
- **Owner:** depth (place, boat mode, fish gating), art (town `dry` and `river` variants, the Narrows, the Heron,
  rowing frames, reeds), feel (rowing motion, drift), audio (A2 river loop; the town piece's thinned and full
  arrangement).
- **Files and data:** `valley.json` `places.weir` (ask after the forge and Finn 2 hearts; fund 2,500g, 60 stone, a
  sluice gate; 4 work days at the Narrows); town variants `dry` (trickle in cracked mud, palette dry, boarded houses)
  and `river` (the river widened down the east side with Reed Island); the `narrows` map (`broken`, `restored`)
  and the town's east path (a log cleared on the ask); `systems/movement.ts` boat mode (water passable, land solid,
  `landing` objects); `fish.json` optional `place` and `zone: "deep"` rows; `fishzone` and `flotsam` objects;
  festivals `stocked.dryMaps: ["woods"]` for the Derby; Finn's 4-heart event "The Heron"; schedule `when` (Finn at
  the dock); the Marls (`npcs.json` Senna with `arrives: { place: "weir", days: 7 }`, the NE house lit, the mill
  wheel object); the Fish Ladder, Hot Spring and Seed Exchange projects re-gated (WORLD-PLAN section 8); the legends
  letter edited; intro `boat`.
- **Scenarios:** `narrows-broken`, `weir-work`, `weir-opened-town`, `boat-board`, `boat-deep-spot`, `boat-flotsam`,
  `derby-river`, `derby-lake`, `marls-arrive`.
- **Tests:** per-variant map tests for town and the narrows; boat mode collision (cannot row onto land, can land
  only at landings); save while boating puts you ashore at the last landing; trout, salmon and the two legends only
  with the weir; the Derby venue follows the weir; flotsam inside the forage-income bound; the fisher sim inside its
  bound; Senna not drawn or counted before her day.
- **Acceptance:** `weir-opened-town` shows a full river, the Heron afloat and Finn at the dock; rowing from the dock to
  Reed Island and back by taps only; draws at most 7 while rowing; the critic's real-phone checklist row for rowing
  feel added.
- **Depends on:** M3, M7 (the sluice gate). M5 is not needed.

## M9. Grandmother's Orchard: grafting

- **Goal:** dead trees bud: take cuttings, graft them onto old stumps whose roots shape the tree.
- **Owner:** depth (rules, trees), art (Orchard Hill, stumps, buds, blossom variant, knife and cutting icons).
- **Files and data:** `valley.json` `places.orchard` (ask: Rosa 3 hearts and spring restored; fund 2,000g, 30 fiber,
  a grafting knife; 3 work days); the `orchard` map (`dead`, `blossom` after 4 grafts) and the farm's west gate
  (0,20); `stump` Tiled objects with `roots` (eight on the hill; three on the farm creek in the `restored` farm);
  the knife (`registerToolAction('cut')`, a cutting is a stack with `of`); a graft action handler (priority 55)
  creating a `fruitTree` placeable with `data.roots`, not movable; `trees.json` root modifiers; Rosa's 4-heart scene
  walks you up the hill, her 5-heart "Blossom"; Wren (`arrives` the next spring 1, the hill cottage); intro `graft`.
- **Scenarios:** `orchard-dead`, `orchard-work`, `graft-first`, `graft-roots`, `orchard-blossom`,
  `farm-creek-stumps`, `wren-arrives`.
- **Tests:** one cutting per tree per season; graft only on stumps; buds for 7 days then a mature tree; root traits
  (sweet, hardy, heavy, early) bounded under melon per tile-day; the blossom variant after 4 grafts; save round
  trip of grafted trees on two maps.
- **Acceptance:** in `graft-first` one Action takes a cutting and one grafts it; a stump visibly buds at once;
  `orchard-blossom` shows the changed variant; sim inside bands.
- **Depends on:** M4 (the hill's ask needs the spring), M7 (the knife).

## M10. The Seed House: seed saving, and Clay's turn

- **Goal:** the rival becomes an ally through the place his family founded; you learn to let a crop go to seed.
- **Owner:** depth (rules, Clay's arc), art (Seed House interior and exterior, seed-head stages, tag ribbon,
  heirloom icons, Dara).
- **Files and data:** `valley.json` `places.seedhouse` (ask: Clay's new event "The other half"; fund 4,000g, 5 cloth,
  3 iron bars; 3 work days with Clay present); the `seedhouse` interior; `CropState.tag?`, `ripeFor?` (**save
  version 19**, or batched with 18 if M5 and M10 merge together); `crops.json` `heirloom` rows and heirloom seed
  items; the seed tag (action handler priority 60; the harvest handler skips tagged crops with a refusal); a `growth`
  hook ages tagged ripe crops; drawers (a collection page); Clay's perks re-gated (`rivalOff` also needs the Seed
  House) and his compost letter after the spring; Dara (`arrives` next season 1, cottage 3,27); intro `seedTag`.
- **Scenarios:** `seedhouse-ruin`, `clay-other-half`, `seedhouse-work`, `seed-tag-first`, `seed-bolted`,
  `seed-drawers`, `dara-arrives`.
- **Tests:** smart targeting never harvests a tagged crop; bolt after 3 ripe days; heirloom yield 2 to 4; hardy
  survives 3 days of the next season, then withers; heirloom quality bonus bounded; the board-race sim unchanged
  until `rivalOff`; migration.
- **Acceptance:** in `seed-tag-first` one Action tags a parsnip, three mornings later one Action collects heirloom
  seeds; in `clay-other-half` the scene plays and the ask appears; the critic agrees Clay's turn reads as earned
  (WORLD-PLAN 5.1 steps 3 to 10 all reachable in a scripted year).
- **Depends on:** M4, M7. Best after M8 (Clay's weir beat) but not required.

## M11. The Market Square: market day

- **Goal:** empty stalls fill; a weekly market where what you stock meets what visitors want.
- **Owner:** depth (rules, buyers, balance), art (stalls, awnings, bunting, visitors, the town `market` variant),
  audio (A4 crowd murmur, the market-day variation).
- **Files and data:** `valley.json` `places.market` (ask: Mara with three places restored; fund 5,000g, 5 cloth, three
  stall frames; 3 work days); town variant `market`; `market.json` (days 6, 13, 20, 27; six slots; 9 AM to 3 PM;
  demand max 0.5, step 0.15; visitors with seasonal wants); state `market` (**save version 20**, or batched);
  `systems/market.ts` (pure, lazy resolution like `applyRival`); `ui/panels/StallPanel.ts`; family stalls as
  stat-keyed objects; Mara's "The ledger" and market-bell opening; Tobin (`arrives` 7 days after) and the Market
  Road project renamed Trade Road and re-gated; intro `market`.
- **Scenarios:** `market-empty`, `market-work`, `market-day-stock`, `market-day-buyers`, `market-day-close`,
  `tobin-arrives`.
- **Tests:** demand math (variety beats repeats); at most 1.5x bin per item; leftovers paid or returned (setting);
  lazy resolution exact (opening the stall twice changes nothing); no market on festival days; a sim bot that stocks
  the stall earns at most twice its average daily shipping per market; StallPanel fits.
- **Acceptance:** in `market-day-stock` stocking six goods takes under 20 s by taps; in `market-day-buyers` at least
  three visitors with wants walk past and buy; draws at most 8 with visitors.
- **Depends on:** M7 (stall frames), M8 (the Marls, the first family stall). Families from M9 and M10 add stalls when
  present.

## M12. Lantern Hill, the Watermark and the year-end

- **Goal:** the ending, and a reason to come back every spring after it.
- **Owner:** depth (finale, Watermark, Founders' Stone), onboarding (finale flow), art (Lantern Hill, lanterns, the
  Watermark stone, the stone's levels), audio (A5 the Lantern Night piece).
- **Files and data:** `valley.json` `finale` (the letter, households and their lantern names) and `watermark`
  (bands and Rosa's sentences); the `lanternhill` map and the woods' west exit; the finale sequence (one line per
  villager, lanterns light per household, the last at the cairn by Interact, then the "The Wend is remembered"
  sheet); `festivals.json` Lantern Night (fall 27, a gathering with no contest, after the finale); the Watermark
  stone in town and its sheet (spring 1 of year 3 and every spring); `SummaryPanels.ts` year-end gains a Valley row
  and the new closing line; the Founders' Stone reframe (`projects.json` text, toppled-stone object from day 1,
  carved names per level); goal renames (WORLD-PLAN section 8).
- **Scenarios:** `finale-ready`, `finale-hill`, `after-finale`, `watermark-y3-low` (two places), `watermark-y3-full`,
  `year-end-valley`.
- **Tests:** the finale only with all six restored, once; every household with a lantern has arrived; Watermark bands
  cover every combination and the notch is always higher; the sheet text fits; Lantern Night only after the finale.
- **Acceptance:** `finale-hill` plays through by taps in under 90 s; `watermark-y3-low` reads warm (the critic signs
  off the wording); the year-end screen shows the valley row.
- **Depends on:** M4 to M11.

## Out of the first pass (v2 list, each its own small milestone later)

Channel sluice gates; forge tempers and forge level 2; rowing upstream to the Narrows; two-fruit grafted trees;
seed crossing and rare-crop drawers; a second stall row and market festivals; heart events for the returning
families; the families' children as walking villagers.
