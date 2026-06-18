# HABIT Calendar

A native Android calendar built as a **fork of [Etar](https://github.com/Etar-Group/Etar-Calendar)**
(an open-source, AOSP-based calendar), with custom "HABIT" features layered on top and made
configurable in the app's Settings.

Etar gives us a real, mature calendar for free — true infinite scrolling, month/week/day/agenda
views, system calendar sync, and home-screen widgets — so the custom work focuses only on the
features that are unique to this app.

## Repository layout

```
HABIT_Callendar_app/
├── etar/          # ★ The Android app — our fork of Etar (Kotlin/Java, Gradle)
├── docs/          # Prebuilt APKs for direct download
├── legacy-web/    # The earlier from-scratch web/PWA prototype (kept for reference)
└── .github/workflows/android.yml   # CI: builds the debug APK
```

## Planned HABIT features (tracked as individual commits)

- [x] **Base:** Etar fork builds from source to an installable APK
- [ ] **Settings hub:** a "HABIT" settings category that hosts the toggles below
- [ ] **Dynamic deadlines:** events whose deadline auto-rolls +1 day when they lapse undone,
      keeping the original as a greyed reference
- [ ] **Reminder cadence:** D2D / W2W / M2M presets that pre-fill a default reminder set
- [ ] **Color groups + filter:** leverage Etar's calendars/colors with frequency sorting
- [ ] **Timeline day cells (optional view):** mini 0:00–23:59 lines inside day cells

## Building locally

Requires JDK 21 and the Android SDK (platform & build-tools 36).

```bash
cd etar
echo "sdk.dir=/path/to/Android/sdk" > local.properties
./gradlew :app:assembleDebug
# APK -> etar/app/build/outputs/apk/debug/app-debug.apk
```

## Building via CI

Push a `v*` tag (or run the **Build HABIT (Etar) APK** workflow manually from the Actions tab).
The workflow uploads the APK as an artifact and attaches it to the release for tag builds.

## Credits & license

Based on Etar Calendar, licensed under GP-3.0 / Apache-2.0 (see `etar/LICENSE`,
`etar/LICENSE.apache2`). This fork retains those licenses.
