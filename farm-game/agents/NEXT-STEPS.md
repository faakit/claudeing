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

### Game depth and economy

**Now:** a full year loop with farming, quality, foraging, fishing, crafting, machines, animals, five villagers
(Mara, Finn, Rosa, Orin, Clay) with hearts and events, jobs, mail, festivals, town projects, a greenhouse, the
mine, cooking and a board race with Clay. The sim bot is calibrated against real play: the five-seed median is
pinned at 261,631, within -20% / +25%. Save version is **17**.

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
