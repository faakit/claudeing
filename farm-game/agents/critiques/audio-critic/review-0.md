# Review 0 (opening, plan only) - 2026-10-08

Basis: audio agent's plan message; HEAD 034d986 (no audio commits yet); src/platform/audio.ts, main.ts, TitleScene, UIScene, sw-plugin.mjs.

Verdict: plan is sound on format/fallback/loop-margin; biggest risks are (a) baked numpy synth = same sound, more bytes,
(b) 24-40 s loops repeating all day, (c) gain staging, (d) decoded-buffer memory, (e) second AudioContext from Phaser.

F1 major   Music rendered by numpy synth = existing procedural set baked to MP3. Ask: sample-based rendering (VSCO 2 CE, CC0) or justify.
F2 major   24-40 s loops for a ~13 min in-game day -> fatigue; current generative music never repeats. Ask: longer loops / stem variation / rest gaps.
F3 major   Gain staging: -18 LUFS file x musicBus 0.6*0.32 = ~-32 LUFS in game. Ask for end-to-end level table (file + bus) for music, ambience, sfx families.
F4 major   SFX peak-normalisation gives unequal loudness; ebur128 integrated is invalid under 400 ms. Ask: loudness (RMS of active part / momentary max) per family +-2 dB, TP <= -1 dBTP.
F5 major   Decoded PCM memory: ~16 buffers x 5-12 MB. Ask: residency/eviction policy and numbers.
F6 major   Phaser creates its own WebAudioSoundManager/AudioContext (no audio config in main.ts) -> two contexts on iOS. Ask: audio:{noAudio:true} or share context.
F7 major   Loop margin trick OK only if body is integer frames at 44.1k AND 48k (iOS ctx rate), day/night decoded lengths identical (else flam), and reverb/release tails wrapped (render N+1 cycles, keep steady-state). Ask for seam + sync tests.
F8 minor   Map-change music: exiting house/mine must not restart season loop from 0; season change should land during sleep transition.
F9 minor   Voice limiting for high-rate sfx (steps, water held-repeat): max concurrent per id, retrigger policy; birds as scattered one-shots not a loop.
F10 minor  SW precache + lazy fetch on first visit = double download; synth->sample timbre switch while sfx still loading. Ask: sfx loaded during title.
