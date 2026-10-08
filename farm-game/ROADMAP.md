# Tiny Acre roadmap

Where the game is, and what we build next. Ordered by how much each item improves the daily loop, with the
cheapest high-impact work first. Every item says how it plugs into the existing extension points
(see [docs/EXTENDING.md](docs/EXTENDING.md)), so it stays a module plus data, not a core rewrite.

Guiding question for every item: **is it fun on a phone, with one thumb, in a 5-minute session?**

## Where we are

Portrait, one-handed, web-playable. Farming with quality and fertilizer, foraging, fishing mini-game, crafting,
sprinklers, preserve jars, a town order board, three skills with perks, coop and barn animals, three villagers
with friendship, gifts and perks. 226 unit tests, e2e and perf budgets pass. Art and audio are generated in code.

Known gaps carried from earlier work (not yet scheduled below): the native Android and iOS projects are synced but
never compiled or run on a device; real-phone frame rate, haptics and audio interruptions are unverified; the balance
simulation's income floor was lowered from 20k to 15k gold after the quality system and should be re-tuned.

---

## Now: make what exists feel great (R1, about 1 sprint)

Status: R1.2 to R1.4 done and R1.5 partly done (see below). R1.1 needs a human with a phone.

Highest value per effort. None of this adds a mechanic; it makes the current ones land.

- [ ] **R1.1 Real-device pass.** Build and run the Android and iOS projects on actual phones. Check frame rate,
      safe areas, haptics, audio resume after calls, one-handed reach on small and large phones. Fix what breaks.
      Output: a filled-in device checklist in `docs/MOBILE.md`.
- [x] **R1.2 Balance pass.** Re-tune the bot simulation with animals, orders and fishing included. Targets: first
      year feels generous, a comfortable player finishes with a satisfying surplus, nothing is a runaway money loop
      (check eggs, jam and orders against raw shipping). Restore a meaningful income band in `tests/sim.test.ts`.
- [x] **R1.3 First-hour onboarding.** The goals teach in order, but add light guidance: highlight the current goal's
      target (the board, the pond, the coop), a short "what to do next" nudge after idle time, and a one-time
      explanation of hearts and quality the first time each appears.
      _Done:_ every goal has a hint (shown in Menu > Goals, and as a toast after 40 s of no input); seven one-time
      tips fire when quality, foraging, hearts, orders, animals, skills and perfect catches first happen. Not done:
      highlighting the goal's target in the world.
- [x] **R1.4 Juice and feedback.** Sparkles and sounds for quality drops, level-ups, heart gains and order
      completion; a satisfying collect animation for eggs and jam; screen-edge toasts that never cover the thumb zone.
      _Done:_ quality sparkles and "Silver/Gold quality!" text on harvest, forage pick-up effects, a cast splash.
      Not done: heart-gain and level-up flourishes, egg/jam collect animation.
- [~] **R1.5 Accessibility basics.** Done: quality shown by star count (silver one, gold two) as well as tint, and a
  "Calm" reduce-motion toggle. Still open: text-size option, larger touch targets option.

## Critique follow-ups (from `agents/critiques/critique-1.md`)

An independent agent played the game and reviewed it. Its report is kept in `agents/critiques/`. Triage:

Done in this round:

- [x] First week had dead days: forage and "buy items" goals now come before "harvest 5".
- [x] Shop rows were truncated and hid the facts: they now show days to grow and sell price, and warn "Too late now".
- [x] Seeds that cannot ripen before the season ends are refused with a reason.
- [x] Produce filled the hotbar: produce now goes to the bag first, seeds and machines to the hotbar.
- [x] Menu tabs moved to the bottom of the sheet, next to the thumb.
- [x] Empty coops and barns can be picked up (second deliberate tap); houses are capped at 2 each, jars at 6.
- [x] Farming level 10 "+5% sell price" now works; the bin no longer accepts machines.
- [x] Economy: jam and pickles multipliers lowered (jam 1.5x, pickles 1.3x), order rewards 1.2 to 1.6x with a 1,200 cap,
      forage spawns trimmed further (about 150 to 280 gold a day if you walk all maps).
- [x] Winter had no crops: added Kale (winter seed, 7 days, sells 95).
- [x] The year-end screen fired on Summer 28; it now fires on Winter 28 ("END OF YEAR").
- [x] Toasts have a dark backing so they read over grass; level-ups play a sound.

Still open (ranked):

- [x] Touch tool-cycle: swipe up or down on the Action button to change tool (with a one-time tip).
- [~] Side income (machines, animals, orders) is now bounded by data-driven guard rails in `tests/balance.test.ts`; the bot simulation itself still models crops only.
- [x] A save from a newer version now shows a message on the title screen, and New Game asks before erasing it.
- [x] A saved player position inside a wall or outside the map is moved to the nearest open tile on load.
- [ ] Placement undo for big placeables; confirm before placing a barn.
- [x] Fiber is now sold in the General Store (5 gold), so crafting is no longer capped by weed supply.
- [x] Seasonal music (tempo, key, chords, melody density per season) and sounds for level-ups, hearts and orders.
- [~] Art: tilled soil now reads as earth (done); the house is huge next to a 1-tile coop, animals do not roam (see R4.1).
- [x] A bobbing arrow now points at the current goal's target after 14 s of no input (per-map `where` in goals.json).

## Next: depth in the daily loop (R2)

Give players reasons to plan their day and their season.

- [x] **R2.1 Tool upgrades.** Copper and iron hoe, can and rod bought or crafted with ore/bars. Better hoe tills a
      line of tiles; better can waters an area; better rod widens the catch zone. _Plug in:_ tool actions read an
      upgrade level from state; recipes unlock by skill and friendship; one new data file for tiers.
      _Done:_ hoe and can tiers act on a line of 1 to 4 tiles for the same energy (can tier reuses the capacity
      upgrade); rod tiers widen the zone and shorten bites. Bought in the shop's Upgrades tab. Not done: iron/ore
      tiers (waits for the mine).
- [x] **R2.2 Farm expansion.** Buy extra plots with gold so the field grows over the first year. Gives gold a
      lasting purpose. _Plug in:_ `tillable` zones become state-driven; shop upgrade row.
- [~] **R2.3 Fruit trees and a greenhouse.** Done: four fruit trees (cherry, peach, apple, frost plum), one per season, saplings bought in the shop, ten mornings to grow, fruit every third day in season. Kale also gives winter a crop. Not done: the greenhouse (needs soil per map). Trees that regrow seasonally, and a greenhouse that grows crops in
  winter (today winter has almost nothing to do). _Plug in:_ placeable behaviors and the day-hook pipeline.
- [x] **R2.4 More machines.** Keg (juice, wine), loom (cloth from wool), bee house (honey), furnace (needs ore).
      Same shape as the preserve jar: a behavior, a recipe, derived goods keyed by `of`.
      _Done:_ `machines.json` now drives jar-like machines (days, XP, family -> product); added the keg (fruit -> wine,
      5 days) and the bee house (honey every 4 days, no input). Renderer uses a generic `status` hook. Not done: loom,
      furnace (waits for sheep and the mine).
- [x] **R2.5 Weather with consequences.** Storms that can damage unwatered young crops, a rare rainbow day with a
      forage bonus, wind that scatters forage. Telegraphed the evening before so players can react.
      _Done:_ tomorrow's weather is shown on the bed sheet and the morning summary. Storms (summer and fall) water
      the soil, shake ripe fruit off trees (pick it first!), make wet-weather fish bite three times as often and
      leave a rainbow morning with a second helping of wild goods.
- [~] **R2.6 Animal depth.** Sheep (wool), pigs (truffles), a petting action for happiness, animal products as
  order and gift targets, a hay-silo placeable for bulk feed. Animals roam beyond their house.

## Then: a living world (R3)

More people, more places, more to discover.

- [~] **R3.1 Villager schedules and events.** Villagers move between spots by time of day and weather; a birthday
  each with a bonus gift reaction; one short friendship event per villager at 2, 4 and 5 hearts that rewards a
  recipe or a perk. _Plug in:_ `npcs.json` gains `schedule` and `events`; the NPC renderer reads them.
  _Done:_ daily schedules (home, town, farm, woods) and birthdays (double chat, triple gifts, morning note).
  Not done: per-heart friendship events that reward a recipe or perk.
- [~] **R3.2 More villagers.** A blacksmith (tool upgrades), a fisher, a young farmer rival for the order board.
  Each is a JSON entry plus a role.
  _Done:_ Orin the blacksmith (tool-upgrade discounts by hearts). Not done: a fisher and a rival farmer.
- [x] **R3.3 The mine.** A fifth map with ore and gems, a pickaxe tool, energy-versus-risk floors. Ore feeds the
      furnace and tool upgrades.
      _Done:_ a mine north of the woods trail, a pickaxe (the fifth tool; saves migrate), copper/iron veins, crystals and
      rocks that respawn each morning, a Mining skill, a furnace (ore -> bars in 2 days) and bar-gated tool upgrades. _Plug in:_ map generator, tool action, forage-like spawn hook for ore nodes.
- [ ] **R3.4 Seasonal festivals.** One event per season on a fixed day: a fishing contest, a crop show, a winter
      feast. Orders, skills and friendship all feed into a score. _Plug in:_ a day hook that swaps in an event map
      state and a modal.
- [x] **R3.5 Almanac and collections.** A log of every crop, fish, forageable and recipe found, with page rewards.
      Doubles as a gentle hint system for what to try next.
      _Done:_ Menu > Book has six pages (crops, orchard, fish, wild goods, animal goods, preserves); unfound goods
      show as dark shapes, finishing a page pays gold.
- [ ] **R3.6 Mail and notes.** A mailbox that delivers villager letters, order reminders and gifts, replacing
      scattered toasts for slower news.

## Later: production polish (R4)

- [ ] **R4.1 Real art.** Replace generated placeholders with hand-made tilesets, character sheets, animal and item
      icons, a proper UI skin. All art is addressed by texture key, so this is an asset swap plus an atlas loader.
- [ ] **R4.2 Real audio.** Composed music per season and time of day, recorded or authored sound effects, with the
      current synthesized set as a fallback.
- [ ] **R4.3 Localization.** Move every player-facing string out of code and data into locale files. Text-fit tests
      already exist and will catch overflow in other languages.
- [ ] **R4.4 Store release.** Final app id, store listings, privacy statement, crash and error reporting, signed
      builds. Follows R1.1.
- [ ] **R4.5 Retention hooks.** Daily login streak, optional notifications ("your crops are ready"), seasonal
      cosmetic rewards. Only after the core loop is proven fun.
- [ ] **R4.6 Cloud save and cross-device sync.** Optional account, conflict-safe merges. Needs a backend decision.

## Engineering health (continuous)

Done alongside features, not as a separate phase.

- [ ] Keep `npm run verify` green on every change; add a unit test with every new system and an e2e line for every
      new player-facing flow.
- [ ] Grow the "proof" tests that add a feature through the registries without touching core files.
- [ ] Split `UIScene` and `WorldScene` further as they grow; panels stay one per file.
- [ ] Track perf budgets per mechanic (draws per frame, JS ms per frame) as the world gets busier.
- [ ] Keep save compatibility: every state change bumps the version with a migration and a migration test.

## How we decide what is next

1. Does it improve the first hour or the daily return? Do that first (R1, then R2).
2. Is it data plus a module on an existing registry? Prefer it over anything that touches the core.
3. Can it be verified without a device? If not, schedule a device pass right after it.
4. After each release, play a full in-game season and cut or rebalance anything that does not earn its place.
