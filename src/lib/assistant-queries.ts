import { queryOptions } from "@tanstack/react-query";
import type { UIMessage } from "ai";

import { supabase } from "@/integrations/supabase/client";

export interface AssistantThread {
  id: string;
  title: string;
  updated_at: string;
}

export const threadsQuery = queryOptions({
  queryKey: ["assistant", "threads"],
  queryFn: async (): Promise<AssistantThread[]> => {
    const { data, error } = await supabase
      .from("assistant_threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export function threadQuery(threadId: string) {
  return queryOptions({
    queryKey: ["assistant", "thread", threadId],
    queryFn: async (): Promise<{ thread: AssistantThread | null; messages: UIMessage[] }> => {
      const [{ data: thread, error: threadError }, { data: rows, error }] = await Promise.all([
        supabase
          .from("assistant_threads")
          .select("id, title, updated_at")
          .eq("id", threadId)
          .maybeSingle(),
        supabase
          .from("assistant_messages")
          .select("ui_id, role, parts")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true }),
      ]);
      if (threadError) throw new Error(threadError.message);
      if (error) throw new Error(error.message);
      return {
        thread,
        messages: (rows ?? []).map((r) => ({
          id: r.ui_id,
          role: r.role as UIMessage["role"],
          parts: r.parts as UIMessage["parts"],
        })),
      };
    },
    staleTime: 0,
  });
}

export async function createThread(): Promise<string> {
  const { data, error } = await supabase.from("assistant_threads").insert({}).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function deleteThread(id: string): Promise<void> {
  const { error } = await supabase.from("assistant_threads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export const STARTER_QUESTIONS = [
  "Summarise today's calls for the whole team",
  "Which missed calls still need a call back?",
  "Who had the most talk time this week, and who the least?",
  "Any unusual patterns in the last 7 days?",
];
