# Assets and licences

## Sprites, tileset, palette (`public/assets/sprites/`, `public/assets/tilesets/`, `public/assets/palette.gpl`)

- **Generated with Google Flow** (Google's image tool, model Nano Banana 2.1) using the project owner's own account, at
  the owner's request, as raw source material. Nothing generated is shipped as is: every sprite is rebuilt on the
  game's pixel grid by the deterministic scripts in `art-src/tools/` (keying, grid detection, downscale, quantization to
  the 32-colour palette, cleanup and outline), then reviewed in game screenshots and fixed where needed. Every prompt,
  the output it produced and the sprites it fed are listed in `art-src/flow/prompts.md`; per-sprite crops are in
  `art-src/flow/crops/`. This art was not hand-drawn (the code-authored and hand-drawn exceptions are listed below).
- Generation record: Google Flow, model Nano Banana 2.1, the owner's Google account (a Google subscription shown as "PRO"
  in Flow; generations reported as using 0 credits), all generated on 2026-10-08. Google's SynthID watermark is
  present in the raw outputs; the shipped sprites are re-quantized, re-gridded derivatives, so it may not survive.
- Terms relied on (read 2026-10-08): Google Terms of Service effective 30 Jul 2026 ("Google won't claim ownership
  over that content"), Generative AI Prohibited Use Policy of 17 Dec 2024 (no passing generated content off as solely
  human-made), Flow help article 16353333 (defers to the Terms). Commercial release: the owner must re-verify
  Google's terms before release; this has not been verified by counsel.
- Human edits: the pipeline is deterministic; hand-made changes are logged in `art-src/flow/prompts.md` (edits
  section), mostly on the player and villagers (row trims, frame derivation, idle frames).
- **Authored in code** (original, this repo): terrain tiles (grass, dirt, path, water, soil, walls, floors, fence,
  quilt) and derived frames in `art-src/tools/authored.py`; the map-layer tiles in `art-src/tools/maptiles.py`
  (fences, cobbles, interior walls, rails, flora, clay roofs, chimney, cave mouth) and `art-src/tools/bake.py` (forest
  crowns, shores, path edges, mine rock, rendered per map); the remaining code-drawn placeholders in `src/art/`.
- Round 2 (2026-10-08, same account and terms): Flow sheets `village2`, `nature2` and `fx2` (props, nature, effects).
- Round 3 (2026-10-09, same account and terms): Flow sheet `items8` (generated 2026-10-09; downloaded to
  `flow-raw/` by the coordinator with the owner's approval). It feeds nine item icons: tulip bulbs, tulip, parsnip
  soup, baked potato, fish stew, berry tart, kale salad, Old Whiskers, Ice Pike. Flow sheets `village3`,
  `town3` and `town4` (same day, same route) feed the barn and the seven town landmarks.
- **Hand-drawn in code** (original, this repo, round 3): `art-src/tools/drawn.py` draws pixel by pixel on the
  palette the tulip growth stages, pumpkin pie, Glimmer Trout, Sun Carp, the scarecrow (item and object), the
  Founder's Statue level frames (with the depth branch's `_1`..`_6` keys), three house trophies, the onboarding
  coach marks, and the tool-use poses (arms and tools drawn onto the
  Flow-derived player frames).
- Usage terms: Google's generative AI terms apply to the Flow outputs; the owner is responsible for confirming they
  allow commercial redistribution before a store release. No third-party sprite packs, no scraped images, no
  trademarked characters were used (prompts ask for generic farm objects and original villagers).

## Store and marketing art (`store/`)

- **Google Play screenshots and icon** (`store/play/`): built by `art-src/tools/store_art.py`. Inside every frame is
  real gameplay captured in scenarios by `scripts/store-capture.mjs` (every game pixel is a captured pixel, scaled by
  a whole number); captions use the game's own pixel font; the 512 icon is the adaptive icon's layers in
  `resources/`. **Around** the frames, the backdrop is painted key art generated with Google Flow (model Nano
  Banana 2.1, the owner's account, 2026-10-12) from real screenshots (`marketing/flow-ref/`), raw output
  `marketing/flow-raw/backdrop-1.jpg`.
- **Feature graphic** (`store/play/feature-graphic*.png`): key art generated with Google Flow (Nano Banana 2.1,
  2026-10-12) from a real dry/green capture and the title screen (`marketing/flow-raw/key-split-2.jpg`), cropped and
  scaled, with the logo set in the game's font. It shows only things that are in the game (the dry and green farm,
  the creek, the farmhouse), drawn as illustration.
- **Promo video** (kept outside the repo, `C:/Users/andre/dev/tiny-acre/marketing/video/tiny-acre-promo-en.mp4`):
  gameplay frames stepped from the game's loop, and the game's own music and sfx rendered offline
  (`src/audio/render.ts`), set over the Flow backdrop; the end card uses the Flow key art. No generated footage.
- **Flow-generated marketing art:** the social-media trailer
  (`marketing/video/tiny-acre-trailer-social-en.mp4`) opens on a 3.5 s shot generated with Google Flow (model Veo 3.1
  Fast, the owner's account, 2026-10-12) from a real capture of the dry farm (`marketing/flow-ref/`); the raw output
  is in `marketing/flow-raw/veo-dry-farm-1.mp4`. It is never used in the Play Store video or screenshots. **Flow-
  generated marketing art needs the same licence check as the Flow sprites above before release:** the owner must
  re-verify Google's generative AI terms for commercial and promotional use, and label it as AI-generated where a
  platform asks.

## Font

- The pixel font is generated in code (`src/ui/font.ts`); original.

## Audio

Every audio file in `public/assets/audio/` is derived from the sources below. Per-file detail (exact source
file, archive member, sha1, which shipped file uses it) is in `audio-src/SOURCES.md`; per-file processing
measurements (onset, length, loudness, true peak, pitch, loop seams) are in `audio-src/prep-report.md`.
All files were rebuilt by `audio-src/tools/build.py`.

| Shipped files                                                                                                                                   | Source                                                                                                                                                      | Author                                                                            | Licence | Edits                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inst/piano-*`, `inst/harp-*`, `inst/glock-*`, `inst/viola-*`, `inst/cello-*`, `inst/pizz-*`, `inst/tamb-*`, `inst/sleigh-*`, `inst/triangle-*` | [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE)                                                                                           | Versilian Studios: Sam Gossner, Simon Dalzell (recording), Elan Hickler (cutting) | CC0 1.0 | Mono, onset trimmed (2 ms pre-roll), 35 Hz high-pass, tail cut and faded, zones matched in level; string sustains get a crossfaded loop and a flattened envelope; pitch measured |
| `inst/marimba-*`, `inst/vibes-*`, `inst/recorder-*`, `inst/ocarina-*`, `inst/shaker-*`                                                          | [Versilian Community Sample Library (VCSL)](https://github.com/sgossner/VCSL)                                                                               | Versilian Studios (Sam Gossner)                                                   | CC0 1.0 | As above                                                                                                                                                                         |
| `sfx/stepWood-*`, `sfx/coin-*`, `sfx/buy-*` (coins), `sfx/door-*`, `sfx/harvest-*` and `sfx/cut-*` (cloth rustle layer); M7: `sfx/logHook-*` (cloth snap, iron latch), `sfx/logTug-*` (rope rustle, creaks), `sfx/logLand-*` (door slams as the wooden crack) | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio)                                                                                                      | Kenney (kenney.nl)                                                                | CC0 1.0 | Trimmed, layered, high-pass, loudness matched per family, peak-limited; M7: creaks pitched down 9-12 semitones and low-passed at 1.2-1.8 kHz, latch pitched down 8-10 and low-passed at 2.5 kHz, door slams pitched down 3-5 and low-passed at 2.5 kHz |
| `sfx/stepGrass-*`, `sfx/till-*` and `sfx/plant-*` (soil layer); `sfx/dig-*` (earth thump and thrown earth), `sfx/logLand-*`, `sfx/logKnock-*`, `sfx/logHook-*` and `sfx/logTug-*` (plank and wood hits)                                                                                  | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) (snow footsteps)                                                                             | Kenney                                                                            | CC0 1.0 | Trimmed to 0.13-0.2 s, high-pass 200-300 Hz, pitched up for planting; dig: a soft heavy impact pitched up 13-15 semitones and grass steps pitched down 5-6; logs: plank hits as the body, medium and light wood pitched up 0-6 semitones, high-pass 150-200 Hz |
| `sfx/select-*`, `sfx/error-*`, `sfx/harvest-*`, `sfx/plant-*` (pop layer), `sfx/tick-*`, `sfx/confirm-*`                                                                    | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds)                                                                                        | Kenney                                                                            | CC0 1.0 | Level matched                                                                                                                                                                    |
| `sfx/ui-*`, `sfx/target-*`, `sfx/ringOpen-*`, `sfx/ringClose-*`                                                                                                                             | [Kenney UI Audio](https://kenney.nl/assets/ui-audio)                                                                                                        | Kenney                                                                            | CC0 1.0 | Level matched                                                                                                                                                                    |
| `sfx/till-*` (dig), `sfx/dig-*` (spade cut, pitched down 3-5 semitones)                                                                         | [Shovel Sound](https://opengameart.org/content/shovel-sound) (from freesound 503672, CC0)                                                                   | themightyglider; RavenWolfProds                                                   | CC0     | Two dig events cut out, one pitched down                                                                                                                                         |
| `sfx/cut-*`, `sfx/swing-*`                                                                                                                      | [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack)                                                                                    | artisticdude                                                                      | CC0     | Swing takes pitched down 3-4 semitones, high-pass                                                                                                                                |
| `sfx/buy-*` (bell); M7: the wooden crack in `sfx/logLand-*` and `sfx/logKnock-*`, the wood shift in `sfx/logTug-*`, the plop in `sfx/logKnock-*` | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx)                                                                                                  | rubberduck                                                                        | CC0     | Layered under coins; logs: wooden hits pitched down 5-6 semitones and low-passed at 2.5 kHz, the plop pitched down 3-5 and 16 dB under |
| `sfx/water-*`, `sfx/refill-*`; `amb/creek*`, `amb/river*`, `amb/burble-*` (Dry Year water beds), the splash in `sfx/logLand-*`                    | [40 CC0 water / splash / slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx)                                                          | rubberduck                                                                        | CC0     | 0.4-0.7 s cuts of a water loop and a bubble loop, splash layer; water beds: three water loops layered at different lengths and pitches (crossfaded loops), single gurgles cut from the bubble loop |
| `amb/rain`                                                                                                                                      | [Rain (loopable)](https://opengameart.org/content/rain-loopable)                                                                                            | Ylmir                                                                             | CC0     | 12 s cut, crossfaded seamless loop                                                                                                                                               |
| `amb/crickets`                                                                                                                                  | [Crickets Ambient Noise - loopable](https://opengameart.org/content/crickets-ambient-noise-loopable)                                                        | Wolfgang_; the page's attribution notice names Ted Kerr                           | CC0     | Two cuts of different lengths (9 s, 7.333 s) looped against each other (combined period 198 s), high-pass 1.5 kHz                                                                                          |
| `amb/birds-*`                                                                                                                                   | [Ambient Bird Sounds](https://opengameart.org/content/ambient-bird-sounds) and [Bird chirping sounds](https://opengameart.org/content/bird-chirping-sounds) | isaiah658; syncopika                                                              | CC0     | Single calls cut out (played at random times, positions and pitches)                                                                                                             |
| `amb/cave`, `amb/drips-*`                                                                                                                       | [Loopable Dungeon Ambience](https://opengameart.org/content/loopable-dungeon-ambience)                                                                      | jaggedstone                                                                       | CC0     | 16 s cut, crossfaded loop; five single drips cut out and high-passed                                                                                                             |
| `amb/thunder-*`; M7: `amb/mill-2` (the water spilling off the wheel), wood hits in `sfx/logKnock-*`, `sfx/logLand-*` and `sfx/logTug-*` | [100 CC0 SFX #2](https://opengameart.org/content/100-cc0-sfx-2)                                                                                             | rubberduck                                                                        | CC0     | One thunder roll trimmed, a second copy 3 semitones lower (storms only); mill: a water loop pitched down 3 semitones, low-passed at 1.4 kHz, 7.27 s crossfaded loop; logs: wood hits pitched down 3-5 |
| `amb/wind`                                                                                                                                      | [wind1](https://opengameart.org/content/wind1)                                                                                                              | lukerustltd                                                                       | CC0     | 15 s and 11 s cuts, crossfaded loops played together (combined period 165 s)                                                                                                          |
| `amb/shop-*` | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) (creaks, book pages, leather) | Kenney (kenney.nl) | CC0 1.0 | Scattered one-shots for the General Store |
| `amb/anvil-*` | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) (heavy bell and metal impacts) | Kenney (kenney.nl) | CC0 1.0 | Pitched down 3-5 semitones, the smithy next door |
| `amb/clock` | Made for this game from two [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) ticks (CC0) | this project | CC0 | `audio-src/tools/gen_beds.py`: tick and tock pitched down, a small wooden case resonance, 12 s loop |
| `amb/forge` | Synthesized for this game (no source recording) | this project | CC0 | `audio-src/tools/gen_beds.py`: filtered noise roar and random crackles, 16 s loop |
| `amb/mill` (M7, the mill wheel turning) | Made for this game from CC0 sources: rubberduck's [40 CC0 water / splash / slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) (splashes), [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) (creaks) and [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) (a light wood knock) | this project | CC0 | `audio-src/tools/gen_beds.py` `mill()`: eight paddle slaps, an axle groan and a joint knock per 3 s turn, each with its own timing and level jitter, on a circular 15 s timeline (five turns; an exactly periodic, seamless loop) |

The music itself (melodies, chords, arrangements in `src/audio/music.json`) was composed for this game.
Credit to Kenney and Versilian Studios is not required by CC0 but given here gladly.
