import { describe, expect, it } from "vitest";
import { dashboardSyncWarning } from "./dashboard-sync-warning";
import { STALE_AFTER_MS, type HealthInput } from "./sync-health";

const now = Date.UTC(2026, 10, 15, 5);
describe("dashboard sync warning evidence", () => {
  it("warns when zhemon.sm123 has no server receipt without claiming a device failure", () => {
    expect(dashboardSyncWarning({ now, latestReceipt: null })?.kind).toBe("no-receipt");
  });
  it("requests a check for old receipts rather than asserting a failed sync", () => {
    expect(dashboardSyncWarning({ now, latestReceipt: new Date(now - STALE_AFTER_MS - 1).toISOString() })?.kind).toBe("check");
  });
  it("hides receipt warning when a recent call reads back", () => {
    expect(dashboardSyncWarning({ now, latestReceipt: new Date(now - 1000).toISOString() })).toBeNull();
  });
  it("reports locally observed missing permission even with a recent receipt", () => {
    const phone: HealthInput = { now, online: true, permissions: { callLog: false, notificationAccess: true, batteryUnrestricted: true }, background: { enabled: true, lastSuccessAt: now, lastError: null }, sim: { at: now, count: 0, error: null }, whatsapp: { at: now, count: 0, error: null }, uploadError: null };
    const result = dashboardSyncWarning({ now, latestReceipt: new Date(now).toISOString(), phone });
    expect(result?.kind).toBe("device");
    expect(result?.issues.map(i => i.id)).toEqual(["call-log"]);
  });
});