# Game-depth session, round 2 (2026-10-08)

Branch `depth/round2` (worktree `C:/Users/andre/dev/tiny-acre/depth`), from `integration/agents-2026-10-08`.
Pushed to `origin/depth/round2` after every green verify.

Status: in progress (checkpoint). Critique 6 runs on a frozen copy of `5fd9943`.

## Commits shipped

| Commit | Goal |
| --- | --- |
| `c64e232` | Critique 5 fixes: multi-day requests so Clay races you, baskets count goods and data-driven kinds, Move sheet for occupied buildings, derby feedback (toast, names, stocked catfish, early hand-in asks), regrowing crops spent at the season change under glass, placement refused on unbought land and project sites, silo shortfall line, "All the gold is in!", shop rows keep "own N", truffles in the Book |
| `b7f810f` | Animal goods as requests and specials; Clay takes two requests a day in year 2 unless at 2 hearts; repeatable projects and the Founder's Statue (the late-game sink, backed by a two-year sim) |
| `5fd9943` | Decorations with a small use: garden bench (+15 energy a day), scarecrow and mild crows; five-seed sim judged on the median |
| `3841f0d` | Jobs pay 55% of before (early jobs now under early farm income, a sim test keeps it); the Flower Show is an arrangement of up to three flowers; tulips |

## What was verified, and how

- `npm run verify` green before every commit (lint, typecheck, unit 466 -> 506, build, e2e, mobile e2e, perf within
  <= 12 draws and <= 3.5 ms JS per frame).
- New unit tests: `tests/critique5.test.ts`, `tests/animal-orders.test.ts`, `tests/statue.test.ts`,
  `tests/decor-effects.test.ts`; additions to festivals, greenhouse, rival, projects, balance and sim tests.
- The sim now runs five seeds (median pinned at 177,686), a two-year variant that funds every project (statue level 3+
  by the end of year two, under 100k left in hand) and an early-jobs-versus-farming bound.
- New e2e lines: the Move sheet opens on a coop with a hen and its real "Move it" button moves it; an early derby
  hand-in asks first; the statue takes gold once every project is done; a garden bench gives energy.
- Probe `agents/probes/round2.mjs` screenshots the board (days left), a Fair basket (kinds, a refused second
  pumpkin), the derby page and its confirm, the Move sheet, the statue page and the shop. Read back: fixed "2 egg
  waiting" and a statue title that crowded the gold label.

## Not verified

- No real phone, no native build, no audio listening. Headless Chromium only.
- New art keys use generated placeholders.

## Save versions

No `STATE_VERSION` bump this round (still 15). New state is optional fields or stats:
`Order.until` (optional), stats `rested.day`, `crowsAte`, `project.<id>.level`, `projectLevels`,
`fest.<id>.y<year>.fish<i>`.

## New texture keys (placeholders today)

- `item_scarecrow`, `obj_scarecrow`
- `obj_landmark_statue` (Founder's Statue, town 10,14; could grow with its level)
- `item_tulip`, `item_tulip_seed`, crop frames `crop_tulip_0` .. `crop_tulip_4`
