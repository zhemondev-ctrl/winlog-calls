import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getCallDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: call, error } = await db.from("call_logs").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error("Could not load this call.");
    if (!call) throw new Error("Call unavailable or you do not have access.");
    const { data: roles, error: roleError } = await db.from("user_roles").select("role").eq("user_id", context.userId);
    if (roleError) throw new Error("Could not check note access.");
    const manager = (roles ?? []).some(r => r.role === "admin");
    const { data: profile, error: profileError } = await db.from("profiles").select("display_name").eq("id", call.user_id).maybeSingle();
    if (profileError) throw new Error("Could not load staff attribution.");
    const noteResult = manager ? await db.from("call_ai_notes").select("note,follow_up,generated_at,resolved_at").eq("call_id", call.id).maybeSingle() : { data: null, error: null };
    if (noteResult.error) throw new Error("Could not load saved notes.");
    const { data: cases, error: caseError } = await db.from("support_tickets").select("id,subject,status").eq("call_id", call.id).is("merged_into", null).limit(20);
    if (caseError) throw new Error("Could not load linked support cases.");
    return { call, staff: profile?.display_name ?? "Staff name unavailable", note: noteResult.data, manager, cases: cases ?? [] };
  });