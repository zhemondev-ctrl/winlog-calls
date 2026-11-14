import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Play } from "lucide-react";
import { getCallAiStatus, runCallAi, resumeCallAi } from "@/lib/support/call-ai.functions";
export function CallAiStatus({ teamId, admin }: { teamId: string; admin: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["support", "call-ai", teamId],
    queryFn: () => getCallAiStatus({ data: { teamId } }),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  const run = useServerFn(runCallAi);
  const resume = useServerFn(resumeCallAi);
  const work = useMutation({
    mutationFn: () => run({ data: { teamId } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const unpause = useMutation({
    mutationFn: () => resume({ data: { teamId } }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["support"] }),
    onError: (e) => toast.error(e.message),
  });
  if (q.isPending) return <p>Loading call AI status…</p>;
  if (q.error) return <p role="alert">{q.error.message}</p>;
  const data = q.data;
  if (!data) return null;
  return (
    <section className="border-t border-border pt-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Sparkles className="size-4 text-gold" />
        Live call summaries & reply drafts
      </h2>
      <p className="text-sm">
        {data.configured
          ? "Lovable AI connected · GPT-6 Astra"
          : "Live AI unavailable · no demo output will be generated"}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Uploaded team calls are queued once, including closed-app uploads. No call recording or
        transcript is available. Replies remain drafts until approved.
      </p>
      {data.control?.paused && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Paused: {data.control.pause_reason}
        </p>
      )}
      <div className="my-4 flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={work.isPending || data.control?.paused || !data.configured}
          onClick={() => work.mutate()}
        >
          <Play />
          {work.isPending ? "Analyzing…" : "Process next call"}
        </Button>
        {admin && data.control?.paused && (
          <Button
            variant="outline"
            disabled={unpause.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Confirm provider access or credits are restored. Unknown and failed calls will not be replayed automatically.",
                )
              )
                unpause.mutate();
            }}
          >
            Resume pending calls
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Last successful analysis:{" "}
        {data.control?.last_success_at
          ? new Date(data.control.last_success_at).toLocaleString()
          : "None yet"}
      </p>
      {!data.jobs.length ? (
        <p className="mt-3 text-sm text-muted-foreground">No uploaded team calls yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {data.jobs.map((j) => (
            <li key={j.id} className="py-3 text-sm">
              <span className="capitalize">{j.state}</span> ·{" "}
              {new Date(j.created_at).toLocaleString()}
              {j.ticket_id && (
                <Link
                  className="ml-2 underline"
                  to="/support-case/$ticketId"
                  params={{ ticketId: j.ticket_id }}
                >
                  Open call case
                </Link>
              )}
              {j.error && <p className="mt-1 text-xs text-destructive">{j.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
