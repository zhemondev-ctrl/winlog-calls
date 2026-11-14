import { useQuery } from "@tanstack/react-query";
import { analyticsQuery } from "@/lib/support/queries";
import { SupportShell, useSupportTeam, NoWorkspace, Empty } from "./shell";
export function SupportAnalytics() {
  const { team } = useSupportTeam();
  return (
    <SupportShell title="Support analytics">
      {team ? <AnalyticsBody teamId={team.id} /> : <NoWorkspace />}
    </SupportShell>
  );
}
function AnalyticsBody({ teamId }: { teamId: string }) {
  const q = useQuery(analyticsQuery(teamId));
  if (q.isPending) return <p>Loading actual case metrics…</p>;
  if (q.error || !q.data) return <p role="alert">{q.error?.message}</p>;
  const m = q.data.metrics;
  const minutes = (n: number | null) => (n === null ? "No data" : Math.round(n) + " min");
  return (
    <>
      {q.data.truncated && <p role="alert">Metrics limited to the first 100,000 records.</p>}
      <div className="mb-7 grid grid-cols-2 gap-5 border-y border-border py-6 lg:grid-cols-6">
        {[
          ["Cases", m.total],
          ["First response", minutes(m.firstResponseMinutes)],
          ["Resolution", minutes(m.resolutionMinutes)],
          ["SLA breaches", m.slaBreaches],
          [
            "Reopen rate",
            m.reopenRate === null ? "No data" : (m.reopenRate * 100).toFixed(1) + "%",
          ],
          ["CSAT", "No survey data"],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      {!m.total ? (
        <Empty
          title="No case activity to measure"
          detail="Response time, resolution time, and CSAT are not estimated."
        />
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          {(
            [
              ["Volume by channel", m.byChannel],
              ["Volume by status", m.byStatus],
              ["Volume by category", m.byCategory],
              ["Active agent workload", m.workload],
            ] as const
          ).map(([title, groups]) => (
            <section key={String(title)}>
              <h2 className="mb-3 text-sm font-bold">{String(title)}</h2>
              {Object.entries(groups).map(([label, n]) => (
                <div
                  key={label}
                  className="flex justify-between gap-3 border-b border-border py-3 text-sm"
                >
                  <span className="break-all capitalize">{label.replace("_", " ")}</span>
                  <strong>{n}</strong>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
