# Assets and licences

## Sprites, tileset, palette (`public/assets/sprites/`, `public/assets/tilesets/`, `public/assets/palette.gpl`)

- **Generated with Google Flow** (Google's image tool, model Nano Banana 2.1) using the project owner's own account, at
  the owner's request, as raw source material. Nothing generated is shipped as is: every sprite is rebuilt on the
  game's pixel grid by the deterministic scripts in `art-src/tools/` (keying, grid detection, downscale, quantization to
  the 32-colour palette, cleanup and outline), then reviewed in game screenshots and fixed where needed. Every prompt,
  the output it produced and the sprites it fed are listed in `art-src/flow/prompts.md`; per-sprite crops are in
  `art-src/flow/crops/`. This art was not hand-drawn.
- **Authored in code** (original, this repo): terrain tiles (grass, dirt, path, water, soil, walls, floors, fence,
  quilt) and derived frames in `art-src/tools/authored.py`; the remaining code-drawn placeholders in `src/art/`.
- Usage terms: Google's generative AI terms apply to the Flow outputs; the owner is responsible for confirming they
  allow commercial redistribution before a store release. No third-party sprite packs, no scraped images, no
  trademarked characters were used (prompts ask for generic farm objects and original villagers).

## Fonts, audio

- Pixel font and all sound are generated in code (`src/ui/font.ts`, `src/platform/audio.ts`); original.
