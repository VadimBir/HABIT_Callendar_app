/*
 * HABIT task layer - bottom task panel.
 *
 * A resizable bottom pane that lists all upcoming non-done events (next 90
 * days plus all habit "continuous" tasks). Each row shows a calendar-color
 * bar, title, due date/time, time-left text and a DONE checkbox.
 *
 * Sorting: most-frequent calendar (by upcoming count) first, then earliest
 * end time. Checking done marks the HabitStore entry done and, for
 * continuous/dynamic tasks, sets DTEND = now; the row is struck through and
 * sinks to the bottom.
 *
 * The pane is built programmatically (handle + divider + list) so it needs no
 * extra layout files. Drag the centered handle to resize (clamped 10%-60%).
 */
package com.android.calendar.habit;

import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Paint;
import android.provider.CalendarContract;
import android.text.format.DateUtils;
import android.util.AttributeSet;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import ws.xsoh.etar.R;

public class HabitTaskPanel extends LinearLayout {

    private static final long DAY_MILLIS = 24L * 60L * 60L * 1000L;
    private static final long WINDOW_MILLIS = 90L * DAY_MILLIS;

    private static final float MIN_FRACTION = 0.10f;
    private static final float MAX_FRACTION = 0.60f;
    private static final float DEFAULT_FRACTION = 0.25f;

    private View mHandle;
    private LinearLayout mListContainer;
    private TextView mEmptyView;

    private float mDragStartRawY;
    private int mDragStartHeight;

    public HabitTaskPanel(Context context) {
        super(context);
        init();
    }

    public HabitTaskPanel(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private int dp(float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                getResources().getDisplayMetrics()));
    }

    private int mm(float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_MM, value,
                getResources().getDisplayMetrics()));
    }

    private int screenHeight() {
        return getResources().getDisplayMetrics().heightPixels;
    }

    private void init() {
        setOrientation(VERTICAL);
        setBackgroundColor(resolveSurfaceColor());
        setElevation(dp(8));

        // --- Top divider line with a centered draggable handle ---
        FrameLikeRow dividerRow = new FrameLikeRow(getContext());
        addView(dividerRow, new LinearLayout.LayoutParams(
                LayoutParams.MATCH_PARENT, dp(44)));

        // --- Title ---
        TextView title = new TextView(getContext());
        title.setText(R.string.habit_tasks_title);
        title.setPadding(dp(16), 0, dp(16), dp(4));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        addView(title, new LinearLayout.LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));

        // --- Scrollable list ---
        ScrollView scroll = new ScrollView(getContext());
        mListContainer = new LinearLayout(getContext());
        mListContainer.setOrientation(VERTICAL);
        scroll.addView(mListContainer, new ScrollView.LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
        addView(scroll, new LinearLayout.LayoutParams(
                LayoutParams.MATCH_PARENT, 0, 1f));

        mEmptyView = new TextView(getContext());
        mEmptyView.setText(R.string.habit_no_tasks);
        mEmptyView.setPadding(dp(16), dp(16), dp(16), dp(16));
        mListContainer.addView(mEmptyView);

        // Default height at 25% of the screen.
        post(new Runnable() {
            @Override
            public void run() {
                setPaneHeight(Math.round(screenHeight() * DEFAULT_FRACTION));
            }
        });
    }

    /** A row containing the divider line and the centered drag handle. */
    private class FrameLikeRow extends LinearLayout {
        FrameLikeRow(Context c) {
            super(c);
            setOrientation(VERTICAL);
            setGravity(Gravity.CENTER_HORIZONTAL);

            // Divider line across the top.
            View line = new View(c);
            line.setBackgroundColor(0x33000000);
            LinearLayout.LayoutParams lineLp = new LinearLayout.LayoutParams(
                    LayoutParams.MATCH_PARENT, dp(1));
            addView(line, lineLp);

            // Handle: 2.5mm wide x 5mm tall, centered, with a larger touch area.
            mHandle = new View(c);
            mHandle.setBackgroundColor(0x66000000);
            LinearLayout.LayoutParams handleLp = new LinearLayout.LayoutParams(
                    mm(2.5f), mm(5f));
            handleLp.topMargin = dp(8);
            handleLp.gravity = Gravity.CENTER_HORIZONTAL;
            addView(mHandle, handleLp);

            // The whole 44dp row is the touch target for dragging.
            setOnTouchListener(new OnTouchListener() {
                @Override
                public boolean onTouch(View v, MotionEvent event) {
                    return handleDrag(event);
                }
            });
        }
    }

    private boolean handleDrag(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                mDragStartRawY = event.getRawY();
                mDragStartHeight = getHeight();
                return true;
            case MotionEvent.ACTION_MOVE: {
                float dy = event.getRawY() - mDragStartRawY;
                // Dragging up (negative dy) grows the pane.
                int newHeight = Math.round(mDragStartHeight - dy);
                setPaneHeight(newHeight);
                return true;
            }
            default:
                return false;
        }
    }

    private void setPaneHeight(int heightPx) {
        int min = Math.round(screenHeight() * MIN_FRACTION);
        int max = Math.round(screenHeight() * MAX_FRACTION);
        int clamped = Math.max(min, Math.min(max, heightPx));
        ViewGroup.LayoutParams lp = getLayoutParams();
        if (lp == null) {
            return;
        }
        lp.height = clamped;
        setLayoutParams(lp);
    }

    private int resolveSurfaceColor() {
        TypedValue tv = new TypedValue();
        if (getContext().getTheme().resolveAttribute(
                com.google.android.material.R.attr.colorSurface, tv, true)) {
            return tv.data;
        }
        return Color.WHITE;
    }

    // ------------------------------------------------------------------
    // Data
    // ------------------------------------------------------------------

    private static class Task {
        long eventId;
        String title;
        long begin;
        long end;
        int color;
        long calendarId;
        boolean done;
    }

    /** Reload the task list from the provider + HabitStore. */
    public void refresh() {
        List<Task> tasks = loadTasks();
        bind(tasks);
    }

    private List<Task> loadTasks() {
        List<Task> tasks = new ArrayList<>();
        Map<Long, Integer> calendarCounts = new HashMap<>();
        long now = System.currentTimeMillis();
        long end = now + WINDOW_MILLIS;

        HabitStore store = HabitStore.getInstance(getContext());

        android.net.Uri.Builder builder = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(builder, now);
        ContentUris.appendId(builder, end);

        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(builder.build(), new String[] {
                    CalendarContract.Instances.EVENT_ID,
                    CalendarContract.Instances.TITLE,
                    CalendarContract.Instances.BEGIN,
                    CalendarContract.Instances.END,
                    CalendarContract.Instances.DISPLAY_COLOR,
                    CalendarContract.Instances.CALENDAR_ID,
            }, null, null, null);
            if (c != null) {
                while (c.moveToNext()) {
                    long eventId = c.getLong(0);
                    HabitStore.Entry e = store.get(eventId);
                    boolean done = e != null && e.done;
                    if (done) {
                        continue; // upcoming non-done only
                    }
                    Task t = new Task();
                    t.eventId = eventId;
                    t.title = c.isNull(1) ? "(No title)" : c.getString(1);
                    t.begin = c.getLong(2);
                    t.end = c.isNull(3) ? t.begin : c.getLong(3);
                    t.color = c.isNull(4) ? Color.GRAY : c.getInt(4);
                    t.calendarId = c.getLong(5);
                    t.done = false;
                    tasks.add(t);
                    Integer count = calendarCounts.get(t.calendarId);
                    calendarCounts.put(t.calendarId, count == null ? 1 : count + 1);
                }
            }
        } catch (SecurityException ignored) {
            // No calendar permission yet.
        } finally {
            if (c != null) {
                c.close();
            }
        }

        // Sort: most-frequent calendar first, then earliest end time.
        final Map<Long, Integer> counts = calendarCounts;
        Collections.sort(tasks, new Comparator<Task>() {
            @Override
            public int compare(Task a, Task b) {
                int ca = counts.containsKey(a.calendarId) ? counts.get(a.calendarId) : 0;
                int cb = counts.containsKey(b.calendarId) ? counts.get(b.calendarId) : 0;
                if (ca != cb) {
                    return cb - ca; // higher count first
                }
                return Long.compare(a.end, b.end);
            }
        });
        return tasks;
    }

    private void bind(List<Task> tasks) {
        mListContainer.removeAllViews();
        if (tasks.isEmpty()) {
            mListContainer.addView(mEmptyView);
            return;
        }
        long now = System.currentTimeMillis();
        for (final Task t : tasks) {
            mListContainer.addView(buildRow(t, now));
        }
    }

    private View buildRow(final Task t, long now) {
        LinearLayout row = new LinearLayout(getContext());
        row.setOrientation(HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(8), dp(8), dp(8), dp(8));

        // Calendar-color bar.
        View bar = new View(getContext());
        bar.setBackgroundColor(t.color);
        LinearLayout.LayoutParams barLp = new LinearLayout.LayoutParams(dp(4), dp(36));
        barLp.rightMargin = dp(8);
        row.addView(bar, barLp);

        // Text block.
        LinearLayout text = new LinearLayout(getContext());
        text.setOrientation(VERTICAL);
        LinearLayout.LayoutParams textLp = new LinearLayout.LayoutParams(
                0, LayoutParams.WRAP_CONTENT, 1f);
        row.addView(text, textLp);

        final TextView titleView = new TextView(getContext());
        titleView.setText(t.title);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        text.addView(titleView);

        TextView sub = new TextView(getContext());
        String due = DateUtils.formatDateTime(getContext(), t.begin,
                DateUtils.FORMAT_SHOW_DATE | DateUtils.FORMAT_SHOW_TIME
                        | DateUtils.FORMAT_ABBREV_ALL);
        sub.setText(due + "  ·  " + timeLeft(t.end, now));
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        text.addView(sub);

        // Done checkbox.
        final CheckBox done = new CheckBox(getContext());
        done.setChecked(t.done);
        done.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                markTaskDone(t, done.isChecked());
                // Visual strikethrough then refresh to re-sort.
                if (done.isChecked()) {
                    titleView.setPaintFlags(
                            titleView.getPaintFlags() | Paint.STRIKE_THRU_TEXT_FLAG);
                }
                refresh();
            }
        });
        row.addView(done);

        return row;
    }

    private String timeLeft(long end, long now) {
        long diff = end - now;
        if (diff <= 0) {
            return "overdue";
        }
        long days = TimeUnit.MILLISECONDS.toDays(diff);
        if (days >= 1) {
            return days + "d left";
        }
        long hours = TimeUnit.MILLISECONDS.toHours(diff);
        if (hours >= 1) {
            return hours + "h left";
        }
        long mins = Math.max(1, TimeUnit.MILLISECONDS.toMinutes(diff));
        return mins + "m left";
    }

    private void markTaskDone(Task t, boolean checked) {
        long now = System.currentTimeMillis();
        HabitStore store = HabitStore.getInstance(getContext());
        store.markDone(t.eventId, checked, now);

        // For continuous/dynamic tasks also close them out by ending now.
        HabitStore.Entry e = store.get(t.eventId);
        if (checked && e != null
                && (HabitStore.TYPE_CONTINUOUS.equals(e.type)
                || HabitStore.TYPE_DYNAMIC.equals(e.type))) {
            ContentValues values = new ContentValues();
            values.put(CalendarContract.Events.DTEND, now);
            try {
                getContext().getContentResolver().update(
                        ContentUris.withAppendedId(
                                CalendarContract.Events.CONTENT_URI, t.eventId),
                        values, null, null);
            } catch (SecurityException ignored) {
            }
        }
    }
}
