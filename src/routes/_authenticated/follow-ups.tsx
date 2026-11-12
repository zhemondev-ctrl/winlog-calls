import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Phone } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/winlog/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { groupFollowUps, type FlaggedCall } from "@/lib/follow-ups";
import { meQuery, profilesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/follow-ups")({
  head: () => ({
    meta: [
      { title: "Follow-ups — WinLog" },
      { name: "description", content: "Calls the AI flagged for a callback, grouped by contact." },
      { property: "og:title", content: "Follow-ups — WinLog" },
      { property: "og:description", content: "Manager queue of calls that need a follow-up." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: FollowUpsPage,
});

interface ResolvedFlaggedCall extends FlaggedCall {
  resolved_at: string;
  resolved_by: string | null;
}

const followUpsQuery = {
  queryKey: ["follow-ups"],
  queryFn: async (): Promise<FlaggedCall[]> => {
    const { data, error } = await supabase
      .from("call_ai_notes")
      .select(
        "call_id, note, call_logs!inner(user_id, phone_number, contact_name, direction, started_at)",
      )
      .eq("follow_up", true)
      .is("resolved_at", null)
      .order("generated_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((r) => ({ call_id: r.call_id, note: r.note, ...r.call_logs }));
  },
};

const resolvedFollowUpsQuery = {
  queryKey: ["follow-ups-resolved"],
  queryFn: async (): Promise<ResolvedFlaggedCall[]> => {
    const { data, error } = await supabase
      .from("call_ai_notes")
      .select(
        "call_id, note, resolved_at, resolved_by, call_logs!inner(user_id, phone_number, contact_name, direction, started_at)",
      )
      .eq("follow_up", true)
      .not("resolved_at", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      call_id: r.call_id,
      note: r.note,
      resolved_at: r.resolved_at!,
      resolved_by: r.resolved_by,
      ...r.call_logs,
    }));
  },
};

function FollowUpsPage() {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const { data: flagged = [], isLoading } = useQuery({ ...followUpsQuery, enabled: !!me?.isAdmin });
  const { data: resolved = [] } = useQuery({ ...resolvedFollowUpsQuery, enabled: !!me?.isAdmin });
  const { data: profiles = [] } = useQuery({ ...profilesQuery, enabled: !!me?.isAdmin });
  const groups = useMemo(() => groupFollowUps(flagged), [flagged]);
  const history = useMemo(() => {
    const sorted = [...resolved].sort(
      (a, b) => Date.parse(b.resolved_at) - Date.parse(a.resolved_at),
    );
    return groupFollowUps(sorted).map((g) => {
      const items = sorted.filter((c) => g.callIds.includes(c.call_id));
      return { ...g, resolvedAt: items[0]?.resolved_at ?? "", resolvedBy: items[0]?.resolved_by ?? null };
    });
  }, [resolved]);
  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.display_name])), [profiles]);

  const resolve = useMutation({
    mutationFn: async (callIds: string[]) => {
      const { error } = await supabase
        .from("call_ai_notes")
        .update({ resolved_at: new Date().toISOString(), resolved_by: me?.userId ?? null })
        .in("call_id", callIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked resolved");
      void qc.invalidateQueries({ queryKey: ["follow-ups"] });
      void qc.invalidateQueries({ queryKey: ["follow-ups-resolved"] });
    },
    onError: () => toast.error("Could not mark this resolved. Try again."),
  });

  if (!me?.isAdmin) {
    return (
      <AppShell title="Follow-ups" kicker="Managers">
        <p className="text-muted-foreground">Only managers can see the follow-up queue.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Follow-ups" kicker={`${groups.length} open`}>
      <div className="max-w-2xl space-y-3">
        <p className="text-sm text-muted-foreground">
          Contacts the AI flagged for a callback on the{" "}
          <Link to="/calls" className="underline">
            Calls
          </Link>{" "}
          page. If a contact calls again, their follow-up is checked again.
        </p>
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!isLoading && groups.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
            <Check className="mx-auto mb-2 size-6 text-incoming" />
            <div className="font-semibold">Nothing to follow up</div>
            <p className="text-sm text-muted-foreground">New flags appear as calls get AI notes.</p>
          </div>
        )}
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.key} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{g.contact}</div>
                  {g.phone && g.phone !== g.contact && (
                    <div className="text-xs text-muted-foreground">{g.phone}</div>
                  )}
                  <p className="mt-1 text-sm">{g.note}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {g.callIds.length} flagged {g.callIds.length === 1 ? "call" : "calls"} · last{" "}
                    {new Date(g.latestAt).toLocaleString()} ·{" "}
                    {g.staffIds.map((id) => names.get(id) || "Staff").join(", ")}
                  </div>
                </div>
                {g.phone && (
                  <a
                    href={`tel:${g.phone}`}
                    aria-label={`Call ${g.contact}`}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary"
                  >
                    <Phone className="size-4" />
                  </a>
                )}
              </div>
              <Button
                variant="outline"
                className="mt-3 w-full rounded-full"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate(g.callIds)}
              >
                <Check /> Mark resolved
              </Button>
            </li>
          ))}
        </ul>
        {history.length > 0 && (
          <section className="pt-4">
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              History · {history.length} resolved
            </h2>
            <ul className="space-y-3">
              {history.map((g) => (
                <li
                  key={g.key}
                  className="rounded-2xl border border-border bg-card p-4 opacity-80 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-incoming" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{g.contact}</div>
                      {g.phone && g.phone !== g.contact && (
                        <div className="text-xs text-muted-foreground">{g.phone}</div>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">{g.note}</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Resolved {new Date(g.resolvedAt).toLocaleString()}
                        {g.resolvedBy ? ` by ${names.get(g.resolvedBy) || "Manager"}` : ""} ·{" "}
                        {g.callIds.length} {g.callIds.length === 1 ? "call" : "calls"} ·{" "}
                        {g.staffIds.map((id) => names.get(id) || "Staff").join(", ")}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
