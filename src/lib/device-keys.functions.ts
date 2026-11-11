import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/hash";

/**
 * Gives this phone its own upload key so it can keep sending calls while the app is closed.
 * Only a hash is stored; registering again replaces the phone's previous key.
 */
export const registerDeviceKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        deviceId: z.string().min(1).max(128),
        deviceName: z.string().max(120).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = "wlk_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await context.supabase.from("device_upload_tokens").upsert(
      {
        user_id: context.userId,
        device_id: data.deviceId,
        device_name: data.deviceName ?? null,
        token_hash: await sha256Hex(token),
        created_at: new Date().toISOString(),
        last_used_at: null,
      },
      { onConflict: "user_id,device_id" },
    );
    if (error) throw new Error(`Could not register this phone: ${error.message}`);
    return { token, userId: context.userId };
  });

/** Stops background uploads from this phone (used on sign-out). */
export const revokeDeviceKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ deviceId: z.string().min(1).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("device_upload_tokens")
      .delete()
      .eq("user_id", context.userId)
      .eq("device_id", data.deviceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
