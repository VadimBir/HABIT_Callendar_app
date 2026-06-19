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
import android.os.Bundle;
import android.util.SparseArray;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.BaseAdapter;
import android.widget.ListView;

import com.android.calendar.CalendarController;
import com.android.calendar.CalendarController.EventType;
import com.android.calendar.Event;
import com.android.calendar.HabitEventChooser;
import com.android.calendar.calendarcommon2.Time;
import com.android.calendar.settings.HabitPrefs;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.TimeZone;
import java.util.concurrent.atomic.AtomicInteger;

public class HabitTimelineActivity extends Activity {

    private static final long DAY_MS = 86400000L;
    private static final long HOUR_MS = 3600000L;
    private static final int START_OFFSET = 180;   // days of history
    private static final int COUNT = START_OFFSET + 540;

    private final Calendar mBase = Calendar.getInstance();
    private final SparseArray<ArrayList<Event>> mCache = new SparseArray<>();
    private CalendarController mController;
    private float mLastX, mLastY;

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

        final ListView list = new ListView(this);
        list.setDivider(null);
        list.setDividerHeight(0);
        list.setAdapter(new DayAdapter());

        list.setOnTouchListener((v, ev) -> {
            mLastX = ev.getX();
            mLastY = ev.getY();
            return false;
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

        setContentView(list);
        list.setSelection(START_OFFSET);   // start on today
    }

    @Override
    protected void onResume() {
        super.onResume();
        mCache.clear();   // refresh events after returning from create/edit
    }

    private long dayStartFor(int position) {
        Calendar c = (Calendar) mBase.clone();
        c.add(Calendar.DAY_OF_YEAR, position - START_OFFSET);
        return c.getTimeInMillis();
    }

    private ArrayList<Event> eventsFor(int position, long dayStart) {
        ArrayList<Event> cached = mCache.get(position);
        if (cached != null) return cached;
        ArrayList<Event> evs = new ArrayList<>();
        int gmtOff = (int) (TimeZone.getDefault().getOffset(dayStart) / 1000);
        int jd = Time.getJulianDay(dayStart, gmtOff);
        try {
            Event.loadEvents(this, evs, jd, 1, 0, new AtomicInteger(0));
        } catch (Exception ignored) {
        }
        mCache.put(position, evs);
        return evs;
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
            v.setDay(dayStart, eventsFor(position, dayStart));
            return v;
        }
    }
}
