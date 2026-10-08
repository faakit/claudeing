# Tiny Acre: independent critique 4

Reviewer: independent QA lead and game critic, round 4.

Frozen build: commit `22fc304`, copied to `critique-4/farm-game`. The copy is not a git checkout, so I could not confirm the hash myself. Dev server on port 5177.

Method:
- Headless Chromium (playwright-core, chromium-1217), 390x844, `hasTouch`, DPR 1.
- The `?debug` hook was used to set up state and read it back.
- No game file was edited. Probe scripts live in `critique-4/probes/`, screenshots in `shots-4/`.

## What I verified by playing, and what I did not

Played with real input. I used keyboard walk, Space and E, and real taps and clicks on canvas buttons, which I found by walking the UI scene's Button objects.

- **A 14-day "new player" run** (`probes/play.mjs`, about 35 real minutes, 0 page errors). Each day the bot:
  - leaves the house on foot and tills, plants and waters the home plot tile by tile;
  - forages on three maps and cuts weeds when a job asks;
  - fishes with a bot that reads the reel and taps or holds on the sheet;
  - mines in the mine, ships through the bin's All buttons, buys seeds in the shop, reads the board, talks and gifts;
  - sleeps through the bed sheet and reads the morning summary.
- **Town projects, all six funded through the real buttons.** Path: board, "Town projects", "Open", "+100/+1,000/+10,000g", "Give goods". I also checked the landmarks in town, Interact on a landmark, the next morning's 4th request and the +30 energy, then Save, reload and Continue.
- **Home tab:** bought both Bigger Bag levels, the 40-slot bag grid, and every decoration kind.
  - Placed them with the real Action, picked them up with Interact, and checked the cap.
  - Ran the decor10 goal loop, and checked the armed pick-up across a sleep and a reload.
- **Jobs:**
  - the ship/unship loop through the real bin buttons;
  - gifting a stone for the gift job;
  - Menu > Goal for all 47 goal indexes with 3 jobs listed (no overlap found);
  - jobs and partial projects across a Save now, reload and Continue.
- **Conveniences:**
  - welcome toast across 5 map changes;
  - gift memory over two days;
  - a seed row with a level-2 hoe;
  - jar "All" with three jars.
- **Re-checks:**
  - Flower Show entry with a plain daffodil;
  - day-1 land signs and day-2 farm forage;
  - a busy-morning summary;
  - a truncation sweep of shop (4 tabs), bin, board, projects, keg/loom/furnace, 4 villagers plus gift lists, and all Menu tabs.
- `npx vitest run`: 44 files, **363 tests pass**.

Caveats on the 14-day run:
- It is a bot, not a human. It moves between spots by teleport, so its in-game clock is about 1.5 game hours ahead of a walking player. My estimate from tile counts at 2.2 tiles per game minute is 100 game minutes of walking for farm, town, woods, mine and back.
- All actions and panel taps are real input. When the bot reached town before 8:00, I moved the clock to 8:00 to stand in for the walk and the wait for opening hours. That shortcut also left Mara and Orin "absent" on some days, which is a bot artefact. Because of it, two "greet villagers" failures and two "give a gift" failures (Rosa's sheet showed a heart event with "Next") are the bot's fault, not the game's.
- The bot ships everything except seeds, materials and cauliflower. It kept cauliflower by accident, and that is the only reason it filled one board order.

Verified only by reading code or data:
- the payback of the project perks;
- that weeds can spawn under placed objects;
- that the shop has no per-kind cap.

Not verified at all:
- a real phone, touch feel, haptics, audio, frame rate;
- `npm run e2e`, `e2e:mobile`, `perf`, the left-handed layout;
- critique 3's F5 (slow-swipe edge case). I did not re-test it.

---

## 1. Critique 3 findings re-checked

| C3 item | Result | How I know |
| --- | --- | --- |
| F1 machines cannot be picked up | **Fixed.** Jar, keg, loom and furnace sheets have a "Pick up" button when empty. | Played (shots `45`, `65`). |
| F2 pacing, days 2 to 14 | **Better, not solved.** See section 3. Jobs give days 2 to 4 a purpose (fish on day 2, mine on day 3). But the bot's chores still end between 8:12 and 9:11 AM every day; a walking player ends around 10 to 11 AM. A third of the jobs posted could not be done (F3 below). | Played, 14 days. |
| F3 x5 on dear rows | **Fixed.** No x5 on the 450g lamp and up, or on animals. | Played (shot `30`). |
| F4 text overflow | **Mostly fixed.** The goal tab is clean for all 47 goals, and the project, Home tab, board, NPC and gift sheets have no truncation. Still cut: bin `Cauliflower Pi..`, `Si. Wild Berry ..`, `Au. Wild Sunflo..`; keg `> Gold Melon Wine..`; craft `2 Sprinkler, 10 Fiber, ..`; shop Fiber row `For crafting (o..`. A new overflow: the busy morning summary (F6). | Sweep (`probes/sweep.mjs`), shots `64`, `65`, `67`, `74`. |
| F6 Flower Show | **Fixed.** Rivals 24, 31, 43. A plain daffodil places 3rd (+200g), a silver one 2nd. | Played (shots `72`, `73`). |
| F7 welcome toast replays | **Fixed.** 0 replays over 5 map changes. | Played. |
| F8 forage visibility | **Unchanged.** Still a small icon with no sparkle. The farm gets 1 forage a day, often at the far south edge (day 2: wild leek at 18,39, 30 tiles from the door). | Shot `71`. |
| F9 land signs on day 1 | **Unchanged.** 2,200g and 2,600g signs still flank the front door on day 1. | Shot `70`. |
| F10 blind gifts | **Partly fixed.** Reactions are remembered, but the list is led by seeds, stone and fiber (F12). | Played (shots `42`, `43`). |
| F11 hotbar/bag swapping | **Open and worse.** The Home tab adds 7 decoration kinds that all overflow into the bag (F8). | Played. |

---

## 2. Ranked findings

### F1 (Major). Every max-energy perk is lost on reload, including the Hot Spring's +30

- **Repro (played):**
  - Skills with energy perks (farming and foraging levels): the morning energy was 125.
  - Menu > Opts > "Save now" (it says "Saved!"), reload, Continue: energy is **100**.
  - Same with the Hot Spring finished: 130 the next morning, 100 after a reload.
- **Cause:** `src/systems/save.ts:319` computes `maxEnergy = game.baseEnergy + upgrades.stamina * game.energyPerUpgrade` with no perks. `save.ts:507` then clamps `energy` to that value on every load. The game's own `maxEnergy()` (`systems/energy.ts:6`) adds `perk(state, 'maxEnergy')`.
- **Impact:**
  - The fourth town project (15,000g, 60 stone, 5 iron bars) sells "+30 max energy every day".
  - A one-thumb, five-minute-session game is reopened often, and every time the app is reopened mid-day that +30 (plus up to +45 from skills) is gone until the next sleep.
  - The skill half of the bug is older than this round; the Hot Spring makes it worth 30 more.
- **Fix:** clamp with the same formula as `maxEnergy()`. Perks are derived from state, so compute the cap after the rest of the state is sanitised, or clamp to a generous bound and let the first frame re-clamp. Add a migration test that saves at 130 and loads 130.

### F2 (Major). The shop sells decorations you can never place: a second 12,000g Fountain is dead money

- **Repro (played, real taps):**
  - Home tab, page 2: tap "12,000g" on Fountain twice. Both buys succeed ("Bought 1 Fountain" twice, 24,000g gone).
  - Place one. The second refuses: "You can only have 1 of these." (shot `37`).
  - It cannot be shipped: the bin's list leaves it out, because `isShippable` refuses placeables (`economy.ts:28-31`). It cannot be gifted.
  - Its bag sheet still says **"Sells for 3,000g"** and "Costs 12000g in town" (shot `36`).
  - The same applies to a 3rd Farm Statue (5,000g), a 61st fence or an 81st path.
- **Cause:**
  - The cap (`params.max`) is checked only when placing (`mechanics/farmingActions.ts:145-150`).
  - `buyItem` (`systems/economy.ts:78-90`) has no cap.
  - The shop row says "Decor max 1" but never "you have 1".
- **Impact:** the most expensive decoration is the easiest to buy twice by accident (one tap, no confirm). The money is unrecoverable, and the game tells you a sell price that does not exist.
- **Fix:**
  - Disable the buy button when owned plus placed reaches `max`, and show "1/1" on the row.
  - Let the bin take placeables at their `sellPrice`, or drop "Sells for" on items that cannot be sold.
  - Format "Costs 12,000g" with `fmt`.

### F3 (Major). A third of the daily jobs cannot be done; some are impossible by construction

- **Evidence (14-day run):** 39 jobs posted (3 a day from day 2), 24 to 26 finished, 13 left open at bedtime.

| Job | Posted | Failed | Why |
| --- | --- | --- | --- |
| "Mara: fill 1 board request" | 6 | 5 | The day-4 intro job and its repeats meet boards that ask for 3 to 6 of one item ("6 Mushroom", "5 Daffodil"), a crop that is days from ripe ("1 Cauliflower" on day 4), or pickles. |
| "Rosa: cut N weeds" | 3 | 2 | **No weeds existed.** |
| "ship N goods" | 4 | 3 | A random 6 to 15 regardless of what is ripe. |
| "harvest N crops" | 1 | 1 | Posted on a day with 3 ripe crops. |

- **Causes:**
  - Weeds only spawn on owned, untilled tiles (`mechanics/dayCore.ts:68-71`). Once the 32-tile home plot is fully tilled (day 5 in my run), the farm has 0 weeds for good: 0 weeds on day 15 and `cleared` stuck at 5. The weeds job has no `requires` (`data/jobs.json`), so it keeps being posted. The morning tip "Weeds sprout in the field. Cut them with the scythe for fiber" is false for the same player.
  - The board posts pickles as soon as the jar **recipe** is unlocked, not when the player owns a jar (`systems/orders.ts:24-31`). From day 6 my board asked for "Wild Leek Pickles", "Potato Pickles" and "Mushroom Pickles" with no jar on the farm.
  - The goal chain asks for an order (goal #10) before crafting (#11) or a jar (#12, #13). The bot sat on goal #10 "Fill an order" from day 5 to day 12.
- **Impact:** jobs are the fix for critique 3's F2. A job that cannot be done is worse than no job: the summary sends the player looking for weeds that do not exist. The day-4 intro job meant to point at the board fails for most players.
- **Fix:**
  - Give `generateJobs` a feasibility check per job: weeds exist; the board has a request the player holds at least one of; ship and harvest `n` are capped by what is ripe or held.
  - Orders should ask for preserves only once a jar or keg is placed.
  - Swap goals #10 and #11 to #13, or make the day-4 job "look at the board".

### F4 (Medium). Exploits: free money from the ship job, the decor goal and the gift job

All three played:

1. **Ship/unship.**
   - With "Mara: ship 15 goods (+55g)" open: bin, "All" on 15 parsnips. "Job done! +55g" pays at once.
   - Then "-" fifteen times. All 15 parsnips are back, the bin is empty, the job stays done and the 55g stays (shot `50`).
   - Cause: `shipStack` fires the stat watcher and the job pays immediately (`systems/jobs.ts:68-80`). `unshipStack` lowers `stats.shipped` directly (`systems/economy.ts:47-53`) and nothing claws the reward back.
2. **decor10 goal for 10g.**
   - One 10g stone path: place it, Interact, Interact, ten times.
   - Result: `decorPlaced` +10, "Goal complete +300g".
   - Cause: `farmingActions.ts:163` counts every placement, including the same object re-placed.
3. **Gift job with a stone.** Rosa takes a Stone ("Oh. Thank you."): +35g and +30 friendship (15 neutral gift plus 15 job). The job never needs a real present.

Impact: small numbers (55g a day, 300g once), but they teach the player that the systems are paper. Fixes:
- Pay ship jobs at the morning payout, or claw back on unship.
- Count `decorPlaced` per object id (first placement only), or count decorations standing at the end of the day.
- Gift jobs should need a liked item, or say "a gift Rosa likes".

### F5 (Medium). Finn stands in the middle of the town pond from 12:00 to 15:00

- **Repro (played):** set 13:00, go to town. Finn stands at 20,26 with his "!" marker, three tiles into the water. All four neighbours are blocked (21,26 / 19,26 / 20,27 / 20,25). He cannot be talked to or gifted (shot `40`).
- **Cause:** `data/npcs.json:183` puts Finn's midday town spot at `tx 20, ty 26`, which is water (ground gid 5).
- **Impact:** older data, but it now matters. "greet N villagers" and gift jobs come up daily, and the "!" invites a chat the player can never have for three hours.
- **Fix:** move the spot to the riverbank (for example 16,26, inside the riverbank zone). Add a data test that every schedule spot is walkable and has a walkable neighbour.

### F6 (Medium). A busy morning summary runs under the Wake up button and hides tomorrow's forecast

- **Repro (played):** 9 kinds shipped, Flower Show morning, 3 jobs, and a project you could finish (shot `74`).
  - The sheet shows 6 sold rows, "...and 3 more", and 7 notes.
  - "You could finish the Board Canopy today..." is cut by the Wake up button. "Now: Spring 14. Gold: 6,801" peeks out below it.
  - Today's weather and **"Tomorrow: ..."** are off screen.
- **Cause:** `Modal.setHeight` caps the sheet at `GAME_HEIGHT - 60` (`ui/widgets.ts:234-236`). `SummaryPanel.build` drops only the tip when content is too tall (`ui/panels/SummaryPanels.ts:68-77`); the notes list is unbounded.
- **Impact:** the forecast is the storm warning (pick fruit first). It disappears exactly on festival and job-heavy mornings. Three wasted lines ("Wild goods are growing...", "Fresh ore...", "New requests...") are printed every morning.
- **Fix:**
  - Put weather and forecast before the notes.
  - Fold the three standing notes into one line, or drop them first.
  - Cap jobs at one line each and paginate or scroll the rest.

### F7 (Medium, design). Late town projects pay almost nothing, and the 103k payoff is six identical huts

- **Perks against price (data):**

| Project | Price | Perk | Payback |
| --- | --- | --- | --- |
| Canopy | 1,200g + 20 fiber | +1 board request a day | Excellent; the best deal in the game. |
| Fish Ladder | 4,000g | +5% catch zone | Hardly noticeable. |
| Library | 8,000g | +15% XP | Fine. |
| Hot Spring | 15,000g | +30 energy | Good, but see F1. |
| Fair Hall | 25,000g + 5 cloth | +50% festival prizes | At most +1,700g a year if you win all four festivals (prizes 600/800/1,000/1,000). About **15 in-game years**. |
| Market Road | 50,000g + 10 iron bars + a ruby | +5% bin price | About **1,000,000g of shipping**. |

- **Visuals (played, shots `25`, `26`, `27`):**
  - Every landmark is the same one-tile placeholder hut in a different colour (`game/fallbackTexture.ts`).
  - The "Board Canopy" is a hut two tiles from the board, not a roof over it. The "Fish Ladder" is a hut on grass at 16,21, not in the river. "Market Road" is a yellow hut.
  - Interact on a landmark gives a toast ("Board Canopy: funded by you!"). Nothing changes in how the town works or looks beyond that.
- **Impact:** the "second act" ends with the player paying 75,000g for two percentages they will never feel. The money test ("needs over 100 days to pay back") is met, but by being uneconomic, not by being interesting.
- **Fix:** make the last projects unlock something. Examples:
  - a greenhouse (winter crops; the roadmap's R2.3);
  - a ferry or bridge to a new forage map;
  - a second shop with new seeds;
  - the fisher or rival villager from R3.2.

  Keep percentages for the cheap early ones. Draw at least the canopy over the board.

### F8 (Medium). Decorations make the hotbar/bag shuffle (C3 F11) worse

- **Played:**
  - Bought one of each decoration with 5 tools plus parsnip and potato seeds on the hotbar.
  - Fences took the last hotbar slot. **Stone path, pot, lamp, bench, statue and both fountains went to the bag** (slots 8 to 15).
  - "Place a decoration" is a hotbar action, so each kind needs Menu, tap item, tap slot, Close: about 4 taps per kind, about 24 taps to lay out one of each.
- **Also:** the decoration icons are near-identical grey and brown posts at hotbar size (shot `33`). The fence is a single post; lines of fences do not join (shot `34`).
- **Fix:**
  - Long-press a hotbar slot to pick from the bag (still the missing C3 item).
  - Or a "Place" button on the bag sheet that equips and closes in one tap.
  - Joining fence art.

### F9 (Minor). "Tap again to pick up" never expires

- **Repro (played):**
  - Interact once on a fence ("Wood Fence Tap again to pick up."). Walk away, sleep, Save, reload, Continue.
  - Next day, one Interact on that fence picks it up at once.
  - Two fences armed the same way stay armed side by side.
- **Cause:** the arm flag is stored on the object (`obj.data['armedPick']`, `systems/placeables.ts:110-117`). It is saved with the game and only cleared by touching that same object.
- **Impact:** contradicts the DECISIONS note ("a fence you walk past is never lost to a stray tap"). One tap a day later deletes a placed 12,000g fountain into the bag. It can be put back, but it is still surprising.
- **Fix:** keep the arm in runtime memory with an id and a timestamp (for example 3 s), never in `state`.

### F10 (Minor). Text and wording

- Truncations still left (see section 1, F4 row).
- Job grammar:
  - "Mara: load 1 machines", "Orin: craft 1 things" (`jobs.json` qty ranges start at 1).
  - "fill 1 board request" is fine; "load 1 machines" is not.
- Project page: the "+10,000g" button is enabled when 1,200g is left and gives 1,200g; the label never changes (`ProjectPanel.ts:116-121`). Show `+${fmt(amount)}g`.
- "Bigger Bag 1/3" before buying anything. It has two levels, so this reads as "you own one of three".
- "Earn 1,000g selling crops" (and the 5k, 20k goals) count job and order gold too.
- Bag sheet: "Costs 12000g in town" (no separator, `MenuPanel.ts:227`).

### F11 (Minor). Placement edges

- Decorations (and machines) can be placed on land you have not bought. I placed a fence in the North Meadow behind its 2,200g sign (shot `34`), while the hoe there says "Not your land yet". Cause: the `place` handler checks `farmland && tillable`, not `owned`.
- A fence placed on Rosa's farm spot (16,12) before 7:00: she appears standing on top of it (shot `75`).
- Weeds can spawn under placed objects. `spawnWeeds` checks tiles and weeds but not `state.placed` (`systems/farming.ts:143-146`). Code read only.
- `params.charm` on every decoration (1 to 60) is read by nothing; decorations have no effect at all. Fine if intended, but then drop the data or use it (for example a small daily friendship bonus from visitors).

### F12 (Minor). Gift memory works, but the list leads with junk

- After Rosa reacted "Oh. Thank you." (neutral) to a Daffodil, the next day's page 1 was Parsnip Seeds, Wild Leek, Parsnip, Stone, Fiber, all "Not tried yet". The known Daffodil sat on page 2 (shot `43`).
- Seeds, stone, fiber, bait and fertilizer are all giftable and fill page 1.
- **Fix:** sort known reactions first (love, like, neutral), then unknown goods. Push seeds, materials, bait and fertilizer to the end, or exclude them.

### Not a bug, but note (positive)

- **Project flow:**
  - Board, "Town projects", "Open" is clear.
  - Partial goods ("Fiber 12/20 (have 0)") and partial gold work and survive a reload.
  - The finish toast is clear, the list returns at once, and the landmark appears immediately and survives a reload.
  - The next morning had 4 requests and 130 energy.
  - The morning nudge "You could finish the Hot Spring today" fires correctly.
- **Bigger Bag:** both levels work (24 to 32 to 40 slots, cloth taken). The 40-slot grid sits at about y 480 to 680 of 844, still in thumb reach (shot `33`).
- **Seed row:** a level-2 hoe tills 3 tiles with one press, and one seed press sows the same 3 (shot `44`).
- **Jar "All":** loads 3 jars in one tap ("Loaded 3 machines.").
- **Menu > Goal:** lists today's jobs with progress and reward without overlap at any goal index.

---

## 3. The 14 days, day by day (bot, real input)

Clock is the in-game time when the bot's chores ended. It is about 1.5 hours early compared with walking (see caveats).

| Day | Wake gold | Jobs posted (gold) | Done | Chores end | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | 500 | none | - | 9:04 | 21 tiles tilled and planted; spent down to 10g on seeds |
| 2 | 40 | fish 2 (65), forage 2 (30), gift (35) | 3/3 | 8:49 | First jobs pay on day 2; goals 4 to 6 complete |
| 3 | 318 | mine 4 (42), weeds 2 (26), forage 3 (40) | 3/3 | 8:53 | First mine trip, pointed at by the job |
| 4 | 311 | **board request (50)**, forage 2, gift | 1/3 | 8:18 | Board asks 1 cauliflower, 4 daffodils, 3 leeks: impossible |
| 5 | 589 | mine 3, forage 3, greet 2 | 3/3 | 9:11 | First harvest (13 parsnips) |
| 6 | 713 | board request, mine 3, fish 2 | 2/3 | 8:22 | Board now asks for pickles; no jar exists |
| 7 | 891 | board request, forage 2, mine 5 | 2/3 | 8:34 | |
| 8 | 1,276 | greet 2, fish 1, gift | 2/3 | 8:19 | |
| 9 | 1,501 | **weeds 2**, ship 13, fish 2 | 1/3 | 8:21 | 0 weeds on the farm |
| 10 | 1,704 | mine 3, fish 2, ship 15 | 2/3 | 8:24 | |
| 11 | 1,943 | ship 10, harvest 7, board request | **0/3** | 8:12 | Nothing ripe; all three jobs fail |
| 12 | 1,728 | **weeds 2**, ship 6, board request | 2/3 | 8:38 | Filled "3 Cauliflower" for 1,055g (kept cauliflower by accident) |
| 13 | 3,151 | forage 2, greet 3, board request | 1/3 | 8:31 | |
| 14 | 3,314 | fish 3 (90), mine 3, greet 3 | 2/3 | 8:16 | Flower Show day; end gold 3,438 |

Totals for days 1 to 14:
- Earned: 6,568g.
  - Bin: 4,611g.
  - Jobs: 1,017g (about 15%).
  - One board order: 1,055g.
  - Goals: the rest.
- Days 2 to 4: jobs 268g against 463g of shipping, so jobs are about a third of early income. That is a meaningful early boost and irrelevant later, as designed.
- Critique 3's bot had 1,024g on day 15. This one has 3.4 times that. Most of the gap is better seed choice and the order, not jobs.

What the player has to do each day: water (about 50 game minutes for 32 tiles with a 20-water can), then one or two job errands (fishing 2 casts is about 5 game minutes; 4 rocks about 15 minutes plus the walk). Everything is done by about 10 to 11 AM for a walking player. The day then has 15 empty hours, about 7 real minutes, with nothing scheduled. In real time a day of work is 2 to 3 minutes. That suits short phone sessions, but the clock is pure decoration: nothing is better or worse at 4 PM than at 9 AM.

---

## 4. One-thumb reach

Played with touch taps at 390x844:
- **Project sheet:** the Give buttons sit at y about 655 to 735 CSS px, Back and Give goods at about 725, Close at 780. Good.
- **"+100g", "+1,000g", "+10,000g"** are 58x22 logical (113x43 CSS), 4 logical px apart. A slipped thumb gives 10x too much, but there is no way to over-give (the amount is capped), and gold given is not refundable. Acceptable.
- **Home tab:** the same rows as the other shop tabs; no x5 on dear rows. The tabs and the paging buttons are in reach.
- **Jobs live only in the morning summary and Menu > Goal.** Nothing in the HUD shows them during play, so the player must remember them or open the menu. The goal bar has room to alternate "Job: catch 2 fish 1/2".
- **Machine sheets:** "All" sits directly left of "Load" on every row. They are separate 32 and 44 px buttons, but on a two-keg farm a slip loads both. Mild.
- **The 40-slot bag** keeps the hotbar row at about 57% of screen height, which is reachable.
- **Touch targets:** sheet buttons are 22 logical px tall, which is 43 CSS px at 390 width and about 40 px on a 360-wide phone. That is borderline under 44, but it is the house style everywhere.

---

## 5. Progression and economy

- **Sinks now in data:**
  - Town projects 103,200g plus goods.
  - Decorations about 32,300g (Fountain 12,000; 2 Statues 10,000; 6 benches 3,600; 8 lamps 3,600; 12 pots 1,440; 60 fences 900; 80 paths 800).
  - Bigger Bag 7,500g.
  - The 69,000g already counted in critique 3.

  That is about 210,000g in all, enough for a first year that passes 100k. C3's "nothing to buy after 50k" is fixed on paper.
- **Value of those sinks:**
  - Decorations do nothing (F11).
  - Two of the last three projects are near-worthless percentages (F7).
  - The best buys are the cheap ones: Canopy (1,200g, +1 order a day, each order 150 to 1,200g) and the Bigger Bag.
  - The order is backwards: the money ends on purchases with no gameplay effect.
- **Jobs:**
  - 20 to 120g, +25% a year.
  - 78g a day on average in the run.
  - Strong only on days 2 to 4, invisible against orders (one order paid as much as all 24 jobs).
  - That is fine for "pointers, not chores", but then the pointers must be doable (F3).
- **Money exploits:** none large. Ship/unship (about 50g a day), decor10 (300g once), stone gifts (35g a day) (F4).
- **Board orders dominate early income.** "3 Cauliflower 1,055g", "3 Cauliflower Pickles 1,195g", "1 Melon Wine 755g". A day-12 order was worth 23% of two weeks' income. With the Canopy's 4th slot this grows. Watch it.

---

## 6. Top 3 features to add next

1. **Make jobs and orders honest.** Add feasibility checks to `generateJobs` (weeds exist, something ripe, the player holds part of a board request). Orders should ask for preserves only once a machine is placed. Reorder goals 10 to 13. This is cheap and turns the new layer from noise into guidance (F3, F4).
2. **Replace the late-project percentages with unlocks.** Greenhouse (a crop in winter), a new map, a new villager or shop. Draw the canopy over the board. This gives the 100k goals and the last 75k of projects a reason to exist (F7).
3. **Finish the one-thumb loop: a quick bag-to-hotbar swap.** Long-press a hotbar slot to open a bag picker, or a "Use" button on the bag sheet. This is C3's F11, and decorations now make it hurt more (F8). Also add a job chip on the HUD so today's jobs are visible without the menu.

---

## 7. Verdict

The new content is stable:
- 0 page errors over a 14-day real-input run and about 15 probe sessions.
- 363 tests pass.
- Projects, the Bigger Bag, decorations, gift memory, the seed row and jar "All" all work through the real buttons.
- The critique 3 fixes held: Pick up, no x5, Flower Show, toasts, the goal tab.

The two Majors are a save bug that quietly deletes the Hot Spring's reward (F1) and a shop that sells a second 12,000g fountain into the void (F2). The design problem is that the layer meant to fill days 2 to 14 posts impossible tasks a third of the time (F3), while the big late-game sink ends in percentages nobody will feel (F7). Fix F1 to F3 before adding more content. They are small code changes with outsized effect on trust.

Screenshots (`agents/critiques/shots-4/`, 43 files):

| Group | Files |
| --- | --- |
| 14-day run | `01-day1-farm-planted`, `02`/`03`/`04-summary-day2..4` |
| Projects | `20-board-town-projects-button`, `21-projects-list-first`, `22-project-canopy-detail`, `23-project-canopy-gold-in-goods-short`, `24-projects-list-after-canopy`, `25-projects-list-all-done`, `26-town-landmarks`, `27-town-landmarks-after-reload` |
| Home tab and decor | `30-shop-home-tab`, `31-shop-home-tab-p2`, `32-shop-home-bag-maxed`, `33-menu-bag-40-slots`, `34-farm-decor-placed`, `35-fence-tap-again`, `36-bag-fountain-sells-for`, `37-fountain-second-refused` |
| Conveniences | `40-finn-in-the-town-pond`, `41-npc-rosa-sheet`, `42-gift-list-before`, `43-gift-list-remembers`, `44-seed-row`, `45-jar-panel-all` |
| Jobs | `50-bin-ship-job-paid`, `51-menu-goal-jobs` |
| Sweep | `60-shop-upgrades`, `61-shop-seeds-summer`, `62-board-4-rows-festival`, `63-project-fishladder-detail`, `64-bin-rich`, `65-keg-all-button`, `66-gift-list-orin`, `67-craft-tab`, `68-book-tab` |
| Re-checks | `70-day1-front-door-signs`, `71-forage-on-farm-day2`, `72-flower-show-entry`, `73-flower-show-result`, `74-busy-morning-summary`, `75-rosa-on-a-fence` |
