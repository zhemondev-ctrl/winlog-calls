import { describe, it, expect, vi } from "vitest";
const auth = vi.hoisted(() => ({ marker: {}, attached: false }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: auth.marker }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: (m: unknown[]) => { auth.attached = m.includes(auth.marker); return builder; }, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
import { getCallDetail } from "./call-detail.functions";
const id = "11111111-1111-4111-8111-111111111111";
async function run(call: unknown, role = "user") {
  const tables: string[] = [];
  const db = { from: (table: string) => {
    tables.push(table);
    const result = { data: table === "call_logs" ? call : table === "user_roles" ? [{role}] : table === "profiles" ? {display_name:"Agent"} : table === "call_ai_notes" ? {note:"AI",follow_up:true} : [], error: null };
    const chain: Record<string, unknown> = {};
    for (const key of ["select","eq","is"]) chain[key] = () => chain;
    for (const key of ["maybeSingle","limit","then"]) chain[key] = key === "then" ? (resolve: (r: unknown) => void) => resolve(result) : () => Promise.resolve(result);
    return chain;
  } };
  const fn = getCallDetail as unknown as (args: unknown) => Promise<{note: unknown; staff: string}>;
  return { tables, result: await fn({data:{id},context:{supabase:db,userId:id}}) };
}
describe("private call detail reads", () => {
  it("requires authenticated middleware", () => expect(auth.attached).toBe(true));
  it("rejects absent or RLS-hidden calls", async () => { await expect(run(null)).rejects.toThrow("Call unavailable"); });
  it("does not fetch manager AI notes for staff", async () => { const r = await run({id,user_id:id}); expect(r.tables).not.toContain("call_ai_notes"); expect(r.result.note).toBeNull(); });
  it("reads existing AI notes for managers without generating new ones", async () => { const r = await run({id,user_id:id},"admin"); expect(r.tables).toContain("call_ai_notes"); expect(r.result.note).toEqual({note:"AI",follow_up:true}); });
});