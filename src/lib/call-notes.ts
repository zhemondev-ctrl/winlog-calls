// Decides which call cards need a fresh AI note and builds the compact context the model reads.
// Pure functions only, so the rules are unit-tested.

import { contactKey, type DigestCall } from "@/lib/call-digest";
import { formatDuration } from "@/lib/calls";

export type NoteCall = DigestCall & { id: string };

export interface SavedNote {
  call_id: string;
  note: string;
  follow_up: boolean;
  contact_last_at: string | null;
}

export interface NoteJob {
  ref: string;
  call: NoteCall;
  /** Newest call with the same contact (or the call itself) when the note is written. */
  contactLastAt: string;
  history: NoteCall[];
}

/** How much history with a contact the model sees per call. */
export const HISTORY_LIMIT = 12;

function latestFor(call: NoteCall, byContact: Map<string, NoteCall[]>): string {
  const key = contactKey(call);
  const list = key ? (byContact.get(key) ?? []) : [];
  return [call, ...list].reduce(
    (m, c) => (Date.parse(c.started_at) > Date.parse(m) ? c.started_at : m),
    call.started_at,
  );
}

/**
 * A saved note stays valid until the same contact has a newer call than the note knew about
 * (e.g. the missed caller was called back). Calls without a note always need one.
 */
export function planNotes(
  targets: NoteCall[],
  context: NoteCall[],
  saved: SavedNote[],
): { keep: SavedNote[]; jobs: NoteJob[] } {
  const byContact = new Map<string, NoteCall[]>();
  for (const c of context) {
    const key = contactKey(c);
    if (!key) continue;
    byContact.set(key, [...(byContact.get(key) ?? []), c]);
  }
  const savedById = new Map(saved.map((n) => [n.call_id, n]));
  const keep: SavedNote[] = [];
  const jobs: NoteJob[] = [];
  for (const call of targets) {
    const contactLastAt = latestFor(call, byContact);
    const note = savedById.get(call.id);
    if (note && note.contact_last_at && Date.parse(note.contact_last_at) >= Date.parse(contactLastAt)) {
      keep.push(note);
      continue;
    }
    const key = contactKey(call);
    const history = (key ? (byContact.get(key) ?? []) : [])
      .filter((c) => c.id !== call.id)
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
      .slice(0, HISTORY_LIMIT);
    jobs.push({ ref: String(jobs.length + 1), call, contactLastAt, history });
  }
  return { keep, jobs };
}

function line(c: NoteCall, names: Map<string, string>, tz: string): string {
  const when = new Date(c.started_at).toLocaleString("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const talk = c.duration_seconds > 0 ? `, talk ${formatDuration(c.duration_seconds)}` : "";
  return `${when} · ${c.direction}${c.is_video ? " video" : ""} ${c.source} call${talk} · staff ${names.get(c.user_id) ?? "unknown"}`;
}

export function notesPrompt(jobs: NoteJob[], names: Map<string, string>, tz: string, now: Date): string {
  const out = [`Now: ${now.toLocaleString("en-GB", { timeZone: tz })} (${tz}).`];
  for (const j of jobs) {
    const who = [j.call.contact_name, j.call.phone_number].filter(Boolean).join(" ") || "unknown caller";
    out.push("", `[ref ${j.ref}] ${who}: ${line(j.call, names, tz)}`);
    if (j.history.length === 0) out.push("  No other calls with this contact in the period.");
    for (const h of j.history) out.push(`  - ${line(h, names, tz)}`);
  }
  return out.join("\n");
}
