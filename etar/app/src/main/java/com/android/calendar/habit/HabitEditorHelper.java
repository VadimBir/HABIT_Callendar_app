/*
 * HABIT task layer - editor save integration.
 *
 * Etar saves new events through an async batch insert, so the new event id
 * is not available synchronously at save time. This helper:
 *   - applies cadence reminder presets onto the model before save (new events
 *     only), so they are written as real CalendarContract.Reminders;
 *   - applies the continuous-type title prefix;
 *   - resolves the event id after save (querying the provider for new events)
 *     and persists the habit metadata to HabitStore.
 */
package com.android.calendar.habit;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.provider.CalendarContract;
import android.text.TextUtils;
import android.util.Log;

import com.android.calendar.CalendarEventModel;
import com.android.calendar.CalendarEventModel.ReminderEntry;

import java.util.ArrayList;

public class HabitEditorHelper {

    private static final String TAG = "HabitEditor";

    private HabitEditorHelper() {
    }

    /**
     * Called just before saveEvent for a NEW event. Applies cadence reminder
     * presets (replacing existing reminders) and continuous title prefix.
     */
    public static void prepareNewEventModel(CalendarEventModel model, String type, String cadence) {
        if (model == null) {
            return;
        }
        // Apply cadence reminder presets as real reminders.
        int[] presets = HabitStore.reminderPresetsFor(cadence);
        ArrayList<ReminderEntry> reminders = new ArrayList<>();
        for (int minutes : presets) {
            reminders.add(ReminderEntry.valueOf(minutes));
        }
        model.mReminders = reminders;
        model.mHasAlarm = !reminders.isEmpty();

        // Continuous: make it visibly different with a prefix; keep dtend = start + 1h.
        if (HabitStore.TYPE_CONTINUOUS.equals(type)) {
            if (!TextUtils.isEmpty(model.mTitle)
                    && !model.mTitle.startsWith(HabitProlongHelper.CONTINUOUS_PREFIX)) {
                model.mTitle = HabitProlongHelper.CONTINUOUS_PREFIX + model.mTitle;
            }
            long start = System.currentTimeMillis();
            model.mStart = start;
            model.mEnd = start + 60L * 60L * 1000L;
        }
    }

    /**
     * Persist habit metadata after a save. For new events the id is resolved by
     * querying the provider for the matching event.
     */
    public static void persistAfterSave(Context context, CalendarEventModel model,
            boolean isNewEvent, String type, String cadence) {
        if (context == null || model == null) {
            return;
        }
        // Fixed + D2D default with no special handling: still record so the task
        // panel and prolong service can see it. (Cheap, and lets DONE work.)
        long eventId = model.mId;
        if (isNewEvent || eventId <= 0) {
            eventId = resolveNewEventId(context, model);
        }
        if (eventId <= 0) {
            Log.w(TAG, "Could not resolve event id for habit metadata");
            return;
        }

        HabitStore store = HabitStore.getInstance(context);
        HabitStore.Entry entry = store.get(eventId);
        if (entry == null) {
            entry = new HabitStore.Entry();
            entry.eventId = eventId;
        }
        entry.type = type;
        entry.cadence = cadence;
        if (entry.originalDtstart == 0) {
            entry.originalDtstart = model.mStart;
        }
        // Store the clean title (strip continuous prefix) so suffixes never stack.
        String clean = model.mTitle == null ? "" : model.mTitle;
        if (clean.startsWith(HabitProlongHelper.CONTINUOUS_PREFIX)) {
            clean = clean.substring(HabitProlongHelper.CONTINUOUS_PREFIX.length());
        }
        entry.originalTitle = clean;
        store.put(entry);
    }

    /** Best-effort lookup of the just-inserted event id. */
    private static long resolveNewEventId(Context context, CalendarEventModel model) {
        ContentResolver cr = context.getContentResolver();
        String title = model.mTitle;
        String selection;
        String[] args;
        if (!TextUtils.isEmpty(title)) {
            selection = CalendarContract.Events.TITLE + "=? AND "
                    + CalendarContract.Events.DTSTART + "=?";
            args = new String[] {title, Long.toString(model.mStart)};
        } else {
            selection = CalendarContract.Events.DTSTART + "=?";
            args = new String[] {Long.toString(model.mStart)};
        }
        Cursor c = null;
        try {
            c = cr.query(CalendarContract.Events.CONTENT_URI,
                    new String[] {CalendarContract.Events._ID},
                    selection, args, CalendarContract.Events._ID + " DESC");
            if (c != null && c.moveToFirst()) {
                return c.getLong(0);
            }
        } catch (SecurityException se) {
            Log.w(TAG, "No calendar permission resolving event id", se);
        } finally {
            if (c != null) {
                c.close();
            }
        }
        return -1;
    }

    /** Apply continuous prefix when updating an existing event to continuous. */
    public static void applyTitlePrefixForExisting(Context context, long eventId, String type,
            String currentTitle) {
        if (context == null || eventId <= 0) {
            return;
        }
        if (!HabitStore.TYPE_CONTINUOUS.equals(type)) {
            return;
        }
        if (currentTitle != null && currentTitle.startsWith(HabitProlongHelper.CONTINUOUS_PREFIX)) {
            return;
        }
        ContentValues values = new ContentValues();
        values.put(CalendarContract.Events.TITLE,
                HabitProlongHelper.CONTINUOUS_PREFIX + (currentTitle == null ? "" : currentTitle));
        try {
            cr(context).update(
                    android.content.ContentUris.withAppendedId(
                            CalendarContract.Events.CONTENT_URI, eventId),
                    values, null, null);
        } catch (SecurityException ignored) {
        }
    }

    private static ContentResolver cr(Context c) {
        return c.getContentResolver();
    }
}
