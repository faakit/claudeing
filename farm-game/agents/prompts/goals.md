# Goals given to the agent (in order)

Each was a short instruction; the agent turned it into milestones, tests and docs without further questions.

1. **Build from the plan.** "Build the farming sim from the build plan: cozy 2D top-down farming game, Phaser 3 +
   TypeScript + Vite, data-driven JSON content, pure systems separate from rendering, DECISIONS.md for judgment
   calls, tests, milestones M0-M8. Create a new folder/branch."
2. **Show it.** "Start the game so I can check it."
3. **Fidelity.** "We will generate real assets later, but make it high fidelity and very polished. Pay attention to
   details."
4. **Playable MVP.** "Iterate without asking questions. A fully functional prototype someone could play for hours.
   It should be fun; always ask yourself that. Host on GitHub Pages if artifacts limit you."
5. **Quality check.** "Is the code state of the art and well done?" (triggered a review pass and refactors.)
6. **Phone hardening.** "Start on the phone hardening pass."
7. **Mobile pivot.** "One hand, vertical, mobile-only. Make the gameplay loop more captivating, add more mechanics,
   always in an extendable way. Web only for now."
8. **Ideas.** "What else could we implement?" -> villagers and animals chosen.
9. **Villagers and animals.** "Go ahead."
10. **Roadmap.** "Create a roadmap file with the next implementations."
11. **Agents folder.** "Add to an agents folder everything you used to develop it autonomously, then send a playable url."

# Reusable prompt templates

## New mechanic

> Add <mechanic>. It must be one-handed friendly, extendable through the existing registries (see docs/EXTENDING.md),
> data-driven, saved safely (migration + sanitize), covered by unit tests and one e2e check, with a goal that
> introduces it. Screenshot every new screen at 390x844 and fix anything cramped. Run `npm run verify`, update
> DECISIONS.md and README, commit and push, republish the artifact.

## Review pass

> Review the diff for correctness, reuse, simplification and performance. Check: scenes mutating state, UI text that
> may not fit, missing sanitize for new save fields, missing tests for failure paths, perf budgets.

## Balance pass

> Run the bot simulation across seasons including animals, orders and fishing. Report income per day by source and
> any runaway loop. Adjust data, not code, and document threshold changes.

## Device pass (needs a human with a phone)

> Follow docs/MOBILE.md's manual checklist on <devices>; file each issue with a screenshot and device model.
