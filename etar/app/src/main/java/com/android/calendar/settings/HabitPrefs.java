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
}
