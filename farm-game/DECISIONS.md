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
