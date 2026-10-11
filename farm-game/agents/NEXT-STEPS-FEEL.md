# Next steps: game feel (round 4)

Branch `feel/smooth` (worktree `controls`), from `integration/round3-2026-10-10`. Everything below was measured in
headless Chromium (software GL, a 144 Hz rAF on this host) with CDP CPU throttling; **no real phone was used**,
so absolute frame times are pessimistic in some places and optimistic in others: judge by the relative change.
`npm run verify` is green at the last commit (now with `e2e:feel` and frame-time budgets in `perf`).

(Draft: final numbers are filled in at the end of the round.)
