export interface FlaggedCall {
  call_id: string;
  note: string;
  user_id: string;
  phone_number: string | null;
  contact_name: string | null;
  direction: string;
  started_at: string;
}

export interface FollowUpGroup {
  key: string;
  contact: string;
  phone: string | null;
  note: string;
  latestAt: string;
  callIds: string[];
  staffIds: string[];
}

/** Normalises a number so "+880 1711-000000" and "01711000000" land in one group. */
export function contactKey(c: Pick<FlaggedCall, "phone_number" | "contact_name" | "call_id">) {
  const digits = (c.phone_number ?? "").replace(/\D/g, "");
  if (digits.length >= 6) return `n:${digits.slice(-10)}`;
  const name = c.contact_name?.trim().toLowerCase();
  return name ? `c:${name}` : `x:${c.call_id}`;
}

/** Groups open follow-up calls per contact, newest contact first; the newest note leads. */
export function groupFollowUps(calls: FlaggedCall[]): FollowUpGroup[] {
  const groups = new Map<string, FollowUpGroup>();
  const sorted = [...calls].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  for (const c of sorted) {
    const key = contactKey(c);
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        key,
        contact: c.contact_name || c.phone_number || "Unknown caller",
        phone: c.phone_number,
        note: c.note,
        latestAt: c.started_at,
        callIds: [c.call_id],
        staffIds: [c.user_id],
      });
    } else {
      g.callIds.push(c.call_id);
      if (!g.staffIds.includes(c.user_id)) g.staffIds.push(c.user_id);
      if (g.contact === g.phone && c.contact_name) g.contact = c.contact_name;
    }
  }
  return [...groups.values()];
}
