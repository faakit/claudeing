# Review 2 (checkpoint 1, commit 8ee191f) - 2026-10-08

Frozen copy: round-2/ (git archive 8ee191f). `npm run verify` green: 358 unit tests, e2e + mobile e2e (one AudioContext PASS,
offline PASS), perf 0.73-1.28 ms JS/frame, 2-3 draws. Payload: inst 1.16 MB, sfx 0.16 MB, amb 0.42 MB (2.0 MB total), all mono 44.1k MP3.

Licences re-checked on source pages: Kenney RPG Audio, Impact Sounds, Interface Sounds, UI Audio = CC0; OGA shovel (from freesound 503672,
CC0 confirmed on freesound), swishes, 100-cc0-sfx, 40 water/splash, rain-loopable, crickets, ambient-bird-sounds, bird-chirping, dungeon
ambience, wind1 = CC0. Dripping-water-loop: author Independent.nu, submitted by qubodup; upstream licence not verifiable (archive page
unreachable) -> F22 blocker. Crickets page carries attribution notice "Ted Kerr" -> credit.

Measurements (my renders through the game's own renderOffline, default settings; tools/ scripts):
- Music integrated: spring day -26.0, summer -25.2, fall -25.7, festival -24.4, winter night -29.7 LUFS; no clipping anywhere.
- Stress (festival, music 1, sfx 1, rain, 60 cues in 15 s): -13.6 LUFS, TP -0.3 dBTP, 0 clipped samples.
- SFX max momentary (K-weighted, 400 ms) at output: buy -15.5, coin -16.3, refill -16.8, water -18.2, order -18.2, goal -18.6,
  sleep -19.4, level -19.5, till -20.0, door -19.0, cut -21.6, heart -21.8, harvest -22.8, plant -24.4, error -24.8, swing -26.0,
  stepGrass -27.3, ui -28.6, select -29.6, stepWood -30.9.
- Rapid water (16 x 0.2 s, music off): -14.6 LUFS, TP -0.7 dBTP.
- Ambience loops: periods exactly 12/9/15/16 s, no RMS step or 2nd-difference spike at wrap points (seams clean).
- Winter night (3/4, bar 3.214 s): median -3.2 dB dip at +0.15..0.3 s after bar lines; 44 % of 72 bars dip > 4 dB.
- Repetition proxy (beat-chroma self-similarity over 3-4 min): no fixed loop (best-lag mean similarity 0.66-0.75), 23-40 distinct bar types.
- Residency from renders: 18.8 MB baseline (sfx + jingle instruments), 23-34 MB with a piece.
- File checks: sfx onsets <= 2 ms (except bell-layered buy-1/coin-3 ~33 ms to -20 dB re peak); buy-2 TP -0.8 dBTP; ui family 3.3 dB spread;
  ui-3 ends at -35 dB re peak (no fade); cello/viola zones reach -20 dB re peak 35-115 ms after start.

Code: eviction bug (status() -> bank.get(file) with now=0 resets lastUse), perf run plays only 3 sfx.
Harmony: spring/summer/title/festival A sections all I-vi-IV-V with ii7-V7-I cadence; fall/winter both i-VI-iv-V.

Findings sent: F18 (major) cross-family loudness scale; F19 (major) held-repeat stacking; F20 (major) harmonic sameness;
F12 (major, confirmed) pad dip; F21 (major) eviction bug; F22 (blocker) drips provenance + Ted Kerr credit; F23 (minor) crickets 9 s;
F24 (minor) claims/ROADMAP/perf sfx coverage; F25 (minor) SW global cache version re-downloads audio; F26 (nit) file nits.
Resolved this round: F5 (residency measured 19-34 MB), F6 (one context, e2e), F7 (ambience seams clean, periods exact), F9 (caps + bird
one-shots present), F10 (SW controller wait), F11 (zone test), F13 (render 30-41x realtime, perf with music), F14/F15/F17 (tested).
