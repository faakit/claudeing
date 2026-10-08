# Next steps for the game-depth work

Branch `depth/round2` (worktree `C:/Users/andre/dev/tiny-acre/depth`), from `integration/agents-2026-10-08`, pushed to
`origin/depth/round2`. Every commit passed `npm run verify` (lint, typecheck, unit, build, e2e, mobile e2e, perf).
Save version is still **15**: everything new this round is an optional field or a stat. Unit tests 466 -> 522.
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

## Critiques

- `agents/critiques/critique-6.md` (+ `shots-6/`): frozen `5fd9943`, 14 real-input days, all nine findings fixed in
  `316a162`.
- Critique 7 was started on a frozen copy of `f27999e` (`C:/Users/andre/dev/tiny-acre/critique-7`); see below for its
  status.

## Next goals, in priority order

1. **Triage critique 7** (if it finished, `agents/critiques/critique-7.md`) and fix its top findings.
2. **Long-press hotbar picker** (critique 3 F11, critique 4 F8, critique 6 F9): hold a hotbar slot to cycle bag stacks
   of usable types. Lives in `ui/Hud.ts`, which the controls agent owns; hand it over or do it after their merge.
   `systems/inventory.ts equipFromBag` already does the swap.
3. **Animals that roam** (R2.6): rendering only (`game/ObjectsRenderer.ts` critters); waits for real animal sprites.
4. **Festival maps** (R3.4 leftover): each festival is still a sheet at the board; a decorated town square on festival
   day would make it an event. Map work belongs to the art agent's generator.
5. **Sim fidelity:** the bot still does no goals, animals, fishing or cooking. Teaching it animals (with the silo)
   would let the animal-goods bounds be checked against play rather than arithmetic.
6. **Statue landmark that grows with its level** (needs per-level art keys from the art agent).

Risks to keep in mind:
- Goals are an index into a list: only append (this round appended statue3, cook, legend1).
- `tests/sim.test.ts` pins the five-seed median at 195,194 (-20% / +25%); a deliberate balance change must move
  `SIM_EARNED` and say why in DECISIONS.md. The two-year run asserts the statue absorbs year-two gold.
- Fish codes for the derby are indexes into `fish.json`: append fish, never insert.
- `upgradeLevel` falls back to the `upgraded.<id>` stat for upgrades not in `state.upgrades` (the kitchen).
- Clay acts lazily (board opened or order delivered after his hour) and overnight (`settleRival` in the morning
  hook); `rival.day` keeps it to once a day.

## New texture keys still needing art

All have a generated placeholder. Round 2:
- `item_scarecrow`, `obj_scarecrow`; `obj_landmark_statue` (town 10,14)
- `item_tulip`, `item_tulip_seed`, crop frames `crop_tulip_0` .. `crop_tulip_4`
- `item_parsnip_soup`, `item_baked_potato`, `item_fish_stew`, `item_berry_tart`, `item_kale_salad`, `item_pumpkin_pie`
- `item_glimmer_trout`, `item_sun_carp`, `item_old_whiskers`, `item_ice_pike`

Round 1 keys (decorations, landmarks, mailbox, pigs and silo, rare crops) are listed in round 1's handover.

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
