# The Dry Year: milestones

The build order for [VISION.md](VISION.md) and [WORLD-PLAN.md](WORLD-PLAN.md). Each milestone is small, ships on
its own (the game stays complete and fun if the work stops after it), and is built scenario-first
([EXTENDING.md](EXTENDING.md) section 0): scenarios before code, rules in `systems/` with unit tests, wiring in
`mechanics/`, data validated at load, text proven to fit, e2e on the scenarios with the await helpers and no fixed
waits, `npm run verify:fast` per commit, `npm run verify` before merge.

Owner areas: **depth** (rules, data, balance), **art** (maps, tiles, sprites), **onboarding** (title, guided start,
intro steps, HUD line), **audio**, **feel** (motion and juice).

Rules for every milestone:

- **Perf:** no scenario above 12 draws or 3.5 ms JS per frame (target 6 draws); pacing gates unchanged.
- **The guided start:** `npm run e2e:onboarding` stays 16/16 reaching day 2; the median time to day 2 grows by at most
  5 s against the round-4 baseline; day 3 gains no new beat.
- **Save:** one version bump in the whole plan (M4), with a migration test. Version numbers are taken in merge order
  (the living-villagers plan's memory also wants a bump).
- **Goals:** nothing inserted into `goals.json`; places live in THE VALLEY section. Goal texts may change, stats not.
- **Balance:** `tests/sim.test.ts` medians stay in their bands; each new income source gets a guard-rail test
  (WORLD-PLAN 9.2).
- **No outside dependency:** nothing here waits on the living-villagers plan; its systems enrich later (section E).

## Order at a glance

| # | Milestone | Owner areas | Depends on |
| - | --------- | ----------- | ---------- |
| M1 | The letter, the first green, and lines that fit the valley | onboarding, art, depth | - |
| M2 | Map variants | art, depth | M1 |
| M3 | The restoration pattern and the Old Spring | depth, art, onboarding, audio | M2 |
| M4 | Channels (and the plan's one save bump) | depth, feel, onboarding | M3 |
| M5 | The Cold Forge: strike in time | depth, feel, audio, art | M3 |
| M6 | The Weir: the river returns | depth, art, audio | M3 (M5 optional) |
| M7 | Towing and the first homecoming | depth, art, feel, audio | M6 |
| M8 | The Seed House: the seed library; Clay's turn; Dara comes home | depth, art | M3, M4 (tag field), M7 (timber) |
| M9 | The Bucket Orchard: grafting; Wren comes home | depth, art | M3, M7 (timber) |
| M10 | The Market Field: market day; Tobin; the Trade Road | depth, art, audio | M7 |
| M11 | Lantern Night, High Water, the year-end, the Founders' Stone | depth, onboarding, art, audio | M3 and every place shipped |

**The minimum complete game** is M1, M2, M3, M4, M6, M7, M8 and M11 (the core three places). Without M5, parts are bought
from Orin for gold; without M10, families' goods go on Mara's shelf; the finale requires the places that exist in
`valley.json`.

Audio alongside: **A1** the thinned arrangement on `dry` variants and the dry wind bed (with M2), **A2** creek and river
loops (M3, M6), **A3** anvil and bellows (M5), **A4** market murmur and the log-landing cue (M7, M10), **A5** the Lantern
Night piece (M11).

---

## M1. The letter, the first green, and lines that fit the valley

- **Goal:** a first-time player knows why they are here before pressing New game, sees a parched farm on day 1, sees it
  turn green in the first week with a reason (Ilse's tin and journal), and no villager calls the town thriving.
- **Owner:** onboarding (title, strip line), art (dry palette), depth (trigger, letters, conditional lines).
- **Files and data:**
  - `src/data/valley.json` (new, minimal): `letter`, the `farmGreen` rule (`stat: shipped, min: 5, minDay: 4`),
    `maps.farm`: `{ palette: "dry", when: farmGreen 0 }` and the default. No variant files: same `farm.tmj`.
  - `src/systems/valley.ts` (new, pure): `mapLook(state, map) -> { file, palette }`, `checkFarmGreen(state)`.
  - `src/mechanics/valley.ts` (new): a `start` day hook sets `valley.farmGreen` and adds the morning note.
  - `src/scenes/TitleScene.ts`: the letter card on a first launch (no save), New game beneath it.
  - `src/art/mapLayers.ts`: `tilesetFor(textures, season, outdoor, palette)`; dry tilesets loaded lazily.
  - `art-src/tools/seasons.py`: a `dry` remap writing `tiles_dry.png` and `tiles_<season>_dry.png`.
  - `src/data/tutorial.json`: the welcome strip text "You came! I'm Rosa. The farm's yours."
  - `src/data/mail.json`: Mara's day-2 letter reworded (gift unchanged); Rosa's first-green letter with Ilse's seed tin
    and journal (key items: not sellable, not giftable; the journal shows page 1 as text until M3).
  - `src/data/npcs.json`, `src/data/index.ts`, `src/systems/friendship.ts`: line groups and events accept an optional
    `when` (`stat`/`min`/`max`, `place` shorthand for `place.<id>`); `lineFor` filters by it. Content: 3-4 `dry` lines
    per villager about their loss; today's thriving-town lines conditioned on their restoration (unreachable until that
    place ships); Rosa's rainy line; Clay's day-7 letter in his new voice (rules text unchanged); Rosa's "Know your soil",
    Mara's "The ledger" and Orin's "The forge" reworded (titles and rewards kept).
  - Old saves: `sanitize` sets `valley.farmGreen` = 1 when `shipped` is at least 5 (a default, no version bump).
- **Scenarios:** `title-first-launch`, `valley-farm-dry` (day 1, guided start running), `valley-farm-green-eve` (day 5
  evening, 5 shipped), `valley-farm-green` (day 6 morning: green, note, letter), `talk-dry-mara` (town, day 4).
- **Tests:** `mapLook` picks the palette; the trigger fires once, never before day 5 or without 5 shipped; the title
  letter, strip line, letter and new lines fit (`measureText`); `when` filtering on lines and events (a group with no
  matching line falls back to the tier); a banned-phrase test (no "booming", "whole valley is talking" reachable while
  its place is unrestored); save round trip; old-save default; e2e: each scenario, the tileset key in use, the note,
  the letter and its two items.
- **Acceptance:** onboarding e2e 16/16 to day 2 and median time to day 2 within +5 s; draws in `valley-farm-dry` equal
  `day1-fresh`; the dry texture not loaded in `valley-farm-green` once no outdoor map is dry; door transitions on the
  farm still under 0.3 s (the feel bar; `e2e:feel`'s door timing) with the dry tileset resident; the critic and owner
  agree the dry farm reads as dry, not as autumn (shots of both palettes in all four seasons in `agents/out/`).
- **Depends on:** nothing.

## M2. Map variants

- **Goal:** maps can change shape with the valley's state, safely; the farm shows its dry creek bed.
- **Owner:** art (generator, baking), depth (selection, rules, tests).
- **Files and data:**
  - `scripts/generate-maps.mjs`: map blocks become `function farm(v)`, a `VARIANTS` table, `delta` objects written in
    every variant, one `.tmj` per variant (`farm@dry.tmj`, `farm@waking.tmj`, `farm.tmj`). The farm's east strip
    (x 26-27, y 3-30) becomes the creek bed (dry in `dry` and `waking`, water in `restored`); trees at 26,4 and 27,7
    move; the `field` weed zone shrinks to x 3-25; the Wendhead door (29,3) is added in every variant, leading to a
    placeholder until M3.
  - `scripts/map-art.mjs`, `art-src/tools/bake.py`: bake per variant; new tiles: dry creek bed, cracked mud and edges,
    a dead crown.
  - `valley.json` `maps.farm` gets variant names; `mapLook` returns the file; `src/scenes/mapCache.ts` keyed by file;
    `WorldScene` loads `mapLook(...).file`.
  - `systems/placeables.ts`: placement refused in delta rects ("The old creek bed. Best left clear.").
  - `src/dev/scenarios.ts`: a semantic `valley` key (place stats and `farmGreen`); the dev menu lists variants.
- **Scenarios:** `farm-variant-dry`, `farm-variant-waking`, `farm-variant-restored` (pinned; the restored farm is only
  reachable from a scenario until M3).
- **Tests:** per-variant map tests; outside delta rects ground and collision identical across variants; nothing fixed,
  no zone tile and no scenario tile in a delta rect unless allowed (WORLD-PLAN 4.2.2, 4.2.6); doors identical across
  variants; placement refusal; `tests/dev-scenarios.test.ts` loads each scenario in its pinned variant; baked tiles
  present for every variant.
- **Acceptance:** `npm run verify` green; draws unchanged per variant; door transitions under 0.3 s between variant
  files (a variant swap never loads at a door; it is chosen at the morning or the map load); a scenario load standing
  in the creek bed of a `restored` farm moves the player to the nearest door spawn.
- **Depends on:** M1.

## M3. The restoration pattern and the Old Spring

- **Goal:** the first mended place, end to end: asked by Rosa, a small fund, three work days that preview the verb, an
  opening morning, and the farm's creek running.
- **Owner:** depth (pattern, data), art (Wendhead, site sprites, creek water), onboarding (THE VALLEY section, HUD line,
  intros), audio (A2 creek loop).
- **Files and data:**
  - `valley.json` `places.spring` (ask: `valley.farmGreen` 1; project `place_spring`; `workDays: 3`; taste; sprites;
    `phrase`), the `wendhead` map (24x28; `dry` and `spring` variants now, `restored` added in M6).
  - `projects.json` row `place_spring` (300g, 20 stone, `"place": "spring"`, hidden from the board); the Hot Spring row
    gets `"site": "spring"` (shown on the spring's site sheet after the opening, off the board; same cost and perk).
  - `systems/valley.ts`: stages, ask, funded, work day (once a day, 20 energy), taste hooks, opening; restorations add
    to `placesDone` and `projectsDone`. `mechanics/valley.ts`: site interactable, `start` hook, perk source.
  - Work-day tastes: days 1-2 a pickaxe swing at the rockfall; day 3 the spade's first channel tile from the pool (uses
    M4's dig if present, else a scripted tile).
  - `ui/panels/MenuPanel.ts` Goal tab: THE VALLEY section above the goals; `ui/Hud.ts` goal line priority (WORLD-PLAN 2
    "On the HUD") and the 3-day wait for valley steps; the goal arrow points at the site.
  - `tutorial.json`: intros `valleyAsk` and `siteWork`, at most one valley intro per morning, held with `tipsHeldNow`.
  - Goal texts for 25, 41, 45 (WORLD-PLAN 8).
  - Clay's unsigned fertilizer letter the morning after the opening.
- **Scenarios:** `spring-site-ask` (Wendhead, sign), `spring-site-funded`, `spring-site-work` (work day 2),
  `spring-opened` (Rosa at the site), `farm-creek-running`, `hud-valley-line` (an ask, a fund, a work day and a waiting
  goal on the same day).
- **Tests:** stage transitions; work once a day; missed days cost nothing; the project hidden from the board; the farm
  and Wendhead variants follow `place.spring`; `projectsDone` and `placesDone` increment once; HUD line priority and
  waits (pure); THE VALLEY text fits; save round trip at every stage; old saves at stage 0.
- **Acceptance:** from `spring-site-ask` a scripted player funds, works three days and wakes to a running creek; each work
  day changes the site sprite (shots); restoration gold under 500; onboarding e2e unchanged.
- **Depends on:** M2.

## M4. Channels (and the plan's one save bump)

- **Goal:** the first new verb: dig a channel off the creek and the water waters your crops every morning.
- **Owner:** depth (rules, save), feel (dig and water-arrival juice), onboarding (intro), art (channel tiles, spade).
- **Files and data:**
  - **Save version bump** (18, or the next free number): `SoilTile.channel?`, `CropState.tag?`, `CropState.ripeFor?`,
    `settings.strikeOffset?` all accepted by `sanitize` now (tags and the offset are used by M8 and M5); migration is a
    no-op.
  - `systems/channels.ts` (flow walk, watering; pure); `mechanics/channels.ts` (action handler `dig-channel` priority 45,
    `registerToolAction('dig')`, `pre-growth` day hook); the spade (handed over at the spring's opening);
    `valley.json` `spring.flow: [24, 64]`; the soil renderer draws channels; the paint gesture digs lines
    (`work: ["dig"]`); intro `channels`.
- **Scenarios:** `channels-first-dig`, `channels-row`, `channels-flow-cap` (60 dug, flow 24), `channels-morning`.
- **Tests:** flow reaches exactly `flow` tiles breadth-first; only tilled tiles beside reached channels are watered;
  filling in; refusal away from water; channels never in delta rects or on fixed spots; balance (watered tiles at most
  2 x flow; under the quality-sprinkler value); auto tool never picks the spade; migration test with all four fields.
- **Acceptance:** in `channels-first-dig` one paint drag digs a 6-tile channel and the next morning the crops beside it
  are watered without the can; sim medians in band; draws unchanged.
- **Depends on:** M3.

## M5. The Cold Forge: strike in time

- **Goal:** the town's first sound of life and a verb of its own: forge the parts later places need with a four-beat
  rhythm tap.
- **Owner:** depth (rules, recipes, place), feel (strike timing, hammer and glow), audio (A3, tuned to the piece's key),
  art (anvil view, smoke, deadwood, charcoal, kiln, part icons).
- **Files and data:** `valley.json` `places.forge` (ask summer 1, or spring open and Orin 2 hearts; fund 1,500g, 5 copper
  bars, 10 charcoal; 3 work days, each a one-beat strike) and `forge` (`bpm`, `great: 90`, `good: 180`); deadwood
  (`forage.json`, on `dry` variants only); the charcoal kiln (`machines.json`, `jar`); `recipes.json` forge rows (sluice
  gate, timber hook, stall frame, grafting knife, iron hinge; refused by the bin); `systems/forge.ts` (score from event
  timestamps minus `settings.strikeOffset`; pure); `ui/panels/ForgePanel.ts` (recipe list, anvil view, a wide Strike
  button low on the sheet); "Tune your strike" (8 taps, median offset clamped 0-150 ms) on first use and in Opts; Opts
  "Easy strike"; Calm mode static ring; smoke and window glow as stat-keyed objects; intro `forge`. Until M5 ships, the
  parts are bought from Orin for gold (a `shops.json` row each, removed by M5).
- **Scenarios:** `forge-cold`, `forge-work`, `forge-first-strike`, `forge-tune`, `forge-calm`, `kiln-deadwood`.
- **Tests:** windows from event time, not frame time; the offset applied; four strikes always finish a piece; quality from
  the average; Easy strike gives Good; parts not sellable; deadwood only on dry variants; ForgePanel fits on SE and Pro
  Max; e2e strikes four times through `farm.tapButton`.
- **Acceptance:** a piece takes under 10 s; on the critic's thumb model, after tuning, a Great rate of 60% or more at
  σ 40 ms; draws in `forge-first-strike` at most 6; the anvil cue at its target level.
- **Depends on:** M3. Independent of M4.

## M6. The Weir: the river returns

- **Goal:** the biggest reshape, cheaply: the town river comes back, the Heron floats, Finn's loss is mended, and the
  river's fish and the Derby follow the water.
- **Owner:** depth (place, fish gating, festival venue), art (town `dry` and `river` variants, Wendhead `restored`, reeds,
  the Heron afloat), audio (A2 river loop; the town piece's thinned and full arrangement).
- **Files and data:** `valley.json` `places.weir` (ask: spring open, forge lit or summer 15, Finn 2 hearts; fund 2,500g,
  60 stone, a sluice gate; 4 work days; the last day's taste is scripted until M7: the water comes through and lifts a
  beam into the gap); town variants `dry` (D1 mud, palette dry, the north-east house boarded) and `river` (today's
  water, reeds, rocks and the reed bed on water tiles, the mill wheel); Wendhead `restored`; `fish.json` optional
  `place` (trout, salmon, glimmer trout, ice pike); `festivals.json` Derby `dryMaps: ["woods"]`; the legends letter
  edited; Finn's "The Heron" event and the dock schedule `when`; Clay's weir line; the Fish Ladder row gets
  `"site": "weir"`.
- **Scenarios:** `weir-broken`, `weir-work`, `weir-opened-town`, `derby-lake`, `derby-river`.
- **Tests:** per-variant map tests for town and Wendhead; town `river` matches today's walkability outside D2; trout,
  salmon and the two legends only with the weir; the Derby venue; the fisher sim inside its bound.
- **Acceptance:** `weir-opened-town` shows a full river, the Heron afloat and Finn at the dock; draws unchanged against
  today's town; doors between farm and town under 0.3 s while the town is still `dry` and the farm is green (the dry
  tileset resident, not loaded at the door).
- **Depends on:** M3. M5 optional (the sluice gate is bought without it).

## M7. Towing and the first homecoming

- **Goal:** a verb only water has (tow drift timber along the bank to the slip) and the first family home in a house
  you rebuilt.
- **Owner:** depth (towing rules, houses, arrivals), art (logs short and long, the rope, the slip, house scaffolding,
  Senna), feel (log follow, swing, snag and tug), audio (A4 log landing).
- **Files and data:** `valley.json` `weir.drift` (1-2 logs a day, one in winter; one in three long; speed; max 3
  waiting; three lanes chosen by day hash, never the same twice in a row) and `houses` (Marls 6, Holt wing 5, Wren 5,
  Tobin 4; family; place); `systems/towing.ts` (rope length 3, follow, lanes, snag test against water and obstacles;
  pure); a towing controller in the scene; the timber hook (`registerToolAction('hook')`; a forge part, bought from Orin
  until M5); action handlers for the slip and houses; a `morning` hook spawning drift (positions not saved; a save while
  towing returns the log to the north edge); timber (sells at 5g); Senna (`arrives: { place: "weir", house: "marls" }`),
  the Marls' house scaffolding and lit window, the mill wheel turning; intro `towing`.
- **Scenarios:** `tow-first-log`, `tow-long-log` (two tugs), `tow-east-lane` (a log turned west by the spur),
  `tow-winter` (ice rims, half speed), `tow-house-marls` (5 of 6 timber), `marls-arrive`.
- **Tests:** the log never leaves water; snags at rocks, the reed bed and bank corners; one tug frees a short log, two a
  long one; landing gives 1 or 3 timber; at most 3 waiting; ten consecutive days never repeat a lane and snag; save
  while towing; Senna not drawn or counted before her house is done; timber income bound.
- **Acceptance:** in `tow-first-log` a log is hooked, towed and landed by taps only in under 20 s, and in
  `tow-east-lane` under 30 s; draws at most 7 while towing; the critic's real-phone checklist gains a towing-feel row.
- **Spike first:** before any art is committed, a lab-map spike (rope, one lane, one snag, placeholder log) is played
  by the feel critic for a go or no-go on the towing feel; a no-go sends the Weir's verb back to design, and M6 still
  ships on its own.
- **Depends on:** M6.

## M8. The Seed House: the seed library; Clay's turn; Dara comes home

- **Goal:** the rival becomes an ally through the library his family founded; you learn to borrow, grow and give back.
- **Owner:** depth (rules, Clay's arc), art (Seed House roof stages, seed-head stage, tag ribbon, strain icons, planters,
  Dara, the children decor).
- **Files and data:** `valley.json` `places.seedhouse` (ask: "The other half"; fund 3,000g, 5 timber, 3 iron bars;
  3 work days with Clay, each tagging one of his plants) and `seedhouse.strains` (six founding strains); drawer stats
  (`seeds.<strain>.stock`, `.gen`, `.loan`); `ui/panels/SeedHousePanel.ts` (Borrow, Return, generation, last borrower);
  the seed tag (action handler priority 60; harvest skips tagged crops with a refusal); a `growth` hook for bolting;
  a `morning` hook for neighbours' loans and planters; Clay's "The other half" event, Winter Feast beat and re-gated
  perks (`rivalOff` also needs the Seed House); the Holt wing as a house (5 timber); Dara (`arrives`); the Seed
  Exchange row retired (`"retired": true`) and its rare seeds on the Seed House shelf; intro `seedLibrary`.
- **Scenarios:** `seedhouse-ruin`, `clay-other-half`, `seedhouse-work`, `seed-borrow`, `seed-tag-first`, `seed-bolted`,
  `seed-return-gen`, `neighbours-borrow`, `dara-arrives`.
- **Tests:** one loan per strain; smart targeting never harvests a tagged crop; bolt after 3 ripe days; yield 2-4; a
  2x return raises the generation; generations change only watering (slow thirst, rain keeper, dry-sown) and a
  generation-3 field earns the same per tile-day as a watered plain field (WORLD-PLAN 9.2); neighbours borrow only from
  drawers at
  10 or more and return more; the board-race sim unchanged until `rivalOff`; retired-project saves keep their perk.
- **Acceptance:** in `seed-borrow` to `seed-return-gen`, a strain goes from borrowed to generation 1 in one season by taps
  only; in `neighbours-borrow` Rosa's garden visibly grows the strain; the critic agrees Clay's turn reads as earned (all
  twelve beats reachable in a scripted year).
- **Depends on:** M3, M4 (the tag field), M7 (timber for the roof and the Holt wing).

## M9. The Bucket Orchard: grafting; Wren comes home

- **Goal:** dead trees bud: dormant cuttings grafted onto old stumps whose roots shape the tree.
- **Owner:** depth (rules, trees), art (woods `waking` and `blossom` variants, stumps, buds, the cottage, Wren, knife and
  cutting icons).
- **Files and data:** `valley.json` `places.orchard` (ask: Rosa 3 hearts and spring open; fund 2,000g, 30 fiber, a
  grafting knife; 3 work days: a cutting from the bucket tree, then the first graft); woods variants `dry`, `waking`,
  `blossom` (after 4 grafts), the `clearing` forage zone trimmed; `stump` Tiled objects with `roots` (eight in the
  woods, three on the restored farm creek); the knife (`registerToolAction('cut')`); a graft handler (priority 55)
  creating an unmovable `fruitTree` placeable with `data.roots`; `trees.json` root modifiers; Rosa's 4- and 5-heart
  scenes ("Grandmother's orchard", "Blossom", Ilse's last page); Wren's cottage (5 timber) and `arrives`; the bee-house
  bonus near grafted trees; intro `graft`.
- **Scenarios:** `orchard-dead`, `orchard-work`, `graft-first`, `graft-roots`, `orchard-blossom` (Y2 spring 1),
  `farm-creek-stumps`, `wren-arrives`.
- **Tests:** one cutting per tree per season, in any season; graft only on stumps; buds 7 days then mature; root traits
  under melon per tile-day; `blossom` after 4 grafts; grafted trees round-trip on two maps; woods variants keep the lake
  geometry.
- **Acceptance:** in `graft-first` one Action takes a cutting and one grafts it, and the stump buds at once;
  `orchard-blossom` shows the changed variant; sim in band.
- **Depends on:** M3, M7 (timber for Wren's cottage). M5 optional (the knife is bought without it).

## M10. The Market Field: market day; Tobin; the Trade Road

- **Goal:** empty stalls fill; a weekly market where what you stock meets what visitors want.
- **Owner:** depth (rules, buyers, balance, project re-gates), art (the town `market` variant, stalls, awnings, bunting,
  visitors, Tobin), audio (A4 murmur, the market-day variation).
- **Files and data:** `valley.json` `places.market` (ask: Mara with three places open; fund 4,000g, 5 timber, three stall
  frames; 3 work days, the last a first sale to Mara); town variant `market` (stalls in D2 only); `market.json`; the
  stall as a placed, unmovable object whose `data` holds the stock; `systems/market.ts` (demand, lazy `applyMarket`;
  pure); `ui/panels/StallPanel.ts`; family stalls as stat-keyed objects; Mara's market-bell opening and her post-market
  lines; Tobin (rooms above the forge, 4 timber; `arrives`); Market Road renamed Trade Road and gated on Tobin; Fair
  Hall gated on the market; the Library renamed Schoolhouse and gated on Dara; Greenhouse `after: canopy`; intro
  `market`.
- **Scenarios:** `market-empty`, `market-work`, `market-day-stock`, `market-day-buyers`, `market-day-close`,
  `tobin-arrives`.
- **Tests:** demand math (variety beats repeats); at most 1.5x bin; leftovers per the setting; lazy resolution exact; no
  market on festival days; a stall-stocking sim bot earns at most twice its average daily shipping per market;
  StallPanel fits; project re-gates keep old saves' finished projects.
- **Acceptance:** stocking six goods takes under 20 s in `market-day-stock`; in `market-day-buyers` at least three visitors
  with wants walk past and buy; draws at most 8 with visitors.
- **Depends on:** M7 (timber, the Marls' stall). Better with M5, M8 and M9 (more stalls), not required.

## M11. Lantern Night, High Water, the year-end, the Founders' Stone

- **Goal:** the ending, a yearly ritual that measures one thing, and a resting point for year-1 players.
- **Owner:** depth (finale, High Water, the stone), onboarding (finale flow), art (the households' lanterns, each made
  from its place, riding the weir; the river stone and its notches; the toppled and raised Founders' Stone), audio (A5).
- **Files and data:** `valley.json` `finale` (Rosa's fall 20 letters: ready and not yet) and `highWater` (notch heights
  from the spring, the weir and the warm pool); the finale at dusk on fall 27 at the Wendhead weir, after the market
  closes (each household's lantern made from its place; Ilse's frame from the forge that morning; one line per villager
  who stayed; you open the sluice by Interact and all the lanterns ride the water together; the "The Wend is remembered"
  sheet with place phrases); `festivals.json` Lantern Night (fall 27 evening, no contest, after the finale); the river
  stone and the High Water morning (first spring morning after rain with the weir open; the second notch, whichever
  year, side by side with the first and Clay's comparing line; no letter); `SummaryPanels.ts` year-end with place phrases and Rosa's
  line; the Founders' Stone
  reframe (text, a toppled-stone object from day 1, carved names per level); goal renames (WORLD-PLAN 8).
- **Scenarios:** `finale-ready` (fall 26, all restored, all home), `finale-not-yet` (fall 20, one house unfinished),
  `finale-weir` (fall 27, 6 PM, Wendhead), `after-finale`, `high-water-y2`, `high-water-second` (two notches),
  `year-end-y1`.
- **Tests:** the finale only on fall 27 with every place restored and every family home, once; Lantern Night only after;
  High Water once a year, only with the weir, the notch never lower than last year's; the fall 27 market and the
  evening gathering never overlap; letters and sheets fit.
- **Acceptance:** `finale-weir` plays through by taps in under 90 s with at most 8 draws (lanterns are atlas frames); `year-end-y1` reads as a resting point (critic
  signs off the wording); no screen in the game grades the valley.
- **Depends on:** M3 and every place that ships.

## E. Enrichments from the living-villagers plan (optional, after their base lands)

Not blocking any milestone above. When the plan's systems exist (`agents/PLAN-NPC-LLM.md`, branch `plan/npc-llm`):

- **E1, with its M1 (dialogue database):** move M1's `when` lines into `dialogue.json` rules; register valley talk facts
  (`place.<id>`, `variant.<map>`, `house.<id>`, `arrived.<family>`, `drift.waiting`); about 8 valley rules per villager.
- **E2, with its M2 (memory):** fact kinds `placeAsked`, `workedAt`, `placeOpened`, `forged`, `towed`, `grafted`,
  `seedReturned`, `arrived`, `marketSold`; about 20 memory rules ("You were up at the gorge at dawn again.").
- **E3, with its M3 (barks):** about 15 barks keyed on the map variant ("Quiet again." in a dry town; "Hear that?" from
  Finn at the river).
- **E4, with its M5 (ties):** the families' ties and gossip about restorations.
- Scenarios per enrichment: `memory-worked-spring`, `barks-dry-town`, `barks-river-town`, `gossip-house-done`.

## Later (v2s, each its own small milestone)

Channel sluice gates; forge tempers and forge level 2; towing from the Wendhead gorge; seed crossing and strains for the
other crops; two-fruit grafted trees; a second stall row and market fairs; heart events for the returning families;
the children as walking villagers.
