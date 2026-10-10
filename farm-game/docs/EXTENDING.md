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

### Auto tool (which hotbar item Action uses)

With auto tool on (the default) and a farm item in hand, Action asks every item registered with
`registerAutoItem({ id, priority, eligible(stack, def) })` (`systems/autoTool.ts`) and runs the most valuable
plan any of them has for the nearby tiles (handler priority first, then the tile in front, then the auto item's
`priority`). Built-ins: seeds 50, can 40, scythe 35, pickaxe 30, hoe 20. Only one seed kind is a candidate: the
one in hand, else the last one planted, else the first on the hotbar. Holding anything that is not an auto item
(the rod, a placeable, fertilizer, goods) is an explicit choice and Action uses only that. Handlers still read
the selected slot: auto tool plans and runs a choice with that slot selected for that instant, so a handler
needs no change. A new tool that should be picked automatically registers an auto item; one that must stay a
deliberate choice (like the rod) does nothing.

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
A project with `"repeat": { "growth": 1.5, "perkLevels": 5 }` never closes: each level costs `growth`
times the last, and its perks stack for the first `perkLevels` levels (the Founder's Statue).
A repeatable project's landmark may say `"levels": 6`: level n then shows the texture `<sprite>_<n>` (the last
one from then on), and the placeholder grows with the level until the art lands.

### Trophies at home

`game.json` `trophies` lists lasting trophies: `stat` (shown once it reaches 1), `map` and tile, texture key,
placeholder colour and a `text` read on a tap, with `{n}` the stat's value. They are drawn and blocked like
landmarks (`landmarksOn` in `systems/projects.ts` returns both). The board trophy counts `boardWins`, the festival ribbons `festivalWins`, the legend wall `legends`.

### Festivals

`festivals.json` picks a `mode`: `single` (one item), `basket` (up to `slots` different goods; quality does
not make a good different) or `derby` (the day's best catches). A basket's variety bonus counts `kinds`:
`[{ "name": "Veg", "families": ["veg"] }, ...]`, first match wins, and a good that matches none is its own
kind. A derby may name a `stocked` fish that bites on some maps whatever the weather.

### Moving occupied buildings

A placeable behavior with `occupants(obj)` (what would come along: "3 chickens") is moved from the Move
sheet instead of a second tap whenever it holds something; with `keepsData` its state rides along.

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

## 9. Sounds and music

Game code only calls `audio.play('<cue>')` with an id from the `Sfx` union in `src/platform/audio.ts`.

- **Reuse a cue** where one fits (`ui`, `select`, `coin`, `error`...): no audio work at all.
- **Add a sound:** add the id to the `Sfx` union and `SFX_IDS`, and a synthesized version in `playSynth`
  (the fallback, also what plays before files load). Then, for a recorded take, add the source file to
  `audio-src/sfx-sources.json` (page, author, licence: CC0 or CC-BY only) and a recipe in
  `audio-src/recipes.json` (`sfx.<id>`: family, 2-4 variants cut from sources, pitch/volume spread, voice
  cap). Run `python -I audio-src/tools/fetch.py <raw-dir> --lock`, `python -I audio-src/tools/build.py
<raw-dir>` and `python -I audio-src/tools/sources_md.py`; credit it in `ASSETS.md`. A short musical
  cue can instead be a jingle in `audio-src/tools/music_src.py` (`JINGLES`, written in C, played in the key
  of the current piece). `tests/audio-assets.test.ts` checks every id resolves.
- **Touch-control cues** (for the one-thumb controls; all soft, 75 ms or shorter, about -28 LUFS max
  momentary at the output, under the `ui` click, and 8 dB softer when repeated within 350 ms):

  | id          | use it for                                                         |
  | ----------- | ------------------------------------------------------------------ |
  | `tick`      | each tile painted while dragging a row; stepping a target preview  |
  | `target`    | a tap that sets a walk-and-act target (the preview marker appears) |
  | `ringOpen`  | the tool ring opens                                                |
  | `ringClose` | the tool ring closes without a choice                              |
  | `confirm`   | a tool picked in the ring, or a painted row committed              |

  Haptics policy (so a tap never gets both a click and a buzz on every action): frequent events (tile
  ticks, target previews, steps) are sound only; a haptic pulse goes with rare, deliberate events only
  (ring open, tool picked, row committed, error), at most one per 150 ms. With haptics off nothing in the
  audio changes. `render.mjs` jobs `tap-dry-<id>` / `tap-rapid-<id>` render ten taps a second for 5 s.

- **Music** lives in `audio-src/tools/music_src.py` (regenerate `src/audio/music.json` with it): chords
  per section, accompaniment patterns, composed phrase pools. Which piece plays is decided in
  `src/audio/director.ts`. Tests reject phrases whose bars do not add up and notes no sample can reach,
  and keep the pieces apart (own A progression and cadence, chord-bigram and melody 3-gram overlap
  limits, on-beat melody notes that are chord tones or resolve by step); `python -I
audio-src/tools/seasons.py [--renders <dir>]` prints the same numbers.
- **Check the mix** with `node audio-src/tools/render.mjs <dir>` (against a running dev server) and
  `python -I audio-src/tools/measure.py <dir>` (`sfxlevels.py <dir>` for each cue's output level against
  its target; the `trim` in a recipe closes the gap), then listen on a phone.

## 10. The guided start (tutorial steps)

A brand-new game runs a guided start: one instruction line at the top of the world view, a ring and a hand on
one target, and a one-word tag on a HUD element. It is data: `src/data/tutorial.json` (validated at load by
`validateTutorial`), rules in `systems/tutorial.ts` (pure, unit tested), drawing in `ui/CoachMarks.ts`.

- **Tracks:** `day1` steps run in order from New Game, `day2` steps once day 2 begins, then `intro` steps one
  at a time whenever their `when` holds (shown once each).
- **A step** has a `text` (one row, at most 184 px: a test measures it), a `target` (what to point at),
  `done` (any of these finishes it), optional `skip` (it cannot be done now: pass it), `alt` variants (the first
  whose `when` holds replaces the text and target), `tag` (a HUD element), `teaches` (stats set when it shows,
  e.g. `tip.paint` so the old first-run tip does not repeat it), `leave` (an intro that was shown and whose
  `when` stopped holding is finished) and `optional` (its line offers Next after a long stall).
- **Conditions** read the state and what the screen shows: `stat`/`fresh` with `min`/`max` (counted from the
  guide's start or the step's first showing), `map`, `day`, `panel`, `tab`, `selected`, `has`, `none`/`some`
  (ripe, dry, crops, wetCrop, emptySoil, seeds, shippable, forage, unread, readLetter, placeable), `energyBelow`,
  `minute`, `job`, `npc`, `fact` (npcNew, forageInView), and `any`/`all`/`not`.
- **Targets:** `find` (nearest ripe, dry, emptySoil, workable, forage, node, npcNew; `stand` points at a free
  tile beside it), `npc`, `object` (bin, bed, mailbox, board, shop), `door` (the door to a map), `ui` (action,
  menu, interact, seedSlot, placeSlot), `gesture` (paint, ring), `button` (a regular expression for a button in
  the open sheet; `a||b` lists them by priority), `hud`, and `action` + `else` (Action when it would do one of
  these kinds right now, else the `else` target). A target with a `map` the player is not on points at the door
  that leads there; with a sheet open and a world target, the coach points at the sheet's close button.
- **A new feature's introduction** is one `intro` step: a `when` for the moment it matters, a target, a `done`
  for the action it teaches, and `leave: true`. No code.
- **State:** progress is stats only (`tut.<id>`, `tut.on`, `tut.off`, `tut.seen.<id>`, `tut.at.<id>.<stat>`,
  `tut.base.<stat>`, `tut.gift`). `?tutorial=0` in the URL starts a bare new game (automated checks use it).

## Checklist for a new mechanic

- [ ] Rules as pure functions in `systems/` with unit tests
- [ ] One module in `mechanics/` registering into the registries, plus one import line in `mechanics/index.ts`
- [ ] Data in JSON; validation added if it references other data
- [ ] UI as a tab or sheet; text proven to fit
- [ ] A goal in `goals.json` that introduces it
- [ ] An `intro` step in `tutorial.json` if it needs showing the first time
- [ ] `npm run verify`
