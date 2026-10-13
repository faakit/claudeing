# Next steps

State after the Dry Year core, M1-M4 (`integration/dry-year-core`, 2026-10-11; save v18), M6, and M7 on `valley/m7`. Start a new session from
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

## State: integration/dry-year-2 (deployed 2026-10-11)

M6 (the Weir), the feel lane (channel juice, edge hold, the `tow-spike` lab), Dry Year audio, the art lane (chars
atlas split, channel tiles), the owner's bug fixes (tree see-through keeps 60% of a crown, smooth tap retarget, dry
beds solid like water), floating controls (the wooden dock removed) and English/pt-BR i18n, all merged and verified:
full verify green, `bench:thumb` 36/36, onboarding 14/14 to town on day 2 (median 163.5 s, gate 173), the
river-morning door 0.29 s with a 14 ms worst frame at 4x.

Next round: the towing go/no-go needs feel's T1 fixed first (tapping the slip while the farmer walks to hook stalls
the tow after the tug, 19/28 runs), a 10-20 tile lab lane with a turn, and the feel critic's probe at 1x and 4x
(`feel-critique/final-dry-year.md`). Art items 2-7 carry over (Flow sources for the spring site, the Warm Pool, the
icons and the letter paper are already in `flow-raw/`); the valley banners (THE RIVER IS BACK) read low-contrast on
straw. Then M7 (towing and the first homecoming).

### Owner's polish round (UI lane, polish/owner-round, 2026-10-12)

Owner reports fixed, each with its scenario and e2e block (rulings in DECISIONS.md "Owner's polish round"):

- **Hidden text:** a text guard (`overflowIn` and block `textGuard` in e2e-scenarios; `SHEETS=<prefix>` for one) reads
  every visible text on about 80 sheet and HUD states, SE and iPhone 13, pt-BR and English. It fails text that is off
  its sheet, cut with "..", overprinted, covered (including over an open sheet), or low-contrast. Its fixes include:
  the sleep and villager flows, the fishing hint, shop and board lines, rows that wrap, item and count labels on wood,
  the goal banner plate, and the controls help.
- **Buy 5 items:** on Mara's sheet the coach points at Shop (`coachShop`).
- **Fishing:** the rod alone, with the line held out under the sheet (`fish-cast`, `fishCast`).
- **Sheets close only from Close** (`sheetTaps`).
- **Reading time and toasts:** `readMs`; tips and refusals stay until a touch; toasts queue; over a sheet, one shows in
  the free band (`toastTiming`, case `sheet.toasts`).
- **Villagers never pop:** walks, entering and leaving just past the screen's edge (`npc-schedule-change`,
  `npc-arrive-town`, `npcPops`).
- **Hotbar:** five big cells (tool cell, can, three items), the can's water level, a hand pick used by the next press,
  and a press in the action lock kept (`hotbar-can-level`, `hotbar-full-bag`, `hotbar`).

**Open:**

- The i13 right "fish" row of bench:thumb sits at its 16-gesture limit: 12-19 here, 8-16 on base; it follows the reel's
  randomness.
- In full parallel `e2e:scenarios` runs, the spring and weir morning checks have failed under load and passed alone.
- A forage good can spawn on an unreachable dry-town tile and stall the guided forage step (chip filed, gameplay lane).
- Villagers have no walk frames; a 1 px bob stands in (art lane).

**Merge:** depth/bait-board touches FishingPanel (result screen Close-only: drop the `tapToContinue` `setHint`
call) and BoardPanel (tabs move the requests header). After the merge, add the fishing result to `TAP_SHEETS` and run
`BLOCKS=textGuard SHEETS=board,fishing`.

### QA round: readability and UI (UI lane, qa/ui, 2026-10-13)

The tester's six UI items, each with its scenario (rulings in DECISIONS.md "QA round: readability and UI"):

- **Bigger text:** a body face (capitals 9 px, x-height 7, 13 px lines) is the default everywhere; the 5x7 stays for
  counts over icons and, at 2x, the clock and titles. Same widths, so only heights moved (rows 28 px). The text guard
  reads each face's metrics and passes 260 states (`board.jobs` and `shop.card` added).
- **Gold coin:** `¤` is a coloured glyph in both faces; `fmtGold` writes `{n}¤` in both languages.
- **Shop:** labelled row facts ("Ripe 7d, sells 85¤"), a legend, and an item card on a row tap (`ui-shop-card`).
- **Board jobs:** icon, full label, progress and pay in words (`town-quest-turn-in`).
- **Bag drag and drop:** hold or slide an item, drop on any slot or the hotbar row (`ui-bag-drag`, e2e block `uiQa`).
- **Market info:** the shop row's facts; the depth lane's Guide (Book > Guide, Gold topic) explains them too.

**Open:** gold written by hand in data (goal names "Earn 100,000g", Clay's letters) still reads g/o (depth lane
data; `¤` there draws the coin). The full `verify`, `bench:thumb` and perf were not run (owner order); no real phone.
After the depth merge, check the 3-, 4- and 5-tab menu grids on `reveal-day2-tabs` and the Guide pages in the body
face.

### Code review (review/dry-year-2, merged and deployed 2026-10-12)

26 fixes, among them a game-loop freeze on a second placement after any map change (report: `agents/out/` on the
review worktree; rulings in DECISIONS.md). Coordinator rulings on its questions:

1. A mid-step tap on the farmer's own tile keeps the round-4 rule (cancel, act ahead).
2. The game, not the e2e harness, should guarantee one act per short Action press on a slow frame (feel lane, next).
3. An unreadable save: the title says so and offers Retry, and New Game asks before overwriting (copy in both
   languages; next round).
4. pt-BR: the mine's rock node gets its own word ("Rocha"), apart from Stone ("Pedra") (i18n, next round).

Left open (low): the drag hint's looping tween is never killed; the landmark list rebuilds about 7 times a frame;
`toEnglish` of a pt-BR price of 1,000 or more misses the tutorial's price pattern; the `mechanics` e2e block timed out
"waiting for an Action result" 3 times in about 20 runs.

### M7 merged (2026-10-12)

M7 (towing on the town river, drift timber, the timber hook, the Marls' house, Senna's homecoming) with its art and
audio was accepted by the valley critic (`valley-critique/final-m7.md`: tow matrix 16/16 per lane at 1x and 4x,
onboarding 14/14 median 163.5 s, bench:thumb OK) and merged here. Watch: winter towing costs about 10 ms of game JS per
frame at 4x (p95), the closest lane to the bar. Next: M8 (the Seed House), then M11.

## How to work

Build every feature scenario-first (see [AGENTS.md](AGENTS.md) and `docs/EXTENDING.md` section 0). Run
`npm run verify:fast` (about 30 s) for each commit and `npm run verify` (about 8-14 min) before a merge. Browser and
perf suites that fail beside others rerun once alone; a pass alone counts, and the summary marks it FLAKY. Setup, ports
and tools are in [TOOLING.md](TOOLING.md). The still-open critic findings are in
[OPEN-FINDINGS.md](OPEN-FINDINGS.md).

At the end of a round, rewrite your area's section below. Don't add a new file for it.

## Areas

### Languages: English and Brazilian Portuguese (i18n lane, branch `i18n/pt-br`)

**Now:** the whole game reads in English or Brazilian Portuguese (`src/i18n`, no library). Code text goes through
`t(key, params)` with `{name}` params, `Intl` plurals and `fmtNum` / `fmtGold`; the dictionaries are
`src/i18n/en.json` and `pt-BR.json` (about 650 keys each). Data text stays English in `src/data/*.json` and a
per-locale overlay keyed by the English text (`src/i18n/data/pt-BR/<file>.json`) is laid over it on a language
change (`src/i18n/dataText.ts`). The font draws á à â ã é ê í ó ô õ ú ç and the accented capitals. The language comes
from `?lang=`, then the stored choice (save-store key `lang`, no save change), then the device; it is switched in
Menu > Opts ("Language: EN") or on the title, and applies at once. Glossary and voices: `src/i18n/GLOSSARY.md`.
Scenarios: `lang-pt-title`, `lang-pt-farm-hud`, `lang-pt-sheets`, `lang-pt-dialogue`, `lang-pt-mail` (e2e block
`lang` in `e2e-scenarios.mjs`, on the SE).

**How to add a string:** call `t('area.key', { param })` and add the key to both `en.json` and `pt-BR.json` (`npm
test` fails on a key in one and not the other, on a hard-coded prose literal in game code, and on a character the
font lacks). For data (a new item, line, letter, goal, tutorial step) edit `src/data` as always, then add the English
string with its Portuguese to `src/i18n/data/pt-BR/<file>.json`; `npm test` lists every missing and stale one.
Details: `docs/EXTENDING.md` section 12.

**How to add a language:** `Locale`, `LOCALES` and the dictionary import in `src/i18n/index.ts`, a full
`<locale>.json`, overlays in `src/i18n/data/<locale>/`, any missing glyphs in `ui/fontMetrics.ts`, a glossary and
`lang-<code>-*` scenarios (EXTENDING section 12 has the steps).

**Open:**

- Built and committed while the owner had stopped every test run: **nothing here has been compiled, unit-tested or
  run in a browser yet.** Before merging: `npm run verify` (typecheck and lint first; the new suites are
  `tests/i18n.test.ts` and the `lang` e2e block), then open the five `lang-pt-*` scenarios on the iPhone 13 and SE.
- Letters written by code (festival notices, birthday hints) keep the language they arrived in; data letters show in
  today's language.
- Owner choices in the glossary: gold as "o" (ouro), the Heron as "a Garça", the Weir as "Açude", "aprisco" for the
  sheep shed.

**Next:**

1. `integration/dry-year-2` (M6 Weir, feel, audio, floating controls) is merged and its strings translated; the art
   lane's merge adds no text. Every later branch: translate its new strings (`npm test` lists the data ones; the
   scanner the code ones).
2. A Brazilian player's read of the villagers' lines and Rosa's letter on a real phone.

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

### The Dry Year: M1-M4, M6 and M7 (depth lane, branches `valley/m1`, `valley/m6`, `valley/m7`)

**Now:** M1 (the letter, the first green, lines that fit the valley), M3 (the restoration pattern and the Old
Spring), M4 (channels, save v18), M6 (the Weir) and **M7 (towing and the first homecoming)** are built on M2's map
stages. Save version is **18** (the plan's one bump; M6 and M7 added none). The valley critic accepted M1-M4 at
e5f07d6 and M6 (`final-m6.md`); M7 is on `valley/m7` with the audio and art lanes' M7 branches merged in, accepted at
b2c7600.

- `valley.json` holds Rosa's letter, the first-green rule, the places (the spring, the weir) and the planned ones,
  the parts bought for gold (the sluice gate and the timber hook from Orin), the map stages, **`weir.drift`** (the
  river's lanes, snags, blocks and slip) and **`houses`** (Marls 6, Holt wing 5, Wren 5, Tobin 4). Stages: farm (`dry`,
  `waking`, `restored`), town (`dry` until the weir, `river` = the river back with the Marls' house boarded,
  `marls` = today's town.tmj once they are home), Wendhead (`dry`, `gorge`, `spring`, `restored`).
  `systems/valley.ts`: stages, conditions and asks, the first green, the restoration pattern, the HUD's valley step
  and THE VALLEY, the parts, the river's first morning, the old-save defaults.
- The Old Spring and channels (M3, M4) and the Weir (M6) as before: the spring asked on the first-green morning,
  three work days, channels of 24 tiles (64 once the weir is open); Finn's weir, 2,500g, 60 stone and the gate, four
  work days, the river home overnight under "THE RIVER IS BACK", Finn at the dock (16,32), the river's fish and the
  Derby following the water, old saves keeping their river. The weir's last work day is now a towing beat (the log
  hooked into the gap).
- **Towing (M7).** The feel lane's controller moved to `src/game/TowController.ts` and takes a course; the lab spike
  is one course (`dev/towSpike.ts`), the town river another (`game/weirTow.ts`). Rules stay in `systems/towing.ts`
  (plus `driftAlong`, the drift-snag tug, the slip settle); the queue and the river's geometry in
  `systems/drift.ts`. Each morning with the river back 1-2 logs arrive (1 in winter, at half speed), one in three long,
  three lanes by day hash, never the same twice in a row, at most 3 waiting; only the queue is saved. The `west`
  lane rests at the head and catches on the reed bed; the `middle` lane waits caught on the first spur; the `east`
  lane enters two rows down, out of every bank's reach, is turned by the second spur and rests by the mill wheel. The
  slip is (19,32), its stand (18,32). Landing gives 1 or 3 timber (5g each). The timber hook is a key item (Orin,
  250g, while the river is back); owning it lets taps and Action tow. Action's verb icons and priority rule are the
  spike's. The towing intro points at the slip.
- **Houses and Senna (M7).** The Marls' door (16,6) takes the timber you carry (Interact, or Action with timber),
  once the weir is open; the scaffolding shows by share (the art lane's `obj_house_marls_0..3`). Finished, Senna Marl
  comes home the next morning (HOME AGAIN, the homecoming cue); she is not drawn, scheduled, written to or counted
  before. Her letter comes at half. The `marls` stage opens the house, lights its windows at night (`houseLit`, once)
  and turns the mill wheel (still in Calm). Clay starts his rounds late once the weir is open, even below 2 hearts.
- **Old saves (M7):** nothing to migrate; a save from before M7 keeps everything, is given nothing, and its river (by
  play or the M6 default) starts carrying timber the next morning, with Orin's letter and the hook in his sheet.
- Scenarios: M1-M4 and M6 as listed in git history; M7: `tow-first-log`, `tow-long-log`, `tow-east-lane`,
  `tow-winter`, `tow-house-marls`, `marls-arrive`, `marls-home`, `old-save-m7`. The scenario e2e has `valley`,
  `spring`, `channels`, `weir`, `towing`, `towingLane` and `weirTow` blocks; `tests/valley-weir.test.ts` (M6) and
  `tests/weir-towing.test.ts` (M7: the queue, ten days of lanes, the lanes towed on the real geometry, the hook,
  houses, Senna's gate, old saves, the timber bound). `agents/probes/tow-spike.mjs` plays the town scenarios too
  (`SCENARIOS=tow-first-log,...`; tow-east-lane's bar is 30 s).

**Open:**

- **Verified (M7):** the full `npm run verify` passed alone (every phase, perf 1x/4x/6x within budget; onboarding
  e2e OK). The towing probe (`agents/probes/tow-spike.mjs`, i13 and SE, both hands, wait/chain/water/action, 1.5 mm
  scatter) met the critic's bar on `tow-first-log` and `tow-east-lane` in 32/32 runs at 1x and 32/32 at 4x (at most
  3 inputs on first-log, 2 on the east lane; draws at most 5; 0 silent taps, stalls or hard taps). At 4x,
  `tow-long-log` (whose bar is landing and two tugs) logged frames over 33 ms in a pass run while other lanes' verifies
  loaded the PC (see Open). In the browser: the slip by the timber stack, the caught log over the spur with its tilt,
  the house stages and Senna, the lit windows, the wheel turning (frame 0 in Calm), and each audio hook once (the four
  tow cues, the splash 173 ms after the freeing tug, `homecoming`, `window-lit` via `houseLit`, Senna's motif once a
  day, the mill bed only in the `marls` stage). No real phone.
- **M7 accepted** by the valley critic at b2c7600, with no blockers or majors (`valley-critique/review-9.md`,
  `final-m7.md`). Its own runs: verify green, onboarding 14/14 (median 163.5 s), bench:thumb OK, and the tow matrix
  16/16 per scenario at 1x and 4x, except winter at 4x (13/16 under load, 16/16 rerun). Watch items: one-off long
  frames while towing on a loaded host only; winter's game JS p95 is about 10 ms at 4x, the closest lane to the bar;
  the lab's T1 chained check flakes under parallel load; R6-2 is still open.
- The tow scenarios start on the west bank coming from the north (16,20): the river is the town's east edge, so a log
  tapped from beside or below it is in the left thumb's hard zone. In play a left-handed player tows by Action from
  below (comfort). A real-phone pass decides whether that is enough (checklist row in OPEN-FINDINGS).
- The other houses (Holt wing, Wren's cottage, Tobin's rooms) are data only until their places ship (M8-M10). The
  Seed House roof and the market's awnings (5 timber each) are M8 and M10.
- Not done: a `bench:thumb` towing row; the R6-2 channels-intro corner; the family's stall (M10).
- From the feel critic: decor drawn on top of channel water (a map/data job).

**Next:** M8 (the Seed House: the seed library, Clay's turn, Dara and the Holt wing's 5 timber), then M11.

**For art:** the M7 kit is merged (towing, the Marls' house, Senna, the mill wheel). Later houses reuse the kit
(`obj_house_<id>_0..3`, `valley.json` `houses.<id>.sprites`).

**For audio:** hooks wired as the audio lane listed: the four tow cues at the spike's moments, the splash 170 ms
after a freeing tug, the town stage `marls`, villager `senna`, `valleyMoment` with `cue: 'homecoming'`, and
`houseLit { house }` (typed in `systems/events.ts`).

**Controls:** paint rows have an edge hold (`PAINT_EDGE_HOLD_MS` 180, band `PAINT_EDGE_CSS` 36): resting at the
screen edge the row points at keeps it growing (a real-phone pass should tune both).

### Cloud save (cloud-save lane, branch `release/cloud-save`)

True now: Android cloud save through Play Games Saved Games, inert until the owner builds in a Play Games project
id (`agents/PUBLISHING.md`, "Cloud save setup (owner)"). The rules are in `systems/cloudRules.ts`, the sync in
`game/cloudSync.ts`, the providers in `platform/cloud/`, and the UI in the title, Options > Cloud save... and
`ui/panels/CloudConflictPanel.ts`. Everything runs on the fake provider in the cloud-* scenarios (unit tests in
`tests/cloud-save.test.ts` and `tests/cloud-ui.test.ts`, the `cloud` block in `e2e:scenarios`, the probe
`agents/probes/cloud-save.mjs`). The native plugin is on `release/android` and compiles, but has never run on a
device. The web build and iOS have no cloud save (DECISIONS.md, "Cloud save").

Open: a two-phone test on an internal track (step 6 of the setup); a web provider (Drive appDataFolder) if the web
build ever needs it; Game Center for iOS.

### Game depth and economy

**Now:** a full year loop with farming, quality, foraging, fishing, crafting, machines, animals, five villagers
(Mara, Finn, Rosa, Orin, Clay) with hearts and events, jobs, mail, festivals, town projects, a greenhouse, the
mine, cooking and a board race with Clay. Save version is **18**.

- **Bait (depth/bait-board):**
  - Every cast needs a bait and uses one: worms (free, dug up by the hoe and the scythe from day 3), Bait Mix (6g),
    Fish Chum (a carp and a fiber make 5) and Glow Grub (35g).
  - Each changes the bite wait and the odds (`bait` blocks in `items.json`).
  - The bait in hand casts with that bait; with the rod, the one used last goes on. After a catch, the fishing sheet's
    bottom button switches the next bait in one tap.
  - New games start with 10 worms in the bag; old saves get them once.
- **The town job board:** the morning's three jobs are posted on the town board's Jobs page (its other page is the
  requests). A job counts from Take and is turned in there; one never turned in is paid by post at night.
- **Every fund ask says where its goods come from** (an item's `source`, shown while a good is short).
- **Sims:** the tireless five-seed median is 253,873 (pin 261,631, band -20% / +25%). The fisher's year-one median is
  341k (was 378k: bait costs), under twice the pin.

**Open:**

- See OPEN-FINDINGS.md.
- The critic's acceptance (7cf1305) holds pending one merged-build pass with `polish/owner-round`: the board's rows
  under polish's text guard, the fishing result in its `sheetTaps` list, toasts over the board.
- Clay's notice wrap on the board (polish lane) and the board's new tab row both move the requests page's header:
  merge with care.
- The Action-icon bait badge was declined by the critic (the sheet names the bait), so it isn't planned.

**Next:**

1. Critique 13 on a frozen copy: the race (a careful and a careless player), long-game goal waits, the jobs on days
   3 and 4, and a busy season-change morning. Add the board's turn-in walk and a month of bait spending.
2. A crop request in the first days of summer and fall, for a crop the player planted.
3. A long-press hotbar picker, so seeds kept in the bag don't stop a one-thumb farmer. It touches `ui/Hud.ts`, so
   coordinate with the controls lane.
4. Line Clay and the race up with the Dry Year (rival to ally).
5. Bait follow-ups, if play asks for them: a bait for the river's legends once the weir opens, and Finn selling worms
   when a player has no hoe-able ground.

Things to watch: goals are an index into a list, so only append to it. `aside` goals and goal waits change which
goal shows, never the order. The race starts on day 8 (`game.rival.startDay`). Bait codes and the board's
bitmask stats (`jobs.taken`, one bit per job of the day) are save data: never reuse a bait code.

### Guided start (onboarding)

**Now:**

- Day 1 is a guided harvest, plant, water and ship, then free time, errands and a bed offer.
- Day 2 is a rain morning: the letter, the Menu and the walk to town. The Goal-tab jobs step went with the job board,
  so day 2 got shorter. The new-player critic's paired gate (ABBA, 14 configs, 28 runs each) at 7cf1305: base
  median 173.5 s, this branch 167.5 s (-6 s; gate 173).
- From day 3, one-time intros follow. New ones (bait round), one line each and one control each:
  - the job board (board, then Take) and turning a job in (the way to the board, then Turn in);
  - no bait (the hoe slot) and switching bait after a catch;
  - stone before the spring or the weir (the way to the mine, then a rock);
  - crafting (Menu, then Make) and festivals (board, then Enter).
- An intro whose target is on another map keeps its own line and leads through the real door chain (`maps.json`
  links). One already leading somewhere keeps the floor until done.
- Progress is stored in stats only (`tut.*`).

**Open:**

- The tip burst after the first purchase.
- The overlap of "+1" with the goal banner.
- With a world-target intro on and the fishing sheet open mid-fight, the coach says "Close this to carry on" over a
  sheet whose bottom button is "Reel in & leave".

**Next:**

1. Release held tips one at a time, at most one per in-game hour (`systems/goals.ts`).
2. Rewrite the guided start for the Dry Year opening (Rosa's letter, arriving at a fading farm). It is data in
   `src/data/tutorial.json` (`docs/EXTENDING.md` section 10).
3. Run the paired gate (base vs branch, ABBA) for any change to day 1 or 2: the median must stay within 5 s of base
   and under 173 s.

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

**Now (branch `audio/m7`, from `integration/dry-year-2`):** composed music on CC0 samples, recorded CC0 effects and
ambience with a synth fallback for each cue. The owner listened and approved the direction. The Dry Year round
(audio by map stage, the `green` jingle, the creek and river beds, the dig cue) is described in `DECISIONS.md`, "The
Dry Year, audio". M7 adds, in the same direction:

- **Tow cues:** `logHook` (the hook bites wood) and `logTug` (rope rustle, a creak pitched down, a wooden shift) are
  new. `logKnock` (wood on stone in water) and `logLand` (a heavy log on timber, a little water) are rebuilt with a
  wooden crack, so 40 % or more of a single hit is above 400 Hz and a phone speaker plays it. Levels: hook -22.9 M,
  tug -21.4, knock -21.8, land -20.2. Every take peaks at -4.6 dBTP or lower at the output (recipe `tpOut`, unit
  test). The tug is 300 ms long and never repeat-ducked: `audio-src/tools/tow-cues.mjs` plays the tow scenarios and
  found the quickest second tug 277 ms after the first.
- **Cues under cues** (`softAfter`, `softFor` in a recipe): the water a wet channel cut lets in plays 9 dB under the
  cut, and the splash of a log freed by a tug plays 6 dB under the tug. Watering alone has a 0.5 s repeat window
  (-4 dB). A wet dig row is now -20.6 LUFS (the dry row is -20.8), and the full tow peaks at -18.4 M.
- **Senna:** `motif-senna` and `-heart` (a triplet arc on vibes over a turning pizz) play through the existing
  `talkTo` / `heartUp` wiring. The `homecoming` jingle (priority 4, 3.6 s) plays on her arrival banner. The
  `window-lit` sting plays on `houseLit` and spends that evening's dusk flourish.
- **The mill wheel:** the `mill` bed (`gen_beds.py mill()`, self-made from CC0 splashes, creaks and a knock, with a
  recorded spill layer; 120 KB). It is positional at x 21-22, y 30-31 (full within 1.5 tiles, silent 9.5 tiles
  out), and it plays only on the town's `marls` stage (`src/audio/stages.json`).
- **Fall rain:** the rainy fall arrangement gets its own level (`rainDb` 0.8), -31.7 LUFS alone (it was -35.0).
- **Tools:** `render.ts` starts cues at their exact time (repeat windows used to see tick-rounded gaps); `render.mjs`
  has the `m7-*` jobs; `build.py` has a per-part `lp`, per-layer `correlated` and per-cue `tpOut`. Tests:
  `tests/audio-m7.test.ts`.

**Audio hooks the M7 builder must call (exact names; audio does nothing until they exist):**

| Hook                                                           | Where                                                                                           | Plays                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `audio.play('logHook' \| 'logTug' \| 'logKnock' \| 'logLand')` | the towing controller, at the same moments as `towSpike`: catch, each tug, first snag, `T.drop` | the tow cues (towSpike falls back to `swing` / `till` while an id is missing) |
| `audio.play('water')` 150-250 ms after a freeing tug           | the towing controller                                                                           | the splash, 6 dB under the tug                                                |
| town stage variant `marls` (`valleyStage`)                     | `src/data/valley.json`                                                                          | the river plus the mill wheel                                                 |
| villager id `senna`                                            | `src/data/npcs.json`                                                                            | `motif-senna` on the first talk of the day, `-heart` at a new heart           |
| `valleyMoment` with `cue: 'homecoming'`                        | the arrival banner (`Hud` plays `m.cue ?? 'green'`)                                             | the homecoming jingle                                                         |
| `gameEvents.emit('houseLit', { house })` once per house        | the lights system                                                                               | `window-lit`, and no dusk flourish that evening                               |

`houseLit` is listened to by name with a loose cast in `src/game/audioWiring.ts`, because `events.ts` belongs to the
builder. After the merge, type it (`gameEvents.on('houseLit', ...)`) so a renamed event fails the typecheck.

**Verified:** `verify:fast` green at each commit. The critic's full `verify`, run alone at 6b56f04 (code-identical
to 0e6cb95): VERIFY OK, perf 1x/4x/6x inside budget, and `e2e:scenarios` flaky once (feel's chained T1 tow tap,
passed alone). My own full run overlapped the critic's, so its perf 4x/6x failures were load; `npm run perf` rerun
at 0e6cb95 is inside budget. Unit tests 1308/1308. The critic accepted the round with all findings closed
(`audio-critique/review-13.md` to `review-15.md`, `final-m7.md`). Renders and `LISTEN.md` are in
`C:/Users/andre/dev/tiny-acre/audio-renders/m7/`. **Not verified:** no
real phone; the builder's events (above) do not exist on this branch, so the arrival, the lit window and the mill
were checked only in renders and unit tests.

**Open:**

1. Wendhead's gorge rect for a positional river (the M6 builder will send it).
2. After the M7 merge: play `marls-arrive`, `tow-first-log` and the town at `marls` in the browser and check that each
   hook fires once (the table above).
3. M10's market murmur (A4).

How to rebuild: `python -I audio-src/tools/fetch.py <raw-dir> --lock` (extracts from the cached archives in
`<raw-dir>/_archives`), `python -I audio-src/tools/build.py <raw-dir>` (raw sources in
`C:/Users/andre/dev/tiny-acre/audio-raw/samples`), `python -I audio-src/tools/music_src.py` for the music, then
`npx prettier --write src/audio/manifest.json src/audio/music.json` and `python -I audio-src/tools/sources_md.py`.
Measure with `render.mjs`, `measure.py`, `sfxlevels.py` and `seasons.py`; check cue timing in play with
`tow-cues.mjs`. Details are in `docs/EXTENDING.md` section 9.

## Needs the owner

- **Play it on a real phone, one-handed, as a first-time player.** Use the merged checklist in
  [OPEN-FINDINGS.md](OPEN-FINDINGS.md).
- **Listen** to the audio.
- **Decide:** Clay's catch-up crates, goals that step aside after 3 quiet days, the paint step, and bigger building
  footprints.
- **Licensing before any store release:** check Google's terms for the Flow images again (see `ASSETS.md`).
- **Cloud save:** create the Play Games Services project and OAuth clients, build in the project id and test on two
  phones (`agents/PUBLISHING.md`, "Cloud save setup (owner)").
- **Portuguese naming choices** in `src/i18n/GLOSSARY.md` (gold as "o", the Heron, the Weir, the sheep shed).

## Funnel analytics (release lane, release/analytics, 2026-10-12)

- **True now**: a provider-agnostic layer (`src/platform/analytics/`: closed event schema, random install and
  session ids, batching, offline queue, consent) wired by `src/game/analyticsWiring.ts`. Off by default (no config:
  nothing starts). Dev provider for `npm run dev` and `?debug&analytics=dev` (DEV tab > Analytics). Firebase adapter
  for Android behind `VITE_ANALYTICS=firebase`, no npm dependency until the owner activates it (steps, Data safety
  rows, privacy text and how to read the funnel, D1/D7/D30 and day of churn: agents/PUBLISHING.md, last section).
  Consent on the title (production only), opt-out in Menu > Opts > Share stats; the policy page is `public/privacy.html`. Scenarios `analytics-consent` and
  `analytics-first-harvest`; `npm run e2e:analytics`; e2e:onboarding checks the tutorial funnel.
- **Not verified**: the Firebase adapter on a real phone (no google-services.json, no device here); the plugin's
  consent constants are from its 8.x docs and unit-tested only against a fake plugin.
- **Next**: once the owner has a Firebase project, run the on-device check in PUBLISHING.md (DebugView), register
  the custom dimensions (`index`, `id`, `skipped`, `game_day`, `install_day`), and build the funnel exploration. New events go
  in `SCHEMA` first (the validator refuses anything else), then the wiring, then a line in the Data safety table if
  it is a new kind of data.
