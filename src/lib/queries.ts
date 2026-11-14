import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { CallRow } from "@/lib/calls";

export interface Me {
  userId: string;
  email: string | null;
  displayName: string;
  isAdmin: boolean;
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    return {
      userId: user.id,
      email: user.email ?? null,
      displayName: profile?.display_name || user.email?.split("@")[0] || "You",
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  },
});

export const profilesQuery = queryOptions({
  queryKey: ["profiles"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .order("display_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export interface CallFilter {
  from: string;
  to: string;
  userId?: string | null | undefined;
  dateField?: "started_at" | "created_at";
}

/** Fetches every call in the window, page by page (the backend returns at most 1000 rows per request). */
export async function fetchCalls(filter: CallFilter): Promise<CallRow[]> {
  const out: CallRow[] = [];
  const page = 1000;
  const dateField = filter.dateField ?? "started_at";
  for (let offset = 0; offset < 50_000; offset += page) {
    let q = supabase
      .from("call_logs")
      .select("*")
      .gte(dateField, filter.from)
      .lt(dateField, filter.to)
      .order(dateField, { ascending: false })
      .range(offset, offset + page - 1);
    if (filter.userId) q = q.eq("user_id", filter.userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as CallRow[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export function callsQuery(filter: CallFilter) {
  return queryOptions({
    queryKey: ["calls", filter.from, filter.to, filter.userId ?? "all", filter.dateField ?? "started_at"],
    queryFn: () => fetchCalls(filter),
  });
}

/** Chart receipts contain no contact or device details; RLS and arrival-day filtering are unchanged. */
export async function fetchUploadReceipts(filter: Omit<CallFilter, "dateField">) {
  const out: { created_at: string; source: string }[] = [];
  for (let offset = 0; offset < 50_000; offset += 1000) {
    let q = supabase.from("call_logs").select("created_at,source")
      .gte("created_at", filter.from).lt("created_at", filter.to)
      .order("created_at", { ascending: false }).range(offset, offset + 999);
    if (filter.userId) q = q.eq("user_id", filter.userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const uploadReceiptsQuery = (filter: Omit<CallFilter, "dateField">) => queryOptions({
  queryKey: ["calls", "upload-receipts", filter.from, filter.to, filter.userId ?? "all"],
  queryFn: () => fetchUploadReceipts(filter),
});
