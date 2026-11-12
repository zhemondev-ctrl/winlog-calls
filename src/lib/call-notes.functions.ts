import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeTimeZone } from "@/lib/call-digest";
import { notesPrompt, planNotes, type NoteCall, type SavedNote } from "@/lib/call-notes";

const DAY = 86_400_000;
const COLUMNS =
  "id, user_id, source, direction, phone_number, contact_name, started_at, duration_seconds, is_video";

export interface CallNote {
  note: string;
  followUp: boolean;
}

const INSTRUCTIONS = `You write one-line notes for a manager's call log at Winstone Properties Ltd.
For each [ref N] call, read it together with the other calls with the same contact and write a note of at most 16 words.
- Say the most useful pattern or next step: e.g. repeated missed calls with no callback, a callback already made, a long or frequent client, a first-time caller, a call nobody returned.
- Use the staff names, counts and days from the data. Never invent facts.
- follow_up is true only when someone should call this contact back or act now.
Return exactly one item per ref.`;

/**
 * Short AI notes for call cards (managers only). Saved notes are reused until the same contact
 * has a newer call, so each card normally costs one model call in its lifetime.
 */
export const getCallNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        callIds: z.array(z.string().uuid()).min(1).max(25),
        timeZone: z.string().max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const notes: Record<string, CallNote> = {};
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { notes, error: null as string | null };

    const { data: targets, error: targetError } = await supabase
      .from("call_logs")
      .select(COLUMNS)
      .in("id", data.callIds);
    if (targetError) return { notes, error: "Could not load these calls." };
    if (!targets?.length) return { notes, error: null };

    const { data: saved } = await supabase
      .from("call_ai_notes")
      .select("call_id, note, follow_up, contact_last_at")
      .in("call_id", data.callIds);

    // Context: everything from two weeks before the oldest card until now.
    const oldest = Math.min(...targets.map((t) => Date.parse(t.started_at)));
    const from = new Date(oldest - 14 * DAY).toISOString();
    const context_: NoteCall[] = [];
    for (let offset = 0; offset < 4000; offset += 1000) {
      const { data: page, error } = await supabase
        .from("call_logs")
        .select(COLUMNS)
        .gte("started_at", from)
        .order("started_at", { ascending: false })
        .range(offset, offset + 999);
      if (error) return { notes, error: "Could not load team calls." };
      context_.push(...((page ?? []) as NoteCall[]));
      if (!page || page.length < 1000) break;
    }

    const { keep, jobs } = planNotes(targets as NoteCall[], context_, (saved ?? []) as SavedNote[]);
    for (const n of keep) notes[n.call_id] = { note: n.note, followUp: n.follow_up };
    if (jobs.length === 0) return { notes, error: null };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { notes, error: "AI is not configured for this app." };

    const [
      { streamText, Output, NoObjectGeneratedError },
      { createGatewayModel, LOW_REASONING, describeAiError },
    ] = await Promise.all([import("ai"), import("@/lib/ai-gateway.server")]);

    const { data: people } = await supabase.from("profiles").select("id, display_name");
    const names = new Map((people ?? []).map((p) => [p.id, p.display_name || "Unnamed"]));
    const tz = safeTimeZone(data.timeZone);
    const { model } = createGatewayModel(apiKey);

    try {
      const result = streamText({
        model,
        instructions: INSTRUCTIONS,
        prompt: notesPrompt(jobs, names, tz, new Date()),
        output: Output.object({
          schema: z.object({
            notes: z.array(z.object({ ref: z.string(), note: z.string(), follow_up: z.boolean() })),
          }),
        }),
        providerOptions: LOW_REASONING,
      });
      const output = await result.output;
      const byRef = new Map(jobs.map((j) => [j.ref, j]));
      const rows = output.notes
        .map((n) => {
          const job = byRef.get(n.ref.replace(/\D/g, ""));
          if (!job) return null;
          return {
            call_id: job.call.id,
            note: n.note.trim().slice(0, 200),
            follow_up: n.follow_up,
            contact_last_at: job.contactLastAt,
            generated_at: new Date().toISOString(),
            // A rewrite means the contact called again, so a resolved follow-up reopens.
            resolved_at: null,
            resolved_by: null,
          };
        })
        .filter((r): r is NonNullable<typeof r> => !!r && r.note.length > 0);
      if (rows.length) {
        const { error } = await supabase
          .from("call_ai_notes")
          .upsert(rows, { onConflict: "call_id" });
        if (error) console.error("Could not save call notes", error.message);
      }
      for (const r of rows) notes[r.call_id] = { note: r.note, followUp: r.follow_up };
      return { notes, error: null };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        console.error("Call notes: unreadable AI output", error.text?.slice(0, 300));
        return { notes, error: "The AI notes could not be read. They will be retried later." };
      }
      console.error("Call notes failed", error);
      const { status, message } = describeAiError(error);
      return { notes, error: message, paused: status === 402 || status === 403 };
    }
  });
