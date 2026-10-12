# Google Play store assets

Everything the Play Console listing needs, except the video (Play takes a YouTube link).

| Asset | File | Spec |
| --- | --- | --- |
| App icon | `play/icon-512.png` | 512x512, 32-bit PNG, every pixel opaque; the adaptive icon's layers (`resources/icon-foreground.png` on `icon-background.png`) on whole pixels |
| Feature graphic | `play/feature-graphic.png` (en), `play/feature-graphic.pt-BR.png` | 1024x500, 24-bit PNG, no alpha; text inside the central area |
| Phone screenshots | `play/screenshots/en/01..07-*.png`, `play/screenshots/pt-BR/01..07-*.png` | 1080x1920 (9:16), real gameplay with a caption band |
| Listing text | `listing.en.md`, `listing.pt-BR.md` | app name, short and full description, what's new, category and tags |
| Promo video | outside the repo: `C:/Users/andre/dev/tiny-acre/marketing/video/tiny-acre-promo-en.mp4` | 1080x1920, 30 fps, H.264 + AAC, 26 s, gameplay only |

Screenshot order: the first green, Rosa's letter, a full field, towing a log, the river's return, Senna's homecoming,
fishing the restored river.

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
   the Flow intro in the social trailer (see `ASSETS.md`). The store screenshots, feature graphic, icon and store
   video contain no generated imagery beyond the game's own Flow-derived sprites.
2. **YouTube:** upload `tiny-acre-promo-en.mp4` to YouTube (public or unlisted, not "made for kids" unless you mean
   it, ads off), then paste the link into Play Console > Main store listing > Video. The social trailer
   (`tiny-acre-trailer-social-en.mp4`) is for social posts only; label it as containing AI-generated footage where
   the platform asks.
3. **Play Console:** create the app with the final application id (see `docs/MOBILE.md`), then upload the icon,
   feature graphic and screenshots per language (en-US, pt-BR), paste the listing text, choose the category and
   tags, fill the content rating questionnaire, the data safety form ("no data collected") and a privacy policy URL.
4. Check every screenshot against the build you upload; re-capture if the HUD or hotbar changed.
