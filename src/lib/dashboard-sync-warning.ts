import { diagnose, STALE_AFTER_MS, type HealthInput } from "./sync-health";

/** A remote receipt is evidence of arrival, not proof of phone health or call handling. */
export function dashboardSyncWarning(input: {
  now: number;
  latestReceipt: string | null;
  phone?: HealthInput;
}) {
  if (input.phone) {
    const issues = diagnose(input.phone);
    if (issues.length) return { kind: "device" as const, issues };
  }
  if (!input.latestReceipt) return { kind: "no-receipt" as const, issues: [] };
  const at = Date.parse(input.latestReceipt);
  if (!Number.isFinite(at) || input.now - at > STALE_AFTER_MS)
    return { kind: "check" as const, issues: [] };
  return null;
}