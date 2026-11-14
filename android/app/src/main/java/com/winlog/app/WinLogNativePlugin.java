package com.winlog.app;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

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
    public void openAppSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + ctx.getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
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
        JSArray out = new JSArray();
        try {
            JSONArray rows = CallLogReader.read(getContext(), since, limit);
            for (int i = 0; i < rows.length(); i++) out.put(rows.opt(i));
        } catch (SecurityException e) {
            call.reject("Call history permission is not granted", "PERMISSION_DENIED");
            return;
        }
        JSObject result = new JSObject();
        result.put("calls", out);
        call.resolve(result);
    }

    /** Hands this phone's upload key to the background uploader and starts the 15-minute schedule. */
    @PluginMethod
    public void enableBackgroundUpload(PluginCall call) {
        String endpoint = call.getString("endpoint");
        String token = call.getString("token");
        String userId = call.getString("userId");
        if (endpoint == null || token == null || userId == null || !endpoint.startsWith("https://")) {
            call.reject("endpoint (https), token and userId are required");
            return;
        }
        BackgroundUpload.enable(getContext(), endpoint, token, userId, call.getString("deviceName"));
        call.resolve(backgroundStatus());
    }

    @PluginMethod
    public void disableBackgroundUpload(PluginCall call) {
        BackgroundUpload.disable(getContext());
        call.resolve(backgroundStatus());
    }

    @PluginMethod
    public void getBackgroundUploadStatus(PluginCall call) {
        call.resolve(backgroundStatus());
    }

    @PluginMethod
    public void acknowledgeUploads(PluginCall call) {
        String userId = call.getString("userId");
        JSONArray rows = call.getArray("rows");
        if (userId == null || rows == null) {
            call.reject("userId and rows are required");
            return;
        }
        UploadReceipts.acknowledge(getContext(), userId, rows);
        call.resolve();
    }

    @PluginMethod
    public void getPendingUploadStatus(PluginCall call) {
        String userId = call.getString("userId");
        if (userId == null) { call.reject("userId is required"); return; }
        getBridge().execute(() -> {
            try {
                Context ctx = getContext();
                long since = System.currentTimeMillis() - 30L * 86_400_000L;
                boolean canRead = CallLogReader.canRead(ctx);
                Integer sim = canRead ? UploadReceipts.countPending(ctx, userId, "sim",
                    CallLogReader.read(ctx, since, Integer.MAX_VALUE)) : null;
                int whatsapp = UploadReceipts.countPending(ctx, userId, "whatsapp", WhatsAppCallStore.since(ctx, since));
                JSObject result = new JSObject();
                result.put("sim", sim == null ? JSONObject.NULL : sim);
                result.put("whatsapp", whatsapp);
                result.put("total", sim == null ? JSONObject.NULL : sim + whatsapp);
                result.put("checkedAt", System.currentTimeMillis());
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Could not read calls waiting to upload", e);
            }
        });
    }

    private JSObject backgroundStatus() {
        android.content.SharedPreferences p = BackgroundUpload.prefs(getContext());
        JSObject s = new JSObject();
        s.put("enabled", BackgroundUpload.isEnabled(getContext()));
        s.put("userId", p.getString(BackgroundUpload.KEY_USER, null));
        long lastRun = p.getLong(BackgroundUpload.KEY_LAST_RUN, 0);
        long lastSuccess = p.getLong(BackgroundUpload.KEY_LAST_SUCCESS, 0);
        s.put("lastRunAt", lastRun == 0 ? null : lastRun);
        s.put("lastSuccessAt", lastSuccess == 0 ? null : lastSuccess);
        s.put("lastCount", p.getInt(BackgroundUpload.KEY_LAST_COUNT, 0));
        s.put("lastError", p.getString(BackgroundUpload.KEY_LAST_ERROR, null));
        return s;
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

    private static long readLong(PluginCall call, String key, long fallback) {
        Object value = call.getData().opt(key);
        if (value instanceof Number) return ((Number) value).longValue();
        return fallback;
    }
}
