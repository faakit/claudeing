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
