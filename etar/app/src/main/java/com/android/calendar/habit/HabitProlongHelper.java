/*
 * HABIT task layer - auto-prolong / roll-forward service.
 *
 * Invoked from AllInOneActivity.onResume(). For every HabitStore entry:
 *   (a) dynamic & not done & event already ended  -> shift DTSTART/DTEND
 *       forward by the cadence step until it ends in the future, bumping
 *       postponeCount and rewriting the title with a "(+XX days)" suffix.
 *   (b) continuous & not done & event already ended -> roll DTEND forward
 *       to end of today so it keeps appearing as ongoing.
 * Entries whose event no longer exists in the provider are cleaned up.
 */
package com.android.calendar.habit;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.util.Log;

import java.util.Calendar;
import java.util.List;
import java.util.concurrent.TimeUnit;

public class HabitProlongHelper {

    private static final String TAG = "HabitProlong";

    public static final String CONTINUOUS_PREFIX = "⟳ "; // "⟳ "

    private HabitProlongHelper() {
    }

    /** Run the prolong / roll-forward pass. Safe to call repeatedly. */
    public static void run(Context context) {
        if (context == null) {
            return;
        }
        HabitStore store = HabitStore.getInstance(context);
        ContentResolver cr = context.getContentResolver();
        long now = System.currentTimeMillis();

        List<HabitStore.Entry> entries = store.getAll();
        for (HabitStore.Entry e : entries) {
            try {
                processEntry(cr, store, e, now);
            } catch (SecurityException se) {
                // Missing WRITE_CALENDAR - bail quietly for this pass.
                Log.w(TAG, "No calendar permission, skipping prolong", se);
                return;
            } catch (Exception ex) {
                Log.w(TAG, "Failed to process habit entry " + e.eventId, ex);
            }
        }
    }

    private static void processEntry(ContentResolver cr, HabitStore store,
            HabitStore.Entry e, long now) {
        Uri uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, e.eventId);
        long[] times = readStartEnd(cr, uri);
        if (times == null) {
            // Event deleted from provider - clean up the store.
            store.remove(e.eventId);
            return;
        }
        long dtstart = times[0];
        long dtend = times[1];

        if (e.done) {
            return;
        }
        if (dtend >= now) {
            return; // Still in the future / ongoing.
        }

        if (HabitStore.TYPE_DYNAMIC.equals(e.type)) {
            prolongDynamic(cr, store, e, uri, dtstart, dtend, now);
        } else if (HabitStore.TYPE_CONTINUOUS.equals(e.type)) {
            rollContinuous(cr, uri, dtstart, dtend, now);
        }
    }

    private static void prolongDynamic(ContentResolver cr, HabitStore store, HabitStore.Entry e,
            Uri uri, long dtstart, long dtend, long now) {
        long newStart = dtstart;
        long newEnd = dtend;
        int steps = 0;
        // Cap iterations defensively (e.g. ~10 years of daily steps).
        while (newEnd < now && steps < 4000) {
            newStart = step(newStart, e.cadence);
            newEnd = step(newEnd, e.cadence);
            steps++;
        }
        if (steps == 0) {
            return;
        }
        e.postponeCount += steps;

        ContentValues values = new ContentValues();
        values.put(CalendarContract.Events.DTSTART, newStart);
        values.put(CalendarContract.Events.DTEND, newEnd);

        // Rebuild title from the stored clean original so the suffix never stacks.
        if (e.originalTitle != null) {
            long base = e.originalDtstart != 0 ? e.originalDtstart : dtstart;
            long days = TimeUnit.MILLISECONDS.toDays(newStart - base);
            String title = e.originalTitle + " (+" + days + " days)";
            values.put(CalendarContract.Events.TITLE, title);
        }
        cr.update(uri, values, null, null);
        store.put(e);
    }

    private static void rollContinuous(ContentResolver cr, Uri uri,
            long dtstart, long dtend, long now) {
        long endOfToday = endOfToday(now);
        if (endOfToday <= dtend) {
            return;
        }
        ContentValues values = new ContentValues();
        // Keep dtstart as-is; just extend the end so it still reads as ongoing.
        values.put(CalendarContract.Events.DTEND, endOfToday);
        cr.update(uri, values, null, null);
    }

    /** Returns {dtstart, dtend} or null if the event doesn't exist. */
    private static long[] readStartEnd(ContentResolver cr, Uri uri) {
        Cursor c = null;
        try {
            c = cr.query(uri, new String[] {
                    CalendarContract.Events.DTSTART,
                    CalendarContract.Events.DTEND,
                    CalendarContract.Events.DELETED,
            }, null, null, null);
            if (c == null || !c.moveToFirst()) {
                return null;
            }
            if (!c.isNull(2) && c.getInt(2) == 1) {
                return null;
            }
            if (c.isNull(0)) {
                return null;
            }
            long start = c.getLong(0);
            long end = c.isNull(1) ? start : c.getLong(1);
            return new long[] {start, end};
        } finally {
            if (c != null) {
                c.close();
            }
        }
    }

    private static long step(long millis, String cadence) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(millis);
        if (HabitStore.CADENCE_W2W.equals(cadence)) {
            cal.add(Calendar.DAY_OF_MONTH, 7);
        } else if (HabitStore.CADENCE_M2M.equals(cadence)) {
            cal.add(Calendar.MONTH, 1);
        } else {
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }
        return cal.getTimeInMillis();
    }

    private static long endOfToday(long now) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(now);
        cal.set(Calendar.HOUR_OF_DAY, 23);
        cal.set(Calendar.MINUTE, 59);
        cal.set(Calendar.SECOND, 59);
        cal.set(Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }
}
