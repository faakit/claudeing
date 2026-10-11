# Review 2: M1 (96af2f9) and M1.1 (50862db)

Verdict: a huge step up. A cold player harvests in 10-20 s and gets through day 1 in about a minute. One blocker
remains: the coach line itself is a trap that can hide the guide or silently skip it.

Builds: `round-1/` (96af2f9), `round-1b/` (50862db). Bot: `tools/human.mjs` follows only what's drawn (the coach line
and the hand, read from `coach.debug()`). It adds thumb spread of 1.5 mm with a bias toward the thumb base, reading
pauses of 0.25-0.9 s, about 12% wrong taps, a wander at "grow", close/reopen at "ship", a paint hold of 200-450 ms
or no paint at all. Skip and replay: `tools/r1-skip.mjs`. Results: `round-1b/runs/*/result.json, log.txt, NN-*.png`.

## Numbers (M1.1, 12 runs: i13/SE x right/left, human, never-paint, clean)

|                                 | before (round 0)                   | M1.1                                                                                   |
| ------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| reaches day 2 by guidance alone | literal follower: 0 tiles in 60 s  | 9/12 (8 reach town; 1 skipped by accident after waking), all 4 failures from finding 1 |
| first harvest step done         | n/a                                | 9-21 s                                                                                 |
| day 1 (New Game to bed), clean  | 65 s, only if you know the secrets | 38-54 s                                                                                |
| day 1, human-ish                | n/a                                | 61-81 s                                                                                |
| New Game to town, clean / human | n/a                                | 101-124 s / 130-147 s                                                                  |
| lines longer than one row       | 3-line toast, 11-line morning      | 0 (24 distinct lines); morning 3 lines                                                 |
| close/reopen mid-step           | resumes, no reminder               | resumes on the same step with its line (6/6)                                           |
| never paints                    | n/a                                | completes "grow" with single Actions (2/2 runs without a menu accident)                |

## Findings

1. **blocker. The coach line is a trap (A1, A5, A6).** Any tap on the bar opens [Skip guide][Back]. The bar is a 24 px band, 12% of the world view, and targets near the top sit right at its edge (the mailbox, the bed). The menu does three things:
   - it replaces the instruction and hides the ring and hand;
   - it never closes by itself (still open after 8 s in r1-skip, and for minutes in runs);
   - its Skip guide fires on one tap, with no confirm and no "replay in Options" note, and sits over where the player was aiming.

   The "x" glyph reads as "dismiss this". A world tap under the bar is swallowed (stray tap at y=85: player moved 0 tiles).

   Evidence, M1.1: all 4 failures out of 12 share this cause.
   - `se-left-clean`: zero wrong taps. The tap on the mailbox at the bar edge opened the menu, the repeat tap hit Skip, and `tut.off=1` landed on day 2 (`round-1/runs/se-left-clean/11-step-mail.png`).
   - `se-left-s2`: guide off inside the house at the bed.
   - `i13-left-s3-never` and `se-left-s14`: the menu stayed open, "grow" stalled 4+ min (`round-1b/runs/se-left-s14-human/08-loop-grow.png`, `round-1/runs/i13-left-s3-never/09-stall-grow.png`).

   Ask:
   - (a) a tap on the line never shows a one-tap Skip: use the welcome's two-tap confirm, or move Skip to Options;
   - (b) the menu closes on its own after about 3 s and on any world or dock touch;
   - (c) a glyph that doesn't mean close ("..." or "?");
   - (d) after a skip, one toast: "Guide off. Replay: Menu > Opts > Controls.";
   - (e) world taps under the bar reach the world, except on the glyph;
   - (f) keep the ring and hand at least 12 px clear of the bar, or move the bar to the bottom of the world view when the target is in the top band;
   - (g) e2e: a stray tap on the bar mid-step, then carry on.

2. **major. water2 says "tap one" but needs every crop (A4).** "Crops need water daily: tap one." is done only when no crop is dry. Clean runs took 38.6 s / 23 taps (`i13-left-clean`) and 18 s / 9 taps (`se-left-clean`). In i13-left-clean one crop took 6+ taps with no effect (aim 108,198, farmer at 12,18; log @84 s). Ask: show a count ("Water the dry crops: 4 left") or accept "tap one". Offer the row (hold Action, drag waters a row) as the alt. Reproduce the no-effect taps (seed 8, i13 left, WRONG=0).
3. **major. `coach.debug().aim` goes stale while the line menu is open.** `pointer:null` but `aim` is still set (see the stall logs), so an aim-following e2e can't see finding 1 and my bot chases a ghost. Ask: clear `aim` whenever nothing is drawn.
4. **minor. Ship all leaves the bin open, then "Close this to carry on."** That's an extra step that teaches nothing. Ask: Ship all closes the sheet during the guide.
5. **minor. HUD tags without a reason.** "^ Energy" during grow, "^ Clock" during sleep, and water2 is tagged "gold". The line never says why. Ask: tag only what the line talks about; water2's gold tag looks like a data slip.
6. **minor. "Can't get there." flashes in the coach line at the sleep step (2 runs).** It isn't in the refusal map. Ask: reword it ("Tap the ringed tile.") until the controls fix lands.
7. **minor (owner call). Bed at 7:37-7:53 AM in every run.** The note promised "an evening to spare", but day 1 covers about 90 game minutes. Clock, energy, "late" and "tired" never come up, and Mara's shop is shut when you reach town on day 2 before 8 AM. Ask: put this to the owner (a forage/explore beat before bed, or accept).
8. **minor. Day-2 goal bar mismatch (you know about it).** "Pick up 3 wild goods" shows over water, mail, menu and jobs. Track it.
9. **nit. Welcome strip and line covered y 73-170 (half the world) on 96af2f9.** M1.1 says the strip gives way; I'll verify next round.
10. **nit. tips/hints after a skip.** The old idle hint "Walk into the house and use the bed with Interact." returns after a skip (fine), but it still says Interact while the coach says tap. Align the wording.

## Acceptance status

A1 FAIL (finding 1). A2 pass. A3 pass. A4 partial (finding 2). A5 partial (welcome skip and replay OK; replay starts at
the first possible step and leaves goals alone; line-menu skip has no confirm). A6 fail (the bar swallows world taps).
A7 pass for wandering (every wander run came back) except the menu. A8 pass (all lines fit, Action and hand mirrored for
left). A9 pass (6/6). A10 partial. A11 partial (26 tutorial unit tests pass; your verify is green; e2e misses finding 1).
