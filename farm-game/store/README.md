# Google Play store assets

Everything the Play Console listing needs, except the video (Play takes a YouTube link).

| Asset             | File                                                                      | Spec                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| App icon          | `play/icon-512.png`                                                       | 512x512, 32-bit PNG, every pixel opaque; the adaptive icon's layers (`resources/icon-foreground.png` on `icon-background.png`) on whole pixels |
| Feature graphic   | `play/feature-graphic.png` (en), `play/feature-graphic.pt-BR.png`         | 1024x500, 24-bit PNG, no alpha; Flow key art with the logo in the game's font, text inside the central area                                    |
| Phone screenshots | `play/screenshots/en/01..07-*.png`, `play/screenshots/pt-BR/01..07-*.png` | 1080x1920 (9:16), real gameplay framed over a Flow backdrop, big caption in the game's font                                                    |
| Listing text      | `listing.en.md`, `listing.pt-BR.md`                                       | app name, short and full description, what's new, category and tags                                                                            |
| Promo video       | outside the repo (see below), en and pt-BR                                | 1080x1920, 30 fps, H.264 + AAC, 22.2 s, gameplay over the Flow backdrop                                                                        |

Screenshot order (the story arc in `BRIEF.md`): the hero before/after, Rosa's letter, Senna's homecoming, the river
through town, a golden field, the town rising, one hand.

## Where everything is (round 4, 2026-10-13)

Everything was captured from the build at `integration/qa` 1ef7e1d. That build has the taller font, the coin glyph,
the 5-cell hotbar, the floating controls and the natural pt-BR. `M` is `C:/Users/andre/dev/tiny-acre/marketing`
(outside the repo, `STORE_OUT`).

| What                               | Where                                                                                      | Notes                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Icon                               | `store/play/icon-512.png`                                                                  | Unchanged since round 3; the adaptive icon didn't change.                                                                                      |
| Feature graphics                   | `store/play/feature-graphic.png`, `feature-graphic.pt-BR.png`                              | Key art `M/flow-raw/r4/key-b2-noboat.png` (Nano Banana). An invented rowboat was removed by hand.                                              |
| Screenshots (14)                   | `store/play/screenshots/{en,pt-BR}/01..07-*.png`                                           | Backdrop `M/flow-raw/r4/bd-a2.jpg` (Nano Banana). Everything inside each frame is captured gameplay.                                           |
| Listing text                       | `store/listing.en.md`, `store/listing.pt-BR.md`                                            | `node scripts/store-listing-check.mjs` passes.                                                                                                 |
| Contact sheets                     | `M/contact-sheet-en.png`, `M/contact-sheet-pt-BR.png`                                      | The 7 shots, the feature graphic at full and Play-card size, and the icon at 512, 96 and 48.                                                   |
| Promo video (Play listing)         | `M/video/tiny-acre-promo-en.mp4`, `M/video/tiny-acre-promo-pt-BR.mp4`                      | 22.2 s each, no generated footage. Frame dumps: `M/video/video-sheet-{en,pt-BR}.png`. End cards: `M/video/end-card-{en,pt-BR}.png`.            |
| Social trailer (AI-assisted)       | `M/video/tiny-acre-trailer-social-en.mp4`, `M/video/tiny-acre-trailer-social-pt-BR.mp4`    | 24.3 s; opens on a 2.3 s generated shot labelled on screen. Never for Play. 1 fps sheets: `M/video/trailer-social-{en,pt-BR}-1fps.png`.        |
| Social pack (7 clips, 2 languages) | `M/social/out/<clip>-<locale>.mp4`, each with a cover `.jpg`                               | green-pov, river-back, day1-day40, homecoming, golden-asmr, one-thumb, perfect-catch. 6.9-8.6 s, real gameplay only. Plan: `M/social/PLAN.md`. |
| Social builder                     | `M/social/make_social.py`                                                                  | `python make_social.py [clip ...]`                                                                                                             |
| Raw captures and video frames      | `M/raw/{en,pt-BR,wide}/`, `M/video/frames/<moment>[@tag][@pt-BR]/`, `M/social/cap/raw/en/` | Re-made by the commands below.                                                                                                                 |
| Flow downloads (round 4)           | `M/flow-raw/r4/`                                                                           | Key art `key-a1..a4`, `key-b1..b4`; backdrops `bd-a1..a4`; video `veo-*`. Rejected and unused ones are kept for the record.                    |
| Flow references (real captures)    | `M/flow-ref-r4/`                                                                           | The current build's dry and green farm, the town river, and the dry farm in 9:16.                                                              |
| Round 3 (superseded)               | `M/archive-r3/`                                                                            | The old raw captures, frames, social clips and videos.                                                                                         |

## Rebuild

```sh
npm run build
export CHROMIUM_PATH="$LOCALAPPDATA/ms-playwright/chromium-1217/chrome-win64/chrome.exe"
M=C:/Users/andre/dev/tiny-acre/marketing
node scripts/store-capture.mjs shots all                       # raw shots, en and pt-BR
node scripts/store-capture.mjs wide valley-farm-dry farm 14 13 # Flow reference, dry half
node scripts/store-capture.mjs wide store-full-field farm 14 13 # Flow reference, green half
python art-src/tools/store_art.py all                          # store/play/ and the two contact sheets
# promo video frames: the beats, the half-speed first green, the river bed under its banner
node scripts/store-capture.mjs video en letter senna cozy fishing
node scripts/store-capture.mjs video pt-BR letter senna fishing
STORE_STEP=1 STORE_TAG=slow node scripts/store-capture.mjs video en green-clean
STORE_KEEP=54,55 node scripts/store-capture.mjs video all river-bed
python art-src/tools/store_video.py                            # promo, en
LOCALE=pt-BR python art-src/tools/store_video.py               # promo, pt-BR
SOCIAL=1 VEO_FRAMES=0,68 python art-src/tools/store_video.py   # social trailer (also LOCALE=pt-BR); needs video/frames/veo-intro
# social pack frames (6x, clean, the valley banners kept), then $M/social/make_social.py
STORE_DPR=6 STORE_TAG=soc STORE_CLEAN_ALL=1 STORE_KEEP=54,55 node scripts/store-capture.mjs video all green-clean river-bed senna tow house-give asmr
STORE_DPR=6 STORE_TAG=soc node scripts/store-capture.mjs video all fishing
node scripts/store-capture.mjs video all hand
STORE_OUT=$M/social/cap STORE_DPR=6 node scripts/store-capture.mjs shots en hero-dry hero-green
node scripts/store-listing-check.mjs                           # listing limits and banned words
```

The fishing bite comes at a random moment. After a re-capture, check each language's reel range (`FISH` in
`store_video.py`, `perfect-catch` in `make_social.py`). The other shots come from scenarios (`title-first-launch`,
`farm-variant-dry`, `store-full-field`, `marls-arrive`, `weir-opened-town`, `tow-house-marls`, `store-river-reveal`),
so they are the same on every run. Re-capture after any change to the HUD, hotbar or text that shows in a shot.

## What the owner does (nothing here is uploaded)

1. **Licence check:** confirm Google's generative AI terms allow commercial use of the Flow-derived sprites and of
   the Flow art in the store set: the feature graphic, the backdrop behind the screenshots and the video's end card,
   and the Veo intro in the social trailers (see `ASSETS.md`). The gameplay inside every frame is captured from the
   game.
2. **YouTube:** upload `tiny-acre-promo-en.mp4` and `tiny-acre-promo-pt-BR.mp4`, public or unlisted, not "made for
   kids" unless you mean it, ads off. Then paste each link into Play Console > Main store listing > Video, in its
   language. The social trailers (`tiny-acre-trailer-social-*.mp4`) are for social posts only. When you post one,
   tick the platform's AI-generated content label; the trailer also says "AI-assisted intro" on screen.
3. **Social:** post the 7 clips from your own accounts, in the order and with the captions in `M/social/PLAN.md`.
4. **Play Console:** create the app as developer **Quiet Spirit Studio** with the application id
   `com.quietspiritstudio.tinyacre`, then upload the icon,
   feature graphic and screenshots per language (en-US, pt-BR), paste the listing text, choose the category and
   tags, fill the content rating questionnaire, and fill the Data safety form and the privacy policy URL from the
   Data safety section in `agents/PUBLISHING.md` (cloud save through Google Play Games and opt-out analytics mean
   the game is not "no data collected"). Keep the listing's cloud backup and statistics sentences only if those
   features are in the uploaded build.
5. Check every screenshot against the build you upload; re-capture if the HUD or hotbar changed.
