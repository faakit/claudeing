# Tiny Acre: independent critique 11

Reviewer: independent QA lead and game critic, round 11.

**Status: complete for the scope below.**
- Every critique-10 finding (F1 to F7) was re-checked.
- Two 32-day new games (spring 1 to summer 4, real bed sleeps, a real spring-to-summer settlement) were played as a farmer who **never fishes or forages**: a hurried player who taps "Ship all produce" before the board, and a careless player who ships with each row's "All". Both are valid (no planting stall; "Use now" was available and never failed).
- Each of the seven changes of this round was played, with edge cases set up by state:
  - Clay's pick order with mixed rows, year 1 and year 2 (two takes), polite Clay;
  - the crate on days 7, 14 and 28, and the order of crate, take and season result;
  - 5 hearts in mid-season;
  - toasts over the bin, board, cart, shop, Make and bag, and a stack of three;
  - keep-back with the special plus two requests for the same good;
  - a clipping sweep of every changed panel at 390x844.
- The sims were run and read, plus my own early-gold sensitivity sim on today's bot.
- Real phone, audio and performance were out of scope. **Nothing here was verified on a real device.**

**Frozen build:** `critique-11/farm-game`, a `git archive` of `70e861a` (branch `depth/round3`). Because it is an archive, I could not confirm the hash myself.

**Method:**
- Headless Chromium (playwright-core, chromium-1217), 390x844, `hasTouch`, against my own `vite` on **port 5196**. I stopped the server at the end and confirmed port 5196 is free.
- **No game source file was edited.** The `?debug` hook (`window.__farm`) was used to set up state and read it back.
- **Probes:** `agents/out/c11/`. Logs are in `c11/tmp/` (`F32.out`, `A32.out`, `edge11-*.out`, `sweep11.out`, `sim3.out`, `simx11.out`).
  - Adjusted: `play10.mjs` (the special's row is now found by "Special: "), `edge10.mjs` (screenshot prefix `e11x-`, special pattern).
  - New: `edge11.mjs` (`PART=pick|crate|hearts5|toast|keepsp`), `sweep11.mjs` (sweep10 with a real wild item), `trophy11.mjs`, `shift11.mjs`, `make11.mjs`, `winter11.mjs`, `spexp11.mjs`, `simx11.test.ts` (today's `tests/sim.test.ts` plus my sensitivity block).
- **Screenshots:** `critique-11/shots-11/`.
- **Checks:**
  - `npx tsc --noEmit`: clean.
  - `npx vitest run` (machine idle): **77 files, 711 tests pass.**
  - `npx vitest run tests/sim.test.ts` run while the two browser games were running: **failed once**, "Test timed out in 5000ms" on the board-race test (see F8). With `--testTimeout=120000`: 7 of 7 pass.
  - `npm run verify` and the e2e scripts were not run, as instructed.
- **Errors:** 0 page errors and 0 console errors in every browser session (64 played days plus about 40 probe sleeps).

## What I verified by playing, and what I did not

"Real input" means the keyboard (arrows, Space, E, M, Esc, Enter) and real touch taps on canvas buttons, located from the live UI tree. **Moving between spots was by teleport (`goMap`/`snap`), not by walking.** When the bot reached town before 8:00 the clock was moved to 8:00. From day 7, a 3 PM board look was modelled by setting the clock to 15:00.

**Played with real input (new games, spring 1 to summer 4, 32 days, real sleeps):**

| Run | Player | Ships with | Fills | Valid? |
| --- | --- | --- | --- | --- |
| **F32** | pure farmer: no fishing, no foraging, fills only farm-good rows | the bin's **"Ship all produce"**, tapped **before** visiting the board (hurried) | every farm row it can, then gives the special what is left | yes (a seed was in the bag 7 times; "Use now" moved it by real taps) |
| **A32** | same farmer | each row's **"All"** (careless; ignores warnings) | same | yes (seed in bag 10 times, same fix). Note: the inherited bot never taps All on a row named exactly "Cauliflower", so it keeps cauliflower by accident; all 4 of its points are cauliflower rows. |

**Edge probes with real taps after a state setup:** listed above, logs `tmp/edge11-*.out`.

**Verified only by code or sim:**
- that "Ship all" never keeps for a special past its due day (played once by state, the rest by code);
- that the year-2 stakes text says 600g (`boardStakes`, `rival.ts:171-172`);
- the economy (`tests/sim.test.ts`, `simx11.test.ts`).

**Not verified at all:** real phone, audio, performance and walking times; year two with real input (two takes were set up by state); the 3 PM board look and the 8:00 town clock are modelled; a real festival win and a real legendary catch (the Ribbons and Legend Wall were shown by setting their stats).

---

## 1. Critique 10 findings re-checked

| C10 | Then | Now | How checked |
| --- | --- | --- | --- |
| F1 toasts under every sheet | Major | **Fixed.** While a sheet is open, toasts sit at the top above the dim: "Kept 3 Potato, 2 Strawberry Jam and more for the board.", "The board wants 3 Potato.", "Order done! +450g", "Bought Amethyst. A gift villagers love.", "Bought 1 Parsnip Seeds", "Not enough gold.", "Made Baked Potato", "Pumpkin Pie: +80 energy." were all seen over their sheets (shots `e11-toast-*`). The wanted bin row says "Board 4  have 9". **New small slips:** that line clips once goods are in the bin (F5), and a stack of three long toasts covers the Menu sheet's header (F10). | played |
| F2 race a formality; target scored nothing | Medium | **Rules fixed:** Clay takes the best farm row (parsnip 500g over catfish 700g and potato 400g); "Clay's!" only marks a scoring row; "Clay takes one at 2:00 PM: no point." otherwise; a crate every 7th day. **Outcome not fixed for a keeper:** the hurried keeper won **13 to 3**. Clay's 3 points were his three crates; none of his 11 takes scored. The careless player lost **4 to 10**. See **F1**. New year-2 text slips (F4). | played + sim |
| F3 5 hearts ended the race silently | Medium | **Fixed as specified:** "Clay no longer takes requests.", the score stays, seasons settle (lost 2 to 3, won 1 to 0), no crate at 5 hearts. **New:** every season after 5 hearts is a free win and trophy; his losing letter still says "A farm good left to its last day is mine" (F3). | played |
| F4 result brief, "filled" wording | Minor | **Fixed.** "Last season: you won 13 to 3." / "Last season: Clay won 10 to 4." on the score line summer 1 to 3 (3 of 3 mornings in both runs). 0-0: "The board was quiet last season: nobody scored." (morning only). "Clay cleared 2 Catfish off the board: no point." in the morning. Mara: "You out-scored Clay on the board last season, 13 to 3!" | played |
| F5 Ship all fed the special | Minor | **Fixed.** Special 15 Potato (4 given) plus requests 3 and 2 Potato, 17 held: "Kept 16 Potato for the board." (lowest quality first, one gold potato shipped). Board: both requests Give, special "Give 11". F32 finished Rosa's special on day 28 (+2,250g). Wording: "Board 16" and "for the board" also count Rosa's special (F5). | played |
| F6 text, number, layout slips | Minor | **Fixed:** cart "300g  4 left" after a buy; "Strawberry Seeds 200g  Greenhouse" in fall; "Have 3/3  1,045g  Clay's!" and "Have 0/4  1,200g  Clay's!" fit; "Special: 15 Cauliflower" / "Rosa 4/15  2,250g"; "Kept 2 Potato, 3 Egg and more"; cook hint "Menu > Make". Year-2 stakes 600g (code). **New:** winter of year 1 pays 600g while it was staked at 300g (F9). | played + code |
| F7 early-gold sensitivity | Minor | **Worse.** On today's bot +500g on day 7 is worth **+24% to +77%** of year one; the fisher earns **2.11x** the same farmer on seed 7 (DECISIONS says "under twice the farmer"). See F8. | sim |
| (C10 not changed) Make tab right-most button, workbench goal title | | Unchanged, as DECISIONS says. | played |

---

## 2. Ranked findings

### F1 (Medium, design). In play the keeper still walks the race; Clay's new pick order never bites, and the sim's 16-of-24 does not predict play

- **Played (spring, real input, never fishes or forages):**

  | Run | Spring result | Clay's points | Clay's takes | Score line seen |
  | --- | --- | --- | --- | --- |
  | **F32** (Ship all, hurried) | **won 13 to 3**, +300g, Mara's letter, trophy 1 | 3 = crates on days 14, 21, 28; **0 from takes** | 11, all fish or wild | 25 of 25 mornings from day 8 (days 29-31 as "Last season") |
  | **A32** (row All, careless) | **lost 4 to 10**, "The board is mine" letter | 10 = 3 crates + 7 farm takes (2 parsnip, 5 potato) | 15 | 25 of 25 |

- **What the hurried keeper saw on the 21 board mornings from day 8:**
  - "Clay takes one at 2:00 PM: no point." on 11 mornings;
  - "Clay scores on farm goods only." on 8;
  - "Clay wants this one at 2:00 PM." on 2 (days 13 and 28), both times on a row the bag already filled ("Have 3/3 395g Clay's!").
  - The race was 6 to 0 on day 14 and 10 to 1 on day 21. After critique 10's 15 to 0 this is 13 to 3, and the only change is the crates.
- **Cause:**
  - Clay only ever takes rows on their **last day** (`rivalPicks`, `src/systems/rival.ts:71-72`).
  - Crop requests ask for at most three quarters of the harvest, down to one ("1 Cauliflower", "1 Potato" were filled 5 times in F32).
  - So anyone who keeps goods fills every farm row before its last day. Clay's best-farm-first order (`:73-76`) never meets a farm row, and his only points are the crates (`:227-235`).
- **The sim disagrees with play.** `tests/sim.test.ts` keeper, spring year 1: **4-7, 4-5, 4-4** (lost, lost, drew) on seeds 42, 7 and 99. The played keeper scored **13**. Of the keeper's 6 sim losses, 4 are year-1 spring or summer. So the "16 of 24" mostly measures a bot that fills few spring rows, not how Clay plays against a person.
- **Summer for a farmer is still dead:** summer 1-4 boards in both runs held only fish and wild rows (carp, bluegill, catfish, wild sunflower, wild berry), plus the specials "18 Tomato" and "5 Melon". Clay took one each day, no point.
- **Impact:**
  - Keeper: the contest is decided by turning up, plus 3 to 4 free points for Clay.
  - Careless player: decided by the All button, as before. Now the toasts say so ("The board wants 3 Potato." over the bin), so it is a fair loss.
  - A contest a keeper "usually but not always" wins: not in played spring. In the sim, yes, but for the wrong reason.
- **Fix (pick one or two):**
  - Let Clay contest a farm row **before** its last day sometimes (for example a row on its second-to-last day that the player cannot fill yet). Then a keeper has to fill early, not merely hold.
  - Or scale the crates to the lead (a crate every 7 days while behind, every 4 days when behind by 5 or more).
  - Calibrate the sim keeper against a played spring (13 fills) before using its win counts.
  - Give the farmer summer crop rows.

### F2 (Medium). Clay's crate is never announced, and on day 28 it decides seasons overnight

- **Repro (played, `edge11 PART=crate`, shots `e11-crate-*`):**
  1. Spring 28, score you 5, Clay 4, a potato request on its last day, nobody at the board. Real sleep. Summer 1 says: "Clay filled 3 Potato on the board.", "Clay shipped a crate from his own field: a point for him.", **"Clay won the board last season (6 to 5)."**
  2. Same, no request due: the crate alone makes **"A draw with Clay on the board last season (5 to 5)."**
  3. Spring 14 to 15: "Clay shipped a crate ... a point for him." appears in the morning. The board never said one was coming.
- **Where the rule is said:** nowhere before it scores.
  - The board (`BoardPanel.ts:48-57`) shows the score and his target only.
  - Clay's intro letter (`mail.json:169`) and his losing letter (`rival.ts:212`) describe only last-day takes: "A farm good left to its last day is mine."
  - In A32 three of his ten points were crates, and his letter still credited them to last-day takes.
  - `grep crate src` finds only the morning note (`mechanics/orders.ts:23-24`).
- **Impact:** a player who leads by one on day 28 does everything right and loses or draws overnight to a rule never shown. It feels unfair exactly where the race matters most.
- **Fix:**
  - On crate days, say it on the board ("Clay ships a crate tonight: a point for him.").
  - Name the crates in the intro letter ("and every week I ship a crate of my own").
  - Consider no crate on the season's last day, or count it before the player's last chance, so the last move is the player's.

### F3 (Medium, design). Once Clay has 5 hearts, every season is a free win, a trophy and goal progress

- **Played (`edge11 PART=hearts5`):**
  - At 5 hearts, a summer with you 1, Clay 0 settles as "You beat Clay on the board last season (1 to 0): +300g." `boardWins` goes to 1, the trophy counts it.
  - Earlier, at 2 to 3 down when he turned friendly, the season settled "Clay won the board last season (3 to 2)." and he sent "The board is mine": "A farm good left to its last day is mine." By then he no longer takes requests.
- **Cause:**
  - `settleSeason` ignores `rivalOff` (`rival.ts:180-216`).
  - At 5 hearts Clay takes nothing and ships no crates (`rival.ts:230, :254`).
  - Every win adds +20 friendship with him (`:194`), so a winner drifts toward 5 hearts.
  - The mastery goal "Beat Clay in four seasons" (`goals.json` #57, 3,000g) then completes for one filled request a season.
- **Impact:**
  - Critique 10's F3 fix (keep score) turned the trophy into a counter of seasons he did not contest.
  - The losing letter's wording is false while he is retired.
- **Fix:**
  - Keep his crates while friendly, so a friendly season still has an opponent ("Clay still ships his crates").
  - Or settle friendly seasons without the prize, trophy and goal ("A friendly season: you 1, Clay 0").
  - Skip the gloating letter while he is off.

### F4 (Minor). Year two: Clay's line says one when he takes two, and "two of these" marks one

- **Played (`edge11 PART=pick`, shots `e11-pick-y2-*`):**
  - Two fish or wild rows due in year 2: 10 AM **"Clay takes one at 2:00 PM: no point."**; 3 PM "Clay took two today." with both rows "Clay took it: no point."
  - A farm row plus a fish row due: **"Clay wants two of these at 2:00 PM."** but only the potato row says "Clay's!". At 3 PM he took both.
- **Cause:** `rivalNotice` hard-codes "one" in the no-point line, and counts all picks for "two of these" while `rivalTargets` marks only farm goods (`rival.ts:94-97, :101-104`).
- **Fix:**
  - "Clay clears two at 2:00 PM: no point."
  - "Clay wants this one at 2:00 PM (and clears a fish row)." Or count only scoring picks in the sentence.

### F5 (Minor). The bin's new wanted line clips as soon as any of that good is in the bin; "Board" also counts Rosa's special

- **Played:**
  - "Egg / Board 2  x2  bi.." (`e11-toast-bin-three`).
  - "Si. Cauliflower.. / Board 2  x2  bi.." and "Au. Strawberr.. / Board 4  x4  bi.." (`s11-bin-after-shipall`).
  - "Gold Potato / Board 16  x2  b.." (`e11-keepsp-bin-after`).
  - The words that F1 of critique 10 asked for ("Board 4  have 9") lose "have" and the bin count exactly after the player has shipped some.
- **Cause:** `binWantedSub` adds "  bin N" (`src/ui/panels/binText.ts:7-8`). `fitRow` shortens "have" to "x" and then cuts (`src/ui/fontMetrics.ts:146-163`). The test fits only `inBin = 0` (`tests/critique10.test.ts:172-174`).
- **Wording:** with a special for the same good, the row reads "Board 16" and the toast "Kept 16 Potato for the board." where the board's requests want 5 and Rosa 11.
- **Fix:**
  - Drop "have" on wanted rows ("Board 4  x9  bin 2" fits), or show the bin count only in gold on the price side.
  - Say "Kept 5 Potato for the board and 11 for Rosa."

### F6 (Minor). A special that runs out is settled in silence on the season's first morning

- **Repro (played, `spexp11.mjs`, shot `e11-special-expired-summary`):**
  - Rosa's 15 Potato with 9 given runs out on spring 28.
  - Summer 1: gold goes 1,000 to 1,900. But the summary shows "Nothing shipped ... +0g Total" and then "Special order: 18 Tomato for Mara". Nothing says the potato special ended or that 900g was paid.
- **Cause:** `morningSpecial` writes "The special order ran out. Paid ..." into `news`, then overwrites it with the new special (`src/systems/specials.ts:92` and `:101`). A new special is always posted on day 1 of a season, so the expiry line is never shown.
- **Fix:** return both lines (or push two notes).

### F7 (Minor, one-thumb). Finishing the special shrinks the board under the thumb

- **Played (`shift11.mjs`, shots `e11-shift-*`):**
  - The board's Give buttons were at y 247, 273, 299 and the special's "Give 1" at y 325.
  - Tap it: "Special order done! +2250g". The row is removed and the sheet shrinks.
  - The three request Gives move **down** to y 273, 299, **325**.
  - A second tap on the same spot gave "Order done! +200g" for the egg request.
- **Cause:** the sheet is glued to the bottom and its height follows the row count (`BoardPanel.ts:50-52`, `widgets.ts` `setHeight`/`rebuild`).
- **Impact:** harmless in this case (a filled request), but it is the slide-under-the-thumb class that critique 9 F4 fixed in the Make tab. A double tap spends goods the player may have meant for something else.
- **Fix:** keep the special's row as "Special done! Thank you" until the board is closed, as filled requests keep theirs.

### F8 (Minor, balance and tests). Early gold swings year one by up to three quarters; the board-race sim test sits at its timeout

- **Today's bot (`simx11.test.ts`, `tmp/simx11.out`, keeper-farmer):**

  | Seed | Farmer y1 | Fisher | +500g on day 7 | +1,000g on day 14 | +2,000g on day 14 |
  | --- | --- | --- | --- | --- | --- |
  | 42 | 240,011 (plot day 23) | 406,843, **+70%** | +35% | +25% | +26% |
  | 7 | 182,465 (plot day 26) | 385,656, **+111%** | **+77%** | +79% | +90% |
  | 99 | 288,378 (plot day 21) | 379,143, +31% | +24% | +8% | +22% |

  - On seed 7 the fisher earned **less** than the farmer by day 14 (1,190 vs 1,645) and still doubled the year.
  - The tireless year-one sim is chaotic. The five-seed spread is 175,322 to 252,363 (median 213,730).
  - "Bounded at under twice the farmer" (DECISIONS, "Sim fidelity: a fisher") is false on seed 7. The test bounds the fisher against `SIM_EARNED * 2` (427k), not against the farmer, and seed 42's fisher is at 95% of that bound.
- **Test timing:** the board-race test took 4,948 ms on an idle machine against vitest's 5,000 ms default, and failed on timeout once under load. Give these sim tests an explicit timeout.
- **Fix:** judge the economy with the human-paced sim (median 184,376; 140k to 199k), and make the first plot price less of a cliff. Bound the fisher against the same farmer.

### F9 (Minor). Small rule and text slips

- **Winter of year 1 pays the year-2 prize.** `settleSeason` runs after the calendar rolled over and uses `state.time.year` (`rival.ts:190`). Played (`winter11.mjs`): "You beat Clay on the board last season (6 to 4): +600g." The board staked 300g all winter.
- **Clay's intro and losing letters do not mention crates** (see F2).
- **"Clay took one today."** still does not say whether it scored; the row does.
- **The morning summary's season result can be cut.** On F32's summer 1 the notes ended "...and 2 more" two lines after the result (`SummaryPanels.ts:74-81` drops notes from the end). The result survived here, after the take and crate lines, but a busier morning (more sales, withered crops) cuts from the end, where the new special and jobs sit.

### F10 (Minor). The late goal chain hides the board and statue goals behind fishing, and a three-toast stack covers the Menu header

- **Goals** are strictly one at a time (`systems/goals.ts:26-38`).
  - #54 "Catch a legendary fish" comes before #55 "Beat Clay on the board", #56 festival and #57 four seasons.
  - #58 "Catch all four legendary fish" comes before #59 "Raise your statue to level 6".
  - A player who never lands a legend never sees the board or statue goals. Those goals then complete in a burst of "Goal complete!" toasts, capped at three on screen, when the legend is caught.
  - Suggest putting the fishing goals last, or letting the HUD show the next unblocked goal.
- **Toasts over tall sheets:** three long toasts reach logical y of about 80. Over the Menu (Make/Bag) they cover the "WORKBENCH  Gold 5,000" header (shot `e11-toast-three-menu`). Nothing tappable is covered, because above a sheet is the dim.

### Not a bug (positives)

- **Toasts above sheets work everywhere I tried:** bin, board, cart, shop, Make and bag. They are readable, stack newest-lowest, and drop back above the dock when the sheet closes.
- **Clay's pick order is right in every mix:**
  - year 1: best farm row over a richer fish row;
  - year 2: two farm rows over a fish row; a farm and a fish row; two fish rows;
  - never the last open row;
  - polite: fish first at 5:00 PM, then the smallest farm row.
  - "Clay's!" appears only on a row that would score.
- **The 5-heart fix keeps the score and settles seasons**, and no crate is shipped at 5 hearts.
- **Season lines:** "Last season: you won 13 to 3." held the score line for exactly three mornings in both runs. The quiet 0-0 morning line is said. Mara's "out-scored".
- **Keep-back with a special and two same-good requests is exact.** Requests are kept first, the special's open quantity after. The special's Give hands over only what the requests do not need.
- **Trophies at home:** Ribbons (4,2), Board Trophy (6,2) and Legend Wall (7,2) appear when earned, sit clear of each other, and say "Festival Ribbons: first places won, 2.", "Board Trophy: seasons won on the board, 3.", "Legend Wall: legendary fish caught, 1 of 4." (shot `e11-trophies-house`). With nothing won, nothing shows and E does nothing.
- **Cart:** "Loved gift", "Market Road", "Waters 8", "Greenhouse", "Winter crop", "4 left" after a buy.
- **Stability:** 0 errors; tsc clean; 711 tests.

---

## 3. The days played

| Run | Day 14 earned | Day 28 earned | Day 32 earned | Gold day 32 | Board (spring) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **F32** (Ship all, hurried) | 3,605 | 15,871 | 16,995 | 11,212 | **won 13 to 3** | 13 farm fills; Rosa's special done on day 28 (+2,250g); about 15 "Kept ..." toasts, now visible; summer board all fish and wild |
| **A32** (row All, careless) | 3,564 | 8,704 | 9,118 | 3,432 | **lost 4 to 10** | lost 7 crop rows to Clay; special 0/15; Clay's "The board is mine" letter |

Critique 10's F32b (same hurried bot) earned 4,069 / 16,423 / 17,174. That is about the same: keeping for the special delays potato income (gold 26 on day 7, 545 on day 14) and then pays 2,250g at once.

**The race each morning (from day 8):**
- **F32:** 1-0, 2-0, 3-0, 3-0, 4-0, 4-0, 6-0, then a crate: 6-1, 7-1, 8-1, 8-1, 8-1, 9-1, then a crate: 10-1 ... 10-2, 11-2, 12-2, 13-2, then a crate overnight: 13-3.
  - Clay's line: mostly "takes one at 2:00 PM: no point." His crates were said only in the morning after.
- **A32:** 0-0 (Clay's! on 3 Parsnip, taken), 0-1 (2 Potato, taken), 0-2, 1-2, then 1-3 (3 Parsnip), 1-3, 1-3, 2-3 (3 Potato taken), then a crate: 2-5, 2-5, 2-5, 2-6 (3 Potato), 3-6, 3-6 (4 Potato) ... 3-8, 4-8, 4-9 (3 Potato), then a crate: 4-10.
  - Every "Clay's!" morning was a real loss. The bin warned each time.

**Does it feel like a contest?**
- For the careless player, yes, and a fair one now: the target is real, the 2 PM deadline is real, the warning is visible.
- For the keeper, no. He is never threatened (F1), and the three points he concedes come from a rule he never sees until it has scored (F2).

## 4. One-thumb reach

- **Unchanged and fine:**
  - Close or Done at logical y about 383;
  - "Ship all produce" bottom right;
  - board Give at x 172 to 174;
  - cart Buy at x 170;
  - Make at x 146 with the batch slot at x 180.
- **Moves after a tap:** finishing the special slides every request row down 26 px, and the next Give lands under the thumb (F7). Bin rows, cart rows ("4 left", "Sold out") and filled requests keep their places.
- **Top toasts** cover the HUD and, with three long ones, the Menu header. They never cover a button, because above a sheet is the dim (tap to close). When a sheet closes they move to the bottom at once.

## 5. Progression and economy

**Sim (`tests/sim.test.ts`, `tmp/sim3.out`):**
- **Tireless bot, five seeds:** 228,569 / 175,322 / 252,363 / 207,332 / 213,730 (**median 213,730**, equal to the pin).
- **Human-paced:** 184,376 / 140,066 / 199,389 (median 184,376).
- **Board:** 128 requests posted, Clay took 70.
- **Two years:** 8 projects by year-2 spring, statue 6 by year-3 spring, 1.09M earned against 824k sunk; gold sits at 30k to 55k. The same healthy shape as before.
- **Board race (two years, three seeds):**
  - keeper **16 wins, 6 losses, 2 draws**;
  - shipper **1 win** (seed 7 fall y1, 9-8);
  - fisher-keeper 19 wins, 4 losses, 1 draw.
  - Clay's crates give him 3 points in spring y1 and 4 in every later season.
  - The keeper's losses fall in year-1 spring and summer (4 of 6) and in seed 99's year-2 fall and winter (two takes a day).

**My read:**
- The race numbers look like a contest, but play says the keeper's year 1 is a walkover (F1).
- The shipper's 1 of 24 is right: keeping goods is the skill.
- **Year-2 two takes vanish early:** they apply only while Clay is under 2 hearts (`calmHearts`), and five season wins already give +100 friendship. A winning player meets the doubled Clay for at most a season or two.

**Runaway or dead:**
- **Runaway:** none in the yearly totals, but early compounding is extreme (F8).
- **Near dead:**
  - Clay as an opponent for a keeper;
  - the farmer's summer board;
  - the board after 5 hearts (free wins, F3);
  - the statue sprite after level 6, unchanged.

## 6. Top 3 things to add next

1. **Make Clay a threat to a keeper:**
   - let him contest a farm row before its last day, or scale his crates to the gap;
   - announce crates on the board and in his letters;
   - do not let the last-night crate decide a season unseen (F1, F2).
2. **Close the friendly-Clay loophole:** a friendly season keeps his crates, or pays no trophy (F3). Fix the year-2 sentences (F4) and the winter prize year (F9).
3. **Finish the small feedback set:**
   - a bin wanted line that fits with a bin count, and "for Rosa" for special keeps (F5);
   - the special's expiry note (F6);
   - a special row that stays put when finished (F7);
   - an explicit timeout on the sim tests (F8).

## 7. Verdict

**Stable and readable, no blocker and no major. Critique 10's Major (hidden toasts) is fixed.**
- **Checks:** 711 tests and tsc pass. 0 errors in 64 played days and about 40 probe sleeps.
- **Critique-10 findings:** F1, F4, F5 and F6 are fixed through real input. F3 is fixed as specified but opens a loophole. F2's rules are fixed but the outcome for a keeper is not. F7 is worse.

**Where the weakness sits now:**
- Clay plays to win only on last days. A keeper empties the farm rows before then, so in played spring he won 13 to 3 against Clay's crates alone.
- A careless player now loses with every warning visible, which is fair.
- What the race lacks is pressure before the last day, and a crate rule the player can see.

## Screenshots (`critique-11/shots-11/`)

| Group | Files |
| --- | --- |
| Toasts above sheets (C10 F1) | `e11-toast-bin-shipall`, `e11-toast-bin-three`, `e11-toast-board-give`, `e11-toast-cart`, `e11-toast-shop-buy`, `e11-toast-shop-broke`, `e11-toast-make-real`, `e11-toast-bag-eat`, `e11-toast-three-tall-board`, `e11-toast-three-menu` (F10), `e11-toast-closing-120ms`, `-520ms`, `e11-toast-after-close` |
| Clay's picks (F1, F4) | `e11-pick-y1-mixed-10am`, `-3pm`, `e11-pick-y1-fish-only`, `e11-pick-y2-two-farm-plus-fish-*`, `e11-pick-y2-farm-plus-fish-*`, `e11-pick-y2-two-fish-*`, `e11-pick-y2-farm-last-two-open-*`, `e11-pick-polite-10am` |
| Crates and season order (F2) | `e11-crate-day15-board`, `e11-crate-take+crate-summer1-board`, `e11-crate-crate-only-summer1-board`, `e11-crate-zero-fall1-board` |
| 5 hearts (F3) | `e11-hearts5-board`, `e11-hearts5-summer1` |
| Keep-back with the special (F5) | `e11-keepsp-bin-before`, `e11-keepsp-bin-after` (clipped "b.."), `e11-keepsp-board`, `s11-bin-wanted`, `s11-bin-after-shipall` (clipped "bi..") |
| Special expiry (F6) | `e11-special-expired-summary` |
| Board shift (F7) | `e11-shift-before`, `e11-shift-after-tap1`, `e11-shift-after-tap2` |
| Sweep (boards, cart, Make, dishes, mail) | `s11-board-cart-target`, `-festival-target`, `-y2-two-targets-lastseason`, `-cart-3pm-took`, `-lastseason-lost`, `-cart-y2`, `s11-cart`, `s11-make`, `s11-bag-dish4`, `s11-bag-dish6`, `s11-mail-list`, `s11-mail-letter-0..2` |
| Cart | `e11x-cart-spring-5`, `-summer-12`, `-fall-19` ("Greenhouse"), `-winter-26`, `-spring-26` |
| Trophies | `e11-trophies-house`, `F32-trophy-house` (one win), `A32-trophy-house` (none) |
| New game | `01-day1-farm-planted`, `02`..`04-summary-day*`, `20-scarecrow-placed`. The two runs ran at the same time and share these names, so these are from whichever run wrote last. The per-day board images in `c11/tmp/` collide the same way and are not cited. |
