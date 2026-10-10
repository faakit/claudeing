# First hour, before the guided start (naive play, 2026-10-09)

Build: `integration/round2-2026-10-09` (1dffd97). Headless Chromium, iPhone 13 profile, right hand, real CDP
touches through `agents/probes/naive-driver.mjs`. The "player" only did what the screen said, guessing where it
said nothing. Headless emulation: this shows what is on screen, not how a person feels.

## Day 1 timeline and every moment of confusion

| shot  | moment                               | confusion                                                                                                                                                                                                                                     |
| ----- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01    | New Game, farm in front of the house | **C1** "Face the grass and tap Action to till soil." Which button is Action (no label)? The farmer faces the dirt path; the plot is off screen.                                                                                               |
| 02    | second welcome toast                 | **C2** "Tap a tile to walk there and work it. Or drag low..." while a "Drag to walk" ring pulses. A tap on grass only walks; it never works the tile (ruling 1), so the toast is wrong.                                                       |
| 03-04 | first Action press                   | **C3** "Not your land yet. Buy it at a sign." A new player reads: I must buy land. No sign is visible.                                                                                                                                        |
| 05    | tap grass, Action again              | **C4** Refused again. Nothing marks the home plot; the plots for sale (borders, "700g") look more like farmland than the real one.                                                                                                            |
| 06-07 | standing still                       | **C5** 15 s stuck before a small yellow arrow appears at the edge of the world; the 40 s hint repeats the instruction that just failed.                                                                                                       |
| 08-10 | followed the arrow, 3 Action presses | **C6** Two tips stack ("swipe up or down to change tool" and "hold Action, then drag"); the Action icon turns into the watering can by itself and Action waters bare soil while the goal still says "till".                                   |
| 11    | hold Action, drag down               | Painting worked by trial; nothing showed which way the row would go before the drag.                                                                                                                                                          |
| 12-13 | goal: plant 5                        | **C7** Action keeps tilling. Nothing says seeds must be picked on the hotbar (only the 40 s idle hint and Menu > Goal). Found slot 6 by guessing.                                                                                             |
| 14    | row painted with seeds               | **C8** "Water 5" completed from watering bare soil; one crop left dry, nothing says so. Wet and dry soil look alike.                                                                                                                          |
| 15-16 | goal: "Sleep in bed" at 11:44 AM     | **C9** Sent to bed at noon of day 1. Energy, the clock, the bin and selling were never mentioned; there is nothing to ship on day 1.                                                                                                          |
| 17b   | tap the bed                          | **C10** Tapping the bed's top half says "Can't get there." (only the lower-right bed tile has a free side).                                                                                                                                   |
| 18-19 | sleep sheet, summary                 | The sleep sheet explains itself well. **C11** The day-2 summary has seven news lines at once (special order, three jobs, a letter, wild goods) and a stale tip: "Hold the Action button to work a whole row of tiles."                        |
| 20-22 | day 2                                | **C12** Goal "Pick up 3 wild goods": the farm has one, 30 tiles away in a corner; the arrow appears after 15 s pointing off screen. The letter (Interact shows an envelope), the jobs, Rosa's "!", the Menu and the bag were never explained. |

The "Drag to walk" ring stayed on screen all day (the player never steered with the stick).

## Numbers (day 1, New Game to waking on day 2)

- Gestures: 21 (19 taps, 2 drags), 3 of them in the "hard" thumb zone.
- Refusals and errors: 4 ("Not your land yet" twice, "Can't get there", one wasted water on bare soil).
- Moments of confusion: 10 on day 1 (C1-C10), 2 more by the first minute of day 2.
- Wall time: about 4 min 30 s, including 41 s standing still waiting for a hint.
- Things never introduced on day 1: Menu, bag, energy, money, the clock, the bin and selling, the mailbox, villagers.
