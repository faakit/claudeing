# Probes

Headless-browser scripts that drive the **running** game (the dev server or a built preview) and write screenshots
to `agents/out/`, which is git-ignored. Run them from `farm-game/` with `CHROMIUM_PATH` set (see
[TOOLING.md](../TOOLING.md)).

**Start new probes from `scenario-template.mjs`.** It opens a named scenario on a phone profile with
`scripts/lib/farm.mjs` and waits on game events:

```sh
npm run build && SCENARIO=coop-hens PROFILE=se HAND=left node agents/probes/scenario-template.mjs
URL=http://localhost:5173/ SCENARIO=lab node agents/probes/scenario-template.mjs     # against npm run dev
```

`tests/fixed-waits.test.ts` refuses a new `waitForTimeout` or `sleep` over 100 ms here, as in `scripts/`.

The older probes build their state by hand on the real maps through the `?debug` hook, with fixed waits that are
grandfathered in `scripts/fixed-waits-baseline.json`. Run them as
`URL=http://localhost:5173/ OUT=agents/out/ node agents/probes/<name>.mjs`. Rewrite one on the scenario template
the next time you need it, and delete probes that only reproduce a closed finding.

| Probe                   | Shows                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `scenario-template.mjs` | any scenario, on any phone and hand: the starting point for new probes                              |
| `debug-template.mjs`    | a minimal loop to reproduce an input or targeting bug, with state dumps                             |
| `panels.mjs`            | the farm with forage, sprinklers and a jar; the Craft, Skills, Board, Jar and Fishing sheets        |
| `fishing.mjs`           | the fishing flow end to end (wait, bite, reel)                                                      |
| `town-board.mjs`        | town, and the orders board opened with Interact                                                     |
| `villagers-animals.mjs` | coop and barn with animals, a villager sheet, gifting, the Animals shop tab                         |
| `naive-driver.mjs`      | a remote-controlled phone (taps, holds, drags over a local port) for playing as a first-time player |

The other files are one-off probes for a single feature (`festival.mjs`, `mine.mjs`, `rival.mjs`, ...). Each one
says what it shows in its first lines.
