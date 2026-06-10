# Samsung Calendar (One UI) — Web Replication Spec

Design reference researched from Samsung Support docs, One UI developer guidelines, and app reviews.
Target: One UI 6–7 era Samsung Calendar. Values marked (est.) are estimates from screenshots/reviews.

## 1. Layout & Navigation

**App bar (top):** Left: hamburger icon (~24px). Next to it the month + year label ("June 2026") in large bold text (~22-24px) — left-aligned, not centered. Tapping the label opens a scrollable year/month picker for fast long-distance navigation. Right side: search icon, "Today" pill, overflow menu.

**View switching:** Hamburger opens a left drawer listing Year / Month / Week / Day, followed by calendar checkboxes with color swatches, and Search + Settings at the bottom.

**Month view:**
- Sticky day-of-week header row under the app bar: 1-3 letter abbrevs (~11-12px, gray #8C8C8C), Sunday red-tinted, Saturday blue-tinted. Thin 1px divider below.
- 6x7 grid filling the viewport; rows separated by hairline 1px dividers (#E8E8E8 light / #2C2C2E dark); no vertical column dividers.
- Date numerals top-left/top-center of each cell, ~13px. Cells tall (~90-100px) so 3-4 event lines fit.
- Today: date numeral in a filled circle (~24-26px), Samsung blue #0381FE, white numeral. Selected day gets a thin outlined circle.
- Adjacent-month days: shown but numerals at ~40% opacity; events dimmed.
- Event chips: full-cell-width rounded bars ~14-16px tall, radius ~4px, 10-11px text. Pastel/translucent fill of the calendar color with darker same-hue text. Overflow shows "+2".
- Optional: weather icon, emoji stickers, week numbers in slim left gutter.

**Week view:** time-grid: left gutter hour labels (~10px gray), 7 day columns, all-day band pinned under day header. Events rounded rects (radius ~8px), pastel fill, darker text, 1-2px gaps.

**Day view:** same grid, single column; full titles + locations.

**Year view:** 4x3 grid of mini-months, numerals only, today accented blue; tap jumps to month view.

## 2. Interactions

- Horizontal swipe = previous/next period with page-slide animation.
- Tap a day → selection outline + agenda panel slides up from the bottom: rounded-top (~26px radius) sheet listing that day's events sorted by time (colored bar/dot + time + title); empty state "No events". Swipe up expands the sheet (grid compresses), swipe down collapses.
- Tap an event → detail popup with Edit/Delete/Share.
- Long-press event → context actions; in day/week view, drag moves the event.
- FAB: circular +, bottom-right, Samsung blue #0381FE, white plus, soft shadow.
- Today button: small rounded-square outline containing today's date number in the app bar.

## 3. Event Creation Form

Full-screen sheet, Cancel / Save (blue) top corners. Field order:
1. Title — large borderless text field (~20px).
2. Start / End rows ("Wed, Jun 10  2:00 PM"); tapping inline-expands mini month calendar + time spinner. All-day toggle (One UI switch, blue when on).
3. Detail rows with leading gray icons: Location; Calendar/color selector (filled color circles ~28px, 24-color palette); Alert/Reminder (presets + "Add alert" for multiple reminders, custom stepper 0-99 + unit min/hr/day/week); Repeat (pill chips: day/week/month/year + custom with end condition); Notes.

## 4. Visual Design Language (One UI)

- Background: light #FCFCFC with white cards; dark = #000000 with #1C1C1E-#252525 cards.
- Corner radius ~26px sheets/cards, ~16px inner groups.
- Accent: Samsung blue #0381FE. Destructive red ~#F44336.
- Typography: Roboto/Segoe UI fallback. App-bar label 22-24px/600; headers 15px/600; body 14px; secondary 12-13px #8E8E93; date numerals 13px; chip text 10-11px.
- Spacing: 24px side margins, 16px card padding, hairline inset dividers.
- Event palette: blue #69A1FA, green #5DC983, teal #41C0BC, yellow #F7CE4A, orange #F2A45F, coral #EF7E73, pink #F08FB5, purple #9D8CF0, indigo #6E7BD9, brown #B58A6A, gray #9AA0A6, lime #A8C84B — pastel chip fills with ~700-weight same-hue text.
- Current-time indicator: 2px accent-blue line with dot at left gutter; auto-scroll to it.
- Ripple feedback on taps; sheet transitions 250-300ms ease-out.

## 5. Useful Behaviors

- Jump-to-today app-bar button.
- Multi-day events: continuous bars spanning cells, rounded only at true start/end edges, squared at week-wrap, drawn in top banner lanes above single-day chips.
- Overlap: month stacks chips by start time then "+N"; week/day side-by-side columns.
- Past events at reduced opacity; completed tasks strikethrough + checkbox.
- Settings: per-calendar color, first day of week, week numbers, event color brightness, title font size, recycle bin.
