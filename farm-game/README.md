# Tiny Acre

A cozy pixel-art farming game for phones: portrait and played with one thumb (Phaser 3, TypeScript, Vite). It runs
in the browser, installs as an offline PWA, and wraps into Android and iOS apps with Capacitor.

**Play it:** https://faakit.github.io/claudeing/farm/

## Direction: The Dry Year

The valley is fading: the river shifted and the springs dried. Rosa writes to the grandchild of the farm's last
keeper, and the player comes to restore broken places across the valley. Each restored place opens with a new
mechanic, the valley visibly reshapes as it heals, and Clay goes from rival to ally.

The details are in [docs/VISION.md](docs/VISION.md), [docs/WORLD-PLAN.md](docs/WORLD-PLAN.md) and
[docs/MILESTONES.md](docs/MILESTONES.md). The game below is the base it builds on.

## What is in the game

- **Farming:** till, plant, water, grow and harvest across four seasons of 28 days. Crops come in silver and gold
  quality, improved by fertilizer. Sprinklers, scarecrows, fruit trees, a greenhouse where any crop grows in any
  season, and rare crops in year two.
- **Gathering:** wild goods each morning, a fishing minigame with legendary fish, and a mine with ore nodes.
- **Making:** crafting, preserve jars, kegs, a loom, a furnace, bee houses and a kitchen. Recipes unlock as the
  farming, foraging and fishing skills level up.
- **Animals:** coops and barns with chickens, cows, sheep and pigs, plus a feed silo. Animals that are fed get
  happier and give better goods.
- **People:** Mara (shop), Finn (woods), Rosa (farm), Orin (smith) and Clay, a rival farmer. They have hearts,
  gifts, heart events, birthdays, perks and letters in the mailbox. Clay races you for the town board's requests.
- **A reason to come back each day:** the town board's requests and seasonal special orders, daily jobs from
  villagers, town projects that add buildings, a Founder's Statue, a festival each season, home decorations and
  trophies. A goal tracker introduces each mechanic, and the first year ends with a results screen.
- **A guided start:** a coach that points at one thing at a time on days 1 and 2, then short introductions.
- **Feel:** a pixel-locked camera, an 8-frame walk, weighted tool swings, dither wipes between maps, haptics,
  composed music on CC0 instruments, recorded sound effects, and Calm mode (reduced motion).

## Controls (portrait, one hand)

The world fills the middle, the HUD at the top is read-only, and every control sits in the bottom dock where a
resting thumb lands. Left-handed mode mirrors it (Menu > Opts > Controls).

| Action                                     | Touch                                                      | Keyboard               |
| ------------------------------------------ | ---------------------------------------------------------- | ---------------------- |
| Walk                                       | tap a tile (walks there and acts), or drag anywhere low    | WASD / arrows          |
| Use the equipped item (smart targeting)    | press the big Action button                                | Space (hold to repeat) |
| Work a whole row or plot                   | hold Action until it ticks, then drag the path             |                        |
| Change tools                               | swipe Action up or down, or flick it sideways for the ring | 1-8, Tab, wheel        |
| Interact (bed, bin, shop, board, villager) | the round button above Action, lit when something is near  | E                      |
| Menu (bag, goals, crafting, skills, opts)  | the menu button, in the far corner from Action             | Esc / M                |

Smart targeting: Action looks at the tile in front and the two beside it, and does the most valuable thing there
(picking up or harvesting beats planting, which beats tilling), so you never have to line up exactly.

## Run, test, deploy

```sh
cd farm-game
npm ci
npm run dev              # http://localhost:5173 (add ?scenario=lab for the developer map)
npm run build            # static site in dist/
npm run verify:fast      # lint, types, unit tests, build, smoke e2e (about 30 s)
npm run verify           # every suite: e2e, phones, controls, feel, onboarding, perf (about 6 min)
```

The browser suites need a Chromium: on Windows, set `CHROMIUM_PATH` (see
[agents/TOOLING.md](agents/TOOLING.md)). Append `?debug` to the game URL to expose `window.__farm` for poking at
state.

**Deploy:** fast-forward the branch `claude/repo-code-github-pages-3ukz7j` to the latest integration branch. The
Pages workflow builds the game and serves it at `/farm/` (see [agents/PUBLISHING.md](agents/PUBLISHING.md)).

**Native apps:** `npm run cap:android` or `npm run cap:ios` (see [docs/MOBILE.md](docs/MOBILE.md)).

## How the code is laid out

Dependencies only point down. Scenes never edit state; they call system functions.

```
scenes / ui / input / fx        render and input only (Phaser)        <- covered by the e2e suites
systems/*                       pure rules, no Phaser, emit events     <- unit tested
state/GameState + data/*.json   one serializable state object and validated content
mechanics/*                     each mechanic registers itself into the registries
```

- `src/data/*.json`: all content (items, crops, villagers, goals, maps, balance), validated at load.
- `src/dev/`: the dev sandbox (named scenarios, the lab map, the DEV tab). It never ships to players.
- `public/assets/`: sprites, tilesets, Tiled maps and audio. Their sources and tools are in `art-src/` and
  `audio-src/`.
- `scripts/`: the e2e suites, the benchmark, perf, verify, and the map generators.

Saves are one versioned JSON blob. `systems/save.ts` migrates old versions and sanitises every load, so a damaged
or outdated save cannot crash the game, and a corrupt main save falls back to the backup.

## Docs

| Doc                                      | What it is                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| [docs/VISION.md](docs/VISION.md)         | The direction: The Dry Year (design lane)                                 |
| [docs/WORLD-PLAN.md](docs/WORLD-PLAN.md) | The valley and its broken places (design lane)                            |
| [docs/MILESTONES.md](docs/MILESTONES.md) | The build order (design lane)                                             |
| [ROADMAP.md](ROADMAP.md)                 | What is done and what comes next (design lane)                            |
| [DECISIONS.md](DECISIONS.md)             | Every judgment call, by round, with an index by area                      |
| [docs/EXTENDING.md](docs/EXTENDING.md)   | How to add a mechanic, content, sounds or tutorial steps (the registries) |
| [docs/MOBILE.md](docs/MOBILE.md)         | PWA and native builds, the store checklist, the device checklist          |
| [ASSETS.md](ASSETS.md)                   | Where every sprite and sound comes from, and its licence                  |
| [agents/README.md](agents/README.md)     | For agents: rules, loop, tooling, publishing, next steps, open findings   |

The art prompts are in `art-src/flow/prompts.md` and `edits.md`, and the audio sources in `audio-src/SOURCES.md`
and `prep-report.md`.
