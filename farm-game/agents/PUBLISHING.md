# Publishing

The game is published on GitHub Pages at **https://faakit.github.io/claudeing/farm/**. The repo root holds an
unrelated app, which is served at `/`.

## How it deploys

`.github/workflows/pages.yml` runs on every push to `claude/repo-code-github-pages-3ukz7j`, and can also be started
by hand (`workflow_dispatch`). It runs `npm ci`, `npm run lint`, `npm test` and `npm run build` in `farm-game/`,
copies `farm-game/dist/` to `/farm/`, and deploys the site.

The `github-pages` environment only allows the branch **`claude/repo-code-github-pages-3ukz7j`**. A run from any
other branch (including `main`, which the workflow also lists) fails at the deploy step.

## Cloud save: data and Data safety

The shared "Privacy, consent and Data safety" section (analytics lane) merges these rows into the one Play Console
table. Before submitting, check every answer against the current Play Console wording. The developer, not Google,
answers the form.

Cloud save runs in the Android app only; the web build and iOS have none.

What leaves the device, and only after a Play Games project id is built in (see "Cloud save setup" below):

1. **To Google Play Games Services (Saved Games, on Google's servers):** one snapshot named `farm` holding the
   exact local save JSON. That is the farm, gold, bag, villagers' friendship, settings (volumes, handedness,
   controls) and two stats: `playSec` (seconds played) and `savedAt` (when it was written). Its metadata is a
   description line ("Spring 12, year 1 1,234g"), the played time and a progress number (day x 1e6 + minutes). There
   is no screenshot or cover image.
2. **Sign-in** is Play Games v2's automatic sign-in, handled by Google. The game reads the player's Play Games gamer
   name only to show "Signed in as ..." in Options. The name is never stored or sent anywhere. The game never reads
   the email, the Google account name, the player id, friends or the avatar.
3. **No developer server and no other third party.** Nothing about cloud save reaches the developer.
4. **The Play Games SDK itself** collects Gamer Identity (gamertag, avatar) when a Games profile is created or
   updated, plus SDK analytics and diagnostics
   ([Google's disclosure guide](https://developer.android.com/games/pgs/data-collection)). Disclose it as below.
5. **In transit:** HTTPS. **Deletion:** "Turn off" (Menu > Opts > Cloud save...) stops syncing on that phone. Players
   delete Play Games data from their [Play Games profile](https://play.google.com/games/profile) or their Google
   Account.

Data safety answers for cloud save:

| Question                                            | Answer                                                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Collects or shares required user data types         | Yes, once Play Games is configured (with no project id built in, cloud save sends nothing)                                   |
| App activity: Other actions (game progress)         | Collected (the saved game). Not shared. Not ephemeral. Optional (the game plays fully offline without it). App functionality |
| Personal info: User IDs (Play Games gamer identity) | Collected by the Play Games SDK. Not shared. Optional. App functionality and account management                              |
| App info and performance: Diagnostics               | Collected by the Play Games SDK. Not shared. Optional. Analytics (the SDK's own stability)                                   |
| Encrypted in transit                                | Yes                                                                                                                          |
| Users can request deletion                          | Yes, through their Play Games profile or Google Account (the developer holds no copy)                                        |

"Shared" means sent to a third party other than a service provider. Google runs Play Games for the app, so nothing
here counts as shared. Update the privacy policy to match: cloud save is optional, uses Google Play Games, and
stores only the farm's save there.

## Cloud save setup (owner)

Cloud save stays off until these steps are done. Nothing here goes into git: there are no secrets and no client ids
in the repo, and the Android flow needs no client id in the app at all.

1. **Settle the app id first.** Play Games is bound to the package name (`app.tinyacre.farm` is still the placeholder,
   see docs/MOBILE.md) and to the signing keys' SHA-1. Changing either later means redoing steps 3-5.
2. **Play Console > the app > Grow users > Play Games Services > Setup and management > Configuration:** create a
   Play Games Services project. Choose "No, my game doesn't use Google APIs", which creates a Google Cloud project for
   it. Turn **Saved games on** in the configuration's properties.
3. **Credentials > Add credential > Android:** the package name, then an OAuth client. Create one in the linked
   Google Cloud project (APIs and services > Credentials > Create OAuth client ID > Android) for each SHA-1:
   - the **app signing key** (Play Console > Setup > App integrity > App signing key certificate), for store installs;
   - the **upload key**, for internal app sharing;
   - optionally the **debug keystore**
     (`keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`), for local
     debug builds.

   The OAuth consent screen asks for an app name and support email. The Games scope is the only one used.

4. **Testers:** while the Play Games configuration is unpublished, add the testing Google accounts under Play Games
   Services > Testers.
5. **The project id:** Play Games Services > Configuration shows a numeric project id. Put it in the gitignored
   `android/local.properties` as `pgs.projectId=<id>`, or set `TINY_ACRE_PGS_PROJECT_ID=<id>` when building. The build
   then adds the APP_ID meta-data, and the plugin starts.
6. **Build and test on a testing track:** build with `npm run android:bundle` and upload it to internal testing.
   Google only guarantees Play Games on track installs. Check: phone A plays and sleeps, and Options says "Cloud:
   synced just now". Phone B (same Google account, fresh install) shows "Continue (cloud)" on the title. Play on both
   without syncing, and the next sync opens the choice dialog. Turn off works and is remembered.
7. **Publish the Play Games configuration** (Review and publish) before the store release, so non-testers can sign in.

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
