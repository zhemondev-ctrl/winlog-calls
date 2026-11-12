import { describe, expect, it } from "vitest";
import { groupFollowUps } from "./follow-ups";

const base = { user_id: "u1", direction: "missed", contact_name: null, note: "n" };

describe("groupFollowUps", () => {
  it("puts calls from the same number in one group, newest note first", () => {
    const groups = groupFollowUps([
      { ...base, call_id: "a", phone_number: "+880 1711-000000", started_at: "2026-11-10T10:00:00Z", note: "old" },
      { ...base, call_id: "b", phone_number: "01711000000", started_at: "2026-11-11T10:00:00Z", note: "new", user_id: "u2" },
      { ...base, call_id: "c", phone_number: "01999999999", started_at: "2026-11-09T10:00:00Z" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.callIds).toEqual(["b", "a"]);
    expect(groups[0]!.note).toBe("new");
    expect(groups[0]!.staffIds).toEqual(["u2", "u1"]);
  });

  it("never merges unknown callers", () => {
    const groups = groupFollowUps([
      { ...base, call_id: "a", phone_number: null, started_at: "2026-11-10T10:00:00Z" },
      { ...base, call_id: "b", phone_number: null, started_at: "2026-11-11T10:00:00Z" },
    ]);
    expect(groups).toHaveLength(2);
  });
});
