# First hour, after the guided start

Headless Chromium, real CDP touches, `scripts/e2e-onboarding.mjs`. The bot taps where the coach's hand points and
does what the line's gesture shows. With no coach mark (free play) it follows the goal's own arrow and the bed
sheet's Sleep button. It never writes state. Headless emulation only.

## Day 1 timeline (i13 right, M2)

| step      | line                                                                                                       | done by                    |
| --------- | ---------------------------------------------------------------------------------------------------------- | -------------------------- |
| harvest   | Tap a ripe parsnip to pick it. (Rosa's welcome strip above)                                                | 3 parsnips picked          |
| seeds     | Tap the seed packet on the hotbar.                                                                         | seeds in hand              |
| plant     | Press Action to plant a seed.                                                                              | 1 planted                  |
| water     | Press Action again to water it.                                                                            | a watered crop             |
| grow      | Press Action: dig, plant, water. Then, after 2 tiles, "Tip: hold Action, drag down: a row."                | 5 planted                  |
| ship      | Tap the bin to sell your harvest. Then "Tap Ship all produce."                                             | 1 shipped (the bin closes) |
| clock     | Days end at 2 AM. Sleep any time.                                                                          | the next touch             |
| energy    | Work uses energy. Sleep refills it.                                                                        | the next touch             |
| errands   | Free time! Try the errand up top.                                                                          | the next touch             |
| free play | goals: pick up 3 wild goods, say hello to a villager; intros when a wild good or a new villager is in view | goal arrows                |
| sleep     | Evening! Tap the bed to sleep. (6 PM, or below 25% energy; the bot slept early by choice)                  | slept                      |

Moments of confusion in the bot runs: none. Every step completed by doing it.

The critic's human-like bot (thumb spread, wrong taps, wandering, reopening) found the coach-bar blocker in
review 2. It was fixed in M2. See the critic's reviews for its numbers.

## Numbers

| run                 | New Game to town on day 2 | gestures | day 1 | day-1 gestures | first harvest |
| ------------------- | ------------------------- | -------- | ----- | -------------- | ------------- |
| i13 right           | 146 s                     | 61       | 111 s | 42             | 4.5 s         |
| i13 left            | 148 s                     | 62       | 112 s | 43             | 5.0 s         |
| SE right            | 145 s                     | 61       | 110 s | 42             | 4.4 s         |
| SE left             | 146 s                     | 62       | 111 s | 43             | 4.9 s         |
| i13 right, wanderer | 157 s                     | 68       | 121 s | 49             | 15.7 s        |

Before, a literal naive player took about 3.5 minutes to till anything. Day 1 had 10 moments of confusion and
taught nothing beyond tilling, planting, watering and sleeping. See `../before/notes.md`.
