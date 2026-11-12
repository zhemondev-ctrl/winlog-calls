import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  getCalls: vi.fn(),
  getWhatsAppCalls: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ upsert: () => ({ select: mocks.select }) }) },
}));
vi.mock("@/lib/native", () => ({
  isAndroidApp: () => true,
  WinLogNative: {
    getStatus: async () => ({ callLog: true, deviceId: "phone", deviceName: "Phone" }),
    getCalls: mocks.getCalls,
    getWhatsAppCalls: mocks.getWhatsAppCalls,
  },
}));

import { syncCalls } from "./sync";

const simCall = {
  id: "sim-call", number: "01711000000", name: "Private contact", type: "outgoing",
  date: Date.now(), duration: 30, sim: null,
};
const whatsappCall = {
  id: "wa-call", app: "whatsapp", name: "Private contact", direction: "incoming",
  video: false, startedAt: Date.now(), duration: 60,
};

describe("phone upload analytics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    window.__lovableEvents = { track: mocks.track };
    mocks.getCalls.mockResolvedValue({ calls: [simCall] });
    mocks.getWhatsAppCalls.mockResolvedValue({ calls: [whatsappCall] });
    mocks.select.mockResolvedValue({ data: [], error: null });
  });
  afterEach(() => { delete window.__lovableEvents; });

  it("counts newly inserted SIM and WhatsApp calls, with no personal properties", async () => {
    mocks.select.mockResolvedValueOnce({ data: [{ source: "sim" }], error: null })
      .mockResolvedValueOnce({ data: [{ source: "whatsapp" }], error: null });
    await syncCalls("staff");
    expect(mocks.track.mock.calls).toEqual([
      ["project.call_uploaded", { call_count: 1, source: "sim", upload_mode: "foreground" }],
      ["project.call_uploaded", { call_count: 1, source: "whatsapp", upload_mode: "foreground" }],
    ]);
    expect(mocks.select).toHaveBeenCalledWith("source");
  });

  it("does not count duplicate overlap or calls already saved in the background", async () => {
    await syncCalls("staff");
    await syncCalls("staff");
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("does not count failed uploads, but counts the other source that succeeds", async () => {
    mocks.select.mockResolvedValueOnce({ data: null, error: { message: "SIM failed" } })
      .mockResolvedValueOnce({ data: [{ source: "whatsapp" }], error: null });
    await expect(syncCalls("staff")).rejects.toThrow("SIM failed");
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith("project.call_uploaded", {
      call_count: 1, source: "whatsapp", upload_mode: "foreground",
    });
  });

  it("counts committed chunks even when a later chunk fails", async () => {
    mocks.getCalls.mockResolvedValue({ calls: Array.from({ length: 501 }, (_, i) => ({ ...simCall, id: String(i) })) });
    mocks.getWhatsAppCalls.mockResolvedValue({ calls: [] });
    mocks.select.mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => ({ source: "sim" })), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Second chunk failed" } });
    await expect(syncCalls("staff")).rejects.toThrow("Second chunk failed");
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith("project.call_uploaded", {
      call_count: 500, source: "sim", upload_mode: "foreground",
    });
  });

  it("does not emit for empty syncs", async () => {
    mocks.getCalls.mockResolvedValue({ calls: [] });
    mocks.getWhatsAppCalls.mockResolvedValue({ calls: [] });
    await syncCalls("staff");
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("uploads successfully without the analytics runtime", async () => {
    delete window.__lovableEvents;
    mocks.select.mockResolvedValue({ data: [{ source: "sim" }], error: null });
    await expect(syncCalls("staff")).resolves.toMatchObject({ sim: 1, whatsapp: 1 });
  });

  it("does not turn an analytics error into a failed upload", async () => {
    mocks.track.mockImplementation(() => { throw new Error("Analytics unavailable"); });
    mocks.select.mockResolvedValue({ data: [{ source: "sim" }], error: null });
    await expect(syncCalls("staff")).resolves.toMatchObject({ sim: 1, whatsapp: 1 });
  });
});