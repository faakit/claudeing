# Open findings (as of 2026-10-11)

This file collects every critic finding that was still open after round 4. Each one was checked against the
integration branch `integration/round4-2026-10-11`. **No blocker and no major is open in any area.** The critics'
full reviews, ledgers and screenshots were removed in the docs cleanup; [HISTORY.md](HISTORY.md) says how to get
them back from git.

Every number below comes from headless Chromium on emulated phones, measured by bots. No real phone and no real
player were involved.

Severity: **minor**, **nit**, **accepted** (a trade-off the critic agreed to), **owner** (needs the owner's call),
**unverified** (only a real phone or a person can tell).

When you close an item, delete it. When you add one, cite the scenario that shows it
(`?scenario=<name>`, see [AGENTS.md](AGENTS.md)).

## Game depth (critique 12, depth round 4)

- **minor. Summer is empty for a farmer** (critique 11 F1, critique 12 F5). On the first days of summer and fall,
  the board only posts fish and wild-goods requests. Crop requests only appear within 7 days of a ripe crop the
  player grows (`systems/orders.ts`). A possible fix: a seasonal crop request posted on day 1 for a crop that was
  planted.
- **minor. The bin row says "Board 16"**, which adds the 5 board requests and Rosa's 11 into one number. Split it
  ("Board 5 Rosa 11") if it fits.
- **unverified. The race with Clay after the round-4 fixes.** A careful keeper won 15 to 12 when it was replayed. A
  careless player was not replayed after the fix (critique 12 had that player losing 0 to 12), and neither was
  year two. This is the first job for critique 13.
- **owner. Clay's catch-up crates.** He ships a crate every 2 days while you lead by 3 or more, and every day while
  you lead by 5 or more. Does that feel right, or should the race be about the board rows instead?
- **owner. Waiting goals.** A goal with no progress for 3 days steps aside. Is 3 days right, and should a waiting
  goal come back to the HUD once the player makes progress on it?

## Guided start (onboarding critic, round 2 final)

- **minor. A burst of tips right after the first purchase on day 2.** Three held tip toasts fire within 3 s, on top
  of the coach line. Release them one at a time, at most one per in-game hour (`checkTips` and the
  `holdTipsWhile` release in `systems/goals.ts`).
- **minor. The `job1` goal has no `where`.** After "Buy", a player stood in town on day 2 for about 5 minutes with
  no arrow. Point it at the board, or at the villager who posted the job (`src/data/goals.json`).
- **minor. "+1 Wild Leek" overlaps the "GOAL COMPLETE" banner** at the top of the world view. This belongs to
  Hud/FX, not the guide.
- **nit. "Buy 5 items" completes after one purchase.** Check which stat the goal counts.
- **nit. The stick demo's hand is drawn over the hotbar**, because the stick's home position sits just above it.
- **unverified.** The evening `sleep` step and the bed offer's 40-minute expiry have unit tests only. An e2e test
  would need about 6 real minutes of play.

## One-thumb controls (controls critic, round 3 final)

- **minor. Serpentine paint on an SE-sized phone with a shaky thumb.** With 2 mm wobble and following the preview,
  75-85% of paints come out exactly right, against a 90% bar. The iPhone 13 reaches 90-100%. The critic suggests a
  visible cue for the first row's width, or U-turn rows that snap to the edge of the tilled plot.
- **minor. Ring sticky-menu taps on SE, left hand: 23-26 out of 28** (the bar is 90%). A miss picks nothing.
- **accepted.**
  - plot3x3 thumb travel is 250-286 mm on bigger phones. This is the cost of the 16 px paint step, which keeps
    corners accurate.
  - About 1 stick stop in 5 or 6 lands a tile late, at a 180 ms reaction time.
  - A tap on the farmhouse door tile itself enters 67-100% of the time. A tap on the door art always enters.
  - The bag cells on SE are 37 px.
  - The shop's top tabs are outside the comfortable reach zone.
  - On a Pro Max, "Quit to title" in Options is hard to reach.
- **owner.** Paint step: 16 px (sure corners, 3 tiles of reach toward the screen edge), 10 px (4 tiles, corners
  less sure), or 10 px toward the edge and 16 px elsewhere? Which phone does the owner play on? The bench can
  weight that profile.

## Game feel (feel critic, round 4 final)

Nothing is open. The critic accepted the final build, and its one nit (the pickup text) was fixed in 875eda6.

- **accepted (ruling F13).** On iPhone 13 and SE the canvas is not drawn at a whole-pixel scale, so fine patterns
  can crawl slightly while scrolling. Rendering at an integer multiple and downscaling smoothly would fix it
  without moving touch targets.
- **watch.** The tap that starts a new game creates the AudioContext inside the gesture, which takes 60-110 ms at
  4-6x CPU throttle. This is how the iOS audio unlock is designed to work.

## Art (art critic, round 4 final)

Nothing is open from the critic. The two older minors, R6-2 (the doubled "New Game" label, fixed in c37d5da) and
R3-6 (the marker over the player's head, see DECISIONS.md "The target marker lies on the ground"), are fixed.

- **owner.** Real footprints for buildings (a 2x2 coop, a 3x2 barn, 2x2 landmarks) and a wider statue.
- **unverified.** Every animation was judged from headless renders and GIFs only.

The art lane's own backlog is in [NEXT-STEPS-ART.md](NEXT-STEPS-ART.md).

## Audio (audio critic, round 3 final)

- **nit (F43, accepted).** The year-two spring and summer pieces are 0.922 alike in bar-chroma similarity, 0.002
  over the 0.92 line. If spring A2 is touched again, change its E7-A7 secondary dominants.
- **nit.** `select` plays at -26.6, about 1.5 dB under its UI target.
- **unverified.** Nobody has listened to any of the audio. That includes the touch cues (now wired), the motifs,
  the shop and lullaby pieces, dawn and dusk, and the season stings.

## Real-phone checklist (needs the owner)

This merges the critics' checklists. Play right-thumb only, then left-thumb only (Options > Controls > Left hand),
holding the phone normally. `?devmenu` jumps to any scenario on the phone.

**First-time player** (a fresh install, or Options > Quit to title > New Game; don't read anything first)

- [ ] In the first 30 s, do you know what to tap? Did you pick a parsnip within about 10 s?
- [ ] Skip every line and only tap the ring and the hand: can you get to bed on day 1?
- [ ] Do wrong things on purpose (tap outside the plot, wander off, open the Menu mid-step): does the guide find
      you again without scolding?
- [ ] After the day-1 errands, does "All done! Sleep, or keep exploring." leave you alone if you keep exploring?
- [ ] Day 2: does the rain morning read as a gift? Does "Tap the counter to buy seeds." work before 8 AM?
- [ ] Day 2, in town after 10 PM: do the lines walk you home?
- [ ] Day 3: does the watering line point at the door, then at your dry crops?
- [ ] After your first purchase, do several tip toasts pile up? (open finding above)
- [ ] Close the app mid-step, reopen and Continue: same step, same line?
- [ ] On the smallest phone you have, is any line cut off or under your thumb?

**Controls**

- [ ] Tap a tile 4-6 tiles away: does the farmer walk there at once? Slow, firm taps on grass must only walk.
- [ ] Walk along the path in front of the farmhouse by tapping: you should never end up inside.
- [ ] Rest your thumb on the field, then steer: nothing should get worked.
- [ ] Quick taps and slow presses (up to 2 s) on Action: exactly one use each.
- [ ] Press Action and let your thumb roll as you lift: one use, or a small shake and buzz. Did it match what you
      meant?
- [ ] Hold Action until it ticks, then paint a serpentine over a 3x3 plot. Did it turn where you turned? Did a
      wobble ever turn it, or paint outside the plot? Dragging back to the start should do nothing.
- [ ] Flick Action sideways and pick from the ring. Did a miss ever pick the neighbour?
- [ ] Which targets needed a regrip: Menu, Sound and Vibrate in Options, the bag, the shop tabs?
- [ ] iPhone: does a swipe up from the hotbar trigger the home gesture? Android: does a flick from Action toward
      the edge trigger "back"?

**Feel and look**

- [ ] On a 120 Hz phone, walk right and down: the farmer should sit dead still while the ground scrolls, and glide
      back to centre about 0.2 s after you stop.
- [ ] Do the feet step rather than skate, at full and half speed?
- [ ] A hoe swing: does the button light the instant you touch it, and does the dust land on the strike?
- [ ] Doors: a quick dither in and out (under 0.3 s), with the HUD and dock staying put?
- [ ] Calm mode (Options): pops, particles and slides should stop; fades stay.
- [ ] iPhone 13 or SE: slowly scroll over grass and fences. Shimmering columns are the canvas-scale ruling, not a
      bug.
- [ ] Look at the art in sunlight and at night brightness.

**Towing (the Weir's verb, M7)** (scenarios `tow-first-log`, `tow-long-log`, `tow-east-lane`; and the lab's
`tow-lane-long`)

- [ ] `tow-first-log`: tap the log at the river's head. The farmer walks over and the rope throws out. Tap the slip on
      the south bank (or the water below the log): the log trails behind, catches on the reeds, a tap or Action
      tugs it free and he walks on, then hauls it in onto the slip. About 6 s, never a second tap for the same thing.
- [ ] `tow-long-log`: the long log waits caught on the rock. Two tugs, then he walks it down by himself: 3 timber.
- [ ] `tow-east-lane`: tap the far log. He walks to the slip and waits for the spur to turn it; it lands by itself.
- [ ] Each one once with Action only, and once with the other hand. With the left thumb, is any tap a stretch?
- [ ] Haptics: a tick on the hook and the snag, a firmer one on the tug, success on the landing.

**Sound and device** (see also [docs/MOBILE.md](../docs/MOBILE.md))

- [ ] Listen to each season by day and night, the title, the festival and the mine. Are the touch cues audible but
      not tiring?
- [ ] Audio unlocks on the first tap, resumes after a phone call, and behaves with the iOS silent switch.
- [ ] Haptics (native build only): is the tick light, and does it land on the strike, not on the press?
