/*
 * HABIT: intermediate "new event" chooser shown before the event editor.
 *
 * Presented for every create-event path (FAB, grid tap, …) because it is invoked
 * from CalendarController.launchCreateEvent, the single funnel for new events.
 *
 * It lets the user multi-select reminder presets; the union of the checked
 * presets' reminders is pre-filled into the editor. (Templates: see REQUIREMENTS
 * R13/R15 — added in a following checkpoint.)
 */
package com.android.calendar;

import android.app.Activity;
import android.content.Intent;
import android.view.View;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.android.calendar.CalendarEventModel.ReminderEntry;
import com.android.calendar.event.EditEventActivity;
import com.android.calendar.settings.HabitPrefs;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import ws.xsoh.etar.R;

public class HabitEventChooser {

    /**
     * Show the chooser. On "Create event" the given base intent (already built by
     * CalendarController.generateCreateEventIntent) is augmented with the selected
     * reminders and used to launch the editor.
     */
    public static void show(final Activity activity, final Intent baseIntent) {
        final List<HabitPrefs.Preset> presets = HabitPrefs.getPresets(activity);

        LinearLayout container = new LinearLayout(activity);
        container.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (20 * activity.getResources().getDisplayMetrics().density);
        container.setPadding(pad, pad / 2, pad, 0);

        TextView hint = new TextView(activity);
        hint.setText(R.string.habit_chooser_hint);
        container.addView(hint);

        final ArrayList<CheckBox> boxes = new ArrayList<>();
        for (HabitPrefs.Preset p : presets) {
            CheckBox cb = new CheckBox(activity);
            cb.setText(p.name + "  (" + describeMinutes(p.minutes) + ")");
            container.addView(cb);
            boxes.add(cb);
        }

        new MaterialAlertDialogBuilder(activity)
                .setTitle(R.string.habit_chooser_title)
                .setView(container)
                .setPositiveButton(R.string.habit_chooser_create, (dialog, which) -> {
                    LinkedHashSet<Integer> mins = new LinkedHashSet<>();
                    for (int i = 0; i < boxes.size(); i++) {
                        if (boxes.get(i).isChecked()) {
                            for (int m : presets.get(i).minutes) {
                                mins.add(m);
                            }
                        }
                    }
                    if (!mins.isEmpty()) {
                        ArrayList<ReminderEntry> reminders = new ArrayList<>();
                        for (int m : mins) {
                            reminders.add(ReminderEntry.valueOf(m));
                        }
                        baseIntent.putExtra(EditEventActivity.EXTRA_EVENT_REMINDERS, reminders);
                    }
                    activity.startActivity(baseIntent);
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    private static String describeMinutes(int[] minutes) {
        if (minutes == null || minutes.length == 0) {
            return "no reminder";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < minutes.length; i++) {
            if (i > 0) {
                sb.append(", ");
            }
            int m = minutes[i];
            if (m < 60) {
                sb.append(m).append("m");
            } else if (m < 1440) {
                sb.append(m / 60).append("h");
            } else if (m < 10080) {
                sb.append(m / 1440).append("d");
            } else {
                sb.append(m / 10080).append("w");
            }
        }
        return sb.toString();
    }
}
