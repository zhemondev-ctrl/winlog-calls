import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/winlog/app-shell";
import { CallItem } from "@/components/winlog/call-item";
import { SetupBanner } from "@/components/winlog/setup-banner";
import { Segmented } from "@/components/winlog/segmented";
import { StatCard } from "@/components/winlog/stat-card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { computeStats, dailySeries, formatDuration, startOfDay, startOfWeek } from "@/lib/calls";
import { callsQuery, meQuery, profilesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Today — WinLog" },
      {
        name: "description",
        content: "Today's and this week's calls, talk time and missed calls across company phones.",
      },
      { property: "og:title", content: "Today — WinLog" },
      {
        property: "og:description",
        content: "Daily and weekly call stats from every company phone.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: Dashboard,
});

const chartConfig = {
  incoming: { label: "Incoming", color: "var(--incoming)" },
  outgoing: { label: "Outgoing", color: "var(--outgoing)" },
  missed: { label: "Missed", color: "var(--missed)" },
} satisfies ChartConfig;

function Dashboard() {
  const { data: me } = useSuspenseQuery(meQuery);
  const [period, setPeriod] = useState<"today" | "week">("today");
  const [scope, setScope] = useState<"all" | "me">("all");

  const range = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return {
      weekStart,
      from: weekStart.toISOString(),
      to: end.toISOString(),
      todayStart: startOfDay(now),
    };
  }, []);

  const userId = me?.isAdmin && scope === "all" ? null : me?.userId;
  const { data: weekCalls = [], isLoading } = useQuery(
    callsQuery({ from: range.from, to: range.to, userId }),
  );
  const { data: profiles = [] } = useQuery({ ...profilesQuery, enabled: !!me?.isAdmin });
  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.display_name])), [profiles]);

  const todayCalls = useMemo(
    () => weekCalls.filter((c) => new Date(c.started_at) >= range.todayStart),
    [weekCalls, range.todayStart],
  );
  const shown = period === "today" ? todayCalls : weekCalls;
  const stats = computeStats(shown);
  const series = useMemo(
    () => dailySeries(weekCalls, range.weekStart, 7),
    [weekCalls, range.weekStart],
  );
  const showNames = me?.isAdmin && scope === "all";

  return (
    <AppShell
      title={period === "today" ? "Today" : "This week"}
      kicker={new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    >
      <SetupBanner />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "This week" },
          ]}
        />
        {me?.isAdmin && (
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: "All phones" },
              { value: "me", label: "Only me" },
            ]}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Calls"
          value={isLoading ? "…" : stats.total}
          tone="accent"
          hint={`${stats.incoming} in · ${stats.outgoing} out`}
        />
        <StatCard
          label="Talk time"
          value={isLoading ? "…" : formatDuration(stats.talkSeconds)}
          hint="Connected calls only"
        />
        <StatCard
          label="Missed"
          value={isLoading ? "…" : stats.missed}
          tone="missed"
          hint="Missed, declined, blocked"
        />
        <StatCard
          label="WhatsApp"
          value={isLoading ? "…" : stats.whatsapp}
          tone="whatsapp"
          hint={`${stats.sim} SIM calls`}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Calls per day</h2>
          <span className="stamp text-muted-foreground">Mon – Sun</span>
        </div>
        <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
          <BarChart data={series} margin={{ left: -20, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="incoming" stackId="a" fill="var(--color-incoming)" />
            <Bar dataKey="outgoing" stackId="a" fill="var(--color-outgoing)" />
            <Bar dataKey="missed" stackId="a" fill="var(--color-missed)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="font-display text-lg font-bold">Latest calls</h2>
          <Link to="/calls" className="text-sm font-medium underline underline-offset-4">
            See all
          </Link>
        </div>
        {shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
            {isLoading
              ? "Loading calls…"
              : "No calls yet. Calls appear here once a phone with WinLog uploads them."}
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {shown.slice(0, 8).map((c) => (
              <CallItem
                key={c.id}
                call={c}
                employee={showNames ? names.get(c.user_id) : undefined}
              />
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
