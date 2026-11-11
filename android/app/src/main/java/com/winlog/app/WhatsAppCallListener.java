package com.winlog.app;

import android.app.Notification;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * WhatsApp does not share its call history with other apps, so we follow its call notifications:
 * ringing (incoming), calling (outgoing), ongoing (connected, with a timer) and their removal.
 */
public class WhatsAppCallListener extends NotificationListenerService {
    private static final String WHATSAPP = "com.whatsapp";
    private static final String WHATSAPP_BUSINESS = "com.whatsapp.w4b";
    private static final long FINALIZE_DELAY_MS = 3500;

    private static class Session {
        String app;
        String name;
        boolean video;
        boolean sawIncoming;
        long startedAt;
        long connectedAt;
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Set<String> activeKeys = new HashSet<>();
    private Session session;
    private final Runnable finalizeRunnable = this::finalizeSession;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || !isWhatsApp(sbn.getPackageName())) return;
        Notification n = sbn.getNotification();
        if (n == null) return;

        String title = text(n.extras, Notification.EXTRA_TITLE);
        String body = text(n.extras, Notification.EXTRA_TEXT);
        String lower = (body + " " + text(n.extras, Notification.EXTRA_SUB_TEXT)).toLowerCase(Locale.ROOT);

        if (isMissedCall(n, lower)) {
            if (session == null) {
                WhatsAppCallStore.add(this, appName(sbn.getPackageName()), cleanName(title), "missed",
                    isVideo(lower), System.currentTimeMillis(), 0);
            }
            return;
        }
        if (!isCallNotification(n, lower)) return;

        handler.removeCallbacks(finalizeRunnable);
        activeKeys.add(sbn.getKey());

        long now = System.currentTimeMillis();
        if (session == null) {
            session = new Session();
            session.app = appName(sbn.getPackageName());
            session.startedAt = now;
        }
        String name = cleanName(title);
        if (name != null) session.name = name;
        if (isVideo(lower)) session.video = true;

        boolean connected = n.extras != null && n.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER, false)
            || containsAny(lower, "ongoing", "চলমান", "চলতি");
        boolean incomingRing = n.fullScreenIntent != null
            || containsAny(lower, "incoming", "ইনকামিং", "আগত");

        if (connected) {
            if (session.connectedAt == 0) {
                long when = n.when;
                session.connectedAt = (when > 0 && when <= now && now - when < 60_000) ? when : now;
            }
        } else if (incomingRing) {
            session.sawIncoming = true;
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        if (sbn == null || !isWhatsApp(sbn.getPackageName())) return;
        if (!activeKeys.remove(sbn.getKey())) return;
        if (activeKeys.isEmpty() && session != null) {
            // WhatsApp sometimes swaps the ringing notification for the ongoing one; wait before deciding.
            handler.removeCallbacks(finalizeRunnable);
            handler.postDelayed(finalizeRunnable, FINALIZE_DELAY_MS);
        }
    }

    private void finalizeSession() {
        Session s = session;
        if (s == null) return;
        if (stillInCall()) return;
        session = null;
        activeKeys.clear();

        long now = System.currentTimeMillis();
        boolean connected = s.connectedAt > 0;
        String direction;
        long duration = 0;
        if (connected) {
            direction = s.sawIncoming ? "incoming" : "outgoing";
            duration = Math.max(0, (now - s.connectedAt - FINALIZE_DELAY_MS) / 1000);
        } else {
            direction = s.sawIncoming ? "missed" : "outgoing";
        }
        WhatsAppCallStore.add(this, s.app, s.name, direction, s.video, s.startedAt, duration);
    }

    private boolean stillInCall() {
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active == null) return false;
            for (StatusBarNotification sbn : active) {
                if (!isWhatsApp(sbn.getPackageName())) continue;
                Notification n = sbn.getNotification();
                if (n == null) continue;
                String lower = (text(n.extras, Notification.EXTRA_TEXT)).toLowerCase(Locale.ROOT);
                if (isCallNotification(n, lower) && !isMissedCall(n, lower)) {
                    activeKeys.add(sbn.getKey());
                    return true;
                }
            }
        } catch (Exception ignored) {
            // Listener may be briefly unbound; treat as call ended.
        }
        return false;
    }

    private static boolean isWhatsApp(String pkg) {
        return WHATSAPP.equals(pkg) || WHATSAPP_BUSINESS.equals(pkg);
    }

    private static String appName(String pkg) {
        return WHATSAPP_BUSINESS.equals(pkg) ? "whatsapp_business" : "whatsapp";
    }

    private static boolean isCallNotification(Notification n, String lower) {
        if (Notification.CATEGORY_CALL.equals(n.category)) return true;
        String channel = n.getChannelId() == null ? "" : n.getChannelId().toLowerCase(Locale.ROOT);
        if (channel.contains("voip") || (channel.contains("call") && !channel.contains("missed"))) return true;
        return containsAny(lower, "voice call", "video call", "calling", "ringing", "ভয়েস কল", "ভিডিও কল", "কল করা হচ্ছে");
    }

    private static boolean isMissedCall(Notification n, String lower) {
        if ("missed_call".equals(n.category)) return true;
        String channel = n.getChannelId() == null ? "" : n.getChannelId().toLowerCase(Locale.ROOT);
        if (channel.contains("missed")) return true;
        return containsAny(lower, "missed voice call", "missed video call", "missed call", "মিসড কল", "মিস কল");
    }

    private static boolean isVideo(String lower) {
        return containsAny(lower, "video", "ভিডিও");
    }

    private static String cleanName(String title) {
        if (title == null) return null;
        String t = title.trim();
        if (t.isEmpty() || t.equalsIgnoreCase("whatsapp") || t.equalsIgnoreCase("whatsapp business")) return null;
        return t;
    }

    private static boolean containsAny(String haystack, String... needles) {
        for (String needle : needles) {
            if (haystack.contains(needle)) return true;
        }
        return false;
    }

    private static String text(Bundle extras, String key) {
        if (extras == null) return "";
        CharSequence cs = extras.getCharSequence(key);
        return cs == null ? "" : cs.toString();
    }
}
