import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";

import { AppShell } from "@/components/winlog/app-shell";
import { AssistantChat } from "@/components/winlog/assistant-chat";
import { AssistantThreads } from "@/components/winlog/assistant-threads";
import { threadQuery } from "@/lib/assistant-queries";
import { meQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/assistant/$threadId")({
  validateSearch: z.object({ q: z.string().max(500).optional() }),
  head: () => ({
    meta: [
      { title: "Conversation — WinLog Ask AI" },
      { name: "description", content: "A saved conversation with the WinLog call assistant." },
      { property: "og:title", content: "Conversation — WinLog Ask AI" },
      { property: "og:description", content: "Questions and answers about team call activity." },
    ],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(meQuery),
      context.queryClient.ensureQueryData(threadQuery(params.threadId)),
    ]);
  },
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const { data: me } = useSuspenseQuery(meQuery);
  const { data } = useSuspenseQuery(threadQuery(threadId));

  if (!me?.isAdmin || !data.thread) {
    return (
      <AppShell title="Ask AI" kicker="Call assistant">
        <p className="text-muted-foreground">
          This conversation was not found.{" "}
          <Link to="/assistant" className="underline">
            Back to conversations
          </Link>
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Ask AI" kicker={data.thread.title}>
      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <AssistantThreads activeId={threadId} className="hidden md:flex" />
        <div className="h-[calc(100dvh-17rem)] min-h-[26rem] md:h-[calc(100dvh-12rem)]">
          <Link to="/assistant" className="stamp mb-2 inline-block text-muted-foreground md:hidden">
            ← All conversations
          </Link>
          <AssistantChat
            key={threadId}
            threadId={threadId}
            initialMessages={data.messages}
            initialQuestion={q}
            onQuestionSent={() =>
              navigate({
                to: "/assistant/$threadId",
                params: { threadId },
                search: {},
                replace: true,
              })
            }
          />
        </div>
      </div>
    </AppShell>
  );
}
