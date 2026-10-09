# Next steps for the game-depth work

Branch `depth/round2` (worktree `C:/Users/andre/dev/tiny-acre/depth`), from `integration/agents-2026-10-08`, pushed to
`origin/depth/round2`. Every commit passed `npm run verify` (lint, typecheck, unit, build, e2e, mobile e2e, perf).
Save version is still **15**: everything new this round is an optional field or a stat. Unit tests 466 -> 537.
Round 1's handover is in git history (`git show 1d89c97:farm-game/agents/NEXT-STEPS-DEPTH.md`).

## Shipped in round 2 (oldest first)

| Commit | What |
| --- | --- |
| `c64e232` | Critique 5 fixes: multi-day requests, baskets count goods and data-driven `kinds`, Move sheet for occupied buildings (`occupants` hook), derby toast/names/stocked catfish/hand-in confirm, regrowing crops under glass last one season, no placing on unbought land or the greenhouse site, silo shortfall line, text |
| `b7f810f` | Animal goods as requests and specials (`animalOutput`); Clay takes two a day in year 2 unless at 2 hearts; repeatable projects (`repeat`) and the Founder's Statue |
| `5fd9943` | Garden bench (+15 energy a day), scarecrow and mild crows (`game.crows`); five-seed sim median |
| `3841f0d` | Job gold at 55%; Flower Show arrangement; tulips |
| `8b5a87e`, `a725d1d` | Probe fixes; Clay's polite notice |
| `b368655` | Bees faster near flowers (`flowerDays`, `flowerRadius`) |
| `316a162` | Critique 6 fixes: paged projects list, Clay settles overnight (`settleRival`) and names his target, requests safe on their posting day (`Order.from`), crop requests only for crops you grow, specials capped by output (`specialCap`), "Glass only" seeds sorted last, tougher Fair/Feast, bench mash-safe (`arm: false` messages), text |
| `5d00670` | Kitchen (Home upgrade, kept as a stat) and six dishes; eat with Action or the bag card |
| `ce43907` | Four legendary fish (`legend: true`), Finn's letter, a goal |
| `f27999e` | Human-paced sim variant; report checkpoint |
| `61e118e` | Sim bot keeps a coop of hens |
| `933be12` | Critique 7 fixes: crop requests wait for ripening (`cropReadyIn`), Clay only on a request's last day and not on a day you filled one (`filled.day`), farm goods weighted 3x on the board, special's "Give N" keeps goods for a same-item request, no immediate repeat special, bench lines, dishes never wasted, Legends 1/4, 70% animal specials |
| `3e1b9c5` | Traveling cart (`cart.json`, days 5/12/19/26), x5 cooking, legend-in-the-bin warning |
| `a51cf83` | Critique 8 fixes: a season scoreboard against Clay (`boardTally`, `settleSeason`; the stay-home rule is gone), crop requests sized to the field (`cropSupply`) and posted up to 7 days ahead, the special never takes goods a request needs, the cart never resells store goods, plain-only batch cooking |
| `f7e4d49`, `1a7464d` | Report refresh; a "Beat Clay on the board" goal (appended) |

## Critiques

- `agents/critiques/critique-6.md` (+ `shots-6/`): frozen `5fd9943`, 14 real-input days, all nine findings fixed in
  `316a162`.
- `agents/critiques/critique-7.md` (+ `shots-7/`): frozen `f27999e`, no blocker; all nine findings fixed in `933be12`.
- `agents/critiques/critique-8.md` (+ `shots-8/`): frozen `3e1b9c5`, no blocker; all eight findings fixed in `a51cf83`.
- `agents/critiques/critique-9.md` (+ `shots-9/`): frozen `1a7464d` (the code head), no blocker,
  about 120 played days including a real spring-to-summer settlement. **Not fixed** (the session was wrapped up);
  its findings are the first backlog below.

## Open critique findings, by severity (critique 9, untriaged in code)

Details, repro steps and file:line causes are in `agents/critiques/critique-9.md`.

- **Medium (design) F1, the season scoreboard against Clay:** the score line shows only on days Clay has no target
  (`systems/rival.ts rivalNotice`), so a losing player rarely sees it; a farmer who does not fish or forage for the
  board loses every season (a two-year sim lost 72 of 72), because Clay scores every request left to its last day,
  and about half the rows are fish and forage; the 300g prize is never announced, and a tie says nothing.
  Suggested: always show the score (a second notice line or a prefix); give Clay a point only for rows you could have
  filled (crops you grow, goods you make, rows where you held at least one); say the stakes in Clay's letters; a tie
  line.
- **Medium F2, crop requests need your whole harvest:** sized to exactly what ripens (`systems/orders.ts cropSupply`),
  so shipping at the bin first loses the row. Suggested: leave slack (ask for about 70% of supply), and have the bin
  warn when a stack is wanted by an open request.
- **Minor F3:** the special's Give still empties a request you are part-way to (only fully fillable requests are kept
  back, `ui/panels/BoardPanel.ts`). Keep back the request's quantity whenever you hold some of it.
- **Minor F4:** after a batch cook the "x3" button disappears and Make slides under the thumb, so a second tap cooks
  with gold ingredients (`ui/panels/CraftTab.ts`). Keep the buttons in fixed places (a disabled x-button).
- **Minor F5:** the special still sits on top of the board and takes a hurried tap from Clay's target. Put the
  requests first, or Clay's target above the special.
- **Minor F6:** the season result is easy to miss and the board does not remember it ("Last season: you won 25-7").
- **Minor F7:** the cart says what a good is for only after you pay (put `use` on the row's sub line).
- **Minor F8:** the goal title still says "Craft"; Clay's 2-heart chat line says "You keep beating me" while he leads.
- **Unexplained:** one critic bot stopped on day 31 when the bin and then the bed did not open after "Inventory full!".
  Not reproduced with a full bag; worth a look.

Older open items: fence art does not join, decorations look alike at hotbar size (art agent); the long-press hotbar
picker (controls agent); seeds left in the bag cost a one-thumb player taps (same picker).

## Next goals, in priority order

1. **Fix critique 9's findings above**, F1 and F2 first (both are rules in `systems/rival.ts` and
   `systems/orders.ts`, with tests in `tests/board7.test.ts`, `tests/rival.test.ts`, `tests/critique5.test.ts`), then
   re-run a critique on a frozen copy (`git archive HEAD farm-game | tar -x -C <dir>`, a junction to `node_modules`,
   a dev server on a free port; reuse the probes in `C:/Users/andre/dev/tiny-acre/critique-9/farm-game/agents/out/c9/`).
2. **Long-press hotbar picker** (critique 3 F11, critique 4 F8, critiques 6 and 9): hold a hotbar slot to cycle bag
   stacks of usable types. Lives in `ui/Hud.ts`, which the controls agent owns; hand it over or do it after their
   merge. `systems/inventory.ts equipFromBag` already does the swap.
3. **Animals that roam** (R2.6): rendering only (`game/ObjectsRenderer.ts` critters); waits for real animal sprites.
4. **Festival maps** (R3.4 leftover): festivals are still sheets at the board; a decorated square on festival day
   needs the art agent's map generator.
5. **Sim fidelity:** the bot keeps hens and a two-year variant funds projects, but it does no goals, fishing or
   cooking; `tests/sim.test.ts` is the place.
6. **A statue landmark that grows with its level** (needs per-level art keys).

Risks to keep in mind:
- Goals are an index into a list: only append (this round appended statue3, cook, legend1, board1).
- `tests/sim.test.ts` pins the five-seed median at 213,730 (-20% / +25%); a deliberate balance change must move
  `SIM_EARNED` and say why in DECISIONS.md. The two-year run asserts the statue absorbs year-two gold.
- Fish codes for the derby are indexes into `fish.json`: append fish, never insert.
- `upgradeLevel` falls back to the `upgraded.<id>` stat for upgrades not in `state.upgrades` (the kitchen).
- Clay acts lazily (board opened or order delivered after his hour) and overnight (`settleRival` in the morning
  hook); `rival.day` keeps it to once a day. He takes only requests on their last day; the season scoreboard counts
  his takes against your fills (`board.s<season>.you|rival` stats).

## New texture keys still needing art

All have a generated placeholder. Round 2:
- `item_scarecrow`, `obj_scarecrow`; `obj_landmark_statue` (town 10,14)
- `item_tulip`, `item_tulip_seed`, crop frames `crop_tulip_0` .. `crop_tulip_4`
- `item_parsnip_soup`, `item_baked_potato`, `item_fish_stew`, `item_berry_tart`, `item_kale_salad`, `item_pumpkin_pie`
- `item_glimmer_trout`, `item_sun_carp`, `item_old_whiskers`, `item_ice_pike`

Round 1 keys (decorations, landmarks, mailbox, pigs and silo, rare crops) are listed in round 1's handover.

## Save versions

No `STATE_VERSION` bump this round: still **15**. New state is optional `Order` fields (`until`, `from`, `takenOn`,
sanitized in `systems/save.ts`) and stats (`board.s<n>.you|rival`, `boardWins`, `special.last.<id>`, `cart.<day>.<item>`,
`cartBought`, `rested.day`, `crowsAte`, `project.<id>.level`, `projectLevels`, `upgraded.kitchen`, `cooked`, `ate`,
`legend.<fish>`, `legends`, `fest.<id>.y<year>.fish<i>`, `rival.day`).

## Map changes

None to `.tmj` files or `scripts/generate-maps.mjs`. Placed from data: the statue landmark at town 10,14 (checked by
`tests/maps.test.ts`).

## Owner decisions applied this round

- Town projects stay the late sink, plus one repeatable sink (the statue), after a two-year sim showed ~280k idle.
- Jobs cut to 55% so early jobs pay less than early farming (a sim test decides).
- Greenhouse stays a farm plot. Decorations: bench and scarecrow do a little. Placing on unbought land is refused.
- No daily login streak (ROADMAP R4.5 updated).

## Open questions for the owner

1. Crows: keep the mild threat, or make the scarecrow purely cosmetic?
2. Statue levels after +5% are for glory only. Enough, or should later levels show a bigger landmark?
3. Cooking turns crops into energy with no daily cap (dishes sell at most 15% over ingredients). Cap eating?
4. The board race with Clay: should a farmer who never fishes be able to win it (critique 9 F1 suggests Clay scores
   only rows you could have filled), and is 300g a year of play the right prize, or should it be a lasting trophy?
