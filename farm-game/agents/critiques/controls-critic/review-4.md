# Review 4: M6 tool ring, mirrored sheets, Options low (1962f0b)

**Verdict: left-hand parity is achieved (reach 79% = 79%, every sheet target comfortable), and vertical swipes never open the ring. But the ring fires Action on open, and a quick flick picks a tool on its own.** One blocker and two majors in the ring. The M5 blockers from review 3 are still open in this build.

## Method

- Frozen `1962f0b` in `round-4/farm-game` on port 5181.
- Probe `tools/r4-probe.mjs`:
  - pick: flick, slide, lift, with endpoint jitter σ 2 mm and 1.2 mm plus the 1.5 mm fat-finger offset;
  - overshoot: flick then lift at once;
  - confuse: swipes and flicks with angular slop.
- Diagnostic `tools/r4-acts.mjs`: an exact flick-slide pick on every item, logging acts.
- Reach map: the plan's `reach-map.mjs` and `analyze.mjs` run on this build (`round-4/reach/tables.md`).

## Findings

1. **BLOCKER: opening the ring uses the old tool.**
   - Evidence (`round-4/acts.log`): an exact pick on each of the 8 items (flick 20 px horizontal, reaching 14 px about 115 ms after touch-down, then slide and lift) tilled the front tile **8/8 for the right hand and 8/8 for the left**, and the log shows `act:till` each time.
   - In the jittered probe, picks acted 4-12 times per 42.
   - Cause: `holdMayStart` only looks at vertical travel (`dy`). A sideways flick that has not yet reached 14 px at 110 ms counts as "settled", so the hold starts. Deliberate, unhurried flicks are exactly that slow.
   - A second path: a flick released inside the dead centre acts as a tap. In the overshoot data, a 16 px flick acted 3-4/4 on every profile and hand.
   - Ask:
     - the hold rule uses total travel on any axis;
     - a touch that has opened the ring, or travelled 9 px or more, never acts on release.
   - Accept: 0 acts in 100 ring gestures (picks, cancels and dead-centre lifts) at flick speeds where 14 px is reached at 60-200 ms, both hands.
2. **MAJOR: a flick-and-lift picks the middle item silently.**
   - Evidence (overshoot): flicks of 22, 28, 36 and 44 px released at once changed the tool **4/4 each** (to slot 5, the item at 180 degrees), on i13 and SE, both hands.
   - A player who flicks to peek, or overshoots and lets go, swaps tools without seeing it.
   - Ask: a lift within about 120 ms of the ring opening, or without dwelling 80 ms or more on one item, leaves the ring **open as a sticky menu**: tap an item, or tap outside to close. This also makes the ring discoverable for players who never learn to slide.
   - Accept: 0 tool changes from flick-and-lift, and a sticky ring pick by tap of >= 95% at σ 2 mm.
3. **MAJOR: pick accuracy, with a bias.**
   - Evidence (pick, 42 per row; misses are always the neighbour on the side the thumb-base offset rotates toward, e.g. "want 3 got 4", "want 2 got 3"):

     | endpoint jitter | rows | right | wrong | no pick |
     |---|---|---|---|---|
     | σ 2 mm | i13 and SE, both hands | 24-30 | 8-11 | 3-7 |
     | σ 1.2 mm | i13 and Pixel 7, both hands | 35-37 | 2-4 | 1-5 |

   - Nine sectors of 18.75 degrees at a 50 px radius are 5.2 mm on i13 and 4.6 mm on SE.
   - Ask:
     - apply the touch compensation (`compensateTouch`) to the ring finger point;
     - lay the arc out over pickable items only (skip empty slots), which gives bigger sectors;
     - keep the live highlight.
   - Accept: >= 95% at σ 1.2 mm and >= 85% at σ 2 mm on i13 and SE, both hands.
4. **MINOR: Options still has hard targets.**
   - Evidence: menu-opts has 7/19 outside comfort for each hand: volume "-" hard on the right, two "+" hard on the left, plus Sound, Left hand, Vibrate and Fullscreen in stretch. The Bag and Opts tabs are stretch on every menu screen.
   - It is better than before (11/18 right, 10/18 left), but "Options in reach" isn't met.
   - Ask: move volume and toggles one row lower, or put volume on a single slider row near the tabs. Accept 0 hard targets in menu-opts for both hands on i13.
5. **NIT, accepted with reason: SE bag cells stay at 37 CSS px.** The geometry argument holds (8 × 44 > 323). Suggest gapless hit rectangles (about 40 px) so a touch between cells still lands on one.

## Verified good

- **Left-hand parity:** all-screen comfortable is 79% on i13 for both hands. At M1 it was 75% right and 55% left.
- **Sheets:** bin, board, gift, jar, npc, fishing and plot have 0 targets outside comfort for both hands. Bin, board, gift and jar were 13 of 40 outside for the left hand. Shop has 4/17 outside, all top tabs.
- **Menu** is comfortable on all 5 phones, both hands.
- **Vertical swipes** up to 35 degrees off vertical opened the ring 0/72 times, and all stepped the tool. Flicks 20-30 degrees off horizontal opened it 72/72.
- Outward flicks also open the ring, but they start 12 mm from the edge, so Android's edge-back is not involved. Accepted.
- **Fish** fixed cost is 4 (was 7), per the agent's bench (not re-run).

## Still open from review 3 (not addressed in this build)

3.1 slow-tap till, 3.2 rest-then-steer paint, 3.3 row wobble, 3.4 loop-back commit, 3.5 travel, 3.6 haptic density.
