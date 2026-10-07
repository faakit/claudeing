# Mobile: build, verify, ship

Tiny Acre ships three ways from one codebase: the web (GitHub Pages), an installable PWA, and
Capacitor apps for Android and iOS. Everything below was done in a Linux sandbox with no phone,
so this page separates **verified in emulation** from **needs a real device**.

## What is verified automatically

Run `npm run verify` (lint, typecheck, 140+ unit tests, build, three e2e suites, perf budgets).

| Area                              | How it is checked                                                                                                                       | Command              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Core loop on the production build | headless Chromium plays new game, till, plant, water, sleep, reload, continue                                                           | `npm run e2e`        |
| Background / foreground           | `visibilitychange` freezes the clock, drops held input, resumes cleanly                                                                 | `npm run e2e`        |
| Offline (airplane mode)           | service worker installs, network is cut, reload + new game still work                                                                   | `npm run e2e`        |
| Installability                    | manifest is fullscreen + portrait, all icons load, maskable icon present                                                                | `npm run e2e`        |
| Notches / safe areas              | 5 phone profiles with injected `safe-area-inset-*` (iPhone 13/15 Pro Max, Pixel 7, punch-hole, SE): canvas never enters the unsafe area | `npm run e2e:mobile` |
| Touch targets                     | real hit-area sizes measured per profile; every control >= 44 CSS px on phones >= 800px wide (smallest measured: 46)                    | `npm run e2e:mobile` |
| Landscape                         | "turn upright" overlay appears                                                                                                          | `npm run e2e:mobile` |
| Native bridge                     | Capacitor plugins mocked: app state -> lifecycle, Android back button, haptics driver, Preferences save store, splash                   | `npm test`           |
| Render cost                       | GL draw calls per frame and JS ms per frame, worst case = fully planted field. Budgets: <= 12 draws, <= 3.5 ms JS                       | `npm run perf`       |

Measured on the last run: **2-3 draw calls and ~1.3-1.8 ms of JavaScript per frame**, including a
198-tile planted field with 24 weeds and particles. The game is nowhere near CPU- or draw-call-bound;
the remaining risk on real hardware is GPU fill on very old devices, which only a device can show.

## What needs a real device (the M8 acceptance list)

None of these can be proven in the sandbox. Run them on one mid-range Android phone (about four
years old) and one iPhone, once per release:

- [ ] **30 FPS or better** for 10 minutes of play (Android: `adb shell dumpsys gfxinfo app.tinyacre.farm`; iOS: Xcode FPS gauge). Try battery-saver mode too.
- [ ] **Kill the app mid-day**, relaunch, Continue: progress is there (saves happen on background, sleep, map change, and every minute).
- [ ] **Audio resumes** after a phone call, Siri, and app switching. iOS: also test with the silent switch on (the PWA is muted by it, the native app should not be: see Known issues).
- [ ] **Notch / punch-hole / rounded corners**: no control is hidden. Check portrait with the notch at the top and at the bottom (home indicator).
- [ ] **Two-thumb play** for 10 minutes: joystick + Action + Interact, no missed or stuck inputs.
- [ ] **Airplane mode**: native app works fully (it has no network use at all).
- [ ] **Haptics** feel right (light tick on tool use, double pulse on harvest/sale, buzz on errors) and the Options toggle turns them off.
- [ ] **Android back button** closes dialogs, then opens the menu, then exits from the title screen.
- [ ] **Splash**: no white flash between launch and the title screen.
- [ ] Low storage / blocked storage: the game still plays and says "Saving is unavailable" instead of claiming "Saved!".

## Build the apps

Prerequisites: Node 22, plus Android Studio (any OS) and/or Xcode 16+ on a Mac.

```bash
npm install
npm run cap:sync          # builds the web app and copies it into android/ and ios/
npm run cap:android       # opens Android Studio  (Run > Run 'app' on a device or emulator)
npm run cap:ios           # opens Xcode           (select a team under Signing, then Run)
```

Command line, Android: `cd android && ./gradlew assembleDebug` (APK) or `./gradlew bundleRelease` (AAB, needs a signing config).
iOS release: Product > Archive in Xcode, then upload to TestFlight.

Icons and splash come from `scripts/make-icons.mjs` (pixel art drawn in code) via
`npm run assets`, which regenerates every Android density and the iOS asset catalog. Replace the art
in that script (or drop your own `resources/icon.png`, `icon-foreground.png`, `icon-background.png`,
`splash.png`) and re-run.

### Before the first store submission: pick the app id

`app.tinyacre.farm` is a placeholder. Change it **before** creating store listings because it cannot
be changed afterwards. Update it in three places, then `npm run cap:sync`:

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
- **Permissions**: only `INTERNET` (the Capacitor template default; the game makes no network requests). No analytics, no ads, no accounts.

## Store checklist

Prepare early (see the plan, "Packaging and store release"):

- App icon 1024x1024 (`resources/icon.png`), feature graphic (Google Play), 4-8 screenshots per device class, short + long description.
- **Privacy policy URL**: the game collects no data; say exactly that. Data safety form (Play) and privacy labels (App Store): "no data collected".
- Age rating questionnaires: no violence, no purchases, no user-generated content.
- Apple **Guideline 4.2 (thin web wrapper)** mitigations already in the app: fully offline, native haptics, native save store, native splash, no browser chrome, lifecycle-aware autosave, back-button handling.
- Google Play: target API level must be current (set `targetSdkVersion` in `android/variables.gradle`); new personal developer accounts have extra closed-testing requirements, check current rules.

## Known issues and risks

- **iOS silent switch** mutes Web Audio in a browser/PWA (an iOS rule, no web fix). The native iOS app sets the `playback` audio session in `AppDelegate.swift`, so it plays regardless of the switch (and mixes with the player's music). That Swift change is untested: I could not compile it here.
- **Audio unlock** needs one tap on iOS/Android. The title screen's Continue/New Game provides it; the first tap anywhere also unlocks.
- **Very small phones** (below ~640 CSS px wide): the UI keeps its layout, so controls fall just under 44 CSS px (43 on a 667px-wide SE). Tiny text (`5x7` pixel font) is about 8-10 CSS px on typical phones; a "larger text" option is a good follow-up.
- **iPhone Safari (web)** has no fullscreen API; the Options menu tells players to "Add to Home Screen", which gives the fullscreen PWA.
- I could not compile the native projects here (no Android SDK or Xcode in the sandbox), so a first `assembleDebug` / Xcode build may surface a small config issue. The generated projects and `cap sync` are clean.
