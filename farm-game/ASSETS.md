# Assets and credits

## Audio

Every audio file in `public/assets/audio/` is derived from the sources below. Per-file detail (exact source
file, archive member, sha1, which shipped file uses it) is in `audio-src/SOURCES.md`; per-file processing
measurements (onset, length, loudness, true peak, pitch, loop seams) are in `audio-src/prep-report.md`.
All files were rebuilt by `audio-src/tools/build.py`.

| Shipped files | Source | Author | Licence | Edits |
|---|---|---|---|---|
| `inst/piano-*`, `inst/harp-*`, `inst/glock-*`, `inst/viola-*`, `inst/cello-*`, `inst/pizz-*`, `inst/tamb-*`, `inst/sleigh-*`, `inst/triangle-*` | [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) | Versilian Studios: Sam Gossner, Simon Dalzell (recording), Elan Hickler (cutting) | CC0 1.0 | Mono, onset trimmed (2 ms pre-roll), 35 Hz high-pass, tail cut and faded, zones matched in level; string sustains get a crossfaded loop and a flattened envelope; pitch measured |
| `inst/marimba-*`, `inst/vibes-*`, `inst/recorder-*`, `inst/ocarina-*`, `inst/shaker-*` | [Versilian Community Sample Library (VCSL)](https://github.com/sgossner/VCSL) | Versilian Studios (Sam Gossner) | CC0 1.0 | As above |
| `sfx/stepWood-*`, `sfx/coin-*`, `sfx/buy-*` (coins), `sfx/door-*`, `sfx/harvest-*` and `sfx/cut-*` (cloth rustle layer) | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) | Kenney (kenney.nl) | CC0 1.0 | Trimmed, layered, high-pass, loudness matched per family, peak-limited |
| `sfx/stepGrass-*`, `sfx/till-*` and `sfx/plant-*` (soil layer) | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) (snow footsteps) | Kenney | CC0 1.0 | Trimmed to 0.13-0.2 s, high-pass 200-300 Hz, pitched up for planting |
| `sfx/select-*`, `sfx/error-*`, `sfx/harvest-*` and `sfx/plant-*` (pop layer) | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney | CC0 1.0 | Level matched |
| `sfx/ui-*` | [Kenney UI Audio](https://kenney.nl/assets/ui-audio) | Kenney | CC0 1.0 | Level matched |
| `sfx/till-*` (dig) | [Shovel Sound](https://opengameart.org/content/shovel-sound) (from freesound 503672, CC0) | themightyglider; RavenWolfProds | CC0 | Two dig events cut out, one pitched down |
| `sfx/cut-*`, `sfx/swing-*` | [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) | artisticdude | CC0 | Swing takes pitched down 3-4 semitones, high-pass |
| `sfx/buy-*` (bell) | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) | rubberduck | CC0 | Layered under coins |
| `sfx/water-*`, `sfx/refill-*` | [40 CC0 water / splash / slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) | rubberduck | CC0 | 0.4-0.7 s cuts of a water loop and a bubble loop, splash layer |
| `amb/rain` | [Rain (loopable)](https://opengameart.org/content/rain-loopable) | Ylmir | CC0 | 12 s cut, crossfaded seamless loop |
| `amb/crickets` | [Crickets Ambient Noise - loopable](https://opengameart.org/content/crickets-ambient-noise-loopable) | Wolfgang_; the page's attribution notice names Ted Kerr | CC0 | Two cuts of different lengths (9 s, 7.33 s) looped against each other, high-pass 1.5 kHz |
| `amb/birds-*` | [Ambient Bird Sounds](https://opengameart.org/content/ambient-bird-sounds) and [Bird chirping sounds](https://opengameart.org/content/bird-chirping-sounds) | isaiah658; syncopika | CC0 | Single calls cut out (played at random times, positions and pitches) |
| `amb/cave`, `amb/drips-*` | [Loopable Dungeon Ambience](https://opengameart.org/content/loopable-dungeon-ambience) | jaggedstone | CC0 | 16 s cut, crossfaded loop; five single drips cut out and high-passed |
| `amb/thunder-*` | [100 CC0 SFX #2](https://opengameart.org/content/100-cc0-sfx-2) | rubberduck | CC0 | One thunder roll trimmed, a second copy 3 semitones lower (storms only) |
| `amb/wind` | [wind1](https://opengameart.org/content/wind1) | lukerustltd | CC0 | 15 s cut, crossfaded loop |

The music itself (melodies, chords, arrangements in `src/audio/music.json`) was composed for this game.
Credit to Kenney and Versilian Studios is not required by CC0 but given here gladly.
