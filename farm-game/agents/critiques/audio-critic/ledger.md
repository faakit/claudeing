# Audio critique ledger

| id | sev | topic | raised | status | last round |
|---|---|---|---|---|---|
| F1 | major | numpy synth music = same sound baked; use CC0 samples (VSCO 2 CE) or justify | R0 | resolved (runtime sampler, VSCO CC0) | R1 |
| F2 | major | 24-40 s loops repeat all day; need variation/length/rests | R0 | resolved by design (phrase pool, rests) | R1 |
| F3 | major | end-to-end gain staging (file LUFS x bus gains) | R0 | resolved: output table + role targets | R3 |
| F4 | major | sfx loudness not peak normalisation; ebur128 invalid <400ms | R0 | resolved via F18 | R3 |
| F5 | major | decoded buffer memory residency/eviction | R0 | resolved: measured 19-34 MB | R2 |
| F6 | major | Phaser's own AudioContext (2 contexts) | R0 | resolved: noAudio + e2e PASS | R2 |
| F7 | major | loop body integer frames @44.1/48k, day/night sync, wrapped tails | R0 | resolved: ambience periods exact, seams clean | R2 |
| F8 | minor | map change resumes music position; season change during sleep | R0 | resolved by code (homeSlot, resume); not render-tested | R3 |
| F9 | minor | voice limiting, birds as one-shots | R0 | resolved: caps + bird one-shots; see F19 | R2 |
| F10 | minor | SW double download; sfx ready before gameplay | R0 | resolved via SW controller wait; see F25 | R2 |
| F11 | major | sample zone coverage / max pitch shift | R1 | resolved: zone test | R2 |
| F12 | major | sustain of 2.5 s samples vs 4.3 s bars | R1 | resolved: no dip (0% bars >3 dB); +3 dB swell after bar line (nit) | R3 |
| F13 | major | CPU: node churn, convolver, perf budget | R1 | resolved: 30-41x realtime, perf with music | R2 |
| F14 | minor | scheduler catch-up burst | R1 | resolved (tested) | R2 |
| F15 | minor | no scheduling when muted; seeded RNG | R1 | resolved (tested) | R2 |
| F16 | minor | sample trimming / zone loudness matching | R1 | resolved: decaying zones within 0.6 dB early RMS | R2 |
| F17 | nit | per-instrument fallback | R1 | resolved (tested) | R2 |
| F18 | major | cross-family loudness: use K-weighted momentary; harvest/plant/swing too low, coin/buy/water high | R2 | resolved: heart -18.9, ui -24.5; residuals in F32 | R5 |
| F19 | major | held-repeat stacking: rapid water -14.6 LUFS | R2 | resolved: rapid water -25.5 LUFS (was -14.6) | R3 |
| F20 | major | harmonic sameness across seasons/title/festival | R2 | resolved: all A/B criteria met (spring-summer 0.910, fall-winter 0.870) | R5 |
| F21 | major | eviction bug: status() resets lastUse to 0 | R2 | resolved: has() + homeSlot + test | R3 |
| F22 | blocker | drips provenance (Independent.nu via qubodup) + credit Ted Kerr (crickets) | R2 | resolved: drips re-sourced from CC0 dungeon ambience; Ted Kerr credited | R3 |
| F23 | minor | crickets 9 s loop periodic | R2 | resolved: no waveform repeat > 0.48 over 3-400 s | R5 |
| F24 | minor | claims (4-6 dB), ROADMAP [x], perf plays 3 sfx | R2 | resolved: perf scene 102 sfx, assert >= 20 | R6 |
| F25 | minor | SW global version re-downloads 2 MB audio each release | R2 | resolved: per-file audio cache + vm test | R6 |
| F26 | nit | buy-2 TP -0.8; ui spread 3.3 dB; ui-3 no fade; string attack lag; limiter makeup | R2 | resolved: ui-1 swapped | R5 |
| F27 | major | round 2: season distinctness criteria (A/B/C in review-4) | R4 | passed (pushback on summer key-estimate accepted) | R5 |
| F28 | major | round 2: control cues must not fatigue (criteria in review-4) | R4 | passed for dry cues + drag render; in-game wiring belongs to controls branch (unverified) | R8 |
| F29 | minor | title closest to spring (0.919 render, 1 melodic feature differs) | R5 | resolved: title pairs <= 0.887 | R6 |
| F30 | minor | limiter not brickwall: stress TP 0.0, 1 clipped sample | R5 | resolved: stress TP -1.1, 0 clipped | R6 |
| F31 | nit | winter night / title crest (PLR 24 dB): glock spikes | R5 | resolved: all music TP <= -6.0 dBTP | R7 |
| F32 | minor | output vs role targets: water -2, stepGrass +2, swing +1.7 dB | R5 | withdrawn: critic measurement error (single hit); 16-hit median agrees | R6 |
| F33 | minor | tick throttle at real row-paint rates once wired | R5 | resolved: minGap 70 ms + step mask | R6 |
| F34 | minor | tick takes spread 7 dB over 16 hits | R6 | resolved: tick spread 2.7 dB | R7 |
| F35 | minor | coin/buy peaks -2.2 dBTP at default enter clipper knee (-3 dBFS) | R7 | resolved: worst cue TP -4.6 dBTP at default; manifest tp + test | R8 |
| F36 | major | shop music sticks after the shop (Menu/villager sheet play shop slot) | R9 | resolved: probe re-run, PanelTracker + dwell | R10 |
| F37 | major | stings not chord-aware: final note clashes 7-42 % (worst 73 %) | R9 | resolved: runtime fitToChord + exhaustive test | R10 |
| F38 | minor | motif audibility (+2-3 dB over dipped median) and per-day rate limit | R9 | resolved: motifs -20.9..-22.8 M, lead swap, daily limit | R10 |
| F39 | minor | lullaby -34 LUFS too quiet; target -30..-31 | R9 | resolved: lullaby -30.5 | R10 |
| F40 | minor | dawn/dusk single variant; dawn reachability | R9 | resolved: 3 variants, weekly | R10 |
| F41 | minor | order + special fanfares overlap | R9 | resolved: jingle priority | R10 |
| F42 | minor | shop slot switching on short panel visits | R9 | resolved: 1.5 s dwell | R10 |
| F43 | nit | year-two spring-summer 0.922 (0.002 over 0.92) | R10 | accepted as noise unless it grows | R10 |

Final (round 3): last commit 0c7c3a8 (docs only), code 892183c; all findings closed except F43 (nit, accepted).
