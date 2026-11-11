import { describe, expect, it } from "vitest";

import { computeStats, dailySeries, mapSimCall, mapWhatsAppCall, startOfWeek } from "@/lib/calls";

const device = { userId: "u1", deviceId: "d1", deviceName: "Pixel 8" };

describe("call rules", () => {
  it("talk time adds up connected call durations", () => {
    const stats = computeStats([
      { direction: "incoming", duration_seconds: 90, source: "sim" },
      { direction: "outgoing", duration_seconds: 30, source: "whatsapp" },
      { direction: "missed", duration_seconds: 0, source: "sim" },
    ]);
    expect(stats.talkSeconds).toBe(120);
  });

  it("missed, declined and blocked calls all count as missed", () => {
    const stats = computeStats([
      { direction: "missed", duration_seconds: 0, source: "sim" },
      { direction: "rejected", duration_seconds: 0, source: "sim" },
      { direction: "blocked", duration_seconds: 0, source: "sim" },
      { direction: "incoming", duration_seconds: 5, source: "sim" },
    ]);
    expect(stats.missed).toBe(3);
    expect(stats.incoming).toBe(1);
  });

  it("counts WhatsApp and SIM calls separately", () => {
    const stats = computeStats([
      { direction: "incoming", duration_seconds: 1, source: "whatsapp" },
      { direction: "incoming", duration_seconds: 1, source: "whatsapp" },
      { direction: "outgoing", duration_seconds: 1, source: "sim" },
    ]);
    expect(stats.whatsapp).toBe(2);
    expect(stats.sim).toBe(1);
  });

  it("keeps a WhatsApp call's direction, talk time and video flag", () => {
    const row = mapWhatsAppCall(
      { id: "w1", app: "whatsapp", name: "Rahim", direction: "incoming", video: true, startedAt: 1_700_000_000_000, duration: 125 },
      device,
    );
    expect(row.source).toBe("whatsapp");
    expect(row.direction).toBe("incoming");
    expect(row.duration_seconds).toBe(125);
    expect(row.is_video).toBe(true);
    expect(row.contact_name).toBe("Rahim");
  });

  it("maps a SIM call from the phone's history", () => {
    const row = mapSimCall(
      { id: "42", number: "+8801700000000", name: null, type: "missed", date: 1_700_000_000_000, duration: 0, sim: "SIM 2 · GP" },
      device,
    );
    expect(row.source).toBe("sim");
    expect(row.external_id).toBe("42");
    expect(row.direction).toBe("missed");
    expect(row.phone_number).toBe("+8801700000000");
    expect(row.sim_label).toBe("SIM 2 · GP");
  });

  it("weeks start on Monday", () => {
    const wednesday = new Date(2026, 10, 11, 15, 0);
    expect(startOfWeek(wednesday).getDay()).toBe(1);
    expect(startOfWeek(wednesday).getDate()).toBe(9);
  });

  it("puts each call on its own day in the weekly chart", () => {
    const monday = new Date(2026, 10, 9);
    const series = dailySeries(
      [
        { direction: "incoming", duration_seconds: 60, started_at: new Date(2026, 10, 9, 10).toISOString() },
        { direction: "missed", duration_seconds: 0, started_at: new Date(2026, 10, 11, 18).toISOString() },
      ],
      monday,
      7,
    );
    expect(series[0].incoming).toBe(1);
    expect(series[0].talkMinutes).toBe(1);
    expect(series[2].missed).toBe(1);
  });
});
