package com.winlog.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Uploads new SIM and WhatsApp calls with this phone's upload key, even when WinLog is closed.
 * Re-reads one day of overlap each run; the server ignores calls it already has.
 */
public class CallUploadWorker extends Worker {
    private static final long DAY = 86_400_000L;
    private static final long FIRST_WINDOW = 30 * DAY;
    private static final int BATCH = 400;

    public CallUploadWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    private static class AuthRejected extends Exception {}

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences p = BackgroundUpload.prefs(ctx);
        String endpoint = p.getString(BackgroundUpload.KEY_ENDPOINT, null);
        String token = p.getString(BackgroundUpload.KEY_TOKEN, null);
        if (endpoint == null || token == null) return Result.success();
        String deviceName = p.getString(BackgroundUpload.KEY_DEVICE_NAME, null);
        long now = System.currentTimeMillis();
        p.edit().putLong(BackgroundUpload.KEY_LAST_RUN, now).apply();

        int sent = 0;
        try {
            if (CallLogReader.canRead(ctx)) {
                long cursor = p.getLong(BackgroundUpload.KEY_CURSOR_SIM, now - FIRST_WINDOW);
                JSONArray calls = CallLogReader.read(ctx, Math.max(0, cursor - DAY), 5000);
                long newest = cursor;
                JSONArray rows = new JSONArray();
                for (int i = 0; i < calls.length(); i++) {
                    JSONObject c = calls.getJSONObject(i);
                    rows.put(simRow(c));
                    newest = Math.max(newest, c.optLong("date"));
                }
                sent += post(ctx, p.getString(BackgroundUpload.KEY_USER, ""), endpoint, token, deviceName, rows);
                p.edit().putLong(BackgroundUpload.KEY_CURSOR_SIM, newest).apply();
            }

            long waCursor = p.getLong(BackgroundUpload.KEY_CURSOR_WHATSAPP, now - FIRST_WINDOW);
            JSONArray events = WhatsAppCallStore.since(ctx, Math.max(0, waCursor - DAY));
            long waNewest = waCursor;
            JSONArray waRows = new JSONArray();
            for (int i = 0; i < events.length(); i++) {
                JSONObject e = events.getJSONObject(i);
                waRows.put(whatsAppRow(e));
                waNewest = Math.max(waNewest, e.optLong("startedAt"));
            }
            sent += post(ctx, p.getString(BackgroundUpload.KEY_USER, ""), endpoint, token, deviceName, waRows);
            p.edit()
                .putLong(BackgroundUpload.KEY_CURSOR_WHATSAPP, waNewest)
                .putLong(BackgroundUpload.KEY_LAST_SUCCESS, System.currentTimeMillis())
                .putInt(BackgroundUpload.KEY_LAST_COUNT, sent)
                .remove(BackgroundUpload.KEY_LAST_ERROR)
                .apply();
            return Result.success();
        } catch (AuthRejected e) {
            // Signed out elsewhere or key replaced: stop until the app registers a new key.
            p.edit().putString(BackgroundUpload.KEY_LAST_ERROR, "Upload key rejected. Open WinLog and sign in.").apply();
            BackgroundUpload.disable(ctx);
            return Result.failure();
        } catch (SecurityException e) {
            p.edit().putString(BackgroundUpload.KEY_LAST_ERROR, "Call history permission is off.").apply();
            return Result.success();
        } catch (IOException | JSONException e) {
            p.edit().putString(BackgroundUpload.KEY_LAST_ERROR, "Upload failed: " + e.getMessage()).apply();
            return getRunAttemptCount() < 5 ? Result.retry() : Result.failure();
        }
    }

    private static String iso(long ms) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date(ms));
    }

    private static Object orNull(JSONObject o, String key) {
        if (o.isNull(key)) return JSONObject.NULL;
        String v = o.optString(key, "");
        return v.isEmpty() ? JSONObject.NULL : v;
    }

    private static JSONObject simRow(JSONObject c) throws JSONException {
        JSONObject r = new JSONObject();
        r.put("source", "sim");
        r.put("external_id", c.getString("id"));
        r.put("direction", c.optString("type", "unknown"));
        r.put("phone_number", orNull(c, "number"));
        r.put("contact_name", orNull(c, "name"));
        r.put("started_at", iso(c.getLong("date")));
        r.put("duration_seconds", Math.max(0, c.optLong("duration")));
        r.put("is_video", false);
        r.put("sim_label", orNull(c, "sim"));
        return r;
    }

    private static JSONObject whatsAppRow(JSONObject e) throws JSONException {
        JSONObject r = new JSONObject();
        r.put("source", "whatsapp");
        r.put("external_id", e.getString("id"));
        r.put("direction", e.optString("direction", "unknown"));
        r.put("phone_number", JSONObject.NULL);
        r.put("contact_name", orNull(e, "name"));
        r.put("started_at", iso(e.getLong("startedAt")));
        r.put("duration_seconds", Math.max(0, e.optLong("duration")));
        r.put("is_video", e.optBoolean("video", false));
        r.put("sim_label", "whatsapp_business".equals(e.optString("app")) ? "WhatsApp Business" : "WhatsApp");
        return r;
    }

    /** Sends rows in batches; returns how many were sent. */
    private static int post(Context ctx, String userId, String endpoint, String token, String deviceName, JSONArray rows)
        throws IOException, JSONException, AuthRejected {
        int sent = 0;
        for (int start = 0; start < rows.length(); start += BATCH) {
            JSONArray chunk = new JSONArray();
            for (int i = start; i < Math.min(rows.length(), start + BATCH); i++) chunk.put(rows.get(i));
            JSONObject body = new JSONObject();
            body.put("device_name", deviceName == null ? JSONObject.NULL : deviceName);
            body.put("calls", chunk);

            HttpURLConnection conn = (HttpURLConnection) new URL(endpoint).openConnection();
            try {
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(20_000);
                conn.setReadTimeout(30_000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                }
                int code = conn.getResponseCode();
                if (code == 401) throw new AuthRejected();
                if (code < 200 || code >= 300) {
                    InputStream err = conn.getErrorStream();
                    if (err != null) err.close();
                    throw new IOException("server returned " + code);
                }
                conn.getInputStream().close();
                UploadReceipts.acknowledge(ctx, userId, chunk);
            } finally {
                conn.disconnect();
            }
            sent += chunk.length();
        }
        return sent;
    }
}
