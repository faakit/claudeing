# Tiny Acre: independent critique 1

Reviewer stance: skeptical game critic and QA lead. Build reviewed: git HEAD `cef51f2` (R1 roadmap commit), run from a clean `git archive` copy on port 5191, because the shared working tree was mid-edit by another engineer (farm plots work). On that live tree I hit a real page error, `ReferenceError: ty is not defined` in `WorldScene.rebuildGrid`, which I treated as work in progress and not as a finding. All 235 unit tests pass at HEAD. Viewport 390x844 at 2x, touch enabled, headless Chromium.

Screenshots are in `shots-1/` (12 small PNGs). Source, data, tests and docs were not edited.

## What I could and could not verify

Verified by running the game:

- New game, tilling, planting, watering, sleep, day summary and the board.
- Bag, shop, bin, craft, skills, options and NPC sheets, the fishing sheet states, and coop/barn placement and interaction.
- Walking from the farm to town.
- Tampered saves, by writing IndexedDB `farm-game/kv/farm.save` directly (12 variants).
- Order-board income, by calling `generateOrders` over 400 seeded days per season.

Not verified:

- Real-phone feel, frame rate, haptics and audio. I inspected the audio code only. Headless Chromium cannot judge them.
- Everything past about Spring 2 in real elapsed time. Later days were reasoned from the data and code, or reached by state seeding.
- Whether animals visually wander. They don't (see 6).
- A full-season human playthrough. Mid and late-game claims are from numbers, not from feel.

---

## 1. Fun and pacing

**The shape of the first hour (major).**

- The goal chain is strictly linear: till, plant, water, sleep, **harvest 5**, ship, buy seeds.
- Parsnip takes 4 nights (`crops.json` stageDays [1,1,1,1]). After day 1 (about 90 seconds of real work for 10 seeds) there is nothing to do on the farm until Spring 5.
- The HUD goal bar shows "Harvest 5 crops 0/5" for three days. The player is never told that the useful move is to walk to town and buy more seeds, or to forage and fish.
- The "buy seeds" goal sits behind the harvest goal, and goals only advance in order.
- Sleeping at 6:06 AM is allowed and costs nothing. A dedicated player gets a loop of "plant, water, sleep, repeat" for four days.
- The 40-second idle nudge is the only guidance. It is a toast with low contrast (see 3).
- **Fix idea:** make early goals non-blocking (show 2-3 parallel goals), or move "buy seeds" and "forage" ahead of "harvest". Add a day-1 push to town.

**Foraging beats the starting farm (major, pacing).**

- Free, zero-energy forage is worth about 300 (spring), 400 (summer), 440 (fall) and 420 (winter) gold per day if you walk all three maps. I computed this from `forage.json` weights times `items.json` prices. `tests/balance.test.ts` caps it under 450.
- Ten starting parsnips yield about 350 gold per 4 days, which is roughly 90 per day.
- So in week 1 "walk the woods and pick" out-earns the farm, which is the game's title.
- Forage is capped (farm 6, town 8, woods 14) and respawns daily.
- Nothing wrong with cozy foraging, but the farm needs a stronger early hook, or forage needs a day-one cap tied to a skill.

**The daily loop's hook.**

- The best hook is the order board: 3 fresh requests every morning at 1.35-1.9x value, visible on the morning summary ("New requests on the town board").
- Second best are the preserve jar timers and eggs waiting.
- These are good. The board is also the main reason to come back tomorrow.
- Weaker: the orders ask for random items (see 4), so the board is lottery-flavoured, not plan-flavoured.

**Boring and grindy spots.**

- Watering: unwatered crops simply do not grow, with no wilt or drama. At 1 energy per tile per day, a 40-tile field is daily busywork until sprinklers.
- Sprinklers are gated by Farming Lv 2 (60 XP), 12 fiber and 120 gold.
- Fiber comes only from weeds (4 per day, max 24 standing), so fiber is the real throttle for sprinklers, jars, coops and barns.
- Fishing costs 5 energy per cast (about 10-24 seconds of mini-game) for an average fish worth 25-46 gold, so about 5 gold per energy. The balance test floors it at greater than 2 gold per energy. It is a side activity, not a loop.
- Villagers stand still and say 3 lines per tier. All three hit 5 hearts in about 10-25 days. After that they have nothing for the player.

**Mid and late game is thin (major).**

- Gold sinks total roughly 30k: can upgrades 3,800, stamina 23,000 (5 tiers), barn and cows 3,400, plus building materials.
- The balance sim only models crops. Order income alone (below) is 750-1,700 gold per day if you can fill the board.
- Money therefore becomes meaningless somewhere around the end of summer.
- The remaining goal is "earn 20,000g". There is no farm expansion yet, and no tool upgrades, house or decor.
- **Winter is dead.** There are no crops (no winter seeds, `rainChance.winter` is 0). The only activities are forage (2 items), carp or perch fishing, animals, jars and orders. The roadmap admits this.
- "Year 1 results" fires on Summer 28 (`dayCore.ts:19`), though the README says four seasons. A new player reads this as the game ending, then fall begins. It is confusing framing. `YearEndPanel` ends with "Fall crops await".
- Year 2 is Year 1 again. Nothing changes.

---

## 2. One-handed portrait usability

- **Menu tab row and the whole Bag grid sit at the top of the sheet (major).** In `shots-1/05-bag-tabs-top.png` the tabs (Bag, Goals, Craft, Skills, Opts) are at y of about 200 CSS px on an 844 px screen. The first row of slots is at about 250 px. That is the top quarter of the phone.
  - A right-thumb grip can't reach the tabs without shifting the hand.
  - The same layout puts a lot of empty space in the middle of every sheet (Bag, Goals, Skills, Opts, Craft page 2).
  - **Fix idea:** put the tab bar at the bottom of the sheet, above Close, where the thumb already is.
- **No touch way to change tool or slot (major).**
  - `cycleSlot` is wired only to the wheel and Tab (`UIScene.ts:215-218`).
  - Every till, plant, water or fish cycle requires tapping hotbar slots 1-5 across the bottom row (23 logical px, about 45 CSS px, 1 px gap, `Hud.ts:20-25`).
  - Slot 1 is under the far-left thumb and slot 8 is at the far right. A right-thumb user can't reach slot 1 or 2 comfortably.
  - The Action button has no swipe or tap-to-cycle.
- **The hotbar fills with produce (major).**
  - The hotbar is slots 0-7: 4 tools plus 4 free slots (`game.json` hotbarSlots 8, toolSlots 4).
  - `addItem` fills the first empty slot at or above 4, so harvested parsnips, forage, fish and eggs take hotbar slots.
  - By the time the player owns seeds, a few crops and one fish, the 5th kind of item (such as cauliflower seeds) lands in slot 8+, off the hotbar.
  - To plant it they must open Menu, go to Bag (top of the screen), and swap slots. There is no auto-sort, favourite slots or "seeds always on the hotbar" rule.
  - The ergonomics are badly worse than the README suggests.
- Menu button is bottom-left, the Action button is bottom-right, and the joystick is anywhere low. That is fine for a two-thumb grip, but the README claims "one thumb". With one thumb the Menu is the farthest reach from a right grip, and left-handed mode exists only in Menu > Opts.
- **Accidental placement (major).**
  - With a coop, barn, jar or sprinkler on the hotbar, any Action press on free ground places it immediately. There is no confirm and no undo.
  - A sprinkler or jar can be re-picked with Interact, but an empty coop or barn cannot be picked up (see 5). A mis-tap permanently costs 400 gold and 20 fiber, or 1000 gold and 40 fiber.
- **Accidental sells.** The bin "All" button sits right beside "+" and "-" at about 38-40 CSS px wide. The bin can be re-emptied until sleep. The bin lists placeables (the Coop, 100 gold, in `shots-1/07-bin-truncation-coop.png`), so you can sell a coop item by mistake.
- Tap-to-act on adjacent tiles at y>=150 can compete with the floating joystick. Taps under 250 ms and under 8 px count as taps. That seemed to work in my pass, but I did not stress it.
- Smart targeting is decent. Case in point: standing at tile 14.5, the hoe worked the tile to the left rather than the one straight ahead (tilled 13,14-16 while the highlight showed the front tile). It works, but the reticle and the result disagree.

---

## 3. Clarity and onboarding

- **Text is truncated with ".." in many places (major for a numbers game).**
  - Shop descriptions cut the key facts: "Potato Seeds / Spring crop. 7 .." and "Cauliflower See.." (days to grow and name are clipped). See `shots-1/06-shop-truncation.png`.
  - Bin rows read "Gold Wild Berr.. / 141g have 2 bi.." (`07-bin-truncation-coop`).
  - Rosa's blurb reads "Your neighbour. Knows so.."
  - Jar rows read "Makes Silver Tomato J..".
  - The text-fit tests pass because truncation counts as fitting. The player doesn't get the info.
- **Shop shows no sell price, no days to grow, no profit.** Buying seeds is blind unless the description survives truncation.
- **No warning when a crop can't finish before the season turns.**
  - `checkPlant` only checks "is it in season". On Spring 22 a player can plant 10-day cauliflower and lose it on Summer 1 with no warning.
  - The only mention is a tip on the sleep sheet.
- **The tutorial toast is unreadable on grass.** `01-start-hint-contrast.png` shows dark-green text on mid-green grass ("Welcome to Tiny Acre!"). The same toast lingers over the farm after you enter the house, and stacks with the "Nothing equipped." and "2 cows moved in!" toasts. See `10-animals-scale-toasts.png`: three layers of text overlap in the lower world area.
- **Action button icon goes stale.** With an empty hotbar slot selected the Action button still shows a hoe, while the toast says "Nothing equipped."
- **Fishing sheet is clear.** "Waiting for a bite..." then "! TAP NOW !", the catch bar and the "Reel in and leave" button all read well (`11-fishing-states.png`). Nothing else in the game is this clear.
- **Villager favourites hidden.** Gift likes only unlock at 3 hearts ("Reach 3 hearts to learn their favourites"). Until then gifting is blind, and a disliked gift costs 20 points.
- **Friendship perks do real work, but are discoverable only in the NPC sheet.** Mara's discounts apply to seeds and animals; Rosa's and the skill quality bonuses stack. Nothing explains "stack".
- Goal text is good, and the hints are clear (README, goals.json). The weakness is order and timing (see 1), not wording.
- **Dead perk shown as real.** Farming Lv 10 promises "+5% sell price" (`skills.json:26`, `sellBonus`). Nothing in `src` reads `sellBonus`, so the perk does nothing.
- "Skills give you 0 extra energy so far." reads oddly (Skills tab footer).

---

## 4. Economy and balance

All numbers computed from the data files. Quality adds about 1.1x on average (silver 1.25x, gold 1.5x).

**Crops** (net profit per tile; energy = 2 to till + 1 per growth day):

| Crop                                                | Grow days | Profit/tile | Per tile-day | Per energy |
| --------------------------------------------------- | --------- | ----------- | ------------ | ---------- |
| parsnip                                             | 4         | 15          | 3.8          | 2.5        |
| potato                                              | 7         | 50          | 7.1          | 5.6        |
| cauliflower                                         | 10        | 150         | 15           | 12.5       |
| tomato                                              | 7         | 45          | 6.4          | 5.0        |
| melon                                               | 12        | 210         | 17.5         | 15.0       |
| corn (regrows every 3 days, 6 harvests in a season) | 13        | 360         | 12.9         | 12.0       |
| pumpkin                                             | 12        | 230         | 19.2         | 16.4       |
| yam                                                 | 5         | 35          | 7.0          | 5.0        |

- Per gold invested, parsnip returns about 19% per day and cauliflower about 18.7% per day, so the early choice is nicely balanced.
- Per tile and per energy, cauliflower, melon and pumpkin win, so choice becomes trivial once capital is not the limit. Nothing is "useless" by accident, but parsnip, tomato and yam are never worth planting after week 3.

**Animals** (zero energy, only the daily walk):

| House            | Daily net            | Capital               | Payback   |
| ---------------- | -------------------- | --------------------- | --------- |
| Coop, 3 chickens | 3 x (50 - 8) = 126   | 400 + 1,050 = 1,450   | 11.5 days |
| Barn, 2 cows     | 2 x (110 - 15) = 190 | 1,000 + 2,400 = 3,400 | 17.9 days |

- Products wait up to 6 per house. A missed feeding does not kill anything; the animal just sulks.
- There is no cap on the number of coops or barns. The only throttle is fiber (20 and 40 each) and Farming Lv 3 and 5. The balance test checks a single coop, not unbounded scaling.
- Fiber supply is about 4 per day. Mara's daily gift adds 3 fiber at 3 hearts, which is a 75% boost to the bottleneck resource.

**Jars (runaway candidate, major).** `sellValue` for derived goods is `base + 2.0 x ingredient price` (`itemRef.ts:58`), where jam and pickles have their own flat base (30 and 25). Cheap ingredients get the biggest multiplier.

| Ingredient  | Raw | Preserved | Gold quality, preserved |
| ----------- | --- | --------- | ----------------------- |
| wild leek   | 20  | 61        | 92                      |
| parsnip     | 35  | 88        | 132                     |
| wild berry  | 32  | 94        | 141                     |
| mushroom    | 45  | 106       | 159                     |
| corn        | 80  | 169       | 254                     |
| tomato      | 85  | 200       | 300                     |
| cauliflower | 230 | 439       | 659                     |
| pumpkin     | 330 | 619       | 929                     |
| melon       | 310 | 650       | 975                     |

- Jars cost 100 gold and 10 fiber and take 3 days. A jar fed a melon adds about 110 gold per day, so payback is under a day.
- There is no limit on jars. Free forage becomes 3x value.
- Preserves also flow into orders (next point), so they stack.

**Orders (my computed board value).** 400 seeded boards per season, assuming you hold everything asked:

| Season                    | Reward/day  | Bin value of the same goods | Max single order |
| ------------------------- | ----------- | --------------------------- | ---------------- |
| Spring                    | about 1,040 | about 640                   | 1,280            |
| Summer                    | about 1,240 | about 770                   | 1,750            |
| Fall                      | about 1,280 | about 790                   | 1,830            |
| Winter                    | about 760   | about 470                   | 455              |
| Spring with jars unlocked | about 1,370 | about 850                   | 2,470            |
| Summer with jars unlocked | about 1,730 | about 1,060                 | 3,685            |
| Fall with jars unlocked   | about 1,740 | about 1,070                 | 3,485            |

- A 3x "Melon Jam" order pays about 3.7k. A 3x "Pumpkin Pickles" order pays about 3.5k for 3 pumpkins (990 raw). That is the best loop in the game by a wide margin, but it needs the board to ask for it.
- Orders are always 1.35-1.9x bin value, and the premium is not tied to difficulty. Items that are hard to get (trout only in town, catfish only in rain) pay no more than easy ones.
- Orders can request items that cannot be obtained that day: catfish needs rain, trout is town-only, and so on. The pool is built from the season's items regardless of availability.

**Dead or weak things.**

- Seeds sell for half price, so there is no arbitrage.
- Sprinkler 30g, fertilizer 8g and other crafted goods are fine.
- Quality Sprinkler (300 gold plus two sprinklers plus 10 fiber, 8 tiles) needs 34 fiber, which is 8.5 days of weeds. Fine as a gate.
- Mara discounts max out at 15%. Gold has no dead currency yet, but it will once sinks run out (see 1).
- `sellBonus` perk is dead (see 3).

---

## 5. Bugs and edge cases

| Severity            | Finding                                                                                                                                                                                                                                                                      | Evidence                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| major               | An empty coop or barn can never be picked up, so a misplaced one is permanent. `canPickUp` exists (`animalHouse.ts:22`) but `interact` never returns `{ kind: 'pickup' }` (lines 24-56). I placed an empty coop and pressed Interact 3 times: the object stayed, no message. | `p10` repro. Steps: put a coop in slot 6, Digit6, Action, then E x3.                                  |
| minor               | Farming Lv 10 "+5% sell price" does nothing.                                                                                                                                                                                                                                 | `skills.json:26`; no reader in `src`.                                                                 |
| minor               | NPC daily gift is silently skipped when the inventory is full. No toast.                                                                                                                                                                                                     | `friendship.ts:93`.                                                                                   |
| minor               | The tutorial toast lingers across maps, and several toasts overlap in the same screen area.                                                                                                                                                                                  | `10-animals-scale-toasts.png`.                                                                        |
| minor               | Action icon stays a hoe when the selected slot is empty.                                                                                                                                                                                                                     | `10-animals-scale-toasts.png`.                                                                        |
| minor               | A save from a newer version loads as "no save" (new game) with no warning, and the first autosave will overwrite it. It is not promoted to backup either.                                                                                                                    | Tamper test "futureVer": Continue vanished. Code: `save.ts` `migrate` throws, `tryLoad` returns null. |
| minor (tamper-only) | Player position is accepted unvalidated. `x=99999, y=-500` or `x=8, y=8` (inside a wall) loads and the player cannot move, because out-of-map counts as solid and there is no unstick. Soft-lock.                                                                            | Tamper tests "playerOOB" and "playerInWall". `save.ts:202`.                                           |
| minor               | `money` accepts up to 1e15 (no upper clamp).                                                                                                                                                                                                                                 | Tamper test "hugeQty".                                                                                |
| minor               | Pressing E again on the sleep sheet does not confirm; you must tap Sleep. Keyboard parity gap only.                                                                                                                                                                          | `06-sleep` probe.                                                                                     |
| nit                 | Sleep is allowed at 6:06 AM with no cost, so "skip a day" is free. Not an exploit, but it makes the 10-minute day a suggestion.                                                                                                                                              | `03-sleep-sheet.png`.                                                                                 |

**What held up well.**

- Inventory-full handling is good. Harvest, forage, fish (checked before the cast), jar collect, buy and craft all refuse cleanly instead of losing items. Coop collection takes only what fits and leaves the rest waiting (`animals.ts`: `take = min(ready, roomFor(...))`). In my test, with 5 ready and room for 1, it took 1.
- Tampered saves: negative money, garbage JSON, bad map name, unknown items and crops, short slot arrays, bogus quality values, ghost order items, and a huge clock value were all repaired or rejected into a fresh state. A backup is kept.
- A save never overwrites the backup with a corrupt file.
- Title "New Game" asks "Erase save? Tap again" when a save exists.
- Passing out: the clock stops while a panel is open, so a shop sheet can't be interrupted by 2 AM.

**Collision and stuck checks.**

- Villagers stand still and block only their own tile. I found no way to get trapped by them.
- The placeables that block movement (jar, coop, barn) can be placed only on tillable farmland. The 2-wide dirt road to town is not tillable, so a player can't wall off the farm exit.
- The one hostile case is surrounding yourself with 4 non-removable objects (coops with animals, loaded jars). I did not try it.
- Animals do not wander and are not obstacles.

---

## 6. Visual polish and juice

- **Placeholder art shows.**
  - Tilled soil is drawn as horizontal wooden planks (`02-tilled-planks.png`), which reads as stairs or a fence, not dirt.
  - The bed is four red squares.
  - The house is about 16 tiles wide next to a 1-tile player, with a plain brick fill, and the shop is a flat tan slab. Scale is inconsistent between buildings and characters.
  - Coop and barn are one tile each, smaller than the house door.
- **Animals are tiny chicken and cow sprites parked next to the coop.** They don't roam or react (`10-animals-scale-toasts.png`). The 5-tile "Animals roam beyond their house" idea is R2.6 on the roadmap.
- **Feedback is strong in places.** There are screen shakes on failure, a pulsing target highlight, harvest and quality sparkles, and "Silver or Gold quality!" text. The summary sheet plays coin chimes and a tip.
- **Audio.**
  - Fully synthesized (Web Audio). There are 17 sound effects and one music loop, a C-Am-F-G pentatonic progression, used for all seasons and maps.
  - Only 15 distinct effects are actually triggered.
  - There is no sound for level-ups, order completion, heart gains, casting, bites (the fishing sheet reuses 'select' and 'ui'), egg collection or jars. The roadmap marks those as "not done".
  - I could not judge the sound quality headlessly.
- **Animation gaps.** There is no tween for gold flying into the HUD, no flourish on level-up or hearts, and no egg or jam collect animation (R1.4 lists these as open).
- **Day summary and the other sheets are consistent.** They share one panel style, readable at 2x. The Menu, Shop and Board sheets all look finished.
- Dock labels "Drag to walk" slightly crowd the Menu button (`01-start-hint-contrast.png`). Nit.

---

## 7. Missing features players of this genre expect, and what to cut

Expect soon (some are on the roadmap):

- Tool upgrades (R2.1), farm expansion (R2.2, in progress in the working tree), fruit trees, and a greenhouse for winter.
- A calendar with birthdays and festivals, and a weather forecast. Tomorrow's rain is not telegraphed.
- A collection log or almanac (what have I caught, grown or cooked).
- A "what sells for what" view: the shop and bin don't show how much a stack is worth in total.
- Auto tool equip (see idea 1 below), quick-swap, and a bag sort.
- Villagers that move, with schedules and events (they are statues today).
- Cooking and meals that restore energy. Energy has one refill (sleep), which makes energy upgrades 100% of the long game.
- A money sink that matters: house upgrade, decor, or a community goal.
- A reason to replay year 2: new crops, seasonal events, or a mine.

Candidates to cut or merge:

- Parsnip, tomato and yam once the player has cauliflower, melon and pumpkin. They exist as tutorial crops. Consider making them tutorial-only or retiring them after day 10.
- Weeds as the sole fiber source. Either add a second source (fiber from forage, a "fiber crop") or lift the 24-weed cap, because the whole crafting economy hangs on 4 fiber per day.
- Quality Sprinkler and Rich Fertilizer are fine, but the craft list is short (8 recipes on 2 pages). More recipes need a place in the order loop.

---

## 8. Code and architecture risks

- **Panels are hand-laid out in logical pixels.** Every sheet is a Phaser widget with manual y offsets (`ui/panels/*.ts`, 1,631 lines). Every new panel (tool upgrades, festival, almanac) costs 100-400 lines and one more place for truncation bugs. Localization (R4.3) will hurt because text is cut with `..` (`fontMetrics.ts:138`).
- **Goals are a single linear `goalIndex` over string stat names** (`goals.json`). That causes the day-2-to-4 dead zone above. Parallel or tiered goals need a model change, plus a save migration.
- **`yearEnd` is hard-coded to summer 28** (`dayCore.ts:19`). Festival and event days (R3.4) will each need another special case in the day pipeline.
- **The balance tests model one of each building and crops only.** `tests/balance.test.ts` and `tests/sim.test.ts` don't cover jars, unlimited coops or orders, so the biggest income levers are unguarded. The roadmap says R1.2 is "done". It is not, for those sources.
- **Villager data and renderer assume static NPCs** (`NpcRenderer` builds the collision tiles once at scene start, `WorldScene.rebuildGrid`). Schedules (R3.1) need collision rebuilt per move.
- **Placed-object state is a loose `data: Record<string, unknown>` bag.** It is flexible, and `houseOf` repairs it, but a typo in a new behavior won't be caught by the compiler or by `sanitize`.
- **Rich module-level singletons** (`getState`, `runtime`, `gameEvents`, behavior registries). They are convenient, but I could not import game modules into a second instance in the dev server (modules loaded twice, so registries looked empty). That is a test-harness hazard for anyone scripting the game.
- **Save versioning is healthy** (migration chain, sanitize, backup, debounced autosave). It will need a migration every time the other engineer's plots change lands.
- The shared working tree was broken mid-edit while I was testing (`ty is not defined` in `rebuildGrid`). Nothing in the repo stops a half-edited tree from being served to testers. Consider a branch per task.

---

## Top 10 fixes and improvements, ranked by player impact per effort

1. **Make the first days non-blocking.** Parallel early goals, "buy seeds" and "forage" earlier, and a day-1 nudge to town. Effort low (data plus a hint). Fixes the day-2-to-4 dead zone.
2. **Show the facts the player needs in the shop and bin.** Days to grow, sell price, profit, and stack total. Widen or wrap the text so it never ends in "..". Effort low-medium. Removes blind purchases.
3. **Hotbar rules.** Reserve the first free slots for seeds and tools, never auto-fill the hotbar with produce, and add a Bag sort. Effort low (inventory fill order). High reach impact.
4. **Move the Menu tab row to the bottom of the sheet** (or add swipe between tabs). Effort low-medium. The single biggest one-handed fix.
5. **Add a touch tool-cycle** (tap or swipe the Action button, or a "next tool" gesture). Effort low. Cuts the hotbar reach problem in half.
6. **Make empty coops and barns pickable, and confirm or undo placement of big placeables.** Effort low (return `{ kind: 'pickup' }` when empty, add a toast with Undo). Prevents a permanent 400-1000 gold mistake.
7. **Wire up or remove `sellBonus`.** Effort trivial. Right now Lv 10 farming promises something it doesn't do.
8. **Warn when a crop can't mature before the season ends.** Effort low (compare days left with grow days in `checkPlant`). Saves seeds and trust.
9. **Cap or tune jars and orders.** Examples: a jar limit per farm, a lower flat base for jam and pickles (the 30 and 25 base is what makes cheap goods 3x), or an order premium tied to difficulty. Add jars and orders to `tests/sim.test.ts` so the guard rails cover the largest income. Effort medium.
10. **Fix the toast stack and contrast.** One toast lane, with a readable colour on grass, and clear the tutorial toast when the player changes map. Effort low. Polishes the first 30 seconds.

## Five bold ideas to raise the ceiling

1. **Context-tool Action button.** Drop the hotbar from the daily loop. The Action button picks hoe, seed, can or harvest from what is under the thumb, using the smart targeting that already exists. Keep the hotbar for specials (rod, fertilizer, placeables). That is a true one-thumb farm game.
2. **Almanac plus quests that push exploration.** A log of every crop, fish, forage, recipe and villager gift, with page rewards. It gives goals after "earn 20k" and doubles as the hint system.
3. **Seasonal festivals as the year's pacing.** One fixed-day event per season (fishing contest, crop show, winter feast) scored from orders, skills and friendship. Gives a deadline, a rank, and a reason to keep jars and animals running. Reuse the "year results" screen.
4. **Make orders a planning game.** Show tomorrow's board in the evening and let the player "reserve" a jar batch for it. A hard order (rain-only catfish, gold-star pumpkin pickles) pays double. Turns the lottery into a puzzle.
5. **A living valley: villager schedules, a pet, and animals that roam.** Villagers walking between spots by time of day, a dog or cat that follows you, chickens that wander. This is the cheapest way to make a code-drawn game feel alive, and it needs no new art pipeline.

## Verdict

Tiny Acre is a competent, unusually tidy prototype: the core loop (till, plant, water, sleep, ship) works, the fishing sheet and the day summary are genuinely good, saves are robust, inventory edge cases are handled with care, and the code is easy to extend. It is not yet fun for an hour. The first four days are dead time behind a linear goal chain, the one-handed promise breaks at the Menu tab row and the hotbar, and the shop hides the numbers a farmer needs to decide. The economy has three levers (jars, orders, unlimited coops) that outrun anything the balance tests check, so gold stops mattering around the end of summer. After that the game has no sink, no winter, and no year 2. Fix the first week and the one-hand reach problems first (items 1-6 above), guard the economy, and then the roadmap's depth work (tool upgrades, plots, festivals) will have a loop worth building on.
