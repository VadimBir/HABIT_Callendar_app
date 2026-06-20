/*
 * HABIT: per-view size screen.
 *
 * Two independent controls per target:
 *   - UI   : scales the whole UI (layout AND text) for that screen (density).
 *   - Text : pure text size, applied ON TOP of (relative to) the UI scale.
 * "Base (all screens)" multiplies every other target. So final text =
 * uiBase × uiView × textBase × textView; final UI = uiBase × uiView.
 */
package com.android.calendar.settings;

import android.app.Activity;
import android.os.Bundle;
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
        int statusBar = 0;
        int sbId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (sbId > 0) statusBar = getResources().getDimensionPixelSize(sbId);
        bar.setPadding(bar.getPaddingLeft(), statusBar, bar.getPaddingRight(), bar.getPaddingBottom());
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
        hint.setText("UI scales layout + text together. Text is extra, applied on top of UI. "
                + "Base multiplies every screen.");
        hint.setPadding(0, 0, 0, dp(8));
        list.addView(hint);

        addGroup(list, "Base (all screens)", HabitPrefs.KEY_UI_BASE, HabitPrefs.KEY_TEXT_BASE);
        addGroup(list, "Timeline", HabitPrefs.KEY_UI_TIMELINE, HabitPrefs.KEY_TEXT_TIMELINE);
        addGroup(list, "Event card (preview)", HabitPrefs.KEY_UI_EVENT_CARD, HabitPrefs.KEY_TEXT_EVENT_CARD);
        addGroup(list, "Event editor", HabitPrefs.KEY_UI_EVENT_EDIT, HabitPrefs.KEY_TEXT_EVENT_EDIT);

        setContentView(root);
    }

    private void addGroup(LinearLayout parent, String name, String uiKey, String textKey) {
        TextView header = new TextView(this);
        header.setText(name);
        header.setTextSize(17);
        header.setPadding(0, dp(18), 0, dp(2));
        parent.addView(header);
        addSlider(parent, "UI (layout + text)", uiKey);
        addSlider(parent, "Text only (relative)", textKey);
    }

    private void addSlider(LinearLayout parent, final String label, final String key) {
        final TextView title = new TextView(this);
        title.setPadding(dp(8), dp(8), 0, 0);
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

        parent.addView(bar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
