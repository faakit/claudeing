# agents/

Everything an agent needs to work on Tiny Acre: the rules, the loop, the tools, the current state and the open
findings. Start with [AGENTS.md](AGENTS.md), which sends you to `docs/VISION.md` first.

| File                                     | What it is                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                   | The standing rules: product, architecture, definition of done, lanes, handover |
| [PLAYBOOK.md](PLAYBOOK.md)               | The development loop, step by step, and how an agent sees the game             |
| [TOOLING.md](TOOLING.md)                 | Windows setup, gates, ports, the dev sandbox and the other tools               |
| [PUBLISHING.md](PUBLISHING.md)           | How to deploy to GitHub Pages                                                  |
| [NEXT-STEPS.md](NEXT-STEPS.md)           | The direction, and each area's current state, open items and next tasks        |
| [NEXT-STEPS-FEEL.md](NEXT-STEPS-FEEL.md) | The game-feel lane's handover                                                  |
| [NEXT-STEPS-ART.md](NEXT-STEPS-ART.md)   | The art lane's handover                                                        |
| [OPEN-FINDINGS.md](OPEN-FINDINGS.md)     | Every critic finding still open, and the real-phone checklist                  |
| [HISTORY.md](HISTORY.md)                 | What the docs cleanup removed, and how to get it back from git                 |
| [probes/](probes/README.md)              | Headless-browser scripts that drive the running game                           |
| `out/`                                   | Git-ignored scratch for screenshots and benchmarks                             |

Quick start:

```sh
cd farm-game && npm ci
export CHROMIUM_PATH=...                      # see TOOLING.md
npm run dev                                   # then open http://localhost:5173/?scenario=lab
npm run verify:fast                           # for each commit; npm run verify before a merge
```
