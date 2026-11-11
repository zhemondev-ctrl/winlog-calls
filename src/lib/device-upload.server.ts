// Server-only: receives calls sent by the Android app in the background with its device upload key.
import { z } from "zod";

import { sha256Hex } from "@/lib/device-keys.functions";

const DIRECTIONS = ["incoming", "outgoing", "missed", "rejected", "blocked", "unknown"] as const;

export const deviceCallSchema = z.object({
  source: z.enum(["sim", "whatsapp"]),
  external_id: z.string().min(1).max(128),
  direction: z.enum(DIRECTIONS).catch("unknown"),
  phone_number: z.string().max(64).nullable().optional(),
  contact_name: z.string().max(200).nullable().optional(),
  started_at: z.string().datetime({ offset: true }),
  duration_seconds: z.number().int().min(0).max(7 * 86_400),
  is_video: z.boolean().optional(),
  sim_label: z.string().max(120).nullable().optional(),
});

export const deviceUploadSchema = z.object({
  device_name: z.string().max(120).nullable().optional(),
  calls: z.array(deviceCallSchema).max(500),
});

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

export async function handleDeviceUpload(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!/^wlk_[0-9a-f]{64}$/.test(token)) return json(401, { error: "Missing or invalid upload key" });

  let body: z.infer<typeof deviceUploadSchema>;
  try {
    body = deviceUploadSchema.parse(await request.json());
  } catch (e) {
    return json(400, { error: "Invalid upload", detail: e instanceof z.ZodError ? e.issues.slice(0, 3) : undefined });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: key, error: keyError } = await supabaseAdmin
    .from("device_upload_tokens")
    .select("id, user_id, device_id")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (keyError) return json(500, { error: "Could not check upload key" });
  if (!key) return json(401, { error: "Upload key is not recognised. Open WinLog and sign in again." });

  // The key decides whose calls these are; nothing in the body can change the owner or phone.
  const rows = body.calls.map((c) => ({
    user_id: key.user_id,
    device_id: key.device_id,
    device_name: body.device_name ?? null,
    source: c.source,
    external_id: c.external_id,
    direction: c.direction,
    phone_number: c.phone_number || null,
    contact_name: c.contact_name || null,
    started_at: new Date(c.started_at).toISOString(),
    duration_seconds: c.duration_seconds,
    is_video: Boolean(c.is_video),
    sim_label: c.sim_label || null,
  }));

  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from("call_logs").upsert(rows, {
      onConflict: "user_id,device_id,source,external_id",
      ignoreDuplicates: true,
    });
    if (error) {
      console.error("Device upload failed", error.message);
      return json(500, { error: "Could not save calls" });
    }
  }
  await supabaseAdmin
    .from("device_upload_tokens")
    .update({ last_used_at: new Date().toISOString(), ...(body.device_name ? { device_name: body.device_name } : {}) })
    .eq("id", key.id);

  return json(200, { received: rows.length });
}
