# Next steps for the game-depth work

Branch `depth/round3` (worktree `C:/Users/andre/dev/tiny-acre/depth`), from `integration/round2-2026-10-09`, pushed to
`origin/depth/round3`. Every commit passed `npm run verify` (lint, typecheck, unit, build, e2e, mobile e2e, controls
e2e, perf). Save version is still **16**: everything new this round is a stat or an optional field. Unit tests
680 -> 719. Round 2's handover: `git show 1dffd97:farm-game/agents/NEXT-STEPS-DEPTH.md`. Round report:
`agents/out/depth-round3-2026-10-09.md`.

## Shipped in round 3 (oldest first)

| Commit | What |
| --- | --- |
| `e23349b` | Critique 9 fixes: the season score on its own board line; Clay scores farm goods only; stakes said up front, a draw said, a Board Trophy in the house and Mara's letter; crop requests at 75% of supply; "Ship all produce" keeps what requests want and the bin warns; special keeps part-filled requests; fixed batch slot; requests above the special; result after Clay's last take; project nudge once a season; cart use before paying; growing statue (6 keys); dishes give less from the 4th of a day; sim keeper and fisher; day-31 stall probe |
| `20c779f` | Festival Ribbons and a Legend Wall as trophies at home; polite Clay (4 hearts) spares your farm goods |
| `70e861a` | Critique 10 fixes: toasts above open sheets, Clay takes farm rows first and ships a weekly crate, the race goes on at 5 hearts, last season on the score line, Ship all keeps the special, text fixes; four mastery goals appended |
| `8a07167` | Make is the outermost button on every Make-tab row; early-gold sensitivity measured for the owner |
| `9eb7b36` | Critique 11 fixes: crates keep up with a leader and are announced, none on day 28, a friendly Clay still ships crates and stops gloating, year-two text, winter prize year, bin line, kept toast splits the special, special expiry note, a finished special keeps its row, sim timeouts; handover and report |

## Critiques

- `agents/critiques/critique-9.md` (frozen `1a7464d`): fixed in `e23349b`, except the onboarding-owned goal title.
- `agents/critiques/critique-10.md` (frozen `e23349b`): one major, fixed in `70e861a`/`8a07167`. Its critic was stopped
  by the usage limit just after writing the complete report; the report was kept.
- `agents/critiques/critique-11.md` (frozen `70e861a`, a fresh copy, so critique 10 effectively re-run): no major;
  fixed in the last commit except the toast stack over tall sheets and the early-gold question.

## Next goals, in priority order

1. **Critique 12** on a fresh frozen copy of the head: play the race again with real input (the crates' catch-up
   rule and announcement are unplayed). Probes: `C:/Users/andre/dev/tiny-acre/critique-11/farm-game/agents/out/c11/`
   (`play10.mjs` with `FARMER`, `SHIPALL`, `USENOW`; `edge10.mjs`/`edge11` parts; `sweep10.mjs`; `lib.mjs` with the
   fixed button finder). Aim: a keeper usually wins, by a few points.
2. **Calibrate the sim keeper against play** (critique 11 F1: it fills 4 spring rows where a played keeper fills 13), so
   the board-race win counts mean something.
3. **Early economy sensitivity** (critiques 10 and 11): 500g on day 7 lifts the human-paced year by 18% to 76%. Owner
   question below; if yes, a cheaper first plot (700g) or a little more starting gold.
4. **Goal order:** round-2 goal #54 "Catch a legendary fish" gates the board and festival goals. Goals are an index
   (append only), so the fix is a goal system that can show the next unblocked goal, or an owner decision to reorder
   with a save migration.
5. **Long-press hotbar picker** (seeds in bag slots stop a one-thumb farmer planting; critiques 3 to 10). Lives in
   `ui/Hud.ts`, owned by the controls agent; `systems/inventory.ts equipFromBag` does the swap.
6. **Animals that roam** (R2.6), rendering only, once real animal sprites exist.
7. **Festival maps** (R3.4 leftover), needs the art agent's map generator.

Risks to keep in mind:
- Goals are an index into a list: only append (round 3 appended fest1, board4, statue6, legend4).
- `tests/sim.test.ts` pins the five-seed median at 213,730 (-20% / +25%). Year one is chaotic for the tireless bot
  (one 300g spring prize moved a seed by 60k): explain any move in DECISIONS.md. The board-race sim asserts a keeper
  wins 12 to 22 of 24 seasons and a shipper under half of that. Sim tests have a 60 s timeout.
- Clay: `boardRaceOn` (score kept from day 8, always) versus `rivalActive` (takes requests; off at 5 hearts). He takes
  on last days only, farm goods first. `crateDue`: every 7th season day, every 3rd while you lead by 4, never day 28,
  also when friendly.
- Toasts move above sheets while a modal is open (`ui/Hud.ts updateToasts`, depth and position only). Tell the
  controls agent, who owns the HUD.

## New texture keys still needing art

All have a generated placeholder (a growing figure for the statue, a cup for trophies):
- `obj_landmark_statue_1` .. `obj_landmark_statue_6` (16x32, level 6 gilded), replacing `obj_landmark_statue`
- `obj_trophy_board` (house 6,2), `obj_trophy_festival` (house 4,2), `obj_trophy_legends` (house 7,2), 16x16

## For onboarding

- Clay's board race starts on day 8 (his intro letter arrives on day 7); detect a season result with the
  `board.last.day` stat, a win with `boardWins`. His weekly crate is a morning note.
- Trophies appear at home when `boardWins`, `festivalWins` or `legends` reach 1.
- Dishes give less from the 4th of a day (stat `ate.today`); the dish card says so.
- The early goal title "Craft something at the workbench" (`goals.json`, goal 10) still says Craft; the tab is "Make".
- While a sheet is open, toasts now appear at the top of the screen (coach marks there would collide).

## Save versions

No `STATE_VERSION` bump: still **16**. New: optional `Order.noPoint` (sanitized in `systems/save.ts`) and stats
(`board.last.day|you|rival`, `rival.crate`, `ate.day`, `ate.today`, `projectNag.<id>`).

## Map changes

None to `.tmj` files. Placed from data: three trophies in the house (6,2), (4,2), (7,2); `tests/maps.test.ts` checks
every landmark and trophy is on its own reachable tile.

## Owner defaults applied this round

- Crows kept as a mild threat; the statue grows with its level (six keys); eating has no cap but diminishes after
  three dishes a day; a farmer who never fishes can win the board, and the prize is a lasting trophy plus modest gold.

## Open questions for the owner

1. Early gold compounds strongly (500g on day 7 = +18% to +76% of the human-paced year). Soften the first plot price
   (700g) or raise starting gold, or leave the early game as it is?
2. Clay's crates (weekly, every 3rd day while you lead by 4): is a rival who scores on his own field the right kind of
   pressure, or should the race be only about the board's rows (then he would need to contest rows earlier)?
3. Goal #54 (a legend) gates the late board, festival and statue goals. Reorder with a migration, or show the next
   unblocked goal?
