import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import logo from "@/assets/winstone-logo.png.asset.json";
import { AppShell } from "@/components/winlog/app-shell";
import { AssistantThreads } from "@/components/winlog/assistant-threads";
import { createThread, STARTER_QUESTIONS } from "@/lib/assistant-queries";
import { meQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/assistant/")({
  head: () => ({
    meta: [
      { title: "Ask AI — WinLog" },
      {
        name: "description",
        content:
          "Managers ask questions about team call activity and get summaries and follow-ups.",
      },
      { property: "og:title", content: "Ask AI — WinLog" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "AI summaries of team call patterns and follow-ups." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: AssistantHome,
});

function AssistantHome() {
  const { data: me } = useSuspenseQuery(meQuery);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!me?.isAdmin) {
    return (
      <AppShell title="Ask AI" kicker="Managers only">
        <p className="text-muted-foreground">Only managers can use the call assistant.</p>
      </AppShell>
    );
  }

  async function start(question: string) {
    setBusy(true);
    try {
      const id = await createThread();
      await queryClient.invalidateQueries({ queryKey: ["assistant", "threads"] });
      navigate({ to: "/assistant/$threadId", params: { threadId: id }, search: { q: question } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start a conversation");
      setBusy(false);
    }
  }

  return (
    <AppShell title="Ask AI" kicker="Call assistant">
      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <AssistantThreads className="order-2 md:order-1" />
        <section className="order-1 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-card md:order-2">
          <img src={logo.url} alt="" className="size-16 rounded-full shadow-card" />
          <div>
            <h2 className="font-display text-xl font-bold tracking-wide">
              What would you like to know?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The assistant reads the last 30 days of calls from every phone and suggests who to
              call back.
            </p>
          </div>
          <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => void start(q)}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:border-gold hover:bg-secondary disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <Link
            to="/summary"
            className="mt-2 flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border-2 border-foreground bg-accent px-4 py-3 text-left text-accent-foreground"
          >
            <span>
              <span className="block font-semibold">Summarize call records</span>
              <span className="block text-sm opacity-80">
                Upload a file, paste records or pick a period, and get follow-ups.
              </span>
            </span>
            <span aria-hidden>→</span>
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
