# Next steps for the game-depth work

Branch `depth/round4` (worktree `C:/Users/andre/dev/tiny-acre/depth`), from `integration/round3-2026-10-10`, pushed to
`origin/depth/round4`. Every commit passed `npm run verify` (lint, typecheck, unit, build, e2e, mobile e2e, controls
e2e, onboarding e2e, perf). Save version is still **17**: everything new is a stat or optional data. Unit tests
780 -> 803. Round 3's handover: `git show 6d5e480:farm-game/agents/NEXT-STEPS-DEPTH.md`. Round report:
`agents/out/depth-round4-2026-10-10.md`.

## Shipped in round 4 (oldest first)

| Commit | What |
| --- | --- |
| `ab618e7` | Owner defaults: sim bot calibrated against play (plants its starting seeds, buys fastest payback while gold is short; tireless median repinned 213,730 -> 261,631); settling-in pay (jobs on days 3 and 4 pay double, `game.json welcomeJobs`, said in the morning note and the Goal tab); `aside` goals (both legendary-fish goals no longer hold up the chain; "Also open" in the Goal tab); sim test "the first week" |
| (last) | Critique 12 fixes: crates counted from the last one and faster while you lead (every 2 days at 3+, daily at 5+), the crate always said on the score line and the rule on the line below, letters and "took one today: a point"; season result and special expiry first on a busy morning, sales shrink first; a goal with no progress for 3 days waits and the next shows; "Special done! Thanks!", Bag tip wraps; critique 12 kept in `agents/critiques/` |

## Early game: sim before and after (owner question 1)

- **The round-3 spike was the bot.** It kept its 10 starting parsnip seeds and bought 6 cauliflower seeds on day 1:
  no income until day 11, 1.5k earned by day 14 (a played farmer: 3.6k). Calibrated, it earns 3.3k by day 14.
  Then 500g on day 7 moves the human-paced year by **+4% on average over 12 seeds** (was "+18% to +76%" on 3).
- **Settling-in pay** (human-paced bot that does its jobs, 5 seeds, `tests/sim.test.ts` "the first week"):
  days 3-4 earn 130-180g -> 260-360g; day 7 about 1,870 -> 2,030; first plot day 14-15 -> 12-13; a 500g lump on
  day 7 moves the year by a median 0.8% (bound: under 15%).
- A cheaper first plot (500g) was measured too (first plot day 23 -> 17 for a bot without jobs, same sensitivity)
  and not chosen: it hands out land rather than filling the empty days. Critique 12 reached the same advice.

## Critiques

- `agents/critiques/critique-12.md` (frozen `6d5e480`, before this round's changes): no blocker or major. F1 (race
  not close), F2 (crate rule unsaid, lost day-14 crate), F3 (season result cut), F4 (goal chain frozen), F6 (two
  text slips) fixed in the last commit; F5 (farmer's summer board) and "Board 16" not changed (see DECISIONS).
- **Played after the fix** (critic's `play12.mjs` keeper, Ship all, never fishes or forages, 29 days, real input,
  against this build; logs in `C:/Users/andre/dev/tiny-acre/depth-play/r4play/tmp/R4K.out`): **won 15 to 12**.
  The lead was 4 to 6 through mid-season and 3 to 4 from day 21; "His crate tonight" and "Ahead 3+/5+" were on
  the board every crate day; summer 1's morning led with the result. 0 page errors. Not replayed: a careless
  player (critique 12 lost 0 to 12; crates only add to that), year two.

## Next goals, in priority order

1. **Critique 13** on a fresh frozen copy: replay the race (keeper and careless), the goal waits on a long game
   (does the HUD now follow what the player does, and is "Also open" readable after many waits?), the day 3-4
   jobs, and the busy season-change morning.
2. **Farmer's summer board** (critique 11 F1, 12 F5): the first days of summer and fall have only fish and wild
   rows for a farmer (crop rows wait for a crop within 7 days of ripe). Maybe a "seasonal crop" request posted on
   day 1 for a crop you planted, lasting until it ripens.
3. **Bin row "Board 16"** says requests plus the special as one number; split it ("Board 5  Rosa 11") if it fits.
4. **Long-press hotbar picker** (seeds in bag slots stop a one-thumb farmer planting; the critic's bot still
   needed "Use now" 5 times). Lives in `ui/Hud.ts` (controls/feel agents).
5. **Animals that roam** (rendering, once real animal sprites exist) and **festival maps** (needs the art agent's
   map generator), as before.

Risks to keep in mind:
- Goals are an index into a list: only append. `aside` goals and `goalWait.<id>` stats change which goal shows,
  never the order; goals past the current one never complete early.
- `tests/sim.test.ts` pins the five-seed median at 261,631 (-20% / +25%); today 251,354 (goals now pay as you go).
  The board-race sim asserts a keeper wins 12 to 22 of 24 (today 20) and a shipper under half of that (3).
- Clay: `crateDue` (7 days after the last crate, 2 at a lead of 3, 1 at 5, never day 28), counted from
  `rival.crate`; the race starts on day 8 (`game.rival.startDay`). He still scores only last-day farm rows.

## New texture keys

None this round. Still needing art from round 3: `obj_landmark_statue_1` .. `_6`, `obj_trophy_board`,
`obj_trophy_festival`, `obj_trophy_legends`.

## For onboarding

- Jobs posted on days 3 and 4 pay double: the morning note says "...: double pay while you settle in. See Menu >
  Goal." and the Goal tab header "TODAY'S JOBS: DOUBLE PAY". If the guided start talks about jobs, it can lean on it.
- A shown goal with no progress for 3 days now waits and the next goal shows, with a morning note ("New goal: X.
  "Y" can wait in Menu > Goal."). This is off while the guided start runs (`tutorialOn && !guidedTracksDone`),
  so tutorial steps that check `currentGoal` are safe. With the guide skipped, early goals can wait from day 4.
- The Goal tab may show "ALSO OPEN" (waiting goals) under COMPLETED, which then shows one row instead of two.
- Clay's intro letter changed: "I fill board requests too: ... not fish or wild goods. Each week I ship a crate of
  my own, more often while you lead."

## Save versions

No `STATE_VERSION` bump: still **17**. New stats only: `goal.<id>` (a goal finished out of order),
`goalWait.<id>`, `goalStall.i|v|day`. New optional data: `GoalDef.aside`, `GameData.welcomeJobs`.

## Map changes

None.

## Open questions for the owner

1. The catch-up crates now keep a keeper 3 to 6 ahead (played: won 15 to 12). Is a rival who scores daily while
   you lead by 5 the right feel, or should the race be about the rows (Clay contesting a farm row a day early)?
2. Goals that wait after 3 quiet days: is 3 days right, and should a waiting goal come back to the HUD once the
   player makes progress on it?
