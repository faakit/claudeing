# Next steps (session of 2026-10-08)

Three agents worked in parallel on their own branches, each paired with a written handover. This branch
(`integration/agents-2026-10-08`) merges all of them; `npm run verify` is green on it (466 unit tests, e2e,
mobile e2e, perf at 2-3 draws per frame). Start a new session from here, not from the agent branches.

| Area       | Handover                                   | Critic notes                                                                        | Top next step                                                                                                                 |
| ---------- | ------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Game depth | [NEXT-STEPS-DEPTH.md](NEXT-STEPS-DEPTH.md) | `critiques/critique-4.md`, `critique-5.md` (partial)                                | Fix the five Medium findings of critique 5 (harmless rival, basket gaming, coop pick-up, derby feedback, greenhouse regrowth) |
| Art        | [NEXT-STEPS-ART.md](NEXT-STEPS-ART.md)     | [critiques/art-critic/](critiques/art-critic/final.md) (decisions, ledger, reviews) | Walnut UI fixes then make it the default; recolour Clay; wire the draft map-layer generator into the maps                     |
| Audio      | [NEXT-STEPS-AUDIO.md](NEXT-STEPS-AUDIO.md) | [critiques/audio-critic/](critiques/audio-critic/final.md) (ledger, reviews)        | Give each season its own harmony and melodies                                                                                 |

## Needs a human

- **Listen.** No one has heard the audio. The listening order is in `critiques/audio-critic/final.md`;
  renders can be made with `node audio-src/tools/render.mjs <dir>` against a dev server.
- **Look on a phone.** All art and layout was judged from headless screenshots only.
- **Decide:** the open questions at the end of each handover (late-game sink size, decorations with effects,
  per-season tilesets replacing the tint, walnut as default, and so on).
- **Licensing before any store release:** re-check Google's terms for Flow images (see `ASSETS.md` and
  `critiques/art-critic/decisions.md`; not legal advice).

## Notes for the next session

- The walnut and parchment UI is behind `?skin=walnut`; the plum UI is still the default.
- Raw Flow downloads and the critics' screenshots and renders were kept outside the repo; prompts and
  per-sprite crops are in `art-src/flow/`, so the art pipeline re-runs from the repo.
- On Windows, set `CHROMIUM_PATH` for e2e/perf, and `E2E_PORT`, `E2E_MOBILE_PORT`, `PERF_PORT` when two
  checkouts run checks at once (see `TOOLING.md`).
