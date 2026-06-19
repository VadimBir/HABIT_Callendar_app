/*
 * HABIT custom feature preferences.
 *
 * Cadence is chosen per-event on the edit screen (Std / D2D / W2W / M2M); this
 * helper resolves the default reminder lead-time (in minutes) for each cadence,
 * which the user can change in Settings -> HABIT features.
 */
package com.android.calendar.settings;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class HabitPrefs {

    public static final String KEY_ENABLED = "pref_habit_enabled";
    public static final String KEY_DYNAMIC_DEFAULT = "pref_habit_dynamic_default";
    public static final String KEY_SEAMLESS_SCROLL = "pref_habit_seamless_scroll";

    // Cadence index: 0 = Std, 1 = D2D, 2 = W2W, 3 = M2M
    public static final int CADENCE_STD = 0;
    public static final int CADENCE_D2D = 1;
    public static final int CADENCE_W2W = 2;
    public static final int CADENCE_M2M = 3;

    private static final String[] CADENCE_KEYS = {
            "pref_habit_cadence_std",
            "pref_habit_cadence_d2d",
            "pref_habit_cadence_w2w",
            "pref_habit_cadence_m2m"
    };

    // Sensible defaults (minutes before the event): 10 min, 1 day, 1 week, 30 days.
    private static final int[] CADENCE_DEFAULTS = {10, 1440, 10080, 43200};

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(
                GeneralPreferences.SHARED_PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, true);
    }

    public static boolean isDynamicByDefault(Context context) {
        return prefs(context).getBoolean(KEY_DYNAMIC_DEFAULT, false);
    }

    public static boolean isSeamlessScroll(Context context) {
        return prefs(context).getBoolean(KEY_SEAMLESS_SCROLL, true);
    }

    /** Default reminder lead-time in minutes for the given cadence index. */
    public static int getCadenceDefaultMinutes(Context context, int cadence) {
        if (cadence < 0 || cadence >= CADENCE_KEYS.length) {
            cadence = CADENCE_STD;
        }
        String raw = prefs(context).getString(CADENCE_KEYS[cadence], null);
        if (raw == null) {
            return CADENCE_DEFAULTS[cadence];
        }
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException e) {
            return CADENCE_DEFAULTS[cadence];
        }
    }

    // ----- Reminder presets (built-in D2D/W2W/M2M + user-defined) -----

    private static final String KEY_CUSTOM_PRESETS = "pref_habit_custom_presets";

    /** A named reminder preset: a label plus the reminder lead-times it sets. */
    public static class Preset {
        public final String name;
        public final int[] minutes;

        public Preset(String name, int[] minutes) {
            this.name = name;
            this.minutes = minutes;
        }
    }

    /**
     * All presets shown in the new-event chooser and the preset manager. Fully
     * user-editable: on first use the store is seeded with D2D/W2W/M2M, after
     * which everything (add/edit/delete/rename, any number of reminders each)
     * lives in the same JSON store.
     */
    public static List<Preset> getPresets(Context context) {
        List<Preset> list = getCustomPresets(context);
        if (list.isEmpty()) {
            list = defaultPresets();
            saveCustomPresets(context, list);
        }
        return list;
    }

    private static List<Preset> defaultPresets() {
        List<Preset> l = new ArrayList<>();
        l.add(new Preset("D2D", new int[]{1440}));    // 1 day before
        l.add(new Preset("W2W", new int[]{10080}));   // 1 week before
        l.add(new Preset("M2M", new int[]{43200}));   // 30 days before
        return l;
    }

    /** User-defined presets, stored as JSON: [{"name":..,"minutes":[..]}, ...]. */
    public static List<Preset> getCustomPresets(Context context) {
        List<Preset> list = new ArrayList<>();
        String json = prefs(context).getString(KEY_CUSTOM_PRESETS, null);
        if (json == null) {
            return list;
        }
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                String name = o.optString("name", "Preset");
                JSONArray m = o.optJSONArray("minutes");
                int[] minutes = new int[m == null ? 0 : m.length()];
                for (int j = 0; j < minutes.length; j++) {
                    minutes[j] = m.getInt(j);
                }
                list.add(new Preset(name, minutes));
            }
        } catch (Exception e) {
            // Corrupt JSON -> ignore custom presets.
        }
        return list;
    }

    /** Persist the full list of user-defined presets. */
    public static void saveCustomPresets(Context context, List<Preset> presets) {
        JSONArray arr = new JSONArray();
        try {
            for (Preset p : presets) {
                JSONObject o = new JSONObject();
                o.put("name", p.name);
                JSONArray m = new JSONArray();
                for (int v : p.minutes) {
                    m.put(v);
                }
                o.put("minutes", m);
                arr.put(o);
            }
        } catch (Exception e) {
            return;
        }
        prefs(context).edit().putString(KEY_CUSTOM_PRESETS, arr.toString()).apply();
    }
}
