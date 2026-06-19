# HABIT — Requirements (source of truth)

This file is the explicit, authoritative list of what the app must do. Every
item has an ID and a status. An Opus audit agent checks the code against this
file each round and reports missing dependencies and missing/incomplete tasks.

Status legend: ✅ done & verified · 🟡 partial/in progress · ❌ not started · ⏸️ deferred (with reason)

## Platform / base
- R1 ✅ Native Android app, fork of Etar, builds to an installable APK.
- R2 ✅ App branded "HABIT".
- R3 ✅ Truly infinite calendar scrolling (native Etar behaviour).
- R4 ✅ CI workflow builds the APK; prebuilt APK in docs/.
- R5 ✅ Every feature configurable in Settings (HABIT features category exists).
- R6 ✅ Each feature delivered as its own commit/checkpoint.
- R7 ✅ An Opus agent audits the code against this file (deps + missing tasks).
- R8 🟡 Bump versionCode on each build so sideload installs always update.

## New-event flow (intermediate chooser)
- R10 🟡 Tapping "+" (from ANY view / create path) opens an INTERMEDIATE chooser
        screen BEFORE the event editor. (Bugfix: must appear from week view too.)
- R11 🟡 Chooser has a "Create new event" button.
- R12 🟡 Chooser has reminder-preset selection as CHECKBOXES, MULTI-SELECT
        (tick any number). NOT radio, NOT a single-pick list.
- R13 ❌ Chooser shows a TEMPLATE LIST (only if ≥1 event was ever saved as a
        template). Templates appear to the right of the preset checkboxes.
- R14 🟡 Picking "Create new event" opens the editor with the union of the
        checked presets' reminders pre-filled (user can still add/remove more).
- R15 ❌ Picking a TEMPLATE opens the editor as a DEEP COPY of that template
        (title, description, location, duration, calendar, color, reminders, …).

## Reminder presets
- R20 ❌ User can define ANY NUMBER of named reminder presets (e.g. 5, 8, 10…),
        not just the three built-ins.
- R21 ❌ Each preset can contain ANY NUMBER of reminders (each with its own
        amount + unit: minutes/hours/days/weeks). No fixed pick-list limitation.
- R22 🟡 Built-in presets D2D / W2W / M2M exist and are editable.
- R23 ❌ Settings UI to add / edit / rename / delete presets and their reminders.
- R24 ✅ Presets are persisted (JSON store in HabitPrefs).

## Templates
- R30 ❌ In the event editor there is a "Save as template" control (checkbox/menu)
        to mark the current event as a template.
- R31 ❌ Templates are stored (deep copy of the event's fields).
- R32 ❌ Templates are listed in the new-event chooser (see R13/R15).

## Dynamic deadlines
- R40 ❌ An event can be marked "dynamic": if its deadline lapses while not done,
        the deadline auto-rolls +1 day, keeping the original as a reference.
- R41 ❌ Background worker performs the rolling (WorkManager).
- R42 🟡 Setting: "new events dynamic by default" (toggle exists; behaviour TBD).

## Scrolling
- R50 ⏸️ Seamless horizontal week sliding (free drag/fling across many weeks,
        stop on any day, weekday header scrolls with content). DEFERRED — it is a
        full rewrite of Etar's 5,000-line week view; revisit after the above.

## Settings (HABIT features category)
- R60 ✅ Master "Enable HABIT features" switch.
- R61 🟡 Edit default reminder for built-in presets (currently fixed pick-list;
        must become free-form per R21/R23).
- R62 🟡 "New events dynamic by default" toggle (wiring pending, see R42).
- R63 🟡 "Seamless week scrolling" toggle (behaviour deferred, see R50).
