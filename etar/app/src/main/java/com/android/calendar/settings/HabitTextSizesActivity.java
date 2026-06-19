/*
 * HABIT: per-view text-size screen.
 *
 * Each view gets a custom percentage (50%–200%). "Base (all views)" is a global
 * multiplier; every other view's effective size is base × that view's percent
 * (e.g. base 66% + Timeline 90% => Timeline renders at ~59%). See
 * HabitPrefs.getEffectiveScale.
 */
package com.android.calendar.settings;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.appcompat.widget.Toolbar;

import ws.xsoh.etar.R;

public class HabitTextSizesActivity extends Activity {

    private static final int MIN_PCT = 50;
    private static final int MAX_PCT = 200;
    private static final int STEP = 5;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        Toolbar bar = new Toolbar(this);
        bar.setTitle(R.string.habit_text_sizes_title);
        bar.setNavigationIcon(R.drawable.ic_arrow_back);
        bar.setNavigationOnClickListener(v -> finish());
        root.addView(bar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        ScrollView scroll = new ScrollView(this);
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(16);
        list.setPadding(pad, pad, pad, pad);
        scroll.addView(list);
        root.addView(scroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        TextView hint = new TextView(this);
        hint.setText("Base scales every view. Each view is then a percentage of base.");
        hint.setPadding(0, 0, 0, dp(12));
        list.addView(hint);

        addRow(list, "Base (all views)", HabitPrefs.KEY_SIZE_BASE);
        addRow(list, "Timeline", HabitPrefs.KEY_SIZE_TIMELINE);
        addRow(list, "Event card (preview)", HabitPrefs.KEY_SIZE_EVENT_CARD);
        addRow(list, "Event editor", HabitPrefs.KEY_SIZE_EVENT_EDIT);

        setContentView(root);
    }

    private void addRow(LinearLayout parent, final String label, final String key) {
        final TextView title = new TextView(this);
        title.setTextSize(16);
        title.setPadding(0, dp(14), 0, dp(2));
        parent.addView(title);

        final SeekBar bar = new SeekBar(this);
        bar.setMax((MAX_PCT - MIN_PCT) / STEP);

        float current = HabitPrefs.getSizeScale(this, key);
        int pct = Math.round(current * 100f);
        pct = Math.max(MIN_PCT, Math.min(MAX_PCT, pct));
        bar.setProgress((pct - MIN_PCT) / STEP);
        title.setText(label + " — " + pct + "%");

        bar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                int p = MIN_PCT + progress * STEP;
                title.setText(label + " — " + p + "%");
                if (fromUser) {
                    HabitPrefs.setSizeScale(HabitTextSizesActivity.this, key, p / 100f);
                }
            }

            @Override public void onStartTrackingTouch(SeekBar seekBar) { }
            @Override public void onStopTrackingTouch(SeekBar seekBar) { }
        });

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        parent.addView(bar, lp);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
