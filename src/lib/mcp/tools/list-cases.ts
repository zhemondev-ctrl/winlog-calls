import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "list_support_cases", title: "List support cases",
  description: "Read a bounded list of support cases accessible through your existing team permissions.",
  inputSchema: { limit: z.number().int().min(1).max(100).default(25), status: z.enum(["new", "open", "pending", "escalated", "resolved"]).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    const db = supabaseForUser(ctx);
    let query = db.from("support_tickets").select("id,subject,status,priority,channel,category,sla_due_at,created_at")
      .is("merged_into", null).order("created_at", { ascending: false }).limit(limit);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new ToolError("Support cases could not be loaded.");
    const cases = (data ?? []).map(c => ({ ...c }));
    return { content: [{ type: "text", text: cases.length ? JSON.stringify(cases) : "No permitted cases found." }], structuredContent: { cases } };
  },
});