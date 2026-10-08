# Tiny Acre: independent critique 2

Reviewer: independent QA lead and game critic, round 2. Build reviewed: commit `07d4c6a`, frozen copy at `/tmp/critic2/src/farm-game`, dev server on port 5192, headless Chromium (playwright-core), touch-enabled. The repo itself was not edited.

## What I could and could not verify

Verified by playing (real keyboard, mouse or CDP touch input, plus state set-up through `window.__farm`):

- New game, day 1 chores, the bed and sleep flow, day summary, year-end screen.
- Swipe-to-change-tool on the Action button.
- Land signs and plot purchase, hoe and can tiers (3), placing and re-interacting with jar, keg, loom, bee house, sapling, coop and barn.
- Every panel at 390x844, 360x640 and 430x932: Bag, Goals, Craft, Skills and Opts tabs, Shop (3 tabs and pages), Bin, Board, 3 villager sheets, Gift list, Plot sheet, Jar, Keg, Loom, Sleep, Summary and Year-end. The UI is a fixed 200x400 canvas scaled to fit, so layouts are identical at every size and only the physical scale changes. The 3 viewports therefore found the same defects.
- A 14-day rollover with 12 placed objects (coop, barn, shed, loom, keg, jar, 2 bee houses, 2 trees, 2 sprinklers, 32 crops): no page errors, no state corruption.
- Walkability: BFS over the live collision grid on farm, town and woods.
- `npx vitest run`: 37 files, 284 tests pass at this commit.

Verified only by reading code and data (said so each time it matters):

- Economy numbers: computed from `src/data/*.json` plus `systems/*`, with my own steady-state model. They are estimates, not telemetry.
- The audio mix: read, not listened to. A headless browser cannot judge it.
- Rod tier effect, pickup of a placed shed or loom (same behavior code as coop and jar), save and reload, the "newer save" title message, left-handed layout.

Not verified at all:

- The fishing mini-game (I did not replay it; critique 1 found it clear).
- Real-device frame rate, haptics and audio interruption.
- `npm run e2e`, `e2e:mobile` and `perf`.
- Native builds.

Environment caveat: the box was heavily loaded by another engineer's builds, and several of my browser sessions were killed or stalled. Some screenshots are DPR 1 or DPR 2 depending on the run. This affected speed only, not findings.

Screenshots are in `agents/critiques/shots-2/` (12 files, referenced below).

---

## 1. Did the "Critique follow-ups" actually work?

| Claim in ROADMAP | Result | Evidence |
| --- | --- | --- |
| First-week goal order (forage, buy before harvest) | **Works.** Order is till, plant, water, sleep, forage, buy, harvest, ship, fish, order, craft, place, preserve, quality. The linear chain is still a chain (see 3.1). | `goals.json`; day 1 played |
| Shop shows days to grow, sell price, "Too late now" | **Works, with leftover truncation.** The facts appear ("4 days 35g"), but the third fragment, "(owned N)", is cut: `35g (ow..`, `Finer crops (ow..`, `Spring fruit (o..`, `Cauliflower See..`. | shot 01 |
| Shop paging | **Works** (`<` `>` and 1/2). 5 rows per page. | shot 01 |
| Hotbar rules (produce to bag first) | **Works for produce** (`inventory.ts:60-70`). Made worse by **feed and animal items also claiming hotbar slots** (see M3). | code |
| Menu tabs at the bottom | **Works.** The tab row and Close sit at y of about 720 to 770 CSS px. But the **Bag grid is still at the top of the sheet**, around y 190 to 320 CSS px, out of one-thumb reach. | shot 07 |
| Swipe-to-change-tool on Action | **Works** (up is +1, down is -1, 14 logical px per step, a 10 px wiggle does nothing). **But it fires one use of the current tool on touch-down** (see B1/M1). | probe `t7` |
| Coop and barn pickup | **Works** (an empty coop or barn gave "Empty. Bring a chicken, or tap again to pick this up", then a second tap removed it). Machines, trees and bee houses cannot be picked up at all (see M2). | probe `t12` |
| Plots and land signs | **Works.** Sign, panel, buy, the dim overlay disappears, tilling is limited to owned land. The refusal text is wrong on land that is not for sale (see m6). | probe `t18`, shot 11 |
| Tool upgrades | **Works.** Hoe 3 tilled 4 tiles in a line for 2 energy; can 3 waters a line. | probe `t20` |
| Goal arrow after about 14 s idle | **Works** (`WorldScene.ts:58`, shot 08). It is a small yellow triangle at the bottom edge of the world view and easy to miss. The 40 s toast is separate. | shot 08 |
| Seeds refused when they cannot ripen | Works (code, `farmingActions.ts:82`). | code |
| Kale and the Winter 28 year-end | Kale is in the winter shop. The year-end fires on Winter 28 but says **"Year 2 results"** (see m1). | shot 06 |
| `sellBonus`, bin rejects machines | Works (code). | code |
| Toast backing, level-up sound | Works. The toast now has a dark backing and reads on grass. | shot 11 |
| Seasonal music | Tempo, key and chord loop change per season. **The melody does not follow the key** (see m4). | `audio.ts:375,395,406` |

Still wrong from critique 1 and not in the ROADMAP's "done" list:

- Action button icon is always a hoe silhouette (`UIScene.ts:58,308`).
- Truncation is still widespread (shop, bin, jar and keg panels, craft).
- Bag grid out of reach.
- No placement undo or confirm for big placeables.
- Villager favourites still hidden below 3 hearts, so gifting is blind.

---

## 2. Findings by severity

### Blockers

None. I found no crash, no soft-lock and no unwinnable state. The BFS shows every free tile on farm and woods is reachable and 2 unreachable tiles on town (21,32 and 22,32) are decorative. A 14-day rollover with a full farm is clean.

### Major

**M1. Swipe-to-change-tool also uses the tool (accidental till, water, plant, place).**
- `TouchButton.ts:48-54` calls `onPress()` on pointer-down, so `actionHeld` goes true. The swipe is only recognised after 14 logical px of travel.
- Repro (390x844, hoe selected, standing at the field, facing soil): press the Action button, drag up 24 px. The tool changes to the can, and the state shows `tilled: 2` and 4 energy spent. A second swipe with the can selected added `watered: 2`.
- Impact: with seeds equipped it plants; with a sprinkler, keg or coop equipped it places one. This is the exact "accidental placement" worry from critique 1, now caused by the fix.
- Fix: delay `actionHeld` about 90 ms, or start the action only on release if the finger did not move. Roughly 10 lines.

**M2. Trees, bee houses and machines can never be picked up.**
- Pickup happens only if a behavior's `interact` returns `{ kind: 'pickup' }` (`WorldScene.ts:475`).
- `fruitTree.ts:15`, `jar.ts:14` (jar, keg and loom) and `beeHouse.ts:41` never do. `canPickUp` in `jar.ts:12` and `beeHouse.ts:59` is dead code.
- I pressed E three times on a placed jar, loom and sapling: nothing moved. A mis-placed 400g sapling, 180g keg, 300g loom or 250g bee house is permanent. It also permanently takes the tile and blocks walking (all are solid).
- Combined with the missing placement preview (still open), this is the worst cheap regression in the new content.

**M3. The hotbar has 4 free slots and feed and animals eat them.**
- `HOTBAR_FIRST` (`inventory.ts:10-18`) includes `feed` and `animal`, but both are used by tapping the coop, never by equipping.
- A player with chickens, cows and sheep carries `chicken_feed`, `hay`, `feed_bale`, so 3 of the 4 slots go to things never equipped. Seeds, fertilizer, sprinklers, jars and saplings spill into the bag, which is reachable only through the Menu (far corner, tall sheet).
- Swipe-cycling also visits empty slots (8 stops), so going from slot 4 to 0 means 4 swipes.
- Fix: remove `feed` and `animal` from `HOTBAR_FIRST`. One line.

**M4. Sprinklers can only be placed on untilled ground, and there is no way to un-till.**
- `farmingActions.ts:136` refuses placing on tilled soil. The goal chain makes the player till the home plot first (goal 1) and the sprinkler recipe unlocks at Farming 2.
- A player who has filled the field has no legal tile for a sprinkler inside it. At the field edge a sprinkler covers 1 field tile. Quality sprinklers (diagonal, 8 tiles) share the same problem.
- Fix: allow placing on empty tilled soil (and remove the soil), or add an "un-till" action to the scythe.

**M5. The Bag grid is still out of one-thumb reach, and Menu sits in the far corner.**
- Menu button: logical (20, 306), which is the left corner on a right-handed layout. The Bag grid and its move-item flow are at CSS y of about 190 to 320 of 844.
- Craft (used constantly: fiber to jars and sprinklers) and the Bag live behind both.
- "One-handed" holds for the field loop (joystick plus Action plus swipe) but not for crafting, equipping overflow items or goal checks on a 6.7 inch phone.
- Fix: put the Bag grid at the bottom of the sheet (tabs above, rows next to the thumb), or add a long-press "quick bag" above the hotbar.

**M6. After the goals, the game runs out of purpose (see section 3 and 4).** Not a bug, but a design hole that shows up in the first year.

### Minor

- **m1. "Year 2 results" at the end of year 1.** `SummaryPanels.ts:165` prints `s.time.year`, which has already been incremented (`time.ts:36`). Shot 06.
- **m2. "Milks are waiting on the farm." and "Wools are waiting on the farm."** `animalHouse.ts:25` appends `s` to the product name. Shot 05.
- **m3. NPC sheet text runs off the panel.** `NpcPanel.ts:115-121` draws "One gift a day." at x=138 for shop villagers; at 190 px it is cut to "One gift a d". "Come back tomorrow." would be worse. Shot 03.
- **m4. Seasonal melody is out of key.**
  - Chords are shifted by `season.transpose` (`audio.ts:375`), but the melody (`:395`) and night bell (`:406`) use fixed C-pentatonic notes.
  - Summer (+2): D-major chords against C natural. Fall (-2) and winter (+5): minor loops against E natural. Expect audible clashes in 3 of 4 seasons.
  - Not heard by ear. One-line fix: add `this.season.transpose` to both note formulas.
- **m5. Truncation is still the house style.** Bin (`Silver Melon J..`, `have 4 b..`; shot 02), shop rows (shot 01), jar and keg panel subtitles (`Makes Melon Wine (have..`), craft (`2 Sprinkler, 10 Fiber, ..`). The layout tests only check static strings, not names built at runtime (quality prefix, derived goods, "owned" suffix).
- **m6. "Not your land yet. Buy it at a sign." appears on land that has no sign** (house surroundings, map edges, anything outside the 6 plots). `farmingActions.ts:208`, shot 11.
- **m7. Gift list is blind and unconfirmed.** It is sorted by value, so the first "Give" is a Gold Melon worth 465g for +15 friendship (neutral). One tap, no confirm, no preview of likes (hidden until 3 hearts). Shot 04.
- **m8. Wrong help text in machine panels.** The empty state says "Bring fruit for jam, or vegetables for pickles." for a keg or loom as well (`JarPanel.ts:52`).
- **m9. Upgrade rows use the energy-bolt icon for Hoe and Rod** (`ShopPanel.ts`, shot 12). Placeholder.
- **m10. The Action button icon is permanently a hoe** (`UIScene.ts:58`). With the can, a seed or the rod equipped it still shows a hoe. Open from critique 1.
- **m11. Welcome toast replays on every map change until the first till** (`UIScene.create`: `goalIndex===0 && !tilled`). Only matters if a player explores before tilling.
- **m12. Chat gift lost silently when the bag is full** (`friendship.ts` `chat`): `talkedDay` is set, the gift is skipped with no message.
- **m13. Hotbar slots are 23 logical px**: 45 CSS px on 390 wide, but 41 px on a 360x800 phone and 37 px on 360x640. Below the 44 px rule, and the hotbar is the one control without the "grow the touch area" trick the Button widget uses.
- **m14. Land is mispriced and shows no guidance.**
  - East field: 80 tiles for 1,200g (15 g/tile).
  - North Meadow: 30 tiles for 2,200g (73 g/tile).
  - Hilltop: 35 tiles for 2,600g (74 g/tile).
  - Worst deals sit nearest the house and are the first signs a new player sees (shot 09, "2200g" and "2600g" floating by the door on day 1).
- **m15. Day-2 tip is a winter tip** ("Winter has no wild crops, but kale grows...") on Spring 2; nothing the player can act on.

### Nits

- The "Drag to walk" label overlaps the joystick ghost's top arrow.
- Gold counter shows a tween lag in screenshots (12,209 against 12,345).
- The sleep sheet is available at 6:06 AM with no hint that the day is unused.
- Starting seeds: 10, but the plot is 32 tiles; day 1 ends with 22 empty tiles and 560 gold.

---

## 3. Economy and progression (computed from JSON)

Method: per-tile season profit from `crops.json`, `items.json` and replant cycles; animals from `animals.json`; machines from `machines.json` and the derived-value formula (`itemRef.ts`: base + multiplier x ingredient); orders from `orders.json` over the real candidate pool; quality from `quality.ts` (average multiplier 1.035 at start, about 1.10 mid, about 1.17 late). Cross-checked against the repo's own bot (`tests/sim.test.ts`): 51k gold earned in a year from crops alone, with spring at about 125/day and winter at about 1,400/day.

### 3.1 Crop profit per tile per season (net of seed)

| Crop | Season | Days | Profit/tile early, mid, late | Per tile-day (mid) |
| --- | --- | --- | --- | --- |
| Parsnip | Spring | 4 | 97, 122, 155 | 4.4 |
| Potato | Spring | 7 | 160, 194, 239 | 6.9 |
| Cauliflower | Spring | 10 | 316, 360, 427 | 12.8 |
| Tomato | Summer | 7 | 144, 171, 210 | 6.1 |
| Melon | Summer | 12 | 442, 499, 588 | 17.8 |
| Corn | Summer | 13 (+3 regrow) | 294, 330, 387 | 11.8 |
| Pumpkin | Fall | 12 | 483, 543, 637 | 19.4 |
| Yam | Fall | 5 | 186, 221, 270 | 7.9 |
| Kale | Winter | 7 | 205, 231, 272 | 8.3 |

Planting costs 0 energy and so does harvesting; tilled soil stays tilled. Only watering costs energy (1 per tap or per line). Energy rarely limits the player, while the can capacity (20) and taps do. Land is the real lever, and land costs 15 to 74 gold per tile.

### 3.2 Passive sources (per house or machine, steady state)

| Source | Capital | Net per day | Notes |
| --- | --- | --- | --- |
| Coop (3 chickens) | 400 + 1,050 | 140 to 154 | Payback 11 days. |
| Barn (2 cows) | 1,000 + 2,400 | 211 to 231 | Payback 16 days. |
| Shed (3 sheep) | 700 + 2,100 | 167 to 183 | Plus loom +62 per wool. |
| Max houses (2 each) | about 11,100 total | about 1,100 | Zero energy, 1 tap per house per day. |
| Bee house | 250 + 10 fiber | 19 | Max 5. Payback 13 days. |
| Jar, melon jam | 100 + 10 fiber | +62 over raw | 3 days. Max 6. |
| Jar, pumpkin pickles | same | +41 | |
| Jar, wild leek pickles | same | +10 | |
| Keg, melon wine | 180 + 15 fiber | +58 | 5 days. Max 4. |
| Keg, peach wine | same | +19 | |
| Loom | 300 + 20 fiber | +15 | |
| Fruit tree | 400 | 19 to 28 per day in its season, about 540 to 790 per year | Only one season of four. |

Orders (3 per day, 1.2 to 1.6x bin value, cap 1,200): about 1,050 to 1,500 reward per day if you hold every item, which is only about 100 to 130 above what the same goods would fetch in the bin. The candidate pool is small (14 items in spring, 17 summer, 14 fall, **7 in winter**) and **excludes tree fruit, eggs, milk, wool and honey**. One order (3 Melon Wine at about 1,196) pays less than the bin.

### 3.3 Income per day by stage (my estimate, gold/day)

| Source | Early (day 10, spring) | Mid (day 60, summer) | Late (year 2) |
| --- | --- | --- | --- |
| Crops (capital-limited early) | 100 to 200 | 600 to 1,200 | 2,500 to 4,000 |
| Animals | 0 | 250 to 450 | about 1,100 |
| Jars and kegs | 0 | 100 to 250 | 300 to 550 |
| Trees (in season) | 0 | 20 to 70 | 60 to 200 |
| Bees | 0 | 20 to 40 | 95 |
| Orders (premium only) | 40 to 100 | about 100 | about 130 |
| Forage | 50 to 120 | 100 to 150 | about 150 |
| Fish | 30 to 80 | 60 to 100 | about 100 |
| **Total** | **about 250 to 500** | **about 1,300 to 2,400** | **about 4,500 to 6,500** |

Total sinks that exist in data: plots 8,500, upgrades 36,850 (stamina alone 23,000), trees 4,800, animals 11,100, crafts about 7,700, so about 69k. At the mid income band that is spent by about day 80 to 100 of year 1 (fall). Stamina Tonics are the only sink left and they buy energy the player never runs out of.

### 3.4 What this means

- **No runaway loop.** Machines and animals are bounded by `max` and by the guard rails. Nothing pays more per effort than plain farming by a wide margin.
- **The problem is the opposite: gold becomes dead by mid year 1.**
  - Meaningful early (every day is a purchase decision) and mid (plots, houses, upgrades).
  - Meaningless in year 2: gold has no sink, the goal list ends at "earn 20k" (around day 45 to 75), and the year-end screen offers only "Keep playing".
- **Dead or trivial currencies.**
  - **Fiber:** buyable at 5g, so "20 fiber for a coop" is just 100 gold and weeds only matter as a minor free source. The scythe becomes pointless.
  - **Energy:** not binding because planting and harvesting are free.
  - **Hearts:** 250 points; 3 loved gifts plus 10 chat days maxes a villager, and perks then cap (Mara -15% shop, Rosa +6% quality, Finn +8% fishing). Done in under 2 weeks.
  - **Skills:** level 10 by year 1.
- **Trap choices.**
  - Fruit trees: 400g for 540 to 790 gold per year, against a chicken (350g for about 4,700 per year). The only reason to buy one is the 200g goal reward and a keg feed.
  - The 2,200g and 2,600g meadows (30 and 35 tiles) against the 80-tile East Field at 1,200g.
  - Parsnip, tomato and yam are never right after week 3 (cauliflower, melon and pumpkin dominate once capital is there).
  - Stamina Tonic (23,000g for +100 energy).
  - Sprinklers (see M4).
- **Every animal is a no-brainer.** All pay back inside a season. The real gates are Farming levels (coop 3, shed 4, barn 5, loom 5), which is reasonable.
- **Tuning note.** `balance.test.ts:109` caps animals at 1,000 per day and the data is already at 932 (before quality), so the next animal will fail the guard rather than inform the designer.

### 3.5 Goals

- 30 goals, all completable from the data and the stat plumbing (every `stat` name is incremented by code).
- `earn` goals say "selling crops" but count everything (eggs, jam, orders).
- **Goal 14 "5 silver or gold crops"** gates 6 easy goals behind a roughly 12%-per-harvest roll (about 40 harvests without fertilizer), so "Say hello to a villager" (30 seconds of work) can wait a fortnight. Make the goal chain tiered or parallel (critique 1's top item was only half-done).
- The 5-heart goal plus "earn 20k" are the only long goals.

---

## 4. Fun and retention: a compressed first 3 days

Played with real input.

- **Day 1 takes about 30 seconds of real time.** Till 8, plant 8, water 8 (6:46 AM). The goal chain then says "Sleep". There are 17 unused in-game hours, 560 gold in hand, 22 empty tiles and 2 seeds left. The first decision (what to spend 500 gold on) is locked behind the next goal. A day-1 "walk to town and buy more seeds" nudge is exactly what the first screen lacks.
- **Day 2:** a 35-tile walk to town (about 9 s), forage 3 goods, buy 5 items. This is the best part of the first 10 minutes: movement, a new place, a shop, goal money. Mara's sheet and the board are clear.
- **Days 3 and 4:** water, sleep, water, sleep. There is nothing to do until the first parsnips on day 5. This is **the weakest stretch**: two empty game days, no spending, no secondary activity unlocked. Fishing is goal 9 and the rod is in the hotbar from minute 0, but nothing points at it.
- **Day 5:** first harvest, bin, +175g. The loop clicks here, about 8 to 10 real minutes in.
- Minute-to-minute feel: tapping is good (hold Action to till or water 3 tiles, sounds and sparkles on quality, shake on refusal). There is no time pressure or fail state at all. Energy, time of day and seasons rarely push back, so after the first week the player is optimising nothing but gold.
- **Tedious:** 1 jar equals 1 item per 3 days, loaded through a panel one stack at a time; watering a large field with a 20-charge can; no "plant 5 in a row" for seeds (hoe and can have line tiers, seeds do not).
- **Unrewarding:** gifts (blind, minor), skill levels (a toast and a sound), animals that do not move, a bin payout that is a text list.
- **Comfort of the one-handed scheme.**
  - Thumb zones: Action (bottom right) and floating joystick (anywhere low) are good; swipe-on-Action is a real improvement; the hotbar spans the full bottom edge, so slots 1 to 3 (hoe, can, scythe, the most used) are in the hardest corner for a right thumb. Walking and acting are sequential, so a field loop is joystick, release, Action, joystick again.
  - Taps: tap-to-use on an adjacent tile also fires on short joystick flicks near the player (not reproduced, code only). Bin "All" and "+" are about 5 px apart.
  - Sheets: 250 logical px (62%) for Shop, Board, Jar and 330 (82%) for Menu. The bottom half of every sheet is reachable; the top is not. Menu content that matters (Bag grid) is at the top; Shop and Board rows start at about 410 CSS px and are fine.
  - Menu sits in the far corner on purpose. Mirroring for left-handed players works the same way.

---

## 5. Visual and audio polish

**Visual.**
- UI panels are consistent and legible: one pixel font, bordered sheets, hearts and stars. The Day Summary and Shop are polished.
- World art is clearly programmer art.
  - The house is a 10x5 tile brick rectangle with one door (shots 09 and 10); a coop is 1 tile. The town is a flat sand road with one striped awning; the woods are bare green. The interior is a purple box with a red 2x2 bed.
  - Animals and the player share a very small size, and the three animal houses overlap their own occupants (shot 09).
- Good feedback: gold star over anything ready, dim overlay on unowned land, pulsing target tile, quality sparkles, shake on refusal.
- Missing: a coin or number fly to the HUD, level-up and heart flourishes (listed in R1.4), animals that move, jar and keg "done" cue other than a small star, any seasonal ground art beyond a tint.
- The "2200g" and "2600g" floating price tags are the first things on screen and advertise things the player cannot afford.

**Audio (code review, `platform/audio.ts`).**
- Everything is synthesized. SFX set: 20 names; coverage of the new content is thin (no animal, honey, wine or tree sounds).
- Footsteps are a short high-pass hiss per step; there are rain and night beds and a day/night crossfade.
- Seasonal music (tempo, transpose, melody density, major or minor loop) is a good idea with one bug (m4): chords transpose, the melody does not.
- The melody is random pentatonic from a fixed seed, so the same bar sequence repeats forever.
- Audio-unlock and suspend handling look careful (gesture unlock, iOS prime).
- I did not listen. There is no automated check of key consistency (`tests/audio.test.ts` checks only ranges).

---

## 6. Code and test risks

1. **`tests/sim.test.ts` no longer matches the game.**
   - `FIELD` (x 11-28, y 17-27) is not the real farm (fields are x 5-12 and 17-24, y 16-25); `owned` is never set, so plots do not constrain it; the bot never forages, buys animals or fills orders.
   - The pass window is 15,000 to 400,000 (a 26x band), so it guards almost nothing. A real balance change will not fail it.
   - Rebuild it on the real plot rects with animals and orders in the loop, or delete it.
2. **Pickup contract is implicit.** `canPickUp` is only consulted after `interact` returns `pickup`, so behaviors that implement it (jar, bee house) are silently unpickable (M2). Make pickup a separate registry verb (long-press), not an interact result.
3. **Swipe regression has no test.** `TouchButton` press semantics are untested; the e2e only checks buttons exist.
4. **Layout tests cover static strings only.** Runtime names (quality prefix + derived goods + owned counts) are what truncates. Add a test that renders every item x quality x derived combination through `fitText`.
5. **Hand-laid panels with magic offsets** (`NpcPanel.ts:116` etc.). Each new panel is a new place to clip. A tiny row layout helper with a width budget would stop m3 and m5.
6. **Duplicated facts in strings.** "A home for up to 3 chickens", "Fast spring crop. 4 days.", "max 2 coops" live in descriptions and in `placeables.json` and `animals.json`. They will drift. Derive them (the shop already derives days to grow).
7. **Two idle timers** (`UIScene.ts:53`, 40 s toast; `WorldScene.ts:58`, 14 s arrow) both re-implement idle detection; the welcome toast is gated by a third condition (m11).
8. **Year handling:** `dayCore.ts:21` and `time.ts:36` order of operations produced m1; `yearEnd` is still a hard-coded special case in the day pipeline (festivals will repeat it).
9. **Hot-bar clamp is only enforced in `selectSlot`**; a stack in slot 8 or higher can be "selected" by direct state writes and used (I did it by accident in a probe). Not a player bug today, but fragile.
10. **`balance.test.ts` is a good idea** (data-driven guard rails). But the animal bound sits 7% above current data and ignores quality and happiness, and the orders cap uses `min(maxReward, 600)`, a number nothing else uses.
11. Singletons (`getState`, `runtime`, `gameEvents`) still prevent a second game instance, which is why my probes had to restart scenes through the live game.

---

## 7. Top 10 prioritized fixes (player impact per effort)

1. **Stop the swipe from using the tool** (M1). About 10 lines, high trust impact: stops accidental tills, plants, sprinkler and coop placements.
2. **Remove `feed` and `animal` from `HOTBAR_FIRST`** (M3). One line; gives seeds and fertilizer their slots back.
3. **Let machines, trees and bee houses be picked up** (M2). Long-press or a "Pick up" button in the machine panel (when empty), and an "uproot (refund 50)" for saplings. Add a one-tap Undo for the last placement while you are there.
4. **Allow sprinklers on empty tilled soil, or add un-till** (M4). Unlocks the whole sprinkler line, which is currently a trap.
5. **Add a day-1 nudge to town and move the "buy" goal up** (or run goals in parallel pairs). Fixes the idle 500 gold, 22 empty tiles and dead days 3 to 4 in one stroke; give days 3 and 4 something to do (fishing goal earlier, or a villager gift quest).
6. **Fix the cheap text bugs together** (m1, m2, m3, m8, m6): year label, plurals, NPC "one gift" text, machine help text, land refusal text. Under an hour.
7. **Move the Bag grid to the bottom of the sheet** (M5) and make Menu reachable from the right-hand thumb (or add a swipe-left on Action for "Menu").
8. **Fix the melody transposition** (m4). One line; the music is always on.
9. **Give gold a late-game sink and the goal list a second act** (see bold ideas): at minimum a tier of goals after "earn 20k" and a prestige-style upgrade ladder (kitchen, greenhouse, barn tiers) priced 20k to 100k.
10. **Rebuild the balance sim on the real map and loops**, then add jar, keg, animals and orders to it (Section 6 item 1). Without it every economy change is blind.

Honorable mentions: stop truncating (wrap, or show the numbers first and the name second), confirm before gifting (and show the item's reaction after the first try), price land by tile count.

## 8. Five bold ideas to raise the ceiling

1. **A real second act: restoration and festivals.** After the year-1 results, unlock a "Valley" meta-goal (restore the mill, the greenhouse, the bridge to the mine) paid in gold, produce and villager hearts, and add one fixed-date festival per season (fishing contest, crop show, bake sale, winter feast) scored from orders, quality and hearts. Gives gold a purpose past year 1 and a calendar to plan around.
2. **Make orders the planning game.** Show tomorrow's board in the evening, add animal goods and tree fruit to the pool, let the player reserve a jar or keg batch for an order, and pay more for rain-only or gold-star requests. Today orders are a lottery that pays about 100 gold above the bin.
3. **A living valley without new art.** Villager schedules and weather lines, a pet that follows you, chickens that wander, and a cow that stands in the pasture. The three villagers are static and max out in about two weeks, so this is where retention is cheapest to win.
4. **Context Action button.** The Action button picks hoe, can, seed or harvest from what is under the thumb (smart targeting already exists), the hotbar becomes "specials", and the joystick area gets a "Plant row" gesture for seeds. This finishes the one-thumb promise that the hotbar and swipe now only approximate.
5. **Risk and weather that matter.** Storms that wash out unwatered seedlings, a telegraphed frost on the last days of a season, a rare rainbow day that doubles forage. It turns energy (currently never binding) and sprinklers into real decisions and gives winter a mood.

## 9. Verdict

Tiny Acre is a tidy, genuinely playable prototype that has fixed most of what critique 1 complained about: the first week is no longer a dead zone, the shop tells you what you are buying, tabs moved to the bottom, plots and tool tiers give the field somewhere to grow, and the new content (trees, sheep, loom, keg, bees, kale) is wired through the registries without crashing a single day rollover. What it has not fixed is the thumb: the swipe that was meant to save reach now fires the tool, the Bag still lives out of reach, and the hotbar clogs with feed. The new content is also thinner than it looks: trees are an economic trap, machines and trees cannot be taken back, sprinklers cannot go where crops are, and the economy has no sink after the first year, so gold turns dead around the same time the goal list runs out. The first 10 minutes are pleasant until day 3, then flat until the first harvest. None of it is hard to fix; all of it is cheaper than the next feature. Do the cheap bugs first (M1, M3, m1 to m4), give days 1 to 4 and the post-goal game a purpose, and then think about real art.

## 10. Previous-critique items still open

From `critique-1.md`, not fixed in this build:

- Action button icon stays a hoe whatever is equipped.
- Text truncation with ".." in the shop, bin, jar and craft panels (partially improved by the shop facts).
- Bag grid and item-move flow far from the thumb (only the tabs moved).
- No placement undo or confirm for big placeables (and trees now cannot be removed at all).
- Villager favourites hidden until 3 hearts; gifting is blind; a disliked gift costs 20.
- Animals do not roam, the house is oversized next to a 1-tile coop, art is still placeholder.
- Orders can ask for things that cannot be obtained that day (rain-only catfish, town-only trout); the pool is also tiny in winter.
- The goal chain is still linear; a hard goal (silver or gold crops) can gate trivial ones.
- Balance tests still model crops only (`sim.test.ts`), with a stale field and a 26x pass band.
- No heart-gain or level-up flourish and no egg or jam collect animation (R1.4 leftovers).
- Tutorial toast replays on map changes until the first till.
- Fixed since critique 1 and confirmed: first-week order, shop facts and paging, menu tabs at bottom, swipe cycling (with the new bug), coop pickup, seeds refused out of season, `sellBonus`, bin ignores machines, kale, year-end on Winter 28, toast backing, seasonal music (tempo and key), fiber in the shop, save-from-the-future message (code), position repair on load (code).
