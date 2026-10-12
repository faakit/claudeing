# Mobile: build, verify, ship

Tiny Acre ships three ways from one codebase: the web (GitHub Pages), an installable PWA, and
Capacitor apps for Android and iOS. Everything below was done without a phone, so this page
separates **verified in emulation** from **needs a real device**.

## What is verified automatically

Run `npm run verify` (lint, typecheck, about 880 unit tests, build, the e2e suites for the core loop, phones,
scenarios, controls, feel and the guided start, and perf budgets).

| Area                              | How it is checked                                                                                                                                                           | Command              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Core loop on the production build | headless Chromium plays new game, till, plant, water, sleep, reload, continue                                                                                               | `npm run e2e`        |
| Background / foreground           | `visibilitychange` freezes the clock, drops held input, resumes cleanly                                                                                                     | `npm run e2e`        |
| Offline (airplane mode)           | service worker installs, network is cut, reload + new game still work                                                                                                       | `npm run e2e`        |
| Installability                    | manifest is fullscreen + portrait, all icons load, maskable icon present                                                                                                    | `npm run e2e`        |
| Notches / safe areas              | 6 phone profiles with injected `safe-area-inset-*` (iPhone 13, iPhone 15 Pro Max, Pixel 7, punch-hole, SE, Galaxy Fold): canvas never enters the unsafe area                | `npm run e2e:mobile` |
| Touch targets                     | real hit-area sizes measured per profile; every control >= 44 CSS px (1 px rounding slack) on phones 390 CSS px wide or more, >= 38 on 360-389, narrower ones reported only | `npm run e2e:mobile` |
| Landscape                         | "turn upright" overlay appears                                                                                                                                              | `npm run e2e:mobile` |
| Native bridge                     | Capacitor plugins mocked: app state -> lifecycle, Android back button, haptics driver, Preferences save store, splash                                                       | `npm test`           |
| Render cost                       | GL draw calls per frame and JS ms per frame, worst case = fully planted field. Budgets: <= 12 draws, <= 3.5 ms JS                                                           | `npm run perf`       |
| Frame pacing                      | per-frame times in real play (walk, doors, sheets, sleep, new game) at 1x, 4x and 6x CPU throttle, against budgets                                                          | `npm run perf`       |

Measured in round 4: **2-5 draw calls and at most about 1.8 ms of JavaScript per frame**, including a
198-tile planted field with 24 weeds and particles. The game is nowhere near CPU- or draw-call-bound;
the remaining risk on real hardware is GPU fill on very old devices, which only a device can show.

## What needs a real device (the M8 acceptance list)

None of these can be proven in emulation. Run them on one mid-range Android phone (about four
years old) and one iPhone, once per release:

- [ ] **30 FPS or better** for 10 minutes of play (Android: `adb shell dumpsys gfxinfo app.tinyacre.farm`; iOS: Xcode FPS gauge). Try battery-saver mode too.
- [ ] **Kill the app mid-day**, relaunch, Continue: progress is there (saves happen on background, sleep, map change, and every minute).
- [ ] **Audio resumes** after a phone call, Siri, and app switching. iOS: also test with the silent switch on (the PWA is muted by it, the native app should not be: see Known issues).
- [ ] **Notch / punch-hole / rounded corners**: no control is hidden. Check portrait with the notch at the top and at the bottom (home indicator).
- [ ] **One-thumb play** for 10 minutes, right hand then left: taps, Action, painted rows, the tool ring, Interact; no missed or stuck inputs. The detailed controls checklist is in `agents/OPEN-FINDINGS.md`.
- [ ] **Airplane mode**: native app works fully (it has no network use at all).
- [ ] **Haptics** feel right (a light tick on a tile action, a tool change and each painted tile; a stronger pulse on a ripe harvest or a level-up; a double pulse on a refusal) and the Options toggle turns them off.
- [ ] **Android back button** closes dialogs, then opens the menu (swallowed during sleep); on the title it asks before quitting.
- [ ] **Splash**: no white flash between launch and the title screen.
- [ ] Low storage / blocked storage: the game still plays and says "Saving is unavailable" instead of claiming "Saved!".

## Build the apps

Prerequisites: Node 22, plus Android Studio (any OS) and/or Xcode 16+ on a Mac.

```bash
npm install
npm run cap:sync          # builds the store web app (no dev tools) and copies it into android/ and ios/
npm run cap:android       # opens Android Studio  (Run > Run 'app' on a device or emulator)
npm run cap:ios           # opens Xcode           (select a team under Signing, then Run)
```

Command line, Android: `npm run android:debug` (debug APK) or `npm run android:bundle` (AAB; unsigned unless the upload key is set up). JDK 21, SDK, signing and the Play checklist: `agents/PUBLISHING.md`, "Android".
iOS release: Product > Archive in Xcode, then upload to TestFlight.

Icons and splash come from `scripts/make-icons.mjs` (pixel art drawn in code) via
`npm run assets`, which regenerates every Android density and the iOS asset catalog. Replace the art
in that script (or drop your own `resources/icon.png`, `icon-foreground.png`, `icon-background.png`,
`splash.png`) and re-run.

### Before the first store submission: pick the app id

`app.tinyacre.farm` is the configured id. It becomes permanent with the first Play upload, so change it only
before that. Update it in three places, then `npm run cap:sync`:

1. `capacitor.config.ts` (`appId`)
2. Android: `android/app/build.gradle` (`namespace`, `applicationId`) and move `MainActivity.java` to the matching package folder
3. iOS: `PRODUCT_BUNDLE_IDENTIFIER` in Xcode (target App, Signing & Capabilities)

## How the native shells are configured

- **Portrait only**: `portrait` (Android manifest), portrait-only orientations plus `UIRequiresFullScreen` (iOS).
- **Fullscreen**: immersive system bars (`MainActivity`), hidden iOS status bar, dark window background (no white flash).
- **Notch**: Android `shortEdges` cutout mode and iOS `contentInset: never`; the page keeps controls clear with CSS `env(safe-area-inset-*)`.
- **Saves**: native key-value store (SharedPreferences / UserDefaults) via Capacitor Preferences, not IndexedDB. Android auto-backup includes it.
- **Screen stays on** while playing (long stretches without touches).
- **No service worker in the apps** (their bundle is already local; a cache-first worker could serve a stale game after an update).
- **Permissions**: `INTERNET` (Capacitor default) and `VIBRATE` (haptics). `AD_ID` is removed for every library. No ads. The only network use is optional: cloud save through Google Play Games (Android, once a Play Games project id is built in) and analytics (see the analytics lane). Their data and Data safety answers are in `agents/PUBLISHING.md` ("Cloud save: data and Data safety", and the shared "Privacy, consent and Data safety"). There are no game accounts; Play Games signs in with the phone's Google account.
- **Edge-to-edge (API 35+)**: SystemBars `insetsHandling: 'css'`; `env(safe-area-inset-*)` carries the cutout. Bars are hidden (immersive).
- **Version**: `versionName` = the title's build label, `versionCode` = commit minutes since 2020 (`android/app/build.gradle`).

## Store checklist

Prepare early:

- App icon 1024x1024 (`resources/icon.png`), feature graphic (Google Play), 4-8 screenshots per device class, short + long description.
- **Privacy policy URL** and the **Data safety form** (Play): answer from `agents/PUBLISHING.md` ("Cloud save: data and Data safety", and the shared "Privacy, consent and Data safety"). With cloud save configured, the Android app sends the farm's save to Google Play Games, so "no data collected" is no longer true there. The iOS app and the web build have no cloud save; check the analytics section before claiming "no data collected" anywhere.
- Age rating questionnaires: no violence, no purchases, no user-generated content.
- Apple **Guideline 4.2 (thin web wrapper)** mitigations already in the app: fully offline, native haptics, native save store, native splash, no browser chrome, lifecycle-aware autosave, back-button handling.
- Google Play: target API level must be current (set `targetSdkVersion` in `android/variables.gradle`); new personal developer accounts have extra closed-testing requirements, check current rules.

## Known issues and risks

- **iOS silent switch** mutes Web Audio in a browser/PWA (an iOS rule, no web fix). The native iOS app sets the `playback` audio session in `AppDelegate.swift`, so it plays regardless of the switch (and mixes with the player's music). That Swift change is untested: it has not been compiled yet.
- **Audio unlock** needs one tap on iOS/Android. The title screen's Continue/New Game provides it; the first tap anywhere also unlocks.
- **Very small phones** (below ~640 CSS px wide): the UI keeps its layout, so controls fall just under 44 CSS px (43 on a 667px-wide SE). Tiny text (`5x7` pixel font) is about 8-10 CSS px on typical phones; a "larger text" option is a good follow-up.
- **iPhone Safari (web)** has no fullscreen API; the Options menu tells players to "Add to Home Screen", which gives the fullscreen PWA.
- Android compiles (`assembleDebug`, `bundleRelease`, 2026-10-12) but has not run on an emulator or phone yet. iOS has never been compiled (no Xcode).
