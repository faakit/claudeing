# One-thumb bench: M4 (tap a tile to walk there and act)

Commit `bebb9a9`, frozen build. Before = M3, after = M4.

**This run is not a fair measure of the M4 errands.** The bench's tap tasks had three bugs, all fixed since
(and the build changed by the owner rulings), so the errand numbers are re-measured in `bench-m5.md`:
- it tapped before the follow camera had settled (taps mapped to the wrong tile);
- the jar starts 7 rows below the door, under the dock, so the "tap" hit the dock (left hand: Menu);
- `fresh()` did not drop a walk left over from the previous task.

What it did show: the plot loop is unchanged (24 gestures, 0 tool changes, 0 marker mismatches) and sell,
villager and fish worked by tap where the target was on screen (sell 3, villager 4 gestures).

## Full table (perfect stop)

| task | profile | hand | stop | reaction ms | gestures | travel mm | corrections | tool changes | seconds | result |
|---|---|---|---|---|---|---|---|---|---|---|
| bagUse | i13 | left | center | 0 | 5 | 110 | 0 | 0 |  | ok |
| bagUse | i13 | right | center | 0 | 5 | 118 | 0 | 0 |  | ok |
| bagUse | pixel7 | left | center | 0 | 5 | 115 | 0 | 0 |  | ok |
| bagUse | pixel7 | right | center | 0 | 5 | 124 -> 123 | 0 | 0 |  | ok |
| bagUse | se | left | center | 0 | 5 | 88 | 0 | 0 |  | ok |
| bagUse | se | right | center | 0 | 5 | 94 | 0 | 0 |  | ok |
| bagUse | promax | left | center | 0 | 5 | 121 | 0 | 0 |  | ok |
| bagUse | promax | right | center | 0 | 5 | 130 -> 129 | 0 | 0 |  | ok |
| bagUse | fold | left | center | 0 | 5 | 96 | 0 | 0 |  | ok |
| bagUse | fold | right | center | 0 | 5 | 103 | 0 | 0 |  | ok |
| fish | i13 | left | center | 0 | 13 -> 11 | 153 -> 132 | 0 | 3 | 11.7 -> 8.4 | ok |
| fish | i13 | right | center | 0 | 11 -> 10 | 153 -> 134 | 0 | 3 | 8.4 -> 11.2 | ok |
| fish | pixel7 | left | center | 0 | 11 -> 13 | 160 -> 138 | 0 | 3 | 10.2 -> 10.1 | ok |
| fish | pixel7 | right | center | 0 | 11 -> 14 | 160 -> 140 | 0 | 3 | 5.4 -> 13.1 | ok |
| fish | se | left | center | 0 | 10 -> 13 | 122 -> 105 | 0 | 3 | 9.3 -> 7.6 | ok |
| fish | se | right | center | 0 | 11 -> 9 | 122 -> 107 | 0 | 3 | 8.3 -> 8.7 | ok |
| fish | promax | left | center | 0 | 18 -> 10 | 168 -> 145 | 0 | 3 | 17.1 -> 6.2 | ok |
| fish | promax | right | center | 0 | 17 -> 10 | 168 -> 147 | 0 | 3 | 12.9 -> 6.5 | ok |
| fish | fold | left | center | 0 | 9 -> 12 | 134 -> 115 | 0 | 3 | 7.2 -> 7.6 | ok |
| fish | fold | right | center | 0 | 11 | 134 -> 117 | 0 | 3 | 7.6 -> 5.3 | ok |
| machine | i13 | left | center | 0 | 3 -> 1 | 101 -> 0 | 0 | 0 |  | FAIL: error: Error: no target /^Load$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag ce |
| machine | i13 | right | center | 0 | 3 -> 1 | 100 -> 0 | 0 | 0 |  | FAIL: error: Error: no target /^Load$/ (have slot 1 | slot 2 | slot 3 | slot 4 | slot 5 | slot 6 | slot 7 | slot 8 | ACTION | INTERACT | MENU) |
| machine | pixel7 | left | center | 0 | 3 -> 1 | 105 -> 0 | 0 | 0 |  | FAIL: error: Error: no target /^Load$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag ce |
| machine | pixel7 | right | center | 0 | 3 -> 1 | 104 -> 0 | 0 | 0 |  | FAIL: error: Error: no target /^Load$/ (have slot 1 | slot 2 | slot 3 | slot 4 | slot 5 | slot 6 | slot 7 | slot 8 | ACTION | INTERACT | MENU) |
| machine | se | left | center | 0 | 3 -> 1 | 80 -> 0 | 0 | 0 |  | FAIL: error: Error: no target /^Load$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag ce |
| machine | se | right | center | 0 | 3 -> 1 | 80 -> 0 | 0 | 0 |  | FAIL: error: Error: no target /^Load$/ (have slot 1 | slot 2 | slot 3 | slot 4 | slot 5 | slot 6 | slot 7 | slot 8 | ACTION | INTERACT | MENU) |
| machine | promax | left | center | 0 | 3 -> 1 | 111 -> 0 | 0 | 0 |  | FAIL: error: Error: no target /^Load$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag ce |
| machine | promax | right | center | 0 | 3 -> 1 | 110 -> 0 | 0 | 0 |  | FAIL: error: Error: no target /^Load$/ (have slot 1 | slot 2 | slot 3 | slot 4 | slot 5 | slot 6 | slot 7 | slot 8 | ACTION | INTERACT | MENU) |
| machine | fold | left | center | 0 | 3 -> 1 | 88 -> 0 | 0 | 0 |  | FAIL: error: Error: no target /^Load$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag ce |
| machine | fold | right | center | 0 | 3 -> 1 | 87 -> 0 | 0 | 0 |  | FAIL: error: Error: no target /^Load$/ (have slot 1 | slot 2 | slot 3 | slot 4 | slot 5 | slot 6 | slot 7 | slot 8 | ACTION | INTERACT | MENU) |
| plot3x3 | i13 | left | center | 0 | 24 | 966 | 0 | 0 | 22.0 -> 22.1 | ok |
| plot3x3 | i13 | right | center | 0 | 24 | 966 | 0 | 0 | 22.1 -> 22.2 | ok |
| plot3x3 | pixel7 | left | center | 0 | 24 | 1009 | 0 | 0 | 22.2 -> 22.2 | ok |
| plot3x3 | pixel7 | right | center | 0 | 24 | 1009 | 0 | 0 | 22.0 -> 22.1 | ok |
| plot3x3 | se | left | center | 0 | 24 | 771 | 0 | 0 | 22.1 -> 22.1 | ok |
| plot3x3 | se | right | center | 0 | 24 | 771 | 0 | 0 | 22.1 -> 22.1 | ok |
| plot3x3 | promax | left | center | 0 | 24 | 1062 | 0 | 0 | 22.0 -> 22.1 | ok |
| plot3x3 | promax | right | center | 0 | 24 | 1062 | 0 | 0 | 22.1 -> 22.1 | ok |
| plot3x3 | fold | left | center | 0 | 24 | 843 | 0 | 0 | 22.0 -> 22.1 | ok |
| plot3x3 | fold | right | center | 0 | 24 | 843 | 0 | 0 | 22.0 -> 22.1 | ok |
| sell | i13 | left | center | 0 | 4 -> 3 | 83 -> 69 | 0 | 0 |  | ok |
| sell | i13 | right | center | 0 | 4 -> 3 | 81 -> 69 | 0 | 0 |  | ok |
| sell | pixel7 | left | center | 0 | 4 -> 3 | 87 -> 72 | 0 | 0 |  | ok |
| sell | pixel7 | right | center | 0 | 4 -> 3 | 85 -> 72 | 0 | 0 |  | ok |
| sell | se | left | center | 0 | 4 -> 3 | 66 -> 55 | 0 | 0 |  | ok |
| sell | se | right | center | 0 | 4 -> 3 | 65 -> 55 | 0 | 0 |  | ok |
| sell | promax | left | center | 0 | 4 -> 3 | 92 -> 76 | 0 | 0 |  | ok |
| sell | promax | right | center | 0 | 4 -> 3 | 89 -> 76 | 0 | 0 |  | ok |
| sell | fold | left | center | 0 | 4 -> 3 | 73 -> 60 | 0 | 0 |  | ok |
| sell | fold | right | center | 0 | 4 -> 3 | 71 -> 60 | 0 | 0 |  | ok |
| switchHotbar | i13 | left | center | 0 | 2 | 30 | 0 | 2 |  | ok |
| switchHotbar | i13 | right | center | 0 | 2 | 30 | 0 | 2 |  | ok |
| switchHotbar | pixel7 | left | center | 0 | 2 | 32 | 0 | 2 |  | ok |
| switchHotbar | pixel7 | right | center | 0 | 2 | 32 | 0 | 2 |  | ok |
| switchHotbar | se | left | center | 0 | 2 | 24 | 0 | 2 |  | ok |
| switchHotbar | se | right | center | 0 | 2 | 24 | 0 | 2 |  | ok |
| switchHotbar | promax | left | center | 0 | 2 | 33 | 0 | 2 |  | ok |
| switchHotbar | promax | right | center | 0 | 2 | 33 | 0 | 2 |  | ok |
| switchHotbar | fold | left | center | 0 | 2 | 26 | 0 | 2 |  | ok |
| switchHotbar | fold | right | center | 0 | 2 | 26 | 0 | 2 |  | ok |
| switchSwipe | i13 | left | center | 0 | 1 | 5 | 0 | 1 |  | ok |
| switchSwipe | i13 | right | center | 0 | 1 | 5 | 0 | 1 |  | ok |
| switchSwipe | pixel7 | left | center | 0 | 1 | 6 | 0 | 1 |  | ok |
| switchSwipe | pixel7 | right | center | 0 | 1 | 6 | 0 | 1 |  | ok |
| switchSwipe | se | left | center | 0 | 1 | 4 | 0 | 1 |  | ok |
| switchSwipe | se | right | center | 0 | 1 | 4 | 0 | 1 |  | ok |
| switchSwipe | promax | left | center | 0 | 1 | 6 | 0 | 1 |  | ok |
| switchSwipe | promax | right | center | 0 | 1 | 6 | 0 | 1 |  | ok |
| switchSwipe | fold | left | center | 0 | 1 | 5 | 0 | 1 |  | ok |
| switchSwipe | fold | right | center | 0 | 1 | 5 | 0 | 1 |  | ok |
| toTown | i13 | left | center | 0 | 1 | 17 | 0 | 0 | 9.0 -> 9.0 | ok |
| toTown | i13 | right | center | 0 | 1 | 17 | 0 | 0 | 9.1 -> 9.1 | ok |
| toTown | pixel7 | left | center | 0 | 1 | 18 | 0 | 0 | 9.1 | ok |
| toTown | pixel7 | right | center | 0 | 1 | 18 | 0 | 0 | 9.1 -> 9.0 | ok |
| toTown | se | left | center | 0 | 1 | 14 | 0 | 0 | 9.0 -> 9.0 | ok |
| toTown | se | right | center | 0 | 1 | 14 | 0 | 0 | 9.1 -> 9.0 | ok |
| toTown | promax | left | center | 0 | 1 | 19 | 0 | 0 | 9.1 -> 9.1 | ok |
| toTown | promax | right | center | 0 | 1 | 19 | 0 | 0 | 9.0 -> 9.0 | ok |
| toTown | fold | left | center | 0 | 1 | 15 | 0 | 0 | 9.1 | ok |
| toTown | fold | right | center | 0 | 1 | 15 | 0 | 0 | 9.0 -> 9.1 | ok |
| villager | i13 | left | center | 0 | 5 -> 4 | 174 -> 152 | 0 | 0 |  | ok |
| villager | i13 | right | center | 0 | 5 -> 4 | 177 -> 152 | 0 | 0 |  | ok |
| villager | pixel7 | left | center | 0 | 5 -> 4 | 182 -> 159 | 0 | 0 |  | ok |
| villager | pixel7 | right | center | 0 | 5 -> 4 | 185 -> 159 | 0 | 0 |  | ok |
| villager | se | left | center | 0 | 5 -> 4 | 139 -> 121 | 0 | 0 |  | ok |
| villager | se | right | center | 0 | 5 -> 4 | 141 -> 121 | 0 | 0 |  | ok |
| villager | promax | left | center | 0 | 5 -> 4 | 192 -> 167 | 0 | 0 |  | ok |
| villager | promax | right | center | 0 | 5 -> 4 | 194 -> 167 | 0 | 0 |  | ok |
| villager | fold | left | center | 0 | 5 -> 4 | 152 -> 132 | 0 | 0 |  | ok |
| villager | fold | right | center | 0 | 5 -> 4 | 154 -> 132 | 0 | 0 |  | ok |
