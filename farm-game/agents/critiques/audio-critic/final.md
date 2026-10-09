# Audio critique: final report (R4.2 "Real audio", branch audio/real-audio)

Reviewed: final commit f305b87 (code at f9c0aae), measured on a frozen copy (`round-3/`), plus the earlier rounds
(R0 plan, R1 design, R2 checkpoint 8ee191f). Ledger: `ledger.md`; per-round notes: `review-0..3.md`.

**Nothing here was listened to.** The critic and the audio agent both judged by measurement only (offline renders of the
game's own engine in headless Chromium, ffmpeg ebur128, numpy). Nothing ran on a real phone, and iOS Safari/WKWebView and
Android WebView decoding and unlock are untested. The agent's report and NEXT-STEPS-AUDIO.md say this correctly.

## State at the end

- `npm run verify` is green on my frozen copy: 359 unit tests, e2e and mobile e2e (exactly one AudioContext, files decode,
  sampled notes and recorded sfx play, offline mode works), perf 0.71-1.23 ms JS/frame, 2-3 draws/frame, with music playing.
- Payload: 2.0 MB of mono MP3 (instruments 1.3 MB, sfx 0.2 MB, ambience 0.5 MB). Decoded memory measured at 14-27 MB per scene.
- Licences: every source page was opened and checked. All are CC0: VSCO 2 CE and VCSL on GitHub, 4 Kenney packs, and
  11 OpenGameArt pages, including thunder from "100 CC0 SFX #2". The shovel take comes from Freesound 503672, which is also CC0.
  No unclear licences remain.
- Loudness at the output, default settings:
  - Music, by day: -23.7 to -25.7 LUFS. Winter night: -29.5 LUFS.
  - Rewards (harvest, coin, buy): -21.1, -21.0, -19.5 max momentary.
  - Tools: water -19.9, cut -22.2, till -23.1.
  - UI: about -27. Steps: -28 to -30.
  - Stress case (festival music, rain, 60 effects at full volume): no clipping, true peak -0.3 dBTP.
- Loops: the ambience loop periods are exact, with no level jump or click where they wrap. No fixed music loop: 23-40
  distinct bars per piece in 3-4 minute renders.

## Open findings, by severity

**Major**
- F20, the seasons share one harmony. Spring, summer, title and festival A sections are all I-vi-IV-V with the same
  ii7-V7-I cadence, and summer is spring a tone up. Fall and winter share i-VI-iv-V. The agent deferred this; it is at the top
  of NEXT-STEPS-AUDIO.md with concrete options. It is the biggest remaining risk to "each season sounds different".

**Minor**
- F24, perf coverage: the "holding Action" scene still plays only 3 sfx, so the perf budget barely covers sound effects.
- F25, service worker: the cache version is global, so every release re-downloads all 2 MB of audio.
- F23, crickets: the 9 s repeat is gone (self-correlation 0.999 down to 0.48), but the 9.0 s and 7.2 s loops realign every
  36 s (correlation 0.998). ASSETS.md says 7.33 s, which would give 198 s; the manifest loop is [1, 8.2], which is 7.2 s.
- F18 leftovers:
  - The heart jingle overshot to -16.8, now the loudest event; before the fix it was -21.8, too quiet.
  - Till is 3 dB under water in the same family.
  - Output levels read 1-3 dB under the agent's build targets.

**Nits**
- ui-1 is about 2 dB under its target.
- The winter-night pads now swell by a median of +3 dB 0.3-0.5 s after each bar line. This replaced the old dip and is
  probably fine musically.

## What improved because of the conversation

- **Music architecture (R0).** The plan was to bake a numpy synth into 24-40 s MP3 loops. It became a runtime sampler that
  plays composed phrase pools on CC0 orchestral samples (VSCO 2 CE, VCSL). That removed the loop repetition. Decoded memory
  is 14-34 MB rather than my 100-200 MB worst-case estimate for all-decoded loops.
- **Gain staging and loudness.** Music now sits near -25 LUFS by day (the plan's -18 LUFS would have played at about
  -32 in game).
  - Effects were measured unweighted at first; they now use K-weighted max momentary loudness, targeted by role.
  - Harvest was 6.5 dB under coin; it is now level with it.
  - The spread within the tools family went from 8 dB to 3 dB.
- **Single AudioContext.** Phaser had been creating a second AudioContext of its own. Its audio is now off, and e2e checks it.
- **Licences.** An unverifiable drips source (Independent.nu, re-uploaded by qubodup) was removed and replaced from a CC0 source.
  The missing "Ted Kerr" credit was added.
- **Held repeats.** Watering a row was about 10 dB above the music (-14.6 LUFS). It is now -25.5. Repeats within 350 ms play
  4 dB softer, and water uses a single voice.
- **Pad dip.** The bar-line dip in winter night (median -3.2 dB, 44 % of bars over 4 dB) is gone: 0 % of bars dip more than 3 dB.
- **Eviction bug.** The status poll reset each sample's last-use time. That would have evicted the season samples 30 s after
  entering the mine and caused up to 6 s of silence on return. Now fixed and tested.
- **Smaller fixes:**
  - Pitch shift is capped at 4 semitones (6 for mallets and pizzicato), and a test enforces it.
  - Sustained instruments have crossfaded sample loops.
  - A late scheduler skips ahead instead of bursting the missed notes.
  - Nothing is scheduled while muted.
  - A failed instrument falls back to the synth for that part only.
  - Footsteps and other frequent sounds are capped per voice; birds are scattered one-shots.
  - Audio downloads once, through the service worker.
  - buy-2 true peak is now under -1 dBTP, ui-3 has a fade, cello and viola attack lag is compensated, and the limiter's
    make-up gain is documented.
  - ROADMAP marks R4.2 as partial instead of done.

## What a human should listen to first (phone speaker, then headphones)

1. **Farm work in spring, daytime.** Walk, then hoe, water and harvest a row while the music plays. Are the effects clear
   above the music without being harsh, and does held watering sound like a steady pour?
   Renders: `round-3/renders/farm-work-200ms.wav`, `water-rapid.wav`, `till-rapid.wav`, `steps-rapid.wav`.
2. **Season music, day and night.** Do the composed melodies sound pleasant and in tune, given that nobody has heard any
   pitch-shifted sample? Do the seasons sound different enough? This is where F20 would show.
   Renders: `round-3/renders/long-spring-day.wav`, `long-summer-day.wav`, `long-fall-day.wav`, `long-winter-night.wav`,
   `long-festival.wav`.
3. **The title music.** It is the first impression. Render it with `node audio-src/tools/render.mjs <dir>` (job `music-title`).
4. **The jingles: heart, level, goal, order, sleep.** Heart is now the loudest event (-16.8).
   Render: `round-3/renders/sfx/sfx-heart.wav`.
5. **Ambience: crickets over a long night, rain, wind, thunder, mine.** Can you hear the crickets loop at 36 s? Are the birds
   too loud?
   Renders: `round-3/renders/crickets-60.wav`, `cave-60.wav`.
6. **On a real iPhone and Android phone:** unlock on the first tap, resume after a phone call, the iOS silent switch (web vs
   app), and footstep latency over Bluetooth.

## Addendum

The audio agent then stopped at 7364617, a docs-only commit (ASSETS.md and NEXT-STEPS-AUDIO.md, checked). ASSETS.md now says 7.2 s for the crickets, matching the manifest, so the documentation mismatch is fixed. The 36 s realignment is still open; the proposed fix is a 7.333 s second loop. The round-3 open findings are recorded in NEXT-STEPS-AUDIO.md. No code changed after f9c0aae, so the round-3 measurements still apply.

---

# Round 2 (branch audio/round2, final commit 1127690)

Second audio agent (a5aad60d5c5e813c6). Reviews: review-4.md (acceptance criteria) to review-8.md (final); frozen copies round-5 to round-8.
Still true: **nobody has listened to any of it, and nothing ran on a phone**. All judgments come from offline renders of the
game's own engine. NEXT-STEPS-AUDIO.md says this correctly.

## State at the end (measured on round-8/)

- `npm run verify` green: 475 unit tests, e2e, mobile e2e, perf. A new perf scene plays 20 sound effects a second over music
  (about 100 played per run): 0.87-1.00 ms JS per frame, about 142-145 fps even at 6x CPU throttle.
- Seasons now differ. Every criterion I set in review-4 passes:
  - Each of the six pieces has its own main progression and its own cadence:
    - spring: I-vi-IV-V
    - summer: D mixolydian over a pedal, with a bVI-bVII-I bridge
    - fall: E minor, Andalusian progression
    - winter: D minor in 3/4 over a pedal, ending on suspensions
    - title: Eb with borrowed minor colours and a two-bar intro
    - festival: ragtime with a minor trio
    - The mine adds a phrygian deep section.
  - Same-harmony score, 1 meaning the same harmony up to key: daytime pairs max 0.910 (spring-summer, was 0.955),
    fall-winter 0.870 (was 0.953), spring-title 0.878, night pairs max 0.915.
  - Detected keys match the declared ones. Summer reads as G major, the parent scale of D mixolydian: the key detector cannot
    tell modes apart, and I accepted that.
- Levels: music by day -24.7 to -25.6 LUFS; at night -27.4 to -28.8; mine -28.9, deliberately quieter and -27.0 with the cave
  background (recorded in DECISIONS.md).
  - Every music render peaks at -6.0 dBTP or lower.
  - Effects are at their role targets within about ±1 dB (median of 16 hits). Rewards -17.6 to -18.0, tools -19.6 to -20.2,
    swing and plant about -22 to -23, UI about -25, footsteps and the new touch cues about -27 to -28.8.
  - At default volume no single effect peaks above -4.6 dBTP; coin was -2.2. Maximum sliders with everything playing:
    -1.0 to -1.3 dBTP, nothing clips (a soft clipper now follows the compressor).
- Crickets no longer repeat audibly: over 3-400 s the strongest repeat correlates at 0.48 (it was 0.999 every 9 s).
- The offline cache now stores audio per file under a content hash and survives releases, so an update downloads only the
  audio that changed. A test proves it.
- Touch cues for the one-thumb controls (tick, target, ringOpen, ringClose, confirm):
  - 36-68 ms long, under the UI click's level, with matched takes (tick spread 2.7 dB).
  - Fast repeats play 8 dB quieter, and a tick within 70 ms of the last is dropped.
  - A tick suppresses the footstep on the same tile.
  - 10 taps a second for 5 s comes to -29.5 to -30.3 LUFS.
  - Haptics policy: sound for frequent events, vibration only for rare deliberate ones.
  - Not yet wired into the game: the controls branch owns those call sites, so in-game behaviour is unverified.

## Open at the end of round 2

- No open findings in the ledger.
- Nits:
  - NEXT-STEPS-AUDIO.md still quotes 474 tests and 92 fps at 6x; it is now 475 and 141.6.
  - It also lists the mine level under Open, though that was decided.
- To watch on phones: each sound effect creates new audio nodes. This no longer costs frames at 6x throttle.
- Unverified until wired: whether the touch cues behave as above at real drag and tap rates in the actual controls.

## What improved because of round 2's conversation

- **Distinctness.** I set measurable criteria before any music was written (review-4); every piece now has its own harmony.
- **Title.** It was the piece closest to spring (0.919) and is now 0.878, with a lower, syncopated tune and an intro.
- **Limiting.** The output limiter was not a hard ceiling: it produced 1 clipped sample at max sliders. A soft clipper now
  follows it, and spiky effects are capped where they are built, so normal play stays clean (worst single effect -4.6 dBTP).
- **Peaks.** The winter-night piano and the title glockenspiel peaked at -4 to -5 dBTP; all music now peaks at -6 dBTP or
  lower.
- **Uneven ticks.** One tick take was 5 dB quieter than the others (7 dB spread); now 2.7.
- **Perf.** It never exercised sound effects (3 per run); it now does (about 100).
- **Offline cache.** Every release re-downloaded all 2 MB of audio; now only the changed files.
- **Critic error, withdrawn.** My round-5 claim that water, footsteps and the swing were off their targets came from a
  single-hit measurement. I re-measured over 16 hits and withdrew it (F32), and I now use that method (`tools/hits.py`).

## What a human should listen to first (round 2)

The agent's listening order is `C:/Users/andre/dev/tiny-acre/audio-renders/round2/LISTEN.md`. My priorities:

1. **The four seasons by day, back to back, then by night.** Do they now feel like different seasons, and is the music
   pleasant and in tune?
   - Files: long-spring-day, long-summer-day, long-fall-day, long-winter-day, then the -night versions.
   - In summer, check the off-beat marimba rhythm and the higher tune.
   - In winter night, listen for anything harsh in the piano.
2. **The title, including its two-bar intro (long-title).** It is the first impression and now sounds less like spring.
3. **Spring farm work.** Effects against music, then held watering and a painted row of ticks.
   - Files: mix-farm-work and drag-row-15 in audio-renders/round2; farm-work-music in audio-critique/round-8/renders.
   - Is the coin still bright without being harsh?
4. **The festival's minor middle section** (from about 1:09 in long-festival) and **the mine's deep section** (from about
   1:52 in long-mine). Is the mine audible over the cave sound on a phone speaker?
5. **On real phones**, once the controls branch wires the cues: tap and row-paint feedback with haptics on, then the
   unlock, phone-call and silent-switch checks from round 1.

## Round 2 addendum

The agent stopped at ebcc9eb, a docs-only commit (verified). NEXT-STEPS-AUDIO.md now says 475 tests and 141.6 fps at 6x, and lists the mine level as decided. Both doc nits are closed; no code changed after 1127690.

---

# Round 3 (branch audio/round2, final commit 0c7c3a8, last code commit 892183c)

The same agent (a5aad60d5c5e813c6) worked from the coordinator's second list. Reviews: review-9.md (c6c9181) and review-10.md (892183c);
frozen copies round-9/ and round-10/. 0c7c3a8 changes only NEXT-STEPS-AUDIO.md (checked), so round-10's measurements are final.
Still true: **nobody has listened to any of it, and nothing ran on a phone.** NEXT-STEPS-AUDIO.md says so, including that the new
triggers are unit-tested but unheard.

## What was added

- **Villager motifs.** Each villager has a short tune when you first talk to them each day, and a warmer version on a new heart.
  - -20.9 to -22.8 max momentary; the music dips 4-5 dB under them.
  - The lead instrument is chosen at runtime as one the current piece isn't using.
- **Weather arrangements.** Rainy and stormy days drop the percussion, thin the accompaniment and sit 2.5 dB lower. The music dips
  under each thunderclap.
- **Interiors.**
  - Shop: its own piece while the shop panel is open, after 1.5 s, over creaks, a forge, an anvil and a clock: -25.6 LUFS.
  - House at night: a harp lullaby at -30.5 LUFS, with a wall clock about 10 dB under it.
- **Moments.**
  - Dawn and dusk flourishes, 3 variants each, only on the first day of each week.
  - A season-change sting under the sleep screen.
  - Festival openers per season.
  - A special-order fanfare, which now has priority over the ordinary order jingle.
- **Year two.** Each season gets a new A2 section with new phrases (-24.6 to -25.3 LUFS).
- Payload is 1.96 MB, about 0.2 MB more, mostly the interior ambience.

## State at the end (measured on round-10/)

- `npm run verify` green: 484 tests. The 20-sfx/s perf scene runs 0.90-1.04 ms JS per frame at 141-145 fps.
- All six round-3 findings that were raised are closed.
- One nit is accepted: in year two, spring-summer is 0.922 on the same-harmony score (1 = same harmony up to key), 0.002 over my
  0.92 line and inside run-to-run noise. The other year-two pairs are 0.882-0.904. A fix is noted in NEXT-STEPS: separate spring
  A2's E7-A7 move from summer's Gmaj7/Bm7.

## What improved because of round 3's conversation

- **Shop music stuck.** After visiting the shop, opening the Menu or a villager sheet played the shop music. A headless probe found
  it; it is now fixed (PanelTracker, cleared every frame) and tested, and the probe passes.
- **Stings clashed with the harmony.**
  - Before: their final notes sat a semitone off the chord under them in 7-42 % of chords, and up to 73 % for Finn's motif and
    the dawn flourish over summer (`tools/clash.py`).
  - Now held notes snap to the sounding chord at runtime, and a test covers every sting over every chord.
- **Motifs were inaudible.** They were only 2-3 dB above the dipped music, on the same instruments; they are now about 6-8 dB
  above, on an instrument the piece isn't using, and limited to the first talk of the day.
- **Lullaby was too quiet:** -34 LUFS before, -30.5 now.
- **Dawn and dusk.**
  - Dawn could never fire outdoors.
  - Dusk would have repeated one figure 100+ times per save; it is now rationed to the first day of each week, with 3 variants.
- **Fanfares overlapped.** The special and order fanfares played on top of each other; jingles now have a priority. The board-code
  question went through the coordinator, not to the depth agent.

## What a human should listen to first (round 3 additions)

The agent's order is in `audio-renders/round2/r3/LISTEN.md`. My priorities:

1. **Villager motifs over season music** (`moment-motif-*.wav`, plain and heart versions). Do they read as each villager's
   theme, are they audible without being intrusive, and do the chord-fitted endings sound natural?
2. **The house lullaby** (`house-night.wav`). Is it audible on a phone speaker at normal volume, and is the clock soothing rather
   than irritating?
3. **The shop** (`shop.wav`). Check the smithy forge and anvil under it: are they charming or noisy when you shop daily?
4. **Rainy and stormy days** (`rain-*-day.wav`, `storm-summer.wav`). Does thunder ducking feel natural?
5. **The season-change stings and the special-order fanfare** (`moment-season-*.wav`, `moment-special*.wav`).
6. **Year two against year one, same season.** Is the variation noticeable? They measure 0.97-0.98 similar, so it is subtle by
   design.
