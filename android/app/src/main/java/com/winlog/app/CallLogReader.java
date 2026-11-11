package com.winlog.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.CallLog;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Reads the phone's SIM call history. Shared by the app screens and the background uploader. */
public final class CallLogReader {
    private CallLogReader() {}

    public static boolean canRead(Context ctx) {
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED;
    }

    /** Calls newer than {@code since} (ms), oldest first: id, number, name, type, date, duration, sim. */
    public static JSONArray read(Context ctx, long since, int limit) throws SecurityException {
        Map<String, String> simLabels = simLabels(ctx);
        String[] projection = {
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.PHONE_ACCOUNT_ID
        };
        JSONArray out = new JSONArray();
        try (Cursor c = ctx.getContentResolver().query(
            CallLog.Calls.CONTENT_URI,
            projection,
            CallLog.Calls.DATE + " > ?",
            new String[] { String.valueOf(since) },
            CallLog.Calls.DATE + " ASC"
        )) {
            if (c == null) return out;
            while (c.moveToNext() && out.length() < limit) {
                JSONObject row = new JSONObject();
                try {
                    row.put("id", String.valueOf(c.getLong(0)));
                    row.put("number", c.getString(1) == null ? JSONObject.NULL : c.getString(1));
                    row.put("name", c.getString(2) == null ? JSONObject.NULL : c.getString(2));
                    row.put("type", typeName(c.getInt(3)));
                    row.put("date", c.getLong(4));
                    row.put("duration", c.getLong(5));
                    String accountId = c.getString(6);
                    String sim = accountId == null ? null : simLabels.get(accountId);
                    row.put("sim", sim == null ? JSONObject.NULL : sim);
                } catch (JSONException ignored) {
                    continue;
                }
                out.put(row);
            }
        }
        return out;
    }

    private static Map<String, String> simLabels(Context ctx) {
        Map<String, String> labels = new HashMap<>();
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            return labels;
        }
        try {
            SubscriptionManager sm = (SubscriptionManager) ctx.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            if (sm == null) return labels;
            List<SubscriptionInfo> subs = sm.getActiveSubscriptionInfoList();
            if (subs == null) return labels;
            for (SubscriptionInfo info : subs) {
                CharSequence carrier = info.getCarrierName();
                String label = "SIM " + (info.getSimSlotIndex() + 1) + (carrier == null ? "" : " · " + carrier);
                labels.put(String.valueOf(info.getSubscriptionId()), label);
                String iccId = info.getIccId();
                if (iccId != null && !iccId.isEmpty()) labels.put(iccId, label);
            }
        } catch (SecurityException ignored) {
            // Without phone-state access we simply skip SIM names.
        }
        return labels;
    }

    static String typeName(int type) {
        switch (type) {
            case CallLog.Calls.INCOMING_TYPE:
            case CallLog.Calls.ANSWERED_EXTERNALLY_TYPE:
                return "incoming";
            case CallLog.Calls.OUTGOING_TYPE:
                return "outgoing";
            case CallLog.Calls.MISSED_TYPE:
                return "missed";
            case CallLog.Calls.REJECTED_TYPE:
                return "rejected";
            case CallLog.Calls.BLOCKED_TYPE:
                return "blocked";
            default:
                return "unknown";
        }
    }
}
