# Review 9 (round 3 checkpoint: c6c9181) - 2026-10-09
Frozen copy round-9/. verify green: 479 tests; sfx perf scene 1.05-1.26 ms JS, 136-145 fps. New sources: Kenney RPG Audio and Impact
Sounds (CC0, already verified); clock/forge beds generated (gen_beds.py) from CC0 ticks and noise.
Renders (mine, round-9/renders): shop + ambience -25.6 LUFS; rain spring (rain arrangement + bed) -27.6; storm summer -26.4;
lullaby music only -34.0 (with clock -33.7); house day + clock -24.5. 29-41x realtime.
Bug, probe (round-9/farm-game/probe-shop.mjs): spring -> shop opened -> closed (spring) -> Menu via Escape -> slot 'shop'.
lastPanel is only set by the openPanel event and never cleared; the Menu (toggleMenu) and the villager sheet open without it.
Sting/chord clash (tools/clash.py, static: sting transposed by jingleKey vs every chord of every section): final melody note a
semitone off a chord tone in 7-42 % of chords on average, worst motif-finn and dawn over summer 73 %; 18-31 % of all sting note-time clashes.
Music momentary distribution (round-7 renders, music unchanged): day p50 -25, p90 -23 M; with -3 dB dip a -25 M motif is +2-3 dB over
the median, 0-1 over loud passages.
Findings: F36 major shop music sticks; F37 major sting clashes; F38 minor motif audibility + rate limit; F39 minor lullaby too quiet;
F40 minor dawn/dusk single variant, dawn reachability; F41 minor order+special overlap (not relaying to depth agent);
F42 minor shop slot switching on short panel visits.
