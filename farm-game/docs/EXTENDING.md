# Extending Tiny Acre

Every mechanic plugs into the core through a small registry, so adding one means adding a module and one
import line, not editing the core. The built-in mechanics (farming, foraging, sprinklers, jars, orders,
fishing) are written exactly this way and are the best examples.

```
src/mechanics/index.ts      <- one `import './yourMechanic';` line per mechanic
src/mechanics/*.ts          <- registers handlers, hooks, behaviors (no Phaser)
src/systems/*.ts            <- the pure rules a mechanic calls (unit tested)
src/data/*.json             <- the content (validated at load by src/data/index.ts)
src/ui/panels/*             <- the portrait sheets (Phaser only)
```

Rule of thumb: rules in `systems/`, wiring in `mechanics/`, drawing in `ui/` + `scenes/`. Scenes never change
game state themselves; they call a system function.

## 1. What does Action do? (action handlers)

`registerActionHandler({ id, priority, plan })` in `systems/actionRegistry.ts`. `plan` looks at the faced tile
and the equipped item and answers with a plan (`{ plan: { kind, tx, ty, run } }`), a refusal
(`{ refusal: 'text' }`) or `null` ("not mine"). Planning changes nothing; `run` does the work. The first handler
(highest priority first) with an answer wins.

Priorities in use: harvest 100, forage 95, seed / fertilize / place 50, tool 40. One-thumb targeting asks every
nearby tile and acts where the **highest priority** plan exists, so picking things up beats planting beats
tilling without the player aiming.

```ts
registerActionHandler({
  id: 'feed-chicken',
  priority: 90,
  plan({ state, tile, stack }) {
    if (stack?.item !== 'chicken_feed' || !hasChickenAt(state, tile)) return null;
    return { plan: { kind: 'feed', tx: tile.tx, ty: tile.ty, run: () => feed(state, tile) } };
  },
});
```

A new **tool** needs no handler: add it to `items.json` (type `tool`) and `tools.json` with an `action` name, then
`registerToolAction('action-name', ({ state, tile, tool }) => plan | refusal)`. The fishing rod is the example.

## 2. What happens overnight? (day hooks)

`registerDayHook({ id, phase, order?, run })` in `systems/dayHooks.ts`. Phases run in order:
`start, pre-growth, growth, payout, calendar, morning, end`. A hook receives the state and a context
(`weedCandidates`, `forageSpots`, `notes` that appear in the morning summary, `scratch` for passing values to
later hooks). Example: `mechanics/orders.ts` rewrites the town board in `morning`.

## 3. Things placed in the world (placeable behaviors)

1. Add the item to `items.json` with `"placeable": true`.
2. Add an entry to `placeables.json`: `{ name, behavior, solid, sprite, params }`.
3. `registerPlaceableBehavior('name', { beforeGrowth?, onMorning?, interact?, canPickUp? })`.
4. Add the sprite texture in `art/gameArt.ts` (the world renderer draws every placed object from state).

Per-object state lives in `obj.data` (plain JSON, saved automatically). `interact` returns `pickup`,
`message`, or `panel` (open a sheet; see below). See `mechanics/sprinkler.ts` and `mechanics/jar.ts`.

### Processing machines

A jar-like machine is data: add a row to `machines.json` (`days`, `xp`, `recipes: family -> derived item`), an item
plus a `placeables.json` entry with `"behavior": "jar"`, a recipe and a sprite. The keg is exactly this. A machine
with its own rules (the bee house) registers a behavior and may implement `status(obj)` ('idle' | 'busy' | 'ready')
so the world draws the "goods ready" marker with no renderer change.

### Trees and other growing placeables

`trees.json` rows (keyed by the sapling's placeable id) define a fruit tree. The `fruitTree` behavior ages it each
morning and uses two optional hooks any placeable can implement: `status(obj)` (idle, busy, ready) and `sprite(obj)`
(which texture to draw now, e.g. sapling versus tree).

### Animal houses

A coop or barn is just a placeable whose behavior is `animalHouse` and whose `params.species` names a row in
`animals.json` (`item`, `feed`, `product`, `capacity`). A new animal is data plus art: add the animal, feed
and product items, one `animals.json` row, a house in `placeables.json`, and the sprites. Per-house state is
`obj.data.house` (`n`, `fed`, `ready`, `joy`); `systems/animals.ts` holds the rules.

### Villagers

`npcs.json` defines each villager: home map and tile, tint, loved/liked/disliked items, lines by friendship
tier plus rainy-day lines, a daily gift once friends, and **perks by heart level** (`{"2": {"shopDiscount": 0.05}}`).
Perks are summed into `perk(state, key)` just like skill perks, so any system can read them.
`systems/friendship.ts` has the rules (one chat and one gift per day). Add a villager with one JSON entry; they
appear, block their tile, show a "!" until greeted, and open the same panel. A villager with `"role": "shop"` also
gets a Shop button.

## 4. Items: quality and derived goods

A stack is identified by `{ item, q?, of? }` (`systems/itemRef.ts`): quality tier 0/1/2 and, for goods made
from something else (jam, pickles), the item they were made from. Use `addItem(state, ref, qty)`,
`removeStack`, `keyOf`, `displayName`, `sellValue`; never compare item ids alone when quality can differ.
`rollQuality(state, extra, perkKey)` rolls a tier for harvests, catches and finds.

## 5. Skills and perks

`skills.json` defines each skill's XP table and the perks gained at each level. Perk keys are free-form:
a system reads `perk(state, 'yourKey')` and a data row grants it. `addXp(state, skill, n)` emits `levelUp`.
Recipes unlock by skill level in `recipes.json`.

### Perk sources

Anything that grants perks besides skills and hearts registers a source:
`registerPerkSource('id', (state, key) => number)` in `systems/skills.ts`. `perk()` sums every source, so
reading a new perk anywhere works the same no matter where it comes from. Town projects are the example
(`mechanics/projects.ts`).

### Daily jobs and stat watchers

A job is a row in `jobs.json`: who asks (`giver`), the lifetime `stat` it counts, a `qty` range, gold
(`base + perUnit x n`), a `weight`, and optionally `introDay` (always posted that day) and `requires`
(a stat that must be reached first). Any stat that `addStat` increments works, so a new job is data only.
Code that should react to stat changes registers `registerStatWatcher(id, fn)` (see `mechanics/jobs.ts`).

### Letters

`mail.json` lists letters: `from` (a villager), `title`, `text`, an optional `gift`, and `when` (any of `day`,
`stat` + `min`, `npc` + `hearts`, `season` + `date`; all given fields must hold). Each is sent once, the morning
its condition holds. Code can send a letter any time with `sendLetter(state, {...})` in `systems/mail.ts`.

### Town projects

A project is one row in `projects.json`: `gold`, optional `items`, `after` (the project it waits for),
`perks` (granted once finished), a one-line `reward` and an optional `landmark` (map, tile, texture key,
placeholder colour). Progress is kept in stats, so a new project needs no save change.
A plot in `plots.json` with `"project": "<id>"` is owned once that project is finished; with
`"greenhouse": true` crops on it ignore the season. Rules live in
`systems/projects.ts`; the sheet is `ui/panels/ProjectPanel.ts`, opened from the town board.

## 6. Panels and menu tabs

- A **menu tab** is a function: `registerMenuTab({ id, label, build(ctx) })` (label up to 6 characters; five or
  six tabs share the width). `ctx.row`, `ctx.button`, `ctx.label` give portrait-safe layout. See `CraftTab.ts`.
- A **sheet** extends `Modal` (bottom sheet, thumb reachable, dismissible). Open it with an event
  (`gameEvents.emit('openPanel', ...)` or `'placedPanel'`).
- Strings must fit: `fitText` / `measureText` are pure and tests use them, so long text fails a test, not a phone.
- The Interact button's icon comes from `INTERACT_ICONS` in `UIScene.ts` (falls back to a hand).

## 7. Content-only changes

New crops, forageables, fish, recipes, orders, goals and shop stock are JSON edits. Load-time validation in
`src/data/index.ts` fails loudly on dangling references.

## 8. Save compatibility

Add new state to `GameState`, give it a default in `createInitialState`, make `sanitize` in `systems/save.ts`
accept it, and bump `STATE_VERSION` with a migration if old saves need transforming. Tests in
`tests/save.test.ts` show the pattern.

Goals are a list and the save keeps an index into it. If you **insert** goals anywhere but the end, bump
`STATE_VERSION` and migrate with `remapGoalIndex(raw, OLD_IDS)` (the goal ids of the previous release), so
saved players stay on the same goal. Appending at the end needs nothing.

## Checklist for a new mechanic

- [ ] Rules as pure functions in `systems/` with unit tests
- [ ] One module in `mechanics/` registering into the registries, plus one import line in `mechanics/index.ts`
- [ ] Data in JSON; validation added if it references other data
- [ ] UI as a tab or sheet; text proven to fit
- [ ] A goal in `goals.json` that introduces it
- [ ] `npm run verify`
