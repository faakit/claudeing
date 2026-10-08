# Tiny Acre: independent critique 5 (PARTIAL, STOPPED EARLY)

Reviewer: independent QA lead and game critic, round 5.

**Status: partial, stopped early.** The session was wound up by the coordinating agent about a third of the way through.
The 14-day play run was stopped on day 5, and several planned probes never ran (see "Not verified"). The findings
below come from what was played or read before the stop. Treat the list as incomplete, not as a clean bill of health
for anything it does not mention.

Frozen build: commit `64eeb10`, copied to `critique-5/farm-game`. The copy is not a git checkout, so I could not confirm the hash myself.

Method:
- Headless Chromium (playwright-core, chromium-1217), 390x844, `hasTouch`.
- The `?debug` hook was used to set up state and read it back.
- No game file was edited. Probe scripts are in `critique-5/farm-game/agents/out/c5/`, screenshots in `shots-5/`.
- **Port:** 5177 was already held by another agent's `vite preview` (the audio-critique round-2 build). I did not stop it. I ran this build's dev server on **5187** instead, and have since stopped it.

## What I verified by playing, and what I did not

Played with real input (keyboard walk, Space, E, and real taps on canvas buttons):
- **New game, days 1 to 5** (`play.mjs`, the critique-4 bot plus a mailbox reader).
  - Mail on days 2, 3 and 4: Welcome (3 potato seeds), first fish (5 bait), first ore (2 copper ore). Each was read, and its gift taken with the real "Take gift" button.
  - Jobs on days 2 to 5: 12 of 12 done.
  - One board order filled on day 4.
  - Earned 1,007g by the end of day 5.
  - The run was stopped on day 5, before Clay starts on day 8.
- **Greenhouse** (`gh.mjs`).
  - Funded in Winter through Board, "Town projects", "Open", then +10,000g twice and "Give goods".
  - The shop then sold every season's seeds.
  - Tilled, planted and watered melons under glass with real Action. Outside the glass they were refused: "Won't grow in winter".
- **Fishing Derby** (`derby.mjs`): 5 real casts at the farm pond on Summer 22, then "Hand in my catches" at the board.
- **Baskets** (`basket.mjs`): built a Harvest Fair basket and a Winter Feast basket with Add/Out, and presented the Fair basket.
- **Moving a coop and a silo** (`coop.mjs`, `silo.mjs`).
  - Picked up a coop with 3 hens using E presses.
  - Menu > Opts > Save now, reload, Continue: the coop was still in the bag and its hens were still parked in `stored`.
  - Placed it elsewhere with Action and the hens came back.
  - Filled a silo, picked it up while stocked, and placed it back.
  - Slept two nights through the real bed with a coop, a barn and a sty fed only by the silo.
- `npx vitest run`: 51 files, **418 tests pass**. I also ran `tests/sim.test.ts` with its log printed.
- 0 page errors in every session.

Verified only by reading code or data:
- the rival's lazy resolution and the daily order reset;
- greenhouse regrowth economics;
- the Book pages;
- that pick-up arming is runtime-only with a 4-second window (`placeables.ts:107-139`).

**Not verified at all** (the stop came first):
- 10+ days of play. Clay taking a request in real play, his heart perks, his letter on day 7.
- Mail with a full bag. The Seed Exchange, rare seeds, and paging through the Book.
- Land-sign visibility and the forage ring.
- The critique-4 fixes: energy after reload, the decor cap, the exploits, the busy summary, "Use now", arm expiry in play.
- A screenshot sweep of every new panel for clipping, and one-thumb reach.
- A real phone, audio and performance.

---

## 1. Critique 4 findings re-checked

Not done. The stop came before the re-check probes. The only critique-4 item I observed was F3 (jobs), and only for days 2 to 5: every job posted could be done, and all 12 were.

---

## 2. Ranked findings

### F1 (Medium, design). Clay the rival is close to toothless by construction

- **Cause (code read):**
  - The board is regenerated on the first look of every day (`systems/orders.ts:84-89`, `ensureOrders`).
  - Clay acts only when the board is opened or an order is delivered after 2 PM (`systems/rival.ts:33-48`).
- **Effect:**
  - A request you cannot fill today is gone tomorrow anyway.
  - A request you can fill, you fill in the morning when you visit town.
  - So Clay only takes requests that you would have filled between 2 PM and bed. For a player whose chores end mid-morning, that is almost nothing.
  - In the balance sim, the bot delivers at 6 AM, so Clay never affects it either.
- **Wording mismatch (data):** the 2-heart perk says he comes at 5 PM ("Clay takes one at 5:00 PM", `rivalLate: 180`). But his schedule takes him away from town at 3 PM (`npcs.json`, clay schedule `from: 900`).
- **Not played:** my run stopped on day 5.
- **Impact:** the headline "race for the board" is decoration. The day-7 letter promises competition that rarely costs the player anything.
- **Fix:**
  - Let requests last two or three days. Clay then takes the best open one each afternoon, which makes a real race for multi-day goods.
  - Or have him act in the morning on dearer requests.
  - Align his schedule with `rivalMinute`.

### F2 (Medium). Baskets: "three different goods" can be one crop three times; the variety bonus barely exists

All played (shots `44` to `49`).

- **Harvest Fair:**
  - Pumpkin, Silver Pumpkin and Gold Pumpkin count as three different goods.
  - That basket scores 1,238 and takes **1st place** over Clay's 979.
  - Cause: `enterBasket` checks that `keyOf` values are distinct, and `keyOf` includes quality (`systems/festivals.ts:115`).
- **The variety bonus is weaker than documented:**
  - Kinds are counted by family or type (`festivals.ts:47`).
  - Every crop is `veg` or `fruit`, so a Harvest Fair basket can earn **+15% at most**. DECISIONS says "three different kinds score 30% more".
- **Winter Feast:**
  - Jam, pickles and wine are all type `preserve` with no family, so they count as one kind. Wine + jam + pickles scored exactly their sum (1,846), with no bonus.
  - A single Gold Melon Wine (897) beats Clay's 618 on its own.
- **The sheet never explains what counts as a different kind.** Swapping one item changed the score from 1,238 to 1,579 with no reason shown.
- **Fix:**
  - Make "different" mean a different `item`.
  - Give the families real variety: flowers or forage at the Fair; jam, pickles, wine and animal goods as separate kinds at the Feast.
  - Show "2 kinds +15%" in the basket line.

### F3 (Medium). Mashing Interact lifts a whole coop (hens and all); two taps lift a stocked silo

- **Repro (played, shot `51`):** E pressed four times, 450 ms apart, on a coop with 3 hens and eggs waiting.
  1. "+3 Egg Fed!"
  2. "You gave them a pat"
  3. "All fed. Happy! Tap again to pick up."
  4. **The coop is in the bag.**
- **Hungry coop (code read):** a coop that is hungry with no feed in the bag answers "Needs 3 Chicken Feed.". That is an armable message, so the **second** tap picks it up. This is the case where a confused player taps again.
- **Silo (played):** with no feed in the bag it says "Silo 30/300 feed. Bring feed. Tap again to pick up.", and the next tap lifts it.
- **What works:** nothing is lost. `stored` survived Save now, reload and Continue, and the next coop placed got the 3 hens back with joy 5.
- **Impact:** a building with animals vanishing from the farm on a routine chore tap is alarming, and moving buildings makes the stakes higher than for a jar.
- **Fix:**
  - For buildings with occupants or stock, require a "Move" button on a sheet, or a long press, instead of a second tap.
  - At the least, never arm on "Needs feed" or "Bring feed" messages.

### F4 (Medium). The Fishing Derby: the farm pond cannot podium, and you fish blind

- **Played:** 5 casts at the farm pond gave carp and bluegill, best three 35/35/25 = 95, "no podium". The rivals were 247/160/110 (shots `41` to `43`).
  - Even three normal bluegill (105) miss third place.
  - The sheet says "Cast anywhere: pond, river or lake.", but in summer only the town and woods catfish (80) can win.
- **No feedback while fishing:** `recordCatch` returns whether the catch improved your score, but `resolveCatch` ignores the return value (`systems/fishing.ts:160`). Nothing tells you "new derby best" until you walk to the board.
- **The derby page is bare and unguarded:**
  - It lists "35 points" with no fish names.
  - "Hand in my catches" is enabled from the first catch at 7 AM, with no confirm. One tap ends the derby for the year.
- **Fix:**
  - Toast "Derby: new best (Bluegill 35)" on an improving catch.
  - Name the fish on the derby page.
  - Say where the big fish are.
  - Ask before handing in early in the day.

### F5 (Medium, balance). Under glass, regrowing crops never die, so corn and the rare crops become the best crops in the game

Math from data:
- **Corn** regrows every 3 days for 80g, which is **26.7g per tile-day with no reseeding**.
- **Cranberry** gives 25 and **blueberry** 23.3.
- **Pumpkin**, the best single-harvest crop, nets 19.2 after its 100g seed.
- Outside, regrowth stops at season's end, which is why DECISIONS can say the rare crops are "variety, not a new best crop". In the greenhouse that claim is false: plant 32 corn or cranberries once and harvest forever.

The guard test does not see this. `tests/greenhouse.test.ts` ("a full greenhouse is a real winter income") computes first-harvest gross value over total stage days. It ignores both regrowth and seed cost, so it reports pumpkin (880 a day) as the ceiling.
- **Fix:** have the test model regrowth and seed cost. Then decide whether perpetual regrowth under glass is intended; if not, regrowing crops in the greenhouse could still end at the season change.

### F6 (Minor). Things can be placed on the greenhouse site before it exists

- **Played:** a sprinkler placed at 20,26 on the "Greenhouse site" (shot `30`) stays there and ends up inside the built greenhouse, taking a tile (shot `37`).
- **Cause:** the `place` handler checks `farmland && tillable`, not plot ownership (`mechanics/farmingActions.ts:140-142`).
- Placing outside bought plots is a recorded decision. But a project plot is a promise of 32 crop tiles.
- **Fix:** refuse placement on project plots until they are built. Afterwards it is the player's choice.

### F7 (Minor). The silo lets a house starve silently

- **Played, 2 nights:** the silo held 10 chicken feed, 1 hay and 40 slop, for a coop (3 hens), a barn (2 cows) and a sty (2 pigs).
  - The summary said "The silo fed 2 animal houses."
  - The barn needed 2 hay and got none. Its joy fell from 2 to 1 to 0, and no line said so.
- **What is correct:** the sty ate both nights but dug nothing on the rainy day (correct) and 2 truffles on the dry one.
- **Fix:** add "The barn went hungry: the silo is out of hay." Hay at 1 when a house needs 2 is exactly the case a player cannot see.

### F8 (Minor). Text and content

- **Project detail after the gold is complete:** three disabled "+0g" buttons remain (played, greenhouse). Hide them, or show "Gold done".
- **Shop, winter with a greenhouse:** the row is cut, "Parsnip Seeds 4 days 35g (ow..". With all seasons' seeds the Seeds tab is 3 pages (shots `34`, `35`).
- **Truffles are in no Book page.** "Animal Goods" is egg, milk, wool and honey (`collections.json`), so the new pig product is never collected (data read).
- The basket line does not explain kinds (F2). The derby lacks fish names (F4).

### F9 (Minor, test). The rebuilt balance sim is a regression tripwire, not balance evidence

- **It is one deterministic run** (rng 42) with a -33%/+70% band around 208,549. My run earned 202,496.
  - Because the run is deterministic, any code change that moves it is a real change, which is useful.
  - But a band that wide lets fall income nearly double without failing.
- **It has no clock.** The bot waters every owned tile every day, about 280 tiles once all land is bought, limited only by energy. Critique 4 measured roughly 50 game minutes for 32 tiles by hand.
- **It skips everything new this round:**
  - it delivers at 6 AM, so Clay never matters;
  - it never funds projects (no greenhouse), never keeps animals, and never fishes.
- **It does no goals:** its goal is stuck on "forage" for the whole year.
- **Its own logs:** fall 15 to winter 1 earns 81k in 14 days, and the year ends with 116k unspent.
- **What it actually shows:** a tireless farming-only player drowns in gold. It does not show that the late-game sinks absorb that gold, or that a human earns anything like it.
- **Fix:**
  - Give the bot a minutes budget per day.
  - Add seeds 1 to 5 and assert a median.
  - Add a variant that funds projects and the greenhouse.

### Not a bug (positive)

- **Mailbox:**
  - The list and letter pages are clean.
  - Gifts are taken with one tap and the toast is right.
  - The morning summary says "A new letter in the mailbox."
  - Stat-based letters arrive the morning after the milestone.
- **Greenhouse flow:**
  - The site is labelled before it is built.
  - The project page is clear: Quartz 0/10 "(have 10)", Iron Bar 0/5.
  - The finish toast is clear, and winter seeds are on the shelf at once.
  - Planting is refused outside the glass, with a good message.
- **Moving buildings:** state is parked and restored exactly, including across Save now, reload and Continue.
- **Derby and basket sheets** are readable at 390x844, with Present and Hand in in thumb reach (shot `45`).
- **Clay's grudging letter** after a first place arrives at once.

---

## 3. The days played (bot, real input, stopped on day 5)

| Day | Wake gold | Jobs (all done) | Mail | Board |
| --- | --- | --- | --- | --- |
| 1 | 500 | none | none | wild leek, mushroom, daffodil: none fillable |
| 2 | 40 | fish 1, chat 2, weeds 3 | Welcome (+3 potato seeds) | mushroom, carp, bluegill: none |
| 3 | 79 | mine 3, chat 2, fish 1 | Finn, first fish (+5 bait) | 3 cauliflower 945g on day 3: impossible this early |
| 4 | 138 | fish 3, forage 2, mine 3 | Orin, first ore (+2 copper ore) | filled 4 daffodils, 160g |
| 5 | 867 | forage 3, fish 1, chat 2 | none | potato, bluegill, carp: none |

Days 2 to 5: every job posted could be done, and all 12 were. This looks like an improvement on critique-4 F3, but four days is too few to call it fixed.

---

## 4. One-thumb reach

Not measured this round (stopped).

From screenshots:
- the basket sheet's Add/Out column and "Present the basket" sit at about 450 to 730 px of 844;
- the derby's "Hand in my catches" is just above Close.

Both are reachable. The concern is the opposite: hand-in is too easy to hit (F4).

---

## 5. Progression and economy (partial)

- **Late game, from data and the sim:** the greenhouse turns winter into one of the best seasons, about 850g a day of corn with no replanting (F5).
  - Market Road (60,000g for +10%) is still the only big sink.
  - The sim ends its year with 116k unspent.
  - I could not play late enough to judge whether projects, the greenhouse and decorations absorb a human's gold.
- **Festivals:**
  - Feast and Fair are easy podiums with any preserves or quality crops (F2).
  - The Derby is hard unless you know to fish for catfish (F4).
  - Prizes (1,000g) are small next to orders (945g for 3 cauliflower on day 3).
- **The rival** costs a morning player almost nothing (F1).

## 6. Top 3 features to add next

1. **Multi-day requests, so Clay matters.** Requests last 2 to 3 days and Clay takes the best open one each afternoon. That gives the rival teeth and gives orders planning depth (F1).
2. **Derby and basket feedback.** A derby toast on each improving catch, fish names, "where the big fish are", real variety kinds, and a "kinds +N%" line (F2, F4).
3. **Deliberate building moves.** A "Move" button or long press for occupied buildings and stocked silos, never the second tap of a chore (F3).

## 7. Verdict (partial)

What I played of the new content is stable:
- 0 page errors and 418 tests pass;
- mail, greenhouse funding and planting, the derby, baskets, building moves with save and reload, and the silo all work through real input.

The problems are design, not crashes:
- the rival cannot really compete, because orders reset every day;
- baskets reward three qualities of one crop over variety;
- a chore tap can lift a coop full of hens;
- the derby is played blind;
- the greenhouse quietly makes the new rare crops (and corn) the best crops in the game.

This report is incomplete. The critique-4 fix re-checks, Clay in live play, the Seed Exchange, the Book pages, a full-bag mail test, land signs and a clipping sweep still need a follow-up pass.

Screenshots (`agents/critiques/shots-5/`, 29 files):

| Group | Files |
| --- | --- |
| Play run | `01-day1-farm-planted`, `02`/`03`/`04-summary-day2..4` |
| Greenhouse | `30-greenhouse-site-before`, `31-projects-list-greenhouse`, `32-project-greenhouse-detail`, `33-project-greenhouse-done`, `34-shop-winter-with-greenhouse`, `35-shop-winter-p2`, `36-greenhouse-built`, `37-greenhouse-planted` |
| Derby | `40-board-derby-day`, `41-derby-panel-empty`, `42-derby-panel-catches`, `43-derby-result` |
| Baskets | `44-fair-basket-empty`, `45-fair-basket-three-pumpkins`, `46-fair-basket-variety`, `47-fair-result`, `48-feast-list`, `49-feast-basket` |
| Buildings | `50-coop-and-silo`, `51-coop-tap-again`, `52-coop-picked-up`, `53-coop-moved`, `54-silo-message`, `55-summary-silo-night`, `56-summary-silo-fed` |
