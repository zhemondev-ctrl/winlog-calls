package com.winlog.app;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.CallLog;
import android.provider.Settings;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Bridge between the WinLog web screens and the phone's call history. */
@CapacitorPlugin(
    name = "WinLogNative",
    permissions = {
        @Permission(alias = "callLog", strings = { Manifest.permission.READ_CALL_LOG }),
        @Permission(alias = "phone", strings = { Manifest.permission.READ_PHONE_STATE })
    }
)
public class WinLogNativePlugin extends Plugin {

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void requestCallLogPermission(PluginCall call) {
        if (getPermissionState("callLog") == PermissionState.GRANTED
            && getPermissionState("phone") == PermissionState.GRANTED) {
            call.resolve(status());
            return;
        }
        requestPermissionForAliases(new String[] { "callLog", "phone" }, call, "onCallLogPermission");
    }

    @PermissionCallback
    private void onCallLogPermission(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            intent.putExtra(
                Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                new ComponentName(ctx, WhatsAppCallListener.class).flattenToString()
            );
        } else {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(intent);
        } catch (Exception e) {
            Intent fallback = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(fallback);
        }
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        } catch (Exception e) {
            Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(fallback);
        }
        call.resolve();
    }

    @PluginMethod
    public void getCalls(PluginCall call) {
        if (getPermissionState("callLog") != PermissionState.GRANTED) {
            call.reject("Call history permission is not granted", "PERMISSION_DENIED");
            return;
        }
        long since = readLong(call, "since", 0L);
        int limit = (int) readLong(call, "limit", 2000L);
        Map<String, String> simLabels = simLabels();

        String[] projection = {
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.PHONE_ACCOUNT_ID
        };
        JSArray out = new JSArray();
        try (Cursor c = getContext().getContentResolver().query(
            CallLog.Calls.CONTENT_URI,
            projection,
            CallLog.Calls.DATE + " > ?",
            new String[] { String.valueOf(since) },
            CallLog.Calls.DATE + " ASC"
        )) {
            if (c != null) {
                while (c.moveToNext() && out.length() < limit) {
                    JSObject row = new JSObject();
                    row.put("id", String.valueOf(c.getLong(0)));
                    row.put("number", c.getString(1));
                    row.put("name", c.getString(2));
                    row.put("type", typeName(c.getInt(3)));
                    row.put("date", c.getLong(4));
                    row.put("duration", c.getLong(5));
                    String accountId = c.getString(6);
                    row.put("sim", accountId == null ? null : simLabels.get(accountId));
                    out.put(row);
                }
            }
        } catch (SecurityException e) {
            call.reject("Call history permission is not granted", "PERMISSION_DENIED");
            return;
        }
        JSObject result = new JSObject();
        result.put("calls", out);
        call.resolve(result);
    }

    @PluginMethod
    public void getWhatsAppCalls(PluginCall call) {
        long since = readLong(call, "since", 0L);
        JSONArray events = WhatsAppCallStore.since(getContext(), since);
        JSArray out = new JSArray();
        for (int i = 0; i < events.length(); i++) {
            JSONObject e = events.optJSONObject(i);
            if (e != null) out.put(e);
        }
        JSObject result = new JSObject();
        result.put("calls", out);
        call.resolve(result);
    }

    private JSObject status() {
        Context ctx = getContext();
        JSObject s = new JSObject();
        s.put("callLog", getPermissionState("callLog") == PermissionState.GRANTED);
        s.put("notificationAccess", NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.getPackageName()));
        boolean batteryOk = true;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        if (pm != null) batteryOk = pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        s.put("batteryUnrestricted", batteryOk);
        s.put("deviceId", Settings.Secure.getString(ctx.getContentResolver(), Settings.Secure.ANDROID_ID));
        String model = Build.MODEL == null ? "" : Build.MODEL;
        String maker = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
        s.put("deviceName", model.toLowerCase().startsWith(maker.toLowerCase()) ? model : (maker + " " + model).trim());
        try {
            PackageInfo info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            s.put("appVersion", info.versionName);
        } catch (Exception ignored) {
            s.put("appVersion", null);
        }
        return s;
    }

    private Map<String, String> simLabels() {
        Map<String, String> labels = new HashMap<>();
        if (getPermissionState("phone") != PermissionState.GRANTED) return labels;
        try {
            SubscriptionManager sm = (SubscriptionManager) getContext().getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
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

    private static long readLong(PluginCall call, String key, long fallback) {
        Object value = call.getData().opt(key);
        if (value instanceof Number) return ((Number) value).longValue();
        return fallback;
    }

    private static String typeName(int type) {
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
