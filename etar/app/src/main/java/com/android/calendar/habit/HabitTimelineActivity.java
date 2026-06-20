/*
 * HABIT: a continuous, infinitely-scrolling vertical timeline.
 *
 * Days are stacked top (past) -> bottom (future) in a recycling ListView; each
 * row is a HabitDayTimelineView showing that day's 24h column with events as
 * horizontal chunks. Tapping an event opens it; tapping empty time starts a new
 * event at that time (via the HABIT new-event chooser).
 */
package com.android.calendar.habit;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.os.Bundle;
import android.provider.CalendarContract;
import android.os.Handler;
import android.os.Looper;
import android.util.SparseArray;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;

import androidx.appcompat.widget.Toolbar;

import com.android.calendar.CalendarController;
import com.android.calendar.CalendarController.EventType;
import com.android.calendar.Event;
import com.android.calendar.HabitEventChooser;
import com.android.calendar.calendarcommon2.Time;
import com.android.calendar.settings.HabitPrefs;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class HabitTimelineActivity extends Activity {

    private static final long DAY_MS = 86400000L;
    private static final long HOUR_MS = 3600000L;
    private static final int START_OFFSET = 180;   // days of history
    private static final int COUNT = START_OFFSET + 540;

    private final Calendar mBase = Calendar.getInstance();
    private final SparseArray<ArrayList<Event>> mCache = new SparseArray<>();
    private final SparseArray<Map<Long, int[]>> mReminderCache = new SparseArray<>();
    private final ExecutorService mExec = Executors.newSingleThreadExecutor();
    private final Handler mMain = new Handler(Looper.getMainLooper());
    private CalendarController mController;
    private float mLastX, mLastY;
    private float mHourScale = 1f;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTitle("Timeline");
        mController = CalendarController.getInstance(this);

        // base = local midnight today
        mBase.set(Calendar.HOUR_OF_DAY, 0);
        mBase.set(Calendar.MINUTE, 0);
        mBase.set(Calendar.SECOND, 0);
        mBase.set(Calendar.MILLISECOND, 0);

        mHourScale = HabitPrefs.getTimelineHourScale(this);

        final ListView list = new ListView(this);
        list.setId(android.R.id.list);
        list.setDivider(null);
        list.setDividerHeight(0);
        list.setAdapter(new DayAdapter());

        final ScaleGestureDetector scale = new ScaleGestureDetector(this,
                new ScaleGestureDetector.SimpleOnScaleGestureListener() {
                    @Override
                    public boolean onScale(ScaleGestureDetector d) {
                        mHourScale = Math.max(0.06f, Math.min(6f, mHourScale * d.getScaleFactor()));
                        applyHourScale(list);
                        return true;
                    }

                    @Override
                    public void onScaleEnd(ScaleGestureDetector d) {
                        HabitPrefs.setTimelineHourScale(HabitTimelineActivity.this, mHourScale);
                    }
                });

        list.setOnTouchListener((v, ev) -> {
            scale.onTouchEvent(ev);
            mLastX = ev.getX();
            mLastY = ev.getY();
            return scale.isInProgress();   // consume during pinch; otherwise let the list scroll
        });
        list.setOnItemClickListener((parent, view, position, id) -> {
            if (!(view instanceof HabitDayTimelineView)) return;
            HabitDayTimelineView dv = (HabitDayTimelineView) view;
            float localY = mLastY - view.getTop();
            Event e = dv.eventAt(mLastX, localY);
            if (e != null) {
                mController.sendEventRelatedEvent(this, EventType.VIEW_EVENT, e.id,
                        e.startMillis, e.endMillis, 0, 0, -1);
            } else {
                long t = dv.timeAt(localY);
                Intent base = mController.generateCreateEventIntent(t, t + HOUR_MS, false, null, -1);
                if (HabitPrefs.isEnabled(this)) {
                    HabitEventChooser.show(this, base);
                } else {
                    startActivity(base);
                }
            }
        });

        Toolbar bar = new Toolbar(this);
        bar.setTitle("Timeline");
        bar.setNavigationIcon(ws.xsoh.etar.R.drawable.ic_arrow_back);
        bar.setNavigationOnClickListener(v -> finish());

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.addView(bar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(list, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        setContentView(root);
        list.setSelection(START_OFFSET);   // start on today
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Refresh after returning from create/edit; rows reload lazily off-thread.
        mCache.clear();
        mReminderCache.clear();
        ListView lv = (ListView) findViewById(android.R.id.list);
        if (lv != null && lv.getAdapter() instanceof BaseAdapter) {
            ((BaseAdapter) lv.getAdapter()).notifyDataSetChanged();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        mExec.shutdownNow();
    }

    private void applyHourScale(ListView list) {
        for (int i = 0; i < list.getChildCount(); i++) {
            View c = list.getChildAt(i);
            if (c instanceof HabitDayTimelineView) {
                ((HabitDayTimelineView) c).setHourScale(mHourScale);
            }
        }
    }

    private long dayStartFor(int position) {
        Calendar c = (Calendar) mBase.clone();
        c.add(Calendar.DAY_OF_YEAR, position - START_OFFSET);
        return c.getTimeInMillis();
    }

    /** Load one day's events off the UI thread, then bind if the row still shows it. */
    private void loadInto(final HabitDayTimelineView view, final int position, final long dayStart) {
        mExec.execute(() -> {
            final ArrayList<Event> evs = new ArrayList<>();
            try {
                int gmtOff = (int) (TimeZone.getDefault().getOffset(dayStart) / 1000);
                int jd = Time.getJulianDay(dayStart, gmtOff);
                Event.loadEvents(HabitTimelineActivity.this, evs, jd, 1, 0, new AtomicInteger(0));
            } catch (Exception ignored) {
            }
            final Map<Long, int[]> rem = loadReminders(evs);
            mMain.post(() -> {
                mCache.put(position, evs);
                mReminderCache.put(position, rem);
                trimCaches(position);
                Object tag = view.getTag();
                if (tag instanceof Integer && (Integer) tag == position) {
                    view.setDay(dayStart, evs, rem);
                }
            });
        });
    }

    /** Keep caches bounded to a window around the current scroll position. */
    private void trimCaches(int center) {
        removeFar(mCache, center);
        removeFar(mReminderCache, center);
    }

    private static <T> void removeFar(SparseArray<T> a, int center) {
        for (int i = a.size() - 1; i >= 0; i--) {
            if (Math.abs(a.keyAt(i) - center) > 120) {
                a.removeAt(i);
            }
        }
    }

    /** Query reminders for the given events; map event id -> minutes-before, desc. */
    private Map<Long, int[]> loadReminders(ArrayList<Event> events) {
        HashMap<Long, int[]> out = new HashMap<>();
        if (events.isEmpty()) return out;
        StringBuilder ids = new StringBuilder();
        java.util.HashSet<Long> seen = new java.util.HashSet<>();
        for (Event e : events) {
            if (e.allDay || !seen.add(e.id)) continue;
            if (ids.length() > 0) ids.append(',');
            ids.append(e.id);
        }
        if (ids.length() == 0) return out;
        HashMap<Long, java.util.TreeSet<Integer>> tmp = new HashMap<>();
        Cursor c = null;
        try {
            c = getContentResolver().query(CalendarContract.Reminders.CONTENT_URI,
                    new String[]{CalendarContract.Reminders.EVENT_ID, CalendarContract.Reminders.MINUTES},
                    CalendarContract.Reminders.EVENT_ID + " IN (" + ids + ")", null, null);
            if (c != null) {
                while (c.moveToNext()) {
                    long id = c.getLong(0);
                    int min = c.getInt(1);
                    if (min < 0) min = 10;        // default-reminder sentinel
                    if (min <= 0) continue;
                    java.util.TreeSet<Integer> set = tmp.get(id);
                    if (set == null) {
                        set = new java.util.TreeSet<>();
                        tmp.put(id, set);
                    }
                    set.add(min);
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        for (Map.Entry<Long, java.util.TreeSet<Integer>> en : tmp.entrySet()) {
            // descending: earliest (largest minutes) first
            int[] arr = new int[en.getValue().size()];
            int k = arr.length - 1;
            for (int m : en.getValue()) arr[k--] = m;
            out.put(en.getKey(), arr);
        }
        return out;
    }

    private class DayAdapter extends BaseAdapter {
        @Override public int getCount() { return COUNT; }
        @Override public Object getItem(int position) { return position; }
        @Override public long getItemId(int position) { return position; }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            HabitDayTimelineView v = (convertView instanceof HabitDayTimelineView)
                    ? (HabitDayTimelineView) convertView
                    : new HabitDayTimelineView(HabitTimelineActivity.this);
            long dayStart = dayStartFor(position);
            v.setTag(position);
            v.setHourScale(mHourScale);
            ArrayList<Event> cached = mCache.get(position);
            if (cached != null) {
                v.setDay(dayStart, cached, mReminderCache.get(position));
            } else {
                v.setDay(dayStart, null, null);     // bind empty now, load off-thread
                loadInto(v, position, dayStart);
            }
            return v;
        }
    }
}
