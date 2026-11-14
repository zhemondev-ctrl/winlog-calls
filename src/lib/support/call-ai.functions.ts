import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const schema = z.object({ teamId: z.string().uuid() });
export const getCallAiStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.rpc("support_role", { _team: data.teamId });
    if (!["admin", "manager"].includes(role ?? "")) throw new Error("Manager access required");
    const [{ data: control, error }, { data: jobs, error: jobError }] = await Promise.all([
      context.supabase
        .from("support_call_ai_control")
        .select("*")
        .eq("team_id", data.teamId)
        .maybeSingle(),
      context.supabase
        .from("support_call_ai_jobs")
        .select("id,state,error,created_at,completed_at,ticket_id")
        .eq("team_id", data.teamId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (error || jobError) throw new Error("Could not load call AI status");
    return { control, jobs: jobs ?? [], configured: Boolean(process.env["LOVABLE_API_KEY"]) };
  });
export const runCallAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.rpc("support_role", { _team: data.teamId });
    if (!["admin", "manager"].includes(role ?? "")) throw new Error("Manager access required");
    const { processCallAi } = await import("./call-ai.server");
    return processCallAi(data.teamId);
  });
export const resumeCallAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.rpc("support_role", { _team: data.teamId });
    if (role !== "admin") throw new Error("Admin access required");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db
      .from("support_call_ai_control")
      .update({ paused: false, pause_reason: null })
      .eq("team_id", data.teamId)
      .or("lease_until.is.null,lease_until.lt." + new Date().toISOString());
    if (error) throw new Error("Could not resume");
    return { ok: true };
  });
// Upload success, not page rendering, wakes one bounded job per user's team.
export const wakeUploadedCallAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: members, error } = await context.supabase
      .from("support_members")
      .select("team_id")
      .eq("user_id", context.userId)
      .limit(1);
    if (error) throw new Error("Could not find call support team");
    const member = members?.[0];
    if (!member) return { processed: 0 };
    const { processCallAi } = await import("./call-ai.server");
    return processCallAi(member.team_id);
  });
