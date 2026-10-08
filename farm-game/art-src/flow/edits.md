Changes made on top of the Flow output, all in code so they re-run (`art-src/sprites.json`, `art-src/tools/`):

- Player: left = mirrored right; walk frames 1 and 3 lifted 1 px; side frames trimmed by 2 rows below the waist so all
  directions stand 28 px tall.
- Villagers: kept on their native pixel grid (no resampling); Mara -4, Finn -2, Rosa -5, Clay -4 rows trimmed below
  the waist to reach the target heights (28/29/26/28); Orin untrimmed (30 px) in a 24x32 frame; left = mirrored right;
  idle frame 2 lowers everything above the legs by 1 px.
- Crops: stage 0 of every crop is an authored seed mound, not Flow output.
- Animals: second idle frame from the "head down" pose of the same prompt.
- All sprites: background keyed out, re-gridded, quantized to the 32-colour palette, outline redrawn in palette ink.
