import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

function publishableKey() {
  const direct = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (direct) return direct;
  try {
    const keys: unknown = JSON.parse(process.env["SUPABASE_PUBLISHABLE_KEYS"] ?? "{}");
    if (keys && typeof keys === "object") {
      const key = Object.values(keys).find((v): v is string => typeof v === "string" && v.startsWith("sb_publishable_"));
      if (key) return key;
    }
  } catch { /* A legacy key may still be available. */ }
  return process.env["SUPABASE_ANON_KEY"] ?? import.meta.env["VITE_SUPABASE_ANON_KEY"];
}

export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!ctx.isAuthenticated() || !token) throw new Error("Sign in to Winlog Calls first.");
  const url = process.env["SUPABASE_URL"] ?? import.meta.env["VITE_SUPABASE_URL"];
  const key = publishableKey();
  if (!url || !key) throw new Error("Account connection is unavailable.");
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}