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
- **UI skin direction: walnut chrome + parchment content sheets**, approved by the art director. It is implemented behind `?skin=walnut` with chrome/content colour tokens (`C`, `CH` in `src/ui/theme.ts`); plum stays the default until the critic's round-1 fixes land (flat plates under text, sand slots in the hotbar, one selection style, ink button text, skinned letterbox).
- **Villagers stay on their native Flow grid:** heights are reached by deleting whole rows below the waist (no resampling), so faces keep their pixels; Orin gets a 24x32 frame.
- **Villagers have their own sheets** (`npc_<id>`, 4 directions x 2-frame idle) instead of the tinted player; the non-integer breathing scale tween is gone (it smeared pixels).

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
- **Phaser's own audio is off** (`audio: { noAudio: true }`): one AudioContext for the whole game.
- **Sources:** Kenney (CC0) and OpenGameArt CC0 for sound effects and ambience, Versilian Studios (CC0) for instruments; every file, page, author, licence and sha1 in `audio-src/SOURCES.md`. Nothing was listened to by a human while building it.

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
