package com.winlog.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

/** Device-local acknowledgements, written only after the server accepts a batch. */
final class UploadReceipts {
    private UploadReceipts() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences("winlog_upload_receipts", Context.MODE_PRIVATE);
    }

    static synchronized void acknowledge(Context ctx, String userId, JSONArray rows) {
        for (String source : new String[] {"sim", "whatsapp"}) {
            String key = userId + ":" + source;
            Set<String> ids = new HashSet<>(prefs(ctx).getStringSet(key, new HashSet<>()));
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.optJSONObject(i);
                if (row != null && source.equals(row.optString("source"))) {
                    String id = row.optString("external_id", "");
                    if (!id.isEmpty()) ids.add(id);
                }
            }
            prefs(ctx).edit().putStringSet(key, ids).commit();
        }
    }

    static synchronized int countPending(Context ctx, String userId, String source, JSONArray calls) {
        Set<String> uploaded = prefs(ctx).getStringSet(userId + ":" + source, new HashSet<>());
        Set<String> pending = new HashSet<>();
        for (int i = 0; i < calls.length(); i++) {
            JSONObject row = calls.optJSONObject(i);
            if (row == null) continue;
            String id = row.optString("id", "");
            if (!id.isEmpty() && !uploaded.contains(id)) pending.add(id);
        }
        return pending.size();
    }
}