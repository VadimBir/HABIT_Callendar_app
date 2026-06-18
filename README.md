# HABIT Calendar App

A simple, adaptive calendar and task management app optimized for mobile (Android/iOS) and desktop.

> The whole app lives in a single self-contained file: **`app.html`**. `index.html` just redirects to it.
> Each day cell is a tiny `0:00 → 23:59` timeline: tasks render as proportional colour lines that flow
> across consecutive days, lanes stay aligned day-to-day, and **future portions fade with a gradient**
> so upcoming events read lighter than current ones.

## Features

### Core Functionality

- **📅 Calendar View**
  - Scrollable weeks (Monday - Sunday)
  - 8 weeks visible by default
  - Month/year navigation
  - Today indicator
  - Color-coded task visualization

- **✅ Task Management**
  - **Three task types:**
    - **Fixed**: Standard calendar events with exact date/time
    - **Continuous**: Ongoing tasks until marked done
    - **Dynamic**: Flexible deadlines with auto-postponement

- **🎨 Color Groups**
  - Organize tasks by categories (Work, Personal, Health, Finance, etc.)
  - Custom color groups
  - Filter calendar by color groups
  - Auto-sorted by frequency

- **🔔 Notifications**
  - Web Notifications API support
  - Multiple reminders per task
  - Customizable reminder intervals (minutes, hours, days, weeks)
  - Background notifications via Service Worker

- **📱 Mobile-Optimized**
  - Progressive Web App (PWA)
  - Installable on Android/iOS
  - Touch gestures:
    - Swipe to travel in both X (days) and Y (weeks)
    - Pinch **vertically** to stretch week height, **horizontally** to zoom into fewer days (anchored at the pinch point)
    - Drag divider to resize sections
  - Responsive design (mobile-first)

### Layout

1. **Header** (Top)
   - Thin month/year bar
   - Navigation arrows
   - Settings button

2. **Left Sidebar**
   - Color group filters
   - Show/hide calendars

3. **Main Calendar** (Top 75%)
   - Scrollable week grid
   - Color-coded task bars
   - Click day to expand details
   - Multi-day task flow visualization

4. **Split Divider**
   - Draggable handle
   - Resize calendar/task sections

5. **Task List** (Bottom 25%)
   - All tasks sorted by frequency & due time
   - Quick task completion checkboxes
   - Task details on click

6. **Floating Add Button**
   - 1cm circle at bottom-right corner
   - 1cm from bottom and right edges

## Task Types Explained

### Fixed Tasks
Standard calendar events with specific start and end times. Example: Meeting at 2 PM on Friday.

### Continuous Tasks
Tasks without a specific deadline that run until marked complete. Example: "Learn Spanish" - starts when created, ends when you mark it done.

### Dynamic Tasks
Tasks with a flexible deadline. If the deadline lapses while the task is still undone, the deadline
**auto-rolls forward exactly +1 day** each time. The original deadline stays put as a greyed, dashed
**reference** on its original date (a "↪ was …" marker), while the live copy moves forward labelled
`Task Name (+5d)` — so you always see both the original intent and the current state (two linked events).

The **reminder cadence** radio controls how reminders are spaced, not the roll amount:
- **D2D (Day to Day)**: short reminders (minutes/hours before)
- **W2W (Week to Week)**: medium reminders (hours/days before)
- **M2M (Month to Month)**: long reminders (days/weeks before)

The same cadence presets are also available to Fixed tasks.

## Technology Stack

- **HTML5** - Semantic markup
- **CSS3** - Grid, Flexbox, responsive design
- **Vanilla JavaScript** - No frameworks
- **LocalStorage** - Data persistence (5-10MB)
- **Web Notifications API** - Push notifications
- **Service Worker** - Offline support & background tasks
- **PWA Manifest** - Mobile installation

## Installation

### Desktop
1. Open `index.html` in a modern browser
2. (Optional) Install as PWA via browser menu

### Mobile
1. Host on HTTPS server or localhost
2. Open in Chrome/Safari
3. Tap "Add to Home Screen"
4. Launch as standalone app

## Usage

### Creating a Task
1. Click the **+** button (bottom-right)
2. Fill in:
   - Title
   - Color group
   - Task type (Fixed/Continuous/Dynamic)
   - Date/time (if applicable)
   - Reminders
   - Description
3. Click "Save Task"

### Managing Tasks
- **Complete**: Check the checkbox
- **Edit**: Click task title
- **Delete**: Edit task → scroll down → delete button

### Filtering
- Use left sidebar to show/hide color groups
- Tasks are auto-filtered in calendar and list

### Notifications
1. Go to Settings (⚙️)
2. Enable "Enable Notifications"
3. Grant browser permission
4. Test with "Test Notification" button

### Data Management
- **Export**: Settings → Export Data (downloads JSON)
- **Import**: Settings → Import Data (upload JSON)
- **Clear**: Settings → Clear All Data (warning: irreversible!)

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

**Required features:**
- LocalStorage
- Web Notifications API
- Service Worker
- CSS Grid/Flexbox

## File Structure

```
HABIT_Callendar_app/
├── app.html            # ★ The entire app (HTML + CSS + JS, self-contained)
├── index.html          # Redirect to app.html
├── manifest.json       # PWA manifest (start_url → app.html)
├── service-worker.js   # Service Worker for offline support
├── README.md           # This file
└── (legacy modular files: styles.css, app.js, storage.js, …  — no longer used)
```

## Development Notes

### Storage Limits
- LocalStorage: ~5-10MB depending on browser
- Consider IndexedDB if you need more storage

### Notification Limitations
- Requires HTTPS (except localhost)
- User must grant permission
- May not work in all browsers
- Service Worker required for background notifications

### Mobile Considerations
- Use `user-scalable=no` to prevent accidental zoom
- Touch events may conflict with scroll
- Test on actual devices, not just emulators

## Future Enhancements

Potential improvements:
- [ ] IndexedDB for larger storage
- [ ] Task recurrence (daily, weekly, monthly)
- [ ] Task attachments
- [ ] Calendar sync (Google Calendar, iCal)
- [ ] Themes (light/dark mode)
- [ ] Multiple calendar views (day, week, month, year)
- [ ] Task search and filtering
- [ ] Task priorities and tags
- [ ] Collaboration features
- [ ] Backend sync for cross-device

## License

MIT License - Free to use and modify

## Support

For issues or questions, please refer to the code comments or open an issue on GitHub.

---

**Built with ❤️ for productivity enthusiasts**
