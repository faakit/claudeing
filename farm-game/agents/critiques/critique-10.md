# Tiny Acre: independent critique 10

Reviewer: independent QA lead and game critic, round 10.

**Status: complete for the scope below.**
- Every critique-9 finding (F1 to F8) was re-checked.
- Four 32-day new games (spring 1 to summer 4, real bed sleeps, a real spring-to-summer settlement) were played as a farmer who **never fishes or forages**. Two of them are valid farmers. The other two had a bot fault from day 2 (see "Not verified") and count only as board observations.
- The ten changes of this round were each played, with edge cases set up by state:
  - keep-back with quality and `jam|0|strawberry`;
  - requests on their last day and after Clay took one;
  - score line on day 7 and 8, season days 1 to 4, year 2 with two takes;
  - win, lose, draw and 0-0 settlements;
  - two trophies plus a reload;
  - statue levels 1 to 7;
  - eating limits across midnight and a pass-out.
- Clipping sweep of every changed panel. The sims were run, plus my own sensitivity sim.
- Critique 9's day-31 stall was re-run (3 variants). It did not reproduce.
- Real phone, audio and performance were out of scope.

**Frozen build:** `critique-10/farm-game`, a `git archive` of `e23349b` (branch `depth/round3`). Because it is an archive, I could not confirm the hash myself.

**Method:**
- Headless Chromium (playwright-core, chromium-1217), 390x844, `hasTouch`, against my own `vite` on **port 5195**. I stopped the server at the end and confirmed port 5195 is free.
- **No game source file was edited.** The `?debug` hook (`window.__farm`) was used to set up state and read it back.
- **Probes:** `agents/out/c10/`. Logs are in `c10/tmp/`.
  - New: `play10.mjs` (pure-farmer runner, `FARMER`, `SHIPALL`, `USENOW`), `edge10.mjs` (`PART=keep|special|score|season|trophy|statue|eat|make|cart|off`), `sweep10.mjs`, `statue10.mjs`, `chk.mjs`, `simx10.test.ts`.
  - Fixed in `lib.mjs`: `buttons()` now collects BitmapText labels recursively. `rows()` accepts the x=28 titles of this build and skips toast and tip texts.
- **Screenshots:** `critique-10/shots-10/`.
- **Checks:**
  - `npx vitest run`: **76 files, 700 tests pass.**
  - `npx tsc --noEmit`: clean.
  - `npm run verify` and the e2e scripts were not run, as instructed.
- **Errors:** 0 page errors and 0 console errors in every browser session (about 130 played or probed game days).

## What I verified by playing, and what I did not

"Real input" means the keyboard (arrows, Space, E, M, Esc, Enter) and real touch taps on canvas buttons, located from the live UI tree. **Moving between spots was by teleport (`goMap`/`snap`), not by walking.** When the bot reached town, the clock was moved to 8:00. From day 7, a 3 PM board look was modelled by setting the clock to 15:00.

**Played with real input (new games, spring 1 to summer 4, 32 days, real sleeps):**

| Run | Player | Ships with | Fills | Valid? |
| --- | --- | --- | --- | --- |
| **F32b** | pure farmer: no fishing, no foraging, fills only farm-good rows | the bin's **"Ship all produce"**, tapped **before** visiting the board (the hurried player) | every farm row it can, then the special | yes |
| **A32b** | same farmer | each row's **"All"** button (a careless player who ignores the warnings) | same | yes |
| F32, A32 | same two players | as above | same | **no:** from day 2 the bot's seeds landed in bag slots and it stopped planting. Their board and Clay observations are used; their economy is not. |

**Edge probes with real taps after a state setup** (`edge10`, logs `tmp/run-*.log`, `tmp/run2-*.log`, `tmp/edge-keep.out`):
- keep-back;
- the special's keep;
- score lines;
- four season endings with real bed sleeps (spring 28 to summer 5);
- two trophy wins plus a page reload;
- statue sprites by level;
- six dishes in a day, a dish at 1:30 AM, a pass-out, eating from the hotbar with Space;
- the Make tab double tap;
- cart rows on five days;
- Clay at 5 hearts.

**Clipping sweep** (`sweep10`, 6 tall boards plus bin, cart, Make, two dish cards and three letters). Plus 30-odd screens from the edge probes.

**Verified only by code or sim:**
- the year-2 prize and `BOARD_STAKES` text;
- that the special is not kept back by "Ship all produce";
- the economy (`tests/sim.test.ts` plus my `simx10.test.ts`).

**Not verified at all:**
- Real phone, audio, performance and walking times.
- Year two with real input. The two-takes score line was set up by state.
- **The 3 PM board look and the 8:00 town clock are modelled.**
- **F32 and A32:** after the mail gifts (fertilizer, Speed-Gro, a sapling) filled the hotbar, every seed bought went to a bag slot. The bot only plants from the hotbar, so it planted nothing after day 2. I re-ran both as F32b and A32b; the re-runs move a bag seed to the hand with Menu > Bag > "Use now" by real taps when needed. In the re-runs the hotbar happened to stay free, so "Use now" was never needed. This is the open "seeds in the bag" one-thumb cost (long-press picker) again, not a new bug.
- The goal chain never advanced past "Pick up 3 wild goods off the ground" in any run, because these farmers never forage. That is by design; a real player would.

---

## 1. Critique 9 findings re-checked

| C9 | Then | Now | How checked |
| --- | --- | --- | --- |
| F1 race hidden from the loser, unwinnable for a farmer, stakes unsaid | score shown on 2 to 14 of 24 mornings; farmer lost 72 of 72 sim seasons | **Fixed as specified.** <ul><li>The score line "This season: you N, Clay M." was on the board **25 of 25 mornings from day 8** in both valid runs, and on day 8 (not day 7) in the probe.</li><li>Clay scores only farm goods: "Clay took it: no point." on fish rows.</li><li>Clay's intro letter and losing letter name "300g and a trophy".</li><li>A draw is said ("A draw with Clay on the board last season (5 to 5).").</li><li>The trophy works (two wins, a reload).</li></ul>**But** the race is now a walkover for a keeper (F32b **won 15 to 0**), Clay's daily "target" is usually a row that cannot score, and a careless shipper still loses (A32b **lost 4 to 7**). See **F2**. Also: a 5-heart Clay ends the race and soft-locks the last goal (**F3**). | played + sim |
| F2 crop requests needed the whole harvest; the bin said nothing | 52% exact | **Rule fixed:** <ul><li>Crop rows asked for less than the field: "3 Potato" and "2 Potato" while 4 to 5 ripened; "1 Cauliflower" and "2 Cauliflower" from 3 to 5.</li><li>"Ship all produce" kept goods 15 times in F32b ("Kept 4 Potato for the board.", "Kept 5 Potato and 2 Cauliflower for the board.").</li><li>The row's All warns "The board wants 3 Potato."</li></ul>**But** every one of those toasts is drawn **under** the open bin sheet, so the player does not see it (**F1**). The careless A32b lost 7 farm rows to Clay. | played |
| F3 special emptied a part-filled request | | **Fixed.** Hold 2 with "3 Potato, Have 2/3, 2 days": the special reads "Saved for a request." with Give off. On the request's last day: "Give 2". Hold 7: "Give 4". | played |
| F4 Make slid under the thumb after a batch | | **Fixed.** <ul><li>"x3" at x 180 cooks 3 Baked Potato and keeps the 3 gold potatoes.</li><li>The slot stays as a dim "x1" at the same x 180; a second tap there does nothing.</li><li>Make stays at x 146.</li></ul> | played |
| F5 special on top took the hurried tap | | **Fixed.** Requests are drawn first and the special last (all boards). | played |
| F6 season result easy to miss | | **Mostly fixed:** <ul><li>The result comes after Clay's last take (code order, `mechanics/orders.ts:13-21`).</li><li>Mara writes "Best on the board" on a win.</li><li>The canopy nag came once in 32 days (F32b day 27).</li></ul>**Still weak:** <ul><li>"Last season: ..." gives way to Clay's target. It was shown on **1 of 3** days in F32b and **0 of 3** in A32b.</li><li>A 0-0 season says nothing.</li></ul>See F4. | played |
| F7 cart said the use only after paying | | **Fixed.** Rows read "900g  Market Road", "600g  Waters 8", "120g  Winter crop". **New small losses:** the "N left" count is gone from tagged rows, and a greenhouse-only seed in fall reads "Spring crop" (F5). | played |
| F8 text | | **Partly fixed:** Clay's 2-heart line was changed in data (not played). **Still open:** <ul><li>"Craft something at the workbench" (`goals.json:117`).</li><li>The cook goal's hint "cook at the workbench" (`goals.json:486`).</li><li>Dish icons are still coloured dots (shot `s10-make`).</li></ul> | read + played |
| Day-31 stall | bin and bed would not open | **Not reproduced.** `agents/probes/stall-day31.mjs` variants A, B and C all opened the bin and the bed with `{modals: 0 -> 1, busy: false, suspended: false}` (`tmp/stall.out`). There was no stall in 4 x 32 played days either. | played |

---

## 2. Ranked findings

### F1 (Major). Toasts are drawn under every open sheet, so this round's warnings are invisible where they matter

- **Repro (played, `edge10 PART=keep`, shots `e10-keep-toast-under-sheet` and `e10-keep-toast-after-close`):**
  1. Hold 3 potatoes and 2 strawberry jam, with open requests for both.
  2. Open the bin and tap **Ship all produce**. The event log has the toast "Kept 7 goods for the board.", but the screen shows the sheet with no toast.
  3. Tap a row's **All**. "The board wants 3 Potato." fires. Nothing is visible.
  4. Press Esc within about 2 s. Both toasts appear above the dock, stacked, *after* the decision is made.
- **Cause:**
  - `src/ui/Hud.ts:389-404` draws toasts at depth 79-80, at `DOCK_Y - 6` and stacking upward (`:444`). That is inside the area every bottom sheet covers.
  - `Modal` puts its dim at depth 200 and the sheet at 210 (`src/ui/widgets.ts:291, :304`).
  - The toast depth is unchanged since the MVP. What is new is that this round's F2 fix relies on it.
- **Impact:**
  - "Kept 4 Potato for the board." and "The board wants 4 Potato." are the whole of the bin's explanation, and neither can be seen.
  - Every other in-sheet result is hidden too: "Order done! +450g", "Bought Ruby. For the Market Road.", "A legend in the bin! Take it back out before bed", "Not enough gold.", "Inventory full!", "Sold out.", "You're not hungry enough.", "Made 3 Baked Potato", "Special order done!".
  - In A32b the player shipped wanted potatoes and parsnips with All; **all 7 of Clay's points were crop rows** he could have kept (D9 "4 Potato 565g", D16 "3 Potato 480g", D19 "3 Potato 425g", ...).
  - The one visible cue is the wanted rows' sub line, and its warning colour is close to the normal dim brown (shot `s10-bin-wanted`).
- **Fix:**
  - Raise toasts above sheets (depth above 210), and place them at the top of the screen while a modal is open (the HUD strip is free).
  - Or give `Modal` a one-line status area for these results.
  - Make the bin's wanted cue explicit text ("Board 4"), not only a colour.

### F2 (Medium, design). For a farmer the race is now a formality, and Clay's "target" is usually a row that cannot score

- **Played (spring, real input, no fishing or foraging):**

  | Run | Spring result | Clay's takes | Clay's points | Score line seen |
  | --- | --- | --- | --- | --- |
  | F32b (Ship all, keeps) | **won 15 to 0**, +300g, Mara's letter, trophy 1 | 13 (all fish or wild) | **0** | 25 of 25 |
  | A32b (row All, careless) | **lost 4 to 7**, "The board is mine" letter | 15 | 7 (5 potato, 2 parsnip) | 25 of 25 |
  | F32 (no planting after day 2) | won 5 to 0 | 17 (all fish or wild) | 0 | 25 of 25 |
  | A32 (no planting after day 2) | won 3 to 1 | 13 | 1 (4 Potato) | 25 of 25 |

- **What the farmer sees each morning:**
  - "Clay wants this one at 2:00 PM." and a warning-coloured **"Clay's!"** on rows like "5 Trout", "6 Mushroom" or "4 Daffodil". That was 12 of 21 board mornings from day 8 in F32b, and every one of them was a no-point row.
  - Then, at 3 PM, "Clay took it: no point."
  - The urgency the board signals is false for him.
- **Clay throws away his own points (played, `edge10 PART=score`, shots `e10-score-target-fish`, `e10-score-nopoint-take`):**
  - "2 Bluegill 400g" and "3 Parsnip 200g" both on their last day: Clay targets and takes the bluegill (no point), and the parsnip expires unscored.
  - Same with "2 Catfish 700g" against "3 Potato 400g".
  - Cause: `rivalPicks` sorts last-day rows by reward with no regard to scoring (`src/systems/rival.ts:59-67`).
- **The board for a pure farmer:**
  - From day 8, F32b's board showed 22 farm rows and 53 fish or wild rows (71% he can never fill). A32b: 30 and 45.
  - In summer 1 to 4 both boards were 100% fish and wild, plus a special for "18 Tomato" / "19 Corn".
- **Sim agrees:** the keeper wins 23 of 24 seasons plus one 4-4 draw, by margins like 18-2, 16-2, 16-4. A shipper wins 13.
- **Impact:**
  - The fix swung from "a farmer cannot win" to "a farmer who taps Ship all cannot lose".
  - The race's drama (a named target, a 2 PM deadline) now points at rows that do not count.
  - What decides the season is whether the player's bin shipped wanted crops with All, and the warning for that is invisible (F1).
- **Fix:**
  - Have Clay pick the best **farm** row on its last day, and take fish or wild rows only when no farm row is due. Then his takes cost points.
  - Never mark a no-point row "Clay's!". Show "Clay will clear this (no point)", or show no target that day.
  - Consider letting Clay score a little on his own (one point every few days from his own field), so a keeper still has to keep up, not just turn up.

### F3 (Medium). At 5 hearts Clay quits and the race, the trophy and the last goal end silently

- **Repro (played, `edge10 PART=off`, shot `e10-off-board`):**
  1. Clay at 250 friendship (5 hearts); spring 27, tally you 9, Clay 3; goal #55 "Beat Clay on the board".
  2. The board shows only "Requests stay a few days." The score line is gone.
  3. Sleep into summer 1: no result line, `boardWins` stays 0, no prize, no letter.
  4. The HUD still says "Beat Clay on the board" (the **last goal of the chain**), and it can never complete.
- **Cause:**
  - `rivalActive` is false with `rivalOff` (`rival.ts:20-21`), so `boardScoreLine` returns null (`:88`) and `settleSeason` returns null (`:157`).
  - Each win also adds +20 friendship with Clay (`rival.ts:169`), pushing a winner toward the cut-off.
  - The perk text says only "Clay stops taking requests" (`ui/panels/perkText.ts:16`).
- **Impact:** a friendly player who chats with and gifts Clay before ever winning a season ends the game on a goal that cannot be done, and the trophy stops counting without a word.
- **Fix:**
  - Keep settling seasons when Clay is "off" (he can still keep score without taking rows), or complete `board1` once he is off.
  - Make the 5-heart line say the race is over ("Clay retires from the board. The trophy stays.").

### F4 (Minor). The season result is still brief, and some texts say "filled" for takes that scored nothing

- **"Last season" line:** shown on summer 1 only when Clay has no target. It was seen on 1 of 3 days in F32b, 0 of 3 in A32b, 1 of 3 in the win and lose probes, and 2 of 3 in the draw probe.
  - Cause: `rivalNotice` returns the target first (`rival.ts:77-83`).
  - Fix: put "Last season: ..." on the score line's own row ("This season: you 0, Clay 0. Last: won 15-0.").
- **0-0 season:** says nothing at all (`rival.ts:159`, probe `season zero`).
- **Wording:**
  - The morning summary says "Clay filled 5 Trout on the board." for a no-point take, and the board says "Clay took one today." either way.
  - Mara's win letter says "You filled more requests than Clay last season, 15 to 0!", while Clay took 13 requests that season (F32b). It should say "scored".

### F5 (Minor). "Ship all produce" feeds the special into the bin

- **Code:**
  - `BinPanel.ts:124` passes only `boardWants` (requests) to `shipAllProduce`. A special such as "15 Potato for Rosa" (2,250g) is never kept back.
  - The hurried player's one tap ships the special's crop every morning.
  - The special's own Give, by contrast, keeps back for requests.
- In F32 the special read "Special 0/15" on all 52 board looks. That run had too few potatoes to finish anyway, so this is from code, not a lost special in play.
- **Fix:** keep back the special's open quantity as well (lowest priority after requests), or offer "Keep 7 for the special?".

### F6 (Minor). Small text, number and layout slips in the changed panels

- **Stakes:**
  - `BOARD_STAKES` and Clay's intro letter always say "300g" (`rival.ts:147`, `mail.json:169`), but year 2 pays 600g (`BOARD_PRIZE * year`, `rival.ts:165`).
  - The intro says "jams I take are my points", but wild-berry jam is not a point (`isFarmGood`, `rival.ts:47-52`).
- **Bin toast:** "Kept 7 goods for the board." names nothing once three kinds are kept (`binText.ts:14`).
- **Cart:**
  - A tagged row drops "N left" (`cartText.ts:11`). After buying 3 you cannot tell 2 remain until "Sold out".
  - With a greenhouse, fall 19 offered "Strawberry Seeds 200g  **Spring crop**", which reads as unusable (`cart.ts:41-42` uses `seasons[0]`). It should say "Greenhouse".
- **Board truncation** at 390 px (shot `s10-board-festival-target`):
  - A 4-digit reward cuts the sub line to "Have 3/3 1,045g last ..", losing "last day".
  - The special's title loses its giver: "15 Cauliflower for Ro..".
  - Real rewards reach 4 digits ("3 Cauliflower 1,000g" in A32).
- **Goals:** "Craft something at the workbench" and the cook goal's "cook at the workbench".

### F7 (Minor, balance). Year one is extremely sensitive to early gold; the fisher's +44% to +58% is mostly that

- **My sim (`simx10.test.ts`, the same keeper-farmer bot, `tmp/simx10.out`):**

  | Seed | Farmer y1 | Fisher | +500g on day 7 | +1,000g on day 14 | +2,000g on day 14 |
  | --- | --- | --- | --- | --- | --- |
  | 42 | 243,456 | +58% | +17% | +30% | +27% |
  | 7 | 241,857 | +57% | +19% | +35% | +43% |
  | 99 | 257,596 | +44% | +22% | +17% | +33% |

- So DECISIONS.md is right that fish prices are not the cause (the fisher has 2.5 to 3.8k earned by day 14).
- But a single 500g gift in week one is worth about a fifth of the year to a tireless bot, and the response is not even monotonic (seed 42: +1,000g gives +30%, +2,000g gives +27%).
- The driver is earlier land (first plot on day 12 to 18 instead of 23 to 26). Because the bot has no time limit, land is its only bottleneck.
- **Impact:**
  - The pinned five-seed median (249,871) and the band say less than they appear to.
  - Any early reward (the special's 2,250g, the first board prize, jobs) swings the year by tens of percent for a land-bound player.
  - It is probably milder for a human, who is time-bound (the human-paced median is 189,883).
- **Fix:** check land and early prices against the human-paced sim rather than the tireless one, and consider a gentler curve on the first plots.

### Not a bug (positives)

- **The score is finally always there.** "This season: you N, Clay M." was on 100 of 100 board mornings from day 8 across four 32-day runs, on its own line, and it never clipped (shots `s10-board-*`, at tallies 12 to 14 and with two targets).
- **Keep-back is right in every edge I tried:**
  - lowest quality first (2 plain + 1 gold potato kept for "3 Potato", 2 gold shipped);
  - the right preserve (2 Strawberry Jam kept, Blackberry Jam shipped);
  - nothing kept for a row Clay already took;
  - "+" warns only when the bag drops below the request.
- **The special's keep (F3) and the stable batch slot (F4)** behave exactly as intended.
- **Settlement:**
  - Win: "You beat Clay on the board last season (6 to 4): +300g.", Mara's letter, the trophy toast "Board Trophy: seasons won on the board, 2." after two wins and after a reload.
  - Loss: Clay's letter names the stakes.
  - Draw: said.
- **Eating limits are clear and correct:**
  - The Eat button reads "Eat +80", "+80", "+80", then "Eat +40" ("Restores 40 now: dish 4 today."), then "+20".
  - The toast says "(dish 4 today)". Hotbar eating with Space gives the same.
  - A dish at 1:30 AM counts as the same day (dish 7, +8). A 2 AM pass-out resets the count.
- **The statue grows:** `obj_landmark_statue_1` .. `_6` by level, `_6` from level 6 on, and the redraw is wired to `placedChanged` in `tryFinish` (shots `e10-statue-full-lv1..6`).
- **The trophy** has art and sits clear of the bed and the door (shot `e10-trophy-in-house`).
- **Stability:** 0 errors in about 130 game days; no stall.

---

## 3. The days played

| Run | Day 14 earned | Day 28 earned | Day 32 earned | Board (spring) | Notes |
| --- | --- | --- | --- | --- | --- |
| **F32b** (Ship all, hurried, keeps) | 4,069 | 16,423 | 17,174 | **won 15 to 0** | 15 "Kept ..." toasts, all unseen (F1); 15 fills; summer board all fish and wild |
| **A32b** (row All, careless) | 2,891 | 11,933 | 12,099 | **lost 4 to 7** | lost 7 crop rows to Clay; Clay's letter |
| F32 (fault: no planting after day 2) | 3,893 | 6,335 | 6,683 | won 5 to 0 | invalid economy |
| A32 (fault: no planting after day 2) | 3,237 | 7,626 | 8,018 | won 3 to 1 | invalid economy |

Critique 9's racers (which fished and foraged for jobs) earned 6,374 to 8,218 by day 14 and 14,075 to 14,933 by day 28. F32b's pure farmer lands close on day 28 without fish.

- **Is the race worth running now?**
  - It is visible, honest about its stakes, and fair in the sense that a farmer *can* win.
  - But a player who taps the default button wins it without trying. A player who uses All loses it without seeing why (F1, F2).
- **Is the early board alive for a farmer?**
  - Spring, yes: a crop row on most days.
  - Summer 1 to 4: no, all fish and wild.
- **Is a 5-minute session rewarding?** Yes, as in critique 9. The new noise is the daily "Clay wants this one" on rows that do not matter.

## 4. One-thumb reach

- **Unchanged and fine:**
  - Close or Done is at logical y 380 to 383 on every sheet.
  - "Ship all produce" is bottom right (x 104-188, y 351).
  - The board Give buttons are at x 172 to 178.
  - Cart Buy is at x 170.
- **Nothing moved under the thumb after a tap** in the board (rows keep their place when filled or taken), bin, cart, special or Make tab (`x1` stays at x 180).
- **Make tab columns:**
  - The outermost button means **Make** on workbench rows (x 173) but **batch** on kitchen rows (x 180, Make at x 146), shot `s10-make`.
  - A thumb that learns "right-most = make" batch-cooks on a dish row. That is harmless now, but inconsistent.
  - Suggest the same column order on every row (batch slot or a blank on all rows).
- **The Eat button** is at the top right of the bag area (x 110-192, about logical y 255). It is reachable, but it sits higher than any other primary action.

## 5. Progression and economy

**Sim (`tests/sim.test.ts`, `tmp/sim.out`):**
- **Tireless bot, five seeds:** 234,833 / 241,295 / 249,871 / 267,119 / 264,481 (**median 249,871**, equal to the pin).
- **Human-paced bot:** median **189,883** (critique 9: 184,919).
- **Board income:** 12,787g of 234,833 (5%). Requests posted 132; Clay took 70.
- **Two years:** 8 projects by year-2 spring and statue level 6 by year-3 spring, with 1.10M earned against 826k sunk. Gold sits at about 33k from year-2 summer on. The same healthy shape as before.
- **Board race (two years, three seeds):**
  - keeper: 23 wins and 1 draw of 24;
  - shipper: 13 wins of 24;
  - fisher-keeper: 24 of 24.

**Runaway or dead:**
- **Runaway:** none in the yearly totals. But see F7: the early compounding means small early rewards have a large effect.
- **Near dead:**
  - Clay as an opponent for a keeper (F2);
  - his "later" and "polite" perks, which change only who gets rows that rarely score;
  - the 300g prize as gold, although the trophy now gives it meaning;
  - the statue after level 6 (the sprite stops at `_6`; only the toast's number grows).
- **Cooking:** now capped softly and clearly. Ten dishes give five dishes' worth. It is no longer a way to make a day endless.

## 6. Top 3 things to add next

1. **Put toasts above sheets** (or give sheets a status line) so keep-back, "The board wants", "Order done" and "Bought" are seen when they happen (F1).
2. **Make Clay's day matter again.**
   - He takes the best *farm* row on its last day.
   - The board never marks a no-point row as his.
   - Optionally he scores a little on his own, so keeping goods is necessary but not sufficient (F2).
   - Keep scoring after he turns friendly, and do not strand the last goal (F3).
3. **Give the farmer more of the board in summer and later.** Crop rows for summer crops he is growing, and a special he can see coming in Ship all (F5). Alongside that, the long-press hotbar picker, so seeds in the bag do not stop a one-thumb farmer planting (seen again in F32 and A32).

## 7. Verdict

**Stable, honest and readable, with one Major usability bug and no blocker.**
- **Checks:** 700 tests and tsc pass. 0 errors in about 130 played days. No stall.
- **Critique-9 findings:**
  - F3, F4, F5 and F7 are fixed through real input.
  - F1 is fixed as specified: score every day, farm-only scoring, stakes said, draw said, a trophy.
  - F2's rules are fixed.
  - F6 is mostly fixed; F8 is partly fixed.

**The main weakness has moved again:**
- It is no longer that a farmer cannot win. A farmer who taps "Ship all produce" wins 15 to 0 against a Clay whose daily target scores nothing.
- A farmer who uses the row buttons loses 4 to 7, because the warnings meant to stop him are drawn under the bin sheet.
- The scoreboard is now visible and fair. What it lacks is an opponent who plays to win, and feedback the player can actually see.

## Screenshots (`critique-10/shots-10/`)

| Group | Files |
| --- | --- |
| Hidden toasts (F1) | `e10-keep-toast-under-sheet`, `e10-keep-toast-after-close`, `e10-keep-bin-before`, `e10-keep-bin-after`, `e10-keep-bin-all-warn`, `s10-bin-wanted`, `s10-bin-after-shipall` |
| Clay's targets and takes (F2) | `e10-score-day7`, `e10-score-day8`, `e10-score-target-fish`, `e10-score-nopoint-take`, `e10-score-y2-two-targets`, `e10-score-y2-two-taken`, `e10-score-y2-mixed`, `e10-keep-board-4pm-lastday` |
| Clay at 5 hearts (F3) | `e10-off-board` |
| Season endings (F4) | `e10-season-{win,lose,draw,zero}-board-summer1..4`, `-mail-list`, `-letter` |
| Special | `e10-special-part-way`, `e10-special-lastday-partway` |
| Trophy and statue | `e10-trophy-after-win1`, `-win2`, `-after-reload`, `e10-trophy-in-house`, `F32b-trophy-house`, `A32b-trophy-house` (no trophy after the loss), `e10-statue-full-lv1..6`, `e10-statue-page` |
| Kitchen and eating | `e10-make-tab`, `e10-make-tab-after`, `s10-make`, `e10-eat-dish4-card`, `s10-bag-dish4`, `s10-bag-dish6` |
| Cart | `e10-cart-spring-5`, `-summer-12`, `-fall-19` ("Spring crop" with a greenhouse), `-winter-26`, `-spring-26`, `s10-cart` |
| Sweep (tall boards, letters) | `s10-board-cart-target`, `-festival-target` (truncation), `-y2-two-targets-lastseason`, `-cart-3pm-took`, `-lastseason-lost`, `-cart-y2`, `s10-mail-list`, `s10-mail-letter-0..2` |
| New game | `01-day1-farm-planted`, `02`..`04-summary-day*` (from the last run to finish) |
