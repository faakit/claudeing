# agents/

Everything needed to develop Tiny Acre autonomously with a coding agent: the operating rules, the loop that was
followed, the prompts that steered it, the tools it used, and the probes that let it _see_ the game.

| File                           | What it is                                                              |
| ------------------------------ | ----------------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)         | Standing rules an agent must follow in this repo (read this first)      |
| [PLAYBOOK.md](PLAYBOOK.md)     | The autonomous loop, phase by phase, with the verification gates        |
| [TOOLING.md](TOOLING.md)       | Tools, skills, sandbox quirks and fixes that were needed                |
| [PUBLISHING.md](PUBLISHING.md) | How the playable build is produced and republished                      |
| [prompts/](prompts/)           | The goals given to the agent, and reusable prompt templates             |
| [probes/](probes/)             | Headless-browser scripts that screenshot and poke the real running game |

Quick start for an agent:

```
cd farm-game && npm install
npm run dev                                   # keep running (restart if it dies)
URL=http://localhost:5173/ OUT=agents/out/ node agents/probes/panels.mjs
npm run verify                                # the gate before every commit
```
