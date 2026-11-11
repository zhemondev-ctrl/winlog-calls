import { describe, expect, it } from "vitest";

import { buildCallDigest, contactKey, unreturnedMissedCalls, type DigestCall } from "./call-digest";

function call(p: Partial<DigestCall>): DigestCall {
  return {
    user_id: "u1",
    source: "sim",
    direction: "incoming",
    phone_number: "+8801711000001",
    contact_name: null,
    started_at: "2026-11-10T09:00:00Z",
    duration_seconds: 60,
    is_video: false,
    ...p,
  };
}

describe("contactKey", () => {
  it("matches the same number written with and without a country code", () => {
    expect(contactKey(call({ phone_number: "+880 1711-000001" }))).toBe(
      contactKey(call({ phone_number: "01711000001" })),
    );
  });
});

describe("unreturnedMissedCalls", () => {
  it("drops a missed call once anyone on the team calls that number back", () => {
    const calls = [
      call({ direction: "missed", duration_seconds: 0, started_at: "2026-11-10T09:00:00Z" }),
      call({
        user_id: "u2",
        direction: "outgoing",
        duration_seconds: 0,
        started_at: "2026-11-10T10:00:00Z",
      }),
    ];
    expect(unreturnedMissedCalls(calls)).toHaveLength(0);
  });

  it("keeps a missed call when the only contact happened before the miss", () => {
    const calls = [
      call({ direction: "outgoing", started_at: "2026-11-10T08:00:00Z" }),
      call({ direction: "missed", duration_seconds: 0, started_at: "2026-11-10T09:00:00Z" }),
    ];
    expect(unreturnedMissedCalls(calls)).toHaveLength(1);
  });

  it("lists a contact who missed us several times only once", () => {
    const calls = [
      call({ direction: "missed", duration_seconds: 0, started_at: "2026-11-10T09:00:00Z" }),
      call({ direction: "rejected", duration_seconds: 0, started_at: "2026-11-10T11:00:00Z" }),
    ];
    const out = unreturnedMissedCalls(calls);
    expect(out).toHaveLength(1);
    expect(out[0]!.started_at).toBe("2026-11-10T11:00:00Z");
  });
});

describe("buildCallDigest", () => {
  it("names each employee and counts their calls", () => {
    const text = buildCallDigest(
      [call({}), call({ direction: "missed", duration_seconds: 0 })],
      [{ id: "u1", name: "Rahim" }],
      { now: new Date("2026-11-10T12:00:00Z"), timeZone: "Asia/Dhaka", days: 30 },
    );
    expect(text).toContain("- Rahim: 2 calls (in 1, out 0, missed 1");
  });
});
