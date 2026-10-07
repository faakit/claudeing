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

Copy `debug-template.mjs` for new probes. All use the `?debug` hook (`window.__farm`).
