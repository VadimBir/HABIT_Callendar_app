/*
 * HABIT: shared reminder-trail helper.
 *
 * Loads reminders for a set of events and draws the "opacity + colour" trail
 * leading up to an event: a band per reminder, alpha stepping UP toward the
 * event and the hue rotating per reminder (nearest band = the event's colour).
 * Used by the Timeline and by the Day/Week grid (DayView).
 */
package com.android.calendar.habit;

import android.content.Context;
import android.database.Cursor;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.provider.CalendarContract;

import com.android.calendar.Event;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

public final class HabitTrail {

    private HabitTrail() { }

    /** Query reminders for the given events; map event id -> minutes-before, descending. */
    public static Map<Long, int[]> loadReminders(Context ctx, List<Event> events) {
        HashMap<Long, int[]> out = new HashMap<>();
        if (events == null || events.isEmpty()) return out;
        StringBuilder ids = new StringBuilder();
        HashSet<Long> seen = new HashSet<>();
        for (Event e : events) {
            if (e.allDay || !seen.add(e.id)) continue;
            if (ids.length() > 0) ids.append(',');
            ids.append(e.id);
        }
        if (ids.length() == 0) return out;
        HashMap<Long, TreeSet<Integer>> tmp = new HashMap<>();
        Cursor c = null;
        try {
            c = ctx.getContentResolver().query(CalendarContract.Reminders.CONTENT_URI,
                    new String[]{CalendarContract.Reminders.EVENT_ID, CalendarContract.Reminders.MINUTES},
                    CalendarContract.Reminders.EVENT_ID + " IN (" + ids + ")", null, null);
            if (c != null) {
                while (c.moveToNext()) {
                    long id = c.getLong(0);
                    int min = c.getInt(1);
                    if (min < 0) min = 10;          // default-reminder sentinel
                    if (min <= 0) continue;
                    TreeSet<Integer> set = tmp.get(id);
                    if (set == null) {
                        set = new TreeSet<>();
                        tmp.put(id, set);
                    }
                    set.add(min);
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        for (Map.Entry<Long, TreeSet<Integer>> en : tmp.entrySet()) {
            int[] arr = new int[en.getValue().size()];
            int k = arr.length - 1;                 // descending: earliest (largest) first
            for (int m : en.getValue()) arr[k--] = m;
            out.put(en.getKey(), arr);
        }
        return out;
    }

    /**
     * Draw the trail for one event into the vertical strip [left,right], ending at
     * the event's top (eventTopY) and rising upward at pxPerMin pixels per minute,
     * clamped so nothing is drawn above clipTopY. A minimum height keeps short
     * reminders visible. hsv/hsvBand are reusable 3-float scratch arrays.
     */
    public static void draw(Canvas canvas, Paint paint, float[] hsv, float[] hsvBand,
            int eventColor, int[] mins, float eventTopY, float clipTopY,
            float pxPerMin, float left, float right, float density) {
        if (mins == null || mins.length == 0) return;
        final int n = mins.length;
        final float LOW = 0.20f, HIGH = 0.90f;
        final float range = HIGH - LOW;
        final float band = range / n;
        final float gap = Math.min(0.05f, band * 0.4f);

        float maxVisMin = (eventTopY - clipTopY) / pxPerMin;
        if (maxVisMin <= 0) return;
        float firstMin = Math.min(mins[0], maxVisMin);
        float botY = eventTopY;
        float topY = eventTopY - firstMin * pxPerMin;       // == max(yAt(mins[0]), clipTopY)
        float minH = 30 * density;
        if (botY - topY < minH) topY = botY - minH;
        float spanMin = firstMin <= 0 ? 1f : firstMin;

        Color.colorToHSV(0xFF000000 | eventColor, hsv);
        for (int s = 0; s < n; s++) {
            float mTop = Math.min(mins[s], firstMin);
            float mBot = Math.min((s + 1 < n) ? mins[s + 1] : 0, firstMin);
            if (mTop <= mBot) continue;                     // band clipped away

            float yTop = topY + (firstMin - mTop) / spanMin * (botY - topY);
            float yBot = topY + (firstMin - mBot) / spanMin * (botY - topY);
            if (yBot <= yTop) continue;

            float h0 = hsv[0] - (n - 1 - s) * 32f;
            h0 %= 360f;
            if (h0 < 0) h0 += 360f;
            hsvBand[0] = h0;
            hsvBand[1] = hsv[1];
            hsvBand[2] = hsv[2];
            int rgb = Color.HSVToColor(hsvBand) & 0x00FFFFFF;

            float aTop = LOW + band * s;
            float aBot = aTop + band - gap;
            final int steps = 8;
            for (int q = 0; q < steps; q++) {
                float ya = yTop + (yBot - yTop) * q / steps;
                float yb = yTop + (yBot - yTop) * (q + 1) / steps;
                float a = aTop + (aBot - aTop) * (q + 0.5f) / steps;
                paint.setColor(colorAlpha(rgb, a));
                canvas.drawRect(left, ya, right, yb, paint);
            }
        }
    }

    public static int colorAlpha(int rgb, float alpha) {
        int a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
        return (a << 24) | (rgb & 0x00FFFFFF);
    }
}
