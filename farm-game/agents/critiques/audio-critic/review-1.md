# Review 1 (design response) - 2026-10-08

Basis: audio agent reply to R0; tree still at 034d986 + untracked audio-src/. Licences checked: VSCO-2-CE GitHub = CC0-1.0 (sgossner; recorded by Sam Gossner & Simon Dalzell); VCSL = CC0 (versilian-studios.com/vcsl).
Resolutions: F1 F2 F5 resolved by design (runtime sampler, phrase pool, samples-only residency); F3 F4 F6 F8 F9 F10 accepted, pending evidence; F7 narrowed to ambience loops, pending.
New:
F11 major Sample coverage: playbackRate shift degrades past ~+-4 semitones; 40 samples over several instruments may be too sparse. Ask: per-instrument zone map, max shift, unit test.
F12 major Sustain: 2.5 s samples vs 4.3 s bars at 56 bpm (winter). Pads/strings need loop points or crossfade re-trigger, else holes. Ask: how, and offline-render evidence (RMS envelope across bar).
F13 major CPU/perf: per-note node graphs + ConvolverNode on low-end Android; main-thread scheduler under the 3.5 ms budget. Ask: node count per bar, IR length, OfflineAudioContext render-time ratio, perf numbers with music on.
F14 minor Scheduler catch-up burst after stall/background (while nextBar < now+0.6 schedules past notes). Ask skip-ahead guard + test.
F15 minor When muted or music=0, stop scheduling (no node churn). Seeded RNG for deterministic tests.
F16 minor VSCO raw samples: trim pre-onset silence/noise, consistent per-note loudness across zones (velocity layers), fades at cut points. Report.
F17 nit Fallback granularity: one missing instrument -> substitute instrument or synth for that part only, not whole music.
R1b (agent reply): F11-F17 all accepted with concrete plans; awaiting first working checkpoint.
