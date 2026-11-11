package com.winlog.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

/** Settings and scheduling for uploads that run while the app is closed. */
public final class BackgroundUpload {
    static final String PREFS = "winlog_background_upload";
    static final String KEY_ENDPOINT = "endpoint";
    static final String KEY_TOKEN = "token";
    static final String KEY_USER = "userId";
    static final String KEY_DEVICE_NAME = "deviceName";
    static final String KEY_CURSOR_SIM = "cursorSim";
    static final String KEY_CURSOR_WHATSAPP = "cursorWhatsApp";
    static final String KEY_LAST_RUN = "lastRunAt";
    static final String KEY_LAST_SUCCESS = "lastSuccessAt";
    static final String KEY_LAST_COUNT = "lastCount";
    static final String KEY_LAST_ERROR = "lastError";

    private static final String PERIODIC = "winlog-upload-periodic";
    private static final String SOON = "winlog-upload-soon";

    private BackgroundUpload() {}

    static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context ctx) {
        SharedPreferences p = prefs(ctx);
        return p.getString(KEY_TOKEN, null) != null && p.getString(KEY_ENDPOINT, null) != null;
    }

    static void enable(Context ctx, String endpoint, String token, String userId, String deviceName) {
        SharedPreferences p = prefs(ctx);
        SharedPreferences.Editor e = p.edit()
            .putString(KEY_ENDPOINT, endpoint)
            .putString(KEY_TOKEN, token)
            .putString(KEY_DEVICE_NAME, deviceName)
            .remove(KEY_LAST_ERROR);
        // A different account on this phone starts from a fresh 30-day window.
        if (!userId.equals(p.getString(KEY_USER, null))) {
            e.remove(KEY_CURSOR_SIM).remove(KEY_CURSOR_WHATSAPP);
        }
        e.putString(KEY_USER, userId).apply();
        schedule(ctx);
        uploadSoon(ctx, 0);
    }

    static void disable(Context ctx) {
        prefs(ctx).edit().remove(KEY_TOKEN).remove(KEY_ENDPOINT).apply();
        WorkManager wm = WorkManager.getInstance(ctx);
        wm.cancelUniqueWork(PERIODIC);
        wm.cancelUniqueWork(SOON);
    }

    private static Constraints networkConstraint() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    /** Every 15 minutes (Android's shortest repeat), surviving app close and phone restarts. */
    static void schedule(Context ctx) {
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(CallUploadWorker.class, 15, TimeUnit.MINUTES)
            .setConstraints(networkConstraint())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, req);
    }

    /** One extra upload shortly after a call ends, so managers see it without waiting for the next round. */
    static void uploadSoon(Context ctx, long delaySeconds) {
        if (!isEnabled(ctx)) return;
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(CallUploadWorker.class)
            .setConstraints(networkConstraint())
            .setInitialDelay(delaySeconds, TimeUnit.SECONDS)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .build();
        WorkManager.getInstance(ctx).enqueueUniqueWork(SOON, ExistingWorkPolicy.REPLACE, req);
    }
}
