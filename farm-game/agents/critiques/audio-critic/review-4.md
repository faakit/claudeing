# Review 4 (round 2 opening: acceptance criteria) - new audio agent a5aad60d5c5e813c6, branch audio/round2

Baseline measured on round-3 renders with tools/seasons.py (transposition-invariant bar-chroma similarity, 1 = same harmony up to key):
spring-summer 0.955, fall-winter 0.953 (the known clones); other pairs 0.890-0.936.
Estimated keys (Krumhansl on chroma): spring C maj .90, summer D maj .91, fall G min .92, winter D min .98, festival G maj .97.
Whole-mix spectral centroid: spring 3598, summer 3997, fall 669, winter-night 1282, festival 3882 Hz.

Acceptance criteria sent for F20 (seasons sound different):
A data (music.json): no shared A-section Roman-numeral progression between any two of the 6 pieces; chord-bigram Jaccard <= 0.4
  per pair (transposition-invariant); >= 4 distinct cadence formulas; melody interval-3-gram overlap <= 25 % per pair;
  each season differs from every other season by a margin in >= 2 of: notes/beat (+-20 %), median melody pitch (+-3 st),
  leap share (+-10 pp), range (+-4 st), syncopation share (+-10 pp).
B renders: every pair <= 0.92 similarity, spring-summer and fall-winter each <= 0.92 and >= 0.03 below baseline; estimated key
  matches the declared key/mode with r >= 0.85; summer melody median >= spring + 2 st or summer centroid >= spring + 10 % with the
  same percussion share; fall/winter slower than spring and minor; night notes/beat <= 60 % of day; levels day -25 +-1.5,
  night -28 +-1.5 LUFS.
C no regressions: pitch-shift test, verify green, no clipping, render-time ratio >= 25x.
Control cues: active-region momentary <= ui level (-27 M at output), <= 80 ms, >= 3 takes or pitch jitter, repeat duck, no tonal
  pitch ladder that climbs on repeated taps beyond one octave; rapid-tap render (10 taps/s for 5 s) <= -28 LUFS integrated.
