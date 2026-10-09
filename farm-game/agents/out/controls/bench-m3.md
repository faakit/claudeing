# One-thumb bench: M3 (auto tool)

Commit `911e5c8`, frozen build, TAP=0 (that build has no tap-to-move). Before = M2, after = M3.

## Headline

| loop (iPhone 13) | right | left |
|---|---|---|
| 3x3 plot | 26 gestures, 2 tool changes, 1002 mm, 23.4 s -> 24, 0, 966 mm, 22.1 s | 26, 2, 1000 mm -> 24, 0, 966 mm |
| marker or Action icon different from the act | 0 of 37 acts | 0 of 37 |

All 90 rows passed (thresholds M3). Note: after the owner rulings of 2026-10-09 the seeds are never picked for
you until you plant some, so the plot loop now taps the seeds once (25 gestures, 1 tool change); measured in
bench-m5.md.

## Full table (perfect stop)

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
| fish | i13 | left | center | 0 | 10 -> 13 | 153 | 0 | 3 | 5.8 -> 11.7 | ok |
| fish | i13 | right | center | 0 | 11 | 153 | 0 | 3 | 6.5 -> 8.4 | ok |
| fish | pixel7 | left | center | 0 | 13 -> 11 | 160 | 0 | 3 | 9.8 -> 10.2 | ok |
| fish | pixel7 | right | center | 0 | 12 -> 11 | 160 | 0 | 3 | 13.8 -> 5.4 | ok |
| fish | se | left | center | 0 | 9 -> 10 | 122 | 0 | 3 | 7.9 -> 9.3 | ok |
| fish | se | right | center | 0 | 16 -> 11 | 122 | 0 | 3 | 11.9 -> 8.3 | ok |
| fish | promax | left | center | 0 | 10 -> 18 | 168 | 0 | 3 | 10.9 -> 17.1 | ok |
| fish | promax | right | center | 0 | 13 -> 17 | 168 | 0 | 3 | 10.9 -> 12.9 | ok |
| fish | fold | left | center | 0 | 9 | 134 | 0 | 3 | 6.9 -> 7.2 | ok |
| fish | fold | right | center | 0 | 10 -> 11 | 134 | 0 | 3 | 7.9 -> 7.6 | ok |
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
| plot3x3 | i13 | left | center | 0 | 26 -> 24 | 1000 -> 966 | 0 | 2 -> 0 | 23.7 -> 22.0 | ok |
| plot3x3 | i13 | right | center | 0 | 26 -> 24 | 1002 -> 966 | 0 | 2 -> 0 | 23.4 -> 22.1 | ok |
| plot3x3 | pixel7 | left | center | 0 | 26 -> 24 | 1045 -> 1009 | 0 | 2 -> 0 | 23.4 -> 22.2 | ok |
| plot3x3 | pixel7 | right | center | 0 | 26 -> 24 | 1047 -> 1009 | 0 | 2 -> 0 | 23.9 -> 22.0 | ok |
| plot3x3 | se | left | center | 0 | 26 -> 24 | 798 -> 771 | 0 | 2 -> 0 | 23.4 -> 22.1 | ok |
| plot3x3 | se | right | center | 0 | 26 -> 24 | 799 -> 771 | 0 | 2 -> 0 | 23.4 -> 22.1 | ok |
| plot3x3 | promax | left | center | 0 | 26 -> 24 | 1100 -> 1062 | 0 | 2 -> 0 | 23.4 -> 22.0 | ok |
| plot3x3 | promax | right | center | 0 | 26 -> 24 | 1102 -> 1062 | 0 | 2 -> 0 | 23.5 -> 22.1 | ok |
| plot3x3 | fold | left | center | 0 | 26 -> 24 | 873 -> 843 | 0 | 2 -> 0 | 23.4 -> 22.0 | ok |
| plot3x3 | fold | right | center | 0 | 26 -> 24 | 874 -> 843 | 0 | 2 -> 0 | 23.4 -> 22.0 | ok |
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
| toTown | i13 | left | center | 0 | 1 | 17 | 0 | 0 | 9.1 -> 9.0 | ok |
| toTown | i13 | right | center | 0 | 1 | 17 | 0 | 0 | 9.0 -> 9.1 | ok |
| toTown | pixel7 | left | center | 0 | 1 | 18 | 0 | 0 | 9.0 -> 9.1 | ok |
| toTown | pixel7 | right | center | 0 | 1 | 18 | 0 | 0 | 9.0 -> 9.1 | ok |
| toTown | se | left | center | 0 | 1 | 14 | 0 | 0 | 9.1 -> 9.0 | ok |
| toTown | se | right | center | 0 | 1 | 14 | 0 | 0 | 9.0 -> 9.1 | ok |
| toTown | promax | left | center | 0 | 1 | 19 | 0 | 0 | 9.1 -> 9.1 | ok |
| toTown | promax | right | center | 0 | 1 | 19 | 0 | 0 | 9.1 -> 9.0 | ok |
| toTown | fold | left | center | 0 | 1 | 15 | 0 | 0 | 9.1 | ok |
| toTown | fold | right | center | 0 | 1 | 15 | 0 | 0 | 9.1 -> 9.0 | ok |
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
