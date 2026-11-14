import { describe, expect, it } from "vitest";
import { canEnrollStaff, normalizePhoneCode, PHONE_CODE_TTL_MS } from "./phone-code";

describe("private phone enrollment", () => {
  it("allows a selected existing staff member", () => expect(canEnrollStaff(false, true)).toBe(true));
  it("never grants manager access through a phone code", () => expect(canEnrollStaff(true, true)).toBe(false));
  it("rejects nonexistent staff", () => expect(canEnrollStaff(false, false)).toBe(false));
  it("expires after 24 hours", () => expect(PHONE_CODE_TTL_MS).toBe(86400000));
  it("accepts printed groups without changing the secret", () => expect(normalizePhoneCode(" abcd-1234 ")).toBe("ABCD1234"));
});