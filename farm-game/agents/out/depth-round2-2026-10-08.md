# Game-depth session, round 2 (2026-10-08)

Branch `depth/round2` (worktree `C:/Users/andre/dev/tiny-acre/depth`), from `integration/agents-2026-10-08`.
Pushed to `origin/depth/round2` after every green verify.

Status: in progress (checkpoint before critique 7).

## Commits shipped

| Commit | Goal |
| --- | --- |
| `c64e232` | Critique 5 fixes: multi-day requests so Clay races you, baskets count goods and data-driven kinds, Move sheet for occupied buildings, derby feedback, regrowing crops spent at the season change under glass, placement refused on unbought land and project sites, silo shortfall line, project and shop text, truffles in the Book |
| `b7f810f` | Animal goods as requests and specials; Clay takes two requests a day in year 2 unless at 2 hearts; repeatable projects and the Founder's Statue (late-game sink, backed by a two-year sim) |
| `5fd9943` | Decorations with a small use: garden bench, scarecrow and mild crows; five-seed sim judged on the median |
| `3841f0d` | Jobs pay 55% of before (early jobs under early farm income); Flower Show arrangement; tulips |
| `8b5a87e` | Probe fixes (plural goods on the Move sheet, statue level line), roadmap, report |
| `a725d1d` | Clay's polite notice is honest |
| `b368655` | Bees make honey faster near flowers |
| `316a162` | Critique 6 fixes: paged projects list (blocker), Clay settles overnight and names his target, crop requests only for crops you grow, farm-sized specials, "Glass only" seeds, tougher Fair and Feast, bench mash-safe, text fixes |
| `5d00670` | A kitchen (Home upgrade) and six dishes that restore energy |
| `ce43907` | Four legendary fish with Finn's letter and a goal |
| (next) | Human-paced sim variant; handover and report |

## What was verified, and how

- `npm run verify` green before every commit (lint, typecheck, unit 466 -> 522, build, e2e, mobile e2e, perf within
  <= 12 draws and <= 3.5 ms JS per frame).
- New unit test files: `critique5.test.ts`, `animal-orders.test.ts`, `statue.test.ts`, `decor-effects.test.ts`,
  `cooking.test.ts`, `legends.test.ts`; additions to festivals, greenhouse, rival, projects, machines, rare, balance
  and sim tests (five seeds, two years with projects, early jobs vs farming, a human-paced run).
- New e2e lines: the Move sheet and its "Move it" button; an early derby hand-in asks first; the statue opens from
  the projects list with a real tap and takes gold; a garden bench gives energy; a dish in hand is eaten with Action;
  the rival takes a request posted the day before.
- Probe `agents/probes/round2.mjs` (board, Fair basket, derby, Move sheet, projects list, statue, shop Seeds and Home,
  a dish's bag card), screenshots read back.
- Critique 6 (independent sub-agent, frozen copy of `5fd9943`, 14 real-input days, probes, a 41-screen sweep):
  `agents/critiques/critique-6.md` and `shots-6/`. All nine findings triaged; fixes in `316a162`.

## Not verified

- No real phone, no native build, no audio listening. Headless Chromium only.
- New art keys use generated placeholders.
- Legendary fish and cooking were not played by a critic yet.

## Save versions

No `STATE_VERSION` bump this round (still 15). New state is optional fields or stats:
`Order.until`, `Order.from`, `Order.takenOn` (optional, sanitized); stats `rested.day`, `crowsAte`,
`project.<id>.level`, `projectLevels`, `upgraded.kitchen`, `cooked`, `ate`, `legend.<fish>`, `legends`,
`fest.<id>.y<year>.fish<i>`.

## New texture keys (placeholders today)

- `item_scarecrow`, `obj_scarecrow`
- `obj_landmark_statue` (Founder's Statue, town 10,14; could grow with its level)
- `item_tulip`, `item_tulip_seed`, crop frames `crop_tulip_0` .. `crop_tulip_4`
- Dishes: `item_parsnip_soup`, `item_baked_potato`, `item_fish_stew`, `item_berry_tart`, `item_kale_salad`,
  `item_pumpkin_pie`
- Legendary fish: `item_glimmer_trout`, `item_sun_carp`, `item_old_whiskers`, `item_ice_pike`

## Open questions for the owner

1. Crows: mild (one crop now and then on a big unguarded field, a free scarecrow first). Keep, or drop the threat
   and make the scarecrow purely cosmetic?
2. The Founder's Statue gives +1% sales for five levels and then is for glory. Enough of a late goal, or should
   later levels unlock something visible (a bigger landmark) once the art exists?
3. Cooking turns crops into energy. Should eating be capped per day (Stardew is not), or is the 15% price cap enough?
