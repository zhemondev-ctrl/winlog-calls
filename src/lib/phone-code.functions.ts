import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/hash";
import { canEnrollStaff, normalizePhoneCode, PHONE_CODE_TTL_MS } from "@/lib/phone-code";

export const enrollmentStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: manager } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!manager) throw new Error("Manager access required");
    const [{ data: profiles, error }, { data: roles, error: roleError }] = await Promise.all([
      context.supabase.from("profiles").select("id, display_name").order("display_name"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    if (error || roleError) throw new Error("Could not load staff");
    const managers = new Set(roles?.filter(r => r.role === "admin").map(r => r.user_id));
    return (profiles ?? []).filter(p => !managers.has(p.id));
  });

export const issuePhoneCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ staffId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: manager } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!manager) throw new Error("Manager access required");
    const [{ data: staff }, { data: isManager }] = await Promise.all([
      context.supabase.from("profiles").select("id").eq("id", data.staffId).maybeSingle(),
      context.supabase.rpc("has_role", { _user_id: data.staffId, _role: "admin" }),
    ]);
    if (!canEnrollStaff(isManager === true, !!staff)) throw new Error("Select an existing staff member, not a manager");
    const code = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const expiresAt = new Date(Date.now() + PHONE_CODE_TTL_MS).toISOString();
    const { error } = await context.supabase.from("phone_setup_codes").insert({
      staff_id: data.staffId, issued_by: context.userId, token_hash: await sha256Hex(code), expires_at: expiresAt,
    });
    if (error) throw new Error("Could not create the company setup code");
    return { code, expiresAt };
  });

export const redeemPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ code: z.string().transform(normalizePhoneCode).pipe(z.string().regex(/^[A-F0-9]{32}$/)) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Atomic claim validates the unguessable, single-use secret before privileged identity lookup.
    const { data: staffId, error } = await supabaseAdmin.rpc("claim_phone_setup_code", { _hash: await sha256Hex(data.code) });
    if (error || !staffId) throw new Error("This company code is invalid, expired, or already used");
    const { data: identity } = await supabaseAdmin.auth.admin.getUserById(staffId);
    const email = identity.user?.email;
    if (!email) throw new Error("This staff account needs an email address");
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkError || !link.properties?.hashed_token) throw new Error("Ask your manager for a new setup code");
    return { token_hash: link.properties.hashed_token };
  });