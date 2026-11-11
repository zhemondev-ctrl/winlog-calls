package com.winlog.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.UUID;

/** Keeps captured WhatsApp calls on the phone until the app uploads them. */
public final class WhatsAppCallStore {
    private static final String PREFS = "winlog_whatsapp_calls";
    private static final String KEY_EVENTS = "events";
    private static final int MAX_EVENTS = 3000;

    private WhatsAppCallStore() {}

    public static synchronized void add(
        Context context,
        String app,
        String name,
        String direction,
        boolean video,
        long startedAt,
        long durationSeconds
    ) {
        try {
            JSONArray events = read(context);

            // A missed-call notification can arrive right after we already recorded the same missed call.
            if ("missed".equals(direction)) {
                for (int i = events.length() - 1; i >= 0 && i >= events.length() - 5; i--) {
                    JSONObject e = events.getJSONObject(i);
                    boolean sameName = name != null && name.equals(e.optString("name", null));
                    boolean recent = Math.abs(startedAt - e.optLong("startedAt")) < 3 * 60 * 1000L;
                    if (sameName && recent && "missed".equals(e.optString("direction"))) return;
                }
            }

            JSONObject event = new JSONObject();
            event.put("id", UUID.randomUUID().toString());
            event.put("app", app);
            event.put("name", name == null ? JSONObject.NULL : name);
            event.put("direction", direction);
            event.put("video", video);
            event.put("startedAt", startedAt);
            event.put("duration", Math.max(0, durationSeconds));
            events.put(event);

            JSONArray trimmed = events;
            if (events.length() > MAX_EVENTS) {
                trimmed = new JSONArray();
                for (int i = events.length() - MAX_EVENTS; i < events.length(); i++) {
                    trimmed.put(events.get(i));
                }
            }
            prefs(context).edit().putString(KEY_EVENTS, trimmed.toString()).apply();
        } catch (JSONException ignored) {
            // Never crash the listener over a storage problem.
        }
    }

    public static synchronized JSONArray since(Context context, long since) {
        JSONArray out = new JSONArray();
        JSONArray events = read(context);
        for (int i = 0; i < events.length(); i++) {
            JSONObject e = events.optJSONObject(i);
            if (e != null && e.optLong("startedAt") > since) out.put(e);
        }
        return out;
    }

    private static JSONArray read(Context context) {
        String raw = prefs(context).getString(KEY_EVENTS, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
