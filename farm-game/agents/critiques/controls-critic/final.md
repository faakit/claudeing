# Tiny Acre one-thumb controls: critic's final report

**What I reviewed:**

- **Round 1-2:** branch `controls/one-thumb` (`e632754` to `cb5dce5`), `review-1.md` to `review-5.md`.
- **Round 3:** branch `controls/round3` from `integration/round2-2026-10-09`, up to `b9fb448` (docs and bench `26dda7e`), `review-6.md` and `review-7.md`.
- Ledger: `ledger.md`.
- Everything was measured in headless Chromium with real CDP touch events on emulated phones.
- "Human" means a bot with modelled imperfection:
  - 1-3 mm aim jitter;
  - a 1.5 mm offset toward the thumb base;
  - pad roll;
  - 120-180 ms releases;
  - reaction ± 30 ms;
  - for painting, a continuous 2D wobble field: λ 12-25 mm, slowing into corners, corners cut round, end overshoot.
- No real hand or phone was involved. The owner checklist at the end is what only a real phone can answer.

## Verdict

**It is ready for the owner's phone.**

- One thumb now:
  - walks by tapping;
  - opens things in one tap;
  - stops on a tile reliably at normal reaction times;
  - switches tools from a forgiving ring;
  - **paints a whole 3x3 plot in one serpentine drag from Action (7 gestures for the full loop).**
- The left hand reaches as well as the right.
- No blocker or major is open.
- What remains:
  - SE-sized phones paint serpentines a little less reliably when the thumb is very shaky;
  - two accepted trade-offs: plot travel slightly over 250 mm on bigger phones, and late stops.

## Open findings by severity

**Blocker:** none. **Major:** none.

**Minor**

1. **Serpentine on SE with a shaky thumb.** With 2 mm wobble, following the preview: 75-85% exactly right on SE, against 90%. i13 is 90-100%. The misses are a misread first leg, or a 4-wide first row that sets every row's width; strays were 4-9 tiles per 20 attempts in my bot. With steadier thumbs (1 mm, without even watching the preview) it is 59/60 exact with 0 strays on every phone.
2. **Ring sticky-menu taps on SE left: 23-26/28** (90% bar). Misses pick nothing.
3. **Accepted trade-offs:**
   - plot3x3 travel is 250-286 mm on i13 left and Pixel 7 (SE 199-218), because the 16 px paint step is what keeps serpentines accurate;
   - late stops: about 1 in 6 at 180 ± 30 ms reaction land one tile late;
   - straight lines on SE at 3 mm wobble are below 85%;
   - a tap on the door tile itself enters 67-100% (the door art enters 100%);
   - SE bag cells are 37 px;
   - without magnets the bin opens on 64-68% of 1.5 mm-spread taps on SE;
   - the shop's top tabs are outside comfort.

## What improved because of the conversation

**Round 1-2** (`controls/one-thumb`):

| issue (found in round)                | before                                         | after                                                         |
| ------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Rolled taps used the lift point (r1)  | 50-63% right tile at 1.5 mm roll (SE)          | down point: rolls < 9 px hit the right tile 8/8 at every size |
| Tap/stick dead band (r1)              | 0-5 of 30 taps did nothing                     | every touch is a tap or the stick                             |
| Rubber-band nudges (r1)               | a 120-160 ms push walked 8-12 px and slid back | a 120 ms push is exactly 1 tile                               |
| Taps dropped in the swing lock (r1)   | 2 of 3                                         | 3 of 3                                                        |
| Menu tap on SE (r1)                   | 82%                                            | 90%                                                           |
| Bag "Use now" bug (r1, via the bench) | deselected the cell                            | fixed                                                         |
| Taps tilled the lawn (r2)             | 2/30 random walk taps                          | 0 (ruling 1)                                                  |
| Magnets swallowed walk taps (r2)      | 6/6 beside the bin                             | walks 96% (ruling 4)                                          |
| Auto-planting unchosen seeds (r2)     | yes                                            | explicit item wins (ruling 3)                                 |
| Slow tap tills (r3, blocker)          | 100% at >= 240 ms                              | 0/112                                                         |
| Rest-then-steer paints (r3, blocker)  | 100% at rests >= 200 ms                        | 0/96                                                          |
| Ring fires Action (r4, blocker)       | 8/8 picks tilled                               | 0 acts in 460+ gestures                                       |
| Flick-and-lift silent pick (r4)       | 4/4                                            | sticky menu 16/16                                             |
| Ring accuracy (r4)                    | 57-71% at 2 mm                                 | 81-93%                                                        |

**Round 3** (`controls/round3`):

| issue                                      | before                                                                   | after                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Slow Action press did nothing              | presses >= 290 ms: 0 uses                                                | 1 use at 80-1500 ms (18/18 per phone)                                                   |
| Plot loop cost                             | 15 gestures, 590 mm (i13), 470 mm (SE)                                   | **7 gestures**, 250 mm (i13 R), 199 mm (SE R); every touch comfortable                  |
| Painted tiles flickered and retracted (r6) | following the preview: 7-14/20 exact, 7-10 strays per row                | i13 18-20/20, SE 15-17/20; tiles only leave when you back up                            |
| Front-path taps entered the house (r6)     | 3/24 per phone                                                           | 0/96                                                                                    |
| Ring dead zone                             | a rest 22-35 px out picked an item (and 34 px on SE after the first fix) | stays a sticky menu (16/16)                                                             |
| Ring on SE left at 2 mm                    | 81%                                                                      | 92% (77/84)                                                                             |
| Sticky taps on SE right                    | 79-89%                                                                   | 93%                                                                                     |
| Options Sound and Vibrate                  | in the hard zone                                                         | comfortable for both thumbs; 0 hard targets                                             |
| Rolled Action press                        | did nothing, silently                                                    | an immediate roll says "no" (vibration and shake); a roll after a still press acts once |
| Left-hand bag use                          | 195 mm                                                                   | 83 mm (i13)                                                                             |
| Stale "hold Action to keep working" hint   | 2 strings                                                                | fixed                                                                                   |
| Onboarding event names                     | -                                                                        | unchanged against `integration/round2` (diffed every round)                             |

## Before and after, whole effort

Bench (perfect stop unless noted, i13 right):

| task                          | M0                                  | now                                     |
| ----------------------------- | ----------------------------------- | --------------------------------------- |
| plot3x3                       | 26 gestures, 933 mm, 2 tool changes | 7 gestures, 250 mm, 1 (the seed pick)   |
| plot3x3, human stop at 180 ms | 51 gestures, 25 corrections         | 26 gestures, 0 corrections (stick play) |
| Sell three kinds              | 6                                   | 3                                       |
| Talk and gift a villager      | 5                                   | 4                                       |
| Load a machine                | 3 gestures, 100 mm                  | 3 gestures, 33 mm                       |
| Fish                          | 7 fixed gestures                    | 4                                       |
| Use a bag item                | 5 gestures, 135 mm                  | 5 gestures, 103 mm (left 83)            |

Controls and reach:

| check                                     | M0     | now             |
| ----------------------------------------- | ------ | --------------- |
| Action disc going to Interact             | 10.8%  | 0%              |
| Menu opens from drags                     | opened | 0/500           |
| Left thumb, all screens comfortable (i13) | 55%    | 80% (right 80%) |

Health: perf within budget (frames 2/2/2/0), 697 unit tests, e2e:controls green, bench 54/54.

## Owner's real-phone checklist

Do each with the right thumb only, then the left thumb only (Options > Controls > Left hand ON), phone held normally, no table.

**Taps and walking**

- [ ] Tap a tile 4-6 tiles away: does the farmer walk there at once? Tap a ripe crop, a dry crop, the bin, Rosa.
- [ ] Tap grass and empty soil, including slow, firm taps: it should only walk, never till or plant.
- [ ] Walk along the path in front of the farmhouse by tapping: you should never end up inside. Tap the door itself, or the wall above it: you should go in.
- [ ] Tap two or three tiles quickly in a row: does every tap do something?

**Stopping and steering**

- [ ] Rest your thumb on the field, then steer: nothing should get worked.
- [ ] Stop exactly on a tile you choose, five times. Count the corrections. Do you stop early or late?
- [ ] Try the Fine stick (Options > Controls) for precise stops.

**Action, paint and the ring**

- [ ] Quick taps and slow presses on Action: exactly one use each, however long you hold.
- [ ] Hold Action until it ticks, then drag a serpentine over a 3x3 plot (along, down one, back, down one, along) and lift.
  - Was it the plot you meant?
  - Did a tile ever appear and then disappear?
  - Did a row come out wider than you wanted?
  - Drag back to the start before lifting: nothing should happen.
- [ ] Press Action and roll your thumb a little before lifting: did it act or say no? Did either surprise you?
- [ ] Flick Action sideways and let go at once: the ring stays open; tap an item. Flick, slide, rest, lift: did a miss ever pick the neighbour?
- [ ] Swipe Action up or down: tool change only, never a swing of the old tool.

**Reach**

- [ ] Menu, the Options Sound and Vibrate switches, the bag, the shop tabs: which needed a regrip?

**System and feel**

- [ ] iPhone: does a swipe up from the hotbar ever trigger the home gesture? Android (gesture navigation): does a flick on Action toward the edge ever trigger "back"?
- [ ] With vibration on: are the ticks light enough? Is one tick per painted tile clear, and the "no" buzz distinct? On iPhone web there is no vibration: is everything still clear on screen?
- [ ] Any moment where a touch felt late, or where something happened that you didn't ask for?
