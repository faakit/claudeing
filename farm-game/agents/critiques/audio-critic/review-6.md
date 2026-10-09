# Review 6 (round 2, checkpoint 2: f633de0 + 182ac74) - 2026-10-08
Frozen copy round-6/. verify green: 473 tests; perf new scene "full field + 20 sound effects a second": 102 sfx played, 10-11 dropped
(minGap), 1.71/0.98/1.63 ms JS at 1x/4x/6x; fps 144.6/143.7/91.7 (6x drop vs 124-143 for other scenes).
Measurement correction: my R5 sfx numbers were single-hit ebur128 M (100 ms hop, one random take). Re-measured with tools/hits.py
(BS.1770 K-weighting, 400 ms window, 10 ms hop, max per hit, median of 16 hits): water -19.7, stepGrass -28.9, swing -23.2, till -19.8,
cut -20.4, harvest -18.0, coin -17.8, buy -18.1, plant -22.5, ui -25.1, heart -19.3, tick -27.9 (spread 7.0 dB!), target -28.1 (3.3).
Agent's method confirmed; F32 withdrawn/resolved.
Seasons: title pairs all <= 0.887 (spring-title < 0.87); other numbers unchanged from R5. Levels unchanged; title TP -5.6, winter night -4.1.
Stress max: TP -1.1 dBTP, 0 clipped (soft clipper). drag-row-15 (agent render): -22.6 LUFS with music.
SW: per-file audio cache keyed path?v=sha1, survives releases, prunes stale; vm test.
Resolved: F24, F25, F29, F30, F32, F33. Open: F31 (winter night piano peaks; now inside clipper knee at default). New: F34 tick take spread 7 dB.
Nits: 6x-throttle fps drop in sfx scene; SW skipWaiting+claim can hand a running page new audio for an old manifest (low risk).
