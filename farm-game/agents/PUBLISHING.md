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

# Android (Google Play)

The Android app is the store web build wrapped by Capacitor 8 (`android/`). Nothing here has been uploaded or
published, and no account has been signed into. Agents never sign in, upload, publish or create a release keystore.

## Android toolchain (owner's machine)

- **JDK 21.** Capacitor 8 compiles with Java 21. A portable Microsoft OpenJDK 21 is in
  `C:/Users/andre/dev/tiny-acre/tools/jdk-21` (from aka.ms/download-jdk, SHA-256 checked). It is used per command
  and never installed system-wide. `scripts/android.mjs` finds it, or set `TINY_ACRE_JAVA_HOME`. Android Studio's
  bundled JBR also works.
- **Android SDK** in `C:\Users\andre\AppData\Local\Android\Sdk` (`ANDROID_HOME`): cmdline-tools 23, platform
  `android-36`, build-tools 35.0.0, platform-tools. The owner accepted the SDK licence himself. cmdline-tools 23
  replaces `sdkmanager` with `bin\android.exe`, and package names use slashes:

  ```sh
  SDK="C:/Users/andre/AppData/Local/Android/Sdk"
  "$SDK/cmdline-tools/latest/bin/android.exe" --sdk="$SDK" sdk install platforms/android-36 build-tools/35.0.0 platform-tools
  ```

  Only the owner reads and accepts the SDK licence (`sdkmanager.bat --licenses`).

## Build

```sh
npm run android:debug    # cap:sync (store build, no dev code) + Gradle assembleDebug  -> debug APK
npm run android:bundle   # cap:sync + Gradle bundleRelease                              -> release AAB
```

`npm run android:debug -- --no-sync` skips the web build when only native code changed. Outputs:

- `farm-game/android/app/build/outputs/apk/debug/app-debug.apk` (about 13 MB, debug key)
- `farm-game/android/app/build/outputs/bundle/release/app-release.aab` (about 7 MB, **unsigned** until the upload
  key below exists)

The script checks the synced web app carries no dev code, and sets `JAVA_HOME`/`ANDROID_HOME` for Gradle only.

**Version.** `versionName` is the title's build label (`<commit> <date>`); `versionCode` is the commit time in
minutes since 2020. Build a newer commit for every upload (Play refuses a code it has seen). Override once with
`TINY_ACRE_VERSION_CODE` / `TINY_ACRE_VERSION_NAME`.

**App id** `app.tinyacre.farm`, name "Tiny Acre", as already configured. It is permanent from the first Play
upload; change it only before that (docs/MOBILE.md lists the three places).

## Try it on an emulator (owner)

No emulator is installed: it was outside the agents' allowed downloads and needs Windows' hypervisor (WHPX) on.

1. Turn on "Windows Hypervisor Platform" (Windows Features) and reboot.
2. Install the emulator and a Play image:
   `android.exe --sdk="$SDK" sdk install emulator system-images/android-36/google_apis_playstore/x86_64`, then create
   a device (a Pixel 7 profile) with `avdmanager` or Android Studio's Device Manager.
3. Start it, then `"$SDK/platform-tools/adb.exe" install -r android/app/build/outputs/apk/debug/app-debug.apk`.
4. Run the device checks below. From a cold launch without config,
   `adb logcat -d | grep -iE "tinyacre|capacitor|games|AndroidRuntime"` must show no crash and no Games or sign-in
   lines.

A real phone works the same way over USB (USB debugging on).

## Device checks (each release; not yet done on any device)

- Cold launch without any config: splash, then the title; no crash, no sign-in sheet.
- Portrait held when the phone rotates. On a cutout phone (or emulator cutout profile) no control is under the
  notch; the hotbar sits on the bottom edge; the gesture bar stays hidden until swiped.
- Back: on the title it asks to quit (No stays, Yes exits). In play it closes an open sheet, opens the menu when
  nothing is open, and does nothing during sleep.
- Home, then return: music and sound stop in the background and come back; the clock did not run while away.
- Kill from recents mid-day, relaunch, Continue: progress is there.
- Airplane mode: everything works (the app makes no network requests).
- Haptics: a light tick on a tile action; Options > vibration off silences it.
- `adb shell dumpsys package app.tinyacre.farm | grep -E "targetSdk|versionName|AD_ID"`: targetSdk=36, the build
  label, no AD_ID.
- With analytics on: `adb logcat -s FA FA-SVC` shows no events before the title's consent answer.

## Upload key and Play App Signing (owner only)

With Play App Signing Google keeps the app-signing key; you keep only an **upload key** (if it is lost, Play
support can reset it).

1. Create the upload keystore **outside the repo** (it asks for passwords; keep them in your password manager):

   ```sh
   "C:/Users/andre/dev/tiny-acre/tools/jdk-21/bin/keytool.exe" -genkeypair -v \
     -keystore "C:/Users/andre/keys/tiny-acre-upload.jks" -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Create `farm-game/android/keystore.properties` (gitignored; never commit it):

   ```properties
   storeFile=C:/Users/andre/keys/tiny-acre-upload.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```

   Or set `TINY_ACRE_UPLOAD_STORE_FILE`, `TINY_ACRE_UPLOAD_STORE_PASSWORD`, `TINY_ACRE_UPLOAD_KEY_ALIAS` and
   `TINY_ACRE_UPLOAD_KEY_PASSWORD` for the one command.

3. `npm run android:bundle` now reports "upload key" and the AAB is signed with it.
4. In Play Console: create the app, accept Play App Signing (Test and release > App integrity; the default for new
   apps), and upload the AAB to internal or closed testing first.

`.gitignore` (both `farm-game/` and `android/`) covers `*.jks`, `*.keystore`, `*.p12`, `keystore.properties`,
`key.properties` and `google-services.json`. Check `git status` before each commit anyway.

## Play pre-launch checklist (owner, in Play Console)

- [ ] **Developer account** verified. Personal accounts created after Nov 2023 must run a **closed test with at
      least 12 testers for 14 days in a row** before production (it was 20 testers until Dec 2024; check the number
      Console shows). Line up about 20 testers to be safe.
- [ ] **Privacy policy URL** (App content): required, public, and true to the shipped build, including analytics
      (release/analytics) and cloud save (release/cloud-save) once they ship. A page beside the game, e.g.
      `https://faakit.github.io/claudeing/farm/privacy.html`, is fine.
- [ ] **Data safety form**, matching the shipped build. Without analytics or cloud save: no data collected or
      shared, and no network use. With analytics (only builds made with VITE_ANALYTICS=firebase and
      google-services.json): App activity > App interactions, Device or other IDs (Firebase app-instance ID; no
      advertising ID, AD_ID removed), Approximate location (Google derives it from masked IPs). Each row: collected,
      not shared (Firebase is Google's processor), optional (consent asked on the title, opt-out in Options >
      Controls), purpose Analytics, encrypted in transit. With cloud save: the save file goes to the player's own Play
      Games account, and the gamer name is shown in-game only. Full rows and the GA settings to turn off are in
      "Privacy, consent and Data safety" at the end of this file (added by the analytics and cloud-save lanes).
- [ ] **Content rating** (IARC questionnaire): no violence, gambling, user content, chat or location; in-app
      purchases "no" until Billing ships. Expect Everyone / PEGI 3.
- [ ] **Target audience**: 13+ unless you want the Families programme. Under-13 brings Families rules (certified
      SDKs only, stricter policy).
- [ ] **Ads**: "No ads".
- [ ] **Store listing**: name, short and full description, 512x512 icon (marketing lane, from
      `resources/icon-foreground.png` on `icon-background.png`), 1024x500 feature graphic, phone screenshots.
- [ ] **Target API** 36 (meets Play's requirement).
- [ ] **Pre-launch report** (runs on testing tracks): read its crashes and accessibility notes.
- [ ] Release notes, then internal testing, closed testing, production.

## Native plugin seams (for the other release lanes)

- `android/`, every Gradle file and `capacitor.config.ts` live on release/android; other lanes send native changes
  there, so the merges never collide.
- Custom Java goes in `android/app/src/main/java/app/tinyacre/farm/plugins/<Name>Plugin.java`, registered with one
  line in `LanePlugins.java` (before the bridge starts). JS reaches it through `registerPlugin('<Name>')` from
  `@capacitor/core`, so the web bundle carries no native code.
- **Cloud save** (release/cloud-save): `PlayGamesSavesPlugin.java` is on release/android byte for byte, with cloud
  save owning its content, the `play-services-games-v2` dependency (`variables.gradle`) and the
  `game_services_project_id` resValue. The id comes from `TINY_ACRE_PGS_PROJECT_ID` or `pgs.projectId` in the
  gitignored `android/local.properties`. Only a numeric id merges `src/pgs/AndroidManifest.xml` (the `APP_ID`
  meta-data). The Games auto-init provider is always removed; the plugin initializes the SDK itself, only with an id.
- **Analytics** (release/analytics): no npm dependency until the owner activates Firebase. The manifest already
  keeps collection off until consent, turns off the ad id and ad personalization, and removes `AD_ID`. The
  google-services Gradle plugin applies itself once `android/app/google-services.json` (gitignored) exists.
- **Play Billing** (later, nothing installed): `@revenuecat/purchases-capacitor` (Capacitor 8), or a thin
  `plugins/BillingPlugin.java` on Play Billing Library 7+ to avoid a third party. Either brings the
  `com.android.vending.BILLING` permission, needs products in Play Console and a content rating update.
- **Notifications** (later, nothing installed): `@capacitor/local-notifications` for "crops are ready", scheduled on
  the device, no server. Android 13+ needs `POST_NOTIFICATIONS`: ask in context, never at launch. No push (FCM).
