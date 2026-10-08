# Assets and licences

## Sprites, tileset, palette (`public/assets/sprites/`, `public/assets/tilesets/`, `public/assets/palette.gpl`)

- **Generated with Google Flow** (Google's image tool, model Nano Banana 2.1) using the project owner's own account, at
  the owner's request, as raw source material. Nothing generated is shipped as is: every sprite is rebuilt on the
  game's pixel grid by the deterministic scripts in `art-src/tools/` (keying, grid detection, downscale, quantization to
  the 32-colour palette, cleanup and outline), then reviewed in game screenshots and fixed where needed. Every prompt,
  the output it produced and the sprites it fed are listed in `art-src/flow/prompts.md`; per-sprite crops are in
  `art-src/flow/crops/`. This art was not hand-drawn.
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
  quilt) and derived frames in `art-src/tools/authored.py`; the remaining code-drawn placeholders in `src/art/`.
- Usage terms: Google's generative AI terms apply to the Flow outputs; the owner is responsible for confirming they
  allow commercial redistribution before a store release. No third-party sprite packs, no scraped images, no
  trademarked characters were used (prompts ask for generic farm objects and original villagers).

## Fonts, audio

- Pixel font and all sound are generated in code (`src/ui/font.ts`, `src/platform/audio.ts`); original.
