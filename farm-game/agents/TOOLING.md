# Tooling used

## Stack

Phaser 3.90, TypeScript (strict, `noUncheckedIndexedAccess`, `noUnusedLocals`), Vite, Vitest, ESLint + typescript-eslint,
Prettier, playwright-core (Chromium at `/opt/pw-browsers/chromium`), Capacitor 8 (Android/iOS generated and synced).

## Agent tools

- File tools (Read/Write/Edit/Grep/Glob) for code; Bash for npm scripts, git, probes, Python one-off edits.
- Task list (TaskCreate/TaskUpdate) to track milestones.
- Artifact tool to publish the playable build; `list` / `files` scopes to diff what is live.
- Screenshot reading (Read on PNGs) as the visual review step.
- No `gh` CLI in the sandbox; GitHub goes through MCP tools (not needed when only pushing the branch).
- Optional: sub-agents for independent searches; a workflow tool for large fan-out reviews (not required here).

## Scripts (in package.json)

`dev`, `build`, `test`, `lint`, `typecheck`, `format`, `gen:maps` (portrait Tiled maps), `e2e`, `e2e:mobile`,
`perf`, `verify`, `cap:*`, `assets`.

## Sandbox quirks and fixes

| Symptom                                                     | Fix                                                                                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Vite dev server disappears between commands                 | `setsid nohup npx vite --port 5173 --strictPort >/tmp/vite.log 2>&1 &` then wait with `until curl -sf localhost:5173; do sleep 1; done` |
| Port already in use on restart                              | the old server is still alive; reuse it                                                                                                 |
| Foreground command over 120 s                               | run in background and read the output file; use `timeout` for long verify runs                                                          |
| Scripted replacements silently no-op after Prettier         | assert the old string exists before replacing; re-run tsc                                                                               |
| `measureText` in a Phaser-importing file crashes Node tests | keep pure maths in `ui/fontMetrics.ts`, import that                                                                                     |
| Headless GL looks slow                                      | judge by draws and JS ms per frame, not FPS                                                                                             |
| Software-GL console warnings                                | harmless; filter to `error` for assertions                                                                                              |
| Native build impossible (no Android SDK / Xcode)            | generate and sync projects; list as unverified in `docs/MOBILE.md`                                                                      |
| Egress blocked hosts                                        | do not fetch; vendor or generate assets locally                                                                                         |

## Conventions the tools rely on

- `?debug` exposes `window.__farm = { game, getState, gameEvents, inputHub, audio }`.
- Keyboard: WASD/arrows move, Space action (hold repeats), E interact, 1-8 hotbar, Esc/M menu, Enter confirms.
- Hotbar slots 0-3 are tools (hoe, can, scythe, rod); Digit5 is the first free slot.
