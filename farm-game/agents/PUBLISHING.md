# Publishing a playable build

The game is a static site, so any static host works. The default is a claude.ai Artifact.

## Artifact (what was used)

1. `npm run build` (typecheck + Vite build into `dist/`).
2. List live files: `Artifact action=list scope=files url=<artifact url>`.
3. Publish `dist/index.html` to the same `url` with `files` mapping every other file in `dist/`:
   - published path is relative (`assets/index-XXXX.js`), source is `dist/...`
   - **`.tmj` maps must be sent with `contentType: "text/plain"`**
   - set stale hashed files from the previous version to `null` so they are removed
   - build the map from `find dist -type f`, never from memory (hashes change every build)
4. Open the URL on a phone-sized viewport; check the title screen loads and a new game starts.

## GitHub Pages (alternative)

`.github/workflows/pages.yml` deploys to `/farm/`; it is manual (`workflow_dispatch`) so work-in-progress branches do
not reach production.

## Before publishing

`npm run verify` green. Mention anything unverified (devices, native builds) in the hand-off message.
