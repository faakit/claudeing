# Publishing

The game is published on GitHub Pages at **https://faakit.github.io/claudeing/farm/**. The repo root holds an
unrelated app, which is served at `/`.

## How it deploys

`.github/workflows/pages.yml` runs on every push to `claude/repo-code-github-pages-3ukz7j`, and can also be started
by hand (`workflow_dispatch`). It runs `npm ci`, `npm run lint`, `npm test` and `npm run build` in `farm-game/`,
copies `farm-game/dist/` to `/farm/`, and deploys the site.

The `github-pages` environment only allows the branch **`claude/repo-code-github-pages-3ukz7j`**. A run from any
other branch (including `main`, which the workflow also lists) fails at the deploy step.

## Deploy a new build

1. Make sure `npm run verify` is green on the latest integration branch.
2. Fast-forward the Pages branch to it:

   ```sh
   git fetch origin
   git push origin origin/integration/round4-2026-10-11:claude/repo-code-github-pages-3ukz7j
   ```

   Use the latest integration branch's name. The push only succeeds as a fast-forward, which is what you want.
   If it is refused, the Pages branch has commits the integration branch lacks: merge those into the integration
   branch first. Never force-push the Pages branch.

3. Watch the run (`gh run watch`, or the Actions tab). Then open `/farm/` on a phone-sized viewport, check that the
   title screen loads, and start a new game.

The service worker serves the game cache-first and swaps in the new build in the background, so a returning
player sees it after one more reload.
If you mention the release anywhere, say what was not verified (real phones, native builds).
