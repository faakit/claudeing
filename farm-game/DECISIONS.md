# Decisions

## Index by area

> **Direction:** [docs/VISION.md](docs/VISION.md) (The Dry Year) supersedes the early direction decisions here:
> the original MVP goal (the removed `GOAL.md`) and the first sessions' framing. Paths under `agents/critiques/`,
> `agents/out/` and `agents/PLAN-CONTROLS.md` point at files removed in the docs cleanup; see
> [agents/HISTORY.md](agents/HISTORY.md) to read them from git.

This log is append-only: each round adds sections at the end. Sections added after 2026-10-11 are not in this
index yet.

- **Foundations and early milestones:** [M0](#m0), [M1](#m1), [M2-M6 + polish (playable MVP)](#m2-m6--polish-playable-mvp), [Weather, balance, QA](#weather-balance-qa), [Code-review pass](#code-review-pass), [M8 phone hardening](#m8-phone-hardening), [Portrait pivot and mechanics layer](#portrait-pivot-and-mechanics-layer), [Bug fixes from a real phone](#bug-fixes-from-a-real-phone).
- **Economy, balance and the sim:** [Balance, onboarding and accessibility pass](#balance-onboarding-and-accessibility-pass), [Simulation fidelity (backlog 8)](#simulation-fidelity-backlog-8), [A human-paced sim (critique 5, F9: "no clock")](#a-human-paced-sim-critique-5-f9-no-clock), [Sim fidelity: a fisher (round 3)](#sim-fidelity-a-fisher-round-3), [Jobs are a nudge, not a living (owner's call, depth round 2)](#jobs-are-a-nudge-not-a-living-owners-call-depth-round-2), [The first week and the goal chain (owner defaults, depth round 4)](#the-first-week-and-the-goal-chain-owner-defaults-depth-round-4), [Eating: three dishes a day at full strength (owner default, round 3)](#eating-three-dishes-a-day-at-full-strength-owner-default-round-3).
- **Farming, gathering and making:** [Tool upgrades and land plots](#tool-upgrades-and-land-plots), [Machines, swipe tools and robustness](#machines-swipe-tools-and-robustness), [Trees, sheep, goal arrow, seasonal sound](#trees-sheep-goal-arrow-seasonal-sound), [Forecast, storms and the Book](#forecast-storms-and-the-book), [The mine](#the-mine), [Greenhouse (R2.3)](#greenhouse-r23), [Animal depth: pigs and the feed silo (R2.6)](#animal-depth-pigs-and-the-feed-silo-r26), [Animal goods on the board (depth round 2)](#animal-goods-on-the-board-depth-round-2), [A kitchen and cooking (brief backlog 1: house upgrades)](#a-kitchen-and-cooking-brief-backlog-1-house-upgrades), [Legendary fish (fishing mastery)](#legendary-fish-fishing-mastery), [The traveling cart, x5 cooking, a legend warning](#the-traveling-cart-x5-cooking-a-legend-warning), [Second-year content: rare crops and mastery goals (backlog 9)](#second-year-content-rare-crops-and-mastery-goals-backlog-9), [Special orders (backlog 9)](#special-orders-backlog-9).
- **Villagers, Clay and the town:** [Animals and villagers](#animals-and-villagers), [Schedules, birthdays and the blacksmith](#schedules-birthdays-and-the-blacksmith), [Heart events](#heart-events), [Daily jobs (critique 3, F2 pacing)](#daily-jobs-critique-3-f2-pacing), [Mailbox (R3.6)](#mailbox-r36), [The rival farmer (R3.2)](#the-rival-farmer-r32), [Clay in year two (depth round 2)](#clay-in-year-two-depth-round-2), [Town projects (gold sink, late game)](#town-projects-gold-sink-late-game), [A repeatable late-game sink: the Founder's Statue (depth round 2)](#a-repeatable-late-game-sink-the-founders-statue-depth-round-2), [Home upgrades and decorations](#home-upgrades-and-decorations), [Decorations with a small use (owner's call, depth round 2)](#decorations-with-a-small-use-owners-call-depth-round-2), [Moving buildings, quieter land signs, easier forage (backlog 7, critique 3 F8/F9)](#moving-buildings-quieter-land-signs-easier-forage-backlog-7-critique-3-f8f9), [Trophies at home (round 3)](#trophies-at-home-round-3), [Festivals](#festivals), [Festival minigames (backlog 6)](#festival-minigames-backlog-6), [The Flower Show is an arrangement (handover goal 6, depth round 2)](#the-flower-show-is-an-arrangement-handover-goal-6-depth-round-2).
- **Critique fixes (game depth):** [Changes from the first independent critique](#changes-from-the-first-independent-critique), [Critique 2 fixes (swipe, pickup, hotbar, sprinklers)](#critique-2-fixes-swipe-pickup-hotbar-sprinklers), [Critique 3 fixes](#critique-3-fixes), [One-thumb conveniences (critique 3)](#one-thumb-conveniences-critique-3), [Critique 4 fixes](#critique-4-fixes), [Critique 5 fixes (depth round 2)](#critique-5-fixes-depth-round-2), [Critique 6 fixes (depth round 2)](#critique-6-fixes-depth-round-2), [Critique 7 fixes (depth round 2)](#critique-7-fixes-depth-round-2), [Critique 8 fixes (depth round 2)](#critique-8-fixes-depth-round-2), [Critique 9 fixes (depth round 3)](#critique-9-fixes-depth-round-3), [Critique 10 fixes (depth round 3)](#critique-10-fixes-depth-round-3), [Critique 11 fixes (depth round 3)](#critique-11-fixes-depth-round-3), [Critique 12 fixes (depth round 4)](#critique-12-fixes-depth-round-4).
- **One-thumb controls:** [One-thumb controls (milestones M1-M7)](#one-thumb-controls-plan-controlsmd-owner-decisions-2026-10-08), [Owner rulings after controls review 2 (2026-10-09)](#owner-rulings-after-controls-review-2-2026-10-09), [Coordinator ruling after reviews 3 and 4 (2026-10-09): painting moves to Action](#coordinator-ruling-after-reviews-3-and-4-2026-10-09-painting-moves-to-action), [Round 3 owner decisions (2026-10-09, controls round 3)](#round-3-owner-decisions-2026-10-09-controls-round-3).
- **Guided start:** [Guided start (onboarding agent, 2026-10-09)](#guided-start-onboarding-agent-2026-10-09), [Guided start, round 2 (onboarding agent, 2026-10-10)](#guided-start-round-2-onboarding-agent-2026-10-10).
- **Art:** [Art pipeline (art agent, 2026-10-08)](#art-pipeline-art-agent-2026-10-08), [Maps pass (art agent, round 2)](#maps-pass-art-agent-round-2).
- **Audio:** [Real audio](#real-audio).
- **Game feel:** [Juice (R1.4 leftovers)](#juice-r14-leftovers), [Game feel (feel agent, round 4, branch feel/smooth)](#game-feel-feel-agent-round-4-branch-feelsmooth), [Whole-pixel canvas scale (coordinator ruling, round 4)](#whole-pixel-canvas-scale-coordinator-ruling-round-4).
- **Dev tools:** [Sandbox workflow and dev tools (devtools agent, 2026-10-10)](#sandbox-workflow-and-dev-tools-devtools-agent-2026-10-10).

## M0

- **Phaser 3.90.0, not 4.x:** the plan specifies Phaser 3; npm `latest` is now 4, so 3 is pinned explicitly.
- **TypeScript 6.0.3, not 7:** typescript-eslint 8.71 supports TS `<6.1` only.
- **Folder `farm-game/` inside the `claudeing` repo:** the repo already holds an unrelated app at its root, so the game is isolated in a subfolder.
- **Tileset generated at runtime, no PNG yet:** a canvas texture is built in `PreloadScene`; `farm.tmj` references `placeholder.png` only as a Tiled-editor hint and Phaser ignores it. No 1px extrusion until real art in M7.
- **Farm map built by `scripts/generate-farm-map.mjs`:** produces valid `.tmj` that stays editable in Tiled afterward; `collision` layer is hidden and unused until M1.
- **M0 camera is static, zoomed to fit the 40x30 map:** movement and follow camera belong to M1.
- **`GameState` stub added in M0:** keeps state serializable from the start, as the plan requires.

## M1

- **Player position = feet-center in map px; hitbox is 10x6 at the feet:** keeps the sprite's head free to overlap walls (top-down depth) while collision stays tile-friendly.
- **Axis-separated collision with snap-to-edge, plus a 4px corner assist:** gives flush stops and lets a 10px hitbox slide into a 16px doorway without pixel-perfect alignment.
- **Doors trigger on walking onto the door tile; Interact is for objects (bed, bin):** matches the genre; a door tile is walkable, interactables are solid so the player stands beside them.
- **Input is locked after a door until the held direction is released once:** otherwise holding "up" through a door bounces the player straight back out.
- **Door spawn tiles must be walkable and must not be door tiles:** enforced by `tests/maps.test.ts` so map edits can't create loops.
- **Joystick direction uses axis hysteresis (1.25x):** prevents flicker when the thumb sits near a diagonal. Dragging past the rim drags the stick along.
- **Joystick appears only once the thumb passes the deadzone:** short taps (tap-to-use-tool) stay visually clean.
- **Touch buttons are always visible, even on desktop:** simplest, and makes the 844x390 touch check possible anywhere. Revisit with the settings screen.
- **No UI text in M1:** the 480x270 canvas can't render small text crisply; buttons use drawn icons until the bitmap pixel font arrives in M7.
- **Interact button icon is chosen by the target's object type (bed icon, otherwise a generic hand):** adding an object type means adding one icon entry.
- **Map layout lives in Tiled `.tmj` (`ground`, `collision`, `objects` layers); the transient `GameState.player` stores map id + px position:** teleporting through a door is just a state change, then a scene start.
- **`STATE_VERSION` stays at 1:** no saves exist yet; migrations start when SaveSystem lands in M6.

## M2-M6 + polish (playable MVP)

- **Game name "Tiny Acre":** original title; no Stardew names or assets.
- **Logical resolution stays 480x270 with 16px tiles:** decided in M1; UI text uses a hand-built 5x7 pixel font (9-row cell for descenders) generated at boot, so it is crisp at any integer-ish scale.
- **All balance and content in JSON (`items/crops/shops/tools/goals/game/maps`), cross-validated at load and by tests:** a typo fails at startup, not mid-game.
- **Time never reads the wall clock:** `tickTime` is fed capped frame deltas (100ms max) and is simply not called while any panel is open or a flow is running; a backgrounded tab cannot skip hours.
- **Rollover order: crops grow, shipments paid, calendar advances, season-change withering, weeds, energy restore, then autosave:** matches the plan; passed-out nights restore 50% and do not count as "slept in bed".
- **Harvesting always wins over the equipped item:** pressing Action on a mature crop harvests, so players never need to swap tools to collect.
- **Weeds give fiber (2g) and only sprout inside a Tiled `weedzone` object:** gives the scythe a purpose without cluttering the whole farm.
- **Goals are absolute lifetime stats, not "since this goal started":** early play is never wasted; completed goals cascade and pay out together.
- **Shop sells upgrades (can capacity, stamina) as the gold sink:** gives money meaning beyond seeds; prices live in `shops.json`.
- **Fall crops added (pumpkin, yam), winter has no crops:** data-only; keeps seasons 3 and 4 playable without new code.
- **Save = one JSON blob, `version` 2, migration table, backup promoted only if it still loads:** a corrupt main save can never destroy the last good backup. v1 (M1 shape) migrates.
- **Storage: IndexedDB, then localStorage, then memory:** blocked storage (private windows, sandboxed frames) degrades to "no persistence" instead of crashing.
- **Audio is fully procedural (Web Audio):** zero files, instant load; music crossfades day/night by clock. Replaced by real assets in M7.
- **Action repeats while held, but stops after a failure until released:** fast row-work without buzzer spam.
- **A swing roots the player ~200ms:** tools feel weighty; failures root slightly longer.
- **Tint overlays (multiply) for day/night (UI scene) and season (world):** placeholders for the real seasonal tilesets.
- **Shopkeeper NPC is decorative with a greeting:** real NPCs, dialogue and gifts are backlog.
- **Hosting:** the existing Pages workflow now also builds the game and publishes it at `/farm/` beside the existing app; a separate gh-pages workflow would have conflicted with Actions-based Pages.
- **Debug hook `window.__farm`:** exposes state/events/input for automated playtests; read-mostly, harmless in production.

## Weather, balance, QA

- **Weather = sunny/rain only; rain waters every tilled tile on wake-up:** gives a relaxed rhythm break; days 1-2 of a new game are always sunny; winter never rains (snow is backlog). Chance per season lives in `game.json`.
- **Balance is checked by a simulation (`tests/sim.test.ts`):** a tireless greedy bot plays a full year through the real rules. It earns ~40-100k, so ranks are set well above casual play (Green Thumb 4k, Farm Hero 12k, Harvest Legend 25k) and upgrade tracks are deep (stamina x5, can x3) to keep gold meaningful late.
- **Rollover re-entrancy guard:** a second sleep request while one is running is ignored, so a day can never be counted twice.
- **Layout bugs found by screenshot audit and fixed:** goal tracker counter overlapping long goal text, wrapped goal lines overlapping on the Goals tab, bin pager colliding with the 7th row (now 6 rows per page).

## Code-review pass

- **Farm actions are refused off the farm map (`TileInfo.farmland`):** soil, crops and weeds are keyed by tile only, so before this the town or house could harvest or water invisible farm tiles at matching coordinates.
- **Saves are queued, not coalesced; `saveNow` resolves true only if data reached persistent storage:** UI never claims "Saved!" for a memory-only or failed write, and Quit offers "Quit anyway?" instead of silently discarding a session.
- **Loads are sanitised, not just validated:** deep defaults, unknown items/crops dropped, numbers clamped, tools restored. One bad nested field can no longer crash the HUD.
- **TouchButton only releases what it pressed:** a mouse crossing the on-screen Action button no longer cancels a held Space.
- **Clock warnings derive from `dayEndMinutes`; a test pins the daylight keyframes to the day length.**
- **Enter confirms the primary button of the open dialog (and the title):** keyboard accessibility, and robust tests without pixel clicks.
- **Scenes mutate nothing directly:** facing and volume/mute moved into tested system functions.
- **Structure:** panels split one-per-file; `TileHighlight` and `actionFx` extracted from `WorldScene`; shared `mixColor`.
- **`window.__farm` only with `?debug` (or dev builds).**
- **Pages workflow no longer deploys the work-in-progress branch to production;** run it manually (workflow_dispatch) or merge to main.
- **Phaser in its own chunk:** the game chunk is ~98 kB, so updates re-download little.

## M8 phone hardening

- **Safe areas live on an outer frame, not on the Phaser parent:** Phaser sizes the canvas from the parent's border box and ignores its padding, so notches were covered. An e2e with injected `safe-area-inset-*` caught it.
- **Touch targets are sized from the real on-screen scale:** hit areas grow to 44 CSS px but never past neighbouring controls. Interact moved above Action and hotbar slots grew to 34px so even a notched iPhone measures >= 46 CSS px.
- **Performance budgets instead of FPS targets:** headless software GL cannot predict a phone's FPS, but GL draw calls and JS ms per frame are hardware-independent. Measured 2-3 draws and ~1.3-1.8 ms/frame with a full field; `npm run perf` fails if that regresses (<= 12 draws, <= 3.5 ms).
- **No-op overlays are skipped (white multiply tints):** a white tint still costs a full-screen blend (5 -> 2-3 draws/frame).
- **One lifecycle (`platform/lifecycle.ts`) fed by `visibilitychange`/`pagehide` on the web and Capacitor app state natively:** the game freezes clock/input/audio and autosaves identically everywhere. `pause` is idempotent (iOS fires both events).
- **Android back is routed into the game:** closes dialogs, then opens the menu; only the title screen exits the app.
- **Audio unlock on every gesture type, plus a silent-buffer prime and interruption handling:** older iOS only counts touchend/click; phone calls leave the context suspended until the next tap.
- **PWA via a hand-rolled, build-generated service worker (cache-first, content-hash versioned, precaches everything):** ~40 lines, no dependency, verified offline in a real browser. Not registered in the native apps (a stale cache could shadow an app update).
- **Native saves use Capacitor Preferences, not IndexedDB:** the OS can evict WebView storage; Preferences is durable and in Android auto-backup.
- **Vibration is a saved setting (default on):** native haptic engine in the apps, `navigator.vibrate` on Android web, nothing on iOS web.
- **Screen stays awake in the Android app; iOS plays audio regardless of the silent switch:** both small native changes that could not be compiled here (documented in docs/MOBILE.md).
- **App id `app.tinyacre.farm` is a placeholder to be changed before the first store listing** (procedure in docs/MOBILE.md).
- **Not done / needs a device:** the native projects were generated and synced but not compiled (no Android SDK or Xcode in the sandbox; `dl.google.com` is blocked), and real-phone FPS, audio interruptions and haptics feel are on the manual checklist.

## Portrait pivot and mechanics layer

- **Mobile-only, portrait, one hand:** logical canvas 200x400 (1:2) scaled to fit; about 12 tiles across. The world has its own camera viewport between a read-only HUD and a control dock, so no button ever hides the map. Joystick floats anywhere in the lower screen; Action is the biggest target in the thumb corner; Menu sits far from it to avoid accidental taps; all dialogs are bottom sheets; left-handed mode mirrors the dock.
- **Smart targeting instead of precise aiming:** Action asks the faced tile and its two neighbours and takes the highest-priority plan (pick up/harvest > plant > till). Planning is separate from running so this costs nothing.
- **Registries instead of a bigger core:** action handlers, tool actions, day hooks (phased pipeline), placeable behaviors, menu tabs and perks are registries; each mechanic is one module plus one import line. Proof tests add a tool, handler, hook and behavior without touching core files. How-to: docs/EXTENDING.md.
- **Stack identity is `{item, quality, of}`:** quality tiers and derived goods (jam made of tomato) are first-class, so shipping, orders and pricing key on the stack key. Old saves migrate (v1/v2 -> v3, inserting the fishing rod slot).
- **Skills and perks are data:** perk keys are free strings read by systems (`perk(state, key)`) and granted in skills.json, so a new perk is a JSON row plus one read.
- **Foraging:** daily spawns inside map "forage" zones, capped per map, cleared at season change; picking up works with any item equipped. Wild goods feed crafting, orders and the jar.
- **Fishing is a one-thumb mini-game:** wait, tap on the bite (generous 1.5 s window), then hold to lift a bar onto a darting fish. Pure reel model with injected randomness so tests are exact; wider zone with fishing level and bait; perfect fights roll better quality.
- **Orders are priced from sell value with a 1.35-1.9x premium and tiered quantities;** better quality earns up to 15% per tier extra. They are generated by a morning day hook from what the season and the player's unlocks allow.
- **Balance note:** adding quality and a changed random stream moved the bot's full-year income lower bound from 20k to 15k; the band is still checked against a runaway upper bound.

## Animals and villagers

- **Animal houses are placeables with a generic behavior:** coop and barn share `animalHouse`; species come from `animals.json`. State lives in the object's `data`, so saves need no migration for it, and it is repaired on read.
- **One tap does all the chores:** Interact moves animals in, collects, then feeds. Daily care costs one tap and a few seconds, which fits one-handed play. Skipping a day costs happiness (quality), not the animals.
- **Villagers are data with a shared panel; one chat per day happens automatically on opening it:** no extra "Chat" tap. A bobbing "!" marks anyone not yet greeted, which is the daily pull. Dialogue lines are deterministic per day (no random-stream use) so the same villager says the same thing all day.
- **Friendship perks reuse the perk system:** hearts grant perk keys exactly like skill levels (shop discount, fishing zone, quality), so adding a perk to a villager is JSON only. Discounts are capped at 30%.
- **Favourites are discoverable:** a villager's loved items are revealed at 3 hearts; before that you learn by trial (loves +80, likes +45, neutral +15, dislikes -20; one gift a day).
- **Shop sheet got tabs (Seeds / Animals / Upgrades)** so it never overflows the portrait screen as stock grows.
- **Save version 4** adds `friends`; v3 saves migrate by adding it.
- **Not done:** villager schedules (they stand at one spot), a cow and chicken that walk across the farm (they mill about their house), and animal death or illness by design.

## Bug fixes from a real phone

- **Morning summary overlapped:** wrapped lines were placed at fixed y steps. The sheet now lays out top to bottom using each label's real height, measures once, then draws at the measured height. Rule: never place wrapped text at a fixed y.
- **Villager sheet flashed shut on a tap:** buttons act on press, so the sheet opened under the finger and the release landed on the dim backdrop, which counted as "tap outside". Backdrops now only dismiss when the press also began on them. An e2e check presses and releases the real Interact button.

## Balance, onboarding and accessibility pass

- **Fishing and foraging were runaway money (up to ~2700 and ~500 gold a day):** fish now sell for 25 to 100, forage 20 to 45, the rod costs 5 energy and spawns per day are 2/3/6. Rule encoded in `tests/balance.test.ts`: no side activity may pay more per energy than the best crop; animals pay back in 8 to 42 days; preserves multiply price by 1.3 to 3.2.
- **Hints, not hand-holding:** each goal carries a one-line hint (Goals tab, plus a toast after 40 s idle, at most every 90 s). First-time tips are data (`tips.json`), keyed to stats, stored as `tip.<id>` stats so they are saved with no new state, and show one at a time.
- **Quality reads by count as well as colour:** silver is one star, gold two. "Calm" mode removes shaking and ambient bobbing; it applies to newly drawn scenes.

## Tool upgrades and land plots

- **The real constraint on farming is energy, not tiles:** the old farm let you till any grass, so more land alone would be meaningless. Land is now sold in plots (`plots.json`): a 32-tile home plot is free; five more cost 700 to 2600 gold and each has a "for sale" sign. Tilling outside owned plots is refused with a reason; placing coops and sprinklers is still allowed on any open ground.
- **Area tools make energy go further:** a hoe tier tills a line of 1 to 4 tiles for one use, the can tier waters a line (spending water per tile), so upgrades are efficiency, which suits one-thumb play. The can's capacity upgrade and line length share one level so there is a single can to understand.
- **Area tools stay pure through `TileInfo.at()`:** scenes supply a neighbour lookup, unit tests that do not give one still behave as single-tile tools. `TileInfo.owned` is optional: undefined means "no land rules", so other maps and old tests are unaffected.
- **Save version 5:** old saves keep every plot where they already had soil or objects, so nobody loses land.

## Changes from the first independent critique

- **Critic agent:** a separate agent ran a clean copy of the game, scored it on fun, reach, clarity, economy, bugs, polish and code risk, and wrote `agents/critiques/critique-1.md`. We triaged it into the roadmap rather than taking it as orders; items fixed are ticked there.
- **Produce no longer lands on the hotbar:** items are placed by type. Seeds, fertilizer, bait, machines, feed and animals prefer hotbar slots; everything else prefers the bag, and each overflows into the other region.
- **Year-end moved to Winter 28:** the plan said Summer 28, but with four seasons that read as the end of the game. Tests and copy were updated.
- **Winter crop added (kale):** the cheapest way to make the cold season playable before the greenhouse exists.
- **Economy numbers tuned, not capped:** jam 1.5x and pickles 1.3x of the source, orders 1.2 to 1.6x with a 1,200 gold ceiling, jars max 6 and houses max 2 each. The simulation still models crops only, which is a known gap on the roadmap.

## Machines, swipe tools and robustness

- **Machines are data:** `machines.json` replaced the hard-coded jar table, so the keg (fruit -> wine) is a data row plus art. Order candidates, the picker and the balance guard rails all read the same table. A behavior can report `status()` so renderers need no per-machine code.
- **Bee house has no input on purpose:** one honey every 4 days, up to 3 waiting, max 5 houses. It is the low-effort, low-income machine that rewards players who just walk past; it cannot outgrow the economy (guarded by test).
- **Swipe on Action to change tool:** vertical travel of 14 logical px per step, up for next, down for previous; the swipe releases the held action first so it never works a tile by accident. A one-time tip teaches it after two tilled tiles.
- **Never lose progress we cannot read:** a save from a newer version is detected, explained on the title screen and protected behind the Erase confirmation.
- **A bad saved position is repaired on load** by moving the player to the nearest open tile, instead of validating against maps at save time (the save layer does not know map sizes).
- **Fiber is for sale (5 gold):** weeds were the only source, so building was capped by luck; now it is also a modest gold sink.

## Trees, sheep, goal arrow, seasonal sound

- **Fruit trees are placeables with a time component:** a sapling item grows for ten mornings (shown as a sapling sprite via a new `sprite()` behavior hook), then bears one fruit every third morning in its own season, at most 4 waiting, 3 per kind. One tree kind per season gives every season an orchard task; income per season is bounded by a balance test and the sapling pays back inside a season.
- **Greenhouse deferred:** soil is keyed by tile only, so a second farmland map would collide with the farm. It needs per-map soil first.
- **Sheep follow the animal-house pattern:** a shed (species sheep), fodder, wool, and a loom as one more row in `machines.json` (wool -> cloth). A daily pat raises happiness once per day, so a fed house still has something to do for the player.
- **The goal arrow is data (`where` per map):** after 14 s without input it floats over the target when visible, or sits at the screen edge pointing toward it. Any input hides it, so it never nags an active player.
- **Seasons sound different:** tempo, key and melody density per season, with minor chords in fall and winter. New cues for level-up, heart gain and finished orders.
- **Soil is turned earth, not planks:** broken wavy furrows and clods, soft corners so tiles blend into one field.
- **Shop paging:** five rows per page with a pager, since the Farm tab grew past one screen.

## Forecast, storms and the Book

- **A forecast makes weather a decision, not a coin flip:** tomorrow's weather is rolled the morning before and shown on the bed sheet and the morning summary ("Tomorrow: rain. No watering needed"). Storms only exist in summer and fall, are rarer than rain, and trade a risk (ripe tree fruit is shaken off) for rewards (wet-weather fish bite 3x as often, a rainbow morning doubles wild goods). Save version 6 adds `forecast`.
- **The almanac costs no new state:** discoveries are `got.<item>` stats set by `addItem` the first time you hold something, finished pages are `page.<id>` stats. Pages are data (`collections.json`) and finishing one pays gold once. Items you held before this update are discovered the next time you pick one up.
- **Menu tab labels shortened (Goal, Make, Skill, Book) and tested for fit:** six tabs share the sheet width; a pure `tabLabels.ts` lets a test prove every label fits its button.

## Schedules, birthdays and the blacksmith

- **Schedules are data and teleport-simple:** each villager lists "from this minute, be here" entries; `away` means at home and unreachable. The scene checks once per game minute, fades them in, and blocks their tile. A villager never steps onto the player's tile; they wait a minute and retry. Early morning and late evening mostly empty the world, which rewards exploring in the day.
- **Birthdays are loud:** a morning note, a special line, double chat points and triple points for a liked gift. One per villager per year.
- **Orin's perk is a tool discount, not a new shop:** friendship lowers hoe, can and rod upgrade prices by up to 15%; the stamina tonic is exempt so energy cannot be bought cheaper than designed.

## The mine

- **Ore is a node system modelled on forage:** `nodes.json` kinds (rock, copper, iron, crystal) spawn each morning on the mine's open floor up to a cap, stay until broken, and block their tile. Richer kinds wait for Mining levels, so early mining is rocks and copper and the cave gets better as you level.
- **The pickaxe is a real tool slot, not an item:** the hotbar is where thumbs live, and a tool you swipe to (existing swipe gesture) beats a menu. Save version 7 inserts it as the fifth tool and shifts the rest of the bag, exactly like the fishing rod did.
- **Mining is a side trip by design:** about 18 gold per energy at best against 50+ for a good crop (guarded by a test). Its real value is bars, which unlock tool tiers.
- **Bars gate tool tiers:** hoe, rod and the can's upper tiers need 2 to 3 copper or iron bars on top of gold. The upgrade price discount from Orin still applies to gold only.
- **The furnace is one more row in `machines.json`:** same behavior as the jar and keg, with ore families (`copper`, `iron`) mapped to bars.
- **A node blocks until broken, and other tools are told why:** facing a vein with the hoe says "Break it with the pickaxe (swipe the Action button to switch)" instead of a generic refusal.

## Festivals

- **One entry, ranked on the spot:** a festival is a shared goal on a fixed date, so it is a single decision (which of your goods to enter), not a minigame. The score is the item's sell value, so quality and rarity matter and a Gold pumpkin beats a pile of parsnips.
- **Rivals are data and grow 20% a year:** three scores per festival, nudged deterministically by year so no two years feel the same without touching the random stream. Prizes grow 25% a year too.
- **The entry point is the town board** (a gold banner button on festival days) and the morning notes announce the day, so nobody misses it and there is no new building or map.

## Heart events

- **Short scenes, one tap each:** at 2, 4 and 5 hearts a villager has a three-line scene (shown a line at a time with Next) that plays the next time you open their sheet and ends in a reward (items or gold). It is the narrative payoff for the daily chat habit and costs about ten seconds.
- **Never lose a reward:** if the bag cannot hold the item the scene waits ("Make room in your bag first") and is not marked seen.
- **No new state:** seen events are `event.<npc>.<id>` stats.

## Critique 2 fixes (swipe, pickup, hotbar, sprinklers)

- Action button: a press acts after 110 ms of holding, a quick tap acts once on release, a swipe changes tool and never acts.
- Any placeable whose interaction is a plain status message can be picked up with a second tap (`armedPick`); behaviors opt out with `canPickUp` (fruit trees, busy machines, occupied houses).
- Hotbar-first items are seeds, saplings, fertilizer and placeables; bait, feed and animals go to the bag.
- Placeables may replace empty tilled soil (the soil tile is removed), but not a growing crop.
- Bag grid sits at the bottom of the menu sheet, within thumb reach.

## Critique 3 fixes

- Empty machines get a "Pick up" button in their panel (the second-tap rule can never arm when Interact opens a panel).
- Animals have no x5 buy button (one tap used to buy 1,750g of chickens).
- List rows abbreviate (`fitRow`: "(have 4)" to "x4", "Makes" to ">", Silver/Gold to Si./Au.) before cutting with "..".
- A finger drifting 4 px on the Action button cancels the pending hold, so slow swipes never use the tool.
- Flower Show rivals lowered to 24/33/42 so a plain flower can place third.

## Art pipeline (art agent, 2026-10-08)

- **Source art is generated with Google Flow (Nano Banana 2.1) by the owner's account, then processed, never shipped raw.** The owner chose this over hand pixelling for speed. Every shipped sprite goes through the deterministic, committed pipeline in `art-src/tools/` (chroma key, native-grid detection, per-cell median, coverage-weighted mode downscale over palette indices, island cleanup, a fresh 1 px outline in the darkest palette brown) and lands on the game's grid in the shared palette. Prompts and which output fed which sprite are logged in `art-src/flow/prompts.md`; raw JPEGs stay outside the repo, the per-sprite crops are committed so the build re-runs from the repo.
- **Terrain is authored in code, not generated:** tiles must tile and keep the placeholder indices, so base textures are palette-indexed patterns in `art-src/tools/authored.py`; object tiles (tree, bush, bed, doors) put a Flow sprite on such a base.
- **Atlas keys alias the atlas GPU texture:** each texture key the game asks for becomes a view onto one shared atlas texture (WebGL), so call sites are unchanged and everything in one atlas batches together. Partial coverage, or the Canvas renderer, paints atlas frames over the generated canvas instead. Any key the atlases lack keeps its generated placeholder; a missing key logs an error (e2e fails on it).
- **Objects may be taller than their tile** (buildings 16x20, trees 16x24, tall crops 16x24), bottom-anchored like before; collision is unchanged. Villagers are 20x32 so a hat or a beard fits; the player stays 16x32.
- **Palette v2 (art director, 2026-10-08):** `public/assets/palette.gpl` is now an authored 32-colour palette in ramps (ink, night/water, foliage, earth, skin, reds, gold/lamp, plum, stone); slot 0 `ink` is the outline everywhere (no more "darkest colour" guess). No nudges logged yet.
- **UI skin: walnut chrome + parchment content sheets is the default** (round 2, after the critic's round-1 fixes): flat walnut plates behind text and a dock of regular planks (no grain behind anything you read), the bag's recessed sand slot everywhere including the hotbar, one selection style (gold ring, 2 px ink notches, gold ledge; `C.select`), enabled button text in ink and disabled buttons dim and hatched, headings/prices/"Gold" in ink with wine kept for warnings, ink letterbox and HUD strip. Only tokens, colours and drawing helpers changed (`theme.ts`, `drawPanel`/`drawSlot`/`drawSelection`/`Button.draw` in `widgets.ts`, the dock fill in `Hud.ts`, two colour tokens in `MenuPanel.ts`); no geometry, layout or input. The plum skin stays available with `?skin=plum`.
- **Villagers stay on their native Flow grid:** heights are reached by deleting whole rows below the waist (no resampling), so faces keep their pixels; Orin gets a 24x32 frame.
- **Villagers have their own sheets** (`npc_<id>`, 4 directions x 2-frame idle) instead of the tinted player; the non-integer breathing scale tween is gone (it smeared pixels).

## Maps pass (art agent, round 2)

- **Five art tile layers in every map** (`detail`, `shade`, `props`, `roof`, `overhead`), written by `scripts/map-art.mjs` from the ground grid, plus a hidden `lights` object group for the night glow. They share the one tileset texture. `src/art/mapLayers.ts` creates them only when the art tileset exists; the runtime roofs and ground tufts (`src/art/decor.ts`) are gone.
- **Transitions are baked in world space:** the map generator asks for exactly the edge tiles it needs (`art-src/map-tiles.json`: forest crowns, shores, grass creeping onto paths, mine rock, floor occlusion) and `art-src/tools/bake.py` renders each from its neighbourhood with noise in world coordinates, so edges meander, ponds have rounded banks and nothing repeats at 16 px. Identical tiles share a slot. After changing a map, run `npm run art:maps` (generate, render the new tiles, generate again); a unit test fails if a requested tile is missing.
- **Gameplay geometry is unchanged.** Ground, doors, zones, objects, spawns and fixed spots are as before. The only new collision is hand-placed props (barrels, lamps, a well, furniture: 18 on the farm, 22 in town, 8 in the house, 4 in the woods, 2 in the mine), and a prop is placed only on open grass or floor outside every zone, door, door spawn, plot (with a 1-tile margin), plot sign, landmark, mailbox, start, wake and villager spot; anything else is skipped with a warning. A test checks no added solid tile is inside an object or zone, and the map tests check connectivity. Big visuals (the forest mass, the woods' old oak, boats, crystals, beams) sit on tiles that were already solid.
- **Overhead tiles fade near the player** (3x4 tiles around the feet go to 45% alpha), so you, your target marker and any forage under a tree crown stay visible.
- **Indoors, the void around the room is ink**, not navy, so the house reads as a framed box.
- **Clay roofs per the critic's R2-1 spec:** 4 px tiles in 3 px staggered courses, a 1 px wine shadow under each course, one orange glint per tile, a 3 px sand ridge cap outlined in ink drawn overhead above the building (you walk behind it), an ink eave line and a plum shadow on the facade below. The shop keeps slate with a pale stone ridge so it stands out.

## Town projects (gold sink, late game)

- **A town fund is the late-game sink:** six projects in `projects.json` (1,200g to 50,000g, about 103k in all, plus mined and crafted goods) open one after another from the town board's "Town projects" button. Gold is given in +100 / +1,000 / +10,000 steps (never more than still needed), goods with one "Give goods" tap, so it fits a one-thumb, 5-minute session.
- **Rewards are perks, not gold:** a finished project grants perk keys (`orderSlots`, `fishWindow`, `xpBonus`, `maxEnergy`, `festivalPrize`, `sellBonus`) through a new perk-source registry (`registerPerkSource`), the same way skills and hearts already do. A balance test checks a money perk needs over 100 late-game days to pay its project back.
- **Visible:** each finished project puts a one-tile landmark in town (solid, Interact says what it did). Landmark textures are new keys with a generated fallback (`game/fallbackTexture.ts`) until the art agent draws them.
- **No new state:** progress is stats (`fund.<id>`, `fund.<id>.<item>`, `project.<id>`). Save version 8 exists only because three goals were inserted: `remapGoalIndex` keeps a saved goal index on the same goal by id (goals inserted before the player's current goal are skipped).
- **Threshold moved:** the side-income guard counts whole order rewards, so the canopy's 4th request moved the bound from 3,800 to 4,400.

## Home upgrades and decorations

- **Bigger Bag is a house upgrade on a new Home tab of the shop:** two levels (1,500g, then 6,000g plus 3 cloth), each a whole row of 8 slots, so the bag grid stays rectangular and grows upward away from the tabs. Save version 9 adds `upgrades.bag` (0 keeps the old 24 slots) and remaps the goal index for two new goals.
- **Decorations are plain placeables with a `decor` behavior:** fences, a stone path (flat: drawn under the player and walkable), pots, lamps, a bench, a statue and a fountain (10g to 12,000g, with per-kind limits). They do nothing but look nice; Interact names them and a second tap picks them up, like machines. They are type `placeable`, so the bin and gift list already refuse them and they land on the hotbar.
- **No x5 on dear rows:** anything over 300g (and every animal) has only the single-buy button, so one tap can never spend thousands (critique 3, F3).
- **Shop tabs are four buttons of different widths** (Seeds, Farm, Home, Upgrades) so "Upgrades" still fits; a pure `SHOP_TABS` table lets a test prove it.

## Daily jobs (critique 3, F2 pacing)

- **Three small jobs every morning from day 2:** villagers post requests from `jobs.json` ("Finn: catch 3 fish", "Orin: break 5 mine rocks"). A job counts what you do after it was posted (`base` is the stat's value at posting), pays on the spot (20 to 120 gold, 25% more each year) and gives the asker +15 friendship. They are listed in the morning summary and in Menu > Goal.
- **Pointers, not chores:** `introDay` puts the fishing job on day 2, the mine on day 3 and the board on day 4, so the idle days 3 and 4 now point at the side activities critique 3 found nobody discovers. `requires` hides jobs that cannot be done yet (no animal goods before an animal).
- **Stat watchers:** `registerStatWatcher` in `systems/goals.ts` runs on every stat change; jobs are the first user. No polling, no new events.
- **Bounded:** a balance test keeps the three best jobs of a day under 300 gold, a modest early boost that is irrelevant late. Save version 10 adds `jobs` and two job goals (one right after "buy", so days 2 to 4 always have something to finish).

## One-thumb conveniences (critique 3)

- **Gifts are never blind twice:** a villager's reaction to an item is remembered as a stat (`gift.<npc>.<item>`), and from 3 hearts their favourites count as known. The gift list sorts known favourites first and known dislikes last and says "Loves it!", "Likes it", "Not fussed", "Dislikes it" or "Not tried yet".
- **Seeds follow the hoe:** a hoe that tills N tiles in a row also sows N seeds in a row with one press (only on tilled, empty soil, as far as the stack goes). No new upgrade to learn.
- **"All" in machine sheets:** with two or more empty machines of the same kind on the map, one tap loads the item into all of them.
- **Welcome toasts show once per game** (`tip.welcome` stat), not on every map change; the day-1 summary no longer gives a winter tip (tips can be limited to seasons), and a busy morning drops the tip instead of growing past the screen.

## Mailbox (R3.6)

- **A fixed mailbox beside the shipping bin** (`mail.json`: farm 13,9), not a placeable the player could lose or sell: a solid fixture drawn by the objects renderer (fallback texture until real art), with the same bouncing star as a machine while a letter is unread or a gift untaken.
- **The post comes in the morning:** data letters (`mail.json`) are sent once when their `when` holds (a day, a stat milestone, a villager's hearts, a calendar date); code adds a festival notice and a birthday hint (one of the villager's favourites) the day before. A morning note says new mail arrived.
- **Letters carry gifts:** taking one is all-or-nothing, so a full bag never loses it. The box keeps 24 letters and only drops read letters whose gift was taken.
- **Save version 11** adds `mail`; old saves start with an empty box and receive any letter whose condition already holds the next morning (a short backlog of welcome and milestone letters).

## The rival farmer (R3.2)

- **Clay competes for the board, not for land:** from day 8 (announced by a letter on day 7) he fills the best-paying open request at 2 PM. The board says when he comes, and afterwards which one he took. It gives mornings a reason to visit town and turns orders into a small race, without any new screen.
- **Resolved lazily:** the rival acts when the board is opened or an order is delivered after his time (`applyRival`), never on a clock hook, so it is exact in tests and cannot fire twice (the day is a `rival.day` stat).
- **Friendship is the way out:** his perks are rivalry rules: at 2 hearts he comes 3 hours later, at 4 he leaves you the best request, at 5 he stops competing. His heart events reward 300 gold, Speed-Gro and iron bars.
- **Festivals name him:** the best rival score at every festival is Clay's; beating the field brings a grudging letter.
- **Save version 12:** orders carry an optional `rival` flag (no conversion needed).

## Greenhouse (R2.3)

- **A plot, not a map:** the brief expected per-map soil, but soil is keyed by farm tile and a second farmland map would need a deep refactor of every farming rule and the save. Instead the greenhouse is a 32-tile plot on the farm (south of the east field) with `"greenhouse": true`, owned once the **Greenhouse town project** (20,000g, 10 quartz, 5 iron bars, after the Library) is finished. One flag, checked in three places: planting ignores the season and the ripen-in-time rule, and nothing there withers at a season change.
- **Seeds all year:** with a greenhouse, the shop sells every season's seeds (`stockFor` takes the state). This is what makes winter income matter: about 800 gold a day from a full greenhouse of the best crop (guarded under 1,200 by a test).
- **Visible before it exists:** the site is marked on the farm ("Greenhouse site") so the project has a place in the player's head; once built it is drawn as glass. Project plots cannot be bought at a sign.
- Seven projects now (about 123k gold); the "all projects" goal moved to 7, and a capstone goal (20 greenhouse harvests) was appended at the end of the chain, so no save migration was needed.

## Simulation fidelity (backlog 8)

- **The bot now farms the real farm:** it plants only on plots it owns (`plots.json` rects, `ownsTile`), buys the next plot at 1.8x its price, fills board requests it can cover, crafts and keeps six preserve jars busy, and buys fiber. It still does not fish, mine, raise animals or fund projects, so it is a floor for a diligent player, not a ceiling.
- **A tight band instead of 15k to 400k:** the full-year income is pinned to 208,549 (rng 42) with a band of -33% / +70%, so a real balance change fails the test and has to be explained here. Requests must stay under 35% of income and the bot must buy land.
- **What it shows:** a tireless player who buys all the land earns about 5k in spring, 13k in summer, 110k in fall and 78k in winter (kale on 250 tiles). That is far above a human, but it confirms the late-game gold the projects, greenhouse and decorations are meant to absorb.
- Also fixed while adding map tests: Finn's afternoon spot in town was in the river (now 16,22); a test checks every villager spot, landmark and the mailbox stand on open, reachable ground. The bag's item card no longer shows "Sells for" on things the bin refuses (machines, decorations).

## Animal depth: pigs and the feed silo (R2.6)

- **Pigs dig truffles, but only outdoors:** a new `outdoor` flag in `animals.json` means a fed pig cheers up every day but only finds a truffle (120g) on a dry day outside winter. Truffles are the best animal good per head, balanced by the weather, a 1,600g pig, a Farming 6 sty (one sty, two pigs) and slop.
- **The feed silo makes daily feeding optional:** one Interact pours every feed in the bag into it (300 in all); overnight, before animals wake, every house nobody fed eats from it. Feeding by hand still works and is never doubled. This keeps animals a one-tap-a-day chore (collect) instead of two, which suits one thumb and five-minute sessions.
- **Bounds moved:** the animal guard rail went from 1,000 to 1,200 gold a day and the side-income total from 4,400 to 4,600 (one sty adds at most 220 a day, less on wet days).
- Not done: animals that roam beyond their house (visual; waits for real animal sprites).

## Critique 4 fixes

An independent critic played the build at `22fc304` (goals D1 to D4) and wrote `agents/critiques/critique-4.md`. Fixed:

- **F1 energy perks lost on load:** `sanitize` clamped energy to base plus tonics; it now clamps with `maxEnergy()` once the rest of the state (skills, hearts, projects) is rebuilt.
- **F2 dead-money decorations:** the shop refuses to sell a capped placeable past its cap (placed plus carried), shows "Decor 1/1" and disables the button. The bag card no longer shows a sell price for things the bin refuses.
- **F3 impossible jobs:** jobs can carry a live `check` (weeds that exist, ripe crops, goods to ship, a board request you hold some of) that caps `n` or skips the job. The board asks for preserves only once that machine stands somewhere, and the order goal moved after the jar goals (save version 13 remaps the goal index).
- **F4 exploits:** shipping jobs pay at the night's payout (taking goods back out of the bin no longer keeps the reward); the decoration goal counts decorations standing at once; the gift job needs a gift the villager likes.
- **F5:** Finn's town spot is on the riverbank (map test added).
- **F6 summary overflow:** weather and the forecast come before the notes; routine lines are folded into one ("Fresh wild goods, ore and requests today.") and put last; if it still does not fit, the tip and then the last notes give way ("...and 3 more").
- **F7 weak late projects:** the greenhouse became a project; Fair Hall costs 12,000g and doubles festival prizes; Market Road is 10% at 60,000g (payback bound moved from 100 to 80 late-game days); the canopy stands beside the board.
- **F8 bag to hand:** a bag item's card has "Use now": one tap puts it in the hand and closes the menu.
- **F9:** "tap again to pick up" is runtime memory for 4 seconds, never saved.
- **F10:** job plurals, "+N g" buttons say what they give near the end, upgrade rows read "bought/levels", earn goals say "in all".
- **F11:** nothing can be placed on a villager's daily spot; weeds never sprout under placed things; the unused `charm` param is gone. Placing machines and decorations outside bought plots stays allowed (a recorded earlier decision).
- **F12:** the gift list puts known favourites first, then unknown goods by value, then seeds, stone and bait, then known dislikes.
- Not done: forage visibility (critique 3 F8), day-1 land signs (F9), joining fence art (art agent), a long-press hotbar picker.

## Festival minigames (backlog 6)

- **Three ways to take part, chosen in data (`mode` in `festivals.json`):** the Flower Show stays a single entry; the Harvest Fair and Winter Feast take a **basket** of up to three different goods, scored by value plus 15% per extra kind of good (veg, fruit, flower, or the item type); the Fishing Derby is a **derby**: every fish you catch that day, anywhere, can join your three best, and you hand the score in at the board (the fish stay yours).
- **The derby reuses the real fishing game** rather than a new screen: `resolveCatch` reports each catch to `recordCatch`. That turns the derby into a day of play, which is what critique 3 asked for, at almost no UI cost.
- **One-thumb:** baskets are built with Add/Out on each row and one "Present the basket" button low on the sheet; the derby page has one "Hand in my catches" button.
- **Rivals rescaled** for three-item scores (fair 300/600/950, feast 220/380/600, derby 110/170/240) so a year-one player reaches the podium with good, varied goods and needs gold quality to win.

## Moving buildings, quieter land signs, easier forage (backlog 7, critique 3 F8/F9)

- **Move, don't undo:** an occupied coop, barn, shed, sty or a stocked silo can now be picked up with the same deliberate second tap as a machine; its state (animals, goods waiting, happiness, feed) is parked in `state.stored` and the next one of that type placed takes it back. Placement confirm was dropped: a confirm on Action would fire on a held press, and with pick-up-anything a misplaced building is two taps to fix. Save version 14 adds `stored` (sanitised to never hold more than the buildings you carry).
- **Trees stay put:** checking a tree for fruit is a natural double tap, so trees are not movable.
- **Land signs appear as they become relevant:** the cheapest unbought plot always shows its sign; dearer ones once you have earned a quarter of the price or hold half of it. Day one no longer greets you with 2,200g and 2,600g signs (the land is still dimmed, so it never looks like yours).
- **Forage reads from afar:** a golden ring pulses under every wild good (still under Calm mode, static) and the twinkle is larger.

## Second-year content: rare crops and mastery goals (backlog 9)

- **An eighth project, the Seed Exchange** (6,000g, 40 fiber, 2 copper bars, after the canopy), unlocks four rare seeds, one per season: strawberry, blueberry, cranberry and snow pea. All regrow, so a field of them is planted once a season; per tile-day they earn 9 to 14, under melon and pumpkin, so they are variety and less replanting, not a new best crop (guarded by a test). Shop entries carry a `project`, so any future shelf unlock is data.
- **The board only asks for what you can grow:** orders skip crops whose seed is still behind a project.
- **A Rare Crops Book page** (1,000g); the Book now pages six sections at a time.
- **Mastery goals at the end of the chain:** grow all four rare crops, sell 50 gold-quality goods (counted at payout, so a ship-and-take-back does not count), finish every Book page. Appended, so no save migration.

## Special orders (backlog 9)

- **One big seasonal request at a time** (`specials.json`): "15 Potatoes for Rosa", due the season's last day, posted in the morning whenever the board is free and at least 10 days of the season are left. Quantity comes from a value target (1,500g of goods in year one, +50% a year), the reward is 1.5x the goods' value plus 60 friendship.
- **A bit at a time, never lost:** "Give" hands over whatever you carry (any quality); if time runs out, the goods given are paid at bin price. Specials for rare crops, eggs or iron bars wait for the project or the first animal or smelt.
- **Why:** orders are a daily lottery; a special is a week-long plan for a field (critique 2's "make orders the planning game"). Save version 15 adds `special`. A goal is appended at the end of the chain.

## Juice (R1.4 leftovers)

- **Hearts and levels are celebrated where you stand:** a new heart sends pink sparks up from the player and a banner ("ROSA: 2 HEARTS!"); a skill level-up bursts gold sparks (the banner and sound existed). Friendship emits a `heartUp` event only when the heart count rises.
- **Collected goods pop out of what made them:** after an Interact, if the bag gained anything (eggs from a coop, jam from a jar, honey, fruit), its icon pops from the object with a sparkle. Done by comparing the bag before and after in the world scene, so no mechanic had to change.

## Real audio

- **Formats:** every file is mono MP3 (LAME VBR, 44.1 kHz), which `decodeAudioData` handles on iOS Safari/WKWebView, Android WebView and desktop Chrome (Playwright's Chromium has no AAC, so MP3 also lets e2e prove real decoding). No Ogg (older iOS).
- **Music is composed note data played live on sampled instruments**, not baked loops: 94 CC0 instrument samples (VSCO 2 CE, VCSL: piano, harp, marimba, glock, vibes, recorder, ocarina, viola and cello sections, cello pizzicato, small percussion) and seven pieces (four seasons with day and night arrangements on one bar clock, title, mine, festival) in `src/audio/music.json`, written in `audio-src/tools/music_src.py`. Variety comes from composed phrase pools, A/B sections and breathing sections, so nothing repeats like a 30 s loop, the payload stays small (1.3 MB of samples) and decoded memory stays low. House = the season piece without percussion (same clock, no restart).
- **Fallback never goes silent:** any sfx cue without a decoded take plays the original synth; a missing instrument plays its notes on a synth voice; a piece with no loadable instrument switches to the original synth music; rain uses the noise bed until the recording loads.
- **Loading:** bytes are fetched after the first frame (through the service worker's cache on a first visit, not twice), decoded at the unlock tap in priority order (sfx and jingles, then the current piece); unused decoded buffers are dropped after 2 minutes. Sustain samples and ambience beds have baked crossfade loops with a repeated tail, so decoder priming cannot cause a click; the engine measures each buffer's onset to compensate.
- **Mix:** sound effects are matched by role on max momentary loudness (K-weighted 400 ms; rewards -18, tools -20, swing/plant -22, door -21, error -23, ui -25, steps -28 LUFS in the file, about the same at the output at default volume), true peak <= -1 dBTP after MP3 encoding; music sits near -25 LUFS integrated by day and -28 at night at the default 60% volume; ambience beds under the music. A repeat of the same cue within 350 ms (a held tool) plays 4 dB softer, and water keeps one voice. Measured from offline renders of the real engine (`audio-src/tools/render.mjs`). The master "limiter" is a DynamicsCompressorNode (-3 dB, 20:1), which by spec adds about +1.7 dB of automatic make-up gain; the measured levels include it.
- **Round 2: output calibration and peaks.** Each sfx recipe carries a `trim` (dB) measured on renders of the real
  mix (`audio-src/tools/sfxlevels.py`: median of 16 hits, K-weighted max momentary), so every cue lands within
  about 1 dB of its role target _at the output_ (they were 1-3 dB under). Peaks are fixed at the source: a cue's
  file is limited so that its worst take, with its trim, volume spread and the compressor's make-up gain, peaks
  at or under -3.5 dBTP at the default volume (`tests/audio-assets.test.ts`). A WaveShaper soft clipper after
  the compressor (linear to -3 dBFS, tanh knee, ceiling -1.4 dBFS, 2x oversampling) is the brick wall; only
  extreme settings reach it (all sliders at max with festival, rain and 60 effects: -1.0 dBTP).
- **Each piece has its own harmony** (round 2): summer mixolydian over a pedal, fall Andalusian/aeolian with a
  Neapolitan, winter suspensions over a D pedal, title a hook with borrowed minor-key chords and a sting intro,
  festival a ragtime circle with a minor trio, mine a phrygian deep section. Tests keep them apart (distinct
  progressions and cadences, chord-bigram and melody 3-gram overlap limits); `audio-src/tools/seasons.py`
  measures transposition-invariant harmonic similarity on renders.
- **The mine is intentionally quieter:** its music sits near -29 LUFS (as in round 1), -27 with the cave bed and
  drips, a step down from the farm's -25 by day. Not lower than about -30 for the music alone, or the cave bed
  masks it on phone speakers.
- **Phaser's own audio is off** (`audio: { noAudio: true }`): one AudioContext for the whole game.
- **Sources:** Kenney (CC0) and OpenGameArt CC0 for sound effects and ambience, Versilian Studios (CC0) for instruments; every file, page, author, licence and sha1 in `audio-src/SOURCES.md`. Nothing was listened to by a human while building it.

## Critique 5 fixes (depth round 2)

An independent critic played the build at `64eeb10` and wrote `agents/critiques/critique-5.md` (partial). Fixed:

- **F1 Clay has teeth: requests stay two or three days** (`orders.json` `days`). Each morning filled and expired requests come down and new ones fill the free places, so a request you need a day to gather for can be taken by Clay at 2 PM, the best-paying one first. Rows say "Have 1/3 120g 2 days". Clay now stays in town until 6 PM, so his 2-heart perk ("comes at 5 PM") matches where he is. Old saves: a request with no last day ends the day it was posted (no version bump; `until` is optional). The sim earns about 10% more (more requests get filled), so `SIM_EARNED` moved from 208,549 to 230,261.
- **F2 baskets count goods, not qualities:** three pumpkins of three qualities are one good and are refused. Kinds come from the festival's data (`kinds`): the Harvest Fair now also takes forage and counts Veg, Fruit and Wild; at the Winter Feast every preserve is its own kind and all animal goods are one. Each row names its kind and the basket line shows "+30%". Feast rivals rose to 260/480/900, so a single gold wine is second, not first.
- **F3 a chore tap never lifts an occupied building:** behaviors may say what they hold (`occupants`); for a coop, barn, sty or stocked silo the second tap opens a Move sheet with a "Move it" button instead of picking it up. Empty ones still go with a second tap. Auto tool: none (Interact).
- **F4 the derby talks:** an improving catch toasts "Derby best! Catfish. Score 195."; the derby page names each fish; handing in before 6 PM asks once ("Sure? Tap to hand in"). Derby day stocks catfish in the town river whatever the weather (`stocked`), and the page says so; the third rival dropped to 95 so three bluegill from the farm pond reach the podium.
- **F5 regrowing crops under glass are spent when their season ends** (and cannot be planted too late to ripen), so corn and the rare berries earn 13 to 14g per tile-day there against pumpkin's 19. The greenhouse test now counts seed cost and regrowth.
- **F6 and the owner's call:** nothing can be placed on land for sale or on a project's site before it is yours ("Not your land yet. Buy it at a sign."). The yard outside every plot stays free for decorations and machines.
- **F7** the morning summary names a house the silo could not feed ("The barn went hungry: the silo needs 2 Hay.").
- **F8** a finished project's gold buttons give way to "All the gold is in!"; shop rows keep "own N" by shortening to "4d 35g, own 12" when the full line does not fit beside the buttons (the old test allowed 110 px where the row has 86); truffles join the Animal Goods page.

## Animal goods on the board (depth round 2)

- **Orders and specials ask for eggs, milk, wool, truffles and honey once the farm makes them** (`animalOutput`: a house with animals, a bee house; pigs not in winter). A request never asks for more than about two days of what the farm makes (`animalOrderCap`), so one hen never gets a request for six eggs. The egg special now waits for hens, not for any animal; milk (Rosa) and truffle (Mara) specials were added. No reward rule changed, so the order bound in `tests/balance.test.ts` still holds.

## Clay in year two (depth round 2)

- **From year two Clay takes two requests a day** (`game.rival.perYear`, capped by `maxTakes`), back to one once he likes you (`calmHearts`: 2 hearts, the same heart that makes him come later). He never takes the last open request. The board says "Clay takes the best two at 2:00 PM."

## A repeatable late-game sink: the Founder's Statue (depth round 2)

- **Evidence first:** a two-year run of the sim bot that buys all the land and then funds every project (it is handed the goods it does not mine) finished all eight projects by spring of year two and then ended the year holding about 280k gold with nothing to buy.
- **A project can now repeat** (`repeat: { growth, perkLevels }` in `projects.json`): each level costs `growth` times the last, gold and goods start over, perks stack for `perkLevels` levels and later levels are for show. Levels are the stat `project.<id>.level`; no new state.
- **The Founder's Statue** opens after the Market Road: 30,000g and 50 stone for level 1, half again each level; +1% on sales per level up to +5%. A level pays back 1% of a year's sales, so it is a sink, not an investment (a test keeps payback over ten tireless years). The same bot now ends year two at statue level 4 with about 30k in hand. Repeat levels never count toward "all projects"; a goal "statue level 3" is appended.
- **Landmark** `obj_landmark_statue` at town 10,14 (fallback colour until art).

## Decorations with a small use (owner's call, depth round 2)

- **Mostly cosmetic still**, but two do a little: a **Garden Bench** gives +15 energy once a day when you sit (Interact; a full player keeps the sit for later), and a new **Scarecrow** (80g, Home tab, `radius` 4) keeps crows off the crops around it.
- **Crows are the reason for the scarecrow, and they are mild:** from day 8, on a dry morning, a field with 12 or more crops no scarecrow watches has a 25% chance to lose one crop ("A crow ate a parsnip. Scarecrows keep them off."). Never under glass. Rosa's day-7 letter brings a scarecrow, so the first one is free and comes before the first crow. Auto tool: none (placeable / Interact).
- **The sim bot stands scarecrows over every plot** and loses almost nothing; it now also runs five seeds and is judged on the median (critique 5, F9), pinned at 209,894 (seed 42 alone: 224,150; the spread of 149k to 224k is why one seed was not evidence).

## Jobs are a nudge, not a living (owner's call, depth round 2)

- **Measured:** over days 2 to 14 three average jobs a day paid about 1,800g, while the tireless sim bot's farm had earned 1,380g by day 14 (median of five seeds). Jobs outpaced crops.
- **Job gold is now 55% of what it was** (each `base` and `perUnit` in `jobs.json`), so the same two weeks of jobs pay about 1,000g: still a useful start (three jobs buy a row of seeds) but less than the farm. A sim test keeps early jobs under three quarters of early farm income. Friendship from jobs is unchanged.
- **Knock-on:** the bot completes some jobs passively (harvest and ship jobs), so its year fell; the five-seed median was repinned from 209,894 to 177,686, and the two-year statue check now expects level 3 and 250k sunk.
- **Specials stay at 1.5x the goods' value** (about 750g over the bin for a week of planning): no change, nothing in the tests says they outpace crops.

## The Flower Show is an arrangement (handover goal 6, depth round 2)

- **A basket of up to three different flowers** (the basket mode, no new screen): each flower is its own kind, so a pair scores 15% more and three flowers 30%. Rivals rose to 40/75/120: a plain tulip and daffodil reach the podium, a gold pair wins, a lone daffodil does not place.
- **Tulips, a spring flower crop** (bulbs 25g, 6 days, 55g; on the Crops page of the Book), so the show has something you grow for it, not only what you find. Per tile-day they earn less than potatoes, so they are for the show and variety, not a new best crop. A year-two player can add a summer sunflower or winter holly kept in the bag.
- **Bees love flowers:** a bee house with a flower crop (tulips) growing within 3 tiles makes honey every 3 mornings instead of 4 (`flowerDays`, `flowerRadius`), and says so. This gives tulips a use beyond one festival day; at most five bee houses, so honey stays a small income (about 117g a day at best).

## Critique 6 fixes (depth round 2)

An independent critic played the build at `5fd9943` (14 real-input days plus probes and a 41-screen sweep) and wrote `agents/critiques/critique-6.md`. Fixed:

- **F1 (Blocker) the projects list overflowed:** with eight or nine projects the Market Road's Open sat under Close and the statue was off the screen. The list now shows the projects you can still fund (the statue always first) and moves finished ones to a "Finished (7)" page, five rows a page with arrows; a layout test checks every row stays above the buttons, and the e2e opens the statue with a real tap.
- **F2 (Major) Clay only came if you looked after 2 PM:** the morning refresh now settles the day before first (`settleRival`), with a summary line ("Clay filled 4 Potato on the board."); it never acts twice for a day.
- **F3 Clay always took the newest, dearest request:** a request is safe on the day it goes up (`Order.from`); from the next day Clay targets the best one, and the board names it ("Clay wants this one at 2:00 PM." and "Clay's!" on the row). The race is now "can I bring 4 potatoes before 2 PM tomorrow?". Crop requests only appear for crops you are growing or carry, so the early board stops asking for what cannot ripen in time.
- **F4 specials ignored herd size:** an animal special asks for at most what the farm makes by the deadline (`specialCap`), and is not posted when that is under five. Pigs count at 60% (dry days); honey requests only when a hive has some ready.
- **F5 a greenhouse year's seed shelf was a trap:** the season's own seeds come first, the others say "Glass only"; regrowing seeds say "again 4d". The sim bot no longer buys out-of-season seeds and farms its greenhouse; its two-year run now shows a full year two (about 777k earned, statue level 5, 30k in hand) instead of a dead summer. Five-seed median repinned at 195,194.
- **F6 festivals too easy:** Fair rivals 400/750/1,300 and Feast rivals 300/700/1,600, so the best three jars still win but not at 2.6x Clay, and a lone gold wine or two gold crops no longer take first.
- **F7 the bench:** the sit is kept until it gives its full 15; right after sitting, Interact says "Rested. Back tomorrow." and never arms a pick-up (`arm: false` on a message).
- **F8 text:** "Done!" for perk-less projects; "1 a day." beside Mara's Shop button; the silo's Move line no longer says "they"; Enter no longer presses "Move it"; the sleep title no longer touches the time; the season change says when regrowing crops under glass were spent; the scarecrow says its reach.
- **F9:** dearer land signs appear at half their price earned (was a quarter). The long-press hotbar picker stays with the controls agent.

## A kitchen and cooking (brief backlog 1: house upgrades)

- **The Kitchen is a Home upgrade** (2,500g, shop Home tab). Its level is kept only as the `upgraded.kitchen` stat (`upgradeLevel` falls back to it), so no save change.
- **Six dishes cooked at the workbench** (recipes with `kitchen: true`): Parsnip Soup, Baked Potato, Fish Stew, Berry Tart, Kale Salad, Pumpkin Pie. Each restores 30 to 80 energy. Eat from the bag card ("Eat +40") or with the dish in hand and Action (`eat` handler, priority 45; auto tool: none). A full player is refused, so a dish is never wasted.
- **Energy, not money:** a dish sells for at most 15% over its ingredients (a test), so cooking makes a long day longer instead of being a second jar. Villagers like some dishes (Rosa loves pumpkin pie, Finn fish stew). A "Cook a meal" goal is appended.
- New texture keys: `item_parsnip_soup`, `item_baked_potato`, `item_fish_stew`, `item_berry_tart`, `item_kale_salad`, `item_pumpkin_pie`.

## Legendary fish (fishing mastery)

- **Four legends, one a season** (`legend: true` in `fish.json`, appended so derby fish codes keep their meaning): Glimmer Trout (town river, rainy spring), Sun Carp (the farm pond, summer), Old Whiskers (woods, rainy fall), Ice Pike (town, winter). Each is rare (weight 0.4), hard (0.8 to 0.9) and bites only until you catch it once (`legend.<id>` stat). They are never board requests.
- **Found through Finn:** a letter after your tenth catch says where each hides; a "Catch a legendary fish" goal is appended. Not on a Book page, so finishing the Book stays reachable.
- New texture keys: `item_glimmer_trout`, `item_sun_carp`, `item_old_whiskers`, `item_ice_pike`.

## A human-paced sim (critique 5, F9: "no clock")

- The bot can now be given a number of Action presses a day. At 150 presses (three seeds) it earns a median of about 148k in year one, 76% of the tireless bot; at 60 presses about 87k. Upgraded tools and plant-a-row make each press count, which is why the gap is smaller than the press count suggests. A test keeps the 150-press year under the tireless median and above the first statue level, so a steady human reaches the late sinks in year two rather than drowning in gold in year one.
- **The bot keeps hens too** (a coop of three once Farming 3, fed and collected daily, eggs shipped or given to requests), so animal goods on the board are exercised by the sim. The five-seed median moved from 195,194 to 219,796 (+13%: about 12k of eggs a year plus egg requests and a different random path).

## Critique 7 fixes (depth round 2)

An independent critic played the build at `f27999e` (two 14-day real-input runs, probes, a 44-screen sweep) and wrote `agents/critiques/critique-7.md`: no blocker; six critique-6 fixes held. Fixed:

- **F1 crop requests for crops that could not ripen in time:** a crop is asked for only if you carry some or one of yours ripens within 3 days (`cropReadyIn`, `CROP_WAIT`), and the request stays open until a day after it ripens.
- **F2 Clay took the dearest request every day, so "3 days" was a lie:** he now takes only requests on their **last day**, so the days on a row are true; and **on a day you fill a request yourself he stays home** ("Clay stays home: you won today."), so racing him has a reward. Most of what he still takes would have expired unfilled.
- **F3 the board asked a farmer for trout:** crops, preserves and animal goods are drawn three times as often as fish and wild goods (a test keeps two grown crops above a quarter of requests).
- **F4 the special's Give starved a same-item request:** it keeps back what a fillable same-item request needs and says how many it gives ("Give 3"); a finished special is not posted again within a season.
- **F5 bench:** without a sit to give, Interact says why ("Rested today." or "Sit when tired (+15).") before the usual second-tap pick-up.
- **F6 eating:** a dish is kept when less than half of it would count ("Not hungry" on the card, "You're not hungry enough." on Action); the card shows the real gain; the bag cursor clears when the last one is eaten; out of energy with food in the bag, the line says "Eat something or go to bed."
- **F7 legends:** the Book's Fish page shows "Legends 1/4".
- **F8 animal specials** ask for about 70% of what the farm makes by the deadline (`SPECIAL_SHARE`).
- **F9:** the honey tip no longer talks about feeding animals (the tip now waits for an animal); the statue page says what you have ("Now +2%.") and stays open after a level; glass-only regrowing seeds keep "again 4d" where it fits; the seed shelf lists this season's seeds, then glass-only ones, then the rest.
- **Sim:** five-seed median repinned at 227,442 (crop requests the bot can fill; Clay only on last days). Clay took 71 of 145 requests in the seed-42 year, all on their last day and almost all ones the bot would not have filled.

## The traveling cart, x5 cooking, a legend warning

- **A traveling cart on days 5, 12, 19 and 26 of every season** (`cart.json`): four goods a visit from a pool the store does not sell, at a premium: rare seeds at twice the price before (or instead of) the Seed Exchange, saplings, Speed-Gro, and copper and iron bars, quartz and cloth for players who do not mine or weave. Five of each a visit. Opened from a gold "The traveling cart is here!" button on the board; the morning news announces it. Its stock is a hash of the day, so it needs no saved state (purchases are `cart.<day>.<item>` stats). Seeds are offered only when they grow now or you have a greenhouse. A weekly reason to visit town and a mid-game gold sink; bars cost about five times what the bin pays, so it is a shortcut, never a loop.
- **x5 on dishes** at the workbench (cooks up to five); ingredient lines drop the "1" ("Pumpkin, Egg, Milk") so they fit beside two buttons.
- **A legend in the bin** gets a warning toast: it can still be taken back out before bed.
- New texture keys: none (the cart is a sheet, not an object in the world).

## Critique 8 fixes (depth round 2)

The critic played the build at `3e1b9c5` (two 16-day real-input runs, probes, a 42-screen sweep) and wrote `agents/critiques/critique-8.md`: no blocker. Fixed:

- **F1 the special's Give could still empty a same-item request:** goods a fillable request needs are never handed to the special; when all are spoken for, its row says "Saved for a request." and Give is off.
- **F2 Clay had become harmless (he only took rows nobody would fill):** the "stays home" rule is gone and **the board keeps score each season** instead: a request you fill is a point for you, one left to its last day is a point for Clay. The notice shows "This season: you 3, Clay 1." On the first morning of a season the leader is settled: beat him and the town pays 300g a year of play (and he likes you a little more); lose and he writes to gloat. Leaving requests to expire now costs something, and the rule is the same one the board shows. His letter and chat line were rewritten to match ("Leave a request to its last day and it is mine.").
- **F3 crop requests asked for more than the field gives:** a crop request asks for at most what you carry plus what ripens before it ends (`cropSupply`).
- **F5 the first week's board had no crops:** a crop now joins the board up to 7 days before it ripens (`CROP_WAIT`), and the request stays open until a day after.
- **F4 the cart resold store goods:** it never offers what the store sells that day, nor seeds that cannot ripen this season (without a greenhouse); its pool is rare seeds, bars, quartz, cloth, a ruby, amethyst, rich fertilizer and a quality sprinkler, each with a one-line use shown when bought ("Bought Quartz. For the Library and Greenhouse."); its sheet closes back to the board.
- **F6** the bag cursor clears after any Eat tap, and "Not hungry" is drawn dim. **F7** batch cooking ("x3") uses plain-quality ingredients only and toasts the real count. **F8** goal and tip text say "Make", not "Craft"; the pre-Clay notice says "Requests stay a few days."; the statue page says "Next level: ... Now +2%."
- **Sim:** the median rose 16% across critique 7 and 8 work; measured, it is about 9k of eggs (180 a year from the bot's hens), about 7k more of board requests, and more jars kept busy along a richer early path. Repinned at 213,730.

## Critique 9 fixes (depth round 3)

The critic played `1a7464d` (two 31-day and two 14-day real-input runs, season probes, a two-year board sim) and
wrote `agents/critiques/critique-9.md`: no blocker. Owner defaults for round 3 decided the open questions. Fixed:

- **F1 the season score was hidden from a losing player, and a farmer who never fishes could not win** (the sim lost
  72 of 72 seasons). The board now has a score line of its own every day once Clay is about ("This season: you 3,
  Clay 6."), and Clay's line below it says his target, what he took, last season's result for three days ("Last
  season: you won 25 to 7."), or else "Clay scores on farm goods only." **Clay scores only on farm goods:** crops,
  animal goods, and preserves made from them. Fish, wild goods and jam or pickles of wild goods he still takes on
  their last day, but without a point ("Clay took it: no point."). Owner default: a farmer who never fishes must be
  able to win; a fisher simply has more chances. **Stakes are said up front:** Clay's intro letter and his losing
  letter name the prize; a draw is said. **The prize lasts** (owner default): a Board Trophy in the house
  (`game.json` `trophies`, texture `obj_trophy_board` at house 6,2) that counts `boardWins`, a letter from Mara,
  and still a modest 300g a year of play. Sim (two years, three seeds, no fishing): a farmer who keeps what the
  requests want wins 23 of 24 seasons; one who ships everything wins 13.
- **F2 crop requests needed the whole harvest:** a crop request asks for three quarters of what you could hand over
  (`CROP_SHARE`, at least one). The bin's "Ship all produce" keeps back what open requests want, lowest quality
  first, and toasts "Kept 4 Potato for the board."; the row's "All" and "+" still ship them, with "The board wants 4
  Potato." when the bag drops below what is asked; wanted goods read in the warning colour.
- **F3** the special's Give keeps back the full quantity of every same-item request you can fill or that has days
  left (`keepForRequests`), so one you are part-way to is never emptied. **F4** the Make tab's batch slot is always
  there (a dim "x1"), so Make never slides under the thumb. **F5** requests are drawn first and the special last.
  **F6** the season result comes after Clay's overnight take that decided it, last season stays on the board three
  days, a win brings Mara's letter, and "You could finish the ... today" is said once a season per project.
  **F7** the cart row names the use before you pay ("900g Market Road", data `tag`; seeds say their season).
  **F8** Clay's 2-heart scene no longer says "You keep beating me". The goal title "Craft something at the
  workbench" belongs to the onboarding agent's early goals and is left to them.
- **Clay's 4-heart perk matters again:** "polite" Clay takes rows that are no point for him first (fish, wild
  goods), then the smallest; the perk reads "Clay spares your farm goods". Critique 9 found it near dead (it only
  changed which last-day row he took).
- **The statue grows** (owner default): a repeatable project's landmark may have `levels`; the statue shows
  `obj_landmark_statue_1` .. `_6` (16x32), the last from level 6 on, with a placeholder that grows until the art
  lands.
- **Sim:** the five-seed median rose 17% (213,730 to 249,871), within the band. Smaller crop requests are filled by
  the bot's harvest more often and it now wins some board prizes; the early gold compounds through earlier land
  (seed 7 moved most, 189k to 241k; seed 42 only 3%). Repinned.

## Critique 11 fixes (depth round 3)

The critic played `70e861a` (two 32-day pure-farmer games, edge probes, a sensitivity sim) and wrote
`agents/critiques/critique-11.md`: no blocker, no major. Fixed:

- **F1 a keeper still walked the race** (13 to 3; Clay's points were only his crates, since a keeper fills every farm
  row before its last day). Clay's crates now keep up with a leader: every 7th day of a season, every 3rd while you
  lead by 4 or more (`crateDue`). Rows still stay safe until their last day, so "3 days" on a row stays true.
  Sim: the keeper's seasons are closer (17-8, 15-11, 8-5 ...); it wins 19 of 24, a shipper 1. The sim keeper fills
  fewer spring rows than a played one (critic: 4 against 13), so its win count is a floor, not a prediction.
- **F2 the crate was never announced and decided seasons on day 28.** No crate on a season's last day (your move is
  last); the board says "Clay ships a crate tonight: a point." when he has no scoring target; his intro and losing
  letters name the weekly crate.
- **F3 a friendly Clay made every season a free win.** At 5 hearts he still ships his crates (he only stops taking
  requests), and he no longer sends the gloating letter.
- **F4** year two: "Clay takes two at 2:00 PM: no point.", and "wants two of these" only when both score.
  **F5** the wanted bin line fits with a bin count ("Board 4 bin 2", else "Board 4 x9"); the kept toast splits the
  special ("Kept 5 Potato for the board and 11 for Rosa."). **F6** a special that ran out is said on the same morning
  a new one is posted. **F7** a finished special keeps its row ("Special done! Thank you!") until the board closes,
  so nothing slides under the thumb. **F8** sim tests have a 60 s timeout. **F9** winter of year one pays year one's
  prize. **F10** of this round's appended goals, the fishing one moved last (round-2 goals stay in place: the legend
  goal at #54 still comes before the board goal).
- **Not changed:** three long toasts over a tall sheet cover its header (nothing tappable); the early-gold
  sensitivity (an owner question, see below).

## Critique 10 fixes (depth round 3)

The critic played `e23349b` (four 32-day new games as a farmer who never fishes, edge probes, a sweep, a sensitivity
sim) and wrote `agents/critiques/critique-10.md`: no blocker, one major. Fixed:

- **F1 (major) toasts were drawn under every open sheet**, so "Kept 4 Potato for the board.", "The board wants 4
  Potato.", "Order done!" and "Bought ..." were unseen. While a sheet is open, toasts now sit at the top of the
  screen above the dim (`ui/Hud.ts`, depth only; flagged for the controls agent, who owns the HUD). A wanted bin row
  also says it in words: "Board 4 have 9".
- **F2 the race had become a formality** (a keeper won 15 to 0; Clay's named target was usually a row that could not
  score). Clay now plays to win: on a last day he takes farm goods first, best-paying first, and a fish or wild row
  only when no farm row is due. "Clay's!" marks only a target that would score; otherwise the board says "Clay
  takes one at 2:00 PM: no point." And every 7th day of a season he ships a crate from his own field, a point
  (`rivalCrate`, said in the morning), so keeping goods is needed but not enough. Sim, two years and three seeds:
  a keeper wins 16 of 24 seasons, a farmer who ships everything 1.
- **F3 at 5 hearts the race ended silently** (no score, no settlement, the last goal stranded). The board keeps score
  from day 8 whatever his hearts (`boardRaceOn`); a friendly Clay only stops taking requests and shipping crates
  ("Clay no longer takes requests."), and seasons still settle.
- **F4** in the first days of a season, while it is still 0 to 0, the score line names last season ("Last season: you
  won 15 to 0."); a 0 to 0 season is said; a take that scored nothing reads "Clay cleared 5 Trout off the board: no
  point."; Mara's letter says "out-scored".
- **F5** "Ship all produce" also keeps what the special order still needs (after the requests); the sim keeper now
  hands the special what the requests do not need.
- **F6** the stakes say the year's prize; Clay's intro says "what you make of them"; three kept kinds name two
  ("Kept 2 Potato, 3 Egg and more..."); a cart row shows "N left" once you bought some; an out-of-season seed says
  "Greenhouse"; a four-digit reward drops "Have" to keep "last day"; the special's title is "Special: 15
  Cauliflower" with the giver on its second line; the cook goal's hint says "Menu > Make".
- **F7 (balance, not changed):** year one is very sensitive to early gold for the tireless bot (one 300g spring prize
  moved a seed by 60k; the five-seed median fell back from 249,871 to 213,730 once the bot stopped winning prizes,
  repinned). Fish bounds are now against the pinned median. Whether early land should be gentler is an owner
  question; the human-paced sim is the better judge.
- **Make tab columns:** Make is now the outermost button on every row; a dish's batch slot sits inside it.
- **Not changed:** the goal title "Craft something at the workbench" belongs to the onboarding agent.
- **Measured for the owner (F7):** the human-paced bot is as sensitive as the tireless one: 500g more on day 7 lifts
  its year by 18% to 76% (seeds 42, 7, 99: 184k/140k/199k to 217k/246k/253k). The binding constraint is land (the
  32-tile home plot fills at once; the first plot costs 700g). A cheaper first plot or a little more starting gold
  would make the first fortnight matter less; left as an owner question.

## Eating: three dishes a day at full strength (owner default, round 3)

- No hard cap, but the 4th dish of a day gives half its energy and the 5th and later a quarter
  (`FULL_DISHES`, `LATER_DISH_SHARE` in `systems/food.ts`; stats `ate.day`, `ate.today`). Ten pies in a day give
  no more than five at full strength, so cooking lengthens a day without making it endless.
- The dish says it: from the 4th dish its card reads "Restores 20 now: dish 4 today.", the Eat button shows the
  real gain, and the toast adds "(dish 4 today)". A dish that would mostly be wasted is still refused.

## Trophies at home (round 3)

- The board trophy's data-driven `trophies` list now also holds Festival Ribbons (first places, `festivalWins`,
  house 4,2, `obj_trophy_festival`) and a Legend Wall (legendary fish, `legends`, house 7,2,
  `obj_trophy_legends`). Data only: the farmhouse becomes the place that shows what you achieved, and each one
  says its count when tapped. A test keeps every landmark and trophy on its own reachable tile.
- Four mastery goals are appended to the chain (goals are an index: append only): first place at a festival,
  beat Clay in four seasons, all four legends, the statue at level 6 (gilded). Each points at a trophy or the
  statue, so the late chain ends in things you can see at home and in town.

## Sim fidelity: a fisher (round 3)

- The sim bot can keep goods for the board (as "Ship all produce" now does) and fish four casts an evening
  (a real cast through `performAction`, three bites in four landed, the reel skipped); it now ships fish too.
- Measured over two years and three seeds: the keeper wins 23 of 24 board seasons, the fisher-keeper 24 of 24 and
  scores more points (fish rows are points only a fisher fills). The fisher's first year earns 44% to 58% more
  than the same farmer, although its fish are only about 2k by day 14: early gold compounds (more seeds, then
  land on day 28 instead of later). That is a property of the early economy, not of fish prices. Since critique
  11 it is bounded at under twice the pinned median (one farmer is too chaotic a yardstick: seed 7's fisher made
  2.1 times its farmer).

## The first week and the goal chain (owner defaults, depth round 4)

- **The sim bot was the spike.** Round 3's "500g on day 7 lifts the human-paced year by 18% to 76%" came from a
  bot that kept its ten starting parsnip seeds and spent its 500g on six cauliflower seeds: no income until day
  11, 1.5k earned by day 14, where a played farmer had 3.6k. The bot now plants what it carries first and, while
  gold cannot fill its free tiles with the best crop per tile, buys what pays back fastest per gold (parsnips
  early). It earns 3.3k by day 14, fills more spring crop rows (as in play), and the tireless median moved
  213,730 -> 261,631 (+22%, repinned; five seeds 226k to 273k, a narrower spread). Measured on 12 seeds, the
  same 500g on day 7 now moves the human-paced year by +4% on average (per seed -18% to +40%: year one stays
  chaotic, but it no longer compounds).
- **Settling-in pay (`game.json welcomeJobs`):** nothing ripens before day 5, so days 2 to 4 earned only the
  usual jobs (about 75g a day). Jobs posted on days 3 and 4 now pay double; the morning note and the Goal tab
  say so. Measured on the human-paced bot that does its jobs (5 seeds): days 3-4 earn 130-180g -> 260-360g,
  day 7 about 1.9k -> 2.0k, first plot day 14 -> 12, a 500g lump on day 7 moves the year by a median 0.8%.
  Chosen over a cheaper first plot (500g: first plot day 23 -> 17 for the bot that does no jobs, the same
  sensitivity) because it gives the empty days something to do and earn rather than handing out land.
  `tests/sim.test.ts` 'balance: the first week' bounds it (under 400g extra; days 1-4 under half the week).
- **Aside goals:** a goal marked `aside` (the two legendary-fish goals) no longer holds up the chain. The HUD
  shows the next goal; the Goal tab lists the open aside goal under "Also open". A goal finished past an open
  aside goal is remembered as the stat `goal.<id>` until `goalIndex` reaches it, so no save change; goals are
  still an append-only index and are not reordered. Goals beyond the current one never complete early.

## Critique 12 fixes (depth round 4)

The critic played the frozen round-3 head `6d5e480` (two 29-31 day keepers, a careless player, a first-week
player who does jobs; edge probes; a sweep; a sensitivity and race sim). No blocker or major. Its first-week
recommendation (fill days 2-4, do not cut the plot price, make the sim plant its starting seeds) is what the
section above did.

- **F1 the race was fair but not close** (keepers 12-5 and 13-6, every Clay point a crate, settled by day 13).
  Crates now come 7 days after his last one, every 2 days while you lead by 3, every day while you lead by 5
  (`CATCH_UP` in `systems/rival.ts`), never on day 28. A keeper filling about 0.6 rows a day stays a few points
  ahead and slack is punished. Sim keeper: 20 of 24 seasons, margins 1 to 6 (mostly 2 to 4); shipper 3.
  Clay still scores only on last-day rows (owner default: the crates are the catch-up pressure).
- **F2 the rule was not said and leading by 4 lost the day-14 crate** (`seasonDay % 3`): counted from the last
  crate, so a bigger lead never means fewer crates (tested over every day, last crate and lead). The score line
  says "You 12, Clay 10. His crate tonight." whatever the line below says; while you lead, that line says the rule
  ("Ahead 3+: his crate every 2 days."); his letters say "more often while you lead"; "Clay took one today: a
  point." says whether it scored.
- **F3 the season result was cut on a busy morning:** the result and the special's expiry are headlines that
  come first, and the sales list shrinks to two lines before any note is dropped.
- **F4 the chain froze on the first skipped activity** (all three farmers on "Pick up 3 wild goods" from day 5 to
  31): a shown goal whose stat has not moved for 3 days waits (`goalWait.<id>`) and the next goal shows, with a
  morning note; the waiting goal stays under "Also open" and still completes. Not while the guided start runs;
  never when nothing else could show. Goals now pay as you go, so the sims earn more: tireless median 251,354
  (pin 261,631, -4%), human-paced median 161k -> 198k.
- **F6:** "Special done! Thanks!" fits; the Bag tab tip wraps.
- **Not changed:** F5 summer for a farmer (crop rows come once a summer crop is within 7 days of ripe, about day 1
  for tomatoes planted on day 1; the critic's bot had not planted); "Board 16" on the bin row (requests plus
  the special, the toast splits it).

## One-thumb controls (PLAN-CONTROLS.md, owner decisions 2026-10-08)

Owner decisions: tap-to-move and auto tool on by default (both can be turned off; the floating stick always
works); auto tool never picks the rod or placeables; row work is a ~250 ms long-press then drag; Menu moves
into thumb reach once it acts on release; the 8-slot hotbar stays for now; light haptics, on by default;
iPhone 13/14 and Pixel 7 are the primary phones, the SE must pass; right-handed default, left-handed as good.

### M1 quick wins

- **Dock geometry is pure (`ui/layout.ts`) and every button owns its drawn disc:** `resolveTouch` gives a touch
  to the button it is drawn on, else (in overlapping touch margins) to the higher priority (Action), else to the
  relatively nearer one. Action moved 6 px in (12 px from the screen edge, clear of Android's back-swipe strip),
  Interact moved down-left to (104, 338) so Action owns its whole touch circle without covering any of
  Interact's disc. Measured: 0% of Action's disc and 0% of its touch circle go to Interact (was 10.8% of the
  disc). With 2.5 mm Gaussian jitter around aims spread over Action's whole disc, 0.6 to 0.8% still land beyond
  Action's circle near Interact: a thumb that physically lands on Interact presses Interact.
- **Menu and Interact act on a clean release** (`TouchButton` `fireOn: 'release'`): cancelled once the finger
  travels past the 8 px tap tolerance, and such a touch may become a joystick drag ("pass-through"), so a drag
  that starts on them never opens anything. Action and the hotbar still act on touch-down (speed).
- **Menu moved into the thumb arc** (58, 304), mirrored for the left hand: comfortable for both hands on iPhone
  13, Pixel 7 and SE in the reach model (was a stretch on the big phones), far from Action's resting arc.
- **A tap never walks:** gesture thresholds live in `input/gesture.ts`. The stick engages only past 9 px (was 6),
  wider than the 8 px tap tolerance, and a world touch that engaged the stick is never a tap (max travel, not
  the end point, decides). A still touch is a tap however long it lasted (a 300 ms tap acts like a 120 ms one).
- **Hold survives a rolling pad:** the old rule cancelled a pending hold after 4 px of vertical drift (1.3 mm on
  iPhone 13). Now a held press starts after 110 ms unless the finger has strayed 1.5+ px vertically and is still
  moving (no 0.5 px of vertical change for 60 ms = settled): that is a swipe on its way to a 14 px tool step. A
  pad that rolls and settles starts working at once. Swipes from 60 ms to 1 s for 18 px never act (unit test at
  a phone's 16 ms move rate; e2e at true speed). A tool step needs 14 px of mostly vertical travel.
- **Swipes skip empty slots** (`cycleSlot(state, step, skipEmpty)`); keyboard and wheel cycling still visit all.
- **The marker says yes or no in shape as well as colour:** 2 px brackets in the action's colour (white work,
  green gather, gold interact) when Action will act; four dim corner dots when it will not (`ui/targetMarker.ts`).
- **No silent world taps:** a tap with nothing to do from where you stand shows a fading ring on that tile and a
  soft click (M4 turns it into a walk).
- **Haptics (owner decision 6):** a `medium` kind (ripe harvest, level-up) joins `tick`, `success` and `error`.
  Every kind is throttled (tick 120 ms, medium 250, success 300, error 400) and a held action's later uses tick
  at most every 450 ms. Ticks on a successful tile action, a tool swipe, a slot tap and when Interact opens
  something. Vibration off means zero calls. Each pulse has a visible twin (effects, marker pop, hotbar).
- **Bin "Ship all produce":** one button low in the sheet ships every crop, fish, wild good, preserve and
  product; never seeds, tools, ores or crafting stock. Per-row All/+/- stay, so a mistake comes back with "-".
- **One-thumb benchmark and controls e2e:** `npm run bench:thumb` (thresholds per milestone in
  `scripts/bench-thresholds.json`, exits 1 on a regression) and `npm run e2e:controls` (in `verify`: iPhone 13
  and SE, both hands).

### M2 grid feel

- **Turn in place, only from a standstill:** a push in a new direction turns at once and walks only after
  90 ms (`TURN_HOLD_MS`); pushing the way you face walks at once; a direction change while walking adds 0 ms.
  Runtime state only (`MoveState` in `systems/movement.ts`), never saved.
- **Settle on release:** the farmer glides along the walking axis (110 px/s, at most 120 ms) to a tile centre:
  back to the last centre passed if it was less than 13 px ago (`SETTLE_BACK_PX`; 203 ms of walking), else on
  to the next one; never into a blocked tile. 13 rather than the plan's 12 because a release 180 ms after the
  sprite looked centred lands 11.5 to 12.3 px past it once frames quantize. The cost: letting go more than
  3 px before a centre (about 50 ms early) settles forward onto that tile, which is what was aimed at.
  A release 250 ms late is a full tile (16 px at 4 tiles/s) and cannot be told apart from a deliberate step.
- **Flicks are turns:** with turn-in-place plus settle, any flick up to 200 ms in a new direction ends on the
  starting tile, facing the new way.
- **Joystick axis hysteresis 1.25 -> 1.6:** a thumb held at 40 to 50 degrees with about 1 mm of drift
  flipped axis 2.0 to 2.4 times a second; now about 0.7 to 1.0 (unit-tested model). Choosing a new axis now
  needs a push about 58 degrees off the old one.

### M3 auto tool and control settings

- **Auto tool is a mode, not an override:** with a farm item in hand (hoe, can, scythe, pickaxe, seeds) or an
  empty hand, Action uses whichever hotbar farm item does the most valuable thing on the tiles in reach (the
  action handlers' priorities: harvest beats planting beats tools; then the tile in front; then the item:
  seeds, can, scythe, pickaxe, hoe). Holding anything else (the rod, a placeable, fertilizer, goods) is an
  explicit choice and Action does exactly what that item does, as before (owner decision 2: fishing and placing
  stay deliberate). Off in Options > Controls means "the item in hand only".
- **The hotbar selection never changes:** the Action icon shows what will be used (and pops when it changes);
  the marker shows where. Handlers read the selected slot, so a choice is planned and run with its slot
  selected for that instant (`withSelected`): no action handler changed, the registry API is unchanged.
- **One seed kind at a time:** the seed in hand, else the last seed planted (remembered in the save), else the
  first seed on the hotbar. A mixed hotbar never plants a surprise kind.
- **A held Action on grass now finishes the tile in front** (till, plant, water) before the sides, because
  planting outranks tilling. One hold prepares a tile completely.
- **Registry:** `registerAutoItem({ id, priority, eligible })` so a mechanic can make its tool auto-pickable
  without touching core files (docs/EXTENDING.md).
- **Save version 16:** `settings.controls` (autoTool, tapToMove, paint: on; stickSize 'm'; twoSpeed off) and
  `controls.lastSeed`; the migration adds the owner defaults, `sanitize` clamps each field (a real v15 save is a
  test fixture). All later control options ride in this block, so M4 to M7 need no further bump.
- **Options > Controls** (a page behind a "Controls..." button, laid out from the bottom up near the tabs):
  Auto tool, Stick size S/M/L (radius 18/24/32), Left hand, Vibrate. Switches appear as their milestones ship.
- **Haptic merge:** two pulses within 80 ms merge (a tile worked and a goal completed in the same frame buzz
  once); a stronger pulse replaces a weaker one, never the reverse.

### M4 tap a tile to walk there and act

- **One world-touch handler (`input/WorldTouch.ts`):** a touch that starts on the world view and stays within
  8 px is a tap whatever its length; after 100 ms still it previews (path dots and a goal marker in the intent's
  colour); release commits. A touch that moves past 9 px is the stick and never a tap (the preview is
  dropped). Touches that start in the dock or on a sheet never reach the world. The tile is read where the
  finger landed (touch-down), not where a rolling pad lifted.
- **What a tap means (`systems/tapIntent.ts`, pure):** interact with the thing on the tile > act on the tile
  (what the auto tool would do there) > walk onto it. Interact targets are magnets for 3 mm around their tile
  (converted per screen) when the tap would only walk or hit something solid; a tap that would act stays an act
  (tilling round a sprinkler never opens it). **Acts never snap:** a miss next to a crop walks, it never works a
  different tile, so a sloppy tap can never harvest, water or plant the wrong thing. Your own tile is never
  worked by a tap. Measured (e2e, 200 taps each, 1.5 mm toward the thumb base): a lone machine 100% at 1.5 mm
  and 89-97% at 2.5 mm; the bin, which has the mailbox beside it, opens the bin or the mailbox 100% / 94-97%;
  a single crop tile 64-86% / 36-49% (a 4-5 mm tile under a 2.5 mm spread), and 0 wrong-tile acts.
- **Touch offset compensation:** thumbs land below and toward the thumb base. Taps on the world are read about
  0.7 mm up and 0.7 mm away from the holding side (mirrored for the left hand), using the CSS reference pixel
  (about 6.3 CSS px per mm), half of the 1.5 mm offset the controls critic models. Not measured on a real hand.
- **Walking (`systems/pathfind.ts`, `stepRoute`):** breadth-first 4-way search on the collision grid (well under
  2 ms on a 60x60 map), to a tile next to the target from which the farmer faces it; doors are entered only
  when tapped. The walk follows tile centres through the same collision as the stick. The stick or a key
  cancels it at once; a second tap retargets; a villager stepping in the way stops it with a refusal ring.
  Unreachable: a ring, an error pulse and "Can't get there."
- **Off switch:** Options > Controls > Tap to walk OFF restores the old rule (only the 4 tiles next to you).
- **The target marker lies on the ground** (`MARKER_DEPTH` 0.95: above the ground, soil, tint and flat decor,
  below every y-sorted sprite at 9 + y). It always was under the farmer; facing up, its brackets peeked out
  beside the head and read as drawn over it, so acting markers now also wash the tile faintly, which reads as
  ground. An e2e check pins the order.
- **Bag fix:** after "Use now" the bag's selection cursor is cleared (it stayed on the emptied cell, so reopening the bag and tapping that cell deselected it instead of opening the card; found by the benchmark).

### Controls review 1 fixes (before M4 landed)

- **One threshold for still and stick (F2):** a touch is still exactly while its travel stays under 9 px, and
  the stick engages at 9 px; the stick zone now covers the whole world view and the dock, so every touch off a
  button is a tap or the stick, never nothing. Release buttons (Menu, Interact) cancel at the same 9 px.
- **Nudges are steps (F3):** the first tile of a walk from a tile centre commits after 4 px
  (`FIRST_STEP_COMMIT_PX`); the 13 px settle-back applies only once the walk has passed a centre. A push the way
  you face of 100 ms or more is exactly one tile; a new-direction push of 150 ms or less turns in place (turn
  hold 90 -> 100 ms); no push under 250 ms slides back more than 4 px (unit tests in whole 16 ms frames).
- **Taps during a swing are buffered, not dropped (F5):** the walk (even a zero-length one) waits for the swing
  lock and then acts.
- **Menu radius 14 -> 16 (touch 24), Interact at (98, 342) (F6, F7):** with 2.5 mm jitter around aims over
  Action's whole disc, Interact presses stay under 1% on all five phones (SE was 1.3-1.8%).
- **Hold settle needs 2 rendered frames (F9)** as well as 60 ms without vertical movement, so one long frame
  that holds touch events back never starts a hold mid-swipe.
- **The "nothing to do" dots are stronger (F10):** 2x2 at full colour on a darker 4x4 underlay, 85% alpha.
- **Settle window and reaction spread (F4, not met by design):** a tile is 250 ms of walking. Releases at
  sprite-centre + 180 +- 30 ms land 9.6 to 13.4 px late, anticipation (-40 +- 30 ms) 0.6 to 4.5 px early: 18 px
  of spread for a 16 px tile, so no position rule can catch both. With the back window at 13 px the model gives
  about 78% at 180 +- 30, 99.7% at 120 +- 30 and about 59% for anticipation; 14 px would give 90% / 38%. Kept at
  13 (the bench now has REACTION_SD and negative REACTION_MS to measure it). Tap-to-walk makes exact stick stops
  unnecessary for errands, and the two-speed stick (M7) is the precision answer.

### M5 paint a row

- **Gesture (owner decision 3):** a world touch held still 250 ms on a tile Action can work arms painting (a
  tick, a marker pop and the tile washed); from then the same finger paints instead of steering. Every tile it
  enters joins the row (4-way, gaps filled in straight lines, at most 12, only tiles with something to do);
  stepping back onto the previous tile takes the last one off. Lifting on the dock, or back on the first tile
  after a loop, cancels with nothing worked. A drag that leaves the 9 px deadzone before 250 ms is the stick and
  can never arm. A long-press without a drag works its one tile, exactly as a tap would.
- **Working the row (`systems/workQueue.ts`):** the farmer walks to each tile in the order painted and works it
  **until it is done for today** (on grass: till, plant, water; at most 3 uses, each waiting for the swing like
  a held Action), so one pass over grass leaves a planted, watered row and the 3x3 plot is two paints (prepare,
  then harvest). Energy is exactly that of single presses. Tiles with nothing left are skipped (one toast at
  the end); out of energy stops the row with one toast. The stick, a tap or a new paint cancels the rest.
- **Your own tile counts when painting** (painting is deliberate; the farmer steps off to work it), unlike a tap.
- **Options > Controls > Paint rows** turns it off (a long-press is then a plain tap).

### Owner rulings after controls review 2 (2026-10-09)

These replace the M3 and M4 entries above where they differ.

1. **A tap does only the obvious, harmless thing:** harvest, pick up forage, water a dry crop, clear weeds,
   mine a node, refill the can, cast the rod you hold (`TAP_ACTS`), or open and talk to things. A tap on grass
   or empty tilled soil just walks there; it never tills or plants. Tilling and planting go through Action or a
   painted row (paint is the deliberate way to work ground).
2. **A held Action repeats only the kind of step it started with:** a hold that starts by tilling only tills,
   one that starts by watering only waters, and it stops quietly (no error pulse) when there is no more of that
   step in reach. No till-then-plant-then-water chain in one hold.
3. **Seeds and explicit items:** what you hold always wins whenever it can act; auto tool fills in only when it
   cannot. Seeds: the selected seed, else the seed you planted last (anywhere in the bag), else none: Action on
   empty soil then says "Pick seeds on the hotbar first." with the error pulse. Never the first seed on the
   hotbar.
4. **No magnets:** a tap on a walkable tile next to the bin, the mailbox or any interactable walks there. Only a
   tap on the object's own tile, or on its drawn sprite (a villager's head, a tall machine: the topmost
   y-sorted sprite under the finger), opens it. Accuracy is then the tile's own size: on an iPhone 13 (5 mm
   tiles, the critic's 1.5 mm thumb offset) the bin opens on 97% of 1 mm-spread taps and 80% at 1.5 mm, and
   centre taps beside it walk 96%; on the SE (4 mm tiles) 88% / 64-68% / 88%.
5. **Painting a row is unchanged by ruling 2** (it is a deliberate gesture, not a hold): each painted tile is
   worked until done for today, with the seed rule above (no chosen seed: tilled and watered, not planted).
   One constant (`WORK_USES_PER_TILE`) turns it into one step per tile if the owner prefers.

### M6 reach and handedness

- **Tool ring (`ui/ToolRing.ts`, geometry in `ui/layout.ts`):** a sideways flick on Action (14 px, clearly
  horizontal, toward the middle of the screen or not) opens the 8 hotbar slots and "Bag" on an arc around
  Action (radius 50, from upper-left to lower-left; mirrored for the left hand). The same finger slides and lets
  go: items are picked by angle, a whole 19-degree sector, not by hitting the drawn disc; letting go in the
  middle or toward the screen edge cancels, empty slots cannot be picked. Every item centre is comfortable for
  both hands on all five phones (unit test). A flick never acts; vertical swipes never open the ring (unit
  test and e2e). The rod is one drag away (fishing's fixed cost 7 -> 4), the bag too.
- **Mirrored sheets:** `Modal.row` lays its buttons from the thumb's edge (`rowLayout`): left-handed, the
  primary button sits at the left edge and the icon and text follow; the same room for text either way. The
  bin's "Ship all produce" and the bag's "Use now" move to the left too; page arrows keep their order. Reach map
  (iPhone 13): left-thumb targets outside the comfortable zone on the bin, board, gift, jar and shop sheets
  went from 27 of 40 to 4 of 41 (the shop's top tabs and one arrow); the right thumb is unchanged.
- **Options rows sit low:** the Options tab lays out from the tab strip up.
- **Not done:** bag cells on the SE stay 37 CSS px. Eight columns on a 323 CSS px wide canvas cannot reach
  44 px (8 x 44 = 352); a 7-column bag would break the hotbar row's mapping. Left for the owner and the UI skin.

### Controls review 3 fixes (painting)

- **A slow tap is a tap (B1):** a paint that never left its first tile commits as a tap at the point the finger
  landed (walk, or one of the tap's obvious acts). Still touches of 240-600 ms on grass work nothing.
- **Resting before steering never paints (B2):** the arm moved from 250 to 300 ms; touches that land in the
  thumb's rest band (the lowest 44 px of the world view, right above the dock) never arm; and after arming, a
  push that gets 28 px from the start within 150 ms of leaving it is steering: the row is dropped quietly and
  the stick takes the finger from where it landed. A deliberate paint moves about a tile per 100-150 ms and
  passes. e2e: rests of 100-500 ms then a push walk and work 0 tiles; a 330 ms hold then a tile-by-tile drag
  paints exactly the row.
- **Line lock (M3):** the finger's main direction from where it landed (decided 3/4 of a tile out) and then the
  last two tiles set a line; the finger stays on it until it is a whole tile off (the next row's centre),
  measured from the landing height. Unit model (smooth wobble): a 3-tile row is exact 95%+ at 1.5 mm and 90%+
  at 2 mm.
- **Back to the start cancels (M4):** a row that grew to 2+ tiles and was dragged back to only its first tile
  works nothing.
- **Quieter rows (N6):** a painted row ticks once per finished tile (a ripe harvest stays medium), not per use.

### M7 polish

- **Help card two taps away:** Options shows a 2 x 2 card at the top (tap a tile: walk + do; hold, drag: a whole
  row; drag low: steer; flick Action: tool ring). Menu, then Opts.
- **First-run tips, once each:** after the third tile tilled one at a time with Action, "hold a tile a moment,
  then drag, to work a whole row"; after the third tool change by swipe or hotbar (not by the ring), "flick
  Action sideways for a ring of all your tools". The welcome tips say tap to walk and Action to till.
- **Fine stick (two-speed, off by default):** with it on, a push under half the stick's radius walks at half
  speed (Options > Controls).
- **Perf:** a tap-walking scenario (long routes with path dots) joins the perf run, and the tap planner (intent
  plus breadth-first path) is timed: about 0.2 ms per tap, budget 2 ms.
- **Haptics:** native taps map tick to a light impact, medium to a medium impact, errors to the error
  notification (a double pulse); the web uses the same patterns through `navigator.vibrate`. Strength is the
  owner's call on a real phone.

### Coordinator ruling after reviews 3 and 4 (2026-10-09): painting moves to Action

This replaces the M5 world long-press and the review-3 fixes above (rest band, steer check, line lock).

- **World touches never paint or till by duration.** A still world touch is a tap however long it lasts (walk,
  plus the tap's obvious acts); a touch that reaches the 9 px deadzone is the stick. World long-press painting
  is gone (`WorldTouch` no longer arms anything).
- **Rows are painted from Action** (`ActionPress` in `input/gesture.ts`, pure and unit-tested): hold Action
  still 300 ms (a tick and an icon pop), then drag. The drag direction picks a straight line from the farmer
  (the tiles next to it that way; 4 directions with 1.6 hysteresis, so a 2-3 mm wobble never switches line)
  and its length the number of tiles (the first at 8 px, one more per 10 px, up to 12; small because Action is
  40 px from the screen edge on its thumb's side). The line is previewed live; lifting commits, lifting near
  the start cancels with nothing done. A line can only ever be straight, so a wobble cannot add a neighbouring
  row. Haptics: one tick per tile added while drawing, one medium confirm on commit, nothing while the farmer
  works it. The farmer still works each painted tile until it is done for today (ruling 5 above).
- **Holding Action no longer repeats it on touch** (the hold now arms painting): a tap acts once; Space held on a
  keyboard still repeats for desktop testing. A press that wandered 9 px in any direction and did not become a
  swipe or a flick does nothing on release.
- **Action's four gestures:** tap (lift before 300 ms, under 9 px) acts once; a mostly vertical 14 px swipe
  changes tool; a clearly sideways 14 px flick opens the tool ring and never acts; hold-then-drag paints.
- **Tool ring:** only the hotbar's filled slots and Bag are on the arc (bigger sectors); radius 56 from straight
  up round to low; the finger's aim is corrected for the thumb-base pull (`compensateTouch`); sectors have gaps
  (0.44 of a step each side), so a miss between items picks nothing. Slide, rest 80 ms on the highlighted item
  and lift to pick; a flick lifted at once (within 120 ms, or without resting on an item) leaves the ring open
  as a tap menu (tap an item, tap elsewhere to close): never a silent pick. Model (7 items, 1.5 mm thumb-base
  pull): 93% right / 1% neighbour at 2 mm on an iPhone 13, 85% / 6% on the SE.
- **Options:** the volume rows sit last, right above the tab strip, so both thumbs reach their -/+ buttons.
- **Cost:** the 3x3 plot loop is now 15 gestures (a tap beside each row and one paint per row, twice), 590-610
  mm of thumb travel and about 21 s on an iPhone 13; it was 26 / 933 mm / 20 s before the controls work and 5 /
  ~230 mm / 16 s with world painting. A paint that could turn (serpentine) or a 3-wide swath would bring it back
  to about 5; both are owner questions in `agents/NEXT-STEPS-CONTROLS.md`.

## Guided start (onboarding agent, 2026-10-09)

- **Flow (day 1):** Rosa, the neighbour in `npcs.json` (not Mara, who keeps the shop in town), greets you in a strip at the top of the world with Left hand and Skip buttons; it goes away by itself after the first harvest. Then one step at a time: tap one of 3 ripe parsnips she left (tap to walk and act), tap the seeds on the hotbar, Action plants, Action waters, "Press Action: dig, plant, water" until 5 seeds are in (after two tiles tilled one at a time the line offers "Tip: hold Action, drag down: a row" with the row previewed; painting is never required, coordinator ruling), tap the bin and Ship all (the bin then closes by itself). Then the clock and the energy bar get one line each ("Days end at 2 AM. Sleep any time.", "Work uses energy. Sleep refills it."), and "Free time! Try the errand up top." hands over to free play: the goals are two errands (pick up 3 wild goods, with one by the house and two at the town gate; say hello to a villager), shown by their own goal arrows and by one-off introductions when a wild good or a new villager comes into view. The bed step comes in the evening (6 PM, or earlier below 25% energy), on the door then the bed (coordinator ruling: never send the player to bed at breakfast); the sleep goal reads "Sleep in bed when you're ready" and sleeping earlier is fine. The first guided morning keeps one news line (the letter). Day 2: water the dry crops (a count, the row tip after two, the pond when the can is empty), the letter, Menu > Goal (jobs), and the walk to town, taught with the stick (the hand drags from the open dock) until the gate is near enough to tap. Later features get one-off introductions when they first matter (late night, low energy, the shop, gifts, the board, Clay's board race from day 8 in town, the rod through the tool ring, casting, the mine, placing a machine).
- **Principles:** one instruction line at the top of the world view (or at its bottom while the target sits right under the top), a pulsing ring and a hand on exactly one target, and a HUD outline only where the line is about that element. A step is done by the game event or state it teaches (a stat counted from when the guide started or the step first showed, a watered crop, an opened sheet); an info line goes with the player's next touch after 1.2 s, never by a timer or a Next button. Nothing is modal and the clock keeps running: the guide never pauses time. The line is not a button: only its "..." is (Skip guide with a confirm tap, Next on optional steps after 45 s, Back; the menu closes after 4 s or on any other touch), so a tap aimed near the top always reaches the world. Refusals show in the coach line (a Hud hook), reworded where the game's text would mislead ("Not your land yet. Follow the ring.", "Can't get there." becomes "Tap the ringed tile."); first-time tips wait until both guided days are done.
- **Adapts:** targets are found live (nearest ripe or dry crop, what Action would do right now, the best row, the bed tile with a free side, the pond); an off-screen target gets an arrow where the way to it leaves the view; another map re-points to the door; a world target under an open sheet, or a button not on the sheet's page, points at the close button; the rod (or any item that turns auto tool off) in hand during a farm step points at the can or the seeds on the hotbar first; a step whose action is impossible is passed, one done early is passed (a day-1 step even before its moment, so an early night still finishes the bed step). Standing still on a spot the coach pointed at, the farmer turns toward the soil. After 15 s without progress the ring grows and the hand travels from the thumb to the target. Skipping says where to replay it (Menu > Opts > Controls > Replay guide, which never touches goals, gold or crops). Left-handed mirrors the hand and the buttons; Calm stills every mark.
- **Data and state:** steps are `src/data/tutorial.json` (validated at load; step ids may not reuse the flag names), rules are pure in `systems/tutorial.ts`, drawing in `ui/CoachMarks.ts`, a stat watcher in `mechanics/tutorial.ts`. Progress is stats (`tut.*`), so no new state. The new early goals (pick the parsnips, plant 5, sell in the bin, pick up 3 wild goods, say hello, sleep when ready) replace "till 6, plant 5, water 5, sleep, forage" and need save v17 to keep old saves on their goal ("till" moves to "plant", "water" and "sleep" to "pick up wild goods"). New games start two tiles further south (14,11) so the plot is on screen. `?tutorial=0` starts a bare new game for automated checks.
- **Retired:** the two welcome toasts (one taught the old "hold Action"), the "Drag to walk" ring while the guide runs, the swipe tip on the 2nd till (now on day 4), the paint and ring first-run tips once the guide has shown them, the summary tip "Hold the Action button..." (now "hold Action, then drag"), and the idle hint and goal arrow while a coach mark shows (they return in free play).

### Guided start, round 2 (onboarding agent, 2026-10-10)

- **Owner decisions (via the coordinator):** Rosa stays the greeter; tap-to-walk stays the default and the stick
  is still taught on day 2's walk to town; **the bed is offered once the day-1 errands are done** (`bedOffer`: a
  ring on the door, then the bed, "All done! Sleep, or keep exploring.", or "Sleep at home, or explore." where
  the errands end in town). It is an offer, not an order: it goes after 40 game minutes (20 s) outside the house,
  and the 6 PM / low-energy bed step still nudges a player who kept playing.
- **Day 2 is a rain morning** for a guided new game (`day2Weather` in `tutorial.json`, set as the forecast when
  the guide starts). Of the three ideas (fewer crops, the row paint, rain) it is the only one that removes the
  chore for every player, painters and never-painters alike, and it teaches weather where it pays: the sleep
  sheet says "Tomorrow: Rain. No watering needed." and the morning says the crops are watered. Day 2 is then the
  letter, the Menu's jobs and the walk to town. Daily watering moves to a one-off intro on the first dry morning
  (`waterDaily`, day 3 on the farm: "Sunny! Water your crops: N left.", the can, the pond and a row tip of dry
  crops; it ends when none are dry or the player leaves the farm, so it never nags). `water2` stays for saves
  whose day 2 is sunny (an older day-1 save, a replay).
- **The row tip** is now an unbroken row straight ahead from the faced tile (never another direction, never past
  a gap), limited to the step's work (`work: ["water"]` while watering: it used to preview a row of grass to
  till), and it **gives way after two refusals in a row** (round-5 blocker: a never-painter facing a planted tile
  pressed Action 376 times under the tip). "Something is already growing here." reads "Tap an empty spot, then
  Action." while planting.
- **Off-screen arrows follow the walk:** the scene gives the coach a `route` (the tap-to-walk path search), the
  arrow sits on the farthest walk tile in view (so a tap on it walks the way round the pond or the woodpile), and
  the stick is only shown when the next 4 tiles of the walk run straight ("Seeds are in town: drag to walk.").
- **Next to the target, the lit Interact button is pointed at too** ("Tap the lit button to open it."), since
  a tap a few px off a one-tile mailbox lands on the farmer's own tile. The mail step ends once a letter was read
  and the sheet closed (a gift left in a letter never loops back to the mailbox); with a gift waiting it points
  at Take gift, else Read.
- **Coach marks wear the art agent's sprites:** the line sits on `ui_coach_bubble` (ink text on parchment, walnut
  skin) with `ui_coach_bubble_tail` toward the target; the ring is `ui_coach_ring` at whole-pixel scales with a
  stepped pulse to `ui_coach_ring_wide`; the hand's fingertip is the art's (4.5, 0). While a sheet is open the
  HUD tag and the welcome strip are not drawn (depth's top toasts sit there; the line itself starts at y 76,
  below three two-line toasts).
- **Day 2's town before 8 AM (review 6, coordinator ruling):** the shop counter sells at any hour (only Mara stands
  there from 8), so the guide points at the counter ("Tap the counter to buy seeds.") instead of "opens at 8".
  No shop hours moved (`npcs.json` and `shops.json` unchanged; noted for the depth agent).
- **Never silent indoors:** the early goals (`gift` to `buy`) have a goal-arrow `where` for the house (its door) and
  for town (the farm gate). Gesture tips (ring, paint) wait for the guided days like `tips.json` (`tipsHeldNow`).
- **Settling-in jobs (depth round 4):** a one-off `welcomeJobs` intro on `game.welcomeJobs` days while a job is open
  (Menu, then Goal); it never shows without that data.

### Round 3 owner decisions (2026-10-09, controls round 3)

- **A press-and-lift on Action acts once, however long it was held** (`ActionPress.up`). A still press that
  armed painting and lifted without a drag is a tap (`cancel` then `tap`); holding never repeats on touch
  (Space on a keyboard still does). A paint dragged out and back to the start still cancels. The bag hint
  now says "hold Action, then drag, to work a whole plot".
- **A rolled press resolves to its likely intent:** a press that rolls 9-13 px without becoming a swipe or a
  flick is a tap when the finger stayed within 4.5 px for its first 100 ms (`ROLL_DWELL_MS`): a press whose pad
  rolled. One that moved at once was a swipe or flick cut short: it does nothing and says so (the error pulse
  and a 2 px shake of the Action icon, or a dim in Calm mode; logged as `press: reject`). Diagonal moves past
  14 px that are neither a swipe nor a flick also say no.
- **Painted paths turn corners (serpentine).** The first leg is chosen as before (4 ways, hysteresis 1.6) and
  locks at 2 tiles. A new leg starts when the finger is 14 px off the current leg's line, has been moving
  mostly sideways (over its last 6 px of travel, or since it began to veer 6 px out, so a corner cut round as
  thumbs do still counts), and the leg has tiles. The line is the finger's own trend (a
  weighted least-squares fit as it moves along, with a strong prior toward straight), so a slow drift or a
  thumb's arc tilts the line instead of turning it. Where the corner goes is the average of where the finger ran
  while it veered off (from 6 px out); past 13 px off the leg stops growing (the lift then settles the last leg to
  where the finger went). Dragging back un-paints tile by tile
  and round corners. The path never revisits a tile or the farmer's, stops at 16 tiles, and rows after the
  first stay inside the first row's span (an overshoot cannot paint past the plot). At a U-turn the step
  between rows is one tile, and a row one tile short of the box edge reaches it.
- **Paint step 10 -> 16 px** (about 5 mm). Every corner and row end is decided by the finger's position, and with
  3 mm bands the controls critic's 2 mm wobble model made a 3x3 serpentine exact in under 10% of trials on an SE.
  At 16 px (critic's 2D wobble model, corners cut 2 mm, 0-2 mm end overshoot; `tests/paintModel.ts`): σ 1 mm
  exact 90-100% with 0 strays on i13, SE, Fold and Pro Max; σ 2 mm 35-76%. Reach cost: a drag toward the screen
  edge on the thumb's side reaches 3 tiles, toward the middle 9.
- **Events:** `paintLine` keeps `dir` (now the last tile's direction) and `tiles` (the path's length) and adds an
  optional `path` (one direction per tile from the farmer). `paintEnd` is unchanged. New `ActionEvent` kind
  `reject` (UI only). No inputHub or gameEvents name was added, renamed or removed.
- **Ring:** radius 56 -> 64 on a wider arc (285 -> 105 degrees), dead zone 22 -> 36 px (a slide resting short of
  the items leaves the tap menu), and ring aims correct the whole modelled thumb-base pull (0.9 mm sideways,
  1.2 mm down; `RING_PULL_MM`). Picks go to the nearest item when it is clearly nearer than the next (by 15% of
  the spacing) and within 30 px, instead of by angle: a finger that lands short of the ring keeps its tolerance
  in mm. Model, 7 items: σ 2 mm right 98% / neighbour 0.3% on i13, 93% / 1.2% on SE, 95% / 0.9% on the Fold;
  σ 1.2 mm 99-100%.
- **Options:** the autosave note heads the rows and the rows sit as low as the tab strip allows; each row puts
  its more used switch on the holding thumb's side (mirrored for the left hand), with Sound and Vibrate in the
  two lowest rows. Reach model: both comfortable for either thumb on i13, Pixel 7 and SE; no hard target there
  (Quit is still hard on the Pro Max).
- **Bag:** tapping a bag item a second time brings it to hand (as the bag's help already said), so "Use now" no
  longer needs a reach across the sheet.
- **Taps on doors and solid art (guided-start findings):** a tap on a door tile walks through it; a tap on a
  solid tile with nothing of its own belongs to what it is drawn for: straight down through the solid run to an
  interactable or a door at its foot, else along the run's bottom row (a facade) to a door or to an
  interactable just below it (`tapIntent`, `solidOwner`). Multi-tile things (the bed, a counter) are reached from
  whichever side is open (`pathToFaceAny`): the top half of the bed no longer says "Can't get there".
- **Review 6 (controls critic) fixes:**
  - _Shown tiles never flicker or retract._ A painted tile appears at its boundary and goes only when the finger is
    back half a step (8 px) along the leg past it, or back near the leg's start; a corner never takes back a shown
    tile (it may only add one the leg had not grown yet), and a leg stops growing while the finger veers off
    sideways. Only backtracking along the path removes tiles. The critic's closed-loop painter (turns when the
    preview shows the leg): σ 1 mm 100% everywhere with ticks equal to tiles; σ 2 mm 89-91% on i13, 81-85% on SE,
    91-94% on the Pro Max (was about 60%). Cost: open loop, a rare first-row overshoot (about 3 in 100 at σ 1 on an
    SE) is no longer trimmed at the corner.
  - _Front-path taps no longer enter the house._ A tap on the bottom row of a facade (or the bottom edge of any wall)
    with open ground below walks to that ground (taps land low), except in the upper half of the tiles right
    beside a door; the roof, the upper wall and the door tile itself still lead in. Measured (critic's
    `r6-taps`, σ 1.5 mm): front-path walk taps entered 0/96 (was 6/48); door-art taps entered 48/48; taps aimed at
    the door tile itself 40/48 (the misses land on the path below the door and walk there).
  - _Ring:_ the dead centre is judged on the raw finger (a rest 22-35 px out stays a rest on every phone); sticky
    taps use the slide rule (nearest item, clearly nearer than the next, within reach).

## Sandbox workflow and dev tools (devtools agent, 2026-10-10)

- _Scenarios are data with two layers._ A raw `state` patch (written at the scenario's `version`, run through
  `migrate` and `sanitize`) for anything unusual, and semantic keys (`at`, `items`, `crops`, `goal`, `letters`...)
  applied through today's rules by name. The semantic keys are what keep fixtures alive across save bumps, so they
  are preferred; the base is always today's new game with a fixed seed (12345).
- _Dev code is a lazy chunk, not a build flag._ The published build keeps `?debug&scenario=` working (the owner can
  use the dev menu on the phone), but players never load it: the entry bundle only holds the dynamic import, the
  service worker never precaches the chunk, and `npm run build:store` (VITE_DEVTOOLS=0) removes it entirely.
  `scripts/check-bundle.mjs` proves all three.
- _The dev menu is HTML, not a Phaser scene._ A scene showed in every `getScenes(true)` check and drew into the perf
  budget; an HTML sheet adds no scene, no draw call and no game touch target. Its tab sits over the read-only HUD and
  only shows with `?scenario=`, `?devmenu` or in `npm run dev`, so older `?debug` suites never see it.
- _The lab shares the farm's soil._ Soil is one per game (`state.farm.tiles`) and tilling needs an owned plot, so the
  lab's beds sit at farm plot coordinates and the lab preset owns every plot. Fine for a sandbox; a real second soil
  map would need per-map soil.
- _Scenario pages are sandboxes._ From the first scenario on, saves go to memory, so jumping around in the dev menu
  can never overwrite a real save.
- _Fixed waits are ratcheted, not banned outright._ The 389 existing ones (scripts and probes) are allowed per file
  and may only go down; any new one over 100 ms fails the unit tests.

## Game feel (feel agent, round 4, branch feel/smooth)

- **Camera: pixel-locked follow (fx/PixelCamera.ts, fx/feel.ts).** Phaser's lerp follow with `roundPixels` floors
  the lerped scroll each frame: the lerp stalls up to 8 px short in one direction, the farmer hopped 1 px back and
  forth on screen walking right or down (125 reversals in 350 frames), and rested 8 px off centre depending on the
  last direction. Now the camera is the farmer's own drawn pixel minus a smoothed lag, and only the lag is eased
  (frame-rate independent, `1 - (1 - 0.12)^(dt / 16.7)`), with a 0.75 px hysteresis so frame-time noise cannot
  flip it. Walking steadily the farmer stays on one screen pixel and the world scrolls in his pixel steps; after a
  stop the lag eases out a whole pixel at a time; rest is always centred. Map edges have a soft 16 px knee (the
  camera slows to a stop instead of hitting the bound at walking speed). A teleport (> 48 px in a frame) cuts.
- **Camera at rest:** once the farmer stands still the lag catches up at 0.2 per frame, a pixel a frame at most,
  so the camera finishes centring about 200 ms after a stop (at 0.12 with the hysteresis it crept the last pixels
  for half a second). The bench's `settleCamera` waits for this, which adds 0.4-0.7 s to plot3x3 on i13 against
  the round-3 tree; the game is not slower (a painted 3-tile row takes 1710 ms on both), the old camera simply
  stopped up to 8 px short at once.
- **Walk timing (art critic, round 4):** 16 fps for the 8-frame walk at walking speed, scaled with the speed
  actually walked and held to 10-20 fps (planted feet would need about 37 fps, too busy for a cozy walk).
- **Tool timing:** the art suggested 90/50/110/80 ms for the hoe; the wind-up is shortened to 60/40/110/80 (the
  impact about 100 ms after the press, since a still press already acts on its lift).
- **A new game's long frames go under the wipe (feel critic, review 2):** the title builds its wipe with the
  screen, so the tap only starts it; leftover prewarm and the first map's parse run once it covers; the HUD and the
  world are built on separate covered frames, and a new game's wipe holds two frames more (the world's first full
  update). Audio work that landed in view right after the tap is spread out: effects and jingle instruments decode
  one at a time a frame apart (a cue asked for before its file is ready plays the synth, as before), the onset
  scan reads the peak from every 4th sample, and the reverb impulse is built in 4096-sample tasks 2.5 s later.
  What remains in view is the tap's own frame: creating the AudioContext inside the gesture (iOS needs it there),
  about 60-110 ms at 4-6x throttle on this host.
- **No acceleration ramp.** Stop precision is carried by settle-on-release (a decelerating glide to the tile
  centre); an acceleration ramp would shorten the 120 ms nudge that is exactly one tile, and the walk cycle now
  starts on a stride frame, which reads as the start of motion. Kept as is.
- **Walk cycle by distance:** one frame per 8 px (4 frames) or 4 px (8 frames, when the art lands), footsteps on
  the contact frames, so half speed, the settle glide and slow frames never slide the feet.
- **Map changes: a 4x4 ordered-dither wipe** in the palette ink over the world view only (HUD and dock stay):
  130 ms close (smoothstep), held 1 frame after the new map's first frame (its build hitch and the save happen
  under cover), 150 ms open. Its clock takes at most a 30 Hz step, so a long frame cannot make it skip. The same
  wipe closes over the title and the game opens out of it (no hard cut). Taps during the close are dropped on
  purpose (they aim at the map that is leaving); the new map takes input from the first frame of the open.
- **Tool swings with anticipation:** a 50 ms wind-up, then the impact (particles, sound and haptic together),
  100 ms strike, 110 ms follow-through when the frames exist (agents/out/feel/frames-wanted.md). With today's art
  the hoe's raised pose is the wind-up and the strike is a 1 px dip; the can and rod poses are already impacts and
  show at once. Only a tool's own use poses (a harvest with the hoe selected no longer shows the hoe). The tool icon
  swing turns in quarter turns only. Gameplay resolves on the press, as before; only the visual waits 50 ms.
- **Root after a swing:** the stick walks again 120 ms after a use (was 200 ms, plus 100 ms of turn-in-place when
  the push was in a new direction); a push held through the root walks the moment it ends. The 200 ms use lock
  (the rhythm of held and painted work) is unchanged.
- **Press-down states:** the dock buttons sink 1 px and light on the touch's own frame (no tween); the Action icon
  sinks with them. Action still acts on a still press's lift (round 3 ruling); the press-in is the touch-down cue.
- **Pixel integrity:** no fractional scales or free rotation on pixel art: the Action icon is 2x (was 1.9),
  the HUD bolt and drop 1x (were 0.8), particles 1-2 px squares, pops are a 1 px hop (or the art's pop frames;
  a whole-pixel squash still doubled or dropped columns, feel critic), the tile marker's pulse is a flash, the tap ring is redrawn by radius, the tool ring fades in.
  Remaining: static 0.8 / 0.62 scales of some placed objects and the coach marks' pulsing ring (onboarding's).
- **Calm mode** now covers sheet slides, particles, item hops, floating text, crop and object pops, swings, the
  hotbar rise, toast rise and hit-stop; fades stay (short).
- **Sheets** close with a 150 ms slide down, but the world and the clock run again on the frame the close starts
  and the sliding sheet takes no touches.
- **A tap on your own tile** (coordinator, new-player critic: two naive runs stood by the mailbox for minutes) uses
  the faced tile by the tap rules: an obvious harmless act first, else Interact; never till or plant
  (`ownTileTap`).

### Whole-pixel canvas scale (coordinator ruling, round 4)

The canvas was fitted to the screen at any scale, so game pixels came out 5 or 6 device px wide on an iPhone 13
and columns crawled as the world scrolled. Ruling: a whole number of device pixels per game pixel, floor-chosen,
the margin filled with walnut (`#4c2c1c`, never black) and split top and bottom (round 5: all at the top, see
below); where that gives up more than
about 10% of the fitted size, or would take the tightest touch targets (24 game px apart, the hotbar) under
the 38 CSS px bar on a phone that clears it at fit, keep the fit (a single nearest-neighbour step from the game's pixels; rendering at a
higher integer multiple first gives the same column widths, so it was not added). Measured with
`src/platform/displayFit.ts` (unit test `tests/display-fit.test.ts`), safe areas as in the bench profiles:

| phone             | fit (dev px per game px) | uneven columns + rows at fit | floor | size given up | now                                  | uneven now | lost |
| ----------------- | ------------------------ | ---------------------------- | ----- | ------------- | ------------------------------------ | ---------- | ---- |
| iPhone 13/14      | 5.72                     | 166                          | 5     | 12.6%         | fit 5.72                             | 166        | 0%   |
| Pixel 7           | 5.41                     | 245                          | 5     | 7.5%          | 5x                                   | 0          | 7.5% |
| iPhone SE         | 3.23                     | 141                          | 3     | 7.3%          | fit 3.23 (3x: hotbar 36 CSS px < 38) | 141        | 0%   |
| iPhone 15 Pro Max | 6.29                     | 176                          | 6     | 4.6%          | 6x                                   | 0          | 4.6% |
| Galaxy Fold cover | 4.20                     | 120                          | 4     | 4.8%          | 4x                                   | 0          | 4.8% |

Touch maps through the canvas bounds, so taps stay exact; hit areas grow to 44 CSS px from the live scale. The
canvas sits on the device-pixel grid in both modes.

### The dock sits on the bottom safe area (owner, round 5)

On a real phone the dock felt too high: the whole-pixel ruling had split the leftover walnut band top and bottom,
so on the phones that scale by whole pixels the dock floated above the bottom safe area. Now all of the leftover goes
above the HUD and the canvas's bottom (the dock) sits on the bottom safe area on every profile; the scale, and so
every touch target, is unchanged. Dock top y (CSS px from the top of the screen) and the gap left under the dock,
from `displayFit` with the bench profiles' safe areas:

| phone             | scale    | dock top before | dock top now | gap under the dock before | now |
| ----------------- | -------- | --------------- | ------------ | ------------------------- | --- |
| iPhone 13/14      | fit 5.72 | 596.1           | 596.1        | 0.3                       | 0.3 |
| Pixel 7           | 5x       | 637.0           | 701.3        | 64.7                      | 0.3 |
| iPhone SE         | fit 3.23 | 485.8           | 485.8        | 0.0                       | 0.0 |
| iPhone 15 Pro Max | 6x       | 654.3           | 674.0        | 19.7                      | 0.0 |
| Galaxy Fold cover | 4x       | 443.7           | 503.7        | 60.0                      | 0.0 |

The iPhone 13 and SE keep the fitted scale, which is height-bound on both, so their docks already sat on the safe
area. The 0.3 px is device-pixel rounding.

### iPhone 13 and SE stay at the fitted scale (coordinator ruling, round 5)

The owner's "menu looks buggy" came from fractional scaling (iPhone 13 5.72x, SE 3.24x: 1 px lines render
unevenly). Whole pixels there would break the touch floors: at 5x on the iPhone 13 a game px is 1.667 CSS px, so the
hotbar pitch (24 game px, 8 slots across 200 px) is 40 CSS px against the 43 px floor for phones 390+ px wide
(45.8 at the fit); at 3x on the SE it is 36 against 38 (38.8 at the fit). Keeping 8 slots over the floor would need
a 26 game px pitch at 5x (208 px) or 25.3 at 3x (203 px), wider than the canvas, so no gap or padding tweak helps.
Ruling (a): both keep the fitted scale and the floors stay (one-handed comfort outranks crispness); the art side
moves frame and UI lines to 2 px and drops the 1 px stripe patterns. Revisit with a 7-slot hotbar, or rendering at an
integer multiple with one smooth downscale.

### Sheets stop under the HUD; the menu's tabs and Close share two rows (round 5)

- A sheet is at most `GAME_HEIGHT - HUD_H` (326 px) tall, so the bag and Options no longer cut through the goal plate
  (the menu was 330). The morning summary keeps its old 340 cap: it shows under the night's blackout.
- The six 30 px tabs crowded "Make", "Skill" and "Opts" inside their 4 px frames (0 px to spare). Tabs and Close now
  share the old tab row and Close row as one grid (`menuTabGrid`): four 48 px tabs above, two tabs and a wide Close
  below; Close sits on the thumb's side (the left end for the left hand) and the tabs keep their reading order. The
  content area and the Options help card are unchanged.

## The Dry Year, M1 (depth lane, valley/m1)

### The first green is a night check with a day floor, and old saves are told apart by a marker stat

`valley.json` `farmGreen` (`shipped >= 5`, `minDay 4`) is checked in a `start` day hook, before the calendar moves:
five goods shipped by the night of day 4 or later wake the farm green the next morning (day 5 at the earliest, never on
a settling-in morning). `shipped` counts goods put in the bin, so the eve's bin counts. The plan's old-save default
(`sanitize`: green when `shipped >= 5`) would also green a _new_ save reloaded on day 2 with 5 shipped, so new games
carry `valley.on = 1` from `createInitialState`; `sanitize` applies the default (and marks the moment seen) only to a
save without it. No version bump.

### Rosa's letter: title card, kept in the mailbox from day 3

The letter is a parchment card under the logo on a first launch, New Game beneath it in the title's `buttons` (the
critic's bot finds it unchanged; no tap to dismiss). It is put in the mailbox already read on the morning of day 3,
not on New Game: the day-2 guide's mail step finishes on "some letter read", which a pre-read letter would satisfy.

### Ilse's tin and journal: one letter, one gift, a `comesWith` item field

A letter carries one gift in the save (`Letter.gift`), so the journal rides in the tin: items gain `comesWith`, and
taking the tin takes the journal too, or nothing if the bag cannot hold both. Both are a new item type `key`
(sell price 0, not giftable, not shippable). The gift line names both and may wrap to two rows (the mail test's
comment already allowed two).

### Conditioned lines and event variants

A line is a string or `{ text, when }` (`stat` or `place`, `min`/`max`). The pool is today's group (rain on some wet
days, else the hearts tier); a group with no line for today falls back to the tier below, down to the stranger tier,
which must keep one plain line (validated). Events take an optional `when`; events sharing an id are variants of one
scene (seeing one sees all). Rosa's 5-heart "Harvest thanks" has a dry variant (same reward) until the orchard, so
its "whole valley is talking" line is unreachable while the orchard is unrestored, without losing the reward.
Clay's day-7 letter keeps its rules (crates, 2 PM, 300g, trophy) in fewer words to fit 8 rows; it is titled
"Nothing personal".

### The dry palette is a runtime remap until the art lane bakes it

The straw tileset is made in code (`art/dryPalette.ts`, the same per-category table approach as `seasons.py`, with
categories from `tiles.json`): ground and baked grass transitions to parchment and sand, crowns to grey-green, never
orange or gold (so it never reads as fall), water, roofs, props and flowers untouched. It is made under the title's
wipe or the sleep blackout, resident only while an outdoor map is dry, released the first morning none is; the world
scene makes it only as a safety net. When `tiles_dry.png` / `tiles_<season>_dry.png` ship, they load under the same
keys (`tiles_placeholder[_<season>]_dry`).

### The first-green moment and A1 ambience use existing cues

Stepping onto the green farm the first time shows the HUD banner "FIRST GREEN" with the `special` fanfare (a jingle
of its own is an audio-lane request). A dry outdoor map gets a thin wind bed and a fraction of the birdsong; the
thinned music arrangement is left to the audio lane.

## Map stages (M2, valley/m2-maps, 2026-10-11)

- **Stage tables live in `valley.json` `maps.<map>` as `{ variants, delta, deltaText }`**, not the plain variant list
  sketched in WORLD-PLAN 4.1: the delta rects and their refusal line sit beside the stages they belong to, and the
  generator, the rules and the tests all read the one file. `systems/valley.ts valleyStage(state, map)` returns
  the variant, stage index, file and palette; `mapLook` is the plan's narrower name for the same thing. M1 owns the
  rest of `valley.json` and `valley.ts` (the letter, the first-green rule) and adds to them.
- **The dry creek bed is `stone` ground** (gid 20: walkable, not tillable on the farm, no ore outside the mine)
  inside the delta rects, with its own baked art. That avoids a 22nd placeholder tile, which would have renumbered the
  whole tileset. Restored, it is `water`, so fishing and the can's refill work there with no new code.
- **The footbridge (y 6) is outside the delta rects** and is `path` in every stage. Without it the restored creek
  would wall off the east strip and Ilse's gate for 28 rows. It reads as planks over a dry bed before the water comes.
- **One extra mouth tile (26,31).** The plan's x 26-27, y 3-30 touches the pond along one tile, and the shore bake's
  corner rounding (an opening of radius 14 px) closes any neck narrower than about 28 px, so the creek visibly
  stopped short of the pond. The second rect is [26,7,2,25].
- **Old saves: the delta rects are cleared every night**, not only when a stage changes. Nothing new can be put
  there (placing and tilling are refused), so in practice it runs once per old save that had something at x 26-27:
  soil and weeds go, a crop gives back its seed (its harvest when ripe), a placed object moves with its state to the
  nearest free owned tile, or into the bag. A morning line says so. Before that first night the bed is walkable
  and nothing breaks.
- **Every stage file is preloaded at boot and precached** (+2 files of about 90 KB now). WORLD-PLAN 9.3 says
  "cached at runtime, not precached", but a stage can change while the phone is offline, and a missing file at a
  door would break the 0.3 s door bar. Revisit if the eleven planned files grow the boot noticeably.
- **The creek repeats every six rows, in every stage, on one bank field** (`valleytiles.py creek_field`: the shore
  bake's geometry with noise periodic over 96 px). The dry bed (warm sand, pebbles, stranded stones, dead reeds, a dark
  cut lip), the damp bed (brown moist mud) and the running water (`creekwater`, the shore bake's look) share it, so
  the opening morning fills the bed instead of changing its outline (critic review 1: the first bed had straight
  edges and its own width, and read as a flagstone path). The pond laps into the mouth over a silt fan. About two
  dozen tiles per stage instead of 56: the farm's stages, the gate and the bridge took +73 tileset slots
  (512x1024 -> 512x1072) of the plan's 480. The waking bed has no rain pools, because any feature that big repeats
  visibly every six rows.
- **Wendhead is a 12x16 fenced placeholder behind Ilse's gate.** The gate is a door with `lockStat`/`lockMin`/
  `lockedText` (`world.ts doorLocked`): its tile blocks, and Interact or Action reads "Ilse's old gate. Locked." It
  opens at `valley.farmGreen >= 1`, as WORLD-PLAN section 1 says (critic review 1: the first-green letter points
  at it). The map art draws it shut; the scene draws it open (`gateOpen`, a tile id the generator writes on the
  door) once the stat holds. Until M3 replaces it, the first green opens the gate onto the placeholder.
- **`dev.goto` to the current map restarts the scene.** A stop and a start of the same scene in one step left it
  shut down every other call, which `dev.stage` and the e2e stages block hit.

## The Dry Year, M1 fixes after the critic's review 2, and M3 (depth lane, valley/m1)

### The first green is a dissolve, and the dry tileset stays loaded that one morning (coordinator ruling)

On the first step-out onto the green farm, the map is drawn once more with the dry tileset over the green one and
cut away in a circle that grows from the farmer with a dithered edge (`fx/GreenReveal.ts`, 1.2 s, eased; a plain
crossfade in Calm mode); the overlay is only there for those frames. Its banner has its own two-line slot ("FIRST
GREEN" / "The farm remembers.") and the ambience keeps the dry bed until the dissolve ends, so the birdsong swells
back as it glides. **Bent acceptance line:** M1 said the dry texture is not loaded in `valley-farm-green`; it now is
held from the first-green night until the next sleep (`revealPending`), and released then. Scenario
`valley-farm-green-reveal`, with a frame strip in e2e.

### Golden straw, not peach

Ground and baked transitions go to parchment with gold flecks and sand shadows (was sand flecks, which read as pale
peach and blurred the path's hue). Path against straw: luminance 1.48:1, ΔRGB 108 (green: 1.42:1, 114). Crowns stay
grey-green: no gold or orange there, so fall's dry farm still differs from fall's green one by its ground.

### The dry lines match what is on screen until M6 (coordinator ruling)

The town river still flows until the town's dry stage ships, so Finn's dry lines say the dryness is upstream ("The
Wend came down from the gorge, once. Town's water is all that's left."; the Heron "high and dry"). The legends letter
and the fishing goal's hint already match the screen. M6 switches back to the "mud and a trickle" lines, keyed on the
town's stage.

### Wendhead (M3): small, cheap, and on M2's stage system

Wendhead is 24x28 with two stages, `dry` (the pool and the creek head a stone bed) and `spring` (both run; the
final file keeps `wendhead.tmj`); M6 adds the gorge's stage. It has no dry palette: its dryness is the bed, so the dry
tileset is still released after the first green. The pool and creek share the farm creek's baked bed (periodic
rows), and the map uses no rock walls or tree borders, because every rock and crown cell bakes a tile of its own:
the map costs 64 tileset slots (512x1088 -> 512x1120). The gorge and the weir are left for M6. Ilse's gate now lands
at Wendhead's south-west corner (1,25).

### The restoration pattern (M3)

- A place's fund is a `projects.json` row with `place`: off the board, opened from the site as a one-project sheet
  with a single **Fund it** button (the gold and goods in one tap, enabled when the purse and bag hold them).
  Funding is not a project: the place counts once in `placesDone` and `projectsDone` at its opening. The project
  goals' texts now say "projects or restorations" (stats unchanged).
- A work day is the tap at the site itself (20 energy, once a day, no sheet); the site's sprite changes on the spot,
  one per work day, and the last (the water following the first cut) is also the restored look.
- The opening comes the morning after the last work day: the note, the maps' new stages, the villager beside the
  site until 18:00 with her opening line, and Clay's unsigned sack of fertilizer the morning after (a letter
  `from: "unsigned"`).
- The HUD's one line shows a valley step that can be done today and has not waited 3 days (the ask on its day,
  ready to fund, a work day, the opening morning), else the goal chain; THE VALLEY in Menu > Goal lists every asked
  place. Valley intros (`valley: true`) show at most one new a morning.
- The Hot Spring is the spring's site upgrade, the **Warm Pool** (same cost and perk, still after the library), its
  landmark at Wendhead; it opens once the spring is restored. The year-two sim funds it as the board's others (it
  restores the spring for that), so the Market Road and the statue still follow.

## The Dry Year, M4: channels and the plan's one save bump (depth lane, valley/m1)

- **Save version 18** (the one bump in the plan): `SoilTile.channel`, `CropState.tag`, `CropState.ripeFor` and
  `settings.strikeOffset` are accepted by `sanitize` (a channel holds no crop; the offset is clamped to 0-150); the
  migration from 17 is a no-op. The tag, ripe days and offset are unused until M8 and M5.
- **Ilse's spade is a key item, not a tool.** Every `tool` item is owned from day 1 in a fixed hotbar slot, so a new
  tool would have shifted the guided start's slots. The spade is a deliberate choice like the rod (an action handler on
  the item in hand, priority 45): the auto tool never picks it. It is handed over on the spring's third work day, or
  by Rosa's letter on the opening morning if the bag was full.
- **Digging from the bank.** A paint row starts from the tile in front of the farmer, so a drag from the creek's bank
  could never begin next to the water; a dig next to a farmer standing on the bank cuts the bank tile too (both cost
  energy). One drag from the bank digs a channel the water follows at once.
- **A painted row digs on and never fills in** (it would otherwise fill the channel it just cut on the tile's next
  use); Action on a channel outside a painted row fills it in.
- **Watering in the morning, as rain does**, not in `pre-growth`: the soil beside a reached channel shows watered on
  stepping out and that night's growth counts it. The balance is the same (one watering a day), bounded at 2 x flow
  tiles (48, what six quality sprinklers cover).
- **Channels are drawn in the map's detail layer** (water where the flow reaches, dug earth past it), so they add no
  draw call; the rules still read the ground layer. With the placeholder tileset the soil sprites are tinted instead.
- The flow cap says so where it bites: a cut past the flow says "The water runs out before here." once a day.

### M3 after the critic's review 4

- **A work day is a beat, still one tap.** The tap applies the day at once (energy, stats) and then plays about
  3.3 s with the world held (`runtime.busy`): three pickaxe swings with chips and the heap's top stone rolling off,
  or on the spade day two cuts beside the pool and the water running into the cut. The site's sprite is held until
  the beat ends (`ObjectsRenderer.hold`), so the heap visibly drops when it finishes.
- **The site is a 2x2 rockfall at the pool's mouth** (a 32x32 placeholder drawn from the site tile across the tile
  east of it), losing its top stones first so it is visibly lower each day; the site's solid tile is unchanged.
- **The opening lines are a scene in the villager sheet**, one a tap (a synthetic event `opening.<place>`, offered
  that morning only); it gives nothing and never counts as a heart event.
- **The creek's first morning** reuses the reveal: the waking stage (its dry bed) is drawn over the restored farm and
  cut away from Ilse's gate down (1.8 s) with a THE CREEK RUNS banner, starting when the creek comes into view (the
  overlay stays hidden until then, so it costs no draw call). Once (`valley.creekSeen`).
- **Toasts:** at most two on screen; the "Goal complete!" toast is dropped since the GOAL COMPLETE banner says it.

### M4 after the critic's review 5 (coordinator rulings)

- **Channels go on any open farm ground**, not just bought plots, so the verb works the day the spring opens: grass,
  dirt or flowers that no plot covers, or an owned plot. An unbought plot still refuses ("Not your land yet. Buy it at
  a sign."; a project's plot says what will stand there), and so do the creek bed, doors, buildings and anything
  solid. **A channel may cross a path as a culvert**: the path keeps its look and stays a path (nothing is drawn
  there), because the farm's main road splits the farm and a home-plot-only farm could never reach its crops from
  the creek otherwise. The first run is about 22 tiles (the bank along y 14, under the road, down x 13), inside the
  flow of 24, and waters the home plot's east column. Scenario `channels-home-only`, with an e2e.
- A dug row says "Channel dug: N tiles." instead of the tiles it skipped. The channels intro points at the creek's
  open bank (25,14) once the spade is in hand, then at the dig itself.
- **Wendhead's dry stage takes the straw palette** like the dry farm (palette only). The dry tileset therefore stays
  resident from the first green until the spring opens (one map is still dry), which the M1 rule already allows.
- Fall's crowns go dusty brown on a dry map (the fall tileset's orange and gold are remapped too).

### Paint edge hold (coordinator ruling after the valley critic's round 6)

A paint row grows one tile per 16 logical px of thumb travel, so a row drawn toward the thumb's own screen edge
(west for the left hand, whose Action sits 40 px from the edge; east for the right hand; down for either) had room for
only 1-5 tiles. Now, while the finger rests in the 36 CSS px (about 6 mm) edge band that the newest leg points at,
the leg keeps growing one tile per 180 ms with the usual tick, up to the 16-tile limit, for every paint gesture
(tilling, watering, planting, digging). Leaving the band takes the growth back, so a drift never extends a row and
dragging back to the start still cancels; a drift into another edge does nothing. The controls e2e checks a
left-hand westward and a right-hand eastward row reaching 10 tiles on the iPhone 13 and the SE.

## Languages: English and Brazilian Portuguese (i18n lane, i18n/pt-br)

- **No i18n library.** What the game needs is a key lookup, `{name}` params, plurals and number formatting: about 150
  lines on top of `Intl.PluralRules` and `Intl.NumberFormat`, which every target browser and WebView has. A library
  (i18next, FormatJS) would add 30-60 KB for features nobody uses (ICU messages, namespaces over the network,
  detection plugins). `t()` keys are typed from `en.json`, so a typo fails `tsc`.
- **Both dictionaries are bundled** (eager JSON imports, about 60 KB together before gzip, next to Phaser's ~1 MB):
  switching language is synchronous and works offline with the service worker unchanged.
- **Data stays English; a per-locale overlay keyed by the English text.** Putting keys in the data JSON would make
  every data edit two edits and turn the other lanes' merges into conflicts on every text field; an overlay keyed by
  data id (`items.turnip.name`) breaks silently when lines are reordered and keeps a stale translation when the English
  changes. Keyed by the English string, adding an item is still one data edit plus its translation, and an edited line
  shows up as untranslated in `npm test`. The overlay rewrites the text fields in place from an English snapshot on a
  language change, so no reader of `items[id].name` changed. Text fields are listed per file (`TEXT_FIELDS`).
- **Matching on text goes through English.** The guided start points at sheet buttons by English patterns
  (`^Read$`) and rewrites English refusals; `toEnglish()` maps any shown string back (a bounded memo of `t()`
  results plus the overlay), so tutorial.json needs no per-language patterns. Morning-note sorting does the same.
- **Language is a setting, not game state:** its own key (`lang`) in the save store, so no save-version bump, and the
  title can show Rosa's letter in the right language before any save loads. Order: `?lang=`, stored choice, device
  (`pt*` gives pt-BR). Automated browsers (`navigator.webdriver`) and scenario pages default to English so every
  check reads the same text on a machine set to Portuguese; a scenario picks Portuguese with `dev.lang`.
- **The switch applies at once.** The HUD, coach line and dock redraw on `onLocaleChange`; the open menu rebuilds;
  every other sheet is built from the dictionaries when it opens; the title restarts. Recreating the UI scene was
  not needed. The switch is the first row of Menu > Opts (thumb column) with the autosave note shortened to two
  lines beside it, so the help card still fits above the rows; a 58 px language button on the title serves a first
  launch.
- **Accented capitals draw into the line gap.** The 5x7 font has 9 rows; accented capitals get 2 more above the cap
  line (`TALL_GLYPHS`, a -2 px glyph offset), so line height and every layout stay as they are. Lowercase accents fit
  the rows above the x-height, the cedilla the descender rows.
- **Portuguese copy rules** (GLOSSARY.md): never gender the player; no article before a festival or place name
  whose gender varies; gold as "o" (ouro) because "50g" reads as grams next to produce (owner may overrule); 24-hour
  clock; seasons lower case in sentences. Some English strings changed slightly for plurals ("1 hour", "+2 board
  requests") and the Options autosave note is now two short lines.
- **Built blind.** The owner stopped all test runs during this round: the code was written by reading and editing
  only. Nothing was compiled or run; see NEXT-STEPS for the checks that must pass before a merge.
## The Dry Year, M6: the Weir (depth lane, valley/m6)

- **Old saves keep their river (coordinator ruling).** New games carry `valley.weirOn` from `createInitialState`; a
  save without it gets `place.weir` 3 and `valley.riverSeen` 1 once, in `sanitize` (`weirDefaults`): no opening, no
  moment, no Finn letter, and **no count** in `placesDone` or `projectsDone` (the player did not restore it, and a free
  `projectsDone` would complete project goals). This covers saves started on the Dry Year core deploy too: only games
  started since M6 play the dry town. No version bump. A scenario writes the marker as 0 to load as an old save.
- **Wendhead has four stages**, because an old save can have the weir restored before the spring: `dry` (both beds
  stone), `gorge` (the gorge runs, the pool waits; only an old save reaches it), `spring` (the pool runs, the gorge
  waits), `restored` (both; `wendhead.tmj`). Stage conditions nest (`all`/`any`); `pinStage` searches the bounds the
  table names when a condition nests (fewest changes first). The gorge is x 19-21, top to bottom, with a plank bridge
  at y 22 outside its delta rects; the weir's site is on its west bank (17,11), reached up a path at x 17.
- **The town's dry stage changes only D1** (x 17-20, y 22-31): stone ground baked as the farm creek's dry bed, so the
  dry tileset's 64 new slots are bed and bank tiles only (512x1120 -> 512x1152). `town.tmj` stays today's file tile for
  tile (a fixture test, `tests/fixtures/town-before-m6.json`); the trickle is the river's two east columns (20 water
  tiles). The Heron sits on the mud at 19,25-26 as `boat_t`/`boat_b` (`heron_aground_*` once art draws it), solid there
  (stage collision inside a delta rect only). The north-east house is boarded: its facade's `<tile>_boarded` once the
  art lane draws them, a bare wall and a cold chimney until then. Reeds, rock spurs and the mill wheel are left to art.
- **The sluice gate is bought in Orin's sheet**, not a shop row: Orin has no shop, and a one-off part does not justify
  a second shop panel. `valley.json parts` names the seller and price (500g); his sheet says the weir wants one and
  offers it while an asked place's fund needs it and the bag holds none. M5 replaces it with forging. Restoration gold
  for year one: 300 + 2,500 + 500 = 3,300g (under the 10,000g guard rail; tested).
- **The weir is asked on the morning its ask holds**, by a Finn letter that waits on `place.weir.since` (so an old
  save's default sends nothing): the spring open, the forge lit or summer 15 (absolute day 43), Finn at 2 hearts. Asks
  take hearts and days (`askHolds`); `HEART_POINTS` mirrors `POINTS_PER_HEART` (an import would be a cycle; tested).
- **The opening waits in town.** Finn spends the opening morning at the dock (16,32) beside the Heron, not at the
  site (`opening.at`); his opening lines are his scene there, and the site only says its phrase (and the Fish Ladder,
  its upgrade, after the canopy as before). His afternoons are at the dock from then on (a schedule row with `when`;
  rows sharing a minute are alternatives, the last that holds wins). The dock is 16,32 because a villager spot
  reserves its neighbours from props, and 17,32 would have moved Finn's bucket off today's town.
- **The last work day is scripted** (`taste: "beam"`, 3.6 s): the water comes through the gap and floats the last beam
  in. Placeholder shapes in `WorldScene.beamBeat` until the feel lane's pass; M7's towing replaces it.
- **The river's first morning** dissolves the dry town (its straw and mud, `town@dry` on the dry tileset) around the
  farmer on the first step into town, under "THE RIVER IS BACK" (`valley.places.weir.banner`), once
  (`valley.riverSeen`). The dry tileset is held overnight for it (`revealPending`) and released at the next sleep.
- **Fish follow the water.** `fish.json` rows take `place`; trout, salmon, the glimmer trout and the ice pike bite
  only with the weir (catfish, carp and perch stay in the trickle). Board requests never ask for a fish the valley
  cannot give (`fishOpen`). The Derby's catfish are stocked in the woods lake while the river is dry (`dryMaps`); its
  sheet names the water ("Catfish stocked in the woods lake today!"). The Derby is still entered at the board.
- **Finn's lines follow the town's stage**: "a trickle in town, mud where the river ran" while dry (the R2-2 ruling's
  switch back), the river's lines after. "The Heron" (4 hearts, two variants: on the mud, afloat) replaces "A secret
  spot" with its reward kept, under a new id, so a save that saw the old scene sees the Heron's story once.
- **The dry palette takes the baked creek bed and water banks** (`creekbed:`, `creekwater:` prefixes in
  `art/dryPalette.ts`, an art-lane file, two words): the dry town's river bed showed a green grass bank on straw.
- **`dev.goto` waits for the last map to stop.** A goto straight after another one found the old scene half shut down
  and the new one never readied.
- Not done in M6 (wrap-up): the R6-2 channels intro corner; Clay's `rivalLate` switch at the weir's opening (only his
  line ships); the art for the weir's site sprites, the boarded house, the Heron aground and afloat, reeds, rock spurs
  and the mill wheel.

## The Dry Year, audio (audio lane, 2026-10-11)

- **One jingle for every valley moment.** `green` plays for the first green, the creek's first morning and later
  place mornings: one recognisable "the valley comes back" motif, weeks apart, instead of a new jingle each time.
  It has priority 3, so a level, goal, heart or order within a second gives way. The dawn flourish is spent on a
  reveal morning.
- **Audio follows the map stage, by data** (`src/audio/stages.json`), and a dry-palette stage is thin by default, so
  a new dry stage needs no audio edit. Today's town (no variants yet) keeps its river bed because its map shows the
  river; M6's `dry` variant makes it thin, with a trickle.
- **Rain wins over thin:** the rainy arrangement is already sparse, and both together sank below -30 LUFS.
- **Water beds are positional** by tile distance (full within 1.5 tiles, down to a quarter over 12 more), flat on
  Wendhead; a storm takes them to 0.4.
- **No new downloads:** the new cues and beds come from members of archives that were already fetched and credited.


## The Dry Year, feel lane (feel/dry-year)

- **Channel juice is drawn over the map, never in a new layer.** The water into a cut and the morning's run crop the
  real wet tile out of the map's tileset and grow it from the side the water enters, so the art lane's
  `chan:wet:<mask>` tiles drop in through the same path; clods, drops and foam are pooled 1-2 px images (no
  Graphics), so the batch holds (at most 3 draws in the probes).
- **The morning run plays every day, once, on first sight**, not only for newly reached tiles: it is the day's
  "your channels watered the crops" moment that replaces the can, and it is short (65 ms a tile, at most 1.5 s).
  It waits until its first 3 tiles or half its tiles are inside the view inset by 16 px (feel critic C1-1), and it
  is keyed to the state object and day in memory only (nothing saved).
- **Edge hold: band and interval unchanged, exit hysteresis added** (feel critic ruling): enter at 36 CSS px,
  leave at 52 along the leg's axis. A faster interval was rejected because edge-grown tiles can't be trimmed one at
  a time (leaving the band takes them all back), so a 220 ms reaction would overshoot by 2 tiles at 120 ms.
- **The creek's first-morning reveal waits for the bed to be wholly in view** (it started as the view's edge passed
  x 25, with the bed still off screen).
- **Towing spike (M7):** tow by walking, with taps as the primary input (feel critic): a tap on the log walks over
  and hooks it, a tap on the water means the bank beside it, a snag holds the farmer where it caught and any tap or
  Action tugs, the cut walk resumes after a tug, and standing at the slip hauls the log in and lands it. A walk to
  the slip stops beside it so the log never lands on the farmer. Rules in `systems/towing.ts` (pure); the
  controller and placeholder art are debug-only (`src/dev/towSpike.ts`, stat `lab.towSpike`).

## Towing, round 2 (feel lane, feel/towing, 2026-10-12)

- **T1 was a near miss, not a lost goal** (traced, and the critic's correction): a chained slip tap aimed before
  the hook walk scrolled the camera landed on (15,28), the farmer walked there and stood one tile outside the haul
  range. Critic ruling: **a tow tap within 2 tiles of the slip (bank or water) means the slip**, and **standing
  within 2 tiles of it with the log free hauls it in** (`SLIP_REACH`, `meansSlip`, `atSlipBank`). The last tow goal
  is kept whatever set it (a tap, the chained tap, Action) and walked to after every tug, and an idle farmer with an
  unreached goal walks on by himself after 250 ms (never a stall that needs another tap). A replan of the hook walk
  no longer drops a chained destination.
- **Action is the one-thumb route through the verb, only while towing's context is live** (critic ruling;
  `systems/towing.ts actionVerb`, unit tested): snagged → tug; hooked and free → walk home to the slip's stand along
  the bank (then Action does nothing else while it goes or hauls: "busy"); not hooked → hook, but only with a log in
  view, the farmer within 4 tiles of the lane's water, and nothing in front of him that Action would act on (a ripe
  crop or forage good there wins). Otherwise Action does exactly what it did. A tap always wins over a pending
  Action route (it sets a new goal). The Action button shows the verb's icon (hook, slip, tug) while the tow owns it
  (`inputHub.actionIcon`, read by `UIScene.updateActionIcon`): a feel requirement for the go.
- **Forgiving targets** (critic ruling 4): a water tap within 1.5 tiles of a drifting log hooks it; a tap on the bank
  while nothing is hooked still walks normally; while towing, a tap on a bush or wall beside the lane means the
  nearest bank or water within 2 tiles (no silent tap).
- **A log lies along the lane's current where it is** (`alignAxis`), not along every pull of the rope: hooked from
  straight above, a log in an east-west lane stays east-west. Held against the inside of a bend, the rest of the
  pull carries it downstream until the rope can draw it straight again (`follow(..., along)`), so it never sticks at
  an inner corner or cuts across the bank. A tug pops it on the way it was going (the larger part of its step),
  whichever way it lies.
- **The long lab lane sits beside the showcase, not below it** (columns 26-47): extending the map south moved the
  spike's shore up the screen (the camera no longer stopped at its edge) and pushed the right thumb's slip tap into
  the hard zone. It runs west from a head just below the farmer and turns south to a slip that stays above the
  floating controls (a slip at the map's last rows sat against the Menu plate on the SE). The farmer walks the outer
  banks, so on the long leg the log trails behind and below him and a tug tap on it is in comfortable reach.
- **The lab draws below the UI**: added last at runtime, the lab scene drew over the floating controls (they sit
  inside the world's view since the dock went), so every lab scenario hid the Action plate and the hotbar.

## Owner bugs (feel lane, fix/owner-bugs, 2026-10-11)

- **Dry beds are not walkable (coordinator ruling, owner bug 3: "there is a bridge, but this bridge is above a
  walkable area").** A dry bed is a sunken bed below its banks, not a floor. Inside the delta rects every earlier
  stage blocks exactly where the map's final (water) stage blocks: the farm creek (both delta rects, the mouth tile
  included), the town's river bed (D1) and Wendhead's pool, creek head and gorge. The footbridge (farm y 6) and the
  plank bridges (Wendhead y 22) are the crossings in every stage, as they will be when the water returns. This
  replaces "walkable" in the M2 entry (the dry creek bed as `stone`) and the M6 entry (D1 "a walkable bed of mud").
  - Done in the data: `generate-maps.mjs` copies the final stage's collision into each earlier variant inside the
    delta rects (the ground, and so the dry look and the dry art, are unchanged), and the six variant files were
    patched the same way without regenerating (farm@dry, farm@waking: 55 tiles each; town@dry: 38, the Heron's two
    were solid already; wendhead@dry 112, @gorge 31, @spring 81). No variant had a solid tile its final stage lacks.
  - What it settles: villager routes, forage and weed spawns, onboarding paths and the day-2 walk are the same in
    every stage (stage walkability is now identical, `tests/maps.test.ts`), and nobody can stand on a tile that turns
    to water on load (the M6 critic's risk); a save already standing in a dry bed is moved to the nearest door spawn
    by the existing rescue (`farm-creek-rescue`).
  - Nothing relied on walking in a bed: no scenario, villager spot, zone or spawn is in a delta rect (already
    tested); the creek reveal waits for the bed to be in view, not for a step into it; channels are dug from the
    bank; placing and tilling in a bed still answer with the bed's own line (it is checked before "blocked"). A tap
    on a dry bed now answers "Can't get there.", as a tap on the water does.
- **The see-through hole eases, and opens only behind a crown (owner bug 1: "the tree faded and the character
  appeared fully, in a strange way").** Root cause: the hole was switched on at full size the frame any overhead tile
  came within 13 px of the body or the target circle, so it popped in and out, bit a disc out of a crown the farmer
  only passed beside (his head reaches 16 px into the tile row above), and its 11 px circles erased about 55% of a
  lone crown. Now (`fx/SeeThrough.ts`, pure and unit-tested):
  - it opens when overhead art covers the farmer's lower body, the 10 x 12 px above his feet: his own tile row, where
    the generator puts a crown only when its trunk stands further south, so behind a tree it opens and beside or in
    front it never does (the crown may then overlap his hair, which reads as standing beside a tree). Coverage is
    counted from the tiles' real alpha (read once per tile id from the tileset image; an unreadable one counts as
    opaque), with hysteresis (open at 36 px, close under 10) so a ragged crown edge cannot flicker it;
  - it grows from nothing and shrinks back over 150 ms (smoothstep, whole-pixel radii, the 2 px checker rim at every
    size, the checker fixed in world pixels). Still a stencil: no semi-transparent pixels (review 9 stands);
  - the body circles are 9 px (was 11): about 40% of a lone crown when fully open instead of 55%;
  - the target circle opens only when a crown covers the target tile's centre and the farmer is behind the crown or
    has stood still 250 ms facing it, never while walking past;
  - tall placed sprites follow the same rule (`behindBox`: feet north of the sprite's base row), and the layer or
    sprite keeps the mask until the hole has closed, so nothing pops back whole.
- **A tap while walking re-plans from where the farmer is (owner bug 2: "it kinda flicks").** Root cause: the new
  route started at the tile under the feet (`playerTile`, a floor), which for the first half of every step is the tile
  just left, so the farmer walked back to its centre facing backwards for a few frames and then turned again; and a
  held tap's path preview was overwritten by the walk's own plan the next frame (a one-frame flash of dots). Now
  (`systems/pathfind.ts` `routeStarts`/`replanFrom`): between two centres the walk is planned from the tile ahead on
  the axis walked and from the tile behind, and the shorter walk from the exact sub-tile position wins, ties and
  anything within 4 px going ahead. The speed, facing and walk cycle carry on (the route simply continues to the
  centre ahead); he turns back only when the new target really is behind him. A one-tile route mid-step finishes the
  step before it acts (it used to act from mid-tile), `walkTo` (the verb hook) uses the same planning, and the
  preview stays up until the finger lifts.

## Floating controls (UI lane, ui/float-controls, 2026-10-11)

The owner: "I want to remove the wooden dock at the bottom of the screen, it still feels big." The 112 px walnut band
is gone; the world runs from under the HUD to the bottom edge and the controls float over it. Nothing here was run
(owner order: no tests); every number below is arithmetic from the code.

- **Controls stay where the thumbs are, to the pixel.** Action (160, 324) r 28, Interact (98, 342) r 20, Menu
  (58, 306) r 16, the stick's home (56, 346), all mirrored for the left hand, measured from `CONTROLS_Y` (288, the
  old dock top, renamed). Reach, ownership, the ring, bench geometry and e2e coordinates are unchanged. The names
  `dockLayout`/`DockSpot` stay (historical) to keep the diff out of other lanes' files.
- **Plates, not a band.** Each round control is one baked texture: a solid 2 px ink outline, a 2 px wood ring, a
  walnut face and a solid 2 px soil lip under the face (`bakeButton`, walnut skin; plum keeps its old disc). The ink
  carries it over grass, straw and water; the wood ring carries it over the dark mine. Pressed, the face sinks 2 px
  onto its lip and turns soil in one frame (the old 30% cream glow and its fade were see-through). The Interact icons
  lost their alpha too. No semi-transparent pixel in any control at rest or pressed; only the show/hide fades of
  Interact, toasts and the joystick are transient. Draws: the same two textures per radius as before (body and
  pressed), so the batch is unchanged; the hotbar's lips go into the hotbar's existing Graphics.
- **Hotbar: the full 8-slot row, slimmed, not compacted.** 22 px faces on the 24 px pitch (2 px of world between
  faces), each on a 2 px soil lip, 2 px off the bottom edge: the whole row is 26 px tall (27 with its touch zones)
  against the 112 px band. The pitch is the touch floor (24 px = 38.8 CSS px on the SE, 45.8 on the iPhone 13), so the
  row cannot get narrower, and at 192 px it already fits the canvas; nothing needed compacting, and every slot keeps
  its one-tap access (the tool ring and swipes still work too). Compacting to "current tool + ring" would have broken
  the guided start's hotbar steps, the e2e and bench slot taps, and made the far slots two gestures away; a 7-slot
  hotbar remains the way to whole-pixel scales on the iPhone 13 and SE (ruling round 5). The selected slot keeps the
  gold ring, notches and ledge and now stands on 4 px of lip. The face keeps the bag's accepted slot frame (1 px ink +
  1 px rim, art round 5).
- **Slot touch zones meet.** Each zone is the whole pitch wide (it grew to 23.07 px on the iPhone 13 before, leaving
  0.9 px slivers between zones that would now fall through to the world) and runs from 1 px above the faces to the
  bottom edge: 24 x 27 px, 45.8 x 51.5 CSS px on the iPhone 13 and 38.8 x 43.7 on the SE.
- **The camera keeps exactly the old scrolls.** The viewport is 200 x 326 (was 214). `PixelCamera` takes the controls'
  band (112 px) as an inset: the follow centres the farmer in the 214 px above it, a small room is centred there, and
  the bottom bound lets a map's last row scroll up to `CONTROLS_Y` (the void shows behind the controls there, as the
  old view's edge did). So the farmer is never under a thumb, and a tile's screen position is the same as before at
  every scroll (unit test over every 8 px on four map sizes), which kept tap accuracy, coach geometry and e2e tile
  coordinates valid.
- **What "in view" means.** `WORLD_CLEAR` (74..288) is the view above the controls. The coach line's low position,
  its arrows and `inView`, the goal arrow's clamp, the channel morning run's "seen" test and the dev overlay's
  status strip use it, so nothing that must be read or tapped first sits under a thumb. The rain keeps its density
  over the taller view (90 -> 137 drops); ambient petals keep their count and spread over the whole view (about a
  third sparser).
- **Toasts and the item name.** Toasts stack from just above the controls (as before). The selected item's name
  moved from over Interact into the bottom of the toast lane on a solid walnut plate, hidden in one step after 1.5 s;
  toasts stack above it while it shows.
- **Taps between the controls reach the world.** `WORLD_VIEW` runs to the bottom, so `WorldTouch` treats a touch on
  no control as a world touch: a still one taps (walk or act), a moving one is the stick. A touch inside a control's
  touch circle or a slot zone is the control's (Phaser hit test, unchanged); a hidden Interact gives its area to the
  world. The stick's home is now open world: a still tap there walks, a drag steers. No plate marks it: the stick
  floats under the thumb anywhere below the HUD, and a plate there would only cover more world.
- **Safe areas.** The canvas already sits inside `env(safe-area-inset-*)` (`#frame` padding) with the hotbar flush
  on the bottom safe area (`displayFit`). Under it, the home-indicator strip is now ink (`#safe-bottom`, the
  theme colour) instead of the walnut margin, so no wood band shows under the world on an iPhone 13 (34 CSS px; zero
  on the SE and Android). The world does not extend under the home indicator: that would change the fitted scale and
  every touch target. Action and its mirror keep 12 px from the side edges (Android back swipe); the hotbar is taps
  only, which the edge gestures ignore.

**World gained.** The view is 12.5 x 20.4 tiles (was 12.5 x 13.4): +112 px of rows, +52% of area. The plates cover
about 9,000 px² of the old 22,400 px² band (Action 2,600, Interact 1,340 when shown, Menu 870, hotbar 4,220), so
60% of the band shows world (66% with Interact hidden): about +31% visible world in all, all of it below the farmer.

**To re-measure before merging:** `npm run perf` (12 draws, 3.5 ms at 1x: the tilemap layers now cull and draw a
52% taller view, and rain draws 137 drops), `e2e:controls` (the graze check now covers the hotbar row only, plus a new
"tap between the controls walks" check), `e2e:mobile` (new ink-strip check; slot zones are 24 x 27),
`e2e:onboarding` (coach geometry should be identical), `bench:thumb` against its baseline. `bench-thresholds.json`
is unchanged: no control moved and the camera scrolls are identical.

## Channel tiles drawn in code, appended last, looked up by name (art lane, Dry Year, 2026-10-11)

- Channel tiles are a 16-mask autotile plus culverts and creek mouths, drawn in `art-src/tools/channeltiles.py`
  rather than from Flow: exact seams and the 2 px rule matter more than painterly texture (the creek was done the
  same way).
- They go at the end of the tileset and the game reads them by name from `tiles.json`, so adding them moved no
  map gid; the `.tmj` files changed only in their tileset header. WorldScene indexes gids past a map's own tile
  count, so a taller tileset never breaks `putTileAt`.
- A channel hides flowers and tufts on its cell and restores them when filled in (the art critic's ruling); crowns
  stay. Water tiles are static, like the map's other water; the feel lane draws the moving front.
- The chars atlas split moved only the action frames (they are single-image textures, so any atlas works).

## Code review of dry-year-2 (review lane, review/dry-year-2, 2026-10-12)

- **Channels water after the places open.** `channels:water` moved from morning order 10 to 56, after
  `valley:places` (55) and before the post (60): the morning the weir opens, the 64-tile flow already waters, as the
  renderer and the morning run draw it. Nothing between 10 and 55 read the channels' watering.
- **Placing on a channel is refused** ("Fill the channel in first." / "Aterre a vala primeiro."), as tilling one
  is: the place handler used to delete the channel for free. A dig also clears a weed on its tile, as tilling does.
- **A re-planned walk never starts on a door** (`routeStarts` takes the same `avoid` as the path search). A tap on
  the door itself still walks there, from the tile behind.
- **Plot sign prices go through `fmtGold`**, so English now reads "1,200g" on the sign, like every other price.
- **The see-through hole's body box ends on the feet row** (`py - 11 .. py`, still 12 rows, so the 36/10 thresholds
  stand): it took the bottom pixel row of the tile above, which could hold a hole open after stepping out.
- **Labels in a tween are lifted clear of the plates too**; only floatText lines (named `RISING_LABEL`) are left to
  their own tween. A villager's bobbing "!" is lifted from wherever its tween puts it each frame.
- **A v1 save is an old save** (it keeps its river): `migrateV1` no longer copies a new game's valley markers.
- The review's findings, fixed and open, are in `agents/out/review-dry-year-2.md` (git-ignored scratch) and the
  coordinator's summary.
