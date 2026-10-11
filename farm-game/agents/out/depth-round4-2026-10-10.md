# Game-depth session, round 4 (2026-10-10)

Branch `depth/round4` (worktree `C:/Users/andre/dev/tiny-acre/depth`), from `integration/round3-2026-10-10`.
Pushed to `origin/depth/round4` after every green verify. Next steps: `agents/NEXT-STEPS-DEPTH.md`.

## Commits shipped

| Commit | Goal |
| --- | --- |
| `ab618e7` | Owner defaults: calibrated sim bot, settling-in pay on days 3-4, aside goals for the legendary fish, first-week sim test |
| (last) | Critique 12 fixes (crate catch-up and wording, season result first, goals that wait, text slips), handover and this report |

## What was verified, and how

- `npm run verify` green before each commit. Once the controls e2e missed a 500 ms swipe timing ("harness lag")
  while the critic's browsers ran; it passed on a rerun of the controls, onboarding and perf stages.
- Unit tests 780 -> 803: `depth-round4.test.ts` (aside goals, settling-in pay), `critique12.test.ts` (crate
  cadence, monotone in the lead, lines and widths, headline notes, goal waits), sim "the first week"; updated
  critique 10/11 and rival tests for the new cadence and lines.
- New e2e line: the Goal tab on day 3 says "TODAY'S JOBS: DOUBLE PAY"; on the legend goal the next goal is
  current and the legend is under "ALSO OPEN". Screenshot probe `agents/probes/round4.mjs`.
- Critique 12 (independent agent, frozen `6d5e480`, headless Chromium, real keyboard and touch input, teleports
  between spots): three new games of 29-31 days plus a first-week game, edge probes and a sweep.
- After the fixes, the critic's keeper probe replayed 29 days against this build: won 15 to 12, crates announced,
  the season result first on summer 1's morning, 0 errors.
- Not verified: anything on a real phone, audio, real walking times; a careless player and year two after the fixes.

## Sim before and after (early game)

| Measure | Before | After |
| --- | --- | --- |
| Bot earned by day 14 (played farmer 3.6k) | 1.5k | 3.3k |
| +500g on day 7, human-paced year | +18% to +76% (3 seeds) | +4% mean (12 seeds), median 0.8% with jobs |
| Days 3-4 earned (bot doing its jobs) | 130-180g | 260-360g |
| Day 7 earned (bot doing its jobs) | about 1,870 | about 2,030 |
| First plot day (bot doing its jobs) | 14-15 | 12-13 |
| Tireless five-seed median | 213,730 | 261,631 (repinned), 251,354 after goals that wait |

## Open questions

See `agents/NEXT-STEPS-DEPTH.md`: the feel of daily catch-up crates at a lead of 5; whether 3 quiet days is the
right time for a goal to wait.
