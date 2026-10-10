# Decisions

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
  about 1 dB of its role target *at the output* (they were 1-3 dB under). Peaks are fixed at the source: a cue's
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

- **F1 Clay has teeth: requests stay two or three days** (`orders.json` `days`). Each morning filled and expired requests come down and new ones fill the free places, so a request you need a day to gather for can be taken by Clay at 2 PM, the best-paying one first. Rows say "Have 1/3  120g  2 days". Clay now stays in town until 6 PM, so his 2-heart perk ("comes at 5 PM") matches where he is. Old saves: a request with no last day ends the day it was posted (no version bump; `until` is optional). The sim earns about 10% more (more requests get filled), so `SIM_EARNED` moved from 208,549 to 230,261.
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
  mostly sideways over its last 6 px of travel, and the leg has tiles. The line is the finger's own trend (a
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
