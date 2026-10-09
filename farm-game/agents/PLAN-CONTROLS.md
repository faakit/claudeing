# Controls plan: one thumb, portrait

Status: plan only. No game code was changed. Evidence lives in `agents/out/controls/` (screenshots, JSON,
scripts in `tools/`). Branch `controls/plan`, from `integration/agents-2026-10-08`.

**Honesty first.** Everything here was measured in headless Chromium with emulated touch (CDP
`Input.dispatchTouchEvent`) on five emulated phone profiles. No real phone and no real hand was involved. The
thumb zones are a geometric model built from published studies, not a measurement of anyone's grip. Frame counts
come from the game's own loop in headless Chromium (about 85 fps, software GL), so they show the game's own delay
only. A real phone adds roughly 35 to 140 ms of touch-sensing and display latency on top (LaTARbot study, below).
What the owner should try by hand is in section 6.

## Owner decisions and rulings (2026-10-08/09)

Implementation status lives in `DECISIONS.md` ("One-thumb controls") and `agents/out/controls/bench-m*.md`.
Rulings that change this plan: tap-to-move and auto tool are on by default; auto tool never picks the rod or
placeables; a tap never tills or plants (only harvest, water, clear, mine, pick up, refill, cast, open, talk);
a held Action repeats only the step it started with; what you hold wins whenever it can act; seeds come only
from the selected slot or the seed planted last (no first-seed fallback); interact targets have no magnets
(own tile or drawn sprite only); Menu sits in thumb reach and acts on release; haptics light and on.
Ruling of 2026-10-09 (after reviews 3 and 4): world touches never paint or till by duration; rows are painted
from Action (hold 300 ms, drag a straight line, lift); the tool ring is the sideways flick only and never acts,
a quick flick leaves it open as a tap menu; Options volume rows sit by the tabs. This answers open question 3
("paint from Action").

## How to reproduce

```
npm run build
node node_modules/vite/bin/vite.js preview --port 5179 --strictPort     # keep running
export CHROMIUM_PATH=".../chrome-win64/chrome.exe"
node agents/out/controls/tools/reach-map.mjs          # reach.json, reach-summary.json, reach/*.jpg
node agents/out/controls/tools/feel-probe.mjs         # feel.json (movement, latency, conflicts)
node agents/out/controls/tools/targeting-probe.mjs    # targeting.json, targeting/*.png
PROFILES=i13,promax,se,pixel7,fold REACTION_MS=0 node agents/out/controls/tools/one-thumb-bench.mjs
PROFILES=i13 REACTION_MS=180 SUFFIX=-reaction180 node agents/out/controls/tools/one-thumb-bench.mjs
PROFILES=i13 STOP=center REACTION_MS=120,180 TASKS=plot3x3,sell,villager,machine,bagUse SUFFIX=-human \n  node agents/out/controls/tools/one-thumb-bench.mjs
node agents/out/controls/tools/analyze.mjs > agents/out/controls/tables.md
```

Profiles (CSS viewport, safe-area insets as in `scripts/e2e-mobile.mjs`): iPhone SE 375x667, iPhone 13/14
390x844, iPhone 15 Pro Max 430x932, Pixel 7 412x915, Galaxy Fold cover 280x653. One logical px is 1.40 (Fold) to
2.10 (Pro Max) CSS px, so **one 16 px tile is 4.0 mm (SE) to 5.6 mm (Pro Max) on the glass**, against the 9.2 mm
that Parhi, Karlson and Bederson found a thumb needs for a reliable discrete tap.

## The reach model

Published work does not give a ready-made zone map, so the model is built from what the studies did measure.

- **Hoober 2013** (1,333 observations, UXmatters): 49% of people touching the screen held the phone in one hand;
  of those, 67% used the right thumb and 33% the left. Grips change every few seconds. Hoober later disowned the
  green/yellow/red drawings in that article, so they are not used here.
  <https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php>
- **Hoober 2017**: people prefer the centre; about 7 mm targets suffice at the centre, about 12 mm in corners
  (95% of taps). <https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php>
- **Le, Mayer, Bader, Henze, CHI 2018** (motion capture, 16 people, four phones from 4.0" to 6.0"): the thumb's
  comfortable area on the front is **36.4 cm² (SD 3.3), and it does not grow with the phone**. People hold
  bigger phones higher. <https://www.medien.ifi.lmu.de/pubdb/publications/pub/le2018fingersrange/le2018fingersrange.pdf>
- **Karlson, Bederson, Contreras-Vidal** (one-handed studies): the lower corner on the holding side is awkward
  because it is **too close** to the thumb base, not too far; comfort ratings fall with device size.
  <https://api.drum.lib.umd.edu/server/api/core/bitstreams/3610dd7f-2dd1-433d-9385-56b1c7588661/content>
- **Hurff 2014**: the comfortable zone stays the same size on every phone; the "Ow" zone grows with the screen.
  It is a best guess, not a measurement. <https://www.scotthurff.com/posts/how-to-design-for-thumbs-in-the-era-of-huge-screens/>
- **Bergstrom-Lehtovirta and Oulasvirta, CHI 2014**: the thumb's functional area fits a quadratic model of hand
  size, device size and grip. No radii were extractable; used only as support for an annulus around a pivot.
- **Target sizes**: Parhi, Karlson, Bederson 2006, 9.2 mm (single tap) and 9.6 mm (serial taps) for one thumb
  (<https://www.microsoft.com/en-us/research/?p=155150>); Apple 44 pt; Android 48 dp, "about 9 mm"
  (<https://support.google.com/accessibility/android/answer/7101858>).

**Model** (`tools/lib.mjs`, `THUMB`): the thumb pivots at a point 12 mm outside the holding edge and 20 mm above
the bottom of the phone body (13 mm chin added on the SE). Distance from that pivot: 25 to 68 mm is
**comfortable**, 15 to 25 mm (too close, Karlson) or 68 to 85 mm is **stretch**, anything else is **hard**. Mirrored
for the left hand. Check against Le et al.: the comfortable area this gives is 33.1 cm² on every modern profile
(29 cm² on the small SE screen), inside one SD of their 36.4 cm², and constant across phone sizes as they found.
The hard area grows from 15 cm² (SE) to 53 cm² (Pro Max), as Hurff describes. This is still a model: a
real hand, a case, a second hand cradling, or a shifted grip all move it.

## 1. Diagnosis

Severity: **High** = makes the core loop feel bad every minute; **Medium** = a regular annoyance or a mis-tap
risk; **Low** = polish. Every finding cites its evidence file under `agents/out/controls/`.

### D1 (High). Walking and working are two separate controls under one thumb, so the thumb shuttles

- The floating joystick and the Action button are both under the same thumb, but in different places: the
  joystick starts in the open dock (left of Interact), Action sits in the corner. Walk, lift, move to Action,
  hold, lift, move back, walk one tile, and so on.
- Measured (bench, iPhone 13, right thumb, perfect bot): **till, plant, water and harvest a 3x3 plot = 26
  gestures** (12 drags, 12 holds, 2 hotbar taps), **20 s**, and **933 mm of thumb travel, 739 mm of it in the air**
  between the two controls (Pro Max 1,025 mm, SE 744 mm; `tables.md`). Every one of those touches lands in the
  comfortable zone: the problem is the count and the shuttling, not reach.
- A hold works only the 3 tiles in front (front plus 2 sides), then stops: the thumb must go back to the stick
  to step one tile (`feel.json` `latencyActionHold`: uses at 111, 313 and 515 ms, then nothing).
- A swing roots the player for 200 ms, so you cannot walk and work at the same time even with two thumbs.
- Evidence: `bench.json` (`plot3x3`), `reach/i13-right-dock.jpg` (stick area and Action are 94 logical px,
  about 30 mm, apart).

### D2 (High). Stopping on, and facing, one 5 mm tile is a timing game

- Movement is 4-way, one speed (4 tiles/s), no acceleration, no snap. The player stops wherever the thumb lifts.
- A flick meant only to turn always walks: 60 ms moves 5.3 to 5.8 px (a third of a tile), 140 ms moves 10 px and
  changes tile in 2 of 3 starts (`feel.json` `stopAndTurnFlicks`). There is no turn-in-place on the stick.
- The tile you stand on is decided by an invisible edge (the hitbox centre), not by what the sprite looks
  like. A bot that lets go up to 250 ms after crossing that hidden edge never needs a correction
  (`bench-reaction180.json`). A person aims at the **sprite looking centred** on the tile. Modelled that way
  (`STOP=center`, release 120 ms after the sprite is centred, then short nudges to fix the stop; a crude human):
  the 3x3 plot took **51 gestures instead of 26, 25 stop corrections, 29 s instead of 20 s and 1,166 mm of thumb
  travel**; sell, villager and machine each needed 2 extra nudges and the bag task 3 (`bench-human.json`, both
  hands alike). At 180 ms the nudging bot stopped converging inside 4 nudges in several stops (the plot ended with
  6 of 9 tiles planted, one bag task failed). Real hands adapt better than this bot, so read the numbers as
  "stopping is timing-sensitive", not as a prediction.
- Diagonal drags snap to one axis: a 40-degree drag walked 47 px right and 0 px up (`diagonal40deg`). Fine for a
  grid game, but it means "go up and right" is two strokes.
- Evidence: `feel.json`, `bench-reaction180.json`, `bench-human.json`.

### D3 (High). Tapping the world mostly does nothing, and sometimes does two things

- The most natural phone gesture, tapping the thing you want, works only on the 4 tiles touching the player.
  A tap 2 tiles away does nothing at all: no sound, no marker, no message (`feel.json` `tapTile`).
- Taps at y >= 150 logical also start the floating joystick. The joystick deadzone (6 logical px) is smaller
  than the tap tolerance (8 px), so a tap whose pad rolls 7 px **both walks 7 px and acts** (`tapWobble7`). Critique
  1 and 2 suspected this; it is now reproduced.
- Tiles are 4.0 to 5.6 mm on screen, below every target-size guideline, so tap-to-act needs snapping and a
  preview to be precise (section 3).

### D4 (Medium). The dock has hidden hit conflicts

- **Interact steals part of Action.** Interact's hit circle (radius 29 logical px) overlaps Action's (radius 36) and wins (it is
  created later). 10.8% of the Action button's drawn disc, its lower-left edge (the side the thumb arrives from),
  opens Interact when something is in reach. A real touch there opened the shipping bin
  (`feel.json` `interactOverlap`; the overlap is visible in `reach/i13-right-dock.jpg`).
- **Menu fires on touch-down.** A joystick drag that starts on the Menu's hit circle (radius 22 logical px) opens the menu
  (`dragStartingOnMenu: true`). The dock is the joystick's home, so this is a real mis-tap path.
- Press semantics are mixed: Action, Interact, Menu and hotbar act on touch-down; sheet buttons act on release
  (0 frames after lift). Nothing can be cancelled by sliding off except sheet buttons.

- **Edges and system gestures (not testable headless).** On iPhone 13 and Pro Max the hotbar's bottom edge is
  about 10 CSS px above the home-indicator area, so an upward swipe that starts low on the hotbar can reach the
  iOS home gesture. On Pixel 7 (and every 1:2-or-narrower phone) the canvas spans the full width, so Action's hit
  circle reaches the right screen edge, where Android gesture navigation's back swipe starts. Double-tap zoom,
  pinch, long-press menus and text selection are blocked by the viewport meta, `touch-action: none` and
  `preventDefault` on `dblclick`, `contextmenu` and Safari's gesture events (code read: `index.html`,
  `platform/display.ts`); the safe-area frame keeps the canvas clear of notches (`e2e:mobile` checks it).

### D5 (Medium). Changing tool costs swipes or a stretch, and the hold is fragile

- Swipe on Action: 14 logical px (4.4 mm) per step, through every slot including empty ones. Hoe to seeds is
  **5 swipes up or 3 down** (the slots wrap, and slots 7 and 8 are empty but still stops); hoe to rod is 3 (`bench.json` `switchSwipe`, `fish`). Action sits 36 px below the top of the
  dock, so long swipes leave the dock.
- The hotbar is one row across the whole bottom edge: slot 1 and slot 8 are stretch for both hands on
  iPhone 13, Pixel 7 and Pro Max (Pro Max right: only slots 3 to 7 comfortable). See `tables.md`.
- Hold-to-repeat is cancelled by 4 logical px of vertical drift (1.3 mm on iPhone 13), because a drift arms the
  swipe. A press whose pad rolls 2.5 mm turned a 1.2 s hold into one action instead of three
  (`feel.json` `holdJitter`). Real thumbs roll while pressing; this needs a hand test, but the margin is thin.
- Good: critique 3's slow-swipe bug is fixed. Swipes from 60 to 500 ms never used the old tool (`swipe`).

### D6 (Medium). Left-handed mode mirrors only the dock

- Sheets keep their row buttons on the right edge. For a left thumb on iPhone 13, 8 of 10 bin targets, 3 of 4 in the gift list, 2 of 4 in the jar sheet, 3 of 5 on the board and 11 of 17 in the shop lie outside the comfortable zone (the bin's top "All" is hard); for the right thumb all of these are comfortable except 4 shop tabs/arrows
  (`tables.md`, `reach/i13-left-bin.jpg`, `reach/i13-left-npc-gift.jpg`, `reach/i13-left-shop.jpg`). Hoober's
  data puts about a third of one-handed users on the left thumb.
- Options rows (volume -/+, toggles) sit in the upper sheet: hard or stretch for both hands
  (`reach/i13-right-menu-opts.jpg`).

### D7 (Medium-Low). The target marker and feedback under-tell

- The marker is 1 logical px corner brackets (0.3 mm line on an iPhone 13). "Will work" and "will not work but the
  tile is walkable" are drawn **identically** (white); only blocked tiles get the faint style
  (`WorldScene.highlightKind`, crops in `targeting/*.png`). You learn that Action will fail by pressing it.
- Smart targeting can act on a tile you did not mean: with the front tile already tilled, the hoe tills a side
  tile; with a jar in front, a sprinkler is placed beside it; with seeds in hand, a ripe side crop is harvested
  instead of planting in front (`targeting.json`). The marker does show the chosen tile before the press, which
  helps, but a held press moves on to the sides on its own, so a hold makes a 3-wide strip, never a line.
- Haptics fire only on hotbar taps, failures and celebrations: not on a successful action, a tool swipe or
  Interact. iOS Safari has no vibration at all (web); the native shell does.
- Latency inside the game is fine: the stick moves the player 2 frames after the touch, the Action press shows
  in 2 frames, hotbar selection in the same frame. Two built-in delays: the first held use comes 110 ms after
  touch (the swipe guard), and a tap acts on release.

### D8 (Low). Reach of rarely used controls

- Menu is stretch on iPhone 13 (71 mm from the pivot), Pixel 7 (73) and Pro Max (77); comfortable on SE and
  Fold. That is by design (away from Action), and fine once it cannot be hit by accident (D4).
- The HUD is hard to reach, but it is read-only; the goal tracker is not a button, so nothing is lost.
- Smallest touch targets (`tables.md`): bag cells are 37 CSS px on the SE and 32 on the Fold, under the 44 px house rule; the dock and sheet buttons pass on every modern profile (44 to 48 px). `e2e:mobile` only measures the game screen, so the bag grid slipped through.

What already works and must be kept: the floating joystick (no fixed spot to find; Baldauf et al. 2015 found a
floating stick reduced how often players had to look at it), the big Action in the thumb corner (comfortable on
every profile in the model, 26 to 30 mm from the pivot), Interact one short slide away (comfortable everywhere),
bottom sheets with their main buttons low, swipe that no longer acts, "All" in machine sheets, and a drag that
drifts onto Action keeps walking and does not fire Action on lift (`joystickOntoAction`).

## 2. Target experience

Rest the thumb in the lower right (or left) third. **Tap anything you can see and the farmer walks there and
does the obvious thing with the right tool**: hoe on grass, seeds on tilled soil, can on dry crops, a harvest on
ripe ones, talk to a villager, open the bin. Press and drag across a row of soil and the farmer works the whole
row. The joystick is still there for wandering, and when you let go you stand on a tile, facing where you
pushed. Tools change themselves for farm work; a sideways flick on Action opens a small ring for the specials
(rod, placeables). Every touch on the world answers within one frame with a marker that says what will happen,
in a colour that says whether it can.

Target costs (iPhone 13, right thumb, perfect bot unless noted; "now" is measured):

| Loop                                  | Now (gestures)                    | Target                          | How                                    |
| ------------------------------------- | --------------------------------- | ------------------------------- | -------------------------------------- |
| 3x3 plot: till, plant, water, harvest | 26, 933 mm travel, 2 tool changes | <= 8                            | auto tool (M3) + paint a row (M5)      |
| Same, human-like stop (120 ms)        | 51 (25 corrections), 29 s         | <= 8, 0 corrections             | snap on release (M2), taps (M4)        |
| Switch hoe -> seeds                   | 3 to 5 swipes, or 1 hotbar tap    | 0 for farm work; 2 for specials | auto tool (M3), ring (M6)              |
| Open the bag and use an item          | 5 (Menu is a stretch)             | 3                               | ring has "Bag" (M6)                    |
| Sell three kinds at the bin           | 6                                 | 3                               | tap the bin (M4) + "Ship all" (M1)     |
| Talk to and gift a villager           | 5                                 | 4                               | tap the villager (M4)                  |
| Load a machine                        | 3                                 | 2                               | tap the machine (M4)                   |
| Fish once                             | 7 + reel holds (9 to 16 measured) | 5 + reel holds                  | ring (M6) + tap the water (M4)         |
| Farmhouse door to town                | 1 drag, 8.9 s                     | 1                               | unchanged (or one tap on the exit, M4) |

## 3. Options considered

Patterns from shipped games (sources in the research notes at the end):

- **Stardew Valley mobile** ships nine control schemes; the default is "tap-to-move and auto-attack". Tapping a
  tile walks there; tapping stone, wood or a stump **picks the right tool**; tapping a villager walks there and
  talks (and gives a selected gift). Holding walks straight toward the finger. The wiki itself recommends a
  joystick scheme for precise placement, and notes accidental tool changes from edge taps.
  <https://stardewvalleywiki.com/Mobile_Controls>
- **Hay Day**: tap a field, then drag the sickle (or seed) across fields to act on all of them in one gesture.
  <https://gigazine.net/news/20141009-hay-day-review/>
- **Animal Crossing: Pocket Camp, Monument Valley**: tap a destination to walk a path; tap objects to act.
- **Archero, Survivor.io**: one portrait thumb on a joystick, everything else automatic.
- **Sky: Children of the Light** offers an explicit one-handed scheme (and reviewers found it unreliable),
  **Vampire Survivors** added stick options after launch: expect to ship options, not one scheme.

| Option                                                          | Discoverability                                     | Precision on 4-6 mm tiles                                                                    | 5-minute session                                       | Accessibility                         | Architecture fit                                                      |
| --------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------- |
| **A. Tap a tile to walk there and act** (path + preview)        | Best: the default phone gesture                     | Poor raw (tile < 9 mm); good with snap-to-actionable, preview on press and commit on release | Great for errands (bin, villager, machine): 1 tap each | Good: no sustained drag, no timing    | Pure pathfinding + intent in `systems/`, a route source in `InputHub` |
| **B. Drag to move, act on release**                             | Medium                                              | Medium; every stop acts, so stopping to look acts by accident                                | Fast for rows, bad for wandering                       | Poor: sustained drag, accidental acts | Easy, but makes every release a commitment                            |
| **C. Context single button (auto tool)**                        | Good once seen ("the icon changes with the ground") | Same as today (smart targeting)                                                              | Removes all farm tool switching                        | Good                                  | Natural: `planAction` already plans per item; a pure chooser on top   |
| **D. Hybrid: keep stick + Action, add C, A, and Hay-Day paint** | Good                                                | Best: stick for fine moves, taps with snap for targets, paint for rows                       | Best                                                   | Good, with options to turn parts off  | Each part is a small pure module behind an input source               |

**Recommendation: D, the hybrid, built in the order C then A then paint**, after a day of tuning. Why:

- C is the cheapest, safest win: it deletes the hoe/seeds/can switching (critiques 1 and 2 both asked for it)
  and changes nothing about how you move. It keeps the hotbar for specials, so nothing is lost.
- A fixes D3 and most of D1 and D2 for errands: one tap replaces walk-stop-face-Interact. Raw tile taps are too
  small to hit (4 to 5.6 mm), so it ships only with a preview on press, commit on release, and snapping to the
  nearest actionable tile.
- Paint (Hay Day) is what makes field work one gesture per pass. It needs C (a tool per tile) and A's pathing.
- B is rejected: acting on every release punishes stopping, and the bench shows stops are already imprecise.
- The stick stays as the default for free movement and as the fallback; tap-to-move and auto tool can each be
  switched off (Stardew's lesson: offer schemes).

## 4. Plan: milestones in priority order

Each milestone ships alone and leaves `npm run verify` green. Rules from `agents/AGENTS.md` apply: input in
`src/input`, rules pure in `src/systems` with unit tests, extensions through registries, any state change bumps
`STATE_VERSION` with a migration, a migration test and `sanitize` defaults. All acceptance numbers are checked
with the bench in `agents/out/controls/tools/` (promote it into `scripts/` in M1, see section 5).

### M1. Quick wins: tuning and layout (one day, no save change)

Goal: remove the hit conflicts and silent failures without changing how the game is played.

Scope:

1. **Action owns its disc.** Resolve overlapping dock hit areas to the nearest button centre (a pure
   `resolveTouch(point, buttons)` used by the dock zones' `hitAreaCallback`), or move Interact to (118, 318) and
   shrink its hit radius to stay clear. Interact keeps >= 44 CSS px on iPhone 13.
2. **Menu (and Interact) act on release, cancelled by moving more than 8 px.** Add a `fireOn: 'down' | 'release'`
   option to `TouchButton`; Action and hotbar stay on down (they need speed), Menu and Interact go to release. A
   drag that starts on Menu becomes a joystick drag once it moves.
3. **A tap never walks.** Joystick deadzone 6 -> 9 logical px (> `TAP_MAX_MOVE`), and `UIScene` drops the tap if
   the stick engaged during it.
4. **Hold survives a rolling pad.** Swipe drift threshold 4 -> 7 logical px, counted only when vertical travel
   dominates (|dy| > 1.5 |dx|). `SWIPE_STEP` stays 14.
5. **Swipe skips empty slots** (`cycleSlot` gets `skipEmpty`).
6. **Marker says yes or no.** 2 px brackets; "will act" in the action colour (harvest green, work white),
   "nothing to do" as a dim, dashed or red-tinted bracket. Move the kind decision into a pure
   `markerKind(...)` in `src/ui/targetMarker.ts` so it is unit tested.
7. **No silent taps.** A world tap that does nothing (not adjacent) shows a small fading ring on the tapped tile
   and plays the soft UI tick. (M4 later turns it into a walk.)
8. **Haptics where the thumb works:** `tick` on a successful action (at most one per 120 ms), on a tool swipe,
   and when Interact opens something. Respect `settings.vibrate`.
9. **Bin "Ship all"** row at the top of the bin sheet (one tap for everything sellable), keeping per-row "All".

Files: `src/input/TouchButton.ts`, `src/input/VirtualJoystick.ts`, `src/scenes/UIScene.ts`,
`src/scenes/WorldScene.ts`, `src/fx/TileHighlight.ts`, new `src/ui/targetMarker.ts`, `src/config.ts`
(`JOYSTICK.deadzone`, new `SWIPE_DRIFT`), `src/systems/inventory.ts` (`cycleSlot`), `src/ui/panels/BinPanel.ts`,
`src/systems/economy.ts` (ship-all helper).

Settings: none. Save impact: none (no `STATE_VERSION` bump).

Tests: unit for `resolveTouch`, `markerKind`, `cycleSlot` skip-empty, ship-all; a `tests/controls.test.ts` for
press semantics where they are pure. E2E: promote `feel-probe.mjs` checks into an `e2e:controls` script run by
`verify` (iPhone 13 profile plus SE).

Acceptance:

- 0% of Action's drawn disc resolves to Interact (today 10.8%); a real touch at (Action - 20, +14) presses
  Action with Interact showing.
- A drag starting on Menu opens nothing (today: opens the menu).
- A 7 px tap wobble acts once and moves 0 px (today: acts and walks 7 px).
- A 1.2 s hold with a 2.5 mm roll works 3 tiles (today 1); swipes at 60/150/300/500 ms still use the tool 0 times.
- Hoe -> seeds by swipe on a fresh game: 1 swipe down (today 3 down or 5 up), because empty slots 7 and 8 are
  skipped.
- Sell three kinds: 4 gestures (today 6).
- Frames from touch to visible response unchanged or better (stick <= 2, Action press <= 2, hotbar 0).

Risks: a larger deadzone makes the stick feel a touch stickier (9 px is still 2.9 mm on iPhone 13); release-acting
Menu feels slower (by one tap duration, about 100 ms), acceptable for a rare control.

### M2. Grid feel: turn in place, stop on a tile

Goal: make "stand here, face that" deterministic (D2) without slowing walking.

Scope (pure, in `src/systems/movement.ts`):

1. **Turn in place:** when the stick first points away from the current facing, turn immediately and only start
   walking after `TURN_HOLD_MS` (about 90 ms) of continued push. A flick shorter than that turns without moving.
   Pushing the way you already face walks at once (no added delay).
2. **Settle on release:** when the stick is released, glide on the movement axis to a tile centre, never through
   a wall: back to the **last centre the player passed** if that was less than `SETTLE_BACK_PX` (12 px, about
   190 ms of walking) ago, otherwise forward to the next centre (at most 4 px). People release when the sprite
   looks centred plus their reaction time (120 to 200 ms), so this lands them on the tile they saw. A plain
   "nearest centre" rule only absorbs 125 ms.
3. Keep 4-way movement and the 1.25 axis hysteresis; consider raising it to 1.4 if hand tests show axis flips.

Files: `src/systems/movement.ts` (`stepPlayer` gains a small `MoveState`: turn timer, settle target),
`src/scenes/WorldScene.ts` (feeds stick-released events), `src/config.ts` (`TURN_HOLD_MS`, `SETTLE_BACK_PX`),
`tests/movement.test.ts`.

Settings: none yet (tuning constants). Save impact: none (the move state is runtime, not saved).

Tests: unit: a 60 ms push in a new direction turns with 0 px moved; a 300 ms push walks; a release 10 px past
the last centre settles back, 13 px past it settles forward; settle never enters a blocked tile; doors still trigger.
E2E: `feel-probe` flick table: 0 px moved for flicks <= 90 ms; bench `STOP=center REACTION_MS=120,180`.

Acceptance:

- Flicks of 60 and 100 ms change facing and move 0 px (today 5 to 8 px).
- After every release the player rests on a tile centre (+-1 px on the moving axis).
- Bench with `STOP=center` at 120 and 180 ms: 0 stop corrections on plot3x3, sell, villager, machine and bag, and
  all tasks succeed (today at 120 ms: 25 + 2 + 2 + 2 + 3 corrections; at 180 ms the bot fails to converge).
- House door to town still under 10 s with one drag (today 8.9 to 9.6 s).

Risks: a turn delay can feel sluggish when weaving; keep it only for direction changes and tune by hand (try 60,
90, 120 ms on a phone). Settling must not fight the camera lerp (it will not: it moves the player, the camera
follows as now).

### M3. Auto tool (context Action) and the controls settings block

Goal: no tool switching for farm work (D1, D5). Action's icon shows the tool it will use on the marked tile.

Scope:

1. Pure `src/systems/autoTool.ts`: `chooseItem(state, candidates): { slot, plan, tile } | null`. Order: the
   **equipped item if it can act** on any candidate (explicit beats auto, so seeds, fertilizer and placeables
   behave as today); otherwise the best plan over the auto-eligible tool slots and the current seed.
   Auto-eligible comes from a registry, `registerAutoItem({ id, priority, eligible(stack, def) })`, with the
   built-ins hoe, can, scythe, pickaxe and "the last seed used". The rod and placeables are never auto-chosen
   (fishing and placing stay deliberate).
2. WorldScene uses `chooseItem` for the marker, `tryAction` and the Action icon; `inventory.selected` does not
   change (the hotbar still shows what you chose; the Action icon shows what will happen).
3. Seed choice: the selected seed if a seed is selected, else `state.controls.lastSeed` (set whenever a seed is
   planted), else none (tilled soil then gets "Pick seeds on the hotbar" as a hint).
4. Settings block `state.settings.controls = { autoTool: true, tapToMove: true, paint: true, stickSize: 'm' }`
   added now in one go (later milestones read their flags), plus `state.controls.lastSeed`. Opts tab gets a
   "Controls" row: Auto tool ON/OFF, Stick S/M/L (radius 18/24/32).

Files: new `src/systems/autoTool.ts`, `src/mechanics/farmingActions.ts` (register built-in auto items),
`src/systems/actions.ts` (export a plan-with-item helper), `src/scenes/WorldScene.ts`, `src/scenes/UIScene.ts`
(Action icon), `src/state/GameState.ts`, `src/systems/save.ts` (migration + sanitize), `src/ui/panels/MenuPanel.ts`
(Opts rows), `src/input/VirtualJoystick.ts` (stick size), `docs/EXTENDING.md` (the new registry).

Save impact: **yes, `STATE_VERSION` 15 -> 16**: migration adds `settings.controls` with defaults and
`controls.lastSeed = null`; `sanitize` clamps unknown values to defaults; migration test from a v15 save.

Tests: unit table for `chooseItem` (grass -> hoe; tilled empty -> seed; dry crop -> can; ripe -> harvest with
anything; weeds -> scythe; rock/ore -> pickaxe; empty can facing water -> refill; sprinkler equipped -> place;
rod equipped -> cast; nothing possible -> refusal of the equipped item); registry test adding an auto item
without touching core files; save migration test. E2E: plot3x3 with zero hotbar taps or swipes, per profile.

Acceptance: plot3x3 = 24 gestures with 0 tool changes (today 26 with 2); the Action icon matches the item used
in 100% of bench actions; switching tools for farm work = 0 gestures.

Risks: surprise (a hoe swing where you meant to water). Mitigations: explicit equipped item wins; marker colour
and the Action icon preview the choice; the setting can turn it off. Energy: auto-tilling grass you walk past
is impossible because Action still needs a press.

### M4. Tap a tile to walk there and act

Goal: one tap for every errand; no silent taps (D3).

Scope:

1. Pure `src/systems/pathfind.ts`: BFS/A* on `CollisionGrid` to a **stand tile** adjacent to the target from which
   the player faces it (or onto the tile itself for plain walking); doors are only entered when the target is
   the door. Unit tested on synthetic grids.
2. Pure `src/systems/tapIntent.ts`: what a tapped tile means, in order: interact (villager, bin, shop, board,
   mailbox, machine, plot sign) > act (auto tool plan ok) > walk. **Snap:** if the tapped tile has no intent,
   take the nearest tile with one within 1 tile (a 5 mm thumb error), ties to the tapped tile's centre.
3. Input: world touches keep today's rule (still and short = tap, moving = stick). On touch-down after 100 ms
   still, show the preview (target bracket in the intent colour and path dots); a release commits; a drag turns
   it into the stick as today. `InputHub` gains a `route` source below stick and keys; any stick or key input
   cancels it. On arrival WorldScene faces the target and runs Action or Interact once.
4. Setting `controls.tapToMove` (from M3). Off = today's adjacent-only taps.

Files: new `src/systems/pathfind.ts`, `src/systems/tapIntent.ts`, `src/input/InputHub.ts` (route source),
`src/input/TapRouter.ts` (new: preview and commit, Phaser side), `src/scenes/WorldScene.ts` (follow route,
arrive, act), `src/fx/TileHighlight.ts` (path dots), `src/config.ts`.

Save impact: none beyond M3's settings block.

Tests: unit for pathfind (blocked, unreachable, door rules, stand-tile choice), tapIntent (each kind, snap
radius, ties); e2e per profile: tap the bin from 6 tiles away opens the bin sheet with 1 gesture; tap Rosa
opens her sheet; **tap accuracy**: 50 taps per target with Gaussian 1.5 mm and 2.5 mm jitter at bin, machine,
villager and crop tiles resolve to the intended target >= 95% and >= 85%.

Acceptance: sell 4 -> 3, villager 5 -> 4, machine 3 -> 2, fish fixed cost 7 -> 5 (tap the water with the rod in
hand: walk and cast in one; you still choose the rod yourself); 0 world taps without a visible response; the preview
appears <= 1 frame after the 100 ms still threshold and the walk starts on the release frame; tap accuracy as in
Tests.

Risks: tap vs stick ambiguity at the start of a drag (keep today's thresholds, now consistent after M1); paths
through crops (allowed today, keep); tapping in sheets (the dim already swallows touches).

### M5. Paint a row (Hay Day style)

Goal: field work as one gesture per pass (D1).

Scope: press on a tile whose intent is "act" and hold still 250 ms (haptic tick, marker pops), then drag across
neighbouring tiles: each tile the finger enters joins a queue (4-connected, max 12, only tiles with a plan for
the auto-chosen item). Release starts the work: the farmer walks a serpentine order and acts once per tile;
any stick touch or new tap cancels the rest. Pure `src/systems/workQueue.ts` (ordering, skip tiles whose plan
fails at their turn, stop when energy, water or seeds run out, with one toast).

Files: new `src/systems/workQueue.ts`, `src/input/TapRouter.ts` (paint mode), `src/scenes/WorldScene.ts`,
`src/fx/TileHighlight.ts` (queued tiles), `src/config.ts`.

Settings: `controls.paint` (from M3). Save impact: none (the queue is runtime and is dropped on save or map change).

Tests: unit for workQueue (order, skip, stop conditions, energy accounting equals single presses); e2e: plot3x3
by painting on each profile and both hands.

Acceptance: plot3x3 full cycle <= 8 gestures, <= 150 mm thumb travel, 0 tool changes, every touch in the
comfortable zone on iPhone 13 for both hands; a long-press that does not drag works one tile.

Risks: the 250 ms hold before painting conflicts with nothing today (world long-press is unused) but is hidden:
teach it with a one-time tip after the third single-tile tap on soil. Painting while the stick is held by the
same thumb is impossible by design.

### M6. Reach and handedness

Goal: everything used in normal play is comfortable for both hands (D5, D6, D8).

Scope:

1. **Tool ring:** a sideways flick on Action (horizontal travel > 14 px, today unused) opens a ring of the 8
   hotbar slots plus "Bag" around Action, inside the comfortable arc; slide to choose, release to pick. Replaces
   long vertical swipes for far slots; vertical swipe stays.
2. **Mirror sheets in left-handed mode:** `Modal.row` lays buttons from the thumb side; pagers and the bin "All"
   follow; `closeButton` stays full width.
3. **Options rows low:** move volume and toggles under the tab strip's reach (the Opts tab content grows upward
   from the tabs like the bag grid).
4. Hotbar stays where it is (muscle memory, keyboard numbers); with auto tool and the ring it is rarely needed.

Files: new `src/ui/ToolRing.ts`, `src/scenes/UIScene.ts`, `src/input/TouchButton.ts` (horizontal flick
callback), `src/ui/widgets.ts` (`Modal.row` handedness), `src/ui/panels/*` that place buttons by hand
(BinPanel, JarPanel, NpcPanel, ShopPanel, BoardPanel, MenuPanel Opts).

Settings: uses `leftHanded`. Save impact: none.

Tests: unit for ring geometry (every slot centre inside the model's comfortable zone for both hands on the five
profiles, using the same `zoneAt` maths moved into a pure `src/ui/reach.ts`); layout test that mirrored rows
still fit; e2e reach map as a check.

Acceptance (reach map, iPhone 13, Pixel 7, Pro Max): every target in the bin, jar, gift, board and shop sheets
comfortable for both hands except page arrows; the ring 100% comfortable; Menu the only stretch control in the
dock (by design). Left thumb on iPhone 13 goes from 33% (13 of 40 targets in bin, board, gift, jar and shop) to >= 90% of sheet targets comfortable (the right thumb is at 90% today).

Risks: horizontal flicks near the screen edge meet Android's back gesture; start the ring only from inside
Action's disc, and in the native shell exclude the dock from system gestures
(`View.setSystemGestureExclusionRects`).

### M7. Polish and options

Scope: a short "Controls" help card in Opts (one screen, three pictures: tap, paint, stick); optional
two-speed stick (half speed inside 50% of the radius) behind a setting if hand tests ask for finer walking;
Capacitor haptics tuned per event (`ImpactStyle.Light` for work, `Medium` for tool change). Save impact: none if
the speed option rides in `settings.controls` (already versioned in M3).

## 5. Instrumentation

Log (debug builds and `?debug`, never saved, exposed as `window.__farm.controls`):

- per gesture: kind (tap, hold, drag, swipe, paint), start point and zone (comfortable, stretch, hard for the
  current hand on the current screen), duration, travel, and what it caused (walk, act ok, act refused, interact,
  nothing);
- **silent touches** (a touch that caused nothing) and **corrections** (a stick reversal within 400 ms of a stop);
- **mis-taps**: a sheet closed within 1 s of opening, a tool swiped back within 1 s, an Interact that opened
  something right after an Action press;
- touch-to-response frames per kind (histogram), and failed actions per minute.

A tiny `?debug&controls` overlay can show the last 10 gestures and the running counts while playing on a phone,
which is the only way to collect real-hand numbers here.

**One-thumb benchmark.** `agents/out/controls/tools/one-thumb-bench.mjs` is written and works. In M1, move it
(with `lib.mjs`) into `scripts/bench-thumb.mjs` and add `npm run bench:thumb`. Spec:

- Inputs: profiles (default all five), hands (right, left), `REACTION_MS` (0 = perfect, 180 = human-like stop),
  tasks (plot3x3, switchSwipe, switchHotbar, bagUse, sell, villager, machine, fish, toTown).
- Every task starts from a seeded state (items, crop growth, time) and then uses **only real touches**; the bot
  steers the stick from the game state (BFS on the live collision grid).
- Output per row: taps, holds, drags, gestures, thumb travel in mm (contact and air), stop corrections,
  touches by zone, seconds, task result (tiles tilled/planted/watered/harvested, items shipped, friendship,
  machine loaded, fish caught).
- Pass/fail: a `thresholds.json` per milestone (the acceptance numbers above); the script exits non-zero on a
  regression, so `verify` can run the iPhone 13 right-hand row (about 2 minutes) and CI or a nightly the rest.
- `STOP=center` makes the bot release when the sprite looks centred on the tile (plus `REACTION_MS`), which is
  how a person stops; the default releases on the hidden tile index (a perfect player).
- Known caveat: in `bench.json` the `sell` rows tapped the first row's "All" three times, so their `shipped`
  detail is wrong; the gesture count is right (re-run after the fix: 6 gestures, 14 items shipped).
- Companion probes: `feel-probe.mjs` (deadzone, flicks, latency, conflicts), `reach-map.mjs`,
  `targeting-probe.mjs`, `analyze.mjs` (tables).

## 6. Manual test checklist (owner, real phone)

Do each with **the right thumb only**, then **the left thumb only** (left-handed mode on), then two thumbs.
Phone in a normal grip, no table. Note where the grip had to shift.

Movement and stopping

- [ ] Walk from the bed to the farm's south exit. Did the stick ever appear somewhere you did not expect?
- [ ] Stand still and turn to face each of the 4 neighbours without moving. How many tries each?
- [ ] Stop exactly on a soil tile you choose, five times. How many corrections?
- [ ] Walk diagonally across the field. Does the axis flip back and forth?

Action and tools

- [ ] Hold Action on grass for 2 s with a relaxed thumb. Did it work 3 tiles, or only 1? Try again pressing hard.
- [ ] Swipe hoe -> can -> seeds. Did any swipe swing the old tool? Did a swipe ever leave the button?
- [ ] With the bin or a villager in reach, press the lower-left edge of Action. What opened?
- [ ] Start a stick drag right on the Menu button. Did the menu open?
- [ ] Tap a tile next to you with a loose, rolling tap. Did the farmer step as well as act?
- [ ] Tap a tile 3 tiles away. What did you expect to happen?

Reach

- [ ] Hotbar slots 1 and 8, Menu, the Opts toggles, the shop tabs: which needed a grip shift?
- [ ] Left hand: the bin's "All" and the gift list's "Give". Comfortable?
- [ ] On the biggest phone you have, can you reach the goal tracker? (It is read-only; just note it.)

Gestures with the system

- [ ] iPhone: swipe up from the hotbar; did iOS go home or show the app switcher? Swipe right from the left
      edge (Safari back)?
- [ ] Android with gesture navigation: drag inward from the right edge across Action. Did "back" fire?
- [ ] Double-tap and long-press anywhere: any zoom, text selection or context menu?

Feedback and feel

- [ ] Is it clear before pressing whether Action will do something? (marker)
- [ ] With vibration on (Android web or the native app): which actions felt like they needed a buzz?
- [ ] Any moment where a touch felt late? Where?

Each later milestone adds its own check (tap to walk, painting a row, the tool ring).

## 7. Open questions for the owner

1. **Default scheme:** should tap-to-move and auto tool be **on by default** (recommended: yes, with the stick
   always available), or opt-in?
2. **Auto tool scope:** should the rod ever be auto-picked when you tap water (Stardew does not)? Should
   placeables ever be auto-placed? (Recommended: no to both.)
3. **Paint gesture:** is a 250 ms hold-then-drag acceptable, or would you rather paint start from the Action
   button (press Action, then drag into the world)?
4. **Menu position:** keep the far corner (safe, a stretch on bigger phones), or move it into the thumb arc now
   that it will act on release?
5. **Hotbar:** keep the full-width row, or shrink it to 5 tool/special slots once auto tool lands?
6. **Haptics:** how strong, and on which events? (Needs your phone.)
7. **Which phone** do you play on most? The bench can weight that profile.
8. Is two-handed play a goal at all (for example walking with the left thumb and acting with the right), or is
   one thumb the only target?

## Research notes and sources

- Thumb reach and grips: see "The reach model" above.
- Stardew Valley mobile controls: <https://stardewvalleywiki.com/Mobile_Controls>
- Hay Day drag-to-harvest: <https://gigazine.net/news/20141009-hay-day-review/>
- Pocket Camp: <https://www.pocketgamer.com/animal-crossing-pocket-camp/review/> (summary only, unverified detail)
- Monument Valley tap-to-path: <https://www.macstories.net/?p=34400>
- Archero joystick and auto-fire: <https://www.gamepressure.com/games/archero/zc5f01>
- Vampire Survivors stick options added later: <https://vampire.survivors.wiki/w/Options>
- Sky one-handed scheme: <https://www.macworld.com/article/3411177/sky-children-of-the-light-is-a-stunning-reminder-that-we-need-more-controller-support-in-ios-games.html> (summary only)
- On-screen gamepads (floating stick reduces glances): Baldauf et al. 2015, ACM TOMM,
  <https://publications.ait.ac.at/en/publications/investigating-on-screen-gamepad-designs-for-smartphone-controlled/>
- Virtual joystick conventions (fixed, dynamic, following; deadzone): Godot
  <https://docs.godotengine.org/en/latest/classes/class_virtualjoystick.html>, Phaser rexVirtualJoystick
  <https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/>, Unity On-Screen Stick
  <https://docs.unity3d.com/Packages/com.unity.inputsystem@1.8/manual/OnScreen.html>. No research-backed deadzone
  or radius numbers were found; the plan tunes by hand.
- Latency: direct-touch users notice about 11 ms when dragging and about 69 ms when tapping (Deber et al. 2015,
  via <https://arxiv.org/pdf/2408.02525>); phones measure 35 to 140 ms touch-to-photon (median band 60 to 90 ms),
  <https://pmc.ncbi.nlm.nih.gov/articles/PMC9918597>. So the game must not add delay of its own to the stick, and
  the 110 ms hold guard and act-on-release are the two in-game delays worth watching.
