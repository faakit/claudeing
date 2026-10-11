# Review 15 / final round of art round 4, art/round4 d2baabc (code) / 7336fd5 (strips tool only), 2026-10-11

Frozen copy round-13/farm-game (d2baabc; 7336fd5 differs only in art-src/tools/strips.py): build ok, 787/787 unit tests,
zero off-palette and zero semi-alpha pixels in all atlases and the four tilesets, perf 2-5 draws and <=1.38 ms JS at 1x
across 12 scenarios (town at night 4, see-through 5). Atlases world 512x256, ui 512x128, chars 512x512.

Verdict: round 4 closed. Animation frames are consistent (head identity and planted feet test-enforced, clean ink outline,
no jitter in the onion skins) and read cozy: weighted tool swings with a real contact frame, personality idles, door,
crop lean, ripple, splash, squash-and-stretch pops. The well is a proper three-tile prop.

Fixed this round: R5-5 (tool-pose head), R9-5 (well), R13-1..R13-6, R14-1 (down-facing hoe/pick 32x36, blade bites the
tile in front; origin (0.5, 32/height) documented for the feel agent). Bonus: 545c94e seasons the baked crowns (oaks and
birches were summer green in fall/winter, a round-3 regression); pines stay evergreen.

Decided: walk cadence 16 fps at base speed, scaled with speed (10-20 fps), slide accepted; side stride stays 7 px.
Open: none from me. Note for whoever wires feel/smooth: use toolFrameHeight() for the swing origin, and keep overhead
eaves on the never-cut layer (a cut-layer eave silently adds ~3 draws via the see-through mask).
