# Next steps

State after round 4 (`integration/round4-2026-10-11`, 2026-10-11) and the docs cleanup. Start a new session from
the latest integration branch.

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
`npm run verify:fast` (about 30 s) for each commit and `npm run verify` (about 6 min) before a merge. Setup, ports
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
3. M6: town `dry`/`river` (D1 mud) the same way. Make the mud tiles periodic, like the creek bed.

### The Dry Year: M1, M3, M4 (depth lane, branch `valley/m1`)

**Now:** M1 (the letter, the first green, lines that fit the valley), M3 (the restoration pattern and the Old
Spring) and M4 (channels, save v18) are built on M2's map stages. Save version is **18** (the plan's one bump).

- `valley.json` holds Rosa's letter, the first-green rule (5 shipped, day 5 at the earliest), the places (the
  spring) and the planned ones, and M2's map stages (farm; Wendhead `dry`/`spring`). `systems/valley.ts`: stages,
  conditions, the first green, the restoration pattern (ask, fund, work days, opening), the HUD's valley step and
  THE VALLEY rows, the creek as the channels' source. `systems/channels.ts`: the flow and digging.
- First launch shows Rosa's letter on the title (New Game under it, still `Title.buttons[0]`); it is kept in the
  mailbox, read, from day 3. Day 1 is straw (a runtime palette remap, `art/dryPalette.ts`); the first green
  dissolves straw to green around the farmer (`fx/GreenReveal.ts`), Rosa's letter brings Ilse's tin and journal.
- The Old Spring: asked on the first-green morning (Ilse's gate opens), funded from its site in one tap, three
  one-tap work days that play a beat each (the last hands over Ilse's spade), the opening morning (Rosa's scene, the
  creek's first morning reveal, Clay's unsigned sack after). The Hot Spring is the spring's Warm Pool.
- Channels: the spade digs on any open farm ground from the creek's bank (one drag; a culvert under a path), the
  water reaches 24 tiles and waters the soil beside them each morning; drawn in the map's detail layer. A
  home-plot-only farm reaches its crops on the first day (`channels-home-only`).
- Wendhead's dry stage is straw like the dry farm; the dry tileset stays resident until the spring opens.
- Scenarios: `title-first-launch`, `valley-farm-dry`, `valley-farm-green-eve`, `valley-farm-green`,
  `valley-farm-green-reveal`, `talk-dry-mara`, `spring-site-ask`, `spring-site-funded`, `spring-site-work`,
  `spring-opened`, `farm-creek-running`, `farm-creek-first-morning`, `hud-valley-line`, `channels-first-dig`,
  `channels-row`, `channels-flow-cap`, `channels-morning`, `channels-home-only`. The scenario e2e has `valley`, `spring` and `channels`
  blocks.

**Open:**

- The site sprites (`obj_site_spring_0..3`, 32x32), the letter's paper (`ui_letter_paper`, optional), the key item
  icons, the dry palette (baked `tiles_dry.png`, `tiles_<season>_dry.png` under the same keys) and channel tiles are
  code placeholders (see For art below).
- Finn's dry lines say the dryness is upstream because the town river still flows; M6 switches back to the "mud and
  a trickle" lines, keyed on the town's stage (coordinator ruling).
- Wendhead is small on purpose; its gorge and the weir come with M6 (a `restored` stage and delta rects there).
- The valley critic accepted M1-M4 (reviews 2-7 and `final.md` in `C:/Users/andre/dev/tiny-acre/valley-critique/`).
  Still open there: the channels intro could show a corner (the 22-tile home route turns once); the first-green jingle
  is the special-order fanfare; the owner is asked whether left-handed digging by an edge rest (1-2 s) instead of
  drawing the whole line is acceptable.

**Next:** M6 (the Weir: the town's `dry` and `river` stages, Wendhead `restored`, fish gated on the weir, the
flow to 64), then M7 (towing; a lab spike first), M8 (the Seed House, using the v18 tag fields), M11.

**For art:** the Old Spring's site in four stages (a 2x2 rockfall at the pool's mouth, lower each day, the mouth
running at the end); the letter's parchment (`ui_letter_paper`); icons for Ilse's seed tin, journal and spade; the
dry palette baked by `seasons.py` (the table is `art/dryPalette.ts`: parchment ground with gold flecks, grey-green
crowns, never orange or gold crowns); channel tiles (a dug ditch, dry and with water, with banks); Wendhead's look
(the pool, ferns, the gorge for M6); the Warm Pool landmark at Wendhead.

**Controls:** paint rows have an edge hold (`PAINT_EDGE_HOLD_MS` 180, band `PAINT_EDGE_CSS` 36): resting at the
screen edge the row points at keeps it growing, so left-handed westward rows reach as far as right-handed ones (a
real-phone pass should tune the band and the interval).

**For feel:** the dig (a cut that reads as a verb: earth thrown, the cut appearing tile by tile along a painted
row) and the water arriving down a new channel (today a splash and a ripple at the cut, then the morning's water);
the work-day beats at the site (three swings and a stone, or the spade's cut and the water: timings in
`SITE_BEAT_MS`); the first-green and creek reveals (`fx/GreenReveal.ts`: 1.2 s and 1.8 s, eased, a dithered edge).

**For audio:** a first-green jingle (the special-order fanfare stands in); the A1 dry ambience is a thin wind bed and
a fraction of the birdsong on dry maps (existing beds), but the thinned music arrangement is not done; A2: a creek
loop for the farm and Wendhead once the spring runs (the creek reveal plays the water cue); a dig cue for channels
(the till cue stands in).

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

**Now:** composed music played live on CC0 samples, with day and night arrangements for each season, plus title,
festival, mine, shop, lullaby, villager motifs, dawn and dusk, and season stings. There are recorded CC0 effects,
ambience and touch cues, with a synth fallback for each. Credits are in `ASSETS.md` and the per-file sources in
`audio-src/SOURCES.md`.

**Open:** nobody has listened to any of it. Two nits remain (see OPEN-FINDINGS.md).

**Next:**

1. A human listening pass on an iPhone and an Android phone: unlock on the first tap, resume after a call, the
   silent switch, and Bluetooth latency. Renders and the listening order are outside the repo, in
   `C:/Users/andre/dev/tiny-acre/audio-renders/round2/LISTEN.md`.
2. Music and ambience for the Dry Year: a dry valley that comes back to life could change the score as it heals.
3. Optional: indoor and woods ambience, more takes for coin and harvest, and more phrases per section.

How to rebuild: `python -I audio-src/tools/build.py <raw-dir>` (the raw sources are in
`C:/Users/andre/dev/tiny-acre/audio-raw/samples`; `fetch.py` downloads them again),
`python -I audio-src/tools/music_src.py` for the music, and `node audio-src/tools/render.mjs` plus
`measure.py` / `sfxlevels.py` / `seasons.py` to measure. The details are in `docs/EXTENDING.md` section 9.

## Needs the owner

- **Play it on a real phone, one-handed, as a first-time player.** Use the merged checklist in
  [OPEN-FINDINGS.md](OPEN-FINDINGS.md).
- **Listen** to the audio.
- **Decide:** Clay's catch-up crates, goals that step aside after 3 quiet days, the paint step, and bigger building
  footprints.
- **Licensing before any store release:** check Google's terms for the Flow images again (see `ASSETS.md`).
