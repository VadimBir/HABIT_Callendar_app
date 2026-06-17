# HABIT Calendar — WWWH Sweep

> Codebase sweep (What / Where / Why / How) produced by the analysis agent.
> This is the source-of-truth backlog for the implementation pass.

## 1. WHAT — Application Overview & Features

HABIT Calendar is a vanilla JavaScript Progressive Web App (PWA) for habit
tracking and calendar management with task organization by color groups.
Installable on Android/iOS via "Add to Home Screen", mobile-first.

### Core Features
- **Calendar views**: Month (6-week grid), Scrollable Weeks, Linear list (app.html only).
- **Task types**: `fixed`, `continuous`, `dynamic` (auto-postpone D2D/W2W/M2M).
- **Color groups**: Work/Personal/Health/Finance defaults + custom, with filtering.
- **Notifications**: Web Notifications API, multiple reminders, periodic 60s fallback.
- **Gestures**: swipe (month nav), pinch-zoom (0.5x–2.0x), wheel zoom, divider drag.
- **Storage**: localStorage (tasks/colors/settings/filters), export/import JSON, clear all.
- **Offline/PWA**: service worker cache-first, manifest with inline SVG icons.

### Data Model (localStorage keys)
- `habit_calendar_tasks`, `habit_calendar_colors`, `habit_calendar_settings`, `habit_calendar_filters`.
- Task: id, title, description, type, colorGroupId, startDate, dueDate, reminderType,
  reminders[{amount,unit}], completed, completedAt, createdAt, updatedAt,
  originalDueDate, postponeCount.

## 2. WHERE — Code Location Map

| File | Lines | Purpose |
|------|------:|---------|
| index.html | 185 | Split-file structure |
| app.html | 1721 | Single-file (newer, diverged) |
| app.js | 394 | Controller, events, refresh |
| storage.js | 376 | localStorage CRUD |
| tasks.js | 426 | Task form + CRUD |
| calendar.js | 425 | Rendering + modals |
| notifications.js | 302 | Notifications + scheduling |
| gestures.js | 190 | Swipe/pinch/divider |
| service-worker.js | 176 | Cache + background |
| styles.css | 600+ | Styling |
| manifest.json | 27 | PWA metadata |

Key references: month render `calendar.js:71-127`; day el `calendar.js:132-191`;
task bar `calendar.js:196-249`; zoom `calendar.js:405-411`; task create
`tasks.js:231-289`; postpone `storage.js:203-233`; notif schedule
`notifications.js:75-99`; periodic check `notifications.js:201-248`; SW fetch
`service-worker.js:69-102`; manifest start_url `manifest.json:5`.

## 3. WHY — Weaknesses & Bugs

### Critical
1. **Dual codebase divergence** — app.html (linear view, time-left, completed
   section, chrono sort) is ahead of split files; fixes don't propagate.
2. **Notification persistence broken** — setTimeout lost on tab close/restart;
   periodic check only runs while tab open.
3. **SW cache invalidation** — caches everything with only CACHE_NAME; stale data.
4. **Timezone handling** — midnight-boundary tasks land on wrong day; no DST.
5. **manifest start_url "/"** — breaks under subdirectory deploys.

### Medium / Low
- No localStorage quota graceful handling; no IndexedDB.
- No color-group deletion (orphans accumulate).
- Multi-reminder dedup unclear (can double-fire).
- Dynamic postpone uncapped.
- No a11y (aria/roles/focus trap/keyboard).
- Dark mode setting stored but unused.
- Import/export unvalidated.
- Responsive gaps (sidebar reserve, modal overflow, safe-area).
- No task search.

### Code smells
- Duplicate filtering logic across files; global objects; no validation;
  mixed concerns; magic numbers; inconsistent date formats.

## 4. HOW — Prioritized Backlog

### P0 (correctness/critical)
- **P0.1** Unify codebase: port app.html features into split files; deprecate app.html.
- **P0.2** Notification persistence via SW background sync + missed-notification replay on init.
- **P0.3** SW cache strategy: split code vs data cache, network-first manifest, version hash.
- **P0.4** Timezone-aware date helpers (`getDateAtMidnight`) used consistently.
- **P0.5** manifest `start_url: "."` (relative).

### P1 (high impact)
- **P1.1** validation.js + user-friendly form errors.
- **P1.2** IndexedDB wrapper (db.js) + migration.
- **P1.3** Color group deletion with cascade/reassign.
- **P1.4** Task search/quick filter.
- **P1.5** Accessibility (ARIA, roles, focus trap, keyboard, non-color cues).
- **P1.6** Dark mode (CSS vars + toggle + auto).

### P2 (polish/future)
- Multi-reminder dedup/batch; recurrence; priorities/tags; backend sync;
  external calendar (Google/iCal); responsive fixes/safe-area.
