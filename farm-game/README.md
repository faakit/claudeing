# Tiny Acre

A cozy 2D top-down farming game for the browser (Phaser 3 + TypeScript + Vite).
One complete loop: wake up, farm, ship, shop, sleep, save. Four seasons of 28 days.

## Play

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## Controls

| Action                               | Keyboard               | Touch                                             |
| ------------------------------------ | ---------------------- | ------------------------------------------------- |
| Move                                 | WASD / arrows          | floating joystick (left half)                     |
| Use equipped item on the facing tile | Space (hold to repeat) | big button (right), or tap an adjacent tile       |
| Interact (bed, bin, shop)            | E                      | round button (appears when something is in reach) |
| Pick hotbar slot                     | 1-8, Tab, wheel        | tap a slot                                        |
| Menu (items, goals, options)         | Esc / M                | menu button (top right)                           |

## How to play

1. **Till** soil with the hoe, **plant** seeds on it, **water** with the can (refill at the pond).
2. **Sleep** in the bed. Watered crops grow one day per night; unwatered crops wait.
3. **Harvest** mature crops (Action on them), **ship** them in the bin by the house; gold arrives next morning.
4. Walk east through the gate to **town** and buy seeds and upgrades at the General Store.
5. Follow the goal tracker at the top. Summer 28 ends the first year with a results screen.

The day lasts about 10 real minutes (06:00 to 02:00). Pass out at 02:00 and you only recover half your energy.
The game autosaves when you sleep, change map, close the tab, and every minute.

## Project layout

- `src/systems/` pure game rules (no Phaser): time, farming, inventory, economy, day rollover, goals, save. Unit tested.
- `src/data/*.json` all content: items, crops, shops, tools, goals, maps, balance.
- `src/scenes/`, `src/ui/`, `src/input/`, `src/fx/` rendering and input only.
- `public/assets/maps/*.tmj` Tiled maps (regenerate the placeholders with `npm run gen:maps`).
- `DECISIONS.md` every judgment call. `GOAL.md` the MVP definition.

All art and audio are currently generated in code (placeholders). Real assets are the next step.

## Checks

Hosted build: deployed by `.github/workflows/pages.yml` to `/farm/` on GitHub Pages.

`npm test` (Vitest), `npm run lint`, `npm run format:check`, `npm run build`.
