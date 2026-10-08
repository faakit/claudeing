# Tiny Acre

A cozy 2D top-down farming game for the browser (Phaser 3 + TypeScript + Vite).
One complete loop: wake up, farm, ship, shop, sleep, save. Four seasons of 28 days.

## Play

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## Controls (portrait, one hand)

The game is portrait-only and built for one thumb. The world fills the middle, the HUD (read-only) sits on top,
and every control lives in the bottom dock where a resting thumb lands. Left-handed mode mirrors it (Menu > Opts).

| Action                                  | Keyboard               | Touch                                                |
| --------------------------------------- | ---------------------- | ---------------------------------------------------- |
| Move                                    | WASD / arrows          | floating joystick: drag anywhere in the lower screen |
| Use the equipped item (smart targeting) | Space (hold to repeat) | big Action button, or tap an adjacent tile           |
| Interact (bed, bin, shop, board, jars)  | E                      | round button above Action (appears when in reach)    |
| Pick hotbar slot                        | 1-8, Tab, wheel        | tap a slot                                           |
| Menu (bag, goals, craft, skills, opts)  | Esc / M                | menu button (far corner, away from Action)           |

Smart targeting: Action looks at the tile in front **and the two beside it** and does the most valuable thing
available (pick up or harvest beats planting beats tilling), so you never have to line up exactly.

## How to play

1. **Till** soil with the hoe, **plant** seeds, **water** with the can (refill at the pond). **Sleep** to grow crops.
2. **Harvest** crops (quality is random: silver and gold sell for more; fertilizer improves the odds), **ship** them in the bin.
3. **Forage**: wild goods appear on the ground each morning, on the farm, in town and in the woods. Just walk up and press Action.
4. **Fish**: equip the rod, cast at water, tap when the bobber dips, then hold to lift the bar and keep the fish in the green.
5. **Craft** (Menu > Craft): fertilizer, bait, sprinklers, preserve jars. Recipes unlock as your skills level up.
6. **Preserve**: put fruit in a jar for jam or vegetables for pickles; collect after a few mornings. Worth far more than raw.
7. **Orders**: the town board posts three requests every morning that pay well above the shipping bin.
8. **Animals**: craft a coop (and later a barn), buy chickens and feed in town. One tap on the coop moves animals in, collects eggs and feeds them. Fed animals get happier and lay better-quality eggs; hungry ones sulk.
9. **Villagers**: Mara (shop), Finn (woods) and Rosa (farm) greet you with a "!" each day. Chat once a day and give gifts to grow hearts; hearts unlock discounts, daily presents and perks.
10. **Skills**: farming, foraging and fishing level up with use and grant perks (quality, energy, double finds, wider fishing zone).
11. **Town projects**: the town board's "Town projects" button lists projects the whole town funds. Give gold and goods a little at a time; each finished one helps for good (more requests, faster skills, more energy, better prices) and adds a building to town.
12. **Home**: the shop's Home tab sells a Bigger Bag (more slots) and decorations (fences, paths, pots, lamps, a fountain). Place them like a sprinkler; tap twice with Interact to pick one up.
13. Follow the goal tracker at the top; each goal introduces a new mechanic. The first year ends on Winter 28 with a results screen.

## Project layout

- `src/systems/` pure game rules (no Phaser): time, farming, inventory, economy, day rollover, goals, save. Unit tested.
- `src/data/*.json` all content: items, crops, shops, tools, goals, maps, balance.
- `src/scenes/`, `src/ui/`, `src/input/`, `src/fx/` rendering and input only.
- `public/assets/maps/*.tmj` Tiled maps (regenerate the placeholders with `npm run gen:maps`).
- `src/mechanics/` each gameplay mechanic registers itself (actions, day hooks, placeable behaviors). See [docs/EXTENDING.md](docs/EXTENDING.md) for how to add one.
- `ROADMAP.md` what we build next, in priority order.
- `DECISIONS.md` every judgment call. `GOAL.md` the MVP definition.

All art and audio are currently generated in code (placeholders). Real assets are the next step.

## Phones and stores

The same code runs as a website, an installable PWA (fullscreen portrait, works offline once visited), and
Capacitor apps for Android and iOS (`android/`, `ios/`). `npm run cap:android` / `npm run cap:ios` build the web app,
sync it, and open the native IDE. See [docs/MOBILE.md](docs/MOBILE.md) for build steps, the store checklist, what is
verified automatically, and the manual device checklist.

## Architecture in one minute

Dependencies only point downward. Scenes never edit state directly; they call system functions.

```
scenes / ui / input / fx   render + input only (Phaser)         <- covered by `npm run e2e`
        |  call
systems/*                  pure rules, no Phaser, emit events   <- unit tested (~95% lines)
        |  read/write
state/GameState + data/*.json   one serializable state object + validated content
```

Saves are one versioned JSON blob. `systems/save.ts` migrates old versions and _sanitises_ every load
(unknown items dropped, numbers clamped, missing fields defaulted), so a damaged or outdated save cannot
crash the game; a corrupt main save falls back to the backup.

## Checks

Hosted build: deployed by `.github/workflows/pages.yml` to `/farm/` on GitHub Pages.

`npm test` (Vitest), `npm run coverage`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`.

`npm run verify` runs everything below in one go. `npm run e2e:mobile` checks phone profiles (notch insets, 44px touch targets, portrait overlay), `npm run perf` enforces render budgets (GL draw calls and JS time per frame).

`npm run e2e` plays the core loop (new game, till, plant, water, sleep, reload, continue) in headless Chromium
against the production build (`npm run build` first; set `CHROMIUM_PATH` if Chromium is not at the default
Playwright cache path). Append `?debug` to the game URL to expose `window.__farm` for poking at state.
