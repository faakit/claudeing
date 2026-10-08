# Tiny Acre: independent critique 7

Reviewer: independent QA lead and game critic, round 7.

**Status: complete for the scope below.** Every critique-6 finding (F1 to F9) was re-checked, all of the content added since (the Kitchen and six dishes, legendary fish, bees near tulips, the human-paced sim) was exercised, two 14-day new games were played, every sheet and tab was swept for clipping, and the sims were run and instrumented. Real phone, audio and performance were out of scope (see "Not verified").

**Frozen build:** commit `f27999e` (branch `depth/round2`), copied to `critique-7/farm-game` with `git archive`. It is not a git checkout, so I could not confirm the hash myself.

**Method:**
- Headless Chromium (playwright-core, chromium-1217), 390x844, `hasTouch`, against `vite` on **port 5192**. The server was started for this session and stopped at the end.
- The `?debug` hook was used to set up state and read it back. No game file was edited.
- Probes are in `critique-7/farm-game/agents/out/c7/` (logs in `c7/tmp/`). Screenshots are in `critique-7/shots-7/`.
- `npx vitest run`: **63 files, 522 tests pass.**
- `tests/sim.test.ts` was run with its logs printed. An instrumented copy of the one-year sim (`c7/boardsim.test.ts`) counted what the board posts and who fills it. `c7/facts7.test.ts` measures special sizes, legend odds and the board mix with the real rule functions.
- 0 page errors in every browser session. The only console error was caused by my own probe (a listener calling a non-existent `off()`), fixed and re-run.

## What I verified by playing, and what I did not

"Real input" means keyboard (arrows, Space, E, M, Esc, Enter) and real touch taps on canvas buttons located from the live UI tree.

**Moving between spots was by teleport (`snap`/`goMap`), not by walking.** The clock was set in the cases named below.

**Played with real input:**

- **Two 14-day new games** (`play.mjs` → `tmp/play14.out`; `play2.mjs` with `KEEP=1` → `tmp/play14-keep.out`). Every farm, bin, shop, board, mail, chat, gift, fishing (real reel), mining and bed action was real input. The clock was moved to 8:00 when the bot reached town (shop hours). There was **no afternoon look at the board** this time: Clay is now judged by the morning summary.
  - Run 1 ships everything at the bin (like critique 6). Run 2 keeps goods that an open request or the special wants, which is closer to a human who reads the board.
  - Run 1: 30 jobs done, 1 request filled + 5 cauliflower given to the special, Clay took 5, earned 5,478g by the end of day 14.
  - Run 2: 32 jobs, 5 requests filled (820g), the potato special finished (2,250g), Clay took 7, earned 5,705g.
- **Projects list** (`proj7.mjs`): seven projects done in state, then real taps: Town projects, Open on the Market Road, +gold buttons and Give goods until it finished, the Finished page and its paging, Open ones, Open on the statue, two statue levels, Close.
- **Clay** (`clay7.mjs`, `clay7y2.mjs`): day and year set in state; real E at the board and real bed sleeps for days 7 to 11 (morning looks only), a real Give on his target, a 3 PM look; then year two, and year two at 2 hearts.
- **Kitchen and dishes** (`kitchen7.mjs`): ingredients put in the bag by state; real taps on the shop Home tab (Kitchen 2,500g), the Make tab (all six dishes), the bag card's Eat button at 50, 95 and 100 energy; Action with a dish in hand (at 30, at 100, and facing a ripe crop); the bin sheet.
- **Legendary fish** (`legend7.mjs`): 9 catches set in state, the 10th by a real cast; real bed; the letter read with real taps. Then the season was set to summer and **50 real casts** at the farm pond.
- **Bees** (`bees7.mjs`): two bee houses placed and tulips tilled and planted with Action; four real bed nights (tulips kept watered in state); E at the hive.
- **Greenhouse seed shelf** (`gh7.mjs`): greenhouse in state, fall; real taps through the Seeds tab, x5 melon, Action to plant outdoors and under glass.
- **Fair and Feast** (`fair7.mjs`, six baskets): goods in state; real Enter, Add and Present taps.
- **Bench** (`bench.mjs`, `bench2.mjs`): bought on the Home tab, placed with Action, E mashed at 40, 60 and 95 energy.
- **Move sheet** (`coop6.mjs`): E presses on a coop and a silo, Enter on the sheet, Move it, save/reload.
- **Clipping sweep** (`sweep.mjs`, 44 screens): real taps on every menu tab and page, every shop tab and page, the board, projects, villager and gift sheets, bin, sign, jar, sleep and summary, each machine-checked for overlap and overflow.

**Verified only by reading code or data, or with the real rule functions in vitest:**
- special sizes against herd size (`specialCap`), legend odds per cast, the board's mix of request kinds;
- what the board posts and who fills it across a simulated year (`boardsim.test.ts`);
- dish prices against ingredients, and that legend and dish textures are missing from the atlases.

**Not verified at all:**
- real phone, audio, performance; walking times (every move was a teleport);
- the Glimmer Trout, Old Whiskers and Ice Pike in live play (only the Sun Carp was cast for);
- heart events, mine floors, the year-end screen; a second year of real play.

---

## 1. Critique 6 findings re-checked

| C6 | Then | Now | How checked |
| --- | --- | --- | --- |
| F1 projects list overflow | Market Road under Close, statue off screen | **Fixed.** With 7 done, the list shows only the Market Road (Open at y 195) and "More after the Market Road."; its Open opens the page. With 8 done, the statue is the one open row; "Finished (8)" pages 5 + 3 rows with `<` `>` above Close, and "Open ones (1)" comes back. Two statue levels were funded by touch. Perk-less rows say "Done!". **Nits:** finishing a statue level bounces you back to the list; the statue page never says the bonus you already have (F9). | played (shots `60` to `67`) |
| F2 Clay only if you look after 2 PM | morning player never lost | **Fixed.** A morning-only player (board looked at 9 AM, then bed) lost the eyed request every night: "Clay filled 4 Bluegill on the board." in the summary. | played |
| F3 newest, dearest taken the same afternoon | | **Fixed as designed, with a cost (F2 below).** A request is safe on its posting day ("Clay wants nothing here today." when all are new). The board names the target ("Clay wants this one at 2:00 PM." and "Clay's!" on the row). Filling his target before 2 PM moves him to the next one (he took the 165g leek). Year two: "Clay wants two of these", both taken overnight; at 2 hearts "at 5:00 PM", one. Crop requests now appear only for crops you grow or carry, but "grow" means "planted", not "ripe in time" (F1 below). | played |
| F4 specials ignore herd size | 30 eggs from one hen | **Fixed, tightly.** Capped at (days left − 1) × output: one hen on day 1 gets 26 eggs (every egg for 26 of 28 days); one pig gets 13 truffles at 0.6 a day (22 of 28 days, weather permitting). Not posted when the cap is under 5 (one pig on day 19). See F8. | vitest (real functions) |
| F5 greenhouse seed trap | no season marker | **Fixed.** In fall with a greenhouse, the shelf lists Pumpkin, Yam, Cranberry first, then "Glass 4d", "Glass 12d 310g"... An x5 melon outdoors: "Won't grow in fall. Plant in summer."; under glass it planted. Regrowers outdoors say "10d 75g, again 3d". **Nit:** under glass the regrow note is dropped ("Strawberry Glass 8d 80g"). | played (shots `50-*`) |
| F6 Feast/Fair too easy | 2.6× Clay | **Fixed.** Fair: gold pumpkin + gold melon (1,104) is 2nd; three golds of two kinds (1,234, +15%) are still 2nd behind 1,339; a plain 3-kind basket is 3rd. Feast: a lone gold wine is 2nd; three jars (2,400) win over 1,648 (1.46×). | played (shots `55`/`56`) |
| F7 bench mashing | 3rd E lifts it | **Partly fixed.** Right after a sit, E answers "Rested. Back tomorrow." six times and never lifts it. But at 95/100 energy (sit kept), or when coming back later the same day, **two E presses lift the bench** with no "rested" line (F5 below). | played |
| F8 text | | **Fixed:** "Done!", "1 a day." fits beside Shop, silo Move line, Enter no longer presses "Move it" (sheet stays open), "Go to bed?" clear of the time. | played (sweep, `coop6`) |
| F9 land signs, seeds in bag | | Signs: not re-measured. The play bot still found seeds only in the bag 245 and 145 times (the long-press picker is still with the controls agent). | played |

---

## 2. Ranked findings

### F1 (Medium). Crop requests still ask for crops that cannot ripen before the request ends, and they are the dearest rows, so Clay's daily take is often a request nobody could fill

- **Repro (played, both 14-day runs):**
  1. New game; plant parsnips, potatoes and three cauliflowers on day 1 (potatoes ripen on day 8, cauliflowers on day 11).
  2. Run 1, day 4: "3 Cauliflower 895g 3 days", open until day 6, the dearest request on the board.
  3. Run 2, day 3: "2 Potato 255g 2 days" (until day 4); day 6: "3 Potato 400g" (until day 7); day 9: "2 Cauliflower 720g", made Clay's target on day 10 and taken that night ("Clay filled 2 Cauliflower on the board."), one day before the cauliflowers ripened.
  4. Of eight crop requests in the two runs, four could not be filled by anyone farming normally (the crop ripened after the last day). Of the other four, three went to Clay (two of them after the bot's goods went to the special, F4), and one expired on its last day while the run-1 bot shipped its potatoes.
- **Cause:** `src/systems/orders.ts:33-41`. `orderCandidates` admits a crop if any tile grows it (`growing.has(id)`) or the bag holds one; it never compares the crop's ripening day with the request's `until` (2 or 3 days later, `orders.json` `days`).
- **Impact:**
  - The fix for critique 6 F3 moved the impossible requests from "crops you never planted" to "crops you planted yesterday". Early boards still show a 700 to 900g row you can only watch.
  - Because crop requests are worth more than fish and forage ones, they are exactly what Clay targets, so his "win" is often free.
- **Fix:** post a crop request only when the bag holds enough, or a planted crop of that kind ripens on or before the request's last day; or set `until` to that ripening day plus one. Add a test: a day-2 board for a day-1 cauliflower field has no cauliflower request.

### F2 (Medium, design). Clay is now readable and fair to morning players, but he takes the dearest request every day, and the row's "3 days" is not true for it

- **Played (run 2, days 8 to 14):** Clay took one request every single day: trout 410, mushroom 275, cauliflower 720, trout 505, potato 595, bluegill 265, mushroom 405 (3,175g). The bot filled two after day 8, both daffodil (180 and 255). Run 1: Clay took 5 of 7 days. Year two (`clay7y2`): he took two of the three requests on their second day, then the third the day after.
- **Sim (`boardsim.test.ts`, one year, seed 42):** 158 requests posted, the farm bot filled 6, **Clay took 103 (65%)**.
- **What the player sees:** a new request reads "3 days" on its posting day. If it is the dearest, it becomes "Clay's!" the next morning and is gone at 2 PM: its real life is about 32 hours, not 3 days. Only the cheaper rows ever use their full days.
- **Readability is good:** the target row is named, the morning summary says what he took, and "Clay wants nothing here today." appears on all-new days (shots `70-board-*`). One small point: the target's orange "Clay's!" is close to the special's gold line just above it (shot `70-board-d10-morning`).
- **Cause:** `src/systems/rival.ts:43-50` picks the best-paying request posted before today. `src/ui/panels/boardText.ts:13` shows days left until he has picked it.
- **Fix (pick one):**
  - Show "Clay may take it tomorrow" on the dearest row from its posting day, instead of "3 days".
  - Or have Clay take a request only on its last day (critique 6's first option), which makes "3 days" honest.
  - Or let him skip a day when the player filled a request that day, so the race has a reward beyond the gold.

### F3 (Medium, design). For a farmer, the board is mostly fish and forage; it rarely asks for what you grow

- **Measured (`facts7.test.ts`, 300 spring day-10 boards for a potato grower):** 391 fish, 365 forage, 144 crop requests: **crops are 16%.**
- **Sim year:** fish 62, preserves 43, forage 37, crops 16 of 158.
- **Played:** run 2's day-1 board was "5 Bluegill, 4 Trout, 4 Daffodil"; fish rows were on the board 11 of 14 mornings in run 1 and 14 of 14 in run 2.
- **Cause:** `orders.ts:43-45` adds every in-season fish and every forage of three maps to the pool whatever the player does, while crops are gated (F1). The pool is drawn uniformly (`generateOrders`, `:70`).
- **Impact:** the board is alive for an angler or forager, and early on that is a good thing (the first fillable rows were leeks, parsnips and daffodils). But a farming game's request board that asks a farmer for trout most days teaches "the board is not for me". Combined with F2, the board was about 14% of early income in run 2 and 1.6% of the sim bot's year.
- **Fix:** weight candidates by what the player did in the last few days (`caught`, `foraged`, `harvested`), or keep one of the three rows for a crop that ripens in time (F1).

### F4 (Minor). The special's Give sits on top and takes every matching item at once, starving a same-item request

- **Repro (played, run 1 day 11):**
  1. The board shows "7 Cauliflower for Mara, Special 0/7 2,400g" with an enabled Give, and below it "3 Cauliflower, Have 3/3, 930g".
  2. Tap the top Give: all three go to the special (3/7).
  3. The next morning the 930g request is "Clay's!" with Have 1/3, and he takes it.
  4. Run 2, day 12: same pattern with "4 Potato 595g Clay's!" (the special finished, so that tap was the better one; the player was never asked).
- **Cause:** `BoardPanel.ts:39` puts the special first; `giveToSpecial` takes `min(qty − given, count)` (`specials.ts:114`) with no amount and no warning.
- **Also:** the finished potato special was posted again the next morning, identical ("Special order: 15 Potato for Rosa"), because `morningSpecial` draws from the same pool (`specials.ts:92`). Spring has only two plain specials, so a repeat is a coin flip.
- **Fix:** when an open request wants the same item, have the special's Give keep enough for it (or ask "Fill the 930g request first?"); label the button "Give 3". Exclude the special just finished from the next draw.

### F5 (Minor). Bench: two E presses still lift it when the sit is unavailable

- **Repro (played, `bench2.mjs`):**
  1. Place the bench; set energy to 95.
  2. E: "Garden Bench Tap again to pick up." E: **the bench is in the bag.**
  3. Re-place it, sit at 50 (+15), wait 5 s, E: "Garden Bench Tap again to pick up.", E: lifted. There is no "Rested today" line once the 4-second window has passed.
- **Cause:** `src/mechanics/decor.ts:29-31`. "Rested. Back tomorrow." (with `arm: false`) is only returned within `ARM_MS` (4 s) after a sit; otherwise E falls through to the name, which arms pick-up.
- **Fix:** whenever a resting bench cannot be used (rested today, or less than 15 missing), answer "Rested today." or "Sit when you're tired (+15)." with `arm: false`, and keep the pick-up for a deliberate second tap after that.

### F6 (Minor). Eating wastes a dish when you are nearly full, and the card says otherwise

- **Repro (played, `kitchen7.mjs`):**
  1. Energy 95/100. Bag: tap the Pumpkin Pie. The card says **"Eat +80"**.
  2. Tap it: "Pumpkin Pie: +5 energy." The pie (540g, the dearest dish) is gone.
  3. Action with a dish in hand at 99 energy does the same. Only 100/100 is refused ("You're not hungry.").
- **Also played:**
  - After Eat, the bag cursor stays on the eaten stack, so the next slot tap **swaps** the two stacks instead of selecting (`MenuPanel.ts:139-149`).
  - With dishes in the bag, every tool at 0 energy still says "Too tired! Go to bed." (`farmingActions.ts:34`, `fishing.ts:10`, `mining.ts:13`).
- **Cause:** `food.ts:26` gives `min(gain, room)` and consumes the dish; `MenuPanel.ts:230` labels the raw gain.
- **Fix:**
  - Label "Eat +5" when room is short, and refuse (or ask) when less than half the dish would be used.
  - Clear the cursor after Eat.
  - Say "Too tired! Eat something or go to bed." when a dish is carried.

### F7 (Minor). Legends: they work, but a once-a-game catch is just a toast and a 350 to 500g item

- **Played:** Finn's letter came the morning after the 10th catch and names all four places correctly (shot `95`). In 50 summer casts at the farm pond the Sun Carp bit **once (cast 11)**; the bot landed it ("A legend! You caught the Sun Carp!") and it never bit again in 39 more casts. Measured odds: 4.3 to 4.8% a cast (3.2% for Old Whiskers in rain, 13% for the trout in a storm).
- **Weak points:**
  - The fuss is one toast line (shot `96`).
  - The fish can be shipped for 350 to 500g with no warning, after which nothing records it but a stat.
  - It is not on any Book page (by design).
  - In run 1 the letter arrived on spring 14 (run 2 never reached 10 catches), which leaves the Glimmer Trout to the rainy days of spring 15 to 28; if the 10th catch comes in summer, the first legend is a year away. That is fine, but nothing says so.
- **Fix:** a "Legends 1/4" line on the Fish page or the Skills tab, and a confirm before shipping or gifting a legend (or a mounted-fish decoration).

### F8 (Minor, balance). Animal specials are capped at "every unit you make", with two days of slack

- **Measured (`facts7.test.ts`, real functions):**
  - 1 hen, posted day 1: 26 eggs, 1,950g: **every egg for 26 of 28 days.**
  - 1 hen, day 19: 8 eggs in 10 days.
  - 1 pig, day 1: 13 truffles at 0.6 a day: 22 of 28 days, weather-dependent.
  - 3 hens are comfortable (10 of 28 days).
- **Cause:** `specials.ts:48`: `perDay × (days left − 1)`.
- **Impact:** small farms get a special they can finish only by giving up every egg request and every gift for a month. One rainy week sinks the pig special.
- **Fix:** cap at about 70% of output by the deadline.

### F9 (Minor). Text, art and small UI

- **Placeholder art:** the six dishes, the four legends and the Kitchen row show as flat coloured dots (shots `cs-7b`, `88-make-dishes-*`). No `item_pumpkin_pie` or `item_sun_carp` key exists in `public/assets/sprites/ui.json`; DECISIONS lists them as new texture keys, so this is pending art, but it is what a player sees today.
- **Honey shows an animal tip:** the first honey collected raises "Fed, happy animals give better quality goods. Feed them daily." (`beeHouse.ts:83` adds the `collected` stat that `tips.json` "animals" listens to).
- **Make tab:**
  - With everything unlocked, the six dishes are on page 3/3 (shot `s-menu-Make-p3`).
  - There is no x5, so ten baked potatoes are ten taps.
- **Statue page:**
  - It says "Sales +1% a level, up to +5%." but never the current bonus.
  - Each finished level bounces you back to the list (`ProjectPanel.ts:201`).
- **Glass seeds:** regrowing seeds under glass lose "again 4d".
- **Shop order:** Fertilizer, Bait, Speed-Gro and Fiber sit between the in-season seeds and the glass seeds.
- **The machine check found no overflow or overlap on any of the 44 swept screens**, including the two-row Home tab and the dish rows.

### Not a bug (positive)

- **Projects sheet:** clean at 7, 8 and 9 projects. Finished projects read well with their perks; Close is always where the thumb expects it.
- **Clay's morning line** ("Clay filled 6 Trout on the board.") makes the race visible to someone who never visits town in the afternoon. The target marker turns a vague threat into a plan.
- **The Kitchen:** buying it takes one tap ("Kitchen upgraded!", "Kitchen 1/1 Fully upgraded!"). All six dishes cook. Eating by card or by Action works, and a dish in hand never blocks a harvest (a ripe parsnip was harvested, not eaten).
- **Bees:** the hive beside two tulips had honey on the 3rd morning, the far one on the 4th, and E says "The bees love your flowers."
- **Seed shelf with a greenhouse:** in-season seeds first, and "Glass" on the rest. This is exactly what critique 6 asked for.
- **Move sheet:** Enter no longer confirms "Move it". The coop kept 3 hens through Move, save and reload.

---

## 3. The days played (run 2, board-aware, real input, teleports between spots)

| Day | Wake gold | Jobs | Mail | Board (morning) / Clay overnight |
| --- | --- | --- | --- | --- |
| 1 | 500 | none | none | bluegill 230, trout 310, daffodil 170 (no crop rows) |
| 2 | 40 | 3/3 | Welcome (+3 potato seeds) | + special "15 Potato for Rosa 2,250g" |
| 3 | 141 | 3/3 | Finn, Orin | **2 Potato 255g until day 4 (potatoes ripen day 8)** |
| 4 | 364 | 3/3 | none | **filled 4 Wild Leek 120** |
| 5 | 733 | 3/3 | none | **filled 3 Parsnip 140** |
| 6 | 682 | 2/3 | Rosa (+3 fertilizer) | **filled 4 Wild Leek 125**; 3 Potato 400 until day 7 (ripen day 8) |
| 7 | 750 | 2/3 | Clay's challenge; Rosa (+scarecrow) | Clay not active yet |
| 8 | 943 | 3/3 | Mara town fund | "Clay wants this one": 6 Trout 410; special 5/15. Clay took the trout |
| 9 | 845 | 2/3 | Rosa (+cherry sapling) | special 7/15; Clay took 5 Mushroom 275 |
| 10 | 876 | 3/3 | none | 2 Cauliflower 720 made Clay's (cauliflowers ripen day 11); Clay took it |
| 11 | 834 | 1/3 | Mara's birthday hint | **filled 4 Daffodil 180**; Clay took 6 Trout 505 |
| 12 | 768 | 3/3 | Mara (+5 speed-gro) | special finished (+2,250g); Clay took 4 Potato 595 (Have 4/4, F4) |
| 13 | 2,578 | 2/3 | Finn (+15 bait), Orin (+3 copper bar), Flower Show notice | the same special posted again; Clay took 6 Bluegill 265 |
| 14 | 2,552 | 2/3 | none (Finn's legends letter came on day 14 in run 1) | **filled 6 Daffodil 255**; Clay took 6 Mushroom 405 |

- **Totals:** 32 jobs, 5 requests (820g) plus one special (2,250g), Clay 7 (3,175g), 5,705g earned by the end of day 14.
- **Run 1** (ships everything) earned 5,478g with 30 jobs, one request and 5 cauliflowers to the special; Clay took 5.
- **The goal tracker** stayed on "Craft something at the workbench" from day 5, because the bot never crafts.

**Early-game verdict:**
- **Days 1 to 7 are better than in critique 6.** The board asks for leeks, daffodils and fish that you can actually bring, and the potato special is a clear first plan.
- **From day 8 the board belongs to Clay.** The dearest row is always his, and several of those rows were unfillable anyway (F1, F2).
- **A 5-minute session (10 game hours)** still has a rhythm:
  - the farm round and the bin;
  - two or three jobs paid on the spot;
  - the board's named target;
  - a letter.
  
  The rewards are frequent but small: about 400g a day before the special.

## 4. One-thumb reach

- **Unchanged and fine.** Close is at y 383 on every sheet. The project list's paging row (`<`, "Finished (n)", `>`) is at y 358, and Open is at y 195.
- **The bag card's "Eat +N"** sits just above the bag grid (about y 250), mid-screen and reachable. The Kitchen buy button is at y 231 on the Home tab.
- **Nothing found out of reach.** The only risky placement is the special's Give above same-item requests (F4).

## 5. Progression and economy

**Early game (days 1 to 14):**
- **Earnings:** the play bots earned 5.5k to 5.7k, against 6.4k in critique 6, now that jobs pay 55%.
- **Jobs:** about 30 a fortnight.
- **The potato special** was 39% of run 2's income: it is the best early plan, and it can repeat at once (F4).
- **Board orders** were about 14% of income in run 2 (820g of requests), and Clay took 3,175g of them.

**Year one (sim):**
- Tireless bot, five seeds: 163,980 / 190,625 / 205,493 / 195,194 / 199,906 (median 195,194).
- Human-paced bot (150 presses): 125,583 / 147,942 / 159,238 (median 147,942).
- The farm bot's board income was 0 until winter and 2,690 for the year.

**Year two (sim):**
- 777k earned and 662k sunk; all 8 projects by year-2 summer, statue level 5 by year-2 winter.
- **After that the statue is glory only**, so a third year again has nothing useful to buy. This is acceptable as an endgame, but worth stating.

**Cooking: not a money loop.**

| Dish | Ingredients at the bin | Dish | Energy |
| --- | --- | --- | --- |
| Parsnip Soup | 70 | 80 | 30 |
| Baked Potato | 200 | 220 | 40 |
| Fish Stew | 150 | 170 | 50 |
| Berry Tart | 96 | 105 | 35 |
| Kale Salad | 190 | 210 | 35 |
| Pumpkin Pie | 490 | 540 | 80 |

- That is +9% to +14% with base-quality ingredients, one tap a dish, no wait.
- Cooking takes the lowest quality first; with only silver or gold produce a dish sells for less than its ingredients.
- So it is at most a tiny instant markup. Its real value is energy (a 40-energy potato for 200g), which matters early (the bot ended day 1 at 37 energy by 9 AM), but the Kitchen costs 2,500g, which the play bots could first afford on day 13.

**Legends:** 350 to 500g once each, about 1,750g a game: negligible.

**Runaway or dead:**
- **Runaway:** nothing in year one.
- **Near dead:**
  - the board for a farm-focused player after day 8 (F1 to F3);
  - small-herd specials (F8);
  - the statue after level 5 (glory only).

## 6. Top 3 things to add next

1. **Requests you can actually win.** Crop requests only when a planted crop ripens in time (F1). Weight the pool toward what the player did recently (F3). Make the dearest row's days honest, or let Clay take only last-day requests (F2).
2. **Finish the cooking and legend loops.** "Eat +5" honesty and refusal when wasteful, cursor reset, a "Too tired! Eat something" line (F6). Real art for the dishes and legends (F9). A "Legends 1/4" record with a ship guard (F7).
3. **Board and special polish.** The special's Give should not starve a same-item request, and the same special should not repeat (F4). Fix the bench's two-tap lift (F5). Size small-herd specials at about 70% of output (F8).

## 7. Verdict

**Stable, and the critique-6 blockers are gone.**
- **Tests and errors:** 522 tests pass, with 0 page errors across two 14-day games and every probe.
- **Critique-6 findings:**
  - F1, F2, F4, F5, F6 and F8 are fixed through real input, and fixed well. The projects sheet scales, Clay settles overnight and names his target, the greenhouse shelf is honest, and the festivals have teeth.
  - F3 is fixed as designed but exposes F1 and F2. F7 is half fixed (F5).

**The new content works:**
- the Kitchen and six dishes cook and feed;
- Finn's letter arrives at 10 catches and is accurate;
- the Sun Carp bit once and never again;
- bees near tulips are a day faster.

**No blocker this round.** The main weakness is design: from day 8, the board is Clay's.
- He takes the dearest request every day.
- Those requests are often crops that cannot ripen in time, or fish a farmer never catches.
- So the race is readable but rarely worth running.

Fix F1 to F3 next. F4 to F9 are polish.

## Screenshots (`critique-7/shots-7/`)

| Group | Files |
| --- | --- |
| Play run (run 2) | `01-day1-farm-planted`, `02`/`03`/`04-summary-day2..4`, `20-scarecrow-placed` |
| Projects (C6 F1) | `60-projects-7done`, `61-market-detail`, `62-after-market-done`, `63-projects-9-open-view`, `64`/`65-projects-finished-p1/p2`, `66-statue-detail`, `67-statue-after-l1/l2` |
| Clay | `70-board-d7..d11-*`, `70-board-y2-*`, `71-board-after-filling-target` |
| Seed shelf (C6 F5) | `50-shop-seeds-fall-gh-p1..p4` |
| Move sheet | `51-move-sheet-coop`, `52-coop-picked-up`, `54-move-sheet-silo` |
| Festivals | `55-*-basket`, `56-*-result` (fair2, fair3, fair3plain, feast1, feast3, feast3plain) |
| Kitchen and dishes | `80-shop-home-bench`, `85-make-before-kitchen-p3`, `86`/`87-shop-home*`, `88-make-dishes-p1..p4`, `89-bag-card-dish`, `90-bin-dishes` |
| Legends | `95-letter-legends`, `96-legend-caught` |
| Sweep | `s-*` (44 screens), contact sheets `cs-7a` (Make, Home tab, bag card, board), `cs-7b` (Make pages with dishes, bag card, Home tab), `cs-7c` (villager, sleep, summary, letter) |
