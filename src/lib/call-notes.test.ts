import { describe, expect, it } from "vitest";

import { planNotes, type NoteCall } from "./call-notes";

const base = {
  user_id: "u1",
  source: "sim" as const,
  phone_number: "+8801711000001",
  contact_name: "Karim",
  duration_seconds: 0,
  is_video: false,
};
const missed: NoteCall = { ...base, id: "a", direction: "missed", started_at: "2026-11-10T09:00:00Z" };
const callBack: NoteCall = {
  ...base,
  id: "b",
  phone_number: "01711000001", // same person, local format
  direction: "outgoing",
  duration_seconds: 90,
  started_at: "2026-11-10T11:00:00Z",
};

describe("call notes", () => {
  it("writes a note for a call that has none", () => {
    const { keep, jobs } = planNotes([missed], [missed], []);
    expect(keep).toEqual([]);
    expect(jobs.map((j) => j.call.id)).toEqual(["a"]);
  });

  it("keeps a saved note while nothing new happened with that contact", () => {
    const saved = { call_id: "a", note: "No callback yet", follow_up: true, contact_last_at: missed.started_at };
    const { keep, jobs } = planNotes([missed], [missed], [saved]);
    expect(keep).toEqual([saved]);
    expect(jobs).toEqual([]);
  });

  it("rewrites the note once the contact has a newer call (e.g. a callback)", () => {
    const saved = { call_id: "a", note: "No callback yet", follow_up: true, contact_last_at: missed.started_at };
    const { keep, jobs } = planNotes([missed], [missed, callBack], [saved]);
    expect(keep).toEqual([]);
    expect(jobs[0]?.contactLastAt).toBe(callBack.started_at);
    expect(jobs[0]?.history.map((h) => h.id)).toEqual(["b"]);
  });
});
