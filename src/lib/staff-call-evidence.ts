/** Read-back verifies receipt only; it cannot establish a real-device test or conversation. */
export function staffCallEvidence(call: { id: string; source: string; created_at: string } | null) {
  return {
    receiptVerified: call !== null,
    deviceEvidence: call === null ? "missing" : call.source === "sim" ? "device-calllog-report" : "notification-inference",
    testCallVerified: false,
    deviceTestVerified: false,
  } as const;
}