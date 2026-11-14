import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getDailyDigest } from "@/lib/daily-digest.functions";

export function DailyDigest() {
  const fetchDigest = useServerFn(getDailyDigest);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, isLoading } = useQuery({
    queryKey: ["daily-digest", timeZone],
    queryFn: () => fetchDigest({ data: { timeZone } }),
    staleTime: 30 * 60_000,
  });

  async function refresh() {
    setBusy(true);
    try {
      qc.setQueryData(["daily-digest", timeZone], await fetchDigest({ data: { timeZone, refresh: true } }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Sparkles className="size-4" /> Yesterday at a glance
        </h2>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={busy || isLoading} aria-label="Refresh recap">
          <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>
      {isLoading || busy ? (
        <p className="text-sm text-muted-foreground">Writing the recap…</p>
      ) : data?.error ? (
        <p className="text-sm text-muted-foreground">{data.error}</p>
      ) : (
        <p className="whitespace-pre-line text-sm">{data?.summary}</p>
      )}
    </section>
  );
}
