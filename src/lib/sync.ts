import { supabase } from "@/integrations/supabase/client";
import { mapSimCall, mapWhatsAppCall, type DeviceInfo, type NewCallRow } from "@/lib/calls";
import { WinLogNative, isAndroidApp } from "@/lib/native";

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
    const { error } = await supabase
      .from("call_logs")
      .upsert(chunk, {
        onConflict: "user_id,device_id,source,external_id",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(error.message);
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

  if (status.callLog) {
    const key = cursorKey(userId, device.deviceId, "sim");
    const since = Math.max(0, readCursor(key) - OVERLAP);
    const { calls } = await WinLogNative.getCalls({ since, limit: 5000 });
    const rows = calls.map((c) => mapSimCall(c, device));
    await upload(rows);
    const newest = calls.reduce((m, c) => Math.max(m, c.date), readCursor(key));
    window.localStorage.setItem(key, String(newest));
    result.sim = rows.length;
  }

  {
    const key = cursorKey(userId, device.deviceId, "whatsapp");
    const since = Math.max(0, readCursor(key) - OVERLAP);
    const { calls } = await WinLogNative.getWhatsAppCalls({ since });
    const rows = calls.map((c) => mapWhatsAppCall(c, device));
    await upload(rows);
    const newest = calls.reduce((m, c) => Math.max(m, c.startedAt), readCursor(key));
    window.localStorage.setItem(key, String(newest));
    result.whatsapp = rows.length;
  }

  window.localStorage.setItem(`winlog:lastSync:${userId}`, String(result.at));
  return result;
}

export function lastSyncAt(userId: string): number | null {
  const raw = window.localStorage.getItem(`winlog:lastSync:${userId}`);
  return raw ? Number(raw) : null;
}
