# Tiny Acre: independent critique 9

Reviewer: independent QA lead and game critic, round 9.

**Status: complete for the scope below.**
- Every critique-8 finding (F1 to F8) was re-checked.
- The new season scoreboard against Clay was played across a real spring-to-summer boundary with real bed sleeps, in five ways:
  - two 31-day new games with real input;
  - three short probes that start on spring 20: win, lose, and a check of the notice line.
- Two 14-day new games were played with real input.
- The new crop-request, special, cart, batch-cooking and bag rules were played and also measured with the real functions.
- Clipping sweep: 42 + 6 screens. The sims were run, plus a two-year scoreboard sim (72 seasons).
- Real phone, audio and performance were out of scope (see "Not verified").

**Frozen build:** commit `1a7464d` (branch `depth/round2`), in `critique-9/farm-game`. It is a `git archive`, so I could not confirm the hash myself.

**Method:**
- Headless Chromium (playwright-core, chromium-1217), 390x844, `hasTouch`, against `vite` on **port 5194**. I started the server for this session and stopped it at the end; port 5194 is free again.
- The `?debug` hook was used to set up state and read it back. **No game source file was edited.**
  - `npm run build` wrote `dist/` into the frozen folder so that `scripts/e2e.mjs` could run (on port 5194, after the dev server was stopped).
- **Probes:** `critique-9/farm-game/agents/out/c9/`, with logs in `c9/tmp/`.
  - Reused from c8: `lib`, `play2`, `play3`, `sweep`.
  - New: `season9`, `kit9`, `batch9`, `sweep9`, `full9`, plus `facts9`, `exact9`, `labels9` and `boardsim9.test.ts`.
- **Screenshots:** `critique-9/shots-9/`.
- **Checks:**
  - `npx vitest run`: **65 files, 537 tests pass.**
  - `npx tsc --noEmit`: clean.
  - `scripts/e2e.mjs`: **58 PASS, "E2E OK".**
- **Errors:** 0 page errors and 0 console errors in every browser session.

## What I verified by playing, and what I did not

"Real input" means the keyboard (arrows, Space, E, M, Esc, Enter) and real touch taps on canvas buttons, located from the live UI tree. **Moving between spots was by teleport (`goMap`/`snap`), not by walking.** When the bot reached town, the clock was moved to 8:00. From day 7, a 3 PM board look was modelled by setting the clock.

**Played with real input:**
- **Run R31** (`play3.mjs`, `DAYS=31` → `tmp/play31-race.out`): a new game, spring 1 to summer 3. It fills **every** request it can, then the special. It ships its morning harvest to the bin before going to town (a hurried player).
- **Run RK31** (`play3.mjs`, `KEEP=1` → `tmp/play31-racekeep.out`): the same racer, but at the bin it **keeps goods the board asks for**. Spring 1 to summer 3, ending on day 31 (see "Not verified").
- **Run R14 and run K14** (`play3`/`play2`, 14 days): a racer, and a one-tap-per-visit player who keeps goods (K).
- **Season probe** (`season9.mjs`), spring 20 to summer 3, with real E at the board, real Give taps and real bed sleeps:
  - `MODE=win`: each morning the bag is given, by state, what every open request needs;
  - `MODE=lose`: the player looks every morning and fills nothing.
- **Special** (`kit9 PART=special`):
  - hold 3 with a "3 Cauliflower" request;
  - hold 5;
  - hold 2 with a request for 3.
- **Kitchen and bag** (`kit9`, `batch9`): batch buttons, two taps on one spot, eat then tap another slot, and "Not hungry".
- **Cart** (`kit9 PART=cart`): spring 5, summer 12, fall 19 (with a greenhouse), winter 26 and spring 26. Buy, the toast, "Back to the board", and Esc.
- **Clipping sweep:** `sweep.mjs` (42 screens) and `sweep9.mjs` (6 tall boards: special, canopy fourth row, cart, Clay's target, a two-digit tally, at 10 AM and 3 PM).

**Verified only with the real rule functions (vitest) or by reading code:**
- crop-request size against the field (`facts9`, `exact9`, 400 and 500 boards);
- the board mix by day for a new farmer;
- season settlement edge cases (tie, 0-0, year-2 prize, the order of the morning notes);
- the two-year scoreboard sim (`boardsim9`: 3 paces x 3 seeds x 8 seasons);
- the longest special labels.

**Not verified at all:**
- Real phone, audio, performance and walking times.
- Year two with real input. Clay's 2 takes a day and his heart perks were judged from code and the sim only.
- **Run RK31 stopped on day 31:** after "Inventory full!", the bin and then the bed did not open for the bot.
  - I could not reproduce this with a full bag (`full9.mjs`: the bin and the bed both open).
  - I count it as a bot fault, not a game bug, but I did not find the cause. Days 1 to 31 and the summer settlement are complete in the log.

---

## 1. Critique 8 findings re-checked

| C8 | Then | Now | How checked |
| --- | --- | --- | --- |
| F1 the special's Give emptied a fillable request | "Give 3" took the request's 3 | **Fixed for a request you can fill now.** <ul><li>Hold 3 with "3 Cauliflower, Have 3/3": the special's row reads **"Saved for a request."** and Give is off (shot `72-special-saved`).</li><li>Hold 5: "Give 2", and afterwards "Saved for a request." again.</li><li>In K14, day 11: the special's "Give 2" kept 1 for "1 Cauliflower".</li></ul>**Still open:** a request you are part-way to (Have 2/3) is emptied (F3 below), and the special still takes the first tap (F5). | played |
| F2 Clay harmless, no race | Clay took only rows nobody would fill | **Fixed, and the race now has a shape.** <ul><li>RK31 (keeps goods for the board): **won spring 25 to 7**, and the summer-1 summary read "You beat Clay on the board last season (25 to 7): +300g."</li><li>R31 (bins first): **lost 14 to 7**. The summary read "Clay won the board last season (14 to 7).", followed by the letter "The board is mine", read with real taps.</li><li>Lose probe: 7 to 0, with the letter. Win probe: 24 to 0, +300g and +20 friendship with Clay.</li></ul>**New problems:** <ul><li>The score is hidden on most mornings of a losing season.</li><li>A farmer who does not fish or forage cannot win (the sim lost 72 of 72 seasons).</li><li>The stakes are never announced. See **F1**.</li></ul> | played + sim |
| F3 crop requests asked for more than the field gives | 65 to 78% too many | **Fixed.** In 400 boards, 0 requests asked for more than the field grows: 2 potato tiles always give "2 Potato", and 6 parsnips give 3 to 6. In play, "1 Cauliflower 345g" and "2 Cauliflower 715g" matched small plantings. **New side effect:** half of potato requests need *every* potato you grow, so one bin sale makes the request unfillable and gives Clay a point. See **F2**. | vitest + played |
| F4 cart resold store goods | 15 of 32 slots | **Fixed.** <ul><li>Five sampled days showed no store goods and no seed that cannot ripen. Spring 26 offered no seeds; fall 19 with a greenhouse offered Strawberry Seeds 200g.</li><li>The toast reads "Bought Ruby. For the Market Road." and "Back to the board" returns to the board.</li></ul>The use line appears only *after* you pay (F7). | played |
| F5 first week has no crops | 0% crops with nothing near ripe | **Fixed for quick crops.** <ul><li>Day 1 in every run: "4 Parsnip 220g 6 days". Day 3: "4 Potato 585g 7 days". Day 4: "3 Cauliflower 850g 9 days".</li><li>Measured: 6 parsnips planted on day 1 give 26% crop rows; parsnips plus potatoes on day 2 give 44%.</li></ul>A cauliflower-only field (ripe in 12 days) still gives 0% until day 5 or later. That is fine. | played + vitest |
| F6 bag cursor swapped stacks | | **Fixed.** Eat one of 2 pies, then tap the soup: it is selected, with no swap. "Not hungry", then tap the pumpkin: no swap. "Not hungry" is drawn dim (shot `82b`). | played |
| F7 x5 spent gold ingredients | | **Fixed as specified.** <ul><li>"x3" with 7 plain and 3 gold potatoes makes 3 and keeps the gold.</li><li>The toast says "Made 3 Baked Potato", and "Made 2 Pumpkin Pie" for x2.</li><li>The button is hidden when fewer than 2 can be made.</li></ul>**But** a second tap on the same spot hits Make, which has slid under the thumb, and that uses a gold potato (F4). | played |
| F8 text | | **Mostly fixed.** <ul><li>The hints say "Menu > Make".</li><li>The pre-Clay line reads "Requests stay a few days."</li><li>Clay's letter matches the rule.</li><li>The statue page reads "Next level: Sales +1% a level, up to +5%. Now +2%."</li></ul>**Still open:** <ul><li>the goal *title* "Craft something at the workbench" (`goals.json:117`);</li><li>Clay's 2-heart line "You keep beating me to the board." (`npcs.json:564`) plays even when he leads 14 to 7;</li><li>the dish and legend art are still flat coloured dots (shot `82b`).</li></ul> | played + read |

---

## 2. Ranked findings

### F1 (Medium, design). The scoreboard race works for an attentive player, but it is hidden from the one losing, unwinnable for a pure farmer, and its stakes are never said

- **Played (spring 1 to summer 3, real input, real sleeps):**

  | Run | Spring result | Score visible on the board (mornings from day 8) |
  | --- | --- | --- |
  | RK31 (keeps goods for requests, fills all) | **won 25 to 7**, +300g | 14 of 24 |
  | R31 (ships the harvest first, fills all) | **lost 14 to 7**, letter "The board is mine" | **7 of 24** |
  | Lose probe (spring 20 to 28) | lost 7 to 0, letter | **2 of 12** |
  | Win probe | won 24 to 0, +300g | 12 of 12 |

  - In R31, Clay's 14 points were trout x5, carp, bluegill, catfish, mushroom x2 and daffodil, plus **two potato rows the bot had just sold to the bin** (F2).
  - The race is readable *when you are winning*. RK31's player saw "you 9, Clay 3" on day 17 and the result the next season.
- **The problems:**
  1. **The score is hidden while you lose.**
     - `rivalNotice` shows "This season: you N, Clay M." only when Clay has no target (`src/systems/rival.ts:60`).
     - On a target day the line is "Clay wants this one at 2:00 PM.", and after 2 PM it is "Clay took one today."
     - The losing player, who most needs the count, sees it least (2 of 12 mornings in the lose probe, shot `s9-lose-board-spring24y1`).
  2. **A farmer who does not fish and forage for the board cannot win.**
     - `boardsim9` ran the sim bot, which fills every request its bag covers, for two years at three paces and three seeds. It **lost 72 of 72 seasons** (for example 14-4, 20-4, 23-12, 31-5).
     - Year two is worse: Clay takes 2 a day (`game.json` `perYear: 1`, `maxTakes: 2`, `rivalTakes`, `rival.ts:30`) unless he is at 2 hearts.
     - Cause: Clay scores every request that reaches its last day (`rival.ts:44-51`), and about half the rows are fish and forage. So you must fill more than about one row a day, every day, including fish.
     - The last goal of the chain, "Beat Clay on the board" (1,000g, `goals.json:497`), depends on this.
  3. **The stakes are never announced.**
     - Clay's intro letter says only "The board keeps score each season. May the best farmer win."
     - The 300g prize (300 x year, `BOARD_PRIZE`, `rival.ts:102`) and the friendship are first seen in the summary after you win.
     - The losing letter does not say what the winner gets.
     - A tie or a 0-0 season says nothing at all (`rival.ts:112`, `:131`; `facts9`).
  4. **The prize is small.** 300g is about one request in spring of year 1, and trivial from summer on (R31 had 11,600g on summer 1). The letter, not the gold, is the real stake.
- **Impact:** the critique-8 complaint, "a race you can never lose", is fixed. The opposite now happens to a pure farmer: every season he gets a gloating letter for a contest whose score he rarely saw and whose prize he never heard of.
- **Fix:**
  - Always show the score. Put it on the line before Clay's target ("You 3 · Clay 6 · Clay wants this one at 2 PM"), or give it a second line.
  - Say the prize in Clay's intro letter and in the losing letter ("Beat me and the town pays 300g").
  - Give Clay a point only for rows you could have filled: crops, animal goods and preserves you make, or rows where you held at least one. Then a farmer is not punished for not fishing.
  - Make a tie say "A draw with Clay on the board."
  - Consider a prize that lasts (a ribbon on the house, a seed packet).

### F2 (Medium). Crop requests now need your whole harvest, and the bin by the house says nothing about them

- **Played:**
  - **R14 and R31, day 8:** "4 Potato 585g 2 days" was on the board. The morning harvest of 5 potatoes went into the bin by the house before the walk to town, so the request read Have 0/4 and Clay took it.
  - **Day 12:** "5 Potato 770g" was lost the same way (8 potatoes shipped).
  - These were the two dearest rows of the fortnight, and 2 of Clay's 14 points.
  - RK31 kept them and filled them ("4 Potato", "2 Potato").
- **Measured (`exact9`, a 4-potato, 3-cauliflower, 6-parsnip field):**
  - **52% of potato requests need every potato you grow**, and 28% leave one spare;
  - parsnip: 26% exact.
  - So one sale, one gift, one cooked dish, one crow or one missed watering makes the row unfillable, and it becomes Clay's point.
- **Cause:**
  - `src/systems/orders.ts:145-148` caps the quantity at `cropSupply`, which is exactly carried plus ripening.
  - The bin has a warning for legends (`BinPanel.ts:124`) but none for goods a request wants.
- **Fix:**
  - Have the bin say "The board wants 4 Potato." when you ship goods an open request wants (the same toast pattern as the legend warning). Or show "Board: 4" on the bin row.
  - Cap at about 80% of supply (at least 1), so one lost crop does not cost the row.

### F3 (Minor). The special's Give still empties a request you are part-way to

- **Repro (played, `kit9`):**
  1. The special is "7 Cauliflower for Mara", and the request is "3 Cauliflower, Have 2/3, 930g".
  2. The special's button reads "Give 2". Tap it: the special goes to 2/7, and the request goes to **Have 0/3** (shot `74-special-two-of-three`).
- **Cause:** `BoardPanel.ts:45-47` keeps back only for requests with `haveFor >= o.qty`.
- **Impact:** with F2's exact sizing, you often hold part of a request while the rest ripens tomorrow. This is the critique-7 and critique-8 failure, one cauliflower earlier.
- **Fix:** keep back `min(have, o.qty)` for any open same-item request that is not on its last day, or ask ("Give 2? The request needs 3.").

### F4 (Minor). Batch cooking: a second tap on the same spot cooks with gold ingredients

- **Repro (played, `batch9`):**
  1. Hold 7 plain and 3 gold potatoes. The Baked Potato row shows **x3** at x 165-195 and Make at x 124-168.
  2. Tap x3: "Made 3 Baked Potato", and the gold potatoes are kept.
  3. The x button disappears and **Make slides right to x 151-195**.
  4. Tap the same spot again: "Made Baked Potato", made with 1 plain and **1 gold** potato.
- **Cause:** `src/ui/panels/CraftTab.ts:47` adds the batch button only when `batch >= 2`, so Make changes place with your ingredient count.
- **Fix:** keep the batch slot always, drawn dim ("x1") when fewer than 2 can be made. Or put Make outermost and the batch inside.

### F5 (Minor). The special still sits on top and takes a hurried player's tap from Clay's target

- **Played (K14, one tap per visit, day 13):**
  - The first enabled Give was the special's "Give 1".
  - Below it, "4 Potato, Have 4/4, 490g, **Clay's!**" was not filled, and Clay took it at 2 PM.
- **Cause:** `BoardPanel.ts:42` draws the special first.
- **Fix:** draw Clay's target row first, or draw the special last, as critique 8 suggested.

### F6 (Minor). The season result is easy to miss

- **Order of the morning notes:** "Clay won the board last season (4 to 3)." comes *before* "Clay filled 4 Trout on the board.", the take that decided it (`src/mechanics/orders.ts:13-21`; `facts9`).
- **Nothing persists:**
  - On summer 1 the board shows "This season: you 0, Clay 0." with no "Last season: you won 25 to 7."
  - A win sends no letter, and `boardWins` is shown nowhere except the final goal.
- **The summer-1 summary is crowded:** it ended in "...and 2 more" in R31.
- **Nag line:** "You could finish the Board Canopy today. See the town board." repeated on every morning from spring 26 to summer 3 in both 31-day runs.
- **Fix:**
  - Push the season result after Clay's overnight take.
  - Show last season's result on the board for the first few days.
  - Send a short letter from Mara on a win.
  - Show the canopy line once.

### F7 (Minor). The cart says what a good is for only after you pay

- **Played:**
  - The rows read "Ruby 900g 5 left" and "Quality Sprinkler 600g 5 left" (shot `85-cart-fall-19`).
  - "For the Market Road." and "Waters 8 tiles." appear only in the toast after Buy.
  - The only button is "Back to the board", drawn in the warning colour. To leave, you go back to the board and then press Close (Esc closes everything).
- **Cause:** `src/ui/panels/CartPanel.ts:34` uses `cartSub(price, left)`; `cartUse` is used only in the toast.
- **Fix:** put the use on the sub line ("900g · Market Road"), or show it on the first tap of a row.

### F8 (Minor). Text

- The goal title "Craft something at the workbench" (`goals.json:117`) names no tab. All four bots sat on it from day 5 to day 31; that is the bots, but the title should say "Make".
- Clay's 2-heart line "You keep beating me to the board." (`npcs.json:564`) fires on hearts, not on the score.
- The dish and legend icons are still placeholder dots.

### Not a bug (positives)

- **The scoreboard plays as designed when you engage with it.**
  - RK31 went from "you 9, Clay 3" to "you 25, Clay 7".
  - The summary line "You beat Clay on the board last season (25 to 7): +300g." is clear.
  - The losing letter and summary are clear, and the last-day take of the season is counted in the season it belongs to (`facts9`).
- **"Saved for a request."** is exactly the right line, and Give is off.
- **The early board is alive for a farmer:** parsnip on day 1, potato on day 3, cauliflower on day 4, all sized to the field and posted with honest day counts ("6 days", "9 days").
- **Batch cooking** spares gold ingredients and says the real count; the bag cursor no longer swaps.
- **The cart** offers only off-shelf goods, and the toast plus "Back to the board" work.
- **The sweep found no overflow or overlap on 48 screens**, including the tallest board (special, 4 rows, cart, Clay's target, "you 12, Clay 14").
- **Stability:** 0 errors in about 120 played game days.

---

## 3. The days played

| Run | Day 14 earned | Day 28 earned | Board (spring) | Notes |
| --- | --- | --- | --- | --- |
| R14 (racer, bins first) | 7,038 | - | you 3, Clay 6 at day 14 | lost both potato rows to the bin |
| K14 (one tap, keeps goods) | 5,570 | - | you 4, Clay 5 (3 of the 4 before Clay arrived) | special on top took the 490g row (F5) |
| R31 | 8,218 | 14,933 | **lost 14 to 7** | summer 1 to 3: fish-only board, 0 fills |
| RK31 | 6,374 | 14,075 | **won 25 to 7, +300g** | 19 visits with fills; Clay took 9 (all fish or forage) |

Critique 8's runs earned 5,330 and 4,916 by day 14, so these are slightly richer.

- **Is the race worth running now?**
  - Yes for a player who reads the board and keeps goods for it: it is winnable, visible while you lead, and it rewards a habit the game wants (keep, don't bin).
  - No for a pure farmer: he loses every season (sim), sees the score on fewer than a third of his mornings, and was never told the prize (F1).
- **Does the early board feel alive for a farmer?** Yes, from day 1, which is the big win of this round. The trap is the bin (F2).
- **Is a 5-minute session (about 10 game hours) rewarding?** Yes:
  - the farm round;
  - two or three jobs;
  - one or two fillable rows, with a named Clay target creating a little urgency;
  - the cart once a week.
  - The weak spots: the summer board for a player without summer crops was all fish (R31, days 29 to 31), and the morning summary is getting crowded.

## 4. One-thumb reach

- **Unchanged and fine.** Close or "Back to the board" is at logical y 383 on every sheet.
- **Board and cart:** the Give and Buy buttons are at x 172, rows y 150 to 330.
- **Make tab:** the batch button is the outer one (x 165-195), and Make moves when it appears. That is a reach trap rather than a reach problem (F4).
- **Hurried first tap:** the special on top takes it (F5).

## 5. Progression and economy

**Sim (`tests/sim.test.ts`, `c9/tmp/sim.out`):**
- **Tireless bot, five seeds:** 228,569 / 189,387 / 252,125 / 208,855 / 213,730 (**median 213,730**, equal to the pin).
- **Human-paced bot:** **median 184,919** (critique 8: 177,253).
- **Board income:** 9,856g a year, about 4% of earnings. Clay took 70 of 128 requests.
- **Two years:** all 8 projects by year-2 spring, statue level 6 by year-3 spring, and 1.09M earned against 812k sunk. This is the same shape as critique 8.

**Scoreboard over two years (`boardsim9`):** the bot never wins. Clay scores 13 to 15 in a year-1 spring (from day 8) and 20 to 31 a season after that; the bot scores 3 to 16. Prize gold paid: 0. As an economy item the prize is negligible either way (300 to 600g).

**Runaway or dead:**
- **Runaway:** nothing.
- **Near dead:**
  - the board prize as a reward (gold);
  - Clay's "later" and "polite" perks, which change only who gets which last-day row;
  - the statue after level 5 (glory only).
- **Cooking:** unchanged; it is energy, not money.

## 6. Top 3 things to add next

1. **Make the race fair to a farmer and always visible.**
   - Show the score every day.
   - Score Clay only on rows you could have filled.
   - Announce the prize, and acknowledge a tie (F1).
2. **Protect exact-size crop rows.** A bin warning ("The board wants 4 Potato"), a little slack in the cap, and the special keeping back part-filled requests (F2, F3).
3. **Stable buttons under the thumb.** Batch and Make never change places; Clay's target row (or the requests) above the special; the cart use line before you pay (F4, F5, F7).

## 7. Verdict

**Stable, and the best board yet, with no blocker.**
- **Tests and errors:** 537 tests, tsc and e2e (58 checks) all pass, with 0 errors in about 120 played days and 48 clean screens.
- **Critique-8 findings:**
  - F3, F4, F5, F6 and F7 are fixed through real input.
  - F1 is fixed for fillable requests.
  - F2 is fixed in spirit: the race now has a winner and a loser, and a keeper-player won spring 25 to 7 with the result clearly reported.

**The main weakness has moved again.** It is not an unfair Clay or a harmless one. The season score is shown to the winner and mostly hidden from the loser. It counts fish rows against a farmer who never fishes. And it costs a whole request when a single potato goes into the bin. A player who reads the board will enjoy it. A player who farms will get a gloating letter every season and not know why.

## Screenshots (`critique-9/shots-9/`)

| Group | Files |
| --- | --- |
| Season boundary | `s9-win-board-*`, `s9-win-summary-summer1`, `s9-lose-board-*` (spring 21 to 27: Clay's target, no score), `s9-lose-summary-summer1` |
| Special | `72-special-saved`, `73-special-after-fill`, `74-special-two-of-three` |
| Kitchen and bag | `80-make-page-batch`, `81-make-after-batch`, `81b-batch-double-tap`, `82-bag-after-eat`, `82b-bag-not-hungry` |
| Cart | `85-cart-spring-5`, `-summer-12`, `-fall-19`, `-winter-26`, `-spring-26` |
| Sweep | `s-*` (42 screens), `s-board-tall-*` (6) |
| New game | `01-day1-farm-planted`, `02`..`04-summary-day*` |
