import { describe, it, expect } from "vitest";
import {
  canMutate,
  validTransition,
  maySendAi,
  mutationSchema,
  supportMetrics,
  validateAttachment,
  releaseReadiness,
  canReadCustomerMessage,
} from "./rules";
describe("Ticket lifecycle", () => {
  it("allows closing and reopening only into open", () => {
    expect(validTransition("open", "resolved")).toBe(true);
    expect(validTransition("resolved", "open")).toBe(true);
    expect(validTransition("resolved", "pending")).toBe(false);
  });
});
describe("Role boundaries", () => {
  it("customers cannot read internal notes",()=>expect(canReadCustomerMessage(false,true,'internal')).toBe(false));
  it("linked customers can read public replies",()=>expect(canReadCustomerMessage(false,true,'customer')).toBe(true));
  it("unrelated customers cannot read messages",()=>expect(canReadCustomerMessage(false,false,'customer')).toBe(false));
  it("viewer cannot mutate", () => expect(canMutate("viewer", "ticket")).toBe(false));
  it("agent cannot manage roles", () => expect(canMutate("agent", "member")).toBe(false));
  it("manager cannot manage admin settings", () =>
    expect(canMutate("manager", "settings")).toBe(false));
  it("manager can merge", () => expect(canMutate("manager", "merge")).toBe(true));
  it("unassigned user cannot read through operator access", () =>
    expect(canMutate(null, "ticket")).toBe(false));
});
describe("Duplicate prevention contracts", () => {
  it("requires stable case idempotency UUID", () => {
    expect(
      mutationSchema.safeParse({
        action: "ticket",
        teamId: crypto.randomUUID(),
        payload: { subject: "Issue" },
      }).success,
    ).toBe(false);
  });
  it("requires stable message idempotency UUID", () => {
    expect(
      mutationSchema.safeParse({
        action: "message",
        teamId: crypto.randomUUID(),
        payload: { ticket_id: crypto.randomUUID(), body: "Reply", visibility: "internal" },
      }).success,
    ).toBe(false);
  });
});
describe("AI human approval", () => {
  it("unapproved reply cannot be used", () =>
    expect(maySendAi({ status: "draft", body: "Reply", kind: "reply" }, "Reply")).toBe(false));
  it("approved exact reply can be used", () =>
    expect(maySendAi({ status: "approved", body: "Reply", kind: "reply" }, "Reply")).toBe(true));
  it("edited approved text must be reapproved", () =>
    expect(maySendAi({ status: "approved", body: "Reply", kind: "reply" }, "Changed")).toBe(false));
  it("summary cannot be sent as a reply", () =>
    expect(maySendAi({ status: "approved", body: "Summary", kind: "summary" }, "Summary")).toBe(
      false,
    ));
});
describe("Actual analytics", () => {
  it("empty data has no estimated response time or CSAT", () => {
    const m = supportMetrics([]);
    expect(m.total).toBe(0);
    expect(m.firstResponseMinutes).toBeNull();
    expect(m.resolutionMinutes).toBeNull();
    expect(m.reopenRate).toBeNull();
    expect(m.csat).toBeNull();
  });
  it("calculates measured times and breach", () => {
    const m = supportMetrics([
      {
        status: "resolved",
        channel: "manual",
        category: "General",
        assignee_id: null,
        created_at: "2026-11-14T10:00:00Z",
        first_response_at: "2026-11-14T10:15:00Z",
        resolved_at: "2026-11-14T11:00:00Z",
        sla_due_at: "2026-11-14T10:30:00Z",
        reopen_count: 1,
      },
    ]);
    expect(m.firstResponseMinutes).toBe(15);
    expect(m.resolutionMinutes).toBe(60);
    expect(m.slaBreaches).toBe(1);
    expect(m.reopenRate).toBe(1);
  });
});
describe("Attachments and evidence", () => {
  it("rejects fake PDF file type", () =>
    expect(() => validateAttachment("application/pdf", btoa("not a pdf"), 9)).toThrow());
  it("preserves supplied audit boundaries", () => {
    expect(releaseReadiness.find((x) => x[0] === "Package")?.[1]).toBe("com.winlog.app");
    expect(releaseReadiness.find((x) => x[0] === "Real-phone installation")?.[2]).toBe(
      "NOT VERIFIED",
    );
  });
});
