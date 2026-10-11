# Guided start: the new-player critic's final report (updated after onboarding round 2)

Final build: **5d5e06d** on `onboarding/round2` (from `integration/round3-2026-10-10`, with the controls door and bed
fixes and the art coach sprites merged), frozen in `round-8/`. Round 2 rounds: 5 (merged-base replay), 6 (M1 94cb9c3),
7 (M2 c031793), 8 (final). Reviews: `review-6.md`, `review-7.md`; ledger `ledger.md`. Round 1's report follows below
(also in `final-round1.md`).

Method, unchanged: headless Chromium with real CDP touches on iPhone 13 and SE, right and left hand. The bot
(`tools/human.mjs`) acts only on what's drawn: line, ring and hand, goal arrow, sheet buttons. Runs mix thumb spread,
wrong taps, a wander, a close/reopen, never painting, house wanders, and play through to day 3. `?debug` is read-only.
**Emulation, not a real phone or person.**

## Verdict

No blockers, and nothing open above minor. On the final build, 16/16 runs reached town on day 2 by on-screen guidance
alone. That's 12 seeds, 2 clean never-paint runs and 2 runs that wander into the house during free time. Both runs
to day 3 got the day-3 watering intro, and the late-night walk home was guided. The merge regressions found in round 5
(a never-paint dead end and a mail stall) are gone, and so is day 2's long watering chore (day 2 is now a rain
morning). My full test run on the frozen copy is green: 799 unit tests, 338 e2e checks, 0 FAIL, coach-marks perf
1.1-1.2 ms JS and 2 draws per frame.

## Before / after (round 2)

|                                      | round-1 final (fd9dcfc)             | merged base (6d5e480)                      | final (5d5e06d)                                                                                |
| ------------------------------------ | ----------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| reach town on day 2 by guidance      | 12/12                               | 9/12 (never-paint dead end; 2 mail stalls) | **16/16** (incl. 2 house wanders)                                                              |
| never-paint runs                     | pass, but water2 up to 150 s        | 1 dead end (540 s, 376 presses)            | 4/4, no refusal loops (clean: 142 s to town)                                                   |
| New Game to waking on day 2          | 108-204 s                           | 116-191 s                                  | 110-194 s (clean 110-128 s)                                                                    |
| waking to town on day 2              | 28-101 s of watering, then the walk | water2 14-76 s, then the walk              | 28-49 s                                                                                        |
| slowest step in a clean run          | water2 52 s                         | water2 62 s                                | none over 45 s                                                                                 |
| lost in the house during free time   | not tested                          | 282 s silent (found round 6)               | arrow after 5.5 s, out the door                                                                |
| late night (day 2, in town at 11 PM) | n/a                                 | 120-125 s to bed, clock outline only       | led home in 4 lines: "Head home" to the gate, then door, bed, Sleep (26 s)                     |
| day 3 waking                         | n/a                                 | about 17 s unpointed in the house          | waterDaily points at the door in 3.7 s; 5 crops in about 14 s                                  |
| bed after the day-1 errands (owner)  | bed at 6 PM only                    | n/a                                        | offered after errands ("All done! Sleep, or keep exploring."), still nudged at 6 PM            |
| skip / line checks (SE, both hands)  | pass                                | pass                                       | pass (mid-line tap walks; "?" menu closes itself by 4.6 s; Skip needs a confirm; replay toast) |

## Open findings (final, round 2)

Nothing above minor.

1. **minor. A burst of first-time tips right after the first purchase on day 2.** Three tip toasts landed within 3 s
   of "Bought 1 Parsnip Seeds", on top of the coach line ("Silver and gold goods sell for more...", "Wild goods grow
   back every morning...", "New kinds of goods go in Menu > Book..."). Then came "Goal complete". That's 6 tip
   toasts across the 2 day-3 runs (`round-8/runs/day3-i13-right/log.txt` @181-185 s). It's the one lecture-like moment
   left. Fix: release the held tips one at a time (one per in-game hour, or one per day) after the guided days.
2. **minor. After "Buy 5 items", the job1 goal ("Finish a job a villager posts") has no `where`.** Both day-3 runs then
   stood in town on day 2 for about 5 minutes with no coach step and no arrow, until the late-night line. Only the
   40 s idle hint helped ("Morning news lists today's jobs. Menu > Goal shows them too."). This is after the guided
   days, so it's minor. Fix: point the goal arrow at the posting villager or the board for job1.
3. **minor (other lane). "+1 Wild Leek" overlaps the "GOAL COMPLETE" banner** at the top of the world view (Hud/FX).
4. **minor (other lane). The bag hint "Tip: hold Action to keep working."** (controls) still contradicts the row tip.
5. **nit. "Buy 5 items" completed after "Bought 1 Parsnip Seeds"** in the day-3 runs. The goal may be counting
   something other than the visible purchase. Worth a look by whoever owns goals.

## Checklist for the owner (round 2 additions)

Do the round-1 checklist below, plus these:

1. **Day-1 errands, then bed:** after the town-gate errand, does "All done! Sleep, or keep exploring." appear, and
   does it leave you alone if you keep exploring?
2. **Wander into the house during free time:** does an arrow appear within a few seconds and lead you back out?
3. **Day 2:** does the rain morning read as a nice surprise (no watering), and does "Tap the counter to buy seeds."
   get you shopping before 8 AM?
4. **Stay out late on day 2,** in town after 10 PM: do the lines walk you home (gate, then door, then bed, then
   Sleep)?
5. **Day 3:** waking up, does the watering line point at the door, then your dry crops? Does the row tip offer one
   direction?
6. **After your first purchase:** do several tip toasts pile up at once? (open finding 1)

---

# Round 1 (onboarding/guided-start, fd9dcfc): kept for history

Branch `onboarding/guided-start`, final build **fd9dcfc** (M4), frozen in `round-4/`. Rounds: 0 (baseline 1dffd97), 1
(design note), 2 (M1/M1.1), 3 (M3, covering M2/M2.1), 4 (M4, this report). Ledger: `ledger.md`. Reviews:
`review-0.md` to `review-3.md`.

Method: headless Chromium with real CDP touches on the iPhone 13 and iPhone SE profiles, right and left hand. The bot
(`tools/human.mjs`) acts only on what's drawn: the coach line, the ring and hand, the goal arrow, and sheet buttons.
It adds 1.5 mm thumb spread with a bias toward the thumb base and reading pauses, and in some runs about 12% wrong
taps, a wander off mid-step, a close/reopen, a hesitant row hold (200-450 ms) or never painting a row.
`?debug` was only read. **This is emulation: no real thumb, no real person, no real phone.** The checklist at the end
is for you.

## Verdict

A first-time player no longer gets lost. In 12 of 12 runs on the final build, the bot followed only on-screen
guidance from New Game, through day 1, into town on day 2. That held across both phones and both hands, with wrong
taps, wandering off, closing and reopening, and never painting a row. There were no dead ends and no accidental
skips. The first thing you do is fun: you pick a ripe parsnip in about 10 s. Every instruction is one short line, and
every step completes by doing it. Two majors remain open, both on day 2 and neither blocking: the watering chore can
still drag for players who never paint a row, and the stick lesson can push you into a stump. Details below.

## Before / after

|                                                    | before (1dffd97)                                                                   | after (fd9dcfc)                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Literal follower, first 60 s                       | 0 of 6 tiles tilled; same refusal 9 times ("Not your land yet. Buy it at a sign.") | 3 parsnips picked, seeds planted, watered; first harvest step done in 9-20 s                                         |
| Reaches day 2 on on-screen guidance alone          | no (plot off screen, door and seeds never explained)                               | **12/12** (i13/SE x R/L; human-ish, never-paint, clean)                                                              |
| New Game to waking on day 2                        | 65 s _only if you know the secrets_                                                | 108-146 s clean, 139-204 s human-ish (includes the clock and energy lines, free time, an errand to the town gate)    |
| New Game to town on day 2                          | n/a                                                                                | 156-201 s clean, 216-336 s human-ish                                                                                 |
| Time with nothing on screen telling you what to do | 41 s stuck before an arrow                                                         | 6-7 s per run (the arrow after 3 s in free play)                                                                     |
| Instructions longer than one row                   | toast of 3 lines; morning report of 11 lines                                       | 0 (about 50 distinct coach lines, all one row); morning note 3-4 lines                                               |
| Conflicting instructions                           | toast says tap-to-work, ring says drag; 4 tips in 15 s                             | one line at a time; refusals rewritten into the coach line                                                           |
| Close/reopen mid-tutorial                          | resumes, no reminder                                                               | back on the same step with its line (every reopen run)                                                               |
| Accidental guide loss                              | n/a                                                                                | round 2: 4/12 runs (one-tap Skip from the bar). Final: 0/12; Skip needs a confirm tap; toast tells you how to replay |
| Left hand                                          | never offered; buried in Menu > Opts                                               | offered on the welcome strip; dock, marks, menu and glyph mirrored                                                   |
| Verify                                             | green                                                                              | green on my frozen copy: 715 unit tests, 300 e2e checks, 0 FAIL; coach-marks perf 1.03-1.43 ms JS, 2 draws per frame |

## Open findings (final round)

### Blockers

None.

### Major

1. **Day-2 watering still drags for players who tap Action instead of painting.** In never-paint runs, water2 took
   150 s / 104 taps (i13-left-s3-never) and 39 s (se-right-s13-never). The selected slot is the empty seed slot (all
   seeds were planted on day 1). Action on empty soil then gives the planting refusal, rewritten as "Tap the seed
   packet on the hotbar." There is no packet, and the step is about watering. "Something is already growing here."
   also shows. Wrong-tool lines in water2: 5 and 2 in those runs, 0 in painters. Fix: during water steps, an empty
   hand or a seed slot points at the can first (as the rod fix does), and the plant refusal is never rewritten into
   "tap the seed packet" outside planting steps. Logs: `round-4/runs/i13-left-s3-never/log.txt` @142-293 s.
2. **The day-2 stick lesson pushes into obstacles.** "Seeds are in town: walk south." demos a fixed "drag down". From
   the north-west of the farm (after wandering), straight down runs into the woodpile and stump. The walk stalled for
   115 s and 45+ s in 2/12 runs (se-right-s4-human, se-right-s13-never; shot
   `round-4/runs/se-right-s4-human/27-stall-town.png`). Fix: teach the stick only when the straight way is clear for
   a few tiles, or demo the direction of the next path step; otherwise fall back to the tap and edge arrow.

### Minor

3. **water2 is still the longest beat for everyone.** 12-101 s (median about 36 s), and over 45 s in 5/12 runs, even
   with Rosa filling the can. The can still ran dry in 3 runs, and the row tip offered 2-4 directions within the one
   step in 9/12 runs. It's acceptable, but it's the one moment that feels like a chore.
4. **A target placed beside an interactable.** The day-1 leek at (11,11) sits next to the mailbox. A slightly low tap
   opens an empty "Mailbox: No letters yet" sheet, and the line says "Close this to carry on." (round 3,
   `round-3/runs/se-right-clean/11-step-forage.png`; this is the "wild-good sheet" from review 3). Fix: lay the leek
   2+ tiles from the mailbox and bin.
5. **"Close this to carry on." after Menu > Goal is kept on purpose** so the jobs can be read. It appeared in 8/12
   town steps. It's fine, but it would read better as "Read your jobs, then Close."
6. **The bag hint "Tip: hold Action to keep working."** (`MenuPanel.ts`, the controls agent's string) still
   contradicts the row tip. It's out of this branch's lane but should go before release.

### Nits

7. The idle-hint wording after a skip is aligned. The old 40 s hint is still the only help for skippers, which is
   fine.
8. Day 1 under the guide gets you to bed before noon if you follow the goal arrows. That's the owner ruling
   (allowed); "late" and "tired" will mostly be met on later days.

## Verified fixed across the rounds (highlights)

Each item is verified in play, not just read in code.

- The plot is on screen at spawn, so "Not your land" never shows to a follower.
- Harvest first; tap-to-walk taught by doing.
- Seeds, plant, water and the row tip, which is optional (never-paint completes).
- The bin, with auto-close after Ship all.
- The door and the bed (the coach points at the free side).
- Clock and energy lines.
- Errands with a 3 s arrow.
- Rosa's full can.
- The day-2 morning note.
- The letter takes its gift and closes.
- The Menu > Goal intro.
- Mara and the shop on arrival ("opens at 8 AM" before 8).
- Rod intro moved out of town.
- The giving intro on day 3.
- The coach bar passes world taps through; only the "?" glyph opens the menu, which closes itself in 4 s.
- Skip confirm and its toast.
- Replay from Options (leaves goals, gold and crops alone; starts at the first possible step).
- v17 migration unit tests.
- Text fits on SE and i13 in both hands.

## Checklist for the owner: be the first-time player on a real phone

Do this on a phone that has never had the game, or use Options > Quit to title > New Game. Don't read the code or
the notes first.

1. **First 30 s, hands only:** tap New Game. Without reading anything, do you know what to tap? Did you pick a
   parsnip within about 10 s? Did it feel good (sound, buzz, pop)?
2. **Left-handed try (second phone or replay):** tap "Left hand" on Rosa's strip. Does everything you then touch sit
   under your left thumb? Does the hand point the right way?
3. **Read nothing on purpose:** skip every line and just tap where the ring and hand are. Can you get to bed on day 1?
4. **Wrong things on purpose:** tap grass outside the plot, walk off to the far corner, open the Menu mid-step, tap
   the middle of the coach line. Does the guide find you again within one step, without scolding?
5. **The row:** when the line offers "hold Action, drag", try it with a hesitant thumb, then once without the hold.
   Did the preview show where the row would go? Did the step still finish when you ignored the tip?
6. **Close the app mid-step** (swipe it away), reopen, Continue. Same step, same line?
7. **Day 2 water:** do you water the crops by tapping, or by Action with the seed slot selected? Does the line ever
   tell you to "tap the seed packet" while you're watering? (open finding 1)
8. **Walk to town using the stick:** start from somewhere odd, near the woodpile north-west of the house. Does the
   stick demo walk you into a stump? (open finding 2)
9. **In town:** is the first thing you see Mara and her shop, with "opens at 8 AM" if early?
10. **Skip and replay:** tap "?" > Skip guide. Does it ask "Sure?"? After skipping, does the toast tell you where to
    replay? Replay from Menu > Opts > Controls: did your crops, gold and goals stay put?
11. **Feel:** at any point, did it feel like a lecture, or did you ever think "what now?" for more than a few
    seconds? Note where.
12. **Small screen:** repeat steps 1-3 on the smallest phone you have (SE size). Does any line get cut off, or sit
    under your thumb?

## Addendum: 1d95c75 (after this report, not re-tested)

The onboarding agent's last commit 1d95c75 reports fixes for open findings 1, 2, 4 and 5 (verify green, 717 unit
tests). I have not played it. Findings 3 and 6 stay open in `agents/NEXT-STEPS-ONBOARDING.md`. Checklist steps 7 and 8
are still the place to confirm 1 and 2 on a real phone.
