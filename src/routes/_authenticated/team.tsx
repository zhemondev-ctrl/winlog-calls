import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/winlog/app-shell";
import { Segmented } from "@/components/winlog/segmented";
import { computeStats, formatDuration, startOfDay, startOfWeek, type CallRow } from "@/lib/calls";
import { callsQuery, meQuery, profilesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — WinLog" },
      { name: "description", content: "Calls, talk time and missed calls for each employee's phone." },
      { property: "og:title", content: "Team — WinLog" },
      { property: "og:description", content: "Per-employee call stats for the manager." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: TeamPage,
});

function TeamPage() {
  const { data: me } = useSuspenseQuery(meQuery);
  const [period, setPeriod] = useState<"today" | "week">("week");
  const range = useMemo(() => {
    const now = new Date();
    const from = period === "today" ? startOfDay(now) : startOfWeek(now);
    return { from: from.toISOString(), to: new Date(Date.now() + 60_000).toISOString() };
  }, [period]);

  const { data: calls = [], isLoading } = useQuery({ ...callsQuery({ ...range, userId: null }), enabled: !!me?.isAdmin });
  const { data: profiles = [] } = useQuery({ ...profilesQuery, enabled: !!me?.isAdmin });

  const rows = useMemo(() => {
    const byUser = new Map<string, CallRow[]>();
    for (const c of calls) {
      const list = byUser.get(c.user_id) ?? [];
      list.push(c);
      byUser.set(c.user_id, list);
    }
    return profiles
      .map((p) => {
        const list = byUser.get(p.id) ?? [];
        const devices = new Set(list.map((c) => c.device_name).filter(Boolean));
        return {
          id: p.id,
          name: p.display_name || "Unnamed",
          stats: computeStats(list),
          last: list[0]?.started_at ?? null,
          devices: [...devices].join(", "),
        };
      })
      .sort((a, b) => b.stats.total - a.stats.total);
  }, [calls, profiles]);

  if (!me?.isAdmin) {
    return (
      <AppShell title="Team">
        <p className="text-muted-foreground">Only managers can see the whole team.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Team" kicker={`${profiles.length} people`}>
      <div className="mb-4">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "This week" },
          ]}
        />
      </div>
      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r, i) => (
            <article
              key={r.id}
              className="animate-rise rounded-2xl border border-border bg-card p-4 shadow-card"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="truncate font-display text-lg font-bold">{r.name}</h2>
                <span className="stamp shrink-0 text-muted-foreground">
                  {r.last
                    ? `Last ${new Date(r.last).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
                    : "No calls"}
                </span>
              </div>
              {r.devices && <div className="text-xs text-muted-foreground">{r.devices}</div>}
              <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Metric label="Calls" value={r.stats.total} />
                <Metric label="Talk" value={formatDuration(r.stats.talkSeconds)} />
                <Metric label="Missed" value={r.stats.missed} className="text-missed" />
                <Metric label="WhatsApp" value={r.stats.whatsapp} className="text-whatsapp" />
              </dl>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Metric({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="rounded-xl bg-secondary px-1 py-2">
      <dd className={`num text-base font-semibold ${className ?? ""}`}>{value}</dd>
      <dt className="stamp mt-0.5 !text-[9px] text-muted-foreground">{label}</dt>
    </div>
  );
}
