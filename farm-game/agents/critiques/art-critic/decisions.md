# Tiny Acre: art director decisions (2026-10-08)

Delegated by the owner. Evidence files in this folder: `palette_compare.png` (current vs proposed swatches),
`palette_proposed.gpl`, `palette_check.py` / `palette_proposal.py` (usage and contrast numbers), `chars_lineup.png`
(player and villagers at 6x on grass). Screenshots judged: `farm-game/agents/out/art-shots/after4_*`, `after3_town_phone.png`.

## 1. Palette: not approved as is. Replace with the hand-tuned v2 ramps (`palette_proposed.gpl`).

Findings on the current k-means palette (`public/assets/palette.gpl`):

- Five near-blacks c00-c03 and c05 are 11 to 20 RGB units apart; indistinguishable at 1x on a phone. c03 `#242424`
  is a neutral grey-black, against the brief's "no pure black" spirit.
- The pipeline's outline is `argmin(L)` = **c00 `#2c0c04`** (a saturated red-black), not the documented `#2b191c`
  (c02). c00 is 28% of all opaque atlas pixels: the heavy, hot outline is the single biggest reason the world reads
  dark and muddy.
- Six reds and pinks (c04, c08, c12, c13, c20, c23), two of them under 0.4% use; one purple; no skin ramp (c27/c23/c20
  drift to pink); only three blues (no water/night ramp, no cool white for snow or ice); greens c21/c24 are 30 units
  apart while the ramp lacks a cool shadow (darkest greens are hue 120, flat, not shifted toward teal).
- Stone greys mix warm (c18) and cool (c11, c25) with no ramp logic.
- The UI theme (`src/ui/theme.ts`: `#2a2238`, `#1d1830`, `#14101f`, `#f4ead2`...) is entirely off-palette.
- Outline contrast: vs grass 5.5:1 (fine), vs tilled soil c10 2.2:1, vs dark soil c07 1.3:1, vs UI panel 1.10:1 and
  slot 1.03:1. Item icons in the plum slots have effectively **no outline**.

Decision: adopt v2 (32 colours, ramps by role; min pairwise distance 32 RGB units vs 11 today):

| ramp                                 | colours                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| ink and shadow                       | ink `#2a1a24` (the one outline colour, also UI ink and font shadow), plum shadow `#4a2a40`         |
| night / water (cool)                 | night navy `#1e2848`, dusk blue `#2e4a7a`, water `#3c74b4`, sky `#72aadc`, ice white `#d6ecf0`     |
| foliage (hue-shifted teal -> yellow) | teal shade `#1f4a40`, leaf dark `#2e6a3e`, leaf mid `#4a8f3a`, grass `#74b043`, new leaf `#b4d45a` |
| earth / wood                         | earth dark `#4c2c1c`, soil `#7c442c`, wood `#b47c4c`, sand `#dcb47c`, parchment `#f4e4bc`          |
| skin                                 | skin light `#f4c09c`, skin mid `#d88c6c`, skin deep `#9c5a3c`                                      |
| reds                                 | wine `#8c1c2c`, red `#cc3a2a`, rose `#e07a8a`                                                      |
| warm lights                          | orange `#e48c24`, gold `#f4cc3c`, lamp `#fff0a0` (night glow core)                                 |
| purples                              | plum `#8c5ca4`, lilac `#c4a0d8`                                                                    |
| stone (cool to warm)                 | stone dark `#4a4858`, stone `#7a7684`, stone light `#aeb0b4`, taupe `#8a7468`                      |

Rules that come with it:

- The outline index is **explicit** (ink, slot 0), not `argmin(L)`. Shadows go toward plum/teal/navy, never toward
  grey. Highlights go toward yellow (foliage) or parchment (wood), never pure white.
- Swatches are a starting point: the art agent may nudge values by up to ~10 per channel after seeing the rebuilt
  atlases, but must keep the ramp structure, the slot roles and the minimum distance; record any nudge in `DECISIONS.md`.
- The UI theme moves onto the palette (see 2). Code tints (daylight, season, quality) stay code-driven but should be
  checked against the new ramps in the atmosphere pass.
- Watered soil must keep 3:1 between crop fills and the soil (leaf mid vs earth dark is about 3.2:1); do not make
  watered soil a flat earth-dark fill; use soil with earth-dark speckle/sheen so seed mounds and seedlings still read.

## 2. UI skin: move off the dark plum. "Walnut and parchment" hybrid.

Why: plum is off-palette, cold against a warm world, reads like a generic dark-mode app, and kills icon outlines
(ink vs plum 1.1:1). A full cream UI would put ~200 of 400 px of bright surface around the world on every frame
(HUD top ~85 px, controls ~110 px), competing with the art and glaring at night. The hybrid keeps the world the
brightest thing on screen while making menus feel hand-made and on-palette.

- **Chrome** (HUD plates, energy/water bars, the control area, the dock): dark walnut: earth dark `#4c2c1c` base,
  1 px grain lines in plum shadow, 1 px wood highlight on top edges, ink outer border. Text parchment on walnut
  (9.9:1), gold for gold (8.0:1). Bars get an ink track and frame (water vs walnut alone is 2.6:1).
- **Content panels** (bag, shop, menu tabs, dialogs, letters, toasts): parchment `#f4e4bc` paper inside a 2 px wood
  frame with ink outline; ink text with no drop shadow (13.1:1); sand `#dcb47c` for rules and recessed slots
  (ink outline vs sand 8.5:1). Wine `#8c1c2c` for warnings, leaf dark for positive.
- **Slots**: recessed parchment/sand so every icon's ink outline reads. Selected slot: gold frame **plus** a shape cue
  (corner notches or a 1 px inner ink ring), hotbar slots: a shape cue too (e.g. a nail/ledge), not only the blue edge.
- **Quality stars**: gold is 1.2:1 on parchment, so stars always carry an ink outline; silver and gold differ in star
  count and shape, not only tint.
- **Toast**: replace the translucent grey band with a small parchment scroll (or walnut plate) with ink/parchment
  text; green text on a translucent band over the world (see `after4_farm_phone.png`, y ~1080-1170) is the least
  legible thing on screen today.
- Joystick and Action button: keep translucent, but ring them in parchment/ink, not grey.
- Layout geometry in `src/ui/layout.ts` stays unchanged.
- Process: first deliver a **side-by-side mock** (current vs new, phone scale 390x844) of the farm HUD, the bag and a
  shop sheet. The direction is decided; the mock is for tuning values before skinning everything.

## 3. Villager size: one body style, adult heights 26-30 px, Orin broader and taller.

The real problem is not 24 vs 28 px but two proportion systems (`chars_lineup.png`): the player is big-head chibi
(head ~13 px wide, ~12 tall, of 28), villagers are small-head (head ~8-9 px of 24). Next to the player they read as
children, and their faces vanish at 1x.

- All humans use the player's proportions (big head, ~12-13 px wide, eyes 2 px, body ~16 px).
- Heights crown to feet on a shared baseline (row 31): player 28; Mara 27 + bun = 28; Finn 28 + bucket hat ~29;
  Rosa 26 (older, slight stoop) with a straw-hat brim 17-18 px wide; **Orin 30 tall, 18 px wide** in the 20x32 frame
  (1 px margin each side), and a side view of at least 13-14 px (barrel chest, apron), not 11; Clay (rival) 28 with a
  silhouette clearly unlike the player (hat or build), so the two never get confused at 1x.
- Player fix: crown height differs by direction (28 px down vs 30 px left/right); keep all directions within 1 px.
- Silhouette test: each character must be identifiable as a flat ink fill at 1x.
- Idle: 2 frames, a blink or a 1 px shoulder/chest move; no whole-sprite bob.
- Frames stay 16x32 (player) and 20x32 (villagers). Regenerate villagers with the player sprite as the Flow reference
  image (or rebuild them on the player body template) so they share the body.

## 4. Licensing of Google Flow output: OK to keep using for the hobby build; commercial release looks permitted but

## must be re-checked and documented. Not legal advice; the owner decides before any store release.

What the sources say (checked 2026-10-08):

- Google Terms of Service (effective 30 July 2026): for generated original content, "Google won't claim ownership over
  that content". https://policies.google.com/terms
- Flow help (https://support.google.com/flow/answer/16353333): the Terms of Service "must be consulted and followed in
  their entirety"; outputs carry an invisible SynthID watermark. It names no separate Flow/Labs commercial licence.
- Labs FAQ (https://labs.google/fx/faq): same ownership line, users must be 18+, no Flow-specific commercial terms.
- Generative AI Prohibited Use Policy (last modified 17 Dec 2024,
  https://policies.google.com/terms/generative-ai/use-policy): bans "claiming it was created solely by a human, in order
  to deceive" and content that violates others' intellectual property rights.
- The older Generative AI Additional Terms (https://policies.google.com/terms/generative-ai) say they no longer apply
  to most users since 22 May 2024 (folded into the main terms).
- Nothing found restricts commercial use of Flow image outputs for consumer accounts, but I found no official Flow page
  that grants it explicitly either, and free versus paid tier treatment is not documented in official sources.
- Copyright: the US Copyright Office's Part 2 report (29 Jan 2025, https://www.copyright.gov/ai/) concludes purely
  AI-generated material is not protected; human selection, arrangement and modification can be. So competitors could
  likely copy raw AI-derived sprites; the protectable parts are the human-authored terrain, edits and composition.

Recommendation:

1. Keep using Flow as source material. Before a store release, the owner re-reads the terms in force that day and
   decides (optionally a short consult with a lawyer if the release is paid).
2. Never present the art as hand-drawn (ASSETS.md already says it was not; keep that line, and use the same honesty
   on store pages). Answer store AI-disclosure questions truthfully (Steam has an AI content disclosure in its
   content survey; check the current requirement of whatever store is used).
3. Remove "in the style of classic 16-bit farming RPGs" from the Flow preambles (`art-src/flow/prompts.md`): it buys
   genericness and a similarity risk. Describe Tiny Acre's own style instead. Never name games, studios or artists.
4. Strengthen human authorship where it matters most: hand-edit the player, villagers, the title/logo and key art
   after the pipeline, and log those edits.

Record in `ASSETS.md` (add to the Flow paragraph):

- Account tier used (free / Google AI Pro / Ultra) and date range of generations.
- The terms versions relied on: Google Terms of Service effective 30 July 2026; Generative AI Prohibited Use Policy
  last modified 17 Dec 2024; Flow help article 16353333 as read on 2026-10-08; plus archived copies (PDF or Wayback
  links) of those pages saved outside the repo.
- That outputs carried SynthID at generation and that the shipped sprites are re-quantized derivatives.
- "AI-assisted: generated with Google Flow, rebuilt by the scripts in art-src/tools and edited by hand where noted."
- A line: "Commercial release: owner to re-verify Google's terms before release; not yet verified by counsel."
