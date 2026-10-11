# Next steps

State after the Dry Year core, M1-M4 (`integration/dry-year-core`, 2026-10-11; save v18), and M6 on `valley/m6`. Start a new session from
the latest integration branch. The valley critic's final report on M1-M4 is outside the repo, in
`C:/Users/andre/dev/tiny-acre/valley-critique/final.md`.

## Direction: The Dry Year

The valley is fading: the river shifted and the springs dried. Rosa writes to the grandchild of the farm's last
keeper. The player restores broken places across the valley, and each one opens with a new mechanic. The valley
visibly reshapes as it heals, and Clay goes from rival to ally.

The owner chose this premise. It replaces the original MVP goal. Read these first (they arrive with the
`design/dry-year` merge):

- [docs/VISION.md](../docs/VISION.md): the premise, tone and pillars;
- [docs/WORLD-PLAN.md](../docs/WORLD-PLAN.md): the valley, its broken places and how each one changes the map;
- [docs/MILESTONES.md](../docs/MILESTONES.md): the build order;
- [ROADMAP.md](../ROADMAP.md): owned by the design lane.

New work follows those docs. The areas below describe the game as it is now, which is the base the Dry Year
builds on.

## How to work

Build every feature scenario-first (see [AGENTS.md](AGENTS.md) and `docs/EXTENDING.md` section 0). Run
`npm run verify:fast` (about 30 s) for each commit and `npm run verify` (about 8-14 min) before a merge. Browser and
perf suites that fail beside others rerun once alone; a pass alone counts, and the summary marks it FLAKY. Setup, ports
and tools are in [TOOLING.md](TOOLING.md). The still-open critic findings are in
[OPEN-FINDINGS.md](OPEN-FINDINGS.md).

At the end of a round, rewrite your area's section below. Don't add a new file for it.

## Areas

### Dev sandbox and tooling

**Now:** there are 18 named scenarios (`src/dev/scenarios/`), the debug-only lab map, `window.__farm.dev` (clock,
frame stepping, time jumps, await helpers), the DEV tab and `scripts/lib/farm.mjs`. `verify` runs its suites in
parallel phases, and `build:store` and `cap:sync` ship no dev code.

**Open:** 449 fixed waits over 100 ms are grandfathered in `scripts/fixed-waits-baseline.json`, and that number
may only go down. The lab shares the farm's soil (`state.farm.tiles`).

**Next:**

1. Move `e2e.mjs` onto scenarios one block at a time (it has 43 fixed waits). Wait on `sceneReady` and
   `panelOpen`, and add a `town-projects` scenario.
2. Do the same for `e2e-mobile.mjs`, `perf.mjs` (each sample becomes a scenario, using `loop.step` and
   `frameStats()`), `e2e-controls.mjs` and `bench-thumb.mjs` (`openScenario`, `farm.idle()`), and
   `e2e-onboarding.mjs` (start on `day1-fresh` or `guided-day2`).
3. Rewrite each probe in `agents/probes/` on `scenario-template.mjs` when it is next needed. Delete the ones that
   only reproduce a closed finding. Lower the baseline after each step
   (`UPDATE_WAITS=1 npx vitest run tests/fixed-waits`).
4. The Dry Year reshapes maps, so per-map soil (independent lab beds and more fields) is probably needed. Decide it
   with the design lane.

### Map stages (Dry Year M2, branch `valley/m2-maps`)

**Now:** maps change shape with the valley. `valley.json` `maps.farm` has three stages: `dry` (farmGreen 0),
`waking` (the spring at stage 2 or below) and `restored` (spring 3). Each has its own file (`farm@dry.tmj`,
`farm@waking.tmj`, `farm.tmj`), and they differ only inside the delta rects over the creek bed (x 26-27, y 3-31,
except the footbridge row at y 6).

- API, all in `systems/valley.ts` and pure: `valleyStage(state, map)` gives the variant, stage, file and
  palette, and `mapLook` gives the file and palette. Also `inDelta`, `deltaRefusal`, `pinStage`,
  `clearDeltaRegions` and `allMapLooks`. `scenes/mapCache.ts activeMapKey(map)` gives the cache key of the
  file in use. M3 drives the stage by setting `place.spring`, and M1 by setting `valley.farmGreen` (and fills in
  the `palette: "dry"` tileset swap).
- Ilse's gate (29,3) leads to a fenced placeholder `wendhead` map. It stays locked (`lockStat`
  `valley.farmGreen` 1) until the first green, and is drawn open once it unlocks.
- Scenarios: `farm-variant-dry`, `farm-variant-waking`, `farm-variant-restored`, `farm-creek-place` and
  `farm-creek-rescue`. The DEV tab lists each stage, and `__farm.dev.stage(map, variant)` switches to one.
- How to add a stage: `docs/EXTENDING.md` section 11.
- Tileset: 512x1072, +73 of the plan's 480 slots.

**Open:** the creek art is drawn in code (`art-src/tools/valleytiles.py`, dead crowns in `crowns.py`) until the
art lane paints it. The dry palette (`tiles_dry.png`) is M1's. Restored is only reachable from a scenario until
M3.

**Next:**

1. M1: merge this branch. Set `valley.farmGreen`, and pass `valleyStage(...).palette` to `tilesetFor` (WorldScene
   reads the look at its build).
2. M3: add `wendhead` stages to `valley.json` and draw the real map in `generate-maps.mjs` as `function
wendhead(v)`. Budget its baked tiles: about 400 slots are left for Wendhead, town and woods together.
3. Done in M6: town `dry`/`river` (D1 bed, the creek bed's periodic tiles) and Wendhead's gorge; the tileset is
   512x1152 (+137 of the plan's 480 slots).

### The Dry Year: M1-M4 and M6 (depth lane, branches `valley/m1`, `valley/m6`)

**Now:** M1 (the letter, the first green, lines that fit the valley), M3 (the restoration pattern and the Old
Spring), M4 (channels, save v18) and most of M6 (the Weir) are built on M2's map stages. Save version is **18** (the
plan's one bump; M6 added none). The valley critic accepted M1-M4 at e5f07d6; M6 went to it for review at the
wrap-up (see Open).

- `valley.json` holds Rosa's letter, the first-green rule, the places (the spring, the weir) and the planned ones,
  the parts bought for gold (the sluice gate from Orin), and the map stages: farm (`dry`, `waking`, `restored`), town
  (`dry` until the weir, `river` = today's town.tmj tile for tile), Wendhead (`dry`, `gorge`, `spring`, `restored`:
  the pool follows the spring, the gorge the weir). Stage conditions nest (`all`/`any`). `systems/valley.ts`: stages,
  conditions and asks (hearts, days), the first green, the restoration pattern, the HUD's valley step and THE VALLEY,
  the parts, the river's first morning, the old-save defaults.
- The Old Spring: asked on the first-green morning, funded in one tap, three one-tap work days, the opening with
  Rosa, the creek's first morning, Clay's sack. Channels from the creek: 24 tiles, 64 once the weir is open.
- **The Weir (M6):** Finn asks by letter the morning the spring is open, the forge lit or summer 15 comes, and he is at
  2 hearts. Orin's sheet sells the sluice gate (500g) while the fund needs it; the fund is 2,500g, 60 stone and the
  gate, in one tap at the broken weir on Wendhead's gorge (17,11). Four one-tap work days (stones out of the gap
  twice, the gate set, then a scripted beat: the water lifts the last beam in). The next morning the gorge runs and
  the town has its river back: on the first step into town the dry town dissolves around the farmer under "THE RIVER
  IS BACK". Finn waits at the dock (16,32) beside the Heron all opening day (his opening lines there), and spends
  his afternoons there from then on. The Fish Ladder moves onto the weir's site sheet.
- **The dry town (new games):** straw, the river's west four columns (D1, x 17-20, y 22-31) a dry bed (solid like
  the river, owner bug 3), a two-tile trickle (20 fishable tiles) east of it, the Heron on the mud (solid), the
  north-east house boarded (a bare wall and a cold chimney until art draws boards). Trout, salmon, the glimmer trout
  and the ice pike bite only with the weir; the board never asks for them before. The Derby's catfish are at the woods lake while the river is dry.
  Finn's lines follow the town's stage; "The Heron" replaces "A secret spot" (4 hearts, reward kept); Clay says
  "Didn't ask for help" once the river is back. The legends letter says the river legends wait for the river.
- **Old saves keep their river** (coordinator ruling): a save without `valley.weirOn` gets the weir restored quietly in
  `sanitize` (no opening, moment, letter or count). Only games started since M6 play the dry town.
- Doors: farm to the dry town 286 ms with the farm green (the dry tileset resident from the morning), 290 ms to the
  river town (scenario e2e). Draws: the dry town costs what the river town does.
- Scenarios: `title-first-launch`, `valley-farm-dry`, `valley-farm-green-eve`, `valley-farm-green`,
  `valley-farm-green-reveal`, `talk-dry-mara`, `spring-site-ask`, `spring-site-funded`, `spring-site-work`,
  `spring-opened`, `farm-creek-running`, `farm-creek-first-morning`, `hud-valley-line`, `channels-first-dig`,
  `channels-row`, `channels-flow-cap`, `channels-morning`, `channels-home-only`; M6: `weir-broken`, `weir-gate`,
  `weir-work`, `weir-opened-town`, `river-first-morning`, `derby-lake`, `derby-river`, `town-dry-day2`,
  `old-save-weir-default`. The scenario e2e has `valley`, `spring`, `channels` and `weir` blocks;
  `tests/valley-weir.test.ts` holds M6's rules.

**Open:**

- **Verify before merge (M6 is not fully verified):** `npm run verify:fast` passed at fa03829 (lint, types, 1,126
  unit tests, build, the scenario smoke), and `npm run e2e:scenarios` passed alone (the `weir` block included). The
  full `npm run verify` was stopped partway on a machine loaded by other lanes: mobile, onboarding (16/16 to day 2)
  and e2e passed; e2e:scenarios (a `channels` Action timeout, a forage pickup) and e2e:controls (gesture timings,
  "harness lag") failed under that load and were never rerun alone. Run the full verify (and `bench:thumb`) on a quiet
  machine before merging; the controls and channels failures are expected to pass alone (M6 touches neither).
- M6 review (valley critic, read-only, `valley-critique/review-8.md` and `final-m6.md`): safe to merge once the
  pre-merge checks pass. **Major, needs a run:** `river-first-morning` builds a second full tilemap (`town@dry`) in
  the town scene's create, and the first step into town comes through the farm-to-town door; measure that door on
  the reveal morning at 1x and 4x before merge. If it busts 0.3 s or the 34 ms frame gate, build the overlay under the
  sleep blackout or after the wipe opens. Minor: Clay's `rivalLate` switch; R6-2. Nit: "The Heron" has a new id,
  so a save that saw "A secret spot" gets its 2 catfish again (mark `heron` seen when `secret` is, if unwanted). Its checklist also asks for
  a re-run of its 14 paired onboarding bot runs on the dry town's day-2 walk (gate: 173 s median) and `bench:thumb`.
- Left of M6 (not started, nothing half-wired): the R6-2 nit (the `channels` intro showing a corner in its paint
  target); Clay's `rivalLate` switching on at the weir's opening when he is below 2 hearts (WORLD-PLAN 5.1 step 5;
  only his line ships); reeds, the two rock spurs and the reed bed on the river's water (M7's towing lanes need them as
  obstacles) and the mill wheel (x 21-22, y 30-31).
- Placeholders (For art below): the weir's site sprites `obj_site_weir_0..4`, the sluice gate icon, the boarded
  house, the Heron aground and afloat.
- From the feel critic: decor (a pebble, a bush, a tree canopy) is drawn on top of channel water. A map/data job:
  keep that decor in the objects layer, or clear it from the art layers when a tile is dug.
- Still open from M1-M4 (`final.md`): R3-1 (keep M2 from merging alone), channel art and dig juice, the first-green
  jingle, and the owner's left-hand edge-hold question.
- `src/art/dryPalette.ts` (art lane) now remaps the baked creek bed and water banks too; `src/dev/devtools.ts`
  `goto` waits for the last map to stop.
- Audio for the valley (the `green` jingle, thinned arrangements by stage, creek and river beds, `dig`) is on
  `audio/dry-year` (see Audio).

**Next:** finish M6 from the critic's findings and the list above, then **M7** (towing and the first homecoming:
a lab spike played by the feel critic first; the feel lane is prototyping it on `feel/dry-year`), M8 (the Seed House),
M11.

**For art:** the Old Spring's site in four stages; the weir's site in five (`obj_site_weir_0..4`: the broken weir on
the gorge's west bank at Wendhead 17,11, drawn across the tile east of it like the spring's rockfall; stones out
twice, the gate set, the beam in, mended); `item_sluice_gate`; town `dry`: the Heron on the mud (`heron_aground_t` /
`heron_aground_b`, 19,25-26; the stage falls back to `boat_t`/`boat_b`), boards on the north-east house
(`f_window_boarded`, `f_door_boarded`; it shows a bare wall until they exist), the river bed's look (baked `creekbed`
in D1); town `river`: reeds and a reed bed (about 18,24), rock spurs (about 19,26 and 21,27), the mill wheel (x 21-22,
y 30-31), the Heron afloat by the dock (today's boat at 18,29-30). Tiles inside a delta rect go through the depth lane.
Also from M1-M4: the letter's parchment, the key item icons, the baked dry palette, channel tiles, Wendhead's look.

**For audio:** stage hooks are `valleyStage(state, map).variant` (town `dry`/`river`; Wendhead
`dry`/`gorge`/`spring`/`restored`, the gorge runs in `gorge` and `restored`), and `gameEvents` `valleyMoment` (the
first green, THE CREEK RUNS, THE RIVER IS BACK). Wanted: the river loop around the town's river (x 17-22, y 22-31;
the dry trickle x 21-22), the gorge at Wendhead (x 19-21), the thinned town piece while dry; the first-green jingle
(the special-order fanfare stands in), the creek loop, a dig cue.

**For feel:** the weir's last work day (`WorldScene.beamBeat`: the water through the gap, the beam swinging in;
placeholder shapes), the river's first-morning dissolve (`fx/GreenReveal.ts`, 1.6 s from the farmer), plus M1-M4's
dig, water arrival, site beats and reveals. Towing is M7.

**Controls:** paint rows have an edge hold (`PAINT_EDGE_HOLD_MS` 180, band `PAINT_EDGE_CSS` 36): resting at the
screen edge the row points at keeps it growing (a real-phone pass should tune both).

### Game depth and economy

**Now:** a full year loop with farming, quality, foraging, fishing, crafting, machines, animals, five villagers
(Mara, Finn, Rosa, Orin, Clay) with hearts and events, jobs, mail, festivals, town projects, a greenhouse, the
mine, cooking and a board race with Clay. The sim bot is calibrated against real play: the five-seed median is
pinned at 261,631, within -20% / +25%. Save version is **18** (the Dry Year's bump, see above).

**Open:** see OPEN-FINDINGS.md: summer for a farmer, the "Board 16" row, the race replay, and Clay's crates.

**Next:**

1. Critique 13 on a frozen copy: replay the race (a careful and a careless player), long-game goal waits, the
   jobs on days 3 and 4, and a busy season-change morning.
2. A crop request in the first days of summer and fall, for a crop the player planted.
3. A long-press hotbar picker, so seeds kept in the bag don't stop a one-thumb farmer. It touches `ui/Hud.ts`, so
   coordinate with the controls lane.
4. Line Clay and the race up with the Dry Year (rival to ally) once `docs/VISION.md` lands.

Things to watch: goals are an index into a list, so only append to it. `aside` goals and goal waits change which
goal shows, never the order. The race starts on day 8 (`game.rival.startDay`).

### Guided start (onboarding)

**Now:** day 1 is a guided harvest, plant, water and ship, then free time, errands and a bed offer. Day 2 is a
rain morning: the letter, the Goal tab and the walk to town. From day 3, one-time intros follow. The critic's bot
reaches town on day 2 in 16 of 16 runs. Progress is stored in stats only (`tut.*`).

**Open:** the tip burst after the first purchase, `job1` without a `where`, and the overlap of "+1" with the goal
banner.

**Next:**

1. Release held tips one at a time, at most one per in-game hour (`systems/goals.ts`).
2. Give `job1` a `where`: the board, or the villager who posted the job.
3. Rewrite the guided start for the Dry Year opening (Rosa's letter, arriving at a fading farm). It is data in
   `src/data/tutorial.json` (`docs/EXTENDING.md` section 10).

### One-thumb controls

**Now:** tap to walk and act, a forgiving tool ring, and Action press-and-lift. Holding Action and dragging paints
a serpentine row, so a 3x3 plot takes 7 gestures and about 250 mm of thumb travel. The left hand reaches as well
as the right. The benchmark baseline is `agents/out/controls/bench-r3-final.md`, with thresholds in
`scripts/bench-thresholds.json`.

**Open:** serpentine paint on an SE with a shaky thumb, ring taps on SE with the left hand, and the owner's
questions on the paint step.

**Next:**

1. A real-phone pass before tuning any number (paint step 16 px, turn 14 px, ring radius 64, arm time 300 ms).
2. A cue for the first row's width while painting, or U-turn rows that snap to the edge of the tilled plot.
3. Android edge-gesture exclusion for the dock, native haptic strength, and gapless bag cells on SE.

### Game feel

The feel lane is working on its own branch right now. Its handover is [NEXT-STEPS-FEEL.md](NEXT-STEPS-FEEL.md).

### Art

The art lane is working on its own branch right now. Its handover is [NEXT-STEPS-ART.md](NEXT-STEPS-ART.md).

### Villager dialogue (LLM NPCs)

The plan is `PLAN-NPC-LLM.md`, which another branch is writing. It is not on this branch yet; link it here once it
merges.

### Audio

**Now (branch `audio/dry-year`, ab8cdab plus a docs commit):** composed music on CC0 samples (day and night per
season, title, festival, mine, shop, lullaby, motifs, dawn/dusk, stings), recorded CC0 effects and ambience with a
synth fallback for each; the owner listened and approved the direction. The Dry Year round adds, in the same
direction (no new compositions):

- **Audio by map stage** (`src/audio/stages.json`, read through `src/audio/stages.ts`): keyed on
  `valleyStage(state, map).variant` (`default` for a map with one look). A stage marked `arrangement: "thin"`, or on
  the dry palette, plays the season piece thinned (each season piece's `thin` in `music_src.py`: bass and percussion
  fade out on their own strips, then are not played; fall's harp moves to its half pattern; about 3 dB under the
  full piece), over the dry wind (now 0.6, about 11 dB under the thinned piece) with a bird now and then. A rainy
  dry day plays the rainy arrangement, never both. `water` lists the beds a stage runs (creek, river), positional
  by tile distance to `near` rects (floor 0.25), with a `wait` stat for a reveal (`valley.creekSeen`). Farm
  `restored` and Wendhead `spring`/`restored` run the creek; town `river` and today's town (`default`) run the
  river; town `dry` is thin with a faint trickle at x 21-22; Wendhead `gorge` (old saves) is thin with the river.
  The M6 builder confirmed these variant names.
- **A reveal** (`runtime.valleyReveal`) holds the stage before it: the dry wind and few birds while the straw
  dissolves, then the birds return and the arrangement fills back in on the same bar clock (about 2 s). The dawn
  flourish is spent, not played, on a reveal morning.
- **The `green` jingle** (jingle system, priority 3, 92 bpm, about 3.3 s, synth fallback) plays for every valley
  moment (`Hud.valleyMoment`: the first green, THE CREEK RUNS, and M6's THE RIVER IS BACK) instead of the special
  fanfare.
- **New cues:** `dig` (a channel cut: `actionFx` case `dig` and the spring site's channel beat), `logLand` and
  `logKnock` for M7 towing (the feel lane calls them from `tow-spike`). All come from packs already credited (Kenney
  Impact Sounds, rubberduck's water pack, the shovel), extracted from the cached archives: no new downloads.
- **New beds:** `creek` (three water-loop layers), `burble` (gurgle one-shots), `river`; the `wind` bed has a second
  11 s layer (combined period 165 s). New payload about 0.35 MB.
- Tools: `build.py` loop layers take their own `src`, `shift`, `gain`, `lp` and a `search` that slides the start to a
  matched wrap level; per-cue `repeatWindow`; `render.ts` renders `thin` and timed `changes`; `render.mjs` has the
  `dy-*` jobs. Tests: `tests/audio-dry-year.test.ts`.

**Verified:** `verify:fast` green at ab8cdab. The full `verify` ran at ab8cdab while renders loaded the PC: the unit
`tapmove` pathfind timing (9.4 ms against 2 ms) and `e2e:controls` gesture and timing checks failed (harness lag; no
input code changed here); everything else passed, and `perf` was not reached. Renders and `LISTEN.md` are in
`C:/Users/andre/dev/tiny-acre/audio-renders/dry-year/`. **Not verified:** no real phone; no scenario was checked by
ear in the built-in browser (only a Playwright probe of `channels-first-dig` cue timing); the critic
(`audio-critique/review-11.md`) has not reviewed a checkpoint yet.

**Open:**

1. **Major, fix first:** the creek's layers 1 and 2 (2.25 s, 2.4 s) realign every 36 s (self-correlation 0.83 at
   36 s in `dy-creek-long`). Set creek layer 2 `body` to 2.47 in `audio-src/recipes.json` (repeat over 500 s),
   rebuild, and check the self-correlation stays under 0.6 over 3-120 s.
2. Critic D2 (provisional, disputed): the critic wants town `default` to be thin with the trickle before M6. Today's
   town map shows a full river (Finn's lines say it still flows), so audio follows the map, and M6's `dry` variant
   flips it by data. Settle it with the critic.
3. The dig row is louder than rapid water but 3.8 dB under the same row tilled (`dy-dig-row-alone` -22.9 against
   `dy-till-row-alone` -19.7 LUFS); a wet row adds the water at full level every 0.45 s (-17.4 LUFS with music).
   Consider `repeatWindow` 0.5 for `water` (painted watering rows have the same 0.45 s rate).
4. The rainy arrangement alone is quiet in fall (-35 LUFS, music only): base behaviour, untouched here.
5. Wendhead's gorge rect for a positional river (the M6 builder will send it).

**Before merge (none of this ran after the last commit):** `npm run verify` on an idle PC (`e2e:controls`, the
pathfind timing and `perf` alone if they fail beside others); the creek fix above and its rebuild; renders with
`node audio-src/tools/render.mjs <dir> <url> dy-`, plus `hits-` and the baselines (`music-`, `rain-`,
`storm-summer`, `amb-wind`, `mix-farm-work`, `stress-max`, `water-rapid`), then `measure.py` and `sfxlevels.py`;
these scenarios by ear: `valley-farm-dry`, `valley-farm-green-reveal`, `valley-farm-green`,
`farm-creek-first-morning`, `farm-creek-running`, `spring-opened`, `channels-row`, and `tow-spike` once the feel lane
lands it; the critic's acceptance.

How to rebuild: `python -I audio-src/tools/fetch.py <raw-dir> --lock` (extracts from the cached archives in
`<raw-dir>/_archives`), `python -I audio-src/tools/build.py <raw-dir>` (raw sources in
`C:/Users/andre/dev/tiny-acre/audio-raw/samples`), `python -I audio-src/tools/music_src.py` for the music, then
`npx prettier --write src/audio/manifest.json src/audio/music.json` and `python -I audio-src/tools/sources_md.py`.
Measure with `render.mjs`, `measure.py`, `sfxlevels.py` and `seasons.py`. Details are in `docs/EXTENDING.md`
section 9.

## Needs the owner

- **Play it on a real phone, one-handed, as a first-time player.** Use the merged checklist in
  [OPEN-FINDINGS.md](OPEN-FINDINGS.md).
- **Listen** to the audio.
- **Decide:** Clay's catch-up crates, goals that step aside after 3 quiet days, the paint step, and bigger building
  footprints.
- **Licensing before any store release:** check Google's terms for the Flow images again (see `ASSETS.md`).
