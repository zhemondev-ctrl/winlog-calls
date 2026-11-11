import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createThread, deleteThread, threadsQuery } from "@/lib/assistant-queries";
import { cn } from "@/lib/utils";

/** Saved assistant conversations, newest first, plus a "new conversation" action. */
export function AssistantThreads({
  activeId,
  className,
}: {
  activeId?: string;
  className?: string;
}) {
  const { data: threads = [], isLoading } = useQuery(threadsQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  async function startNew() {
    setCreating(true);
    try {
      const id = await createThread();
      await queryClient.invalidateQueries({ queryKey: ["assistant", "threads"] });
      navigate({ to: "/assistant/$threadId", params: { threadId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start a conversation");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteThread(id);
      await queryClient.invalidateQueries({ queryKey: ["assistant", "threads"] });
      if (id === activeId) navigate({ to: "/assistant" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <aside className={cn("flex flex-col gap-3", className)}>
      <Button variant="ink" onClick={startNew} disabled={creating} className="w-full">
        <Plus /> New conversation
      </Button>
      <div className="stamp px-1 text-muted-foreground">Saved conversations</div>
      <ul className="space-y-1">
        {isLoading && <li className="px-3 py-2 text-sm text-muted-foreground">Loading…</li>}
        {!isLoading && threads.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">None yet.</li>
        )}
        {threads.map((t) => (
          <li
            key={t.id}
            className={cn(
              "group flex items-center gap-1 rounded-xl border border-transparent pr-1 transition-colors",
              t.id === activeId ? "border-gold bg-card shadow-card" : "hover:bg-card/70",
            )}
          >
            <Link
              to="/assistant/$threadId"
              params={{ threadId: t.id }}
              className="min-w-0 flex-1 px-3 py-2"
            >
              <div className="truncate text-sm font-medium">{t.title}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(t.updated_at).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </Link>
            <button
              type="button"
              onClick={() => void remove(t.id)}
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-60 transition hover:bg-secondary hover:text-destructive group-hover:opacity-100"
              aria-label={`Delete "${t.title}"`}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
