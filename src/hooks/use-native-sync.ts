import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { ensureBackgroundUpload } from "@/lib/background-upload";
import { isAndroidApp, WinLogNative, type BackgroundUploadStatus, type NativeStatus } from "@/lib/native";
import { lastSyncAt, syncCalls, type SyncResult } from "@/lib/sync";

const AUTO_SYNC_MS = 5 * 60 * 1000;

/**
 * Inside the Android app: uploads new calls on open, on return to the app, and every few minutes,
 * and turns on background uploads that keep going while the app is closed.
 */
export function useNativeSync(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [native, setNative] = useState(false);
  const [status, setStatus] = useState<NativeStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [background, setBackground] = useState<BackgroundUploadStatus | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!isAndroidApp()) return null;
    const s = await WinLogNative.getStatus();
    setStatus(s);
    return s;
  }, []);

  const syncNow = useCallback(async () => {
    if (!userId || !isAndroidApp()) return;
    setSyncing(true);
    setError(null);
    try {
      const result = await syncCalls(userId);
      setLastResult(result);
      setLastAt(result.at);
      if (result.sim + result.whatsapp > 0)
        await queryClient.invalidateQueries({ queryKey: ["calls"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSyncing(false);
    }
  }, [queryClient, userId]);

  useEffect(() => {
    if (!isAndroidApp() || !userId) return;
    setNative(true);
    setLastAt(lastSyncAt(userId));
    void refreshStatus().then(() => syncNow());
    ensureBackgroundUpload(userId)
      .then(setBackground)
      .catch((e) => setError(e instanceof Error ? e.message : "Background upload could not start"));

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshStatus().then(() => syncNow());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void syncNow(), AUTO_SYNC_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refreshStatus, syncNow, userId]);

  const refreshBackground = useCallback(async () => {
    if (!isAndroidApp()) return null;
    try {
      const s = await WinLogNative.getBackgroundUploadStatus();
      setBackground(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  return {
    native,
    status,
    syncing,
    lastResult,
    lastAt,
    error,
    background,
    syncNow,
    refreshStatus,
    refreshBackground,
  };
}
