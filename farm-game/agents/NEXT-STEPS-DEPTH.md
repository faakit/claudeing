# Next steps for the game-depth work

Branch `depth/gold-sinks` (worktree `C:/Users/andre/dev/tiny-acre/depth`), based on `ccr-57a7430b-tj2108` plus
`034d986` (Vite started through node so the scripts run on Windows). Nothing was pushed from this branch.
Every commit below passed `npm run verify` (lint, typecheck, unit, build, e2e, mobile e2e, perf) before it landed.
Save version is now **15**. Unit tests went from 323 to 425.

## Shipped (oldest first)

| Commit | What |
| --- | --- |
| `6975cf9` | Town projects (`projects.json`), funded at the town board; perks via the new `registerPerkSource`; landmarks in town (save v8, goal-index remap) |
| `a5c642d` | Bigger Bag (two rows of slots) and seven decorations on a new Home shop tab; no x5 on rows over 300g (v9) |
| `c682f40` | Daily jobs (`jobs.json`) from day 2, intro jobs for fishing, mine and board; `registerStatWatcher` (v10) |
| `22fc304` | Gift memory, plant a row, "All" for machines, welcome toast once, seasonal tips |
| `8eaef62` | Session report checkpoint |
| `37f64b1` | Mailbox beside the bin (`mail.json`): letters with gifts, festival notices, birthday hints (v11) |
| `e9c3a31` | Clay, the rival farmer: takes the best board request at 2 PM from day 8; friendship softens it (v12) |
| `5a7cc5d` | Session report refresh |
| `e34cdf3` | Greenhouse: a 32-tile farm plot built by a project; any crop, any season; all seeds in the shop |
| `3bce825` | Balance simulation rebuilt on real plots, orders and jars, with a tight income band; Finn out of the river |
| `97e9e29` | Pigs (truffles on dry days), pig sty, feed silo (also carries the critique-4 report) |
| `6910ac1` | Critique 4 fixes F1 to F12 (v13) |
| `660df8d` | Session report refresh |
| `5e1b9e2` | Festival modes: basket (Harvest Fair, Winter Feast) and fishing derby |
| `74a4b0e` | Move buildings with their animals and feed (v14); land signs appear as they become affordable; forage ring |
| `64eeb10` | Seed Exchange project: four rare regrowing crops, Rare Crops Book page (Book pages), mastery goals; overridable check ports |
| `2190077` | Special orders: one big seasonal request at a time (v15) |
| `e3389a9` | Heart and level-up flourishes; collected goods pop out of their source |

## Partially done

- **Critique 5** ran on a frozen copy of `64eeb10` and was stopped early at the wrap-up (it reached day 5 of a
  real-input run plus targeted probes). Its partial report is `agents/critiques/critique-5.md` with `shots-5/`.
  It is listed below but not fixed. Not covered by it: Clay in live play, the Seed Exchange and Book pages, mail
  with a full bag, the critique-4 re-checks, a clipping sweep. Special orders and the flourishes came after it.
- **R2.6 animal depth:** pigs and the silo shipped; animals roaming beyond their house did not (waits for real
  animal sprites); animal goods are still not order targets.
- **R3.4 festivals:** no festival maps; the Flower Show is still a single entry.
- **Backlog 9 second-year content:** no year-two rival ramp beyond the existing +20% a year.
- **One-thumb:** "Use now" in the bag replaced the slot shuffle, but there is no long-press hotbar picker.
- **Retention hooks (R4.5):** not started on purpose (the game never reads the wall clock; a real-day streak would
  break that rule and the brief says to wait until the loop is proven fun).

## Open critique findings by severity

From critique 4 (all twelve were fixed in `6910ac1` except):
- Minor: fence art does not join (art agent); decorations look alike at hotbar size (art agent).
- Minor: placing machines and decorations on unbought land is still allowed (recorded decision; revisit if it
  confuses players).
From critique 3: all addressed except the slow-swipe edge case (F5), which nobody re-tested since critique 3.
From critique 5 (partial, untriaged; details and repro steps in `agents/critiques/critique-5.md`):
- Medium (design): Clay is nearly toothless; a player who fills requests in the morning never loses one, and his
  2-heart perk says 5 PM while he leaves town at 3 PM (`systems/rival.ts`, his schedule in `data/npcs.json`).
- Medium: baskets treat plain, silver and gold of one crop as different goods, and crops only have two kinds, so
  the variety bonus is easy to game and caps at +15% for crops (`systems/festivals.ts basketScore`, `enterBasket`).
  Count distinct items, not stack keys.
- Medium: four Interact presses on a coop lift it, hens and all; a hungry coop or a stocked silo on the second tap.
  Nothing is lost, but it alarms (`systems/placeables.ts interactWith`, `mechanics/animalHouse.ts`). Consider a
  longer gesture or a "Move" button for occupied buildings.
- Medium: the farm pond cannot reach the derby podium; no "new best!" feedback while fishing; catches show no
  names; "Hand in" has no confirm (`ui/panels/FestivalPanel.ts`, `ui/panels/FishingPanel.ts`, derby rivals).
- Medium (balance): regrowing crops never die in the greenhouse; corn about 26.7 g and cranberry about 25 g per
  tile-day against pumpkin's 19.2. `tests/greenhouse.test.ts` ignores regrowth and seed cost.
- Minor: things can be placed on the greenhouse site before it is built (`mechanics/farmingActions.ts` place).
- Minor: the silo lets a house go unfed silently when it runs short of that feed (`systems/silo.ts`).
- Minor: the project page keeps three disabled "+0g" buttons once the gold is in; a shop seed row is cut
  ("(ow.."); truffles are on no Book page.
- Minor (test): the balance sim is a regression tripwire, not proof of balance (one deterministic run, wide band,
  no projects, animals or rival).

## Next goals, in priority order

1. **Fix critique 5's findings** (list above), Medium first: basket kinds by item, greenhouse regrowth balance
   (e.g. regrowing crops in the greenhouse wither at the season change or give half yield; extend the test to count
   regrowth and seed cost), a calmer pick-up for occupied buildings, Clay's timing (act at noon, or take a request
   from the morning board too, and fix the 5 PM perk against his schedule), derby feedback. Then re-run a critique on
   the final build: `git archive HEAD farm-game | tar -x -C <new folder>`, link `node_modules` with a junction, dev
   server on a free port (5177 was taken by another agent), and cover what critique 5 did not.
2. **Animal goods as order and special targets.** `systems/orders.ts orderCandidates` ignores eggs, milk, wool,
   honey and truffles; add them when the player owns that animal (check `state.placed` for a house of the species,
   like the machine check already there). Raise nothing else; `tests/balance.test.ts` bounds orders.
3. **Year-two ramp.** Rival festival scores grow 20% a year already; add Clay taking two requests a day in year 2
   unless befriended (`systems/rival.ts applyRival`, a `game.rival.perYear` field), and special orders already scale
   by year. Watch `tests/rival.test.ts` and the e2e line "after 2 PM the rival has taken one".
4. **Long-press hotbar picker** (critique 3 F11 / critique 4 F8 leftovers): hold a hotbar slot ~400 ms to cycle it
   through bag stacks of usable types (seeds, placeables, fertilizer). Lives in `ui/Hud.ts` (hotbar zones) and
   `systems/inventory.ts` (`equipFromBag` already does the swap). Do not change `ui/layout.ts` geometry without a
   DECISIONS note.
5. **Animals that roam** (R2.6): needs real animal sprites first; coordinate with the art agent. Rendering only
   (`game/ObjectsRenderer.ts` critters), never state.
6. **Flower Show as a small game** (R3.4): e.g. an arrangement of up to three flowers like the basket mode; data
   `mode: "basket"` plus rival rescaling in `festivals.json`, tests in `tests/festivals.test.ts`.

Risks to keep in mind:
- Goals are an index into a list: inserting goals anywhere but the end needs a save version bump and
  `remapGoalIndex(raw, OLD_IDS, NEW_IDS)` in `systems/save.ts` (see the v7 to v13 migrations).
- `npm run verify` uses fixed ports; when another checkout verifies at the same time set `E2E_PORT`,
  `E2E_MOBILE_PORT` and `PERF_PORT` (a collision once made the e2e test the other branch's build).
- `tests/sim.test.ts` pins the bot's year to 208,549 gold (-33%/+70%); a deliberate balance change must move
  `SIM_EARNED` and say why in DECISIONS.md.

## New texture keys still needing art

All have a generated placeholder today (from the item colour, or `src/game/fallbackTexture.ts`).
- Decorations, icons: `item_fence`, `item_stone_path`, `item_flower_pot`, `item_garden_lamp`, `item_garden_bench`,
  `item_farm_statue`, `item_garden_fountain`; world sprites: `obj_fence`, `obj_stone_path` (flat, under the player),
  `obj_flower_pot`, `obj_garden_lamp`, `obj_garden_bench`, `obj_farm_statue`, `obj_garden_fountain`.
- Town landmarks (world sprites): `obj_landmark_canopy`, `obj_landmark_seedexchange`, `obj_landmark_fishladder`,
  `obj_landmark_library`, `obj_landmark_bathhouse`, `obj_landmark_fairhall`, `obj_landmark_market`.
- Mailbox: `obj_mailbox`.
- Pigs and silo: `item_pig`, `item_slop`, `item_truffle`, `item_sty`, `item_silo`, `obj_sty`, `obj_silo`,
  `animal_pig` (falls back to the chicken drawing today).
- Rare crops: icons `item_strawberry`, `item_blueberry`, `item_cranberry`, `item_snowpea` and their seed packets
  `item_strawberry_seed`, `item_blueberry_seed`, `item_cranberry_seed`, `item_snowpea_seed`; crop growth frames
  `crop_strawberry_<stage>`, `crop_blueberry_<stage>`, `crop_cranberry_<stage>`, `crop_snowpea_<stage>` (stages 0..4,
  generated into the crops sheet today).
- Optional: a greenhouse frame over farm tiles 17..24 x 26..29 (drawn as a glass tint today); a `ui_bag` icon for
  the Bigger Bag row (reuses `item_cloth`).
- Clay (rival) uses the shared villager sprite with tint `#8ab0e0`.

## Map changes

None: no `.tmj` file and no line of `scripts/generate-maps.mjs` changed. Things placed on the maps from data:
mailbox at farm 13,9; greenhouse plot farm 17..24 x 26..29; town landmarks at 15,11 (canopy), 6,12 (seed
exchange), 16,21 (fish ladder), 19,9 (library), 19,13 (hot spring), 21,11 (fair hall), 16,9 (market road); Clay's
spot town 15,12; Finn's afternoon spot moved to town 16,22. `tests/maps.test.ts` checks all of them stand on open,
reachable ground, so an art pass that puts props there will fail that test and say which spot.

## Open questions for the owner

1. Project prices total about 126k gold (1,200 to 60,000 each). Enough of a late sink? The tireless bot earns about
   208k in year one; a human far less.
2. Jobs pay 20 to 120 gold plus friendship; specials 1.5x the goods' value. Too generous early?
3. The greenhouse is a farm plot, not its own map (per-map soil judged too deep a refactor). Acceptable?
4. Decorations are purely cosmetic. Should they do something (e.g. villager visits)?
5. Should placing machines on unbought land be refused, for consistency with tilling?
6. Retention hooks (a real-day streak) would need the wall clock, which the game never reads by design. Wanted?
