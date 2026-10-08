# Tiny Acre: independent critique 3

Reviewer: independent QA lead and game critic, round 3. Frozen build: commit `6be0f79` (copied to `/tmp/critic3/farm-game`, dev server on port 5193). The repo was not edited, apart from this report and `shots-3/`. Headless Chromium through playwright-core with CDP touch input, 390x844 at DPR 1, `?debug` hook for state set-up and read-out.

Note: `f8e789c` (year label, shorter gift text) landed in the repo after my snapshot. I saw the old gift text ("One gift a d..") in my build. Those two fixes are not in what I tested.

## What I verified by playing, and what I did not

Played with real input (keyboard walk and actions, CDP touch on the Action button and the floating joystick, real taps on shop, bin, sleep and gift buttons):
- New game, day 1 chores, bed, sleep summary, wake-up, 14 in-game days in a scripted "new player" run (about 7 real minutes, 0 page errors).
- Walking farm to town to woods to mine, general store (all 3 tabs, all pages), bin, orders board, Mara, 4 villager sheets, gift list, plot sheet, Flower Show board and entry.
- Fishing mini-game (a bot that reads the reel state; 3 of 4 casts caught).
- Placing sprinkler, jar, keg, bee house, sapling, coop, loom and furnace, and trying to pick each up.
- Save, reload, Continue (works); season rollover with 16 crops (clean, "16 crops withered").
- Every Menu tab, Shop, Bin, Board, NPC, Gift, Plot, Sleep, Keg, Loom, Furnace and Festival panel, with a rich late-game state (set up through `window.__farm`).
- `npx vitest run`: 322 tests pass on this build.

Caveats on the 14-day run:
- The run is a bot, not a human. It farmed the home plot, bought seeds, shipped, and did the forage and town goals along the way.
- It never fished, mined or crafted in that run, so it sat on goal 8 ("catch a fish") on day 15.
- Movement was partly teleported (`goto`) to save wall-clock time. All actions, panels and sleeps were real input.
- A human would spend more time per day but not more game time.

Verified only by reading code or data:
- Economy numbers and the sink list (from `shops.json`, `placeables.json`, `goals.json`).
- "New Game asks before erasing a save" (`TitleScene.ts:124`).
- Audio. I did not listen.

Not verified at all: real-device frame rate, haptics, audio, native builds, `npm run e2e`, `e2e:mobile`, `perf`, left-handed layout.

---

## 1. Critique 2 fixes (M1 to M4) re-checked

| Item | Result | How I know |
| --- | --- | --- |
| M1 swipe no longer acts | **Mostly fixed, one edge case remains.** A fast flick (down to first move 40 ms, up in 85 ms) changed tool and acted 0 times. A tap acts once on release. A hold of 700 ms to 1 s repeats. **But a swipe that takes more than about 110 ms to cross the 14 logical px (28 CSS px) threshold still fires one use of the old tool.** | Played. Event timeline: down at 32 ms, `held=true` at 183 ms (tilled 1), swipe recognised at 188 ms. My CDP touches arrive 40 to 60 ms apart, so this is a harsh test, but a relaxed thumb is slower than a flick. See finding F5. |
| M2 second-tap pickup | **Half fixed.** Coop and bee house: second tap picks up ("Empty. Bring a chicken. Tap again to pick up."; "Honey in 4 days. Tap again to pick up."). Sprinkler: one tap. Sapling: refused by design ("Still growing: 10 more days"). **Empty preserve jar, keg, loom and furnace still cannot be picked up at all** (F1). | Played. Placed all of them and tried interact 3 times each. |
| M3 hotbar rules | **Fixed.** Bought chicken, chicken feed, hay, cow and a sapling: sapling went to the hotbar (slot 6), chicken, feed, hay and cow went to the bag (slots 8 to 11). Produce goes to the bag first. | Played, through the real shop. |
| M4 sprinkler on empty tilled soil | **Fixed.** Placed a sprinkler on a freshly tilled tile; the soil tile is consumed. | Played. |
| M5 bag reach | **Fixed.** The grid now sits just above the tab row, about y 548 to 670 of 844. | Screenshot. |
| m10 action icon | **Fixed.** The Action button shows the equipped item (hoe, can, rod, seed). | Screenshots. |
| m8 machine help text | **Fixed** for keg, loom and furnace (each says "Ready N mornings after loading" and lists only valid inputs). I did not view an empty-state jar panel with nothing loadable. | Screenshots. |

Still open from critique 2 (see section 3):
- m5 truncation.
- m7 blind gifts.
- m11 tutorial toast replays on map change.
- m14 land signs advertise 2,200g and 2,600g on day 1.
- m15 winter tip on day 1.
- No pickup for machines (F1).

---

## 2. Ranked findings

### F1 (Major). Empty jar, keg, loom and furnace are still permanent

- Repro: craft or give yourself a keg (I set the inventory), place it on tilled or empty farmland, face it, press Interact. A panel opens ("Keg: Ready 5 mornings after loading", list of loadable goods, **Close** only). Close it and press Interact twice more. Nothing happens. Same for loom and furnace. Shot `05-keg-panel-no-pickup.png`.
- Cause: `canPickUp` is defined on `jar.ts:12` (true when empty), but `interact` returns `{ kind: 'panel' }` when empty. The second-tap logic (`placeables.ts interactWith`) only arms on a plain `message` result. So `canPickUp` is dead code for exactly the case it was written for. When loaded or busy, `canPickUp` is false.
- Impact: a 180g keg, 300g loom or furnace placed on the wrong tile (there is still no placement preview) takes that tile for the whole game and is solid. Layout regret is permanent.
- Fix: add a "Pick up" button to the empty-machine panel (best, no second-tap rule needed), or treat an empty-panel open as armable.

### F2 (Major, design). Days are 20 hours long and the work takes 40 minutes

- Evidence from the 14-day run, "end of work" clock reading, all days: Day 3 6:39, Day 4 6:46, Day 5 6:19 (harvest, ship), Day 7 6:41, Day 8 6:40, Day 11 6:47, Day 14 6:12. Only town-trip days run past 7:00 (7:30, 7:16). The day ends at 02:00, so the player has about 19 unused game hours and about 25 real seconds of play per day.
- Gold timeline (bot, home plot only, 32 tiles, parsnip and cauliflower): 590 (day 2), 340 (day 5, after seeds), 986 (day 14), 1,024 (day 15). No upgrade, plot or animal affordable in two weeks.
- The weak stretch from critique 2 is still there: days 3 and 4 (and every second day after) are "water, sleep". The first harvest is day 5. Goal 5 ("Buy 5 items") lands on day 2 and goal 6 ("Harvest 5 crops") then waits 3 days. Fishing (goal 8), the order board (goal 9) and the mine have no pointer until the player stumbles into them.
- Day 1 is about 60 real seconds: till, plant, water by 6:35 AM, then the goal reads "Sleep". Starting gold is 500, spendable on day 1 (the bot bought 400g of cauliflower seed on the first morning), but nothing says so.
- Not a bug. It is the biggest first-hour fun risk: the player has no reason to do anything between "water" and "sleep" except guess.
- Idea: day-2 and day-3 goals that use the idle hours (fish 3, take Rosa's errand, mine 5 stone), each with a small visible reward. The fish goal is currently far down the chain.

### F3 (Medium). The "x5" button on animals and saplings can burn 1,750g to 6,000g in one tap, no confirm

- Repro (played): shop, Farm tab, tap "x5" on Chicken. "Bought 5 Chicken", 1,750g gone. The 5 chickens sit in the bag with no coop. Cow x5 would be 6,000g. The "x5" and price buttons are the same size and next to each other on every row.
- Same layout for Cherry Sapling (x5 is 2,000g) and tonics.
- Fix: hide x5 for rows that are one-per-home or priced above about 300g, or confirm above a threshold.

### F4 (Medium). Text overflow and overlap (still the house style)

All seen in screenshots at 390x844 (the UI is a fixed 200x400 canvas, so every device scales the same layout).

| Panel | Defect | Shot |
| --- | --- | --- |
| Shop, Seeds | `4 days 35g (ow..`, `Cauliflower See..` on day 2. Row 4 reads `Finer crops (ow..` | `03` |
| Shop, Farm p2 | `Frost Plum Sapl..` | (seen) |
| Bin | `Silver Melon Wi..`, `Gold Cauliflow..`, `have 4 b..`, `have 14 ..` on every row | `04` |
| Keg, Furnace, Loom | `Makes Gold Melon Wine ..`, `Makes Copper Bar (hav..`, `Makes Wool Cloth (have..` | `05` |
| Craft | `2 Sprinkler, 10 Fiber, ..` (Quality Sprinkler) | `08` |
| Book tab | Hint line "Hold an item once to add it." is **drawn over the Mine row** (icons and title) | `06` |
| Goals tab | Progress number is clipped at the panel edge: `20,000,` instead of `20,000/20,000`. The new 50,000 and 100,000 goals are longer. | `07` |
| Villager sheet | Blurb `Fishes the woods lake all..`, `Your neighbour. Knows so..` | (seen) |
| Villager sheet (old build) | `One gift a d..` (fixed in `f8e789c`, not retested) | n/a |

The layout test checks static strings. The runtime ones (quality prefix, derived goods, "owned" suffix, long goal numbers) are what clip.

### F5 (Medium). Swipe edge case: slow swipes still use the tool once

See table row M1. The 110 ms hold timer races a slow swipe: if the finger needs more than 110 ms to travel 28 CSS px, `actionHeld` goes true first and one tool use fires (tilled 1, then the swipe is recognised and releases). A quick flick is clean.
- Fix: arm the hold timer only after the finger has stayed within about 4 px for 110 ms, or compare travel at fire time.

### F6 (Medium). Spring 14 Flower Show cannot be won by a spring player

- Played: set day 13, slept, "Flower Show today! Visit the town board." (good, clear). Entry sheet is clear. Shot `10`.
- Rivals score 40, 56, 93. Only flowers are accepted. The only spring flower is the Daffodil: plain 30, silver 38. Wild Sunflower (40) is a summer forage; there is no flower crop. Best plain entry: no podium, consolation gold.
- Impact: the first festival in the first fortnight is a near-guaranteed "no podium". It still ticks the festival goal. The forage-quality skill and fertilizer cannot help a wild flower.
- Fix: lower the first rivals to about 25, 35, 55, or accept a spring crop family, or sell the idea by showing "need 40 to place" on the board before entering.

### F7 (Minor). Tutorial toast replays on every map change until the first till

Verified in the house and in the woods: "Welcome to Tiny Acre!..." and "Drag anywhere low on the screen to walk..." come back on entry, over the world. Shot `11`. (m11 from critique 2.)

### F8 (Minor). Forage is easy to miss, and the farm has almost none on day 2

- The goal hint says "look for sparkling goods". The wild leek icon is a small green sprite with no sparkle, next to pink decorative flowers that look the same size. Shot `02`.
- Day 2: 1 forage on the farm, 2 in town. Goal 4 ("pick up 3") therefore forces the town trip, which is good, but a player who stays home sees one leek and wonders.

### F9 (Minor). Day 1 land signs advertise unaffordable plots and the day-1 tip is a winter tip

- 2,200g and 2,600g float by the front door on day 1 (shot `01`), 30 and 35 tiles each. The West Field (40 tiles, 700g) is the real first buy and is 20 tiles away.
- Sleep summary on day 1: "Tip: Winter has no wild crops, but kale grows in the cold. Plan ahead!" The player cannot act on it for 90 days (m15).

### F10 (Minor). Gifts are still blind

- Gift list is sorted by value. For Rosa, the first row was a Gold Cauliflower (a "loved" item), one tap gives it, no confirm, no hint of likes (hidden until 3 hearts). Shot `12`. (m7.)

### F11 (Minor). Hotbar has 3 free slots, and spring seeds alone fill them

- Played: with parsnip, potato and cauliflower seeds in slots 6 to 8, the first fertilizer purchase landed in the bag (slot 10). Sprinklers, jars and saplings would too.
- The only way to equip a bag item is Menu, Bag, tap, tap. The bag is now reachable, but this is still 4 taps in the middle of a crop cycle.
- Swipe-cycling visits empty slots too (8 stops, slots 7 and 8 often empty).

### Not a bug, but note (positive)

- Fishing: clear (shot `09`). Tap on the bite, hold to lift, the green zone and a progress bar. About 8 to 17 s per cast, 5 energy each. A bot caught 3 of 4. I did not judge feel with a real finger.
- Save and Continue show "Spring 2, year 1 777g". Sleep, summary, wake flow is clean.
- Forecast shown in the sleep sheet ("Tomorrow: sunny").

---

## 3. One-thumb reach

Played with CDP touch:
- Joystick anywhere low on the screen: works, about 4.4 tiles/s, farm to town in about 9 s.
- Action button (bottom right) with swipe, tap and hold: good, apart from F5.
- Menu button: far left of the dock, away from the Action thumb on purpose. Reachable only with a stretch.
- Hotbar slots 1 to 3 (hoe, can, scythe) are at the far left: about 12 to 100 CSS px from the left edge. For a right thumb they are the hardest, which is where swipe-on-Action saves it.
- Sheets: shop, bin, board, gift, plot and NPC buttons all sit in the lower 40% of the screen (y 700 to 780). The Bag grid is now in thumb reach.
- Top of sheets (Goals text, Skills, Book rows) is out of reach but read-only.
- Slots are 41 CSS px wide at 390 and shrink on narrower phones (m13, not re-measured).

---

## 4. Progression and late-game money

Estimates from data only (nothing in the late game was played):
- Sinks in data: plots 8,500; upgrades 36,850 (stamina 23,000, can 3,800, hoe 5,400, rod 4,650); animals and houses about 11,100; trees 4,800 (3 per type at 380g to 400g); crafts and machines about 7,700. Total about 69,000g, unchanged since critique 2.
- The last commits only add goals ("earn 50k", "earn 100k", "collect 200"). Those are targets, not sinks. The player passes 50k with nothing to buy.
- 14-day result (bot): 1,024g, so on the pace critique 2 modelled (about 250 to 500 gold per day early), plots and houses open up around day 20 to 35.
- Mid-game depth that does exist: mine, furnace, bars for tool upgrades, 4 villagers with heart events, orders, almanac, festivals. I saw the mine entrance, rocks, furnace panel and heart-event scenes but did not play the mine or smelting loop through.

---

## 5. Top 3 features to add next

1. **A second act that spends gold.** Farmhouse and barn tiers, a greenhouse (a crop all year), a town project (bridge, mill, community hall) priced 20k to 150k, each unlocking something visible. It gives the earn-50k and earn-100k goals a point, and the stamina tonic stops being the only sink.
2. **Give the idle days a job.** F2 is the biggest early risk. A small visitor, errand or "today's chore" layer (one fishing target, one forage target, one villager request, one mine rock, each worth 20 to 60g) on days 2 to 14. It also fixes "nothing points at fishing" and lifts the 2-week gold curve without touching crop numbers.
3. **Finish the one-thumb loop.** Add a "pick up" button in machine panels (F1), a "plant a row" for seeds like the hoe and can have, a bag-quick-swap on long-press of the hotbar, and "load all" in jar, keg and loom panels. This removes most of the 4-tap flows between crop cycles.

---

## 6. Verdict

Better than round 2: the swipe-acting regression is mostly gone, the action icon follows the tool, hotbar and bag reach are fixed, the festival flow is clear, and I found no crash and no soft-lock in about 7 real minutes of play plus the panel sweep. The remaining risks are not stability. They are (a) a 20-hour day with 40 minutes of work, (b) a late game with nothing to buy, and (c) clipped text in the dense panels, which now includes a goal number and an overlapping Book hint.

Screenshots (`agents/critiques/shots-3/`, 12 files): `01-day1-start`, `02-forage-hard-to-spot`, `03-shop-truncation`, `04-bin-truncation`, `05-keg-panel-no-pickup`, `06-book-tab-overlap`, `07-goals-tab-clipped-number`, `08-craft-truncation`, `09-fishing-reel-good`, `10-flower-show-unwinnable`, `11-tutorial-toast-replays-woods`, `12-gift-list-blind`.
