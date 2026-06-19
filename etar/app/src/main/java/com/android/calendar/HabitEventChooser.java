/*
 * HABIT: intermediate "new event" chooser shown before the event editor.
 *
 * Invoked from CalendarController.launchCreateEvent (the single funnel for all
 * new-event creation: FAB, day/week grid taps), so it appears from every "+".
 *
 * Left column: reminder presets as multi-select checkboxes — the union of the
 * checked presets' reminders is pre-filled into the editor.
 * Right column (only if any exist): templates — tapping one opens the editor as
 * a deep copy of that template.
 */
package com.android.calendar;

import android.app.Activity;
import android.content.Intent;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Events;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;

import com.android.calendar.CalendarEventModel.ReminderEntry;
import com.android.calendar.event.EditEventActivity;
import com.android.calendar.settings.HabitPrefs;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import ws.xsoh.etar.R;

public class HabitEventChooser {

    public static void show(final Activity activity, final Intent baseIntent) {
        final List<HabitPrefs.Preset> presets = HabitPrefs.getPresets(activity);
        final List<HabitPrefs.Template> templates = HabitPrefs.getTemplates(activity);

        int pad = (int) (16 * activity.getResources().getDisplayMetrics().density);

        LinearLayout columns = new LinearLayout(activity);
        columns.setOrientation(LinearLayout.HORIZONTAL);
        columns.setPadding(pad, pad / 2, pad, 0);

        // ---- Left column: preset checkboxes ----
        LinearLayout left = new LinearLayout(activity);
        left.setOrientation(LinearLayout.VERTICAL);
        left.setLayoutParams(new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        TextView hint = new TextView(activity);
        hint.setText(R.string.habit_chooser_hint);
        left.addView(hint);

        final ArrayList<CheckBox> boxes = new ArrayList<>();
        for (HabitPrefs.Preset p : presets) {
            CheckBox cb = new CheckBox(activity);
            cb.setText(p.name + "  (" + describeMinutes(p.minutes) + ")");
            left.addView(cb);
            boxes.add(cb);
        }
        columns.addView(left);

        final AlertDialog[] holder = new AlertDialog[1];

        // ---- Right column: templates (only if any) ----
        if (!templates.isEmpty()) {
            LinearLayout right = new LinearLayout(activity);
            right.setOrientation(LinearLayout.VERTICAL);
            right.setLayoutParams(new LinearLayout.LayoutParams(
                    0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            right.setPadding(pad, 0, 0, 0);

            TextView tLabel = new TextView(activity);
            tLabel.setText(R.string.habit_templates_label);
            right.addView(tLabel);

            for (final HabitPrefs.Template t : templates) {
                Button b = new Button(activity);
                b.setText(t.title);
                b.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
                b.setOnClickListener(v -> {
                    launchFromTemplate(activity, baseIntent, t);
                    if (holder[0] != null) {
                        holder[0].dismiss();
                    }
                });
                right.addView(b);
            }
            columns.addView(right);
        }

        AlertDialog dialog = new MaterialAlertDialogBuilder(activity)
                .setTitle(R.string.habit_chooser_title)
                .setView(columns)
                .setPositiveButton(R.string.habit_chooser_create, (d, w) -> {
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
                .create();
        holder[0] = dialog;
        dialog.show();
    }

    private static void launchFromTemplate(Activity activity, Intent baseIntent,
                                           HabitPrefs.Template t) {
        long begin = baseIntent.getLongExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME,
                System.currentTimeMillis());
        long end;
        if (t.allDay) {
            // All-day events must start at local midnight and span whole days.
            java.util.Calendar c = java.util.Calendar.getInstance();
            c.setTimeInMillis(begin);
            c.set(java.util.Calendar.HOUR_OF_DAY, 0);
            c.set(java.util.Calendar.MINUTE, 0);
            c.set(java.util.Calendar.SECOND, 0);
            c.set(java.util.Calendar.MILLISECOND, 0);
            begin = c.getTimeInMillis();
            long days = Math.max(1, Math.round(t.durationMinutes / 1440.0));
            end = begin + days * 86400000L;
        } else {
            end = begin + t.durationMinutes * 60000L;
        }

        Intent intent = new Intent(activity, EditEventActivity.class);
        intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin);
        intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end);
        intent.putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, t.allDay);
        intent.putExtra(Events.TITLE, t.title);
        intent.putExtra(Events.DESCRIPTION, t.description);
        intent.putExtra(Events.EVENT_LOCATION, t.location);
        if (t.minutes.length > 0) {
            ArrayList<ReminderEntry> reminders = new ArrayList<>();
            for (int m : t.minutes) {
                reminders.add(ReminderEntry.valueOf(m));
            }
            intent.putExtra(EditEventActivity.EXTRA_EVENT_REMINDERS, reminders);
        }
        activity.startActivity(intent);
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
