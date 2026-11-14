import { supabase } from "@/integrations/supabase/client";
import { mapSimCall, mapWhatsAppCall, type DeviceInfo, type NewCallRow } from "@/lib/calls";
import { WinLogNative, isAndroidApp } from "@/lib/native";
import type { SourceSync, SyncSource } from "@/lib/sync-health";

const DAY = 86_400_000;
const FIRST_SYNC_DAYS = 30;
// Re-read a day of overlap each time; uploads skip calls already saved, so nothing is doubled.
const OVERLAP = DAY;

function cursorKey(userId: string, deviceId: string, source: string) {
  return `winlog:cursor:${userId}:${deviceId}:${source}`;
}

function readCursor(key: string): number {
  const raw = window.localStorage.getItem(key);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : Date.now() - FIRST_SYNC_DAYS * DAY;
}

async function upload(rows: NewCallRow[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await supabase.from("call_logs").upsert(chunk, {
      onConflict: "user_id,device_id,source,external_id",
      ignoreDuplicates: true,
    }).select("source");
    if (error) throw new Error(error.message);
    // Includes duplicates accepted by idempotent upsert, not just new rows.
    // Older APKs do not have receipts; failure here must not undo a successful upload.
    try {
      const owner = chunk[0]?.user_id;
      if (owner) await WinLogNative.acknowledgeUploads({
        userId: owner,
        rows: chunk.map(({ source, external_id }) => ({ source, external_id })),
      });
    } catch { /* Upgrade the APK to enable the local queue count. */ }
    // RETURNING contains only newly inserted rows, not the overlap re-read or calls
    // already uploaded by WorkManager. Emit per committed chunk, even if a later one fails.
    for (const source of ["sim", "whatsapp"] as const) {
      const callCount = data?.filter((row) => row.source === source).length ?? 0;
      if (callCount === 0) continue;
      try {
        window.__lovableEvents?.track?.("project.call_uploaded", {
          call_count: callCount,
          source,
          upload_mode: "foreground",
        });
      } catch {
        // Analytics must never prevent a successful sync or advance it into an error state.
      }
    }
  }
}

export interface SyncResult {
  sim: number;
  whatsapp: number;
  at: number;
}

let running: Promise<SyncResult> | null = null;

/** Reads new calls from the phone and uploads them. Safe to call often. */
export function syncCalls(userId: string): Promise<SyncResult> {
  if (!isAndroidApp()) return Promise.resolve({ sim: 0, whatsapp: 0, at: Date.now() });
  if (running) return running;
  running = doSync(userId).finally(() => {
    running = null;
  });
  return running;
}

async function doSync(userId: string): Promise<SyncResult> {
  const status = await WinLogNative.getStatus();
  const device: DeviceInfo = {
    userId,
    deviceId: status.deviceId,
    deviceName: status.deviceName || null,
  };
  const result: SyncResult = { sim: 0, whatsapp: 0, at: Date.now() };

  const errors: string[] = [];

  if (status.callLog) {
    try {
      const key = cursorKey(userId, device.deviceId, "sim");
      const since = Math.max(0, readCursor(key) - OVERLAP);
      const { calls } = await WinLogNative.getCalls({ since, limit: 5000 });
      const rows = calls.map((c) => mapSimCall(c, device));
      await upload(rows);
      const newest = calls.reduce((m, c) => Math.max(m, c.date), readCursor(key));
      window.localStorage.setItem(key, String(newest));
      result.sim = rows.length;
      writeSourceSync(userId, "sim", { at: Date.now(), count: rows.length, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : "SIM upload failed";
      errors.push(message);
      writeSourceSync(userId, "sim", { ...readSourceSync(userId, "sim"), error: message });
    }
  } else {
    writeSourceSync(userId, "sim", {
      ...readSourceSync(userId, "sim"),
      error: "Call history permission is off.",
    });
  }

  // WhatsApp is uploaded even when SIM fails, so one problem never blocks the other.
  try {
    const key = cursorKey(userId, device.deviceId, "whatsapp");
    const since = Math.max(0, readCursor(key) - OVERLAP);
    const { calls } = await WinLogNative.getWhatsAppCalls({ since });
    const rows = calls.map((c) => mapWhatsAppCall(c, device));
    await upload(rows);
    const newest = calls.reduce((m, c) => Math.max(m, c.startedAt), readCursor(key));
    window.localStorage.setItem(key, String(newest));
    result.whatsapp = rows.length;
    writeSourceSync(userId, "whatsapp", { at: Date.now(), count: rows.length, error: null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "WhatsApp upload failed";
    errors.push(message);
    writeSourceSync(userId, "whatsapp", { ...readSourceSync(userId, "whatsapp"), error: message });
  }

  if (errors.length) throw new Error(errors.join(" · "));
  window.localStorage.setItem(`winlog:lastSync:${userId}`, String(result.at));
  return result;
}

export function lastSyncAt(userId: string): number | null {
  const raw = window.localStorage.getItem(`winlog:lastSync:${userId}`);
  return raw ? Number(raw) : null;
}

function sourceKey(userId: string, source: SyncSource) {
  return `winlog:sourceSync:${userId}:${source}`;
}

function writeSourceSync(userId: string, source: SyncSource, value: SourceSync) {
  window.localStorage.setItem(sourceKey(userId, source), JSON.stringify(value));
}

/** Last sync of one source made while the app was open (the background job keeps its own record). */
export function readSourceSync(userId: string, source: SyncSource): SourceSync {
  try {
    const raw = window.localStorage.getItem(sourceKey(userId, source));
    const v = raw ? (JSON.parse(raw) as Partial<SourceSync>) : {};
    return {
      at: typeof v.at === "number" ? v.at : null,
      count: typeof v.count === "number" ? v.count : 0,
      error: typeof v.error === "string" ? v.error : null,
    };
  } catch {
    return { at: null, count: 0, error: null };
  }
}
