# Rules for agents working on Tiny Acre

## Product

- Mobile-only, portrait, **one hand**. Logical canvas 200x400 (1:2). World in a camera viewport between a
  read-only HUD (top) and a control dock (bottom). Dialogs are bottom sheets. Left-handed mode mirrors the dock.
- Ask of every change: **is it fun, on a phone, with one thumb?** Prefer fewer taps.
- Playable web first. Native (Capacitor) is wrapped, never forked.

## Architecture (dependencies only point down)

```
scenes / ui / input / fx    render + input only (Phaser)
systems/*                   pure rules, no Phaser, emit typed events, unit tested
state/GameState + data/*    one serializable state object + validated JSON content
mechanics/*                 each mechanic registers itself (one import line in mechanics/index.ts)
```

- Scenes never mutate state; they call system functions.
- Content is JSON in `src/data`, cross-validated at load (`validateContent`). Typos must fail loudly.
- Extend through registries (action handlers, tool actions, day hooks, placeable behaviors, menu tabs, perks).
  See `docs/EXTENDING.md`. If a feature forces edits across core files, the registry is missing something: add it.
- Stack identity is `{item, q, of}`; never compare item ids alone where quality can differ.
- Saves are versioned; any state change bumps `STATE_VERSION`, adds a migration and a migration test, and extends
  `sanitize` so damaged saves cannot crash the game.

## Quality gates (all must pass before a commit)

`npm run verify` = lint, typecheck, unit tests, build, e2e, mobile e2e, perf budgets.

- Add a unit test with every new system; an e2e check for every new player-facing flow.
- UI text must fit: use `fitText`/`measureText` (pure) and let tests prove it. Goal text <= 182px.
- Touch targets >= 43 CSS px on phones; Menu stays away from the Action thumb.
- Perf budget: <= 12 GL draws/frame, <= 3.5 ms JS/frame.
- Prettier reflows code: after scripted edits, verify they applied (an exact-string replace can silently no-op).

## Honesty

- Report what is verified versus unverified. No real phone, no native compile in the sandbox: say so.
- Record every judgment call in `DECISIONS.md`. Keep `ROADMAP.md` current.
- Never include model identifiers in repo artifacts.

## Git

- Develop only on the designated branch. Never open a PR unless asked.
- Commit messages: imperative summary, then the attribution trailers the session specifies.
- Commit small and green; push after each verified step.
