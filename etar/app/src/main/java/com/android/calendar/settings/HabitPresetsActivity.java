/*
 * HABIT: reminder preset manager.
 *
 * Lets the user create ANY number of named presets, each holding ANY number of
 * reminders (amount + unit). Persisted via HabitPrefs.saveCustomPresets and used
 * by the new-event chooser (multi-select).
 */
package com.android.calendar.settings;

import android.app.Activity;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import java.util.ArrayList;
import java.util.List;

import ws.xsoh.etar.R;

public class HabitPresetsActivity extends Activity {

    private static final int[] UNIT_MIN = {1, 60, 1440, 10080};
    private static final String[] UNIT_LABELS = {"minutes", "hours", "days", "weeks"};

    private List<HabitPrefs.Preset> mPresets;
    private LinearLayout mList;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTitle(R.string.habit_manage_presets_title);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        ScrollView scroll = new ScrollView(this);
        scroll.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        mList = new LinearLayout(this);
        mList.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(12);
        mList.setPadding(pad, pad, pad, pad);
        scroll.addView(mList);
        root.addView(scroll);

        Button add = new Button(this);
        add.setText(R.string.habit_preset_add);
        add.setOnClickListener(v -> editPreset(-1));
        root.addView(add);

        setContentView(root);
        mPresets = new ArrayList<>(HabitPrefs.getPresets(this));
        render();
    }

    private void render() {
        mList.removeAllViews();
        if (mPresets.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText(R.string.habit_preset_none);
            mList.addView(empty);
        }
        for (int i = 0; i < mPresets.size(); i++) {
            final int index = i;
            HabitPrefs.Preset p = mPresets.get(i);

            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(0, dp(6), 0, dp(6));

            TextView label = new TextView(this);
            label.setLayoutParams(new LinearLayout.LayoutParams(0,
                    ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            label.setText(p.name + "\n" + describe(p.minutes));
            row.addView(label);

            Button edit = new Button(this);
            edit.setText(R.string.habit_preset_edit);
            edit.setOnClickListener(v -> editPreset(index));
            row.addView(edit);

            Button del = new Button(this);
            del.setText(R.string.habit_preset_delete);
            del.setOnClickListener(v -> {
                mPresets.remove(index);
                persist();
                render();
            });
            row.addView(del);

            mList.addView(row);
        }
    }

    private void editPreset(final int index) {
        final boolean isNew = index < 0;
        HabitPrefs.Preset existing = isNew ? null : mPresets.get(index);

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(16);
        box.setPadding(pad, pad / 2, pad, 0);

        final EditText name = new EditText(this);
        name.setHint(R.string.habit_preset_name_hint);
        if (existing != null) {
            name.setText(existing.name);
        }
        box.addView(name);

        TextView remLabel = new TextView(this);
        remLabel.setText(R.string.habit_preset_reminders_label);
        remLabel.setPadding(0, dp(8), 0, 0);
        box.addView(remLabel);

        final LinearLayout remRows = new LinearLayout(this);
        remRows.setOrientation(LinearLayout.VERTICAL);
        box.addView(remRows);

        if (existing != null) {
            for (int m : existing.minutes) {
                addReminderRow(remRows, m);
            }
        } else {
            addReminderRow(remRows, 1440);
        }

        Button addRem = new Button(this);
        addRem.setText(R.string.habit_preset_add_reminder);
        addRem.setOnClickListener(v -> addReminderRow(remRows, 10));
        box.addView(addRem);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(box);

        new MaterialAlertDialogBuilder(this)
                .setTitle(isNew ? R.string.habit_preset_add : R.string.habit_preset_edit)
                .setView(scroll)
                .setPositiveButton(android.R.string.ok, (d, w) -> {
                    String nm = name.getText().toString().trim();
                    if (TextUtils.isEmpty(nm)) {
                        nm = getString(R.string.habit_preset_default_name);
                    }
                    List<Integer> mins = new ArrayList<>();
                    for (int r = 0; r < remRows.getChildCount(); r++) {
                        LinearLayout rr = (LinearLayout) remRows.getChildAt(r);
                        EditText amount = (EditText) rr.getChildAt(0);
                        Spinner unit = (Spinner) rr.getChildAt(1);
                        int a;
                        try {
                            a = Integer.parseInt(amount.getText().toString().trim());
                        } catch (NumberFormatException e) {
                            continue;
                        }
                        if (a < 0) {
                            continue;
                        }
                        mins.add(a * UNIT_MIN[unit.getSelectedItemPosition()]);
                    }
                    int[] arr = new int[mins.size()];
                    for (int k = 0; k < arr.length; k++) {
                        arr[k] = mins.get(k);
                    }
                    HabitPrefs.Preset preset = new HabitPrefs.Preset(nm, arr);
                    if (isNew) {
                        mPresets.add(preset);
                    } else {
                        mPresets.set(index, preset);
                    }
                    persist();
                    render();
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    private void addReminderRow(LinearLayout container, int minutes) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);

        int unitIdx = 0;
        int amount = minutes;
        for (int i = UNIT_MIN.length - 1; i >= 0; i--) {
            if (minutes != 0 && minutes % UNIT_MIN[i] == 0) {
                unitIdx = i;
                amount = minutes / UNIT_MIN[i];
                break;
            }
        }

        EditText et = new EditText(this);
        et.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        et.setText(String.valueOf(amount));
        et.setLayoutParams(new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        row.addView(et);

        Spinner sp = new Spinner(this);
        ArrayAdapter<String> ad = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_dropdown_item, UNIT_LABELS);
        sp.setAdapter(ad);
        sp.setSelection(unitIdx);
        row.addView(sp);

        Button rm = new Button(this);
        rm.setText("✕");
        rm.setOnClickListener(v -> container.removeView(row));
        row.addView(rm);

        container.addView(row);
    }

    private void persist() {
        HabitPrefs.saveCustomPresets(this, mPresets);
    }

    private String describe(int[] minutes) {
        if (minutes == null || minutes.length == 0) {
            return getString(R.string.habit_preset_no_reminders);
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

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density);
    }
}
