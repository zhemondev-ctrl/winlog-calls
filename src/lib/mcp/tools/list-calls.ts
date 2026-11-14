import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "list_call_evidence", title: "List call evidence",
  description: "Read recent permitted device-reported calls and server receipt times, without contact numbers or AI inference.",
  inputSchema: { limit: z.number().int().min(1).max(100).default(25), source: z.enum(["sim", "whatsapp"]).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, source }, ctx) => {
    const db = supabaseForUser(ctx);
    let query = db.from("call_logs").select("id,source,direction,started_at,created_at,duration_seconds")
      .order("started_at", { ascending: false }).limit(limit);
    if (source) query = query.eq("source", source);
    const { data, error } = await query;
    if (error) throw new ToolError("Call records could not be loaded.");
    const calls = (data ?? []).map(c => ({ ...c, evidence: c.source === "sim" ? "Device CallLog report" : "WhatsApp notification inference", receipt: "Server stored record; real-device acceptance not established" }));
    return { content: [{ type: "text", text: calls.length ? JSON.stringify(calls) : "No permitted call records found." }], structuredContent: { calls } };
  },
});