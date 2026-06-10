/*
 * HABIT task layer - local metadata store.
 *
 * Maps eventId -> habit metadata using SharedPreferences with a JSON blob.
 * This is intentionally a single self-contained class so the HABIT layer
 * stays decoupled from Etar's stock calendar code.
 */
package com.android.calendar.habit;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Tiny persistent store for the HABIT task layer.
 *
 * Each event that the user marks with a task type gets an {@link Entry}
 * keyed by its CalendarProvider event id.
 */
public class HabitStore {

    // Task types.
    public static final String TYPE_FIXED = "fixed";
    public static final String TYPE_CONTINUOUS = "continuous";
    public static final String TYPE_DYNAMIC = "dynamic";

    // Reminder cadences.
    public static final String CADENCE_D2D = "D2D";
    public static final String CADENCE_W2W = "W2W";
    public static final String CADENCE_M2M = "M2M";

    private static final String PREFS_NAME = "habit_store";
    private static final String KEY_DATA = "data";

    private static HabitStore sInstance;

    private final SharedPreferences mPrefs;

    public static class Entry {
        public long eventId;
        public String type = TYPE_FIXED;
        public String cadence = CADENCE_D2D;
        public long originalDtstart;
        public int postponeCount;
        public boolean done;
        public long doneAt;
        /** Clean original title (without auto-prolong suffix / continuous prefix). */
        public String originalTitle;

        JSONObject toJson() throws JSONException {
            JSONObject o = new JSONObject();
            o.put("eventId", eventId);
            o.put("type", type);
            o.put("cadence", cadence);
            o.put("originalDtstart", originalDtstart);
            o.put("postponeCount", postponeCount);
            o.put("done", done);
            o.put("doneAt", doneAt);
            if (originalTitle != null) {
                o.put("originalTitle", originalTitle);
            }
            return o;
        }

        static Entry fromJson(JSONObject o) {
            Entry e = new Entry();
            e.eventId = o.optLong("eventId", -1);
            e.type = o.optString("type", TYPE_FIXED);
            e.cadence = o.optString("cadence", CADENCE_D2D);
            e.originalDtstart = o.optLong("originalDtstart", 0);
            e.postponeCount = o.optInt("postponeCount", 0);
            e.done = o.optBoolean("done", false);
            e.doneAt = o.optLong("doneAt", 0);
            e.originalTitle = o.has("originalTitle") ? o.optString("originalTitle", null) : null;
            return e;
        }
    }

    private HabitStore(Context context) {
        mPrefs = context.getApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static synchronized HabitStore getInstance(Context context) {
        if (sInstance == null) {
            sInstance = new HabitStore(context);
        }
        return sInstance;
    }

    private JSONObject readAll() {
        String raw = mPrefs.getString(KEY_DATA, null);
        if (raw == null) {
            return new JSONObject();
        }
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private void writeAll(JSONObject all) {
        mPrefs.edit().putString(KEY_DATA, all.toString()).apply();
    }

    public synchronized Entry get(long eventId) {
        JSONObject all = readAll();
        JSONObject o = all.optJSONObject(Long.toString(eventId));
        if (o == null) {
            return null;
        }
        Entry e = Entry.fromJson(o);
        e.eventId = eventId;
        return e;
    }

    public synchronized void put(Entry entry) {
        JSONObject all = readAll();
        try {
            all.put(Long.toString(entry.eventId), entry.toJson());
            writeAll(all);
        } catch (JSONException ignored) {
        }
    }

    public synchronized void remove(long eventId) {
        JSONObject all = readAll();
        all.remove(Long.toString(eventId));
        writeAll(all);
    }

    public synchronized List<Entry> getAll() {
        List<Entry> out = new ArrayList<>();
        JSONObject all = readAll();
        Iterator<String> keys = all.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            JSONObject o = all.optJSONObject(key);
            if (o == null) {
                continue;
            }
            Entry e = Entry.fromJson(o);
            try {
                e.eventId = Long.parseLong(key);
            } catch (NumberFormatException nfe) {
                continue;
            }
            out.add(e);
        }
        return out;
    }

    /** Convenience to mark an event done now. */
    public synchronized void markDone(long eventId, boolean done, long doneAt) {
        Entry e = get(eventId);
        if (e == null) {
            e = new Entry();
            e.eventId = eventId;
        }
        e.done = done;
        e.doneAt = done ? doneAt : 0;
        put(e);
    }

    /** Reminder presets (minutes-before-start) for a given cadence. */
    public static int[] reminderPresetsFor(String cadence) {
        if (CADENCE_W2W.equals(cadence)) {
            return new int[] {720, 1440, 2880, 4320, 7200};
        } else if (CADENCE_M2M.equals(cadence)) {
            return new int[] {4320, 7200, 10080, 20160, 30240};
        }
        // D2D default
        return new int[] {15, 60, 120, 240};
    }
}
