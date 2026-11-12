// Server-only: "Summarize call records" — managers upload, paste or pick call records and get a
// streamed activity summary with the calls that need follow-up.
import { streamText } from "ai";
import { z } from "zod";

import { createGatewayModel, describeAiError, LOW_REASONING } from "@/lib/ai-gateway.server";
import { withLovableAiGatewayRunIdHeader } from "@/lib/ai-run-id.server";
import { buildCallDigest, safeTimeZone, type DigestCall } from "@/lib/call-digest";
import { userClientFromRequest } from "@/lib/user-client.server";

/** Roughly 60k tokens of records; larger files must be split. */
export const MAX_RECORD_CHARS = 240_000;
const DAY = 86_400_000;

const bodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.enum(["upload", "paste"]),
    text: z.string().min(1).max(MAX_RECORD_CHARS),
    fileName: z.string().max(200).nullable(),
    timeZone: z.string().max(64).optional(),
  }),
  z.object({
    mode: z.literal("winlog"),
    userId: z.string().uuid().nullable(),
    from: z.string().datetime(),
    to: z.string().datetime(),
    timeZone: z.string().max(64).optional(),
  }),
]);

const INSTRUCTIONS = `You summarize team call records for a manager at Winstone Properties Ltd.
The records may come from WinLog, a phone export, a spreadsheet or pasted notes; columns can vary. Work out who called whom, when, direction (incoming/outgoing/missed) and talk time where present.
Reply in short markdown with exactly these sections:
## Summary
3-6 bullets: volume, busiest people and times, missed-call rate, talk time, notable changes.
## Calls needing follow-up
A table: Contact | Number | Staff | Last call | Why. Include missed or rejected calls nobody returned, repeat callers, very short calls that look cut off, and promised callbacks mentioned in notes. Newest first, at most 25 rows. If none, say so.
## Patterns
2-4 bullets of useful patterns or suggestions.
Rules: use only the records given; never invent names, numbers or calls. If a column is missing (e.g. no talk time), say what could not be judged. If the records are not call records, say so briefly.`;

function err(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function handleSummary(request: Request): Promise<Response> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return err(500, "AI is not configured for this app.");
  const user = await userClientFromRequest(request);
  if (!user) return err(401, "Please sign in again.");
  const { supabase, userId } = user;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return err(403, "Only managers can summarize team calls.");

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return err(400, "Those records could not be read. Files must be under about 240,000 characters.");
  }
  const tz = safeTimeZone(body.timeZone);
  let records: string;

  if (body.mode === "winlog") {
    const from = Date.parse(body.from);
    const to = Date.parse(body.to);
    if (!(to > from) || to - from > 92 * DAY) return err(400, "Pick a period of up to 3 months.");
    const calls: DigestCall[] = [];
    for (let offset = 0; offset < 10_000; offset += 1000) {
      let q = supabase
        .from("call_logs")
        .select("user_id, source, direction, phone_number, contact_name, started_at, duration_seconds, is_video")
        .gte("started_at", body.from)
        .lte("started_at", body.to);
      if (body.userId) q = q.eq("user_id", body.userId);
      const { data, error } = await q.order("started_at", { ascending: false }).range(offset, offset + 999);
      if (error) return err(500, "Could not load team calls.");
      calls.push(...((data ?? []) as DigestCall[]));
      if (!data || data.length < 1000) break;
    }
    if (calls.length === 0) return err(400, "No calls in that period. Pick another period or person.");
    const { data: people } = await supabase.from("profiles").select("id, display_name");
    const team = (people ?? []).map((p) => ({ id: p.id, name: p.display_name }));
    records = buildCallDigest(calls, body.userId ? team.filter((p) => p.id === body.userId) : team, {
      now: new Date(Math.min(to, Date.now())),
      timeZone: tz,
      days: Math.max(1, Math.round((to - from) / DAY)),
    });
  } else {
    records = `Source: ${body.mode === "upload" ? `uploaded file ${body.fileName ?? ""}` : "pasted text"}\nManager's time zone: ${tz}\n\n${body.text}`;
  }

  const { model, runIdFetch } = createGatewayModel(apiKey);
  const result = streamText({
    model,
    instructions: INSTRUCTIONS,
    prompt: `# Call records\n${records}`,
    abortSignal: request.signal,
    providerOptions: LOW_REASONING,
  });

  // Plain text stream; failures after the first byte arrive as a marked line the page shows.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) controller.enqueue(encoder.encode(chunk));
      } catch (e) {
        if (!request.signal.aborted) {
          console.error("Summary failed", e);
          controller.enqueue(encoder.encode(`\n\n[[error]]${describeAiError(e).message}`));
        }
      } finally {
        controller.close();
      }
    },
  });
  const response = new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
