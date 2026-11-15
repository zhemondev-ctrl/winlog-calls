import { describe, expect, it } from "vitest";
import { staffCallEvidence } from "./staff-call-evidence";

describe("staff call verification boundaries", () => {
  it("never verifies an absent test call", () => {
    expect(staffCallEvidence(null)).toEqual({ receiptVerified: false, deviceEvidence: "missing", testCallVerified: false, deviceTestVerified: false });
  });
  it("verifies a SIM receipt but not a physical test", () => {
    const evidence = staffCallEvidence({ id: "call-1", source: "sim", created_at: "2026-11-15T04:57:00Z" });
    expect(evidence.receiptVerified).toBe(true);
    expect(evidence.deviceEvidence).toBe("device-calllog-report");
    expect(evidence.testCallVerified).toBe(false);
    expect(evidence.deviceTestVerified).toBe(false);
  });
  it("keeps WhatsApp evidence as notification inference", () => {
    expect(staffCallEvidence({ id: "call-2", source: "whatsapp", created_at: "2026-11-15T04:57:00Z" }).deviceEvidence).toBe("notification-inference");
  });
});