# Rules for agents working on Tiny Acre

## Read first

1. **[docs/VISION.md](../docs/VISION.md)**, before anything else. It holds the direction (The Dry Year), and every
   feature has to serve it. Then [docs/WORLD-PLAN.md](../docs/WORLD-PLAN.md) and
   [docs/MILESTONES.md](../docs/MILESTONES.md).
2. [NEXT-STEPS.md](NEXT-STEPS.md) for your area, and [OPEN-FINDINGS.md](OPEN-FINDINGS.md).
3. [TOOLING.md](TOOLING.md) for setup, and `docs/EXTENDING.md` for the registries.

## Product

- Mobile-only, portrait, **one hand**. The logical canvas is 200x400 (1:2): the world sits in a camera viewport
  from under a read-only HUD at the top to the bottom edge, and the thumb controls float over its lower part on their
  own solid plates (no dock band). Dialogs are bottom sheets. Left-handed mode mirrors the controls.
- Ask of every change: **is it fun, on a phone, with one thumb, in a 5-minute session?** Prefer fewer taps.
- Playable web first. The native apps (Capacitor) wrap the web build and are never forked.

## Architecture (dependencies only point down)

```
scenes / ui / input / fx    render and input only (Phaser)
systems/*                   pure rules, no Phaser, emit typed events, unit tested
state/GameState + data/*    one serializable state object and validated JSON content
mechanics/*                 each mechanic registers itself (one import line in mechanics/index.ts)
```

- Scenes never mutate state; they call system functions.
- Content is JSON in `src/data`, cross-validated at load (`validateContent`), so a typo fails loudly.
- Extend through the registries (action handlers, tool actions, day hooks, placeable behaviors, menu tabs, perk
  sources; see `docs/EXTENDING.md`). If a feature forces edits across core files, a registry is missing
  something: add it.
- A stack's identity is `{item, q, of}`. Never compare item ids alone where quality can differ.
- Saves are versioned. A state change bumps `STATE_VERSION`, adds a migration and a migration test, and extends
  `sanitize` so a damaged save cannot crash the game. When a counter is enough, use a stat (`stats['thing.id']`),
  which needs no save change.
- Goals are an index into a list: append only.

## Definition of done (the sandbox workflow, `docs/EXTENDING.md` section 0)

A feature is done when:

1. it starts with the scenario(s) that stage it (`src/dev/scenarios/<name>.json`, on the lab or a real map);
2. it was developed and tuned by opening that scenario (`?scenario=<name>`), not by playing up to it;
3. its e2e checks load those scenarios and use the await helpers (`scripts/lib/farm.mjs`,
   `window.__farm.dev.wait.*`), with no new `waitForTimeout` or `sleep` over 100 ms (`tests/fixed-waits.test.ts`
   fails on one);
4. the critic reviewed it through the same scenario names, and every finding cites one;
5. its scenarios load in `tests/dev-scenarios.test.ts` (every scenario does, migrated across save versions);
6. it has unit tests for every new system (including failure paths and "nothing changes on a refusal"), its text
   fits (`fitText` / `measureText`), it has a balance bound in `tests/sim.test.ts` if it earns money, and it has a
   goal or a tutorial `intro` step if it needs teaching;
7. `npm run verify` is green.

Use `npm run verify:fast` (about 30 s) in the inner loop.

## Budgets

- Touch targets are at least 44 CSS px on modern phones (43 on an SE). Keep the Menu away from the Action thumb.
- Goal text is at most 182 px; sheet text at most 184 px.
- At most 12 GL draws and 3.5 ms of JS per frame, and the frame-pacing budgets in `npm run perf`.
- Prettier reflows code, so after a scripted edit, check that it applied.

## Lanes

Each agent owns a lane and works on its own branch (`<lane>/<topic>`) in its own worktree.

- **Gameplay and design** don't draw sprites or edit audio. For a new item or placeable, set only the texture key
  or sound id. The generated placeholder (from the item's `color`) or the synth fallback covers it until the art or
  audio lane delivers.
- **Art** doesn't change game rules or data, except texture-key fields. All art goes through the deterministic
  pipeline in `art-src/tools/` onto the shared 32-colour palette. Record every Flow prompt in
  `art-src/flow/prompts.md` and every source in `ASSETS.md`.
- **Audio** uses CC0 or CC-BY sources only, credited in `ASSETS.md` and `audio-src/SOURCES.md`.
- `docs/VISION.md`, `docs/WORLD-PLAN.md`, `docs/MILESTONES.md` and `ROADMAP.md` belong to the design lane.
  Propose changes to them; don't rewrite them.
- If you touch another lane's file, keep it to a few lines and list it in your handover for the merge.

## Critics

Every 3 or 4 goals, run a critic on a frozen copy (`git archive` of your branch) through the scenarios. Triage its
report and fix the top findings before adding more. Critics keep their reviews outside the repo. Still-open
findings go into [OPEN-FINDINGS.md](OPEN-FINDINGS.md), and closed ones are deleted from it.

## Handover and records

- At the end of a round, rewrite your area's section in [NEXT-STEPS.md](NEXT-STEPS.md): what is true now, what is
  open, and the next tasks. Don't add new report files. Screenshots and renders stay in git-ignored `agents/out/`
  or outside the repo.
- Record every judgment call in `DECISIONS.md` (append a section).
- Report what is verified and what is not. No real phone and no native compile is the usual case: say so.
- Never include model identifiers in repo files.

## Git

- Work only on your branch. Don't open a PR unless asked, and never force-push someone else's branch.
- Commit messages: an imperative summary, then the attribution trailers the session specifies.
- Commit small and green, and push after each verified step.
