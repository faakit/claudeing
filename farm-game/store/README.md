# Google Play store assets

Everything the Play Console listing needs, except the video (Play takes a YouTube link).

| Asset             | File                                                                                    | Spec                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| App icon          | `play/icon-512.png`                                                                     | 512x512, 32-bit PNG, every pixel opaque; the adaptive icon's layers (`resources/icon-foreground.png` on `icon-background.png`) on whole pixels |
| Feature graphic   | `play/feature-graphic.png` (en), `play/feature-graphic.pt-BR.png`                       | 1024x500, 24-bit PNG, no alpha; Flow key art with the logo in the game's font, text inside the central area                                    |
| Phone screenshots | `play/screenshots/en/01..07-*.png`, `play/screenshots/pt-BR/01..07-*.png`               | 1080x1920 (9:16), real gameplay framed over a Flow backdrop, big caption                                                                       |
| Listing text      | `listing.en.md`, `listing.pt-BR.md`                                                     | app name, short and full description, what's new, category and tags                                                                            |
| Promo video       | outside the repo: `C:/Users/andre/dev/tiny-acre/marketing/video/tiny-acre-promo-en.mp4` | 1080x1920, 30 fps, H.264 + AAC, 21.5 s, gameplay over the Flow backdrop                                                                        |

Screenshot order (the story arc in `BRIEF.md`): the hero before/after, Rosa's letter, the river coming home, Senna at
dusk, cozy life at golden hour, one hand, the town rising.

## Rebuild

```sh
npm run build
export CHROMIUM_PATH="$LOCALAPPDATA/ms-playwright/chromium-1217/chrome-win64/chrome.exe"
node scripts/store-capture.mjs shots all                       # raw shots, en and pt-BR
node scripts/store-capture.mjs wide valley-farm-dry farm 14 13 # feature graphic, dry half
node scripts/store-capture.mjs wide store-full-field farm 14 13 # feature graphic, green half
python art-src/tools/store_art.py all                          # store/play/ and a contact sheet
node scripts/store-capture.mjs video en                        # video frames
python art-src/tools/store_video.py                            # the promo video (SOCIAL=1: the social trailer)
node scripts/store-listing-check.mjs                           # listing limits and banned words
```

Raw captures, video frames and Flow downloads live in `C:/Users/andre/dev/tiny-acre/marketing/` (`STORE_OUT`), not in
the repo. The shots come from scenarios (`title-first-launch`, `valley-farm-green-reveal`, `store-full-field`,
`tow-first-log`, `river-first-morning`, `marls-arrive`, `store-fishing`), so they are the same on every run.
Re-capture after any change to the HUD, hotbar or text that shows in a shot.

## What the owner does (nothing here is uploaded)

1. **Licence check:** confirm Google's generative AI terms allow commercial use of the Flow-derived sprites and of
   the Flow art in the store set: the feature graphic, the backdrop behind the screenshots and the video's end card,
   and the Veo intro in the social trailer (see `ASSETS.md`). The gameplay inside every frame is captured from the
   game.
2. **YouTube:** upload `tiny-acre-promo-en.mp4` to YouTube (public or unlisted, not "made for kids" unless you mean
   it, ads off), then paste the link into Play Console > Main store listing > Video. The social trailer
   (`tiny-acre-trailer-social-en.mp4`) is for social posts only; label it as containing AI-generated footage where
   the platform asks.
3. **Play Console:** create the app with the final application id (see `docs/MOBILE.md`), then upload the icon,
   feature graphic and screenshots per language (en-US, pt-BR), paste the listing text, choose the category and
   tags, fill the content rating questionnaire, and fill the Data safety form and the privacy policy URL from the
   Data safety section in `agents/PUBLISHING.md` (cloud save through Google Play Games and opt-out analytics mean
   the game is not "no data collected"). Keep the listing's cloud backup and statistics sentences only if those
   features are in the uploaded build.
4. Check every screenshot against the build you upload; re-capture if the HUD or hotbar changed.
