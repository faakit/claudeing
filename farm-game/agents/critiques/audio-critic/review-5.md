# Review 5 (round 2, checkpoint 1: 716dbc7) - 2026-10-08

Frozen copy round-5/. verify green: 472 unit tests, e2e, mobile e2e, perf 0.95-1.34 ms JS/frame at 1x (perf still logs 3 sfx).
New sources: Kenney UI Audio / Interface Sounds (CC0, packs already verified).

Season distinctness (my renders, tools/seasons2.py):
- Day pairs max 0.919 (spring-title), spring-summer 0.910 (was 0.955), fall-winter day 0.870 (night 0.892; was 0.953). Night max 0.915.
- Keys: spring C (ties G mix: profile rotation is mode-blind), summer-day G major = D mixolydian's parent (pushback accepted),
  summer-night D major, fall E minor .91, winter D minor .92, title Eb .80, festival G .78.
- Summer brighter: melody median +4 st (data); whole-mix centroid +11 % but driven by >6 kHz percussion (0.94 % vs 0.52 %);
  200-4k centroid only +4 %. Passes via melody route.
- Data (agent's seasons-data.md, chord charts spot-checked in music_src.py): 6/6 distinct A progressions and cadences, Jaccard max 0.32,
  3-gram max 23 %, every season pair differs in >= 2 features; 0 off-chord strong beats.
Levels (output): day -24.7..-25.6, night -27.4..-28.8 LUFS. SFX max momentary: harvest -17.5, coin -18.0, buy -18.8, cut -19.0,
till -20.0, water -22.0, swing -20.3, plant -21.3, door -20.5, error -23.9, ui -24.5, select -24.2, stepGrass -26.0, stepWood -28.2,
heart -18.9, jingles -18.2..-19.5. Touch cues: tick -26.9, target -27.2, confirm -27.6, ringOpen -28.0, ringClose -29.3; 36-68 ms.
Rapid tap 10/s x 5 s dry: -29.8/-30.3/-29.8 LUFS; with spring music -23.5 (music alone -25.6).
Crickets 420 s: max waveform self-correlation over 3-400 s lags 0.48 (9 s: 0.53, was 0.999; 36 s: 0.50; 198 s: 0.26).
Stress (max sliders): TP 0.0 dBTP, 1 clipped sample. Winter night PLR 24 dB (TP -4.1 at -28 LUFS), title TP -4.7.

Findings: F20 resolved; F23 resolved; heart resolved; ui-1 resolved; F27 passed; F28 passed for dry cues (wiring pending).
New: F29 minor title closest to spring; F30 minor limiter not brickwall at max; F31 nit winter/title crest; F32 minor water -2 dB /
stepGrass +2 dB / swing +1.7 vs role targets; F33 minor tick throttle for row painting once wired.
