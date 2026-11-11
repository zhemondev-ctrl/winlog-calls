// Turns raw team call rows into a compact text briefing the AI assistant can reason over.
// Pure functions only (no network), so the rules here are unit-tested.

import { formatDuration, isUnanswered, type CallRow } from "@/lib/calls";

export type DigestCall = Pick<
  CallRow,
  | "user_id"
  | "source"
  | "direction"
  | "phone_number"
  | "contact_name"
  | "started_at"
  | "duration_seconds"
  | "is_video"
>;

export interface DigestPerson {
  id: string;
  name: string;
}

/** Same person across formats: compare the last 10 digits of a number, or the contact name for WhatsApp. */
export function contactKey(c: Pick<DigestCall, "phone_number" | "contact_name">): string | null {
  const digits = (c.phone_number ?? "").replace(/\D/g, "");
  if (digits.length >= 6) return `n:${digits.slice(-10)}`;
  const name = (c.contact_name ?? "").trim().toLowerCase();
  return name ? `c:${name}` : null;
}

function isConnected(c: DigestCall): boolean {
  return (c.direction === "incoming" || c.direction === "outgoing") && c.duration_seconds > 0;
}

/**
 * Missed/rejected calls that nobody on the team has followed up: no connected call and no
 * outgoing attempt with the same contact after the miss.
 */
export function unreturnedMissedCalls<T extends DigestCall>(calls: T[]): T[] {
  const latestFollowUp = new Map<string, number>();
  for (const c of calls) {
    const key = contactKey(c);
    if (!key) continue;
    if (isConnected(c) || c.direction === "outgoing") {
      const t = Date.parse(c.started_at);
      if (t > (latestFollowUp.get(key) ?? 0)) latestFollowUp.set(key, t);
    }
  }
  const seen = new Set<string>();
  return calls
    .filter((c) => isUnanswered(c.direction))
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
    .filter((c) => {
      const key = contactKey(c);
      if (!key) return true;
      if ((latestFollowUp.get(key) ?? 0) > Date.parse(c.started_at)) return false;
      // One line per waiting contact (their latest miss).
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function fmtTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function dayKey(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}

function hourOf(iso: string, timeZone: string): number {
  return (
    Number(new Date(iso).toLocaleString("en-GB", { timeZone, hour: "2-digit", hour12: false })) % 24
  );
}

function who(c: Pick<DigestCall, "phone_number" | "contact_name">): string {
  if (c.contact_name && c.phone_number) return `${c.contact_name} (${c.phone_number})`;
  return c.contact_name || c.phone_number || "unknown caller";
}

export function safeTimeZone(tz: string | undefined | null): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function buildCallDigest(
  calls: DigestCall[],
  people: DigestPerson[],
  opts: { now: Date; timeZone: string; days: number },
): string {
  const tz = safeTimeZone(opts.timeZone);
  const names = new Map(people.map((p) => [p.id, p.name || "Unnamed"]));
  const nameOf = (id: string) => names.get(id) ?? "Unknown employee";
  const sorted = [...calls].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  const today = dayKey(opts.now.toISOString(), tz);
  const lines: string[] = [];

  lines.push(
    `Now: ${fmtTime(opts.now.toISOString(), tz)} (${tz}). Data covers the last ${opts.days} days: ${sorted.length} calls.`,
  );

  // Per employee
  lines.push("", "## Per employee (whole period | today)");
  const ids = new Set([...people.map((p) => p.id), ...sorted.map((c) => c.user_id)]);
  for (const id of ids) {
    const mine = sorted.filter((c) => c.user_id === id);
    const todays = mine.filter((c) => dayKey(c.started_at, tz) === today);
    const stat = (list: DigestCall[]) => {
      const inc = list.filter((c) => c.direction === "incoming").length;
      const out = list.filter((c) => c.direction === "outgoing").length;
      const miss = list.filter((c) => isUnanswered(c.direction)).length;
      const talk = list.reduce((s, c) => s + c.duration_seconds, 0);
      const wa = list.filter((c) => c.source === "whatsapp").length;
      const connected = list.filter(isConnected);
      const avg = connected.length ? talk / connected.length : 0;
      return `${list.length} calls (in ${inc}, out ${out}, missed ${miss}; WhatsApp ${wa}), talk ${formatDuration(talk)}, avg ${formatDuration(avg)}`;
    };
    const last = mine[0] ? fmtTime(mine[0].started_at, tz) : "never";
    lines.push(`- ${nameOf(id)}: ${stat(mine)} | today ${stat(todays)} | last call ${last}`);
  }

  // Daily team totals (most recent 14 days)
  lines.push("", "## Team per day (calls / missed / talk)");
  const byDay = new Map<string, DigestCall[]>();
  for (const c of sorted) {
    const k = dayKey(c.started_at, tz);
    byDay.set(k, [...(byDay.get(k) ?? []), c]);
  }
  for (const [day, list] of [...byDay.entries()].slice(0, 14)) {
    const miss = list.filter((c) => isUnanswered(c.direction)).length;
    const talk = list.reduce((s, c) => s + c.duration_seconds, 0);
    lines.push(`- ${day}: ${list.length} / ${miss} / ${formatDuration(talk)}`);
  }

  // Busiest hours
  const hours = new Array<number>(24).fill(0);
  for (const c of sorted) hours[hourOf(c.started_at, tz)]! += 1;
  const busiest = hours
    .map((n, h) => ({ h, n }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((x) => `${String(x.h).padStart(2, "0")}:00 (${x.n})`);
  lines.push("", `## Busiest hours: ${busiest.join(", ") || "none"}`);

  // Unreturned missed calls
  const waiting = unreturnedMissedCalls(sorted).slice(0, 60);
  lines.push(
    "",
    `## Missed calls nobody has called back yet (${waiting.length} shown, newest first)`,
  );
  for (const c of waiting) {
    lines.push(
      `- ${fmtTime(c.started_at, tz)} · ${who(c)} · missed by ${nameOf(c.user_id)} · ${c.source}`,
    );
  }

  // Top contacts
  const contacts = new Map<
    string,
    { label: string; n: number; talk: number; last: string; staff: Set<string> }
  >();
  for (const c of sorted) {
    const key = contactKey(c);
    if (!key) continue;
    const entry = contacts.get(key) ?? {
      label: who(c),
      n: 0,
      talk: 0,
      last: c.started_at,
      staff: new Set(),
    };
    entry.n += 1;
    entry.talk += c.duration_seconds;
    entry.staff.add(nameOf(c.user_id));
    contacts.set(key, entry);
  }
  lines.push("", "## Most frequent contacts");
  for (const e of [...contacts.values()].sort((a, b) => b.n - a.n).slice(0, 20)) {
    lines.push(
      `- ${e.label}: ${e.n} calls, talk ${formatDuration(e.talk)}, last ${fmtTime(e.last, tz)}, handled by ${[...e.staff].join(", ")}`,
    );
  }

  // Recent calls
  lines.push("", "## Most recent calls (newest first)");
  for (const c of sorted.slice(0, 150)) {
    lines.push(
      `- ${fmtTime(c.started_at, tz)} · ${nameOf(c.user_id)} · ${c.direction}${c.is_video ? " video" : ""} · ${c.source} · ${who(c)} · ${formatDuration(c.duration_seconds)}`,
    );
  }

  return lines.join("\n");
}
