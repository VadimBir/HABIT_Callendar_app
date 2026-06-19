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
import android.content.res.Configuration;

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

    // ----- Event-screen text scale (preview + editor) -----

    public static final String KEY_EVENT_TEXT_SCALE = "pref_habit_event_text_scale";

    /** Font scale for the event preview/edit screens (1.0 = default). */
    public static float getEventTextScale(Context context) {
        String raw = prefs(context).getString(KEY_EVENT_TEXT_SCALE, "1.0");
        try {
            return Float.parseFloat(raw);
        } catch (NumberFormatException e) {
            return 1f;
        }
    }

    /**
     * Wrap a base context with the user's event-screen font scale. Used from
     * attachBaseContext of the event preview and edit activities so only those
     * screens shrink, not the whole calendar.
     */
    public static final String KEY_TIMELINE_HOUR_SCALE = "pref_habit_timeline_hour_scale";

    public static float getTimelineHourScale(Context context) {
        return prefs(context).getFloat(KEY_TIMELINE_HOUR_SCALE, 1f);
    }

    public static void setTimelineHourScale(Context context, float scale) {
        prefs(context).edit().putFloat(KEY_TIMELINE_HOUR_SCALE, scale).apply();
    }

    public static Context wrapWithScale(Context base) {
        float scale = getEventTextScale(base);
        if (scale == 1f) {
            return base;
        }
        Configuration config = new Configuration(base.getResources().getConfiguration());
        config.fontScale = config.fontScale * scale;
        return base.createConfigurationContext(config);
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

    // ----- Templates (deep-copyable events) -----

    private static final String KEY_TEMPLATES = "pref_habit_templates";

    /** A reusable event template: a deep copy of an event's key fields. */
    public static class Template {
        public final String title;
        public final String description;
        public final String location;
        public final long durationMinutes;
        public final boolean allDay;
        public final int[] minutes;

        public Template(String title, String description, String location,
                        long durationMinutes, boolean allDay, int[] minutes) {
            this.title = title == null ? "" : title;
            this.description = description == null ? "" : description;
            this.location = location == null ? "" : location;
            this.durationMinutes = durationMinutes;
            this.allDay = allDay;
            this.minutes = minutes == null ? new int[0] : minutes;
        }
    }

    public static List<Template> getTemplates(Context context) {
        List<Template> list = new ArrayList<>();
        String json = prefs(context).getString(KEY_TEMPLATES, null);
        if (json == null) {
            return list;
        }
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                JSONArray m = o.optJSONArray("minutes");
                int[] minutes = new int[m == null ? 0 : m.length()];
                for (int j = 0; j < minutes.length; j++) {
                    minutes[j] = m.getInt(j);
                }
                list.add(new Template(
                        o.optString("title", ""),
                        o.optString("description", ""),
                        o.optString("location", ""),
                        o.optLong("durationMinutes", 60),
                        o.optBoolean("allDay", false),
                        minutes));
            }
        } catch (Exception e) {
            // ignore
        }
        return list;
    }

    public static void saveTemplates(Context context, List<Template> templates) {
        JSONArray arr = new JSONArray();
        try {
            for (Template t : templates) {
                JSONObject o = new JSONObject();
                o.put("title", t.title);
                o.put("description", t.description);
                o.put("location", t.location);
                o.put("durationMinutes", t.durationMinutes);
                o.put("allDay", t.allDay);
                JSONArray m = new JSONArray();
                for (int v : t.minutes) {
                    m.put(v);
                }
                o.put("minutes", m);
                arr.put(o);
            }
        } catch (Exception e) {
            return;
        }
        prefs(context).edit().putString(KEY_TEMPLATES, arr.toString()).apply();
    }

    public static boolean hasTemplateTitle(Context context, String title) {
        if (title == null) {
            return false;
        }
        for (Template t : getTemplates(context)) {
            if (title.equals(t.title)) {
                return true;
            }
        }
        return false;
    }

    /** Add (or replace by title) a template. */
    public static void addTemplate(Context context, Template template) {
        List<Template> list = getTemplates(context);
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).title.equals(template.title)) {
                list.set(i, template);
                saveTemplates(context, list);
                return;
            }
        }
        list.add(template);
        saveTemplates(context, list);
    }

    public static void removeTemplateByTitle(Context context, String title) {
        List<Template> list = getTemplates(context);
        for (int i = list.size() - 1; i >= 0; i--) {
            if (list.get(i).title.equals(title)) {
                list.remove(i);
            }
        }
        saveTemplates(context, list);
    }
}
