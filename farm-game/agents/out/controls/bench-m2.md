# One-thumb bench: M2 (turn in place, settle on release)

Commit `f015781`, frozen build. Headless Chromium, emulated touch. Since M2 the default stop is STOP=center
(the bot lets go when the sprite looks centred; reaction 0 = perfect). M1's perfect rows used STOP=tile, so the
perfect table has no "before" column for them (different stop rule); the human-like rows compare directly.

## Headline: human-like stops (release 120 / 180 ms after the sprite looks centred), plot3x3

| profile, hand | 120 ms: gestures, corrections (M1 -> M2) | 180 ms (M1 -> M2) |
|---|---|---|
| i13 right | 40, 14 -> 26, 0 | 51, 25 -> 26, 0 |
| i13 left | 38, 12 -> 26, 0 | 51, 25 -> 26, 0 |
| pixel7 right | 47, 21 -> 26, 0 | 51, 25 -> 26, 0 |
| pixel7 left | 42, 16 -> 26, 0 | 51, 25 -> 26, 0 |
| se right | 36, 10 -> 26, 0 | 51, 25 -> 26, 0 |
| se left | 40, 14 -> 26, 0 | 51, 25 -> 26, 0 |

Every errand (sell, villager, machine, bag) also went to 0 corrections at 120 and 180 ms. At 250 ms (a full
tile of walking) the stop lands one tile late (24 corrections): rejected as a bar, see DECISIONS.md M2 and
controls review 1, F4. The bagUse failures at 180 ms were a real bag bug (stale cursor), fixed in M4.

## Full tables

### Perfect stop (STOP=center, reaction 0)

| task | profile | hand | stop | reaction ms | gestures | travel mm | corrections | tool changes | seconds | result |
|---|---|---|---|---|---|---|---|---|---|---|
| bagUse | i13 | left | center | 0 | 5 | 110 | 0 | 0 |  | ok |
| bagUse | i13 | right | center | 0 | 5 | 118 | 0 | 0 |  | ok |
| bagUse | pixel7 | left | center | 0 | 5 | 115 | 0 | 0 |  | ok |
| bagUse | pixel7 | right | center | 0 | 5 | 124 | 0 | 0 |  | ok |
| bagUse | se | left | center | 0 | 5 | 88 | 0 | 0 |  | ok |
| bagUse | se | right | center | 0 | 5 | 94 | 0 | 0 |  | ok |
| bagUse | promax | left | center | 0 | 5 | 121 | 0 | 0 |  | ok |
| bagUse | promax | right | center | 0 | 5 | 130 | 0 | 0 |  | ok |
| bagUse | fold | left | center | 0 | 5 | 96 | 0 | 0 |  | ok |
| bagUse | fold | right | center | 0 | 5 | 103 | 0 | 0 |  | ok |
| fish | i13 | left | center | 0 | 10 | 153 | 0 | 3 | 5.8 | ok |
| fish | i13 | right | center | 0 | 11 | 153 | 0 | 3 | 6.5 | ok |
| fish | pixel7 | left | center | 0 | 13 | 160 | 0 | 3 | 9.8 | ok |
| fish | pixel7 | right | center | 0 | 12 | 160 | 0 | 3 | 13.8 | ok |
| fish | se | left | center | 0 | 9 | 122 | 0 | 3 | 7.9 | ok |
| fish | se | right | center | 0 | 16 | 122 | 0 | 3 | 11.9 | ok |
| fish | promax | left | center | 0 | 10 | 168 | 0 | 3 | 10.9 | ok |
| fish | promax | right | center | 0 | 13 | 168 | 0 | 3 | 10.9 | ok |
| fish | fold | left | center | 0 | 9 | 134 | 0 | 3 | 6.9 | ok |
| fish | fold | right | center | 0 | 10 | 134 | 0 | 3 | 7.9 | ok |
| machine | i13 | left | center | 0 | 3 | 101 | 0 | 0 |  | ok |
| machine | i13 | right | center | 0 | 3 | 100 | 0 | 0 |  | ok |
| machine | pixel7 | left | center | 0 | 3 | 105 | 0 | 0 |  | ok |
| machine | pixel7 | right | center | 0 | 3 | 104 | 0 | 0 |  | ok |
| machine | se | left | center | 0 | 3 | 80 | 0 | 0 |  | ok |
| machine | se | right | center | 0 | 3 | 80 | 0 | 0 |  | ok |
| machine | promax | left | center | 0 | 3 | 111 | 0 | 0 |  | ok |
| machine | promax | right | center | 0 | 3 | 110 | 0 | 0 |  | ok |
| machine | fold | left | center | 0 | 3 | 88 | 0 | 0 |  | ok |
| machine | fold | right | center | 0 | 3 | 87 | 0 | 0 |  | ok |
| plot3x3 | i13 | left | center | 0 | 26 | 1000 | 0 | 2 | 23.7 | ok |
| plot3x3 | i13 | right | center | 0 | 26 | 1002 | 0 | 2 | 23.4 | ok |
| plot3x3 | pixel7 | left | center | 0 | 26 | 1045 | 0 | 2 | 23.4 | ok |
| plot3x3 | pixel7 | right | center | 0 | 26 | 1047 | 0 | 2 | 23.9 | ok |
| plot3x3 | se | left | center | 0 | 26 | 798 | 0 | 2 | 23.4 | ok |
| plot3x3 | se | right | center | 0 | 26 | 799 | 0 | 2 | 23.4 | ok |
| plot3x3 | promax | left | center | 0 | 26 | 1100 | 0 | 2 | 23.4 | ok |
| plot3x3 | promax | right | center | 0 | 26 | 1102 | 0 | 2 | 23.5 | ok |
| plot3x3 | fold | left | center | 0 | 26 | 873 | 0 | 2 | 23.4 | ok |
| plot3x3 | fold | right | center | 0 | 26 | 874 | 0 | 2 | 23.4 | ok |
| sell | i13 | left | center | 0 | 4 | 83 | 0 | 0 |  | ok |
| sell | i13 | right | center | 0 | 4 | 81 | 0 | 0 |  | ok |
| sell | pixel7 | left | center | 0 | 4 | 87 | 0 | 0 |  | ok |
| sell | pixel7 | right | center | 0 | 4 | 85 | 0 | 0 |  | ok |
| sell | se | left | center | 0 | 4 | 66 | 0 | 0 |  | ok |
| sell | se | right | center | 0 | 4 | 65 | 0 | 0 |  | ok |
| sell | promax | left | center | 0 | 4 | 92 | 0 | 0 |  | ok |
| sell | promax | right | center | 0 | 4 | 89 | 0 | 0 |  | ok |
| sell | fold | left | center | 0 | 4 | 73 | 0 | 0 |  | ok |
| sell | fold | right | center | 0 | 4 | 71 | 0 | 0 |  | ok |
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
| toTown | i13 | left | center | 0 | 1 | 17 | 0 | 0 | 9.1 | ok |
| toTown | i13 | right | center | 0 | 1 | 17 | 0 | 0 | 9.0 | ok |
| toTown | pixel7 | left | center | 0 | 1 | 18 | 0 | 0 | 9.0 | ok |
| toTown | pixel7 | right | center | 0 | 1 | 18 | 0 | 0 | 9.0 | ok |
| toTown | se | left | center | 0 | 1 | 14 | 0 | 0 | 9.1 | ok |
| toTown | se | right | center | 0 | 1 | 14 | 0 | 0 | 9.0 | ok |
| toTown | promax | left | center | 0 | 1 | 19 | 0 | 0 | 9.1 | ok |
| toTown | promax | right | center | 0 | 1 | 19 | 0 | 0 | 9.1 | ok |
| toTown | fold | left | center | 0 | 1 | 15 | 0 | 0 | 9.1 | ok |
| toTown | fold | right | center | 0 | 1 | 15 | 0 | 0 | 9.1 | ok |
| villager | i13 | left | center | 0 | 5 | 174 | 0 | 0 |  | ok |
| villager | i13 | right | center | 0 | 5 | 177 | 0 | 0 |  | ok |
| villager | pixel7 | left | center | 0 | 5 | 182 | 0 | 0 |  | ok |
| villager | pixel7 | right | center | 0 | 5 | 185 | 0 | 0 |  | ok |
| villager | se | left | center | 0 | 5 | 139 | 0 | 0 |  | ok |
| villager | se | right | center | 0 | 5 | 141 | 0 | 0 |  | ok |
| villager | promax | left | center | 0 | 5 | 192 | 0 | 0 |  | ok |
| villager | promax | right | center | 0 | 5 | 194 | 0 | 0 |  | ok |
| villager | fold | left | center | 0 | 5 | 152 | 0 | 0 |  | ok |
| villager | fold | right | center | 0 | 5 | 154 | 0 | 0 |  | ok |

### Human-like stops

| task | profile | hand | stop | reaction ms | gestures | travel mm | corrections | tool changes | seconds | result |
|---|---|---|---|---|---|---|---|---|---|---|
| bagUse | i13 | left | center | 120 | 5 | 110 | 0 | 0 |  | ok |
| bagUse | i13 | left | center | 180 | 6 -> 3 | 87 -> 53 | 3 -> 0 | 0 |  | FAIL: error: Error: no target /^Use now$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag |
| bagUse | i13 | left | center | 250 | 7 | 133 | 2 | 0 |  | FAIL: gestures 7 > 5; corrections 2 > 0 |
| bagUse | i13 | right | center | 120 | 9 -> 5 | 164 -> 118 | 4 -> 0 | 0 |  | ok |
| bagUse | i13 | right | center | 180 | 6 -> 3 | 113 -> 79 | 3 -> 0 | 0 |  | FAIL: error: Error: no target /^Use now$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag |
| bagUse | i13 | right | center | 250 | 7 | 141 | 2 | 0 |  | FAIL: gestures 7 > 5; corrections 2 > 0 |
| bagUse | pixel7 | left | center | 120 | 7 -> 5 | 139 -> 115 | 2 -> 0 | 0 |  | ok |
| bagUse | pixel7 | left | center | 180 | 6 -> 3 | 91 -> 55 | 3 -> 0 | 0 |  | FAIL: error: Error: no target /^Use now$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag |
| bagUse | pixel7 | left | center | 250 | 7 | 139 | 2 | 0 |  | FAIL: gestures 7 > 5; corrections 2 > 0 |
| bagUse | pixel7 | right | center | 120 | 8 -> 5 | 159 -> 124 | 3 -> 0 | 0 |  | ok |
| bagUse | pixel7 | right | center | 180 | 6 -> 3 | 118 -> 82 | 3 -> 0 | 0 |  | FAIL: error: Error: no target /^Use now$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag |
| bagUse | pixel7 | right | center | 250 | 7 | 147 | 2 | 0 |  | FAIL: gestures 7 > 5; corrections 2 > 0 |
| bagUse | se | left | center | 120 | 7 -> 5 | 106 -> 88 | 2 -> 0 | 0 |  | ok |
| bagUse | se | left | center | 180 | 6 -> 5 | 69 -> 60 | 3 -> 2 | 0 |  | FAIL: error: Error: no target /^Use now$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag |
| bagUse | se | left | center | 250 | 7 | 106 | 2 | 0 |  | FAIL: gestures 7 > 5; corrections 2 > 0 |
| bagUse | se | right | center | 120 | 5 | 94 | 0 | 0 |  | ok |
| bagUse | se | right | center | 180 | 6 -> 3 | 90 -> 63 | 3 -> 0 | 0 |  | FAIL: error: Error: no target /^Use now$/ (have Bag | Goal | Make | Skill | Book | Opts | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag cell | bag |
| bagUse | se | right | center | 250 | 7 | 112 | 2 | 0 |  | FAIL: gestures 7 > 5; corrections 2 > 0 |
| machine | i13 | left | center | 120 | 3 | 101 | 0 | 0 |  | ok |
| machine | i13 | left | center | 180 | 7 -> 3 | 135 -> 101 | 4 -> 0 | 0 |  | ok |
| machine | i13 | left | center | 250 | 7 | 135 | 4 | 0 |  | FAIL: gestures 7 > 3; corrections 4 > 0 |
| machine | i13 | right | center | 120 | 3 | 100 | 0 | 0 |  | ok |
| machine | i13 | right | center | 180 | 7 -> 3 | 145 -> 100 | 4 -> 0 | 0 |  | ok |
| machine | i13 | right | center | 250 | 7 | 145 | 4 | 0 |  | FAIL: gestures 7 > 3; corrections 4 > 0 |
| machine | pixel7 | left | center | 120 | 5 -> 3 | 123 -> 105 | 2 -> 0 | 0 |  | ok |
| machine | pixel7 | left | center | 180 | 7 -> 3 | 141 -> 105 | 4 -> 0 | 0 |  | ok |
| machine | pixel7 | left | center | 250 | 7 | 141 | 4 | 0 |  | FAIL: gestures 7 > 3; corrections 4 > 0 |
| machine | pixel7 | right | center | 120 | 5 -> 3 | 122 -> 104 | 2 -> 0 | 0 |  | ok |
| machine | pixel7 | right | center | 180 | 7 -> 3 | 152 -> 104 | 4 -> 0 | 0 |  | ok |
| machine | pixel7 | right | center | 250 | 7 | 152 | 4 | 0 |  | FAIL: gestures 7 > 3; corrections 4 > 0 |
| machine | se | left | center | 120 | 5 -> 3 | 94 -> 80 | 2 -> 0 | 0 |  | ok |
| machine | se | left | center | 180 | 7 -> 3 | 108 -> 80 | 4 -> 0 | 0 |  | ok |
| machine | se | left | center | 250 | 7 | 108 | 4 | 0 |  | FAIL: gestures 7 > 3; corrections 4 > 0 |
| machine | se | right | center | 120 | 5 -> 3 | 93 -> 80 | 2 -> 0 | 0 |  | ok |
| machine | se | right | center | 180 | 7 -> 3 | 116 -> 80 | 4 -> 0 | 0 |  | ok |
| machine | se | right | center | 250 | 7 | 116 | 4 | 0 |  | FAIL: gestures 7 > 3; corrections 4 > 0 |
| plot3x3 | i13 | left | center | 120 | 38 -> 26 | 1112 -> 1000 | 12 -> 0 | 2 | 28.5 -> 25.2 | ok |
| plot3x3 | i13 | left | center | 180 | 51 -> 26 | 1236 -> 1000 | 25 -> 0 | 2 | 35.3 -> 26.3 | ok |
| plot3x3 | i13 | left | center | 250 | 50 | 1224 | 24 | 2 | 39.4 | FAIL: gestures 50 > 26; travelMm 1224 > 1150; corrections 24 > 0 |
| plot3x3 | i13 | right | center | 120 | 40 -> 26 | 1137 -> 1002 | 14 -> 0 | 2 | 29.3 -> 25.2 | ok |
| plot3x3 | i13 | right | center | 180 | 51 -> 26 | 1238 -> 1002 | 25 -> 0 | 2 | 35.1 -> 26.3 | ok |
| plot3x3 | i13 | right | center | 250 | 50 | 1226 | 24 | 2 | 38.9 | FAIL: gestures 50 > 26; travelMm 1226 > 1150; corrections 24 > 0 |
| plot3x3 | pixel7 | left | center | 120 | 42 -> 26 | 1201 -> 1045 | 16 -> 0 | 2 | 30.1 -> 25.4 | ok |
| plot3x3 | pixel7 | left | center | 180 | 51 -> 26 | 1291 -> 1045 | 25 -> 0 | 2 | 35.2 -> 26.3 | ok |
| plot3x3 | pixel7 | left | center | 250 | 50 | 1279 | 24 | 2 | 38.7 | FAIL: gestures 50 > 26; travelMm 1279 > 1150; corrections 24 > 0 |
| plot3x3 | pixel7 | right | center | 120 | 47 -> 26 | 1254 -> 1047 | 21 -> 0 | 2 | 31.9 -> 25.4 | ok |
| plot3x3 | pixel7 | right | center | 180 | 51 -> 26 | 1293 -> 1047 | 25 -> 0 | 2 | 35.2 -> 26.4 | ok |
| plot3x3 | pixel7 | right | center | 250 | 50 | 1281 | 24 | 2 | 38.8 | FAIL: gestures 50 > 26; travelMm 1281 > 1150; corrections 24 > 0 |
| plot3x3 | se | left | center | 120 | 40 -> 26 | 902 -> 798 | 14 -> 0 | 2 | 29.4 -> 25.3 | ok |
| plot3x3 | se | left | center | 180 | 51 -> 26 | 986 -> 798 | 25 -> 0 | 2 | 35.2 -> 26.3 | ok |
| plot3x3 | se | left | center | 250 | 50 | 977 | 24 | 2 | 38.8 | FAIL: gestures 50 > 26; corrections 24 > 0 |
| plot3x3 | se | right | center | 120 | 36 -> 26 | 877 -> 799 | 10 -> 0 | 2 | 27.8 -> 25.5 | ok |
| plot3x3 | se | right | center | 180 | 51 -> 26 | 987 -> 799 | 25 -> 0 | 2 | 35.1 -> 26.2 | ok |
| plot3x3 | se | right | center | 250 | 50 | 978 | 24 | 2 | 38.9 | FAIL: gestures 50 > 26; corrections 24 > 0 |
| sell | i13 | left | center | 120 | 6 -> 4 | 100 -> 83 | 2 -> 0 | 0 |  | ok |
| sell | i13 | left | center | 180 | 8 -> 4 | 129 -> 83 | 4 -> 0 | 0 |  | ok |
| sell | i13 | left | center | 250 | 8 | 129 | 4 | 0 |  | FAIL: gestures 8 > 4; corrections 4 > 0 |
| sell | i13 | right | center | 120 | 6 -> 4 | 98 -> 81 | 2 -> 0 | 0 |  | ok |
| sell | i13 | right | center | 180 | 8 -> 4 | 115 -> 81 | 4 -> 0 | 0 |  | ok |
| sell | i13 | right | center | 250 | 8 | 115 | 4 | 0 |  | FAIL: gestures 8 > 4; corrections 4 > 0 |
| sell | pixel7 | left | center | 120 | 6 -> 4 | 105 -> 87 | 2 -> 0 | 0 |  | ok |
| sell | pixel7 | left | center | 180 | 8 -> 4 | 134 -> 87 | 4 -> 0 | 0 |  | ok |
| sell | pixel7 | left | center | 250 | 8 | 134 | 4 | 0 |  | FAIL: gestures 8 > 4; corrections 4 > 0 |
| sell | pixel7 | right | center | 120 | 4 | 85 | 0 | 0 |  | ok |
| sell | pixel7 | right | center | 180 | 8 -> 4 | 120 -> 85 | 4 -> 0 | 0 |  | ok |
| sell | pixel7 | right | center | 250 | 8 | 120 | 4 | 0 |  | FAIL: gestures 8 > 4; corrections 4 > 0 |
| sell | se | left | center | 120 | 4 | 66 | 0 | 0 |  | ok |
| sell | se | left | center | 180 | 8 -> 4 | 103 -> 66 | 4 -> 0 | 0 |  | ok |
| sell | se | left | center | 250 | 8 | 103 | 4 | 0 |  | FAIL: gestures 8 > 4; corrections 4 > 0 |
| sell | se | right | center | 120 | 6 -> 4 | 78 -> 65 | 2 -> 0 | 0 |  | ok |
| sell | se | right | center | 180 | 8 -> 4 | 92 -> 65 | 4 -> 0 | 0 |  | ok |
| sell | se | right | center | 250 | 8 | 92 | 4 | 0 |  | FAIL: gestures 8 > 4; corrections 4 > 0 |
| villager | i13 | left | center | 120 | 5 | 174 | 0 | 0 |  | ok |
| villager | i13 | left | center | 180 | 9 -> 5 | 209 -> 174 | 4 -> 0 | 0 |  | ok |
| villager | i13 | left | center | 250 | 9 | 209 | 4 | 0 |  | FAIL: gestures 9 > 5; corrections 4 > 0 |
| villager | i13 | right | center | 120 | 7 -> 5 | 194 -> 177 | 2 -> 0 | 0 |  | ok |
| villager | i13 | right | center | 180 | 9 -> 5 | 222 -> 177 | 4 -> 0 | 0 |  | ok |
| villager | i13 | right | center | 250 | 9 | 222 | 4 | 0 |  | FAIL: gestures 9 > 5; corrections 4 > 0 |
| villager | pixel7 | left | center | 120 | 7 -> 5 | 200 -> 182 | 2 -> 0 | 0 |  | ok |
| villager | pixel7 | left | center | 180 | 9 -> 5 | 218 -> 182 | 4 -> 0 | 0 |  | ok |
| villager | pixel7 | left | center | 250 | 9 | 218 | 4 | 0 |  | FAIL: gestures 9 > 5; corrections 4 > 0 |
| villager | pixel7 | right | center | 120 | 7 -> 5 | 203 -> 185 | 2 -> 0 | 0 |  | ok |
| villager | pixel7 | right | center | 180 | 9 -> 5 | 232 -> 185 | 4 -> 0 | 0 |  | ok |
| villager | pixel7 | right | center | 250 | 9 | 232 | 4 | 0 |  | FAIL: gestures 9 > 5; corrections 4 > 0 |
| villager | se | left | center | 120 | 5 | 139 | 0 | 0 |  | ok |
| villager | se | left | center | 180 | 9 -> 5 | 166 -> 139 | 4 -> 0 | 0 |  | ok |
| villager | se | left | center | 250 | 9 | 166 | 4 | 0 |  | FAIL: gestures 9 > 5; corrections 4 > 0 |
| villager | se | right | center | 120 | 7 -> 5 | 155 -> 141 | 2 -> 0 | 0 |  | ok |
| villager | se | right | center | 180 | 9 -> 5 | 177 -> 141 | 4 -> 0 | 0 |  | ok |
| villager | se | right | center | 250 | 9 | 177 | 4 | 0 |  | FAIL: gestures 9 > 5; corrections 4 > 0 |
