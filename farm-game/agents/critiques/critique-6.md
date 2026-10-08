# Tiny Acre: independent critique 6

Reviewer: independent QA lead and game critic, round 6.

**Status: complete for the scope below.** Every critique-5 finding was re-checked, and all of the new depth-round-2 content was exercised. I played a 14-day new game, swept the sheets for clipping and ran the sims. Real phone, audio and performance were out of scope (see "Not verified").

**Frozen build:** commit `5fd9943` (branch `depth/round2`), copied to `critique-6/farm-game` with `git archive`. It is not a git checkout, so I could not confirm the hash myself.

**Method:**
- Headless Chromium (playwright-core, chromium-1217), 390x844, `hasTouch`, against `vite` on **port 5191**. The server was started for this session and stopped at the end (PID killed, port free).
- The `?debug` hook was used to set up state and read it back.
- No game file was edited. Probes are in `critique-6/farm-game/agents/out/c6/`; logs are in `c6/tmp/`. Screenshots are in `critique-6/shots-6/`.
- `npx vitest run`: **61 files, 502 tests pass**.
- `tests/sim.test.ts` was run with its logs printed. An instrumented copy of the two-year sim (`c6/sim2.test.ts`, run with its own vitest config) was used to find F5.
- `c6/facts.test.ts` measures special sizes, statue prices and the day-1 boards with the real rule functions.
- 0 page errors in every browser session.

## What I verified by playing, and what I did not

"Real input" below means keyboard (WASD/arrows, Space, E, M, Esc, Enter), and real touch taps on canvas buttons located from the live UI tree.

**Moving between spots was by teleport (`snap`/`goMap` on state), not by walking.** The clock was also set forward in two cases, and I say so where it happened.

**Played with real input:**

- **A 14-day new game** (`play.mjs` → `tmp/play14.out`). Every action was real input:
  - tilling, planting and watering;
  - harvesting, and shipping through the bin sheet;
  - foraging, fishing (the real reel minigame) and mining;
  - chats, and gifts through the Gift list;
  - the board's Give, and shop buys;
  - mail: Read, then Take gift;
  - sleeping in the bed, then the summary's Wake up.
  - **Clock changes:** the clock was moved to 8:00 when the bot reached town, to model the walk and shop hours. From day 7 it was also moved to 15:00 for one afternoon look at the board.
  - **Scarecrow:** Rosa's scarecrow was placed on day 11 with Action.
  - **Totals:** 31 jobs done, 2 orders filled, Clay took 7, crows ate 1 crop, 6,396g earned by the end of day 14.
- **Clay** (`clay.mjs`):
  - state was set to day 8; then real E at the board, and real sleeps in the bed for days 8 to 10;
  - an afternoon look at the board;
  - year two (state set), at 0 and at 2 hearts.
- **Projects** (`statue.mjs`, `market.mjs`, `seedx.mjs`, `derby2.mjs`):
  - real taps on Town projects, Open, the +gold buttons and Give goods;
  - project completion was set in state.
  - The Seed Exchange was funded with real taps; strawberry seeds were then bought (x5) and planted.
- **Festivals:**
  - `basket.mjs`: Harvest Fair and Winter Feast baskets with Add/Out/Present.
  - `derby.mjs`: 5 real casts at the farm pond on Summer 22, hand-in confirm.
  - `derby2.mjs`: 5 real casts in the town river on derby day.
- **Moving buildings** (`coop6.mjs`):
  - E presses on a coop with 3 hens, then the Move sheet and "Move it";
  - Opts > Save now, reload, Continue, then placed again with Action;
  - a silo stocked and then empty.
- **Silo nights** (`silo.mjs`): two real bed sleeps with a coop, a barn and a sty.
- **Greenhouse and placement** (`gh6.mjs`):
  - Action on the greenhouse site and on unbought land;
  - late planting under glass;
  - a real sleep across Summer 28 to Fall 1.
- **Garden bench** (`bench.mjs`): bought on the shop's Home tab, placed with Action, sat on with E.
- **Mail with a full bag** (`mailfull.mjs`): two real bed nights, then Read and Take gift.
- **Clipping sweep** (`sweep.mjs`): real taps on every menu tab, every shop tab and its pages, and then:
  - the board and projects;
  - a villager sheet and its gift list;
  - the bin, a plot sign and a jar;
  - the sleep sheet and the summary.

  Each was machine-checked for text overlap and overflow, and screenshotted.
- **Land signs and the forage ring** (`signs.mjs`): screenshots.

**Verified only by reading code or data, or with the real rule functions in vitest:**
- the sizes of animal specials (`makeSpecial`);
- the statue's price curve;
- the bug in the sim bot's season choice (an instrumented copy of the sim);
- the share of day-1 requests that are crops;
- Clay's schedule against his 2-heart perk.

**Not verified at all:**
- real phone, audio, performance;
- heart events, the Flower Show entry, mine floors and the year-end screen;
- truffle digging and the bee house in live play;
- befriending Clay in play (hearts were set in state);
- a second year of real play.

---

## 1. Critique 5 findings re-checked

| C5 | Then | Now | How checked |
| --- | --- | --- | --- |
| F1 Clay toothless | board reset daily | **Partly fixed.** Requests last 2 to 3 days and Clay takes the best one at 2 PM. In play he took 7 requests on days 8 to 14, three of them potato requests; on two of those days the bot had just harvested potatoes. But he only acts if you look at the board after 2 PM (new **F2**), and the dearest request never outlives its first afternoon (new **F3**). | played |
| F2 basket kinds | 3 qualities = 3 goods | **Fixed.** A second pumpkin of another quality is refused (Add disabled). Rows name the kind ("Veg 495"). The basket line shows "+15%" or "+30%". | played (shot `45`/`46`) |
| F3 chore tap lifts coop | 4th E lifted it | **Fixed.** The 4th E opens "Move the Coop? ... Move it / Leave it". Extra E presses on the sheet do nothing. "Move it" keeps hens and joy through save/reload. A hungry coop and a stocked silo also go to the sheet; an empty silo still goes with a second tap. **Caveat:** Enter confirms "Move it" (keyboard only). | played (shots `51-move-sheet-coop`, `54-move-sheet-silo`) |
| F4 derby blind | no feedback | **Fixed.** Each improving catch toasts ("Derby best! Catfish. Score 185."). The page names each fish, says "Catfish stocked in the town river today!", and asks "Sure? Tap to hand in" before 6 PM. Three farm-pond bluegill (105) reach 3rd place. In the town river, 2 catfish in 5 casts scored 185 (2nd). | played |
| F5 perpetual greenhouse corn | regrow forever | **Fixed.** Corn on Summer 26 under glass is refused ("Too late (13 days). Regrowing crops last one season, even here."). At Fall 1 a regrowing corn and an unripe corn under glass died, and a melon survived ("2 crops withered with the new season."). | played |
| F6 placing on the greenhouse site | allowed | **Fixed.** "The Greenhouse will stand here. Fund it at the town board." On the West Field: "Not your land yet. Buy it at a sign." The yard is still free. | played |
| F7 silent starving barn | no line | **Fixed.** "The barn went hungry: the silo needs 2 Hay." on both nights. | played |
| F8 text | `+0g` buttons, shop cut, truffle not in Book | **Fixed.** "All the gold is in!" with Give goods disabled while goods are missing. "Strawberry 8d 80g, own 15". Animal Goods is 0/5 with a truffle silhouette. **New nit:** finished projects without perks read "Done: " with nothing after (F8 below). | played |
| F9 sim is a tripwire | one seed, no clock | **Partly.** Five seeds are now judged on the median (224k, 149k, 219k, 210k, 178k; median 209,894). There is still no clock. The bot's goal is still "forage" all year. The new two-year sim has a dead year-2 summer (**F5**), so its sink evidence is skewed. | test logs |

---

## 2. Ranked findings

### F1 (Blocker). The Town Projects list overflows: the Market Road cannot be opened, and the Founder's Statue is off the screen

- **Repro (played; shots `63-projects-8-rows`, `64-after-open-8`, `60-projects-list-statue`):**
  1. Finish canopy, Seed Exchange, Fish Ladder, Library, Greenhouse, Hot Spring and Fair Hall.
  2. At the board, tap Town projects.
  3. The Market Road is the 8th row. Its row and its "Open" button (logical 172,377) sit **under the Close button** (100,383, 190 px wide).
  4. A tap on Open closes the sheet (`openPanel` = null afterwards). The "More after the Market Road." line is hidden too.
  5. Now also finish the Market Road. The Founder's Statue becomes the 9th row: its "Open" button is at **y 403 on a 400-px canvas**, below the screen edge. A tap there does nothing.
- **Cause:**
  - `src/ui/panels/ProjectPanel.ts:33` uses a fixed `super(scene, 250)`.
  - `buildList` (`:59`) lays every visible project (finished ones included) at 26 px a row from y 34, with no paging and no `setHeight`.
  - `BoardPanel` grows its sheet; this one does not.
  - Nine projects need about 34 + 9×26 = 268 px before Close.
- **When it bites:**
  - The Market Road is hidden whenever the Fair Hall row is also shown, which happens once the Fish Ladder is done.
  - The statue is always row 8 or 9, so it is **never reachable by touch**.
  - No keyboard path exists.
- **Impact:**
  - The 60,000g Market Road is unreachable in the common case.
  - The Founder's Statue, this round's answer to "nothing to buy late", cannot be funded at all.
  - The two-year sim says the statue absorbs about 220k of gold; in the real UI it absorbs none.
  - No test covers the list with all projects visible (`tests/layout.test.ts` has no projects case).
- **Fix:**
  - Fold finished projects into one line ("7 finished: Canopy, Library...") or a second page.
  - Or page the list at 6 rows, like the Book, or grow the sheet like the board.
  - Add a layout test with every project visible, asserting that each Open button is above Close and inside 400.

### F2 (Major). Clay only competes if you look at the board after 2 PM; a morning-only player never loses a request

- **Repro (played, `clay.mjs`, shots `70-board-d8-morning` to `70-board-d10-afternoon`):**
  1. Day 8, 9:00: E at the board. It says "Clay takes the best one at 2:00 PM." The best request is 2 Cauliflower 585g, open until day 9.
  2. Sleep in the bed. Day 9, 9:00: the board still shows the 585g cauliflower request, open. `rivalTook` = 0.
  3. Sleep again. Day 10, 9:00: new requests; still `rivalTook` = 0. Clay never acted on days 8 or 9.
  4. Day 10, 15:00: open the board. "Clay took one today." He took the 620g potato request.
- **Cause:**
  - `applyRival` (`src/systems/rival.ts:48-51`) runs only from `BoardPanel.build` (`BoardPanel.ts:26-27`) and `deliverOrder` (`orders.ts:148`).
  - The morning hook (`src/mechanics/orders.ts:6-11`) calls `refreshBoard`, never `applyRival`, so a day nobody looked at the board after 2 PM is simply skipped.
  - DECISIONS says the lazy design "cannot fire twice". It can fire **zero** times.
- **Impact:**
  - The race only exists for players who visit the board in the afternoon. A player who checks the board with their morning coffee, which is the habit the game teaches ("mornings a reason to visit town"), never meets Clay.
  - Worse, two-day requests then give that player a free extra morning that the rules say Clay should have closed.
  - This is the critique-5 F1 problem in a new form.
- **Fix:**
  - In the morning hook, before `refreshBoard`, settle yesterday: if Clay was active and `rival.day` is not yesterday, he takes his request(s) from yesterday's open list. Note it in the summary ("Clay filled the 4 Potato request yesterday.").
  - Add a test: a board opened only before 2 PM still loses a request overnight.

### F3 (Medium, design). When Clay does act, the dearest request never lives past its first afternoon, so multi-day planning only ever applies to the requests you care least about

- **Played, days 8 to 14:** Clay took 7 requests, every one of them the top-paying one:
  - potato 680g, trout 250g, daffodil 225g, parsnip 220g, potato 515g, potato 630g, trout 405g;
  - 5 of the 7 were taken **on the afternoon they were posted** (days 9, 11, 12, 13, 14);
  - on days 8 and 12 the bot harvested potatoes that same day and shipped them at the bin instead.
  - The bot filled 2 requests in 14 days, both wild leek, the cheapest row.
- **Cause:**
  - `applyRival` sorts open requests by reward and takes the first (`rival.ts:56`), whatever its days left.
  - New requests appear every morning, so a fresh, dear request is always at the top at 2 PM.
- **Also early:** on day 1, a third of requests are crops (100 of 300 over 100 seeds, `facts.test.ts`). No crop can be grown within a request's 2 or 3 days. The early board is mostly a list of things you cannot have.
- **Readability is fine:**
  - the board says "Clay takes the best one at 2:00 PM.";
  - the row says "Clay filled this one." in orange (shot `72-play-board-afternoon-d8`).
  - It just does not say which one he is eyeing.
- **Fix (pick one):**
  - Clay takes a request only on its **last day** (so a 3-day request really is a 3-day plan).
  - Or he takes the best request that has been up at least one full day.
  - Show "Clay has his eye on: 4 Potato" on the board, so the race is about a known target.

### F4 (Medium). Animal specials ignore how many animals you have; with one hen the egg special cannot be finished

- **Measured with the real `makeSpecial` (`c6/facts.test.ts`):**

| Farm | Special | Makes | Days needed (10 to 28 left when posted) |
| --- | --- | --- | --- |
| 1 hen, year 1 | 30 Egg (2,250g) | 1/day | **30** |
| 1 hen, year 2 | 45 Egg (3,400g) | 1/day | **45** |
| 3 hens, year 2 | 45 Egg | 3/day | 15 |
| 1 cow, year 1 | 14 Milk | 1/day | 14 |
| 1 cow, year 2 | 20 Milk | 1/day | 20 |
| 1 pig, year 2 | 19 Truffle | 1/day at most (dry days only) | 19+ |

- **Cause:**
  - `src/systems/specials.ts:42`: `qty = max(5, round(value / price))`, from a gold target only.
  - The only animal gate is `animalOutput(state).has(item)` (`:35`).
  - Orders got `animalOrderCap`; specials did not.
  - Specials are posted with as little as 10 days left.
- **Impact:**
  - A new chicken owner is given an impossible 30-egg special. It blocks the season's special slot until it expires; only the eggs given are refunded at bin price.
  - "Sizes sensible for the animals owned": no.
- **Smaller, same family (data read):**
  - Honey requests ask for 1 honey (90 to 110g) for 2 or 3 days, while a bee house makes one every 4 days, so some cannot be filled.
  - Truffle output counts every pig every day, ignoring the dry-day rule.
- **Fix:**
  - Cap animal specials at about (days left − 2) × daily output, or post them only when that cap reaches the value target.
  - Count pigs at about 60% (weather).
  - Ask for honey only when a house is ready.

### F5 (Medium, test plus UX). The two-year sim plants nothing for the whole of its year-2 summer; the same trap waits for players

- **Evidence (instrumented copy, `c6/sim2.test.ts`):**
  - Summer 1 to Fall 1 of year two: 0 crops on 280 owned tiles for 28 days, gold idle at 30,000.
  - Earned 316,773 to 320,156, against 20.8k in year-1 summer, 67k in year-2 spring and 221k in year-2 fall.
- **Cause:**
  - With the greenhouse, `stockFor` sells every season's seeds.
  - The bot's `score()` (`tests/sim.test.ts:88`) ignores `crop.seasons`, so `best` is pumpkin (19.2 a tile-day) in summer (`:179`).
  - Every outdoor plant is refused ("Won't grow in summer"), and the bot's greenhouse is excluded from `field()`.
- **Impact:**
  - **On the test:** "the statue absorbs a tireless farmer's second year" is measured with a season of income missing. It also hides how much more gold a real year two makes.
  - **On players:** the shop shows exactly the same trap. In fall with a greenhouse, the Seeds tab lists "Parsnip Seeds 4 days 35g" and "Melon Seeds 12 days 310g" with no season or "glass only" marker (shot `s-shop-Seeds`, 4 pages). x5 buys are easy to make and then refused in the field.
- **Fix:**
  - **Test:** make `score()` require an outdoor season, and plant the greenhouse plot too. Then re-pin the two-year numbers.
  - **Shop:** tag out-of-season seeds "glass only", and sort in-season seeds first.

### F6 (Minor, balance). The Winter Feast is trivially won; any two good items take the Harvest Fair

- **Winter Feast (played):** gold melon wine, melon jam and pumpkin pickles scored "3/3 2,400 +30%" against Clay's 927, which is 2.6× first place. Now that every preserve is its own kind, three jars' output always wins.
- **Harvest Fair (played):** a gold pumpkin and a gold melon (2 of 3 goods) scored 1,104 +15% and won over 979.
- **Prizes:** 1,000g, or 2,000 with the Fair Hall. That is a day of late-game farming.
- **Fix:**
  - Raise the Feast's top rival to about 1,600 to 1,800.
  - Make an incomplete basket score visibly less (for example, an empty slot costs 15%).
  - Scale prizes with year.

### F7 (Minor). The garden bench: the third tap picks it up, and a near-full sit uses up the day

- **Played:**
  1. E: "You sit a while. +15 energy."
  2. E: "Garden Bench Tap again to pick up."
  3. E: **the bench is in the bag.**
  - So someone mashing E to sit ends up carrying the bench. There is no "You've rested today" line.
- **Code:** `src/mechanics/decor.ts:13-15`. At 95/100 energy the sit gives +5 and still spends the day's rest; only a completely full player keeps it.
- **Fix:**
  - After the sit, answer "Rested today. Back tomorrow." and do not arm pick-up on that message.
  - Allow the sit only when at least 15 energy is missing, or keep the rest for later.

### F8 (Minor). Text and clipping (from the sweep, 41 screens)

The machine check found no text overflowing a sheet except these, all confirmed on screenshots:
- **Projects list:**
  - Finished projects with no perks read "**Done: **" with nothing after it: Seed Exchange and Greenhouse (`projectText.ts:14` → `perkLine({})`).
  - "More after the Hot Spring." is cut by Close with 7 rows (shot `s-projects-list`), which is F1's little brother.
- **Villager sheet with a Shop button (Mara):** "1 gift a day." runs off the right edge (`NpcPanel.ts:172`; shot `s-npc-mara`).
- **Move sheet for a silo:** "It goes into your bag with 30 feed. Place it again and they are all still there." (`moveText.ts:4`). "They" is wrong for feed.
- **Move sheet:** Enter (the confirm key) presses "Move it". This is keyboard only, but it is the one place where the confirm key does the risky thing.
- **Sleep sheet:** "Go to bed?" overlaps "It is 10:21 AM." by 2 px (cosmetic).
- **Season change:** the summary says "2 crops withered with the new season." even for crops under glass. "Regrowing crops under glass are spent at the season's end" would teach the F5 rule.
- **Shop:** the strawberry row ("Strawberry 8 days 80g") never says it regrows, which is the whole point of rare seeds.
- **Scarecrow:** the 9×9 radius is not shown when placing.

### F9 (Minor). Small leftovers

- **Land signs:**
  - Day 1 shows only the West Field sign (700g). Good.
  - With 1,000g earned (day 3 to 5 in play), all five signs show, including 2,200 and 2,600, because "earned a quarter of the price" is only 650.
  - The quiet period lasts a few days. This is by design, but a half-price threshold would read better.
- **Seeds left in the bag:** the play bot reached a field slot with seeds only in the bag 161 times. That is the bot's fault (it does not move stacks), but it shows the old "long-press hotbar picker" gap (critique 4, "Not done") still costs a one-thumb player.

### Not a bug (positive)

- **Mail with a full bag:** "Make room in your bag first." The gift stays in the letter. Letters wrap cleanly and page 1/2 works (shots `81` to `83`).
- **Seed Exchange end to end:**
  - funded with the +100/+1,000/+6,000g buttons and Give goods, with a clear finish toast;
  - strawberry seeds on the shelf at once;
  - x5 bought, and planted with Action.
- **The derby** is now a good day of play: toasts, names, stocked catfish, and a hand-in confirm.
- **Crows are fair:**
  - Rosa's letter brings a free scarecrow on day 7, next to Clay's letter.
  - One crop (a cauliflower) was lost in four unguarded days.
  - The morning line is clear: "A crow ate a cauliflower. Scarecrows keep them off."
- **Forage ring and twinkle** read well from a distance (shot `94-forage-ring`).
- **Silo, greenhouse and placement messages** are all clear and correct.
- **Clay year two:**
  - "Clay takes the best two at 2:00 PM."; he took two and left one.
  - At 2 hearts: "Clay takes the best one at 5:00 PM.", and he did not act at 3 PM. He took one when the board was opened at 5:10 PM.
  - His schedule now matches the perk.

---

## 3. The days played (real input, teleports between spots)

| Day | Wake gold | Jobs done | Mail | Board (morning) / Clay (15:00) |
| --- | --- | --- | --- | --- |
| 1 | 500 | none posted | none | parsnip 165, **cauliflower 700 (2 days)**, leek 115: none fillable |
| 2 | 40 | 3/3 | Welcome (+3 potato seeds) | + special "15 Potato for Rosa 2,250g" |
| 3 | 99 | 3/3 | Finn (+5 bait), Orin (+2 copper ore) | mushroom 295 |
| 4 | 515 | 2/3 | none | 3 cauliflower 955 (impossible this early) |
| 5 | 607 | 3/3 | none | same, last day |
| 6 | 791 | 2/3 | Rosa, first harvest (+3 fertilizer) | 5 potato 680 (3 days) |
| 7 | 918 | 3/3 | Clay's challenge; Rosa's crows (+scarecrow) | Clay not active yet |
| 8 | 1,370 | 2/3 | Mara town fund; Orin (+3 copper bar) | Clay took potato 680 (bot harvested potatoes that day) |
| 9 | 1,919 | 2/3 | Rosa (+cherry sapling) | crow ate a cauliflower overnight; Clay took trout 250 |
| 10 | 2,070 | 2/3 | Finn (+15 bait) | Clay took daffodil 225 |
| 11 | 2,342 | 3/3 | Mara's birthday hint | **filled 4 leek**; scarecrow placed; Clay took parsnip 220 |
| 12 | 2,562 | 3/3 | none | **filled 5 leek**; Clay took potato 515 (bot shipped 8 potatoes) |
| 13 | 3,156 | 1/3 | Flower Show notice | Clay took potato 630 (no potatoes harvested that day) |
| 14 | 3,214 | 2/3 | none | Clay took trout 405 |

- **Totals:** 31 jobs done (about 1,400g), 2 orders, 6,396g earned by the end of day 14.
- **Gaps in the jobs** (chat, gift, ship) are the bot's limits, not the game's: every posted job was doable.
- **The goal tracker** stayed on "Craft something at the workbench" from day 6, because the bot never crafts.

## 4. One-thumb reach

- **In the bottom third** (logical y 330 to 395):
  - Close is at y 383 on every sheet;
  - Sleep, Wake up, Present the basket, Hand in, Move it and Leave it, and the project gold buttons (y 329) with Give goods (y 355).
- **Mid-screen, still reachable:**
  - Board "Give" buttons, y 230 to 330.
  - Shop buy buttons start at about y 170.
  - The mail list's Read buttons are at y 185 to 289.
  - Project "Open" buttons start at y 184.
- **Unreachable:** only the F1 cases.
- **Safety:** "Leave it" sits where Close always is, so the habitual tap is the safe one.

## 5. Progression and economy

**Early game (days 1 to 14):**
- **My play bot** (crops, forage, fishing, mining, jobs) earned 6,396g:
  - jobs about 22%;
  - board orders about 5% (2 filled);
  - the rest from shipping.
- **The farm-only sim bot** earned 1,770g by day 14.
- **Jobs** are now the steadiest early income after crops.
- **The board** is near dead early: crop requests cannot ripen in time, and the dearest one goes to Clay (F3).
- **The potato special** (2,250g for 15) is a good first plan.

**Year one (sim, 5 seeds):** median 209,894.
- Fall 15 to Winter 1 earns about 85k in 14 days.
- The year ends with about 132k in hand (seed 42).

**Year two (sim, funding projects):**
- All 8 projects by year-2 spring; statue level 4; 31k left.
- But:
  - the year-2 summer is missing (F5);
  - in the real UI, the Market Road and the statue cannot be opened (F1).
- **For a human, today's late game still ends with gold and nothing to put it in.**

**Statue curve:**

| Level | Price | Running total |
| --- | --- | --- |
| 1 | 30k | 30k |
| 2 | 45k | 75k |
| 3 | 67.5k | 142.5k |
| 4 | 101k | 244k |
| 5 | 152k | 396k |

- That is +5% on sales for 396k, followed by cosmetic levels (228k, 342k, 513k...).
- As a pure sink this is sensible, and the 1.5× growth means it never runs dry.

**Side income:**
- Animal-good requests are small and fair: 2 eggs for about 140g, 1 honey for about 100g. The specials are not (F4).
- The garden bench (600g for +15 energy a day) is a fair, small perk.
- Festivals at 1,000g are background noise after summer (F6).

**Runaway or dead:**
- Nothing runs away in year one.
- Dead or near dead:
  - the early board (F3);
  - the statue and the Market Road in the UI (F1);
  - animal specials for small herds (F4).

## 6. Top 3 things to add next

1. **A Town Projects sheet that scales:** finished projects folded or paged, a statue page showing "Level 3 → 4, +1% (now +3%)", and a layout test with every project visible. Without it, this round's late-game sink does not exist for players (F1).
2. **A rival you can plan against:**
   - Clay settles his days overnight, so looking at the board is never required to "allow" him to act (F2).
   - He announces which request he wants and takes it on its last day.
   - The race becomes "can I gather 4 potatoes by tomorrow?" instead of "was I at the board before 2 PM?" (F3).
3. **Requests sized to your farm:**
   - specials capped by daily output × days left (F4);
   - early crop requests that wait for that crop to be planted;
   - "glass only" tags in a greenhouse year's seed shelf (F5).

## 7. Verdict

**Stable and much improved.**
- 502 tests pass and there were 0 page errors in 14 played days and every probe.
- Seven of the nine critique-5 findings are fixed through real input, and fixed well:
  - baskets, the Move sheet, the derby, greenhouse regrowth, placement, the silo line, and project/shop text.
- The new content mostly works: crows, the free scarecrow, the bench, animal requests, Clay in year two, mail with a full bag, and the Seed Exchange.

**One blocker:**
- The Town Projects list cannot show nine projects.
- So the Market Road is usually untappable, and the Founder's Statue, the late-game gold sink this round was built around, cannot be opened at all.

**One major design hole:**
- Clay acts only when someone looks at the board after 2 PM, so morning players never meet him.
- When he does act, he always takes the newest dearest request.

Fix F1 and F2 before anything else; F3 to F5 are the next round's depth work.

## Screenshots (`critique-6/shots-6/`)

| Group | Files |
| --- | --- |
| Play run | `01-day1-farm-planted`, `02`/`03`/`04-summary-day2..4`, `20-scarecrow-placed`, `71-play-board-morning-d12`, `72-play-board-afternoon-d8`, `73-play-letter-crows` |
| Clay | `70-board-d8-morning`, `70-board-d9-morning`, `70-board-d10-morning`, `70-board-d10-afternoon`, `70-board-y2-*` |
| Projects (F1) | `60-projects-list-statue`, `61-statue-detail-l0`, `63-projects-8-rows`, `63-projects-9-rows`, `64-after-open-8`, `64-after-open-9`, `65-seedx-detail`, `66-seedx-done`, `67-shop-rare-seeds`, `68-project-gold-in` |
| Festivals | `40-board-derby-day`, `41`/`42`/`43-derby-*`, `44` to `49` (baskets) |
| Buildings | `51-move-sheet-coop`, `52-coop-picked-up`, `54-move-sheet-silo`, `56-summary-silo-fed` |
| Greenhouse and placement | `30-place-refused`, `36-greenhouse-summer26`, `37-summary-season-change` |
| Mail and bench | `80-shop-home-bench`, `81-mail-list-full`, `82-mail-letter-gift-fullbag`, `83-mail-take-fullbag` |
| Signs and forage | `90-day1-south-field`, `91-west-sign`, `92-east-sign-area`, `93-hilltop-area`, `94-forage-ring` |
| Sweep | `s-*` (41 screens: every menu tab and page, shop tabs and pages, board, projects, villager and gift list, bin, plot sign, jar, sleep, summary) and contact sheets `cs-1` to `cs-5` |
