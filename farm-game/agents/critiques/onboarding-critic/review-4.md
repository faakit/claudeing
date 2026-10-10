# Review 4 (final round): M4 fd9dcfc, same as final.md

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
