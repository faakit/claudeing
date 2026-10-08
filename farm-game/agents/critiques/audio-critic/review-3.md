# Review 3 (final, commit f305b87; code f9c0aae) - 2026-10-08

Frozen copy round-3/. `npm run verify` green: 359 unit tests, e2e + mobile e2e, perf 0.71-1.23 ms JS/frame, 2-3 draws.
Payload 2.0 MB. New sources: thunder from OGA "100 CC0 SFX #2" (rubberduck) = CC0 (page checked); drips now cut from jaggedstone's
CC0 dungeon ambience (Independent.nu source removed); Ted Kerr credited.

Output measurements (renderOffline, default settings):

- Music integrated: spring -25.5, summer -24.7, fall -25.7, festival -23.7, winter night -29.5 LUFS. Stress TP -0.3 dBTP, no clipping.
- SFX max momentary: buy -19.5, coin -21.0, harvest -21.1 (rewards spread 1.6 dB, was 7.0); water -19.9, cut -22.2, till -23.1
  (tools spread 3.2, was 8); swing -21.9, plant -22.3; door -22.9; error -23.9; ui -27.0, select -27.9; steps -27.7 / -30.0;
  jingles heart -16.8 (was -21.8, now loudest), order -18.2, goal -18.6, sleep -19.4, level -19.5. Output reads ~1-3 dB under build targets.
- Rapid water (16 x 0.2 s): -25.5 LUFS (was -14.6). Rapid till -22.2. Spring music + swing/water every 0.2 s: -21.7 (about 4 dB over music).
- Winter-night pad dip: gone (median min +0.3 dB, 0 % of 72 bars dip > 3 dB); median +3 dB swell 0.3-0.5 s after bar lines.
- Crickets: 9 s pattern gone (self-corr 0.48 at 9 s, was 0.999) but the pair 9.0 s + 7.2 s realigns every 36 s (corr 0.998);
  docs say 7.33 s, manifest loop is [1, 8.2] = 7.2 s.
- Eviction: status() uses bank.has(); home season kept resident; test present.
  Open: harmony (F20), perf sfx coverage, SW cache (F25), ui-1, crickets LCM, heart jingle overshoot.
