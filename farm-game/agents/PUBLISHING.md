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

## Privacy, consent and Data safety (analytics and cloud save)

Shared by the analytics lane (release/analytics, which keeps this section) and the cloud-save lane
(release/cloud-save, whose detail is in its own sections above). The answers must match the build you upload: a
build without `VITE_ANALYTICS=firebase` and `google-services.json` collects nothing for analytics, and its answers
drop the analytics rows.

### Data safety answers

Overall: data is collected, nothing is shared with third parties (Google runs Firebase and Play Games for the app),
all of it is encrypted in transit, and every row is optional for the player. Each lane's rows apply only to a build
with that lane turned on.

| Play data type                               | What, exactly                                                                                                                                                                                                            | Collected | Shared | Optional                                     | Purpose                               | Lane       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ | -------------------------------------------- | ------------------------------------- | ---------- |
| App activity > App interactions              | Guided-start steps, the game day, the milestones (first harvest, first sale, first green, the spring and the weir opened, Senna home, first fish, first board quest), session start and end with length, language picked | Yes       | No     | Yes: asked on the title, opt-out in Options  | Analytics                             | analytics  |
| Device or other IDs                          | Firebase's app-instance ID (random, reset on opt-out). Not the advertising ID: the AD_ID permission is removed and ad id collection is off. The game's own random install id never leaves the device.                    | Yes       | No     | Yes: as above                                | Analytics                             | analytics  |
| Location > Approximate location              | Google Analytics derives a coarse location (country, region) from masked IP addresses. Turn off granular location in GA (below). The game itself reads no location.                                                      | Yes       | No     | Yes: as above                                | Analytics                             | analytics  |
| App activity > Other actions (game progress) | The saved game (the exact local save JSON) in Google Play Games Saved Games. Android only, once a Play Games project id is built in. Not ephemeral.                                                                      | Yes       | No     | Yes: the game plays fully offline without it | App functionality                     | cloud save |
| Personal info > User IDs                     | The Play Games gamer identity, collected by the Play Games SDK (the game shows the gamer name on the phone and never sends or stores it)                                                                                 | Yes       | No     | Yes: as above                                | App functionality, Account management | cloud save |
| App info and performance > Diagnostics       | The Play Games SDK's own diagnostics and analytics                                                                                                                                                                       | Yes       | No     | Yes: as above                                | Analytics                             | cloud save |

Analytics does not collect (cloud save has its own rows above): name, email, user ids, precise location, contacts,
photos, messages, free text, purchase history, health, financial data, web history, crash logs or the advertising
ID.

Data deletion: the player can turn analytics off in Options; that stops collection, empties the local queue and
resets Firebase's app-instance ID on the device. Nothing links Analytics data to a person, so there is no per-user
deletion request; set GA data retention to 2 months (below) so event data expires.

Cloud save deletion: through the player's Play Games profile or Google Account. The developer holds no copy.

### Analytics

- **What runs**: `src/platform/analytics/` (the layer: schema, install id, session id, batching, offline queue) and
  `src/game/analyticsWiring.ts` (which game moments become events). The exact event list is `SCHEMA` in
  `src/platform/analytics/schema.ts`; every parameter is a whole number, a step id or a language code, and anything
  else is dropped before it is queued.
- **Off by default**: with no config the layer never starts: no storage, no timers, no network, no consent
  question, no Options switch. The web build (GitHub Pages) has no analytics at all.
- **Consent**: an Android build with Firebase asks once on the title, before New Game or Continue: "Share
  play stats to help improve the game? No names, no ads." with Share / No thanks. Nothing is sent before the answer
  (events wait in a local queue and are dropped on No). Firebase collection is off in the manifest until the game
  turns it on after a Share. Menu > Opts > Share stats: ON/OFF changes the answer at any time.
- **Why ask everyone**: an analytics identifier stored on the phone needs consent under the EU/UK ePrivacy rules
  and GDPR, and LGPD in Brazil (the game's second language) is easiest to meet with consent too. The game does not
  know where the player is (it reads no location), so it asks everywhere, once. See DECISIONS.md.
- **Owner settings in Google Analytics / Firebase** (do these before the first upload with analytics):
  - Admin > Data collection: Google Signals **off**; granular location and device data collection **off**.
  - Admin > Data retention: **2 months**.
  - Admin > Data sharing settings: all **off**.
  - Do not link Google Ads or AdMob; do not set a User-ID.
  - Accept the Analytics data processing terms (Admin > Account settings) if you are in the EU/UK.

#### Turning analytics on (owner only; never commit the files below)

1. In the Firebase console, create a project (or use one), add an Android app with package `app.tinyacre.farm`, and
   download `google-services.json` into `farm-game/android/app/` (gitignored there and in `farm-game/`).
2. In `farm-game/`: `npm i @capacitor-firebase/analytics@^8` (no `firebase` web SDK is needed: the game calls the
   native plugin only).
3. Create `farm-game/.env.local` (gitignored) with the line `VITE_ANALYTICS=firebase`.
4. `npm run cap:sync`, then build as usual. The google-services Gradle plugin applies itself when the json exists.
5. Apply the GA settings above, then check on a test phone: `adb logcat -s FA FA-SVC` shows nothing before the
   title's question; after Share, Firebase DebugView (`adb shell setprop debug.firebase.analytics.app
app.tinyacre.farm`) shows `ta_first_open`, `ta_session_start`, `day_start` and the `tutorial_step` events.
6. Update the Data safety form and the privacy policy with the rows and text in this section.

To remove it again: delete the `.env.local` line (the build goes back to no analytics); the plugin can stay.

#### Reading the funnel and retention

Event names in Firebase are ours, except the two Google reserves: `first_open` is logged as `ta_first_open` and
`session_start` as `ta_session_start` (Google logs its own `first_open` and `session_start` too). Every event has
`install_day`: whole local days since the install (0 on the install day).

- **Tutorial funnel**: Analytics > Explore > Funnel exploration. Steps: `ta_first_open`, then `tutorial_step` with
  `index` = 0, 1, 2 ... 15 (one step per guided step: harvest, seeds, plant, water, grow, ship, clock, energy,
  errands, bedOffer, sleep, water2, mail, menu, jobs, town), each filtered to `skipped` = 0, then
  `tutorial_complete` with `skipped` = 0 (a clean completion). Register `index`, `id` and `skipped` as custom
  dimensions first (Admin > Custom definitions, event-scoped). Each step fires once per install, in order, so the
  drop between two steps is the share of players lost there. A step the player skipped after a long stall (the coach
  offers it on optional steps) is sent with `skipped` = 1 and `tutorial_complete.skipped` counts them: count those
  separately, as stuck points, not as passes. `tutorial_skip` (`id`, `index`) counts players who
  skipped the guide and where.
- **D1 / D7 / D30**: Analytics > Retention (built in, from Google's own `first_open` and engagement): the cohort
  table's day 1, day 7 and day 30 columns. The same from our events: an install is retained on day N if it sent any
  event with `install_day` = N (D1: N = 1, exactly, as Google counts it). In Explore > Cohort exploration: cohort by
  first touch, return criterion "any event", granularity daily. Register `install_day` as a custom dimension for a
  check by hand (Explore > Free form: rows `install_day`, metric Total users).
- **Day of churn**: an install is churned once it has sent nothing for 7 days. Its day of churn is its last
  `day_start.game_day` (in game days) and its last `install_day` (in real days). `ta_session_start` also carries
  `days_away` (real days since the last session) and `last_game_day`. In the UI: Explore > Free form, segment
  "users with no events in the last 7 days", rows `game_day` (custom dimension), metric Total users, filtered to
  `day_start`; the peak is where players leave. With the BigQuery export (free, Admin > BigQuery links), exactly:

  ```sql
  -- day of churn: each install's last game day and real day, for installs silent for 7+ days
  SELECT last_game_day, COUNT(*) AS installs
  FROM (
    SELECT user_pseudo_id,
      MAX((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'game_day')) AS last_game_day,
      MAX(event_date) AS last_seen
    FROM `PROJECT.analytics_PROPERTY.events_*`
    WHERE event_name = 'day_start'
    GROUP BY user_pseudo_id)
  WHERE PARSE_DATE('%Y%m%d', last_seen) <= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  GROUP BY last_game_day ORDER BY last_game_day;
  ```

- **Sessions**: `ta_session_start.n` is the install's session count; `session_end.length_s` is one stretch in the
  foreground (back within 30 minutes continues the session, so a session's length is the sum of its
  `session_end`s). Stretches under a second are not sent.
- **Milestones**: one event each, once per install, with `game_day`: `first_harvest`, `first_sale`, `first_green`,
  `spring_opened`, `weir_opened`, `senna_home`, `first_fish`, `first_board_quest`. Add them after
  `tutorial_complete` in a funnel for the long-term arc. An old save loaded for the first time reports none of what
  it had already done.
- **Locally**: the DEV tab's Analytics page (dev provider, `?debug&analytics=dev` or `npm run dev`) shows the
  install's D1/D7/D30, churn status and the last events, computed by the same maths
  (`src/platform/analytics/retention.ts`).

### Cloud save

Android only, Google Play Games Saved Games. What leaves the device, the answers and the owner's setup: see
'Cloud save: data and Data safety' and 'Cloud save setup (owner)' above.

### Privacy policy text

The policy page ships with the game: `public/privacy.html`, served at
`https://faakit.github.io/claudeing/farm/privacy.html` (English, then Portuguese). It describes the default build (no
data), then cloud save and analytics, each marked as only in the Android builds that have them. Before linking it
in Play Console, replace `CONTACT_EMAIL` and `EFFECTIVE_DATE`, and keep it in step with the text below.

**Analytics (only if this build has it).** If you agree when the game asks, Tiny Acre sends play
statistics to Google Analytics for Firebase, so we can see where new players get stuck and whether they come back:
which guided-start steps were finished, the in-game day, a few milestones (such as the first harvest), when a play
session starts and ends and how long it lasted, and the language chosen. Google assigns a random app-instance
identifier and derives an approximate location (country or region) from your IP address. We do not collect your
name, email, contacts, precise location or advertising ID, nothing you type is sent, and the data is not used for
ads or sold. Data is kept for 2 months. You can turn this off at any time in Menu > Opts > Share stats; that
stops collection and resets the identifier on your device. Google processes this data for us under its
[Firebase data processing terms](https://firebase.google.com/terms/data-processing-terms).

**Cloud save (Android, optional).** When you play signed in to Google Play Games, your farm's save file is stored
in your Google Play Games account so you can continue on another phone. It contains only game progress and game
settings. We do not run a server and never receive it. The game shows your Play Games name on your phone and does
not store or send it. Turn cloud save off in Menu > Opts > Cloud save... > Turn off; delete Play Games data from your Play Games
profile or Google Account.
