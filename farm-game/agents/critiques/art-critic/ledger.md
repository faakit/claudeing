# Critique ledger

Status: open / fixed / accepted (rejected with a good reason) / re-raised.

| id    | round | sev     | finding                                                                                | status                                                    |
| ----- | ----- | ------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| D1    | 0     | major   | Palette v2 ramps replace k-means palette; explicit ink outline slot                    | fixed 3bb27f2                                             |
| D2    | 0     | major   | UI skin: walnut chrome + parchment panels, on palette; side-by-side mock first         | mock approved r1; default after R1-1..4                   |
| D3    | 0     | major   | Villagers share player proportions; heights 26-30; Orin 30x18                          | fixed 3bb27f2 (Orin 24x32 frame accepted); Clay R1-7 open |
| D4    | 0     | minor   | Flow licensing lines added to ASSETS.md; preamble drops "classic 16-bit farming RPGs"  | fixed 3bb27f2                                             |
| R0-1  | 0     | major   | Outline is argmin(L) = c00 #2c0c04 (28% of pixels), not documented #2b191c             | fixed 3bb27f2                                             |
| R0-2  | 0     | minor   | Player crown height 28 (down) vs 30 (side)                                             | fixed 3bb27f2                                             |
| R0-3  | 0     | major   | Toast: green text on translucent band over world, low legibility                       | walnut toast plate behind ?skin=walnut; default pending   |
| R0-4  | 0     | minor   | Icons in plum slots lose outline (1.03-1.10:1)                                         | open (via D2 / R1-2)                                      |
| R1-1  | 1     | blocker | Walnut grain streaks behind HUD text / under joystick                                  | open (r2: not addressed, in NEXT-STEPS-ART.md)            |
| R1-2  | 1     | major   | Hotbar slots plum; use sand slot everywhere                                            | open (r2: not addressed, in NEXT-STEPS-ART.md)            |
| R1-3  | 1     | major   | Selection treatment inconsistent (wine vs gold)                                        | open (r2: not addressed, in NEXT-STEPS-ART.md)            |
| R1-4  | 1     | major   | Close/labels dim taupe on sand, read disabled                                          | open (r2: not addressed, in NEXT-STEPS-ART.md)            |
| R1-5  | 1     | minor   | Prices/gold in wine read as warnings                                                   | open (r2: not addressed, in NEXT-STEPS-ART.md)            |
| R1-6  | 1     | minor   | Letterbox and bar row still navy                                                       | open (r2: not addressed, in NEXT-STEPS-ART.md)            |
| R1-7  | 1     | major   | Clay third blue-topped male; recolour, side silhouette                                 | open (r2: not addressed, in NEXT-STEPS-ART.md)            |
| R1-8  | 1     | minor   | Side-view trim seams (Mara blob/stub legs, Finn hip, Rosa hem)                         | open (r2: not addressed, in NEXT-STEPS-ART.md)            |
| R1-9  | 1     | major   | Season/dusk multiply off-palette; per-season tilesets, softer dusk                     | open (r2: not addressed, in NEXT-STEPS-ART.md)            |
| R1-10 | 1     | major   | Maps: bush on grass square in pond; hard pond; empty woods; flat mine; block farmhouse | open (r2: tiles built, not wired)                         |
| R2-1  | 2     | major   | Clay roofs: 1-row red/orange stripe banding; ridge cap 1 px, unreadable                | open                                                      |
| R2-2  | 2     | minor   | Edge tiles: terrain transitions use an ink-like lip                                    | open                                                      |
| R2-3  | 2     | minor   | Tree/bush tiles with grass base: only on grass                                         | open                                                      |

## Round 2 session (new art agent ae0ade7d17383b8b2, branch art/round2 from integration/agents-2026-10-08)

Opening message sent: maps-pass acceptance criteria A-D (wiring, map items, tile rules, roofs), authenticity criteria, scope guard (walnut skin = tokens/textures only; controls agent owns dock/HUD geometry). Reviews continue as review-3.md+, frozen copies round-3/+, preview port 5182.

| R2-1 | 3 | - | Roofs | fixed 5e1e183 |
| R2-2 | 3 | - | No ink on terrain transitions | fixed 5e1e183 |
| R2-3 | 3 | - | Transparent bases | fixed 5e1e183 |
| R1-10 | 3 | - | Maps wired, props, landmarks | mostly fixed 5e1e183; remainder split into R3-1..R3-5 |
| R3-1 | 3 | major | Ponds read as rectangles at map scale | open |
| R3-2 | 3 | major | Woods interior open lawn, no groves | open |
| R3-3 | 3 | major | Even scatter of identical trees/flower patches | open |
| R3-4 | 3 | major | Mine floor-boulder crystals look like gem nodes | open |
| R3-5 | 3 | major | Mine flat floor, rectangular outline, faces only north | open |
| R3-6 | 3 | major | Target marker drawn over player facing up | open |
| R3-7 | 3 | minor | Water dash pattern grid repeat | open |
| R3-8 | 3 | minor | Farm yard props in a line; lone lamp post | open |
| R3-9 | 3 | minor | Town well beside the square; uniform border crowns | open |
| R1-7 | 4 | - | Clay recolour | fixed e0d2e0e |
| R1-8 | 4 | - | Side seams | fixed e0d2e0e |
| R1-9 | 4 | - | Season tilesets, rose dusk | fixed e0d2e0e/b056201 (follow-ups R4-4..R4-7) |
| R3-1 | 4 | - | Ponds | accepted: coordinator ruling, collision unchanged; rounded 14 px corners + meander |
| R3-2 | 4 | - | Woods groves | accepted: groves outside forage zones only (ruling) |
| R3-3 | 4 | - | Scatter | fixed e0d2e0e |
| R3-4 | 4 | - | Crystals | fixed e0d2e0e |
| R3-5 | 4 | - | Mine bays/faces/beams | fixed e0d2e0e (dither follow-up R4-3) |
| R3-6 | 4 | - | Target marker over player | transferred to controls agent |
| R3-7/8/9 | 4 | - | Water grid, yard, well | fixed e0d2e0e |
| R4-1 | 4 | major | Outdoor glow lime over grass, clips to white, window spill blob | open |
| R4-2 | 4 | major | Outdoor player halo = green disc | open |
| R4-3 | 4 | major | Mine floor checker dither everywhere | open |
| R4-4 | 4 | major | Winter roofs = blue tile grid | open |
| R4-5 | 4 | minor | Winter ground speckle busy; blue flora ghost | open |
| R4-6 | 4 | minor | Fall ground speckle rash | open |
| R4-7 | 4 | minor | Summer ~ spring | open (optional) |
| R4-8 | 4 | nit | Window boxes bloom in winter | open |
| R4-1..R4-8 | 5 | - | Glow, halo, mine checker, winter roofs/ground, fall, summer, window boxes | fixed cd5bd9b |
| R5-1 | 5 | major | Mine: lit tile-square patches under boulders in dark band; dash wallpaper; stain-like outline | open |
| R5-2 | 5 | minor | Wall lantern rings turn stone magenta; white checker core | open |
| R5-3 | 5 | minor | Winter roof snow = ground snow value | open |
| R5-4 | 5 | minor | Title: symmetric hills, generic logo | open |
| R5-5 | 5 | minor | Tool pose head 2 px small | open |
| R1-1..R1-6 | 6 | - | Walnut skin fixes; walnut default | fixed 1ec1f68 (R1-5 coin glyph skipped: layout, accepted) |
| D2 | 6 | - | UI skin walnut/parchment | done: default since 1ec1f68 |
| R0-3 | 6 | major | Toast translucent band, green text | re-raised: still old style under walnut |
| R6-2 | 6 | minor | Title button ink text with light shadow | open |
| R6-3 | 6 | minor | Disabled hatch through glyphs | open |
| R6-4 | 6 | nit | Dock knot near hint text | open |
| R5-1..R5-4 | 7 | - | Mine darkness, wall glow, winter value, title | fixed b321e29 |
| R0-3 | 7 | - | Toast | fixed b321e29 (walnut plate) |
| R6-3, R6-4 | 7 | - | Hatch, knot | fixed b321e29 |
| R6-2 | 7 | minor | Title "New Game" doubled glyphs | re-raised: open (TitleScene only) |
| R5-5 | 7 | minor | Tool pose head | open (pose redo) |

## Proportion audit (review-8, art/round3 ee8b67e, art agent a5e7da91aeb98a4c6)

| id                                 | round | sev   | finding                                                                         | status                                       |
| ---------------------------------- | ----- | ----- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| R8-1                               | 8     | major | Trees smaller than the player (fruit 16x21, grove crowns 1 tile, old oak 19x28) | open                                         |
| R8-2                               | 8     | major | Facades 16 px under a ~68 px roof; doors ~20 px                                 | open                                         |
| R8-3                               | 8     | major | Animal houses 1-tile minis (barn 16x15 < cow); silo 24                          | open (footprint = owner decision)            |
| R8-4                               | 8     | minor | Cow/sheep/pig undersized                                                        | open                                         |
| R8-5                               | 8     | minor | Lamps 20-22 px                                                                  | open                                         |
| R8-6                               | 8     | minor | Sprinkler, jar, flower pot oversized                                            | open                                         |
| R8-7                               | 8     | minor | Landmarks 1-tile toys                                                           | open                                         |
| R8-8                               | 8     | minor | Forage/bubble/HUD icons at non-integer 0.8 scale                                | open                                         |
| R8-9                               | 8     | nit   | Scarecrow, loom/furnace, fence, well, rowboat, corn                             | open                                         |
| R8-1, R8-2, R8-5, R8-6, R8-8, R8-9 | 9     | -     | Trees, facades, lamps, small items, 1x world sprites, rest                      | fixed c3de265                                |
| R8-4                               | 9     | -     | Animals                                                                         | fixed (cow 19x14 native, accepted)           |
| R8-3                               | 9     | minor | Barn 24x22 not bigger than coop                                                 | partial, re-raised as R9-4                   |
| R8-7                               | 9     | minor | Landmarks 20-24                                                                 | partial, accepted (needs sources/footprints) |
| R9-1                               | 9     | major | 45% alpha fade tints player green, translucent disc                             | open                                         |
| R9-2                               | 9     | minor | Thin props (lamps) fade and vanish                                              | open                                         |
| R9-3                               | 9     | minor | Fallback small lone trees shorter than player                                   | open                                         |
| R9-4                               | 9     | minor | Barn source 32x28                                                               | open                                         |
| R9-5                               | 9     | nit   | Well 20x30, baked fences, item-pop snap                                         | open                                         |
| R9-1, R9-2, R9-3                   | 10    | -     | See-through hole, lamps exempt, no small trees                                  | fixed 4cd86a9                                |
| R10-1                              | 10    | minor | Perf scenario with the see-through mask active                                  | open                                         |
| R9-4                               | 11    | -     | Barn 32x28                                                                      | fixed 9797003                                |
| R8-7                               | 11    | -     | Landmarks 32x40                                                                 | fixed 9797003 (see R11-1)                    |
| R10-1                              | 11    | -     | Hole perf scenarios                                                             | fixed 9797003                                |
| R9-5                               | 11    | -     | Item pop snap; fences                                                           | fixed/accepted; well open                    |
| R11-1                              | 11    | minor | House-shaped landmarks read as dollhouses (doors < player)                      | open                                         |
| R11-1                              | 12    | -     | Library cabinet, bandstand                                                      | fixed 4aca711                                |
