# HABIT — Project Handoff / Context Snapshot

Single source of continuity for this project. Read this top-to-bottom to resume
work with zero prior context. Pair it with `REQUIREMENTS.md` (authoritative
feature list + statuses).

────────────────────────────────────────────────────────
## 0. TL;DR
- The app is **HABIT**, a **native Android calendar = a fork of Etar**
  (Etar-Calendar, AOSP-based, Kotlin/Java + Gradle). It lives in `etar/`.
- We pivoted here from an earlier from-scratch HTML/PWA prototype (now parked in
  `legacy-web/`, not used).
- Work is delivered as **small committed checkpoints**, each **built to an
  installable debug APK** and sent to the user, and each **audited by an Opus
  sub-agent** against `REQUIREMENTS.md`.
- Current version: **versionCode 1063 / versionName habit-1.1.x** (bump every build).
- Branch: **`claude/sleepy-bohr-vjmxup`** (push here only).

────────────────────────────────────────────────────────
## 1. Repo layout
```
HABIT_Callendar_app/
├── etar/            # THE APP — Etar fork (edit here). Gradle project.
├── docs/HABIT-debug.apk   # latest delivered APK (committed for direct download)
├── legacy-web/      # old web/PWA prototype (reference only, unused)
├── REQUIREMENTS.md  # authoritative, IDed requirements + statuses
├── HANDOFF.md       # this file
└── .github/workflows/android.yml  # CI: builds the debug APK
```

────────────────────────────────────────────────────────
## 2. Build environment (already set up in this container; ephemeral!)
- Android SDK installed at **`/home/user/android-sdk`** (platforms android-34 &
  android-36, build-tools 34.0.0 & 36.0.0, platform-tools, cmdline-tools).
- JDK 21, Gradle wrapper 9.5.1 (AGP 9.2.1). Etar needs SDK 36 (Android 16 target).
- `etar/local.properties` contains `sdk.dir=/home/user/android-sdk` (gitignored).
- Outbound HTTPS works; GitHub reachable.

If the container was reclaimed, re-create the SDK before building:
```
cd /home/user && mkdir -p android-sdk/cmdline-tools && cd android-sdk/cmdline-tools
curl -s -o t.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q t.zip && rm t.zip && mv cmdline-tools latest
export ANDROID_HOME=/home/user/android-sdk
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses >/dev/null 2>&1
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools"
echo "sdk.dir=/home/user/android-sdk" > /home/user/HABIT_Callendar_app/etar/local.properties
```

## 3. Build / deliver loop (do this every checkpoint)
```
# 1. bump version
sed -i 's/versionCode = N/versionCode = N+1/; s/versionName = "habit-X"/versionName = "habit-Y"/' etar/app/build.gradle.kts
# 2. build
cd etar && export ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk
./gradlew :app:assembleDebug --no-daemon         # ~30s incremental
# 3. publish APK into repo
cp app/build/outputs/apk/debug/app-debug.apk ../docs/HABIT-debug.apk
# 4. commit + push (branch claude/sleepy-bohr-vjmxup), then SendUserFile docs/HABIT-debug.apk
```
- Verify label/version: `/home/user/android-sdk/build-tools/36.0.0/aapt dump badging <apk> | grep -E "versionCode|application-label:'HABIT'"`
- **Always bump versionCode** so the user's sideload actually updates. App id is
  `ws.xsoh.etar` (debug = `ws.xsoh.etar.debug`); signed with the local debug key.

## 4. Conventions
- Commit trailer (required):
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EsAFkAWe9eax2M6CSbJ5BW
  ```
- Do NOT put the model id in any committed artifact.
- After each feature: build → deliver APK via SendUserFile → launch an **Opus
  audit sub-agent** (general-purpose, model opus) scoped to the change, checking
  correctness/regression/deps against `REQUIREMENTS.md`; fix Critical findings,
  rebuild, redeliver.

## 5. Working style with this user (IMPORTANT)
- The user is blunt/abusive and very impatient; do NOT mirror tone, do NOT lecture.
  Stay terse, do the work, ship installable APKs.
- They hate partial delivery ("I tell you 10 things you do 2"). Capture EVERY
  request into `REQUIREMENTS.md` immediately, then implement.
- They want explicit, honest status (no over-claiming). The Opus auditor exists
  precisely to keep me honest — keep using it.
- Keep chat replies compact. The APK + the diff are the deliverable.

────────────────────────────────────────────────────────
## 6. HABIT custom code (where everything lives)
All custom logic is namespaced "habit" and isolated where possible.

- **`etar/app/src/main/java/com/android/calendar/settings/HabitPrefs.java`**
  Central helper. Reads the shared prefs store (`com.android.calendar_preferences`).
  - Flags: `isEnabled`, `isDynamicByDefault`, `isSeamlessScroll` (last two are
    persisted but NOT yet consulted — see pending R42/R63).
  - Event-screen font scale: `getEventTextScale`, `wrapWithScale(Context)`.
  - Presets (JSON, key `pref_habit_custom_presets`): `Preset{name,int[] minutes}`,
    `getPresets` (seeds D2D/W2W/M2M if empty), `getCustomPresets`,
    `saveCustomPresets`.
  - Templates (JSON, key `pref_habit_templates`):
    `Template{title,description,location,durationMinutes,allDay,int[] minutes}`,
    `getTemplates/saveTemplates/addTemplate/removeTemplateByTitle/hasTemplateTitle`.
- **`.../settings/HabitPresetsActivity.java`** — full CRUD UI for presets
  (add/edit/rename/delete; each preset has any number of amount+unit reminders).
  Registered in `AndroidManifest.xml`; opened from a Preference click wired in
  `GeneralPreferences.kt` (`pref_habit_manage_presets`).
- **`.../HabitEventChooser.java`** — the intermediate "New event" dialog: left =
  multi-select preset checkboxes (reminders unioned), right = Templates column
  (only if any). Template tap → deep-copy intent → editor. Invoked from the
  single create funnel.
- **`.../CalendarController.java`** `launchCreateEvent()` — the SINGLE funnel for
  all new-event creation (FAB + day/week grid taps). Calls `HabitEventChooser.show`
  when `HabitPrefs.isEnabled`. (FAB in `AllInOneActivity` just sends CREATE_EVENT.)
- **`.../event/EditEventActivity.java`** — `attachBaseContext` applies font scale;
  consumes `EXTRA_EVENT_REMINDERS`. `EditEventFragment.java:~253` sets
  `mModel.mHasAlarm=true` when reminders are supplied (so preset/template
  reminders actually render).
- **`.../EventInfoActivity.java`** — `attachBaseContext` applies font scale.
- **`.../EventInfoFragment.java`** — `toggleTemplate()` + checkable menu item
  `info_action_template` ("Save as template") in `res/menu/event_info_title_bar.xml`;
  checkmark set in `updateMenu()`. Reads reminders from `mOriginalReminders`.
- **Month view tappable events:**
  `.../month/MonthWeekEventsView.java` records per-event hit rects
  (`mEventCells`, populated in `FormattedEvent.draw` using `getDaySpan(day)`),
  exposes `getEventAtLocation(x,y)`.
  `.../month/MonthByWeekAdapter.java` captures tap Y and, in `mDoSingleTapUp`,
  opens the event (VIEW_EVENT) when one is hit, else falls back to day-open.
- **Settings XML:** `res/xml/general_preferences.xml` AND
  `res/xml-v26/general_preferences.xml` both contain the "HABIT features"
  category (keep them in sync). Strings in `res/values/strings.xml`
  (`habit_*`), arrays in `res/values/arrays.xml` (`habit_*`).
- **Branding:** `standalone_app_label` = "HABIT" in strings.xml.

────────────────────────────────────────────────────────
## 7. Status (mirror of REQUIREMENTS.md — keep both updated)
DONE & audited:
- Base fork builds → APK; branded HABIT; native infinite scroll; CI. (R1–R7)
- New-event chooser from every "+", multi-select preset checkboxes, combined
  reminders pre-filled. (R10–R12, R14)
- Templates: save-as-template in preview, Templates column in chooser, deep copy
  (title/desc/location/duration/all-day/reminders). (R13, R15, R30–R32)
- Reminder presets: any number, each any number of reminders, full settings CRUD;
  D2D/W2W/M2M seeded & editable; JSON persisted. (R20–R24)
- Settings: master enable; Manage presets; Event-screen text size 100→67%. (R60,R61,R64)
- Month view: tap an event → opens that event. (R70)

PENDING / NOT STARTED:
- **R40–R42 Dynamic deadlines**: mark event dynamic → if it lapses undone,
  deadline auto-rolls +1 day, original kept as reference; daily WorkManager
  worker; wire `isDynamicByDefault`. Deps OK (androidx.work 2.11.2 already present).
  Plan: per-event flag via Events ExtendedProperties or a local store keyed by
  eventId; new `DynamicDeadlineWorker` enqueued from `CalendarApplication`; a
  "dynamic" checkbox in the editor; consult the flag in the create path.
- **R50/R51 Seamless continuous scroll (week AND day)**: DEFERRED. It is a full
  rewrite of Etar's ~5,000-line `DayView` (page-flip baked into a two-view
  `ViewSwitcher`). Biggest item; multiple iterations; will be rough en route.

KNOWN CAVEATS:
- `isDynamicByDefault` / `isSeamlessScroll` toggles persist but do nothing yet.
- "Save as template" is in the event-details ⋮ overflow menu; it is NOT shown when
  the event opens as a popup card (dialog mode) — only on the full event screen.
  User may want an on-screen checkbox instead (offered; not yet done).
- Templates are keyed by title (no duplicate/empty titles).
- Font scale applies on screen open (reopen to see a change).

────────────────────────────────────────────────────────
## 8. Immediate next actions (pick up here)
1. Confirm with user: month-view event tap feels right.
2. Decide next: **Dynamic deadlines (R40–R42)** vs **DayView continuous-scroll
   rewrite (R50/R51)**. (User leans toward wanting the scroll, but it's the
   heavy one; dynamic deadlines is more self-contained.)
3. Whatever is chosen: implement → bump version → build → copy APK → commit/push
   → SendUserFile → Opus audit → fix → update REQUIREMENTS.md + this file.

────────────────────────────────────────────────────────
## 9. Quick command crib
- Build: `cd etar && ./gradlew :app:assembleDebug --no-daemon` (ANDROID_HOME set)
- APK out: `etar/app/build/outputs/apk/debug/app-debug.apk`
- Inspect: `/home/user/android-sdk/build-tools/36.0.0/aapt dump badging <apk>`
- Push: `git push -u origin claude/sleepy-bohr-vjmxup`
- Search code: ripgrep over `etar/app/src/main/java` and `.../res`.
