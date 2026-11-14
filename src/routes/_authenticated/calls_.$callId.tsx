import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/winlog/app-shell";
import { Button } from "@/components/ui/button";
import { callDetailQuery } from "@/lib/call-detail-query";
import { DIRECTION_LABEL, formatDuration } from "@/lib/calls";

export const Route = createFileRoute("/_authenticated/calls_/$callId")({
  head: () => ({ meta: [
    { title: "Call details — Winlog Calls" }, { name: "description", content: "Private call timestamps, reported duration, staff attribution, notes and receipt evidence." },
    { property: "og:title", content: "Call details — Winlog Calls" }, { property: "og:description", content: "Review permitted call evidence and linked support cases." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(callDetailQuery(params.callId)),
  pendingComponent: () => <AppShell title="Call details"><p>Loading call…</p></AppShell>,
  errorComponent: () => <AppShell title="Call unavailable"><p role="alert">This call could not be loaded or you do not have access.</p><Button asChild variant="outline" className="mt-4"><Link to="/calls">Back to Calls</Link></Button></AppShell>,
  component: CallDetail,
});
function CallDetail() {
  const { callId } = Route.useParams();
  const { data } = useSuspenseQuery(callDetailQuery(callId));
  const { call, staff, note, manager, cases } = data;
  const started = new Date(call.started_at);
  return <AppShell title="Call details" kicker={call.source === "sim" ? "SIM · device-reported" : "WhatsApp · notification-inferred"}>
    <Button asChild variant="outline" className="mb-6"><Link to="/calls">Back to Calls</Link></Button>
    <h2 className="font-display text-2xl">{call.contact_name || (call.phone_number ? `Number ending ${call.phone_number.slice(-4)}` : "Unknown contact")}</h2>
    <dl className="my-6 grid grid-cols-1 gap-5 border-y border-border py-6 sm:grid-cols-2">
      {[["Date", started.toLocaleDateString()], ["Time", started.toLocaleTimeString()], ["Reported duration", formatDuration(call.duration_seconds)], ["Staff assigned to phone", staff], ["Reported direction", Object.entries(DIRECTION_LABEL).find(([key]) => key === call.direction)?.[1] ?? "Unknown"], ["Server received", new Date(call.created_at).toLocaleString()]].map(([label,value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
    </dl>
    <section className="mb-8"><h2 className="font-display text-xl">Evidence</h2><p className="mt-3">Server receipt confirmed: this stored record was read back from the database.</p><p className="mt-2 text-sm text-muted-foreground">{call.source === "sim" ? "The phone reports Android CallLog metadata." : "WhatsApp activity is inferred from phone notifications, not a WhatsApp call-history API."} Staff attribution identifies the phone account, not proof of who answered. Real-device call capture, installation and background sync remain unverified.</p></section>
    <section className="mb-8"><h2 className="font-display text-xl">Notes</h2>{note ? <><p className="mt-3 text-sm font-semibold text-muted-foreground">AI-generated · {new Date(note.generated_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap">{note.note}</p><p className="mt-2 text-sm">{note.follow_up ? note.resolved_at ? "Follow-up resolved" : "Follow-up needed" : "No follow-up flag"}</p></> : <p className="mt-3 text-muted-foreground">{manager ? "No saved notes for this call." : "AI notes are available to managers only."}</p>}<p className="mt-3 text-sm text-muted-foreground">No conversation recording or transcript is supplied. AI text does not verify what was said or whether anyone answered.</p></section>
    <section><h2 className="font-display text-xl">Support cases</h2>{cases.length ? <ul className="mt-3 space-y-3">{cases.map(c => <li key={c.id}><Link className="underline" to="/support-case/$ticketId" params={{ticketId:c.id}}>{c.subject}</Link><span className="ml-2 text-sm text-muted-foreground">{c.status}</span></li>)}</ul> : <p className="mt-3 text-muted-foreground">No linked support cases available.</p>}</section>
  </AppShell>;
}