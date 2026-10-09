# Tiny Acre: independent critique 8

Reviewer: independent QA lead and game critic, round 8.

**Status: complete for the scope below.**
- Every critique-7 finding (F1 to F9) was re-checked.
- The new content was exercised: the traveling cart, x5 cooking and the legend-in-the-bin warning.
- Two 16-day new games were played with real input. One of them fills every request it can, to judge the race with Clay.
- Every sheet and tab was swept for clipping.
- The sims were run and read, and the new rules were measured with the real functions.
- Real phone, audio and performance were out of scope (see "Not verified").

**Frozen build:** commit `3e1b9c5` (branch `depth/round2`), in `critique-8b/farm-game`. It is a `git archive`, not a checkout, so I could not confirm the hash myself.

**Method:**
- Headless Chromium (playwright-core, chromium-1217), 390x844, `hasTouch`, against `vite` on **port 5193**. I started the server for this session and stopped it at the end.
- The `?debug` hook was used to set up state and read it back. No game file was edited.
- Probes are in `critique-8b/farm-game/agents/out/c8/`, with logs in `c8/tmp/`. They are the critique-7 probes, retargeted, plus `clay8`, `new8`, `special8`, `statue8`, `play3` and `facts8.test.ts`.
- Screenshots are in `critique-8b/shots-8/`.
- `npx vitest run`: **65 files, 533 tests pass.**
- `tests/sim.test.ts` was run with its logs printed (`c8/tmp/sim.out`).
- `c8/facts8.test.ts` measures these with the real rule functions:
  - crop-request quantities against the field;
  - the board mix;
  - the special's Give count;
  - Clay's picks;
  - animal specials;
  - the cart's stock against the store.
- **0 page errors and 0 console errors** in every browser session.

## What I verified by playing, and what I did not

"Real input" means the keyboard (arrows, Space, E, M, Esc, Enter) and real touch taps on canvas buttons, located from the live UI tree. **Moving between spots was by teleport (`snap`/`goMap`), not by walking.** The clock was set where noted.

**Played with real input:**

- **Two 16-day new games**, with every farm, bin, shop, board, mail, chat, gift, fishing (real reel), mining and bed action done by real input. The clock was moved to 8:00 when the bot reached town.
  - **Run K** (`play2.mjs`, `KEEP=1` → `tmp/play16-keep.out`) keeps goods that the board wants. It taps the **first** enabled Give on the board, like a hurried player.
  - **Run R** (`play3.mjs` → `tmp/play16-race.out`) fills **every** request it can, then the special. This is the "racer".
  - In both runs the bot went to bed around 9 AM, so Clay was always settled overnight and judged by the morning summary.
- **Clay** (`clay8.mjs`): a field planted by state, then a real E at the board each morning and real bed sleeps for days 6 to 13. On day 9, one real Give on the cheapest row, then a 3 PM look.
- **Special Give** (`special8.mjs`): the exact critique-7 repro. I held 3 cauliflowers with "3 Cauliflower 930g" on the board, tapped "Give 3", then repeated with 5 held. I also used the hoe at 0 energy with a dish in the bag.
- **Kitchen, x5, eating, legend, Book, bench, cart** (`new8.mjs`). Ingredients were put in the bag by state; everything else was real taps:
  - the x5 button;
  - the bag card at 95 and 50 energy, and Action with a pie at 95;
  - the bin with a Sun Carp, shipped and taken back;
  - the Book tab;
  - E on a bench three times at 95;
  - the board's cart button on spring 5 and spring 26, Buy six times, Buy while broke;
  - a real bed into a cart day.
- **Statue** (`statue8.mjs`): a level funded by +gold and Give goods taps.
- **Clipping sweep** (`sweep.mjs`, 42 screens). Every menu tab and page, every shop tab and page, the board with a special and four rows, the cart, projects, the statue, villager and gift sheets, the bin, a sign, a jar, sleep and the summary. Each was machine-checked for overlap and overflow.

**Verified only by reading code or data, or with the real rule functions in vitest:**
- crop-request quantity against tiles grown (400 boards);
- the board mix (300 boards per case);
- animal specials at 70%;
- the cart's yearly stock against store prices;
- that a special Give does not count as "filled" for Clay;
- the honey-tip fix;
- the economy over one and two years (sim).

**Not verified at all:**
- real phone, audio and performance; walking times;
- a real afternoon at the board on a normal day (only the day-9 3 PM look);
- year two with real input;
- the Glimmer Trout, Old Whiskers and Ice Pike;
- gifting a legend to a villager.

---

## 1. Critique 7 findings re-checked

| C7 | Then | Now | How checked |
| --- | --- | --- | --- |
| F1 crop requests for crops that cannot ripen in time | 4 of 8 unfillable | **Fixed for timing, not for quantity.** Every crop request in both runs was for a crop ripening in time, and its row stays open until a day after (crop rows read "4 days" or "5 days"). But a request asks for 2 to 5 whatever you planted: in run R, three parsnip requests (5, 5 and 4) were posted when about one parsnip was ripening, and none could be filled. See **F3**. | played + vitest |
| F2 Clay took the dearest request every day | 7 of 7 days | **Fixed, and overcorrected.** He now takes only last-day rows, and "Clay stays home: you won today." appears after any fill. In run R (fills everything) he took 3 rows in 9 days, and the player held 1/4, 0/6 and 1/5 of them: **he never took anything the player could have filled.** The race now has no stakes. See **F2**. | played |
| F3 board asks a farmer for trout | 16% crops | **Better.** Crops were 6 of 20 requests (run K) and 7 of 22 (run R), about 30%. A 300-board measure gave 26% for a farmer with two near-ripe crops. But with no crop within 3 days of ripe, the board is **100% fish and forage** (900 rows measured). In run R, days 1 to 6 had 15 rows and no crop. See F5. | played + vitest |
| F4 special's Give starved a same-item request | | **Not fixed in its own repro.** Held 3, request "3 Cauliflower 930g": the special's button reads "Give 3", and one tap leaves the request at Have 0/3. In run K (day 11) this happened by itself: "Give 3" took the cauliflowers, and the next night "Clay filled 3 Cauliflower" (1,045g). Holding 5 works ("Give 2"), but the button then reads "Give 3", and a second tap starves the request anyway. "Give N" labels: fixed. No repeat special: fixed (cauliflower, then a different potato special). See **F1**. | played (shots `72`, `73`) |
| F5 bench lifted by two E | | **Fixed as designed.** At 95, E says "Sit when tired (+15). Tap again to pick up." and a second E lifts it. Mashing still lifts it, but the line now warns. | played |
| F6 eating wastes a dish | | **Fixed.** At 95 the pie's card says "Not hungry" and a tap keeps it ("You're not hungry enough."). Action with a pie at 95 is refused. The hoe at 0 with a dish in the bag says "Too tired! Eat something or go to bed." **Cursor:** it clears only after the *last* of a stack is eaten, and x5 now makes stacks, so a stray swap still happens (F6). | played (shot `82`) |
| F7 legends | | **Fixed.** The Book's overview shows "FISH 0/6 +400g, Legends 1/4" (shot `84`). Shipping a Sun Carp gives "A legend in the bin! Take it back out before bed to keep it.", and the bin's "-" took it back. | played (shot `83`) |
| F8 animal specials at 100% | | **Fixed.** They ask for 50% to 64% of output by the deadline: 1 hen on day 1 gets 18 eggs, 1 pig 10 truffles, 1 cow 14 milk. | vitest |
| F9 text and small UI | | **Mostly fixed:** <ul><li>The honey tip now keys on `animalsAdded`.</li><li>The statue page says "Now +1%", stays open after a level, and then says "Now +2%" (played).</li><li>The shelf puts in-season seeds first, then glass, and Fertilizer, Bait, Speed-Gro and Fiber last (played, fall with a greenhouse).</li><li>The dishes are on Make page 1 now.</li></ul>**Still open:** placeholder dots for the dish and legend art; strawberry under glass shows "Glass 8d, own 15" with no "again". | played |

---

## 2. Ranked findings

### F1 (Medium). The special's Give still empties a same-item request when you hold exactly what it needs, and it sits on top

- **Repro (played, `special8.mjs`):**
  1. The special is "7 Cauliflower for Mara". The board has "3 Cauliflower, Have 3/3, 930g". Hold exactly 3.
  2. The special's button reads **"Give 3"**. Tap it: the special goes to 3/7 and the request to **Have 0/3**.
  3. Hold 5: "Give 2" (correct). After that tap the button reads "Give 3", and a second tap empties the request again.
- **In real play (run K):**
  - Day 11: the top gold row's "Give 3" took the three cauliflowers. Overnight: "Clay filled 3 Cauliflower on the board." That was the dearest row of the fortnight (1,045g).
  - Day 13 was similar: the bot gave its one cauliflower to the special. The special does not count as "filling", so Clay came and took "2 Potato 310g", which the bot held at 2/2.
- **Cause:**
  - `src/systems/specials.ts:125`: `spare = have - keep > 0 ? have - keep : have`, so keeping everything gives everything. `tests/board7.test.ts:66` pins this ("keeping everything would give nothing: give all").
  - `src/ui/panels/BoardPanel.ts:42-71` puts the special first.
  - `src/systems/orders.ts:239` sets `filled.day` only in `deliverOrder`, never in `giveToSpecial`.
- **Impact:** this is the critique-7 repro, unchanged. The likeliest first tap on the board (the big gold row on top) still costs the dearest request.
- **Fix:**
  - When `keep >= have`, disable the special's Give. Show "Fill the request first" as its sub line, or "Give 0".
  - Or draw the special **below** the requests.
  - Count a special Give as a fill for Clay's stay-home rule.

### F2 (Medium, design). Clay is now harmless: he only takes rows nobody was going to fill, so the race is not worth running

- **Played:**
  - **Run R** (fills everything it can, days 7 to 16):
    - Clay took 3 rows: "4 Daffodil" (held 1/4), "6 Mushroom" (0/6) and "5 Parsnip" (1/5).
    - Every other day the notice read "Clay stays home: you won today." (days 11, 12, 13, 15, 16).
    - The racer lost **0g** to Clay.
  - **`clay8`:**
    - On day 9, a real Give on the cheapest row turned the notice into "Clay stays home: you won today." It was still there at 3 PM.
    - On day 10 he took the 325g mushroom row on its last day; the player held 0/6. On day 12, with no last-day row, the notice read "Clay wants nothing here today."
  - **Run K** (one tap per visit) lost 3 fillable rows to Clay. Two were taken because the bot's one tap went to the special (F1).
- **Why it has no stakes:**
  - He picks only rows on their last day (`src/systems/rival.ts:297-300`), and any fill sends him home (`:293`).
  - A row he takes would have expired that night anyway.
  - "Stays home" protects only a last-day row that you will fill after 2 PM the same day.
  - The sim agrees: "Clay took 71 of 145 requests in the seed-42 year... almost all ones the bot would not have filled" (DECISIONS).
- **Side effects:**
  - Clay's friendship perks (`npcs.json` hearts 2/4/5: later, polite, off) now change almost nothing.
  - The morning line "Clay filled 6 Mushroom on the board." reads like a loss but is not one.
  - His letter still says "from tomorrow I take one every day at 2 PM" (`src/data/mail.json:169`), and his chat line says "I fill one every afternoon" (`src/data/npcs.json:501`). Both are now untrue.
- **Verdict:** critique 7's Clay was unfair. This Clay is readable and fair, but there is no race. A player who fills one request a day never meets him.
- **Fix (pick one or two):**
  - Let him take the **dearest row on its second-to-last day** unless you filled one yesterday or today. Then "stays home" protects something real.
  - Or keep the rule and make the race visible and rewarded:
    - a season tally on the board ("You 9 · Clay 4");
    - a small prize at the season's end (Mara's ribbon, +friendship with Clay, a seed packet);
    - his line changes when you lead.
  - Rewrite his letter and chat lines to match the rule.

### F3 (Medium). Crop requests ask for more than your field can give

- **Measured (`facts8.test.ts`, 400 boards):** with 1 cauliflower and 2 potatoes near ripe, **65%** of cauliflower requests and **78%** of potato requests asked for more than were growing. Cauliflower asked for 1 to 3; potato for 2 to 5.
- **Played (run R):**
  - "5 Parsnip 220g", "5 Parsnip 275g" and "4 Parsnip 210g" were posted while about one parsnip was ripening. All three ended at Have 1/5 or 1/4: two went to Clay and one expired.
  - Of 7 crop requests in run R, the 4 that were filled were the ones where the field happened to be big enough.
- **Cause:** `src/systems/orders.ts:123`. The quantity comes from the value tier (`orders.json` `tiers[].qty`). It looks only at *whether* a crop ripens within `CROP_WAIT` (`:55-61`), never at *how many*.
- **Impact:** this is critique 7's F1 moved again. Now the timing is honest but the count is not. For a beginner who plants 1 to 3 of the expensive crop, the dearest crop row is usually out of reach.
- **Fix:** cap `qty` at (carried + tiles of that crop ripening by `until`), and skip the crop if that is under the tier's minimum. Add a test: one cauliflower tile never yields "3 Cauliflower".

### F4 (Medium). The traveling cart mostly resells store goods at a premium, and offers seeds that cannot ripen

- **Played (`new8`, sweep):**
  - **Spring 5:** Frost Plum Sapling **520g**. The store sells it for 400g every day.
  - **Spring 26:** Tulip Bulbs **40g**. The store price is 25g, and tulips take 6 days with 2 days left in the season.
  - **Fall 12 with a greenhouse:** Pumpkin and Melon seeds at **150g**, which the store sells for 100g that day; also the plum sapling at 520g.
- **Measured (one year, 32 cart slots):** **15 slots are goods the store sells the same day for less:**
  - saplings: 520 vs 400;
  - cauliflower, melon and pumpkin seeds: 1.5×;
  - tulip: 40 vs 25;
  - speed-gro: 40 vs 35.
  - Whole visits are store goods: summer 19 (speed-gro, sapling), winter 12, 19 and 26 (two saplings each, speed-gro).
- **Cause:** `src/data/cart.json` `stock` includes `cauliflower_seed`, `melon_seed`, `pumpkin_seed`, `tulip_seed`, `speed_gro`, `cherry_sapling` and `plum_sapling`, all on the store shelf (`shops.json`). `src/systems/cart.ts:18-22` (`fits`) checks the season but not the days left. This contradicts DECISIONS ("a pool the store does not sell").
- **Also:**
  - The cart sheet gives no "Bought" toast, has no x5 (5 taps for 5) and never says what bars or quartz are for.
  - Close returns to the world, not to the board.
- **What works:** the button and the morning note ("The traveling cart is in town today."), "5 left", "Sold out", "Not enough gold.", and a clean layout (shots `85`, `86`).
- **Fix:**
  - Drop items from the cart pool when the store has them on sale today. Keep store items only when they are project-gated or out of season.
  - Hide seeds whose growing days exceed the days left (unless under glass).
  - Add a "Bought X" toast and a one-line use hint ("For the Greenhouse").

### F5 (Minor, design). The first week's board, and every gap between harvests, is still fish and forage for a farmer

- **Measured:** for a farmer whose crops are all more than 3 days from ripe, 900 rows gave fish 452 and forage 448: **0 crops.** With two crops near ripe, 26% were crops.
- **Played:**
  - Run R, days 1 to 6: 15 rows, all fish and forage. The first crop row was on day 7.
  - Run K: one crop row (day 3, parsnip) before day 6.
  - `clay8`: one crop row in 8 mornings for a field of potatoes and cauliflowers.
- **Cause:** `orders.ts:55-61`. A crop enters the pool only within `CROP_WAIT` (3 days) of ripening. The 3× weight (`:109`) cannot help when no crop is in the pool.
- **Fix:** let a crop enter the pool from planting, with `until` set to its ripening day plus one. That is honest now that F1's timing rule exists. Then fix the quantity (F3).

### F6 (Minor). Bag: after eating one of a stack, the next slot tap swaps stacks

- **Repro (played, `new8`):**
  1. With 2 pies in slot 20, tap the pie, then tap "Not hungry" (or eat one).
  2. Tap another slot (soup in 21). **The two stacks swap** instead of selecting the soup.
  3. Eat, then tap a pumpkin slot: the pie and the pumpkins swap.
- **Cause:** `src/ui/panels/MenuPanel.ts:240` clears the cursor only when the stack is gone.
- **Impact:** x5 cooking makes stacks of five, so "eat one, then look at something else" is the common case.
- **Also:** "Not hungry" is drawn green with a green rim, like an active button (shot `82`).
- **Fix:** clear the cursor after any Eat or "Not hungry" tap. Draw "Not hungry" dim.

### F7 (Minor). x5 cooking spends gold-quality ingredients without a word and does not say how many it made

- **Repro (played):** with 7 base potatoes and 3 gold ones, x5 on Baked Potato made 5 dishes and **used all three gold potatoes**. The toast says "Made Baked Potato" (once: duplicate toasts are merged, `Hud.ts:363`).
- **Also:** x5 is enabled when only one dish can be made (Parsnip Soup with 2 parsnips).
- **Cause:**
  - `src/ui/panels/CraftTab.ts:52-53` loops `craft()`.
  - `src/systems/inventory.ts:113` takes the lowest quality first, then the gold ones.
- **Impact:** small. As critique 7 noted, a gold-ingredient dish sells for less than its ingredients.
- **Fix:**
  - Stop x5 before it reaches silver or gold ingredients (or ask).
  - Toast "Made 5 Baked Potato".
  - Label the button with the real count ("x2").

### F8 (Minor). Text out of date, and small UI

- **Out of date:**
  - Clay's letter and chat line describe the old daily take (F2).
  - The pre-day-8 notice says "Requests stay two or three days." (`src/systems/rival.ts:57`) while crop rows say "4 days" or "5 days".
- **Wrong tab names:**
  - The goal hint "Open Menu > Craft." (`src/data/goals.json:121`) names a tab that is labelled **Make**.
  - The tip "See Menu > Craft and Skills." (`src/data/tips.json:42`) names **Make** and **Skill**.
  - The bot (and a new player) sat on "Craft something at the workbench" from day 6 to day 16 in both runs.
- **Board:** the special's Give is 40 px wide and the rows' Give buttons are 36, so the right edges do not line up (shot `70-board-d10-morning`).
- **Statue page:** it keeps "When done: Sales +1% a level..." after levels are done. It would read better as "Each level: Sales +1%, up to +5%. Now +2%."
- **Placeholder art:** the dishes and legends are still flat coloured dots (shot `81`).

### Not a bug (positive)

- **The x5 button itself:** it fits beside Make on every dish row, and the ingredient lines ("Pumpkin, Egg, Milk") fit.
- **Clay's board line is honest now:**
  - "Clay wants nothing here today." on fresh boards;
  - "Clay wants this one at 2:00 PM." with "Clay's!" on the target row;
  - "Clay stays home: you won today." the moment you fill one.
- **Crop requests wait for the crop:** "4 Potato 530g 4 days" posted 2 days before the potatoes ripen. Run R filled 4 of these (720 to 1,065g each): they are the best money on the board.
- **No repeated special:** the cauliflower special was followed by a different (potato) special.
- **Legends:** the Book line and the bin warning are exactly what critique 7 asked for, and taking the fish back out works.
- **The statue page** stays open, shows "Now +2%" after a level, and the next level's goods line appears at once.
- **The sweep found no overflow or overlap on any of 42 screens.** That includes the board with a special, four rows and the cart button, the cart sheet, Make page 1 with six dish rows and two buttons each, and the seed shelf's four pages.

---

## 3. The days played

**Run R** (fills every request, then the special; real input; teleports between spots):

| Day | Wake gold | Board (morning) | Filled / Clay overnight |
| --- | --- | --- | --- |
| 1 | 500 | bluegill 215, carp 130, trout 395 | none |
| 2 | 40 | special "15 Potato for Rosa 2,250g" | none |
| 3 to 6 | 261 to 591 | trout, mushroom, carp, wild leek, daffodil (no crops) | 3 Carp 105 (day 6) |
| 7 | 732 | daffodil 165, **5 Parsnip 220 (4 days)**, mushroom 425 | none |
| 8 | 1,002 | "Clay wants this one": 4 Daffodil (Have 1/4) | special Give 5. **Clay took the daffodil** |
| 9 | 685 | target 6 Mushroom (0/6); 2 Cauliflower 730 (4 days) | special Give 5. **Clay took the mushroom** |
| 10 | 589 | target 5 Parsnip (1/5); 5 Potato 720 | special Give 1. **Clay took the parsnip** |
| 11 | 676 | 2 Cauliflower 2/2 | **filled 730**; "Clay stays home: you won today." |
| 12 | 1,379 | target 5 Potato, Have 5/5 | **filled 720** + special Give 3 (14/15); stays home |
| 13 | 1,588 | 2 Cauliflower 2/2 | **filled 715**; stays home |
| 14 | 2,434 | Flower Show; 3 Cauliflower 1,065 (1/3) | nothing; Clay "wants nothing" |
| 15 | 2,530 | target 3 Cauliflower 3/3 | **filled 1,065**; stays home |
| 16 | 3,360 | 5 Daffodil 5/5 | **filled 220**; stays home |

- **Run R totals:** 6 requests filled (about 3,550g). Clay took 3, all unfillable. The potato special stuck at 14/15 (the bot planted cauliflowers). 6,854g earned by the end of day 16 (5,330 by day 14).
- **Run K** (one tap per visit):
  - 5 requests filled and the cauliflower special finished on day 15 (+2,400g); Clay took 4.
  - Two of Clay's four were rows the bot held and could have filled (daffodil 5/5, potato 2/2), and one was emptied by the special's Give (F1).
  - 8,373g earned by the end of day 16 (4,916 by day 14).
- **Against critique 7** (5,478 / 5,705 by day 14): about the same. The special's timing decides most of the gap.

**Is the race worth running?**
- No. It is now a deadline marker, not a rival (F2).
- Racing pays only through the requests themselves. Those are now often worth it: crop rows of 700 to 1,065g that the field can fill.

**Does the board feel alive for a farmer?**
- **From day 7:** yes, about every other day there is a crop row worth 2 to 4 times the bin.
- **In the first week:** no. It is fish and forage, and some crop rows ask for more than the field holds (F3, F5).

**Is a 5-minute session (about 10 game hours) rewarding?** Yes, it has a clear loop:
- the farm round and the bin;
- two or three jobs paid on the spot (about 20 to 50g each);
- the board, with usually one named target and, from day 7, often a fillable crop row;
- a letter;
- once a week, the cart.

The weak spots: the cart rarely has anything you need (F4), and Clay's line is noise (F2).

## 4. One-thumb reach

- **Unchanged and fine.** Close is at logical y 383 on every sheet.
- **The cart:** Buy buttons sit at x 172, y 249 to 327, in the right-thumb zone. The cart button on the board sits just above "Town projects".
- **Make tab:** x5 is at x 180 and Make at x 146 on each dish row (rows 26 px apart). They are reachable, but x5 is the outer button, where the thumb lands first, and it is the bigger action.
- **The only reach risk** is still the special's Give on top of the board (F1).

## 5. Progression and economy

**Sim (`tests/sim.test.ts`, logs in `c8/tmp/sim.out`):**
- **Year one, tireless bot, five seeds:** 227,442 / 206,209 / 278,177 / 254,664 / 211,856 (median **227,442**). Critique 7 had 195,194: **+16.5%**.
- **Human-paced bot:** 177,253 / 167,535 / 201,892 (median **177,253**). Critique 7 had 147,942: **+20%**.
- **Board income for the year:** 9,367g (3.5× critique 7's 2,690), still only 4% of earnings.
- **Clay:** took 71 of 145 requests posted.
- **The rise is not explained by orders alone:** they added about 6.7k of the 32k. Some of it is likely earlier levels and plots. Worth an instrumented look before the next repin.
- **Fall is the engine:** earnings went from 57,095 to 140,842 between fall 15 and winter 1 (84k in 14 days). That matches critique 7 and is not a runaway, since winter is flat.
- **Two years:**
  - all 8 projects by **year-2 spring** (critique 7: year-2 summer);
  - statue level 5 by year-2 winter and 6 by year-3 spring;
  - 1.10M earned against 826k sunk.
  - After the statue, gold again has no use. This is acceptable as an endgame, but it comes a season sooner than before.

**The cart as a project shortcut: not a runaway.**

| Project | Goods | Bought at the cart | Project gold |
| --- | --- | --- | --- |
| Greenhouse | 10 quartz + 5 iron | 4,000g | 20,000g |
| Market | 10 iron | 3,000g | 60,000g |

- About +5% to +20% on top of the gold.
- Each bar or quartz shows up at about one visit in three (4 random slots), so a non-miner still waits for the right week.
- As a gold sink it is small: at most about 6k a visit if you buy everything.

**Cooking:** x5 removes the tap tax, but dishes are still +9% to +14% over base ingredients and below them with gold ones (F7). Its value is energy. Not a money loop, and not dead.

**Legends:** about 1,750g a game; the Book line now gives them a reason to keep them. Fine.

**Runaway or dead:**
- **Runaway:** nothing.
- **Near dead:**
  - Clay as a competitor (F2);
  - the cart's store-goods slots (F4);
  - Clay's friendship perks;
  - the statue after level 5 (glory only).

## 6. Top 3 things to add next

1. **Make the board's money honest and reachable.**
   - The special's Give must never empty a fillable request (disable it, or move the special below) (F1).
   - Crop requests should ask only for what the field can give, and appear from planting day (F3, F5).
2. **Give Clay back a little bite, with a scoreboard.**
   - A second-to-last-day take on the dearest row, or a visible season tally with a prize.
   - Rewrite his letter and lines to match (F2, F8).
3. **Make the cart worth the walk.**
   - Only goods the store does not have today, no seeds that cannot ripen.
   - A "Bought" toast, a one-line use hint, and x5 (F4).
   - Small bag and kitchen polish: clear the cursor after eating, x5 that spares gold ingredients and says how many (F6, F7).

## 7. Verdict

**Stable and cleaner than round 7, with no blocker.**
- **Tests and errors:** 533 tests pass. There were 0 page or console errors across two 16-day games and every probe. The 42-screen sweep is clean.
- **Critique-7 findings:**
  - F5, F6, F7, F8 and most of F9 are fixed through real input.
  - F1 and F3 are improved but still leak on quantity and the first week.
  - **F4 is not fixed in its own repro:** in play, it cost the fortnight's dearest request.
  - F2 is fixed so thoroughly that Clay no longer matters.
- **New content:**
  - The cart works and reads well, but half its stock is the store's own goods at a markup.
  - x5 cooking and the legend warning work.

**The main weakness has moved.** It is no longer an unfair rival. It is a board whose best tap (the gold special on top) can still empty its best row, and a race that the game announces every morning but that a player can never really lose.

## Screenshots (`critique-8b/shots-8/`)

| Group | Files |
| --- | --- |
| Run K (first days) | `01-day1-farm-planted`, `02`/`03`/`04-summary-day2..4` |
| Clay | `70-board-d6..d13-morning`, `70-board-d9-3pm`, `71-board-after-fill-d9` |
| Special Give (F1) | `72-special-give-exact`, `73-special-after-give` |
| Kitchen and bag | `80-make-page-x5`, `81-make-after-x5`, `82-bag-card-not-hungry` |
| Legends | `83-bin-legend-warning`, `84-book-fish-legends` |
| Cart | `85-cart-spring-5`, `85-cart-spring-26`, `86-cart-soldout-*`, `87-summary-cart-day`, `s-cart` |
| Statue | `66-statue-after-level`, `s-project-detail` |
| Sweep | `s-*` (42 screens), contact sheets `cs-8a-seeds` (fall shelf with a greenhouse), `cs-8b-board` (board, cart, statue, Book) |
