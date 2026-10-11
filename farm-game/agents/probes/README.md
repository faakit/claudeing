# Probes

Headless-browser scripts that drive the **running** game (dev server or a built preview) and write screenshots to
`agents/out/` (git-ignored). Run from `farm-game/`:

```
URL=http://localhost:5173/ OUT=agents/out/ node agents/probes/<name>.mjs
```

| Probe                   | Shows                                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| `panels.mjs`            | farm with forage, sprinklers, a jar; Craft, Skills, Board, Jar and Fishing sheets |
| `fishing.mjs`           | the fishing flow end to end (wait, bite, reel)                                    |
| `town-board.mjs`        | teleport to town and open the orders board with Interact                          |
| `villagers-animals.mjs` | coop and barn with animals, a villager sheet, gifting, the Animals shop tab       |
| `debug-template.mjs`    | minimal loop to reproduce an input/targeting bug with state dumps                 |

**New probes start from `scenario-template.mjs`**: it opens a named scenario on a phone profile with
`scripts/lib/farm.mjs` and waits on game events (no fixed waits; `tests/fixed-waits.test.ts` refuses new ones over
100 ms). Run `SCENARIO=coop-hens PROFILE=se HAND=left node agents/probes/scenario-template.mjs` after
`npm run build` (or with `URL=http://localhost:5195/` against the dev server). The older probes build their state
by hand on the real maps through the `?debug` hook; they move to scenarios after the round-3 merge.
