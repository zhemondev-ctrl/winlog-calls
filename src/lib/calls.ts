// Pure helpers for turning phone call records into WinLog rows and stats. No browser or network code here.

export type CallSource = "sim" | "whatsapp";
export type CallDirection = "incoming" | "outgoing" | "missed" | "rejected" | "blocked" | "unknown";

export interface CallRow {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string | null;
  source: CallSource;
  external_id: string;
  direction: CallDirection;
  phone_number: string | null;
  contact_name: string | null;
  started_at: string;
  duration_seconds: number;
  is_video: boolean;
  sim_label: string | null;
  created_at: string;
}

export type NewCallRow = Omit<CallRow, "id" | "created_at">;

export interface NativeSimCall {
  id: string;
  number: string | null;
  name: string | null;
  type: string;
  date: number;
  duration: number;
  sim: string | null;
}

export interface NativeWhatsAppCall {
  id: string;
  app: "whatsapp" | "whatsapp_business";
  name: string | null;
  direction: string;
  video: boolean;
  startedAt: number;
  duration: number;
}

export interface DeviceInfo {
  userId: string;
  deviceId: string;
  deviceName: string | null;
}

const DIRECTIONS: CallDirection[] = ["incoming", "outgoing", "missed", "rejected", "blocked", "unknown"];

function toDirection(value: string): CallDirection {
  return (DIRECTIONS as string[]).includes(value) ? (value as CallDirection) : "unknown";
}

export function mapSimCall(call: NativeSimCall, device: DeviceInfo): NewCallRow {
  return {
    user_id: device.userId,
    device_id: device.deviceId,
    device_name: device.deviceName,
    source: "sim",
    external_id: call.id,
    direction: toDirection(call.type),
    phone_number: call.number || null,
    contact_name: call.name || null,
    started_at: new Date(call.date).toISOString(),
    duration_seconds: Math.max(0, Math.round(call.duration || 0)),
    is_video: false,
    sim_label: call.sim || null,
  };
}

export function mapWhatsAppCall(call: NativeWhatsAppCall, device: DeviceInfo): NewCallRow {
  return {
    user_id: device.userId,
    device_id: device.deviceId,
    device_name: device.deviceName,
    source: "whatsapp",
    external_id: call.id,
    direction: toDirection(call.direction),
    phone_number: null,
    contact_name: call.name || null,
    started_at: new Date(call.startedAt).toISOString(),
    duration_seconds: Math.max(0, Math.round(call.duration || 0)),
    is_video: Boolean(call.video),
    sim_label: call.app === "whatsapp_business" ? "WhatsApp Business" : "WhatsApp",
  };
}

/** Missed, rejected and blocked calls all count as "not connected". */
export function isUnanswered(direction: CallDirection): boolean {
  return direction === "missed" || direction === "rejected" || direction === "blocked";
}

export interface CallStats {
  total: number;
  incoming: number;
  outgoing: number;
  missed: number;
  talkSeconds: number;
  whatsapp: number;
  sim: number;
}

export function computeStats(calls: Pick<CallRow, "direction" | "duration_seconds" | "source">[]): CallStats {
  const stats: CallStats = { total: 0, incoming: 0, outgoing: 0, missed: 0, talkSeconds: 0, whatsapp: 0, sim: 0 };
  for (const c of calls) {
    stats.total += 1;
    if (c.direction === "incoming") stats.incoming += 1;
    else if (c.direction === "outgoing") stats.outgoing += 1;
    else if (isUnanswered(c.direction)) stats.missed += 1;
    stats.talkSeconds += c.duration_seconds;
    if (c.source === "whatsapp") stats.whatsapp += 1;
    else stats.sim += 1;
  }
  return stats;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday-to-Sunday weeks, the way most offices count them. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

export interface DayBucket {
  date: Date;
  label: string;
  incoming: number;
  outgoing: number;
  missed: number;
  talkMinutes: number;
}

export function dailySeries(
  calls: Pick<CallRow, "direction" | "duration_seconds" | "started_at">[],
  from: Date,
  days: number,
): DayBucket[] {
  const buckets: DayBucket[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(from);
    date.setDate(from.getDate() + i);
    buckets.push({
      date,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      incoming: 0,
      outgoing: 0,
      missed: 0,
      talkMinutes: 0,
    });
  }
  const start = startOfDay(from).getTime();
  for (const c of calls) {
    const t = new Date(c.started_at);
    const index = Math.floor((startOfDay(t).getTime() - start) / 86_400_000 + 0.5);
    const b = buckets[index];
    if (!b) continue;
    if (c.direction === "incoming") b.incoming += 1;
    else if (c.direction === "outgoing") b.outgoing += 1;
    else if (isUnanswered(c.direction)) b.missed += 1;
    b.talkMinutes += c.duration_seconds / 60;
  }
  for (const b of buckets) b.talkMinutes = Math.round(b.talkMinutes);
  return buckets;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}

export const DIRECTION_LABEL: Record<CallDirection, string> = {
  incoming: "Incoming",
  outgoing: "Outgoing",
  missed: "Missed",
  rejected: "Declined",
  blocked: "Blocked",
  unknown: "Other",
};
