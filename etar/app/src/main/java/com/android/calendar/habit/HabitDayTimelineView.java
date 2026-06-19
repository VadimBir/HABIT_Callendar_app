/*
 * HABIT: a single day rendered as a vertical time column (00:00 at top ->
 * 24:00 at bottom), with events drawn as horizontal chunks positioned by time.
 * Stacked by HabitTimelineActivity inside a ListView to form a continuous,
 * infinitely-scrolling vertical timeline (top = past, bottom = future).
 *
 * The view does no touch handling itself; the hosting ListView detects taps and
 * calls eventAt()/timeAt() with local coordinates.
 */
package com.android.calendar.habit;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.view.View;

import com.android.calendar.Event;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class HabitDayTimelineView extends View {

    private static final long HOUR_MS = 3600000L;
    private static final long DAY_MS = 86400000L;

    private final float density;
    private final float headerH;
    private final float hourH;
    private final float gutterW;
    private final float minEventH;
    private final float pad;

    private final Paint mLinePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint mHourTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint mHeaderTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint mEventPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint mEventTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint mNowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint mHeaderBgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

    private long mDayStart;
    private String mLabel = "";
    private boolean mIsToday;
    private int mAllDayCount;
    private final List<Event> mEvents = new ArrayList<>();

    private static class Cell {
        final RectF rect;
        final Event event;
        Cell(RectF r, Event e) { rect = r; event = e; }
    }
    private final List<Cell> mCells = new ArrayList<>();
    private final SimpleDateFormat mFmt = new SimpleDateFormat("EEE, MMM d", Locale.getDefault());

    public HabitDayTimelineView(Context context) {
        super(context);
        density = getResources().getDisplayMetrics().density;
        headerH = 26 * density;
        hourH = 56 * density;
        gutterW = 42 * density;
        minEventH = 16 * density;
        pad = 3 * density;

        boolean dark = (getResources().getConfiguration().uiMode
                & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        int onSurface = dark ? 0xFFE0E0E0 : 0xFF3C4043;
        int faint = dark ? 0x33FFFFFF : 0x22000000;

        mLinePaint.setColor(faint);
        mLinePaint.setStrokeWidth(Math.max(1f, density));
        mHourTextPaint.setColor(dark ? 0xFF9AA0A6 : 0xFF70757A);
        mHourTextPaint.setTextSize(11 * density);
        mHeaderTextPaint.setColor(onSurface);
        mHeaderTextPaint.setTextSize(13 * density);
        mHeaderTextPaint.setTypeface(Typeface.DEFAULT_BOLD);
        mHeaderBgPaint.setColor(dark ? 0x22FFFFFF : 0x0A000000);
        mEventTextPaint.setColor(Color.WHITE);
        mEventTextPaint.setTextSize(12 * density);
        mNowPaint.setColor(0xFFEA4335);
        mNowPaint.setStrokeWidth(2 * density);
    }

    public void setDay(long dayStartMillis, List<Event> events) {
        mDayStart = dayStartMillis;
        mLabel = mFmt.format(new Date(dayStartMillis));
        long now = System.currentTimeMillis();
        mIsToday = now >= dayStartMillis && now < dayStartMillis + DAY_MS;
        mEvents.clear();
        if (events != null) {
            mEvents.addAll(events);
        }
        mAllDayCount = 0;
        for (Event e : mEvents) {
            if (e.allDay) mAllDayCount++;
        }
        requestLayout();
        invalidate();
    }

    private float allDayBandH() {
        return mAllDayCount > 0 ? mAllDayCount * (minEventH * 1.5f) + pad : 0;
    }

    private float gridTop() {
        return headerH + allDayBandH();
    }

    private int totalHeight() {
        return (int) (gridTop() + 24 * hourH);
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        int w = MeasureSpec.getSize(widthMeasureSpec);
        setMeasuredDimension(w, totalHeight());
    }

    /** Returns the event drawn at (x,y) in local coords, or null. */
    public Event eventAt(float x, float y) {
        for (int i = mCells.size() - 1; i >= 0; i--) {
            if (mCells.get(i).rect.contains(x, y)) {
                return mCells.get(i).event;
            }
        }
        return null;
    }

    /** Returns the wall-clock millis corresponding to vertical position y. */
    public long timeAt(float y) {
        float rel = y - gridTop();
        if (rel < 0) rel = 0;
        long ms = (long) (rel / hourH * HOUR_MS);
        if (ms < 0) ms = 0;
        if (ms > DAY_MS - 1) ms = DAY_MS - 1;
        // snap to 30 min
        long half = HOUR_MS / 2;
        ms = (ms / half) * half;
        return mDayStart + ms;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        mCells.clear();
        float w = getWidth();
        float gridTop = gridTop();

        // Header
        canvas.drawRect(0, 0, w, headerH, mHeaderBgPaint);
        canvas.drawText(mLabel, gutterW * 0.2f, headerH * 0.68f, mHeaderTextPaint);
        canvas.drawLine(0, headerH, w, headerH, mLinePaint);

        // Hour grid + labels
        for (int h = 0; h <= 24; h++) {
            float y = gridTop + h * hourH;
            canvas.drawLine(gutterW, y, w, y, mLinePaint);
            if (h < 24) {
                canvas.drawText(String.format(Locale.US, "%02d:00", h),
                        4 * density, y + 12 * density, mHourTextPaint);
            }
        }

        // Timed events with simple overlap-column packing
        List<Event> timed = new ArrayList<>();
        for (Event e : mEvents) {
            if (!e.allDay) {
                timed.add(e);
            }
        }
        Collections.sort(timed, new Comparator<Event>() {
            public int compare(Event a, Event b) {
                return Long.compare(a.startMillis, b.startMillis);
            }
        });

        float availLeft = gutterW + pad;
        float availRight = w - pad;
        float availW = availRight - availLeft;
        long dayEnd = mDayStart + DAY_MS;

        int i = 0;
        while (i < timed.size()) {
            // build a cluster of mutually-overlapping events
            int j = i;
            long clusterEnd = clampEnd(timed.get(i), dayEnd);
            List<Event> cluster = new ArrayList<>();
            cluster.add(timed.get(i));
            j++;
            while (j < timed.size() && timed.get(j).startMillis < clusterEnd) {
                cluster.add(timed.get(j));
                clusterEnd = Math.max(clusterEnd, clampEnd(timed.get(j), dayEnd));
                j++;
            }
            // assign columns greedily
            List<Long> colEnd = new ArrayList<>();
            int[] colOf = new int[cluster.size()];
            for (int k = 0; k < cluster.size(); k++) {
                Event e = cluster.get(k);
                long s = Math.max(e.startMillis, mDayStart);
                int assigned = -1;
                for (int c = 0; c < colEnd.size(); c++) {
                    if (colEnd.get(c) <= s) { assigned = c; colEnd.set(c, clampEnd(e, dayEnd)); break; }
                }
                if (assigned < 0) { assigned = colEnd.size(); colEnd.add(clampEnd(e, dayEnd)); }
                colOf[k] = assigned;
            }
            int cols = Math.max(1, colEnd.size());
            float colW = availW / cols;
            for (int k = 0; k < cluster.size(); k++) {
                drawEvent(canvas, cluster.get(k), dayEnd,
                        availLeft + colOf[k] * colW, colW);
            }
            i = j;
        }

        // All-day events as chips under the header
        float ax = gutterW + pad;
        float ay = headerH + pad;
        for (Event e : mEvents) {
            if (!e.allDay) continue;
            RectF r = new RectF(ax, ay, w - pad, ay + minEventH * 1.4f);
            mEventPaint.setColor(0xFF000000 | e.color);
            canvas.drawRoundRect(r, 4 * density, 4 * density, mEventPaint);
            canvas.drawText(safe(e.title), r.left + 4 * density, r.top + 12 * density, mEventTextPaint);
            mCells.add(new Cell(new RectF(r), e));
            ay += minEventH * 1.5f;
        }

        // Now-line (once, only on today; works even with no events)
        if (mIsToday) {
            long now = System.currentTimeMillis();
            float ny = gridTop + (now - mDayStart) / (float) HOUR_MS * hourH;
            canvas.drawLine(gutterW, ny, w, ny, mNowPaint);
        }
    }

    private long clampEnd(Event e, long dayEnd) {
        long end = Math.min(e.endMillis, dayEnd);
        long start = Math.max(e.startMillis, mDayStart);
        if (end < start + HOUR_MS / 4) end = start + HOUR_MS / 4; // ensure visible
        return end;
    }

    private void drawEvent(Canvas canvas, Event e, long dayEnd, float left, float width) {
        long s = Math.max(e.startMillis, mDayStart);
        long en = Math.min(e.endMillis, dayEnd);
        if (en <= s) en = s + HOUR_MS / 4;
        float gt = gridTop();
        float top = gt + (s - mDayStart) / (float) HOUR_MS * hourH;
        float bottom = gt + (en - mDayStart) / (float) HOUR_MS * hourH;
        if (bottom - top < minEventH) bottom = top + minEventH;
        RectF r = new RectF(left, top + 1, left + width - 2 * density, bottom - 1);
        mEventPaint.setColor(0xFF000000 | e.color);
        canvas.drawRoundRect(r, 4 * density, 4 * density, mEventPaint);
        canvas.save();
        canvas.clipRect(r);
        canvas.drawText(safe(e.title), r.left + 4 * density, r.top + 13 * density, mEventTextPaint);
        canvas.restore();
        mCells.add(new Cell(new RectF(r), e));
    }

    private String safe(CharSequence s) { return s == null ? "(no title)" : s.toString(); }
}
