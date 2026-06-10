# HABIT Calendar — Feature Checklist (audit of app.html)

> **Status update (same day):** "Needed next" priorities 1–5 and the priority-7 small bugs have been implemented and verified (dynamic auto-prolong, month-view fit, reminder firing, time-proportional timelines, sorting rules, completed-task truncation, persisted filters). Priority 6 (pan/zoom gaps) remains open.

Audited 2026-06-10 against the owner spec + `docs/samsung-calendar-reference.md`.
Live-tested with headless Chromium, 390x844, touch. Note: app.html was modified during the audit
(uncommitted, 2547 lines, md5 `5a200b00…`); all results below are against that current version.
The sibling files (`app.js`, `calendar.js`, `tasks.js`, `notifications.js`, `index.html`) are NOT
referenced by app.html — they appear to be a stale multi-file version.

## 0. Header / chrome
- ✅ **0. Thin month/year line on top** — 48px header, bold left-aligned label, tap opens year/month picker sheet.
- ⚠️ **0.1 Left filter column (calendar colors)** — works: checkbox + color dot per calendar, filtering re-renders all views. Names + active-task counts exist but only after tapping the `»` expand toggle; collapsed default shows dots only. Filter state is lost on page reload (not persisted).
- ✅ **0.2 Round ADD TASK button, 1cm, 1cm from bottom/right** — measured 37.8px (=1cm at 96dpi) and 1cm offsets; opens task form.

## 1. Calendar core
- ✅ **Scrollable weeks Mon→Sun** — "Scroll" view: infinite weeks, lazy-loads both directions, clamped at Jan 1970; Mon leftmost. (Default view is Month, not Scroll.)
- ✅ **Day = box of colored task tiles** — up to 2 pastel chips + "+N" overflow, Samsung-style.
- ✅ **Click day expands it, tasks sorted by due time** — bottom agenda sheet, sorted by dueDate, with per-task checkbox and "+ Add event" row.
- 🐞 **Month view clips weeks 5–6** — default week height is computed as available/4 (per spec 4), but month view always renders 6 rows inside an `overflow:hidden` flex area: 6×139px = 834px > 583px available, so the last ~2 week rows are clipped and unreachable (no scroll in month view). Verified live: `lastRowBottom` 909 vs container bottom 631.

## 2. Split + divider
- ✅ **Horizontal split, bottom pane 25%** — task panel measured exactly 0.25 of viewport height.
- ✅ **0.25cm × 0.5cm handle at middle of split line** — measured 9.4×18.9px (=0.25×0.5cm); has 44px invisible touch target.
- ✅ **Dragging resizes panes** — pointer/touch/mouse drag works (tested 211px → 311px), clamped 15–85%.

## 3. Task model
- ✅ **Global task list, shown on calendar on due day** — localStorage `habit_tasks`; appears in month/scroll/linear views and bottom pane.
- ✅ **Title + color group select** — large borderless title field; color circles sorted by usage count, "+ new" last (opens New Calendar modal with name + color picker, auto-selects after create).
- ✅ **Type fixed/continuous/dynamic** — select with conditional form fields.
- ✅ **Due date** — Start (optional) + End datetime-local; End required for non-continuous.
- ✅ **Reminder cadence radio D2D/W2W/M2M** — visible for all types, D2D checked by default, prefills editable reminder presets (D2D: 15m/1h/2h/4h; W2W: 12h/1d/2d/3d/5d; M2M: 3d/5d/1w/2w/3w); changing cadence re-applies presets; hint text updates.
- ✅ **Set of reminders min/hours/days/weeks before due** — add/remove rows, stored on the task. (But see "reminders never fire" below.)
- ✅ **Continuous semantics** — no date fields shown; starts at createdAt; spans every day until done; done-time (`completedAt`) ends the span; drawn border-only.
- 🐞 **Dynamic auto-prolong: NOT implemented** — `postponeCount` is set to 0 at creation and **no code ever increments it or moves `dueDate`** (no prolong check on load, render, or timer). Verified live: a dynamic task 10 days overdue stays on its past date with `postponeCount:0` and disappears from today's calendar. The form even shows the hint "Dynamic: due date auto-prolongs by 1 day/week/month when missed" — a promise the code never keeps. The display side (`(+Xd)` suffix in chips/list/agenda, "orig {date} (+Xd)" in the detail sheet) exists but is dead code.
- ❌ **"Earliest previous reminder repeats next day from original date"** — no trace of this logic.
- ⚠️ **"(+XX days)" display** — implemented as `(+Xd)` in 4 places, but unreachable because postponeCount never changes; also spec says "(+XX days)" wording.
- 🐞 **Reminders never fire** — settings toggle only calls `Notification.requestPermission()`; there is zero scheduling/checking code (`notifications.js` exists in the repo but is not loaded by app.html).
- 🐞 **Editing a completed task drops `completedAt`** — `saveTask` copies `completed` but not `completedAt`; for a completed continuous task this makes it render on all dates again indefinitely.
- ⚠️ Color usage `count` only increments on create, never decrements on delete or adjusts on edit-recolor, so the "sorted by usage" order drifts.

## 4. Weeks grid / zoom / pan
- ✅ **Mon leftmost, Sun rightmost** — both header and cells; Sat blue, Sun red.
- ✅ **Default exactly 4 weeks above split** — `computeDefaultWeekHeight()` sets week height = area/4 (correct in Scroll view; this same value causes the Month-view clipping bug above).
- ✅ **Vertical pinch stretches day heights, future-week retention** — continuous 40–160px range; top visible week is re-anchored across zoom so the same weeks stay in view; width retained.
- ⚠️ **Horizontal pinch** — exists but only 3 discrete steps (7/5/3 visible days) and it always hides the trailing columns (Sat/Sun, then Thu–Sun) regardless of pinch focal point. Spec requires continuous width scaling relative to the pinch focal point.
- ⚠️ **Swipe pan X (weekdays) and Y (weeks)** — Y: works in Scroll view (native scroll); Month view has no swipe at all (prev/next buttons only). X: no panning anywhere in week/month grids (`touch-action: pan-y`); when zoomed to 5/3 days you cannot pan to the hidden weekdays — they are simply unreachable.

## 5. Day-box timeline rendering
- 🐞 **Day box as 00:00→23:59 timeline: NOT implemented** — chips are full-cell-width stacked bars. Verified live: an 8:00–12:00 task renders left 4% → width 92% of the cell instead of starting at 33% with 17% width. No time-proportional positioning code exists.
- ❌ **Dynamic font scaling (~6→12)** — chip font is fixed 10px.
- ⚠️ **Multi-day flow across day boxes** — the task does appear on every spanned day (verified: 4 cells for a 4-day task), but as identical full-width chips: no partial start-day / full middle / partial end-day proportions, and no continuous spanning lanes (Samsung-style banner bars with rounded true ends).
- ✅ **Continuous tasks drawn border-only** — transparent fill + colored border in month, scroll, and linear views.

## 6. Within-day behavior
- ❌ **Sort: most common color group first, then earliest due** — day cells show storage order; the day sheet sorts by due time only. No frequency component anywhere.
- ✅ **Done tickbox per event** — in day sheet, bottom pane, and detail sheet; sets `completedAt` = now (done-time), continuous tasks end at that date.
- ⚠️ For fixed/dynamic tasks, completion removes the event from the calendar entirely rather than showing it ending at done-time (spec: "ends the task at done-time").

## 7. Settings
- ✅ Settings modal exists: notifications toggle, JSON export/import, clear-all. (Notification toggle is cosmetic — see "reminders never fire".)
- ❌ Samsung-style options (first day of week, week numbers, per-calendar color edit/delete, recycle bin) absent; calendars cannot be renamed/recolored/deleted after creation.

## 8. Bottom pane
- ⚠️ **All events listed** with color edge, title, "Xh/Xd left / overdue" meta, checkbox, collapsible Completed section — but **sorted by closest due date only, not "frequency then closest end time"** (verified order ignores color-group frequency; continuous/no-due tasks sink to bottom).

## Samsung One UI reference items
- ✅ Visual language: #0381FE accent, #FCFCFC/#000 backgrounds, 26px sheets, pastel chip fills with darker same-hue text, dark mode via `prefers-color-scheme`.
- ✅ Today button = rounded square with today's date number; jumps to today (incl. scroll re-anchor).
- ✅ Tap month label → year/month picker bottom sheet (scrollable years, epoch-clamped).
- ✅ Day agenda bottom sheet with grip, swipe-down dismiss, scrim close, "No events" empty state.
- ✅ Event detail sheet with Done/Edit/Delete (no Share).
- ✅ Adjacent-month dimming, today filled circle, sticky day-of-week header, hairline row dividers.
- ❌ Horizontal swipe = prev/next month with page-slide animation.
- ❌ Week / Day / Year views, search, drawer navigation (app has Month/Scroll/Linear toggle instead).
- ❌ Multi-day banner lanes with rounded true start/end edges (repeated chips instead).
- ❌ Long-press / drag-to-move events; ripple feedback.

## Needed next (prioritized)
1. **Implement dynamic auto-prolong** (the app's namesake feature): on load + daily check, while `dueDate < now` for uncompleted dynamic tasks, add 1 day/week/month per cadence, increment `postponeCount`, shift reminders; repeat the earliest previous reminder daily from the original date; show "(+XX days)" with the original day as reference. Remove or honor the form hint.
2. **Fix month view clipping** — either render only the weeks that fit (4 at default height) with vertical paging/scroll, or size month rows to area/6.
3. **Implement reminder firing** — a `setInterval` check against task reminders + `new Notification(...)` (the permission toggle already exists; `notifications.js` has a stale starting point).
4. **Time-proportional day-box timeline** (spec 5): position/size chips by start/due time on a 00:00→23:59 axis, partial bars on first/last day of multi-day tasks, dynamic 6–12px font.
5. **Sorting rules**: bottom pane = color-group frequency then closest end; within-day = most common color group then earliest due.
6. **Pan/zoom gaps**: horizontal swipe to pan hidden weekdays when zoomed (currently unreachable), focal-point-relative continuous horizontal zoom, swipe navigation in month view.
7. **Small bugs**: preserve `completedAt` on edit; persist sidebar filter state; adjust color usage counts on edit/delete; show completed fixed tasks ending at done-time; allow calendar rename/recolor/delete.
8. **Samsung polish (optional)**: page-slide month swipe, multi-day banner lanes, Share action, week/day/year views.
