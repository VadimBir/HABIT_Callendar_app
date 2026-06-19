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
- R10 ✅ Tapping "+" (from ANY view / create path) opens an INTERMEDIATE chooser
        before the editor — now via CalendarController.launchCreateEvent (single
        funnel: FAB + day/week grid taps), so it appears in the week view too.
- R11 ✅ Chooser has a "Create event" button.
- R12 ✅ Reminder-preset selection is CHECKBOXES, MULTI-SELECT (any number).
- R13 ✅ Chooser shows a TEMPLATE LIST on the right (only when ≥1 template).
- R14 ✅ "Create event" opens the editor with the union of the checked presets'
        reminders pre-filled; user can still add/remove more.
- R15 ✅ Picking a TEMPLATE opens the editor as a DEEP COPY (title, description,
        location, duration, all-day, reminders).

## Reminder presets
- R20 ✅ User can define ANY NUMBER of named presets (preset manager).
- R21 ✅ Each preset holds ANY NUMBER of reminders, each amount + unit
        (minutes/hours/days/weeks). No fixed pick-list.
- R22 ✅ D2D / W2W / M2M seeded as editable presets in the same store.
- R23 ✅ Settings → "Manage reminder presets": add / edit / rename / delete
        presets and their reminders (HabitPresetsActivity).
- R24 ✅ Presets persisted (JSON store in HabitPrefs).

## Templates
- R30 ✅ Event preview (EventInfoFragment) has a checkable "Save as template"
        control that marks the current event as a template.
- R31 ✅ Templates stored as a deep copy of fields (HabitPrefs templates JSON).
- R32 ✅ Templates listed in the new-event chooser (see R13/R15).

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
- R61 ✅ Presets fully editable via the preset manager (replaced the fixed
        pick-list ListPreferences).
- R62 ❌ "New events dynamic by default" toggle persists but is read nowhere yet
        (dead pref — wiring comes with R40/R41).
- R63 ❌ "Seamless week scrolling" toggle persists but is read nowhere (deferred
        with R50).
