# Tiny Acre one-thumb controls: critic's final report

**What I reviewed:**

- Branch `controls/one-thumb` at `cb5dce5` (docs `9457256`), from plan commit `e632754`.
- Five review rounds (`review-1.md` to `review-5.md`); ledger in `ledger.md`.
- Everything was measured in headless Chromium with real CDP touch events on emulated phones.
- "Human" means a bot with modelled imperfection:
  - 1-2.5 mm aim jitter;
  - a 1.5 mm offset toward the thumb base;
  - pad roll;
  - 120-180 ms releases;
  - reaction ± 30 ms.
- No real hand or phone was involved. The owner checklist at the end is what only a real phone can answer.

## Verdict

**It is ready for the owner's phone.**

- One thumb now:
  - walks by tapping;
  - opens the bin, villagers and machines in one tap;
  - stops on a tile reliably at normal reaction times;
  - switches tools from a ring that never fires the old tool;
  - paints straight rows from Action.
- The left hand reaches as well as the right.
- No blocker is open.
- One major predictability issue remains (a slow Action press does nothing), plus two owner trade-offs: the plot loop's cost and late stops.

## Open findings by severity

**Blocker:** none.

**Major**

1. **A slow Action press does nothing.**
   - Still presses of 290 ms or more arm painting, and lifting without a drag cancels: 0 tiles worked on i13, Pixel 7 and SE, both hands. Presses of 80-260 ms work 1 tile.
   - Two strings still say "Hold Action to keep working" (`MenuPanel.ts:271`, `UIScene.ts:215`).
   - Suggested fix: an armed press lifted without a drag acts once (owner question 3).
2. **The plot loop is 15 gestures and 470-612 mm** (plan target <= 8 and <= 150 mm). This is the cost of the owner/coordinator ruling that moved painting onto Action with straight lines only. The next experiment is a serpentine continuation.
3. **Late stops** (accepted trade-off): about 1 in 6 to 1 in 5 stops at 180 ± 30 ms reaction land one tile late. Mitigated by tap-to-walk and the Fine stick.

**Minor**

4. Ring picks at σ 2 mm are 81% on SE left (85% bar). The misses are mostly "nothing", which is safe; i13 is 90-93%.
5. A ring slide that rests 22-35 px out, short of the items, picks the 180-degree item.
6. Options: Sound (right thumb) and Vibrate (left thumb) are in the hard zone; 7-8/19 targets are outside comfort.
7. An Action press that rolls 3 mm (2.4 mm on SE) does nothing, silently.
8. bagUse thumb travel for the left hand rose (195 vs 119 mm on i13), with the same 5 gestures.
9. Accepted:
   - SE bag cells are 37 px;
   - without magnets the bin opens on 64-68% of 1.5 mm-spread taps on SE;
   - the shop's top tabs are outside comfort.

**Nit:** the paint-step comment (14 px) disagrees with the code (10 px).

## What improved because of the conversation

| issue (found in round)                              | before                                                             | after                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Rolled taps used the lift point (r1)                | 50-63% right tile at 1.5 mm roll (SE)                              | down point: rolls < 9 px hit the right tile 8/8 at every size                    |
| Tap/stick dead band (r1)                            | 0-5 of 30 taps did nothing                                         | one threshold: every touch is a tap or the stick                                 |
| Rubber-band nudges (r1)                             | a 120-160 ms push walked 8-12 px and slid back                     | a 120 ms push is exactly 1 tile, with 0 slide-back                               |
| Taps dropped in the swing lock (r1)                 | 2 of 3 at 150-200 ms spacing                                       | 3 of 3                                                                           |
| Menu tap on SE (r1)                                 | 82%                                                                | 90%                                                                              |
| Interact steal on SE (r1)                           | 1.3%                                                               | <= 1% (unit test, 5 phones)                                                      |
| Bag "Use now" bug (r1, found via the bench)         | the reopened bag deselected the cell                               | fixed                                                                            |
| Taps tilled the lawn (r2)                           | 2/30 random walk taps tilled                                       | 0: taps only harvest, water, clear, mine or open (ruling 1)                      |
| Magnets swallowed walk taps (r2)                    | a centre tap beside the bin opened it 6/6                          | walks 96% (magnets removed, ruling 4)                                            |
| Auto-planting unchosen seeds (r2)                   | a hoe hold tilled, planted and watered with seeds you never picked | explicit item wins; seeds only selected or last planted (ruling 3)               |
| Broken bench errand rows (r2)                       | sell/machine invalid on every row                                  | 36/36 rows ok                                                                    |
| Slow tap tills (r3, blocker)                        | still touches >= 240 ms tilled 100%                                | 0/112                                                                            |
| Rest-then-steer paints (r3, blocker)                | 100% painted at rests >= 200 ms; hesitant drags armed 30%          | 0/96 painted, 0/120 armed                                                        |
| Paint wobble and loop-back (r3)                     | 2-3 mm wobble added rows; loop-back worked 1 tile                  | straight lines; back to start = 0                                                |
| Haptic density (r3)                                 | 9-16 vibrations per 3-tile row                                     | 2-3                                                                              |
| Ring fires Action (r4, blocker)                     | every unhurried pick tilled a tile (8/8)                           | 0 acts in 460+ ring gestures                                                     |
| Flick-and-lift silent pick (r4)                     | 4/4 tool changes                                                   | sticky menu 16/16, 0 changes                                                     |
| Ring accuracy (r4)                                  | 83-88% at σ 1.2 mm, 57-71% at 2 mm                                 | 98-100% at 1.2 mm, 81-93% at 2 mm                                                |
| Settle window variance (r1, rejected with evidence) | -                                                                  | the bench gained REACTION_SD and anticipatory modes; the trade-off is documented |

## Before and after, whole branch

Bench (perfect stop unless noted, i13 right):

| task                                            | before                              | after                                       |
| ----------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| plot3x3                                         | 26 gestures, 933 mm, 2 tool changes | 15 gestures, 590 mm, 1 tool change          |
| plot3x3, human stop at 180 ms (i13 / Pixel 7 R) | 51 gestures, 25 corrections         | 26 gestures, 0 corrections (measured at M2) |
| Sell three kinds                                | 6                                   | 3                                           |
| Talk and gift a villager                        | 5                                   | 4                                           |
| Load a machine                                  | 3 gestures, 100 mm                  | 3 gestures, 33 mm                           |
| Fish                                            | 7 fixed gestures                    | 4                                           |
| Hoe to seeds                                    | 3-5 swipes                          | 1 swipe, or the ring                        |

Controls and reach:

| check                                                  | before   | after                 |
| ------------------------------------------------------ | -------- | --------------------- |
| Action disc going to Interact                          | 10.8%    | 0%                    |
| Menu opens from drags                                  | opened   | 0/500                 |
| Left thumb, all screens comfortable (i13)              | 55%      | 78% (right thumb 79%) |
| Left thumb, bin/board/gift/jar targets outside comfort | 13 of 40 | 0                     |

Feel and performance:

| check        | after                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Tap feel     | preview 104 ms after down; walk 1 frame after lift                                     |
| Perf         | within budget at every throttle (<= 3 draws, about 1 ms at 1x, tap-route row included) |
| Unit tests   | 579                                                                                    |
| e2e:controls | green on all 5 phones                                                                  |

## Owner's real-phone checklist

Do each with the right thumb only, then the left thumb only (Options > Controls > Left hand ON), phone held normally, no table.

**Taps and walking**

- [ ] Tap a tile 4-6 tiles away: does the farmer walk there at once? Tap a ripe crop, a dry crop, the bin, Rosa.
- [ ] Tap grass and empty soil: it should only walk, never till or plant. Try slow, firm taps too.
- [ ] Tap the tile just in front of the bin and the mailbox: it should walk, not open them. How often does a tap _on_ the bin miss? (On an SE-sized phone, expect about 1 in 3.)
- [ ] Tap two or three tiles quickly in a row: does every tap do something?

**Stopping and steering**

- [ ] Drag anywhere on the world to steer. Rest your thumb on the field first, then steer: did anything get worked? (It should not.)
- [ ] Stop exactly on a tile you choose, five times. Count corrections. Do you stop early or late?
- [ ] Flick the stick briefly to turn without stepping; push a bit longer to step exactly one tile.
- [ ] Try the Fine stick (Options > Controls) for precise stops.

**Action, paint and the ring**

- [ ] Quick taps on Action: one use each. Then **press and hold Action without moving and lift**: what did you expect? (Today: nothing happens. Tell the agent if you want one use instead.)
- [ ] Hold Action until it ticks, drag toward the middle, lift: is the row the one you meant, and the length you meant? Drag back to the start before lifting: nothing should happen.
- [ ] Swipe Action up or down: tool change only, never a swing of the old tool.
- [ ] Flick Action sideways and let go at once: the ring stays open; tap an item. Flick, slide to an item, rest, lift: did a miss ever pick the neighbour? Did the ring ever swing a tool?
- [ ] Does a 3x3 plot feel quick enough at 15 gestures, or do you want lines that turn (serpentine)?

**Reach**

- [ ] Menu (upper left of the dock for the right hand): open it without regripping? Did a stick drag ever open it?
- [ ] Options: help card, volume by the tabs, the Sound and Vibrate toggles. Which needed a regrip?
- [ ] Shop tabs and hotbar slots 1 and 8: regrip needed?

**System and feel**

- [ ] iPhone: does a swipe up from the hotbar ever trigger the home gesture? Android (gesture navigation): does a flick on Action toward the edge ever trigger "back"?
- [ ] With vibration on (Android web or the native app): are the ticks light enough? Is the paint confirm clear? On iPhone web there is no vibration: is every action still clear on screen?
- [ ] Any moment where a touch felt late, or where something happened that you didn't ask for?
