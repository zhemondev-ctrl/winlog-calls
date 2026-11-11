import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/winlog/app-shell";
import { CallList } from "@/components/winlog/call-item";
import { Segmented } from "@/components/winlog/segmented";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeStats, formatDuration, isUnanswered, startOfDay } from "@/lib/calls";
import { callsQuery, meQuery, profilesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({
    meta: [
      { title: "Call log — WinLog" },
      {
        name: "description",
        content: "Every SIM and WhatsApp call from company phones, with talk time.",
      },
      { property: "og:title", content: "Call log — WinLog" },
      { property: "og:description", content: "Every SIM and WhatsApp call from company phones." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: CallsPage,
});

type Days = "1" | "7" | "30";

function CallsPage() {
  const { data: me } = useSuspenseQuery(meQuery);
  const [days, setDays] = useState<Days>("7");
  const [source, setSource] = useState<"all" | "sim" | "whatsapp">("all");
  const [kind, setKind] = useState<"all" | "incoming" | "outgoing" | "missed">("all");
  const [employee, setEmployee] = useState<string>(me?.isAdmin ? "all" : (me?.userId ?? "all"));
  const [search, setSearch] = useState("");

  const range = useMemo(() => {
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - (Number(days) - 1));
    const to = new Date(Date.now() + 60_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  const userId = me?.isAdmin ? (employee === "all" ? null : employee) : me?.userId;
  const { data: calls = [], isLoading } = useQuery(callsQuery({ ...range, userId }));
  const { data: profiles = [] } = useQuery({ ...profilesQuery, enabled: !!me?.isAdmin });
  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.display_name])), [profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calls.filter((c) => {
      if (source !== "all" && c.source !== source) return false;
      if (kind === "missed" && !isUnanswered(c.direction)) return false;
      if ((kind === "incoming" || kind === "outgoing") && c.direction !== kind) return false;
      if (q && !`${c.contact_name ?? ""} ${c.phone_number ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [calls, source, kind, search]);
  const stats = computeStats(filtered);

  return (
    <AppShell
      title="Call log"
      kicker={`${stats.total} calls · ${formatDuration(stats.talkSeconds)} talk time`}
    >
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or number"
            className="h-11 rounded-full bg-card pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented
            value={days}
            onChange={setDays}
            options={[
              { value: "1", label: "Today" },
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
            ]}
          />
          <Segmented
            value={source}
            onChange={setSource}
            options={[
              { value: "all", label: "All" },
              { value: "sim", label: "SIM" },
              { value: "whatsapp", label: "WhatsApp" },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Any" },
              { value: "incoming", label: "In" },
              { value: "outgoing", label: "Out" },
              { value: "missed", label: "Missed" },
            ]}
          />
          {me?.isAdmin && (
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger className="h-10 w-48 rounded-full bg-card">
                <SelectValue placeholder="Everyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || "Unnamed"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading calls…</div>
      ) : (
        <CallList calls={filtered} names={me?.isAdmin && employee === "all" ? names : undefined} />
      )}
    </AppShell>
  );
}
