import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildCallDigest, safeTimeZone, type DigestCall } from "@/lib/call-digest";

const DAY = 86_400_000;
const INSTRUCTIONS = `You write a short morning recap of YESTERDAY's team calls for a manager at Winstone Properties Ltd.
Use only the data given. Plain text, at most 5 short bullet lines starting with "- ":
busiest staff, missed calls not returned, notable clients, and the top 1-2 follow-ups. If there were no calls yesterday, say so in one line.`;

/** Yesterday's AI recap for managers; saved per day so each day costs one model call. */
export const getDailyDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ timeZone: z.string().max(64).optional(), refresh: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { summary: null as string | null, day: null as string | null, error: null as string | null };

    const tz = safeTimeZone(data.timeZone);
    const now = new Date();
    const day = new Date(now.getTime() - DAY).toLocaleDateString("en-CA", { timeZone: tz });

    if (!data.refresh) {
      const { data: saved } = await supabase.from("daily_digests").select("summary").eq("day", day).maybeSingle();
      if (saved) return { summary: saved.summary, day, error: null };
    }

    const { data: calls, error } = await supabase
      .from("call_logs")
      .select("user_id, source, direction, phone_number, contact_name, started_at, duration_seconds, is_video")
      .gte("started_at", new Date(now.getTime() - 3 * DAY).toISOString())
      .order("started_at", { ascending: false })
      .limit(2000);
    if (error) return { summary: null, day, error: "Could not load team calls." };
    const { data: people } = await supabase.from("profiles").select("id, display_name");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { summary: null, day, error: "AI is not configured for this app." };
    const [{ generateText }, { createGatewayModel, LOW_REASONING, describeAiError }] = await Promise.all([
      import("ai"),
      import("@/lib/ai-gateway.server"),
    ]);
    const digest = buildCallDigest(
      (calls ?? []) as DigestCall[],
      (people ?? []).map((p) => ({ id: p.id, name: p.display_name ?? "" })),
      { now, timeZone: tz, days: 3 },
    );
    try {
      const { model } = createGatewayModel(apiKey);
      const result = await generateText({
        model,
        system: INSTRUCTIONS,
        prompt: `Yesterday is ${day} (${tz}).\n\n${digest}`,
        providerOptions: LOW_REASONING,
      });
      const summary = result.text.trim().slice(0, 1500);
      await supabase.from("daily_digests").upsert({ day, summary, generated_at: now.toISOString() });
      return { summary, day, error: null };
    } catch (e) {
      console.error("Daily digest failed", e);
      return { summary: null, day, error: describeAiError(e).message };
    }
  });
