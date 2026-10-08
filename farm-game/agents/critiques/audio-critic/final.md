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
