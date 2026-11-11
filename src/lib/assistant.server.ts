// Server-only: the manager AI assistant. Loads the conversation and the team's recent calls,
// asks the model through Lovable AI Gateway, streams the answer back and saves both turns.
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-run-id.server";
import { buildCallDigest, safeTimeZone, type DigestCall } from "@/lib/call-digest";
import { userClientFromRequest } from "@/lib/user-client.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
const DIGEST_DAYS = 30;
const MAX_HISTORY = 40;

const bodySchema = z.object({
  threadId: z.string().uuid(),
  timeZone: z.string().max(64).optional(),
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.any()).max(50),
      }),
    )
    .min(1)
    .max(400),
});

const INSTRUCTIONS = `You are the WinLog call-activity assistant for a manager at Winstone Properties Ltd.
You only know the team call data provided below (SIM and WhatsApp calls logged from company phones).
- Answer the manager's question directly and briefly, using concrete names, numbers, times and contacts from the data.
- When useful, summarise patterns (who is busiest, missed-call trends, talk time, busy hours) and finish with a short "Follow-ups" list: specific people or numbers to call back and why.
- WhatsApp calls are captured from notifications, so they never include phone numbers and may miss some calls; say so if it matters.
- If the data cannot answer the question, say what is missing instead of guessing. Never invent calls or numbers.
- Use short markdown: headings only when needed, bullet lists, and small tables for comparisons.`;

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

/** Saved messages are replayed as plain text turns; stored reasoning is display-only. */
function forModel(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.filter((p) => p.type === "text"),
  })).filter((m) => m.parts.length > 0);
}

export async function handleAssistant(request: Request): Promise<Response> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "AI is not configured for this app.");

  const user = await userClientFromRequest(request);
  if (!user) return json(401, "Please sign in again.");
  const { supabase, userId } = user;

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return json(403, "Only managers can use the assistant.");

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return json(400, "That message could not be read. Please try again.");
  }

  const latest = body.messages[body.messages.length - 1]!;
  const latestText = latest.parts
    .map((p: { type?: string; text?: string }) => (p?.type === "text" ? (p.text ?? "") : ""))
    .join("")
    .trim();
  if (latest.role !== "user" || !latestText) return json(400, "Type a question first.");
  if (latestText.length > 4000) return json(400, "Please keep questions under 4,000 characters.");

  const { data: thread } = await supabase
    .from("assistant_threads")
    .select("id, title")
    .eq("id", body.threadId)
    .maybeSingle();
  if (!thread) return json(404, "This conversation was not found.");

  // History comes from the database, not the browser; only the newest question is taken from the request.
  const { data: saved, error: savedError } = await supabase
    .from("assistant_messages")
    .select("ui_id, role, parts")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });
  if (savedError) return json(500, "Could not load this conversation.");

  const history: UIMessage[] = (saved ?? [])
    .filter((m) => m.ui_id !== latest.id)
    .map((m) => ({ id: m.ui_id, role: m.role as UIMessage["role"], parts: m.parts as UIMessage["parts"] }));
  const userMessage: UIMessage = { id: latest.id, role: "user", parts: [{ type: "text", text: latestText }] };
  const originalMessages = [...history, userMessage];

  const { error: saveUserError } = await supabase.from("assistant_messages").upsert(
    { thread_id: thread.id, user_id: userId, ui_id: userMessage.id, role: "user", parts: userMessage.parts as unknown as Json },
    { onConflict: "thread_id,ui_id" },
  );
  if (saveUserError) return json(500, "Could not save your question.");

  const title = thread.title === "New conversation" ? latestText.slice(0, 70) : thread.title;
  await supabase
    .from("assistant_threads")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", thread.id);

  // Team call data for the period (managers can read every employee's calls).
  const now = new Date();
  const from = new Date(now.getTime() - DIGEST_DAYS * 86_400_000).toISOString();
  const calls: DigestCall[] = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const { data, error } = await supabase
      .from("call_logs")
      .select("user_id, source, direction, phone_number, contact_name, started_at, duration_seconds, is_video")
      .gte("started_at", from)
      .order("started_at", { ascending: false })
      .range(offset, offset + 999);
    if (error) return json(500, "Could not load team calls.");
    calls.push(...((data ?? []) as DigestCall[]));
    if (!data || data.length < 1000) break;
  }
  const { data: people } = await supabase.from("profiles").select("id, display_name");
  const digest = buildCallDigest(
    calls,
    (people ?? []).map((p) => ({ id: p.id, name: p.display_name })),
    { now, timeZone: safeTimeZone(body.timeZone), days: DIGEST_DAYS },
  );

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions: `${INSTRUCTIONS}\n\n# Team call data\n${digest}`,
    messages: await convertToModelMessages(forModel(originalMessages).slice(-MAX_HISTORY)),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages,
    sendReasoning: true,
    generateMessageId: () => crypto.randomUUID(),
    onError: (error) => {
      console.error("Assistant stream failed", error);
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 429) return "The AI is busy right now. Please wait a moment and try again.";
      if (status === 402) return "AI credits have run out for this workspace. Add credits to keep using the assistant.";
      if (status === 403) return "The AI service refused this request.";
      return "The assistant could not answer. Please try again.";
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (!responseMessage || responseMessage.role !== "assistant") return;
      const parts = responseMessage.parts.filter((p) => p.type === "text" || p.type === "reasoning");
      if (parts.length === 0) return;
      const { error } = await supabase.from("assistant_messages").upsert(
        { thread_id: thread.id, user_id: userId, ui_id: responseMessage.id, role: "assistant", parts: parts as unknown as Json },
        { onConflict: "thread_id,ui_id" },
      );
      if (error) console.error("Could not save assistant reply", error.message, { isAborted });
      await supabase.from("assistant_threads").update({ updated_at: new Date().toISOString() }).eq("id", thread.id);
    },
  });

  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
