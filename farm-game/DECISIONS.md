# Decisions

- **Phaser 3.90.0, not 4.x:** the plan specifies Phaser 3; npm `latest` is now 4, so 3 is pinned explicitly.
- **TypeScript 6.0.3, not 7:** typescript-eslint 8.71 supports TS `<6.1` only.
- **Folder `farm-game/` inside the `claudeing` repo:** the repo already holds an unrelated app at its root, so the game is isolated in a subfolder.
- **Tileset generated at runtime, no PNG yet:** a canvas texture is built in `PreloadScene`; `farm.tmj` references `placeholder.png` only as a Tiled-editor hint and Phaser ignores it. No 1px extrusion until real art in M7.
- **Farm map built by `scripts/generate-farm-map.mjs`:** produces valid `.tmj` that stays editable in Tiled afterward; `collision` layer is hidden and unused until M1.
- **M0 camera is static, zoomed to fit the 40x30 map:** movement and follow camera belong to M1.
- **`GameState` stub added in M0:** keeps state serializable from the start, as the plan requires.

## M1

- **Player position = feet-center in map px; hitbox is 10x6 at the feet:** keeps the sprite's head free to overlap walls (top-down depth) while collision stays tile-friendly.
- **Axis-separated collision with snap-to-edge, plus a 4px corner assist:** gives flush stops and lets a 10px hitbox slide into a 16px doorway without pixel-perfect alignment.
- **Doors trigger on walking onto the door tile; Interact is for objects (bed, bin):** matches the genre; a door tile is walkable, interactables are solid so the player stands beside them.
- **Input is locked after a door until the held direction is released once:** otherwise holding "up" through a door bounces the player straight back out.
- **Door spawn tiles must be walkable and must not be door tiles:** enforced by `tests/maps.test.ts` so map edits can't create loops.
- **Joystick direction uses axis hysteresis (1.25x):** prevents flicker when the thumb sits near a diagonal. Dragging past the rim drags the stick along.
- **Joystick appears only once the thumb passes the deadzone:** short taps (tap-to-use-tool) stay visually clean.
- **Touch buttons are always visible, even on desktop:** simplest, and makes the 844x390 touch check possible anywhere. Revisit with the settings screen.
- **No UI text in M1:** the 480x270 canvas can't render small text crisply; buttons use drawn icons until the bitmap pixel font arrives in M7.
- **Interact button icon is chosen by the target's object type (bed icon, otherwise a generic hand):** adding an object type means adding one icon entry.
- **Map layout lives in Tiled `.tmj` (`ground`, `collision`, `objects` layers); the transient `GameState.player` stores map id + px position:** teleporting through a door is just a state change, then a scene start.
- **`STATE_VERSION` stays at 1:** no saves exist yet; migrations start when SaveSystem lands in M6.

## M2-M6 + polish (playable MVP)

- **Game name "Tiny Acre":** original title; no Stardew names or assets.
- **Logical resolution stays 480x270 with 16px tiles:** decided in M1; UI text uses a hand-built 5x7 pixel font (9-row cell for descenders) generated at boot, so it is crisp at any integer-ish scale.
- **All balance and content in JSON (`items/crops/shops/tools/goals/game/maps`), cross-validated at load and by tests:** a typo fails at startup, not mid-game.
- **Time never reads the wall clock:** `tickTime` is fed capped frame deltas (100ms max) and is simply not called while any panel is open or a flow is running; a backgrounded tab cannot skip hours.
- **Rollover order: crops grow, shipments paid, calendar advances, season-change withering, weeds, energy restore, then autosave:** matches the plan; passed-out nights restore 50% and do not count as "slept in bed".
- **Harvesting always wins over the equipped item:** pressing Action on a mature crop harvests, so players never need to swap tools to collect.
- **Weeds give fiber (2g) and only sprout inside a Tiled `weedzone` object:** gives the scythe a purpose without cluttering the whole farm.
- **Goals are absolute lifetime stats, not "since this goal started":** early play is never wasted; completed goals cascade and pay out together.
- **Shop sells upgrades (can capacity, stamina) as the gold sink:** gives money meaning beyond seeds; prices live in `shops.json`.
- **Fall crops added (pumpkin, yam), winter has no crops:** data-only; keeps seasons 3 and 4 playable without new code.
- **Save = one JSON blob, `version` 2, migration table, backup promoted only if it still loads:** a corrupt main save can never destroy the last good backup. v1 (M1 shape) migrates.
- **Storage: IndexedDB, then localStorage, then memory:** blocked storage (private windows, sandboxed frames) degrades to "no persistence" instead of crashing.
- **Audio is fully procedural (Web Audio):** zero files, instant load; music crossfades day/night by clock. Replaced by real assets in M7.
- **Action repeats while held, but stops after a failure until released:** fast row-work without buzzer spam.
- **A swing roots the player ~200ms:** tools feel weighty; failures root slightly longer.
- **Tint overlays (multiply) for day/night (UI scene) and season (world):** placeholders for the real seasonal tilesets.
- **Shopkeeper NPC is decorative with a greeting:** real NPCs, dialogue and gifts are backlog.
- **Hosting:** the existing Pages workflow now also builds the game and publishes it at `/farm/` beside the existing app; a separate gh-pages workflow would have conflicted with Actions-based Pages.
- **Debug hook `window.__farm`:** exposes state/events/input for automated playtests; read-mostly, harmless in production.

## Weather, balance, QA

- **Weather = sunny/rain only; rain waters every tilled tile on wake-up:** gives a relaxed rhythm break; days 1-2 of a new game are always sunny; winter never rains (snow is backlog). Chance per season lives in `game.json`.
- **Balance is checked by a simulation (`tests/sim.test.ts`):** a tireless greedy bot plays a full year through the real rules. It earns ~40-100k, so ranks are set well above casual play (Green Thumb 4k, Farm Hero 12k, Harvest Legend 25k) and upgrade tracks are deep (stamina x5, can x3) to keep gold meaningful late.
- **Rollover re-entrancy guard:** a second sleep request while one is running is ignored, so a day can never be counted twice.
- **Layout bugs found by screenshot audit and fixed:** goal tracker counter overlapping long goal text, wrapped goal lines overlapping on the Goals tab, bin pager colliding with the 7th row (now 6 rows per page).
