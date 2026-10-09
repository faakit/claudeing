# Review 7 (round 2, checkpoint 3: 6e935be) - 2026-10-08
Frozen copy round-7/. verify green: 474 tests; sfx perf scene 1.54/1.03/1.45 ms JS, fps 144.8/143.8/103.4 (1x/4x/6x).
16-hit medians (tools/hits.py): tick -27.2 (spread 2.7, was 7.0), coin -17.6, buy -17.6, stepGrass -27.6, swing -22.2 (now on target).
Music integrated / TP: spring day -25.6/-8.5, summer -25.0/-7.8, fall -24.9/-12.6, winter day -25.0/-6.6, winter night -28.7/-6.4,
title -24.7/-6.0, festival -25.2/-10.4, mine -28.9/-15.2; mine + cave + drips -27.0. All music peaks <= -6.0 dBTP.
Stress max: TP -1.0, 0 clipped. Single coin at default: TP -2.2 dBTP (inside -3 dBFS clipper knee).
Seasons: day max 0.910 (spring-summer), spring-title 0.878, title-festival 0.865; night max 0.915. Keys unchanged (festival r .76).
Resolved: F31, F34. New: F35 minor coin/buy transients enter the clipper knee at default volume. Mine level question answered.
