import { describe, expect, it } from "vitest";

import { classifyError, diagnose, lastSynced, STALE_AFTER_MS, type HealthInput } from "./sync-health";

const NOW = Date.UTC(2026, 10, 12, 6, 0, 0);
const ok = (at: number | null = NOW - 60_000) => ({ at, count: 3, error: null });

function input(over: Partial<HealthInput> = {}): HealthInput {
  return {
    now: NOW,
    online: true,
    permissions: { callLog: true, notificationAccess: true, batteryUnrestricted: true },
    background: { enabled: true, lastSuccessAt: NOW - 120_000, lastError: null },
    sim: ok(),
    whatsapp: ok(),
    uploadError: null,
    ...over,
  };
}

const ids = (i: HealthInput) => diagnose(i).map((x) => x.id);

describe("sync health", () => {
  it("reports no problems when everything is allowed and recently uploaded", () => {
    expect(diagnose(input())).toEqual([]);
  });

  it("flags missing call history and notification access as errors", () => {
    const issues = diagnose(input({ permissions: { callLog: false, notificationAccess: false, batteryUnrestricted: true } }));
    expect(issues.map((i) => [i.id, i.severity])).toEqual([
      ["call-log", "error"],
      ["notifications", "error"],
    ]);
  });

  it("treats an expired sign-in as a sign-in problem, not a generic failure", () => {
    expect(classifyError("JWT expired")).toBe("auth");
    expect(classifyError("Upload key rejected. Open WinLog and sign in.")).toBe("auth");
    expect(ids(input({ uploadError: "JWT expired" }))).toEqual(["signed-out"]);
  });

  it("only blames the office connection when the phone itself is online", () => {
    expect(ids(input({ uploadError: "Failed to fetch" }))).toEqual(["unreachable"]);
    expect(ids(input({ online: false, uploadError: "Failed to fetch" }))).toEqual(["offline"]);
  });

  it("warns when nothing uploaded for more than 2 hours", () => {
    const old = NOW - STALE_AFTER_MS - 1000;
    expect(STALE_AFTER_MS).toBe(2 * 60 * 60 * 1000);
    expect(ids(input({ sim: ok(old), whatsapp: ok(old), background: { enabled: true, lastSuccessAt: old, lastError: null } }))).toEqual(["stale"]);
    const recent = NOW - STALE_AFTER_MS + 60_000;
    expect(ids(input({ sim: ok(recent), whatsapp: ok(recent), background: { enabled: true, lastSuccessAt: null, lastError: null } }))).toEqual([]);
  });

  it("asks to update an app without background uploads", () => {
    expect(ids(input({ background: null }))).toEqual(["old-app"]);
  });

  it("uses the newer of the open-app and background sync times", () => {
    expect(lastSynced({ at: 100, count: 0, error: null }, 200)).toBe(200);
    expect(lastSynced({ at: 300, count: 0, error: null }, null)).toBe(300);
    expect(lastSynced({ at: null, count: 0, error: null }, undefined)).toBeNull();
  });
});
