# Tiny Acre: independent critique 12

Reviewer: independent QA lead and game critic, round 12.

**Status: complete for the scope below.**
- Played: three new games from spring 1 with real input, plus one first-week game. Each farmer **never fishes or forages**:
  - two keepers on the hurried "Ship all produce" path (31 and 29 days);
  - one careless player who ships with each row's "All" (31 days);
  - one 8-day player who does jobs (fish, forage, mine, chat) and uses Ship all.
- Re-checked: every critique-11 finding (F1 to F10).
- Set up by state, then real taps: the crate and catch-up rule (announcement, day 27/28, a lead of 4, a friendly Clay), year-two text, the winter prize, the special's expiry and its finished row, keep-back with the special, the goal chain at #10/#28/#50/#54, and a clipping and one-thumb sweep of the board, bin, cart, mail and summary.
- Sims: today's sims, plus my own early-curve and race sim.
- Out of scope: real phone, audio, performance, art and the tutorial's content. **Nothing here was verified on a real device.**

**Frozen build:** `critique-12/farm-game`, a `git archive` of `6d5e480` (head of `integration/round3-2026-10-10`). It is an archive, so I could not confirm the hash myself.

**Method:**
- Headless Chromium (playwright-core, chromium-1217), 390x844, `hasTouch`, against my own `vite` on **port 5197**. I stopped it at the end; port 5197 is confirmed free.
- **No game source, test or data file was edited.** The `?debug&tutorial=0` hook (`window.__farm`) was used for setup and readback.
- **Probes:** `farm-game/agents/out/c12/`. Logs are in `c12/tmp/`.
  - New probes: `play12.mjs` (play10 plus crate logging, a board read after each Give, a daily town visit, and per-run screenshot tags), `edge12.mjs` (`PART=crate|catchup|hearts5|y2|winter|special`), `sweep12.mjs`, `goals12.mjs`, `bagtip12.mjs`, `race12.mjs` (log summariser), `simx12.test.ts` with `vitest.c12.config.mjs`. `edge11b.mjs` is edge11 with c12 names.
  - Probe fix: the careless bot no longer skips rows named "Cauliflower". In critique 11 that slip scored all four of the careless player's points.
- **Checks:**
  - `npx tsc --noEmit`: clean.
  - `npx vitest run --testTimeout=120000` (idle machine): **81 files, 780 tests pass** (18 s).
  - `npm run verify` and the e2e scripts were not run, as instructed.
- **Errors:** 0 page errors and 0 console errors across 99 played days and about 30 probe sleeps.

## What I played, and what I did not

"Real input" means the keyboard (arrows, Space, E, M, Esc, Enter) and real touch taps on canvas buttons found from the live UI tree.
- **Moving between spots was by teleport (`goMap`/`snap`), not by walking.** Before 8:00 the town clock was moved to 8:00.
- From day 7, a 3 PM board look was modelled by setting the clock to 15:00. The bots finish their day by about 9 AM and the 3 PM look, so these are not human-paced days.

| Run | Player | Ships with | Days | Valid? |
| --- | --- | --- | --- | --- |
| **K31** | keeper: never fishes or forages; fills every farm row it can, then the special | bin "Ship all produce", tapped before the board | 31 (spring 1 to summer 3) | yes ("Use now" moved a bag seed 7 times) |
| **K29b** | same keeper, new random seed | same | 29 (to summer 1) | yes (5 times) |
| **C31** | careless: same farmer | each row's "All", including Cauliflower now | 31 | yes (8 times) |
| **W8** | does jobs (forages and fishes for them); first week only | Ship all | 8 | yes |

**Verified only by code or sim:**
- the goal burst when a legend lands (`goals.ts:28-35`);
- the order of the morning notes;
- the economy (`tests/sim.test.ts`, `simx12.test.ts`).

**Not verified:** real phone, walking times, year two played from spring 1 (it was set up by state), a real legendary catch, and a real festival.

---

## 1. Critique 11 findings re-checked

| C11 | Then | Now | How checked |
| --- | --- | --- | --- |
| F1 a keeper walks the race | Medium | **Partly fixed.** The keepers won **12 to 5** and **13 to 6** (was 13 to 3). All of Clay's points were crates: 5 and 6 of them through the catch-up rule. His 26 takes in the two keeper springs (12 and 14) scored 0. The result was settled by about day 13 both times (lead of 4 or more from then on). See **F1**. | played (2 runs) + sim |
| F2 crate unannounced; day 28 decides | Medium | **Mostly fixed.** "Clay ships a crate tonight: a point." was seen on the board on 11 of 11 keeper crate days, and no crate comes on day 28. Gaps: the line is hidden behind a target or a take (C31 day 21; edge C, Clay scored twice that day), and the letters still say "each week". See **F2**. | played + edge |
| F3 friendly Clay = free wins | Medium | **Fixed.** At 5 hearts: "Clay no longer takes requests." / "Clay ships a crate tonight: a point.". A friendly season settled "Clay won the board last season (4 to 2)." with no gloating letter. | edge `hearts5` |
| F4 year-two text | Minor | **Fixed.** "Clay takes two at 2:00 PM: no point."; "Clay wants two of these at 2:00 PM." with both rows marked "Clay's!". Farm plus fish says "wants this one", which is fair since one of the two scores. | edge `y2` |
| F5 bin line clips; "Board" counts the special | Minor | **Fixed.** "Board 2  bin 1" and "Board 4  x9" fit. The toast reads "Kept 5 Potato for the board and 11 for Rosa.". The row still says "Board 16" (it counts Rosa's 11). | sweep + `edge11b keepsp` |
| F6 special expiry silent | Minor | **Fixed.** "The special order ran out. Paid 900g for what you brought. Special order: 5 Melon for Finn, by the season's end." | edge `special` |
| F7 board shrinks under the thumb | Minor | **Fixed.** After the special is finished, the Gives stay at y 247/273/299 and the special's button turns "Done". A second tap on the same spot does nothing. New small clip: "Special done! Thank yo.." (F6 below). | edge `special` |
| F8 sim timeouts, early gold | Minor | **Timeouts fixed** (`vi.setConfig({testTimeout: 60_000})`). **Early gold is still chaotic** (section 5). | code + sim |
| F9 winter prize; summary cut | Minor | **Winter fixed:** "You beat Clay on the board last season (6 to 3): +300g." **Summary: worse than feared.** On a busy season-change morning the season result itself is cut (F3 below). "Clay took one today." still does not say whether it scored. | edge + sweep |
| F10 goal chain; three toasts | Minor | **Not fixed for round-2 goals** (as DECISIONS says). For a non-fisher the problem starts long before #54 (F4 below). Over the tallest board, three long toasts reach only the HUD. | state + shots |

---

## 2. Ranked findings

### F1 (Medium, design). A keeper still wins comfortably, never in doubt; the careless player loses 0 to 12. The catch-up crates narrow the margin but make no contest

- **Played (real input, never fishes or forages):**

  | Run | Result | Clay's points | Takes that scored | Lead first reached 4 | Smallest lead after that |
  | --- | --- | --- | --- | --- | --- |
  | **K31** (Ship all) | **won 12 to 5**, +300g, Mara's letter, trophy 1 | 5 crates (days 15, 18, 21, 24, 27) | **0 of 12** | day 13 (4-0) | 4 |
  | **K29b** (Ship all) | **won 13 to 6** | 6 crates (12, 15, 18, 21, 24, 27) | **0 of 14** | day 10 (4-0) | 4 |
  | **C31** (row All) | **lost 0 to 12**, "The board is mine" letter | 10 takes + 2 crates | 10 | never | never |

- **The race each morning from day 8:**
  - **K31:** 1-0 ×4, 2-0 ×2, 4-0, 4-0, then a crate 5-1, 6-1, 6-1, then a crate 6-2, 8-2, 8-2, crate 8-3, 9-3, 9-3, crate 9-4, 9-4, 10-4, crate 12-5. Result 12 to 5.
  - **K29b:** 1-0, 3-0, 3-0, 4-0, 5-0, crate 5-1, 5-1, 5-1, crate 6-2, 7-2, crate 7-3, 8-3, 8-3, crate 8-4, 9-4, 10-4, crate 10-5, 11-5, 11-5, crate 12-6. Result 13 to 6.
  - **C31:** 0-0, 0-0, then Clay's! taken 0-1, 0-1, 0-2, 0-3, crate 0-4, 0-5, 0-5, 0-6, 0-6, 0-6, 0-7, take plus crate 0-9, 0-9, 0-9, 0-10, 0-10, 0-10, 0-11, 0-12.
- **Clay's lines seen by the keepers** (one board look a morning plus the 3 PM look):
  - "Clay takes one at 2:00 PM: no point." on most mornings;
  - "Clay scores on farm goods only.";
  - "Clay wants this one at 2:00 PM." 5 times, every time on a row the bag already filled;
  - "Clay ships a crate tonight: a point." on every crate day;
  - "Clay took one today." / "Clay took it: no point." at 3 PM.
- **Cause:**
  - Clay still scores only on farm rows **on their last day** (`src/systems/rival.ts:67-79`). A keeper fills those first, so his takes never score.
  - His only counter is the crate (`crateDue`, `rival.ts:244-250`). While you lead by 4 it comes every 3rd day, about 0.33 points a day. The played keepers filled 12 to 13 rows in 21 days (about 0.6 a day). So the gap holds steady at 4 to 7 and cannot close.
  - The careless player ships every farm good before the board, so every farm row reaches its last day.
- **The sim still does not predict play.**
  - In `tests/sim.test.ts`, the tireless keeper loses year-1 spring on 3 of 3 seeds (5-6, 3-6, 2-6) and wins 19 of 24 over two years.
  - It fills only 2 to 5 spring rows, where the played keepers filled 12 and 13 (my `simx12` detail).
  - Its losses are year-1 spring and summer. That is the bot's slow start, not Clay's play.
- **Answer to the key question:** no. A keeper does not win "by a few points with the result in doubt". He wins by 7, and it is settled by about day 13. A careless farmer loses by 12. Neither game is in doubt near the end. It is not unfair: the careless loss had the bin's warnings and the "Clay's!" marks. It is simply not close.
- **Fix (pick one):**
  1. **Let Clay contest one farm row before its last day while he trails by 3 or more** (for example, a row on its second-to-last day that you cannot fill yet). Then a keeper must fill early, not just hold, and the lead can actually change hands.
  2. **Or make the crates track the gap**, so a steady filler stays 1 to 3 ahead, not 4 to 7. For example, every 2nd day while behind by 4, and every day while behind by 6. Show the rule (F2).
  3. Calibrate the sim keeper against a played spring (12 to 13 fills) before reading its win counts. For example, plant the starting parsnips and keep the first crops (see section 5).

### F2 (Medium). The catch-up rule is never explained, its cadence is odd, and the crate line hides behind a target or a take

- **Played (`edge12 PART=catchup`, real sleeps):**

  | Day, score | Board line | Overnight |
  | --- | --- | --- |
  | day 9, 4-0 | "Clay ships a crate tonight: a point." | crate |
  | day 9, 3-0 | "Clay scores on farm goods only." | none |
  | **day 14, 4-0** | "Clay scores on farm goods only." | **none** |
  | **day 14, 3-0** | "Clay ships a crate tonight: a point." | **crate** |
  | day 15, 4-0 | crate tonight | crate |
  | day 21, 3-0 or 4-0 | crate tonight | crate |

  **Leading by more removes the weekly crate on days 7 and 14.** It happened in play: K31 on day 14 at 4-0 and K29b on day 14 at 5-1 got no crate, then one on day 15. The cause is `seasonDay % every` with `every` = 3 or 7 (`rival.ts:248-249`): 14 is not a multiple of 3.
- **The line moves with the score during the day:**
  - Day 12 at 3-0: "Clay scores on farm goods only."; one Give later (4-0): "Clay ships a crate tonight: a point." (shots `e12-catchup-F-before/after`).
  - Day 12 at 4-0 with a target he takes at 2 PM: lead 3, so no crate. Nothing was promised, because the target line hid the crate line.
- **Hidden lines:** `rivalNotice` (`rival.ts:85-105`) puts "took N today" (`:93`) and the target lines (`:98-99`) ahead of the crate line (`:101`).
  - Day 14 with an unfilled target: 10 AM "Clay wants this one at 2:00 PM.", 3 PM "Clay took one today.", then overnight a take **and** a crate (2 to 1 became 2 to 3). The crate was never said (`e12-crate-C-*`).
  - It happened in play: C31 day 21 ("CRATE (NOT said)").
  - Any player who looks only after 2 PM never sees a crate announced.
- **Letters:** the intro (`src/data/mail.json:169`) and the losing letter (`rival.ts:222`) say "each week I ship a crate of my own". The rule that matters most to a winning player (every 3rd day while you lead by 4) is written nowhere. A player sees crates on days 15, 18, 21, 24 and 27 against a letter that promised one a week.
- **Is the catch-up rule readable?** Partly. An attentive player may notice the 3-day rhythm, but nothing says why. Losing the day-14 crate for being further ahead reads as random.
- **Fix:**
  - Schedule from the last crate ("next crate 3 days after the last while you lead by 4, else 7"), so a bigger lead never means fewer crates.
  - Show the crate as its own line or a suffix, whatever else is said: "Clay wants this one at 2:00 PM. Crate tonight."
  - Put the rule on the score line when it applies: "This season: you 8, Clay 3. Behind by 4+, Clay ships a crate every 3 days."
  - Fix both letters to say it.

### F3 (Minor+, readability). On a busy season-change morning the season result is cut from the summary

- **Repro (`sweep12`, shot `s12-summary-busy-season-change`):**
  - Spring 28: 7 kinds in the bin, crops that will wither, Clay due to take a potato row, a 9-8 score, and a special running out.
  - Summer 1 shows: sales (6 lines "...and 1 more"), "12 crops withered with the new season.", weather, "Clay filled 3 Potato on the board.", then **"...and 5 more"**.
  - Cut: the draw itself ("A draw with Clay..."), the special's expiry and the new special, jobs and letters.
- **Cause:**
  - `SummaryPanels.ts:46` caps the sheet at 340 px and `:71-82` drops notes from the end.
  - In `mechanics/orders.ts:13-29` the season result is pushed after the take notes, and sales lines come first.
  - About 150 px of empty dim sits above the sheet.
- **Impact:** the climax of the race is missing on exactly the morning it is decided. It survives on the board's "Last season" line (3 days) and in Mara's letter if you won. On a draw or a loss the morning says nothing.
- **Fix:**
  - Give the season result (and the special's expiry) priority over sales lines (fold sales into "Sold 7 kinds: +2,400g").
  - Or raise `MAX_SUMMARY_H` toward the free space.

### F4 (Medium, design). The goal chain freezes on the first skipped activity: a farmer who never forages sits on goal #3 all game; a non-fisher on #10, #28, #50 and #54

- **Played:** in all three long runs the HUD showed **"Pick up 3 wild goods off the ground" (#3) from day 5 to day 31.**
  - That is 26 days of one unchanging goal, while the farmer earned 17,000g, beat Clay and finished a special.
  - Every later goal (sell, harvest, order, earn 1k/5k, land...) was silently skipped.
- **State (`goals12`, shots `g12-*`):**
  - A non-fisher meets fishing gates at **#10** "Catch a fish with the rod", **#28** "Catch 20 fish", **#50** "Finish every page of the Book" (Fish and Wild pages) and **#54** "Catch a legendary fish".
  - At #54 with 3 board wins, a festival win and statue level 6 in stats, the HUD still says "Catch a legendary fish 0/1".
  - Menu > Goal shows only the current goal and the last two completed. The board, festival and statue goals behind it (#55 to #58, 12,800g in rewards) are invisible.
  - Landing a legend then completes them in one burst (`checkGoals` loop, `systems/goals.ts:28-35`).
- **Impact:** the HUD's one persistent line is wrong for any player who does not do everything. That is exactly the "farmer who never fishes can win" player the owner wants to support. The late chain at #54 is only the last of these gates.
- **Fix:** show the first unmet goal whose activity the player has started, or keep the chain but let the HUD show "next goal you can do" with the blocked one as an aside. Goals stay an append-only index; this changes only which one is displayed and checked (`currentGoal`). A minimal version: allow skipping a goal from Menu > Goal.

### F5 (Minor, design). Summer is dead for a farmer, as before

- Summer 1 to 3 boards in K31, K29b and C31 held only fish and wild rows (bluegill, carp, trout, catfish, mushroom, wild sunflower) plus the special "5 Melon".
- Clay cleared one a day, no point. This is unchanged from critique 11 F1.
- Crop rows appear only for crops you grow or carry (`systems/orders.ts:73`); the bots had nothing planted by summer 1.

### F6 (Minor). Small text and layout slips

- **"Special done! Thank yo.."**: the finished special row's sub line is cut (`BoardPanel.ts:160`; shot `e12-shift-after-tap1`). Use "Special done!" or "Thanks!".
- **Bag tab tip runs off the panel:** "Tip: hold Action, then drag, to work a whole plot." is 250 px wide in a 192 px sheet. "...work a w" is the last visible text (`MenuPanel.ts:308`; `s12-bag-tab-day1`). Probably the controls agent's.
- **The bin row says "Board 16"** for 5 wanted by requests plus 11 for Rosa. The toast now splits it; the row does not.
- **"Clay took one today."** still does not say whether it scored. The row does ("Clay filled this one." / "Clay took it: no point.").

### Not a bug (positives)

- **No crate on day 28.** Day 27 at a lead of 4 ships one ("Clay shipped a crate..."). Day 28 says "Clay scores on farm goods only." and summer 1 settles 7 to 4 with +300g.
- **The crate line, when it shows, is right**: 11 of 11 keeper crate days and every edge case without a target or take.
- **Friendly Clay** keeps shipping crates (at the catch-up rate too) and no longer gloats.
- **Year-two lines, the winter prize, the special's expiry, keep-back with the special**: all right.
- **One-thumb:** Give, Done, cart Buy, mail Read/Back and bin rows keep their places after a tap (`sweep12`).
- **Stability:** 0 errors; tsc clean; 780 tests.

---

## 3. The days played

| Run | Earned d7 | Earned d14 | Earned d28 | Gold d28 | Spring board | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **K31** keeper | 808 | 3,731 | 17,214 | 11,893 | **won 12 to 5** | 12 fills; special "7 Cauliflower" done (+2,400g); 16 "Kept ..." toasts; summer board fish and wild only |
| **K29b** keeper | 758 | 3,518 | 17,112 | 11,207 | **won 13 to 6** | 13 fills; same special done |
| **C31** careless | 662 | 3,279 | 13,551 | 8,057 | **lost 0 to 12** | 0 fills; special "15 Potato" never started; Clay's losing letter |
| **W8** jobs + Ship all | 1,394 | - | - | - | - | 2 to 3 jobs a day at 18-50g; fills a wild-leek request on day 3 |

Keeping costs nothing in gold: the keepers out-earned the careless player by 26% by day 28 (orders pay above the bin). **No bot bought land** (`play12` has no plot logic), so these totals are home-plot only.

**Crate announcements:**
- K31: 5 of 5 crates said on a board look that day.
- K29b: 6 of 6.
- C31: 1 of 2 (day 21 was hidden behind "Clay wants this one", then "Clay took one today").

**Letters:**
- Clay's intro on day 7 (with the weekly crate).
- Mara's "You out-scored Clay on the board last season, 12 to 5! ..." (K31) and "13 to 6" (K29b).
- Clay's "Last season the board was 12 to 0, my way: a farm good left to its last day is mine, and so is a crate of my own each week. ... 300g" (C31).
- Summer 1 to 3 board: "Last season: you won 12 to 5." / "Last season: Clay won 12 to 0."

## 4. One-thumb reach and clipping (390x844)

- **Clean** (no text out of bounds, no overlaps, `makeCheck`):
  - four tall boards with the new crate lines (day 21 with the cart, day 14 with the festival, year 2, friendly);
  - bin wanted rows before and after Ship all;
  - cart before and after a buy;
  - mail list and three letters (the current Clay texts);
  - every edge-probe board.
- **Nothing moved after a tap** on board Give (the row becomes Done in place), special Give (`e12-shift-*`), cart Buy, or mail Read/Back.
- **Clipped:** "Special done! Thank yo.." and the Bag tab tip (F6). The summary is not clipped but cut (F3).
- **Toasts:** three long toasts over the tallest board reach only the HUD (`e12t-toast-three-tall-board`). Not re-checked over Make (DECISIONS says it is unchanged).

## 5. Progression and economy

### The first week, played

| Player | Days 1-4 | First payday | Gold around day 8-9 | Gold of 1,000+ |
| --- | --- | --- | --- | --- |
| Keeper K31 | gold 10 to 86 | **day 5** (parsnips 316g, plus a "6 Parsnip" request of 300g) | 711 on waking, day 9 | day 14 (1,008) |
| Jobs player W8 | 94 to 247 from jobs (18-50g each) | day 5 | 607, day 8 | - |

- In all four runs a parsnip request (185-320g, 6 days) appeared on day 1. It is the best thing in week one.
- **Days 2 to 4 are dead for a farmer.** There is nothing to harvest and only watering to do, done by about 7 AM. Gold stays under 100 and the shop has nothing between an 80g seed and a 400g upgrade (can 400, rod 450, hoe 500, stamina 600, West Field 700).
- The special "7 Cauliflower 2,400g", posted on day 2, is a good long goal.
- **The first plot (700g) comes within reach on day 9 to 14** for a farmer who keeps buying seeds, and about day 8 for one who also does jobs.

### Sim, today's bot plus my sensitivity block (`simx12.test.ts`, `tmp/simx12-result.txt`)

Keeper-farmer, 112 days, seeds 42 / 7 / 99:

| Variant | Human-paced (150 presses) y1 | Tireless y1 |
| --- | --- | --- |
| base | 192,411 / 217,696 / 103,851 (median 192k; plot day 23/26/29) | 244,472 / 271,121 / 132,674 |
| West Field 450g | -2% / -15% / +23% | +2% / -10% / +25% |
| West Field 500g | -6% / -8% / +12% | -6% / -10% / +15% |
| +150g on day 3 and day 4 | +2% / +11% / **+171%** | +5% / +23% / +157% |
| +200g starting gold | 0% / -4% / +86% | +6% / 0% / +91% |
| +500g on day 7 (C11's test) | +26% / +5% / +130% | +31% / +20% / +141% |

- **The bot earns 0g in its first 7 days** on every seed (gold 20 each morning). It plants only its best-scoring seed (`tests/sim.test.ts` playDay step 8), so the 10 starting parsnip seeds are never planted. It also buys land only at 1.8x the price.
- So the sim's week one is not the game's week one, and its early-curve answers are mostly noise.
- Seed 99 is an unlucky outlier that any nudge rescues. On seeds 42 and 7 a cheaper plot does **not** help: it is -2% to -15%, because buying earlier starves seeds.

**Race sim (`tmp/simx12-detail.txt`):**
- Tireless keeper: 6 / 7 / 6 season wins of 8, with crates 2 to 7 a season.
- Human-paced keeper: 6 / 6 / 6, with winter y1 up to 23-8 against 6 crates.
- Shipper: 0 of 24.
- Spring y1 is lost 3 of 3 with 2 to 5 fills.

### My recommendation on the early curve

- **Do not cut the first plot price.** It is not the binding limit in week one: gold is under 100 until day 5, and the plot is affordable by about day 9-14. The sim says a cheaper plot does not reliably help.
- **Fill days 2 to 4 instead.** One guaranteed starter job of about 60-100g on day 3 (the jobs are already there at 18-50g), or a day-2 letter with 5 seeds, gives the dead days a purpose. That is about +150g, similar in size to the "+150g on day 3/4" row, which is safe on two seeds.
- **First make the sim plant its starting seeds**, so it can judge any change to week one at all.

## 6. Top 3 things to add next

1. **Make the race close (F1, F2):**
   - let Clay contest one farm row a day early while he trails, or tie the crate rate to the gap;
   - schedule crates from the last one;
   - always say the crate on the board;
   - write the catch-up rule in the letters and on the score line.
2. **Fix what the HUD and the morning say (F3, F4):**
   - show a goal the player can actually work on, not the first skipped one;
   - keep the season result on a busy season-change summary.
3. **Give the farmer a summer and week-one purpose (F5, section 5):**
   - crop rows in summer for what the farmer grows;
   - a starter job on day 3;
   - a sim that plants its starting seeds and is calibrated to a played spring (12 to 13 fills).

## 7. Verdict

**Stable, readable, no blocker and no major.**
- **Checks:** tsc clean, 780 tests pass, 0 errors in 99 played days.
- **Critique-11 findings:** F3, F4, F5, F6, F7 and the winter half of F9 are fixed and were checked through real taps. F2 is mostly fixed. F1 is only partly fixed: the margin shrank from 13-3 to 12-5 and 13-6, but every one of Clay's points is still a crate.

**The race is fair but not close.**
- A keeper leads by 4 from about day 10 to 13 and wins by 7. A careless player loses 0 to 12.
- The new catch-up rule shows up on the board as a run of crates every three days. Nothing explains it, and it skips the weekly crate when you lead.
- **New this round:** the HUD goal is frozen for any farmer who never forages (F4), and the season result can be cut from the morning that decides it (F3).

## Screenshots (`critique-12/shots-12/`)

| Group | Files |
| --- | --- |
| New games (per run) | `K31-`, `K29b-`, `C31-`, `W8-` + `01-day1-farm-planted`, `02`..`04-summary-day*`, `20-scarecrow-placed`, `trophy-house` (K31 shows the trophy, C31 none) |
| Crate announcement (F2) | `e12-crate-A-day14-10am` (said), `-A-day14-3pm` (hidden by "took one"), `-A-summary15`, `-B-day14-target`, `-B-day14-after-give`, `-C-day14-3pm`, `-C-summary15` (take plus crate, never said), `-D-day27`, `-D-day28`, `-D-summer1` |
| Catch-up (F2) | `e12-catchup-F-before`, `-F-after`, `-F-summary13` |
| Friendly Clay | `e12-hearts5-day13`, `-day14`, `-summer1` |
| Year two, winter | `e12-y2-two-farm-10am`, `-farm-plus-fish-10am`, `-two-fish-10am`, `e12-winter-y1-settle` |
| Special | `e12-special-expired-summary`, `e12-shift-before`, `-after-tap1` ("Thank yo.."), `-after-tap2`, `e12t-keepsp-bin-before/after`, `e12t-keepsp-board` |
| Toasts | `e12t-toast-*` (bin, board, cart, shop, make, bag-eat, three-tall-board, after-close) |
| Goals (F4) | `g12-goal10-fish-*`, `g12-goal28-fish20-*`, `g12-goal50-book8-*`, `g12-goal54-legend-with-wins-*` (hud, menu) |
| Sweep | `s12-board-crate-cart-day21`, `-crate-festival-day14`, `-y2-crate-catchup`, `-friendly-crate`, `s12-bin-wanted`, `s12-bin-after-shipall`, `s12-cart`, `s12-cart-after-buy`, `s12-mail-list`, `s12-mail-letter-0..2`, `s12-summary-busy-season-change` (F3), `s12-bag-tab-day1/day9` (F6) |

Per-day board, bin, mail and summary images from the long runs are in `farm-game/agents/out/c12/tmp/` with the same run prefixes.
