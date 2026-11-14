import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/winlog/app-shell";
import { CallItem } from "@/components/winlog/call-item";
import { DailyDigest } from "@/components/winlog/daily-digest";
import { SetupBanner } from "@/components/winlog/setup-banner";
import { PhoneUploadStatus } from "@/components/winlog/phone-upload-status";
import { Segmented } from "@/components/winlog/segmented";
import { StatCard } from "@/components/winlog/stat-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      { title: "Agent dashboard — WinLog" },
      {
        name: "description",
        content: "Today's and this week's calls, talk time and missed calls across company phones.",
      },
      { property: "og:title", content: "Agent dashboard — WinLog" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

const uploadConfig = {
  sim: { label: "SIM", color: "var(--primary)" },
  whatsapp: { label: "WhatsApp", color: "var(--whatsapp)" },
} satisfies ChartConfig;

function Dashboard() {
  const { data: me } = useSuspenseQuery(meQuery);
  const [period, setPeriod] = useState<"today" | "week">("today");
  const [agent, setAgent] = useState("all");

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

  const userId = me?.isAdmin ? (agent === "all" ? null : agent) : me?.userId;
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
  const uploads = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(range.weekStart);
      d.setDate(d.getDate() + i);
      return { label: d.toLocaleDateString(undefined, { weekday: "short" }), sim: 0, whatsapp: 0 };
    });
    for (const c of weekCalls) {
      const i = Math.floor((startOfDay(new Date(c.created_at)).getTime() - range.weekStart.getTime()) / 86400000);
      const day = days[i];
      if (i >= 0 && i < 7 && day) day[c.source === "whatsapp" ? "whatsapp" : "sim"] += 1;
    }
    return days;
  }, [weekCalls, range.weekStart]);
  const showNames = me?.isAdmin && agent === "all";
  const selectedName = me?.isAdmin && agent === "all" ? "All agents" : names.get(agent) || me?.displayName;
  const latestUpload = shown.reduce<string | null>((latest, call) => !latest || call.created_at > latest ? call.created_at : latest, null);

  return (
    <AppShell
      title={me?.isAdmin ? "Agent dashboard" : "My dashboard"}
      kicker={new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    >
      <SetupBanner />
      <PhoneUploadStatus />
      {me?.isAdmin && <DailyDigest />}

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
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className="w-full bg-card sm:w-64" aria-label="Agent"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {profiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.display_name || "Unnamed agent"}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <section className="mb-6 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
        <div className="min-w-0">
          <h2 className="break-words font-semibold">{selectedName}</h2>
          <p className="text-sm text-muted-foreground">{me?.isAdmin ? "Manager view" : "Agent"}{!me?.isAdmin && me?.email ? ` · ${me.email}` : ""}</p>
          <p className="mt-1 text-xs text-muted-foreground">Latest call received: {latestUpload ? new Date(latestUpload).toLocaleString() : "No uploads yet"}</p>
        </div>
        <Button asChild variant="outline"><Link to="/sync">Sync status</Link></Button>
      </section>

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

      <section className="mt-6 border-y border-border py-5">
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

      <section className="mt-6 border-b border-border pb-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Calls uploaded per day</h2>
          <span className="stamp text-muted-foreground">Goal metric</span>
        </div>
        <ChartContainer config={uploadConfig} className="aspect-auto h-56 w-full">
          <BarChart data={uploads} margin={{ left: -20, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="sim" stackId="u" fill="var(--color-sim)" />
            <Bar dataKey="whatsapp" stackId="u" fill="var(--color-whatsapp)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="font-display text-lg font-bold">Agent call details</h2>
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
          <ul className="divide-y divide-border border-y border-border">
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
