import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import logo from "@/assets/winstone-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { STARTER_QUESTIONS } from "@/lib/assistant-queries";

function friendlyError(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // Not JSON: the stream already sent a readable message.
  }
  if (/fetch|network/i.test(error.message)) return "No connection. Check the internet and try again.";
  return error.message || "The assistant could not answer.";
}

export function AssistantChat({
  threadId,
  initialMessages,
  initialQuestion,
  onQuestionSent,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  initialQuestion?: string;
  onQuestionSent?: () => void;
}) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          return {
            headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
            // The server keeps the history; only the newest question travels.
            body: {
              threadId,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              messages: messages.slice(-1),
            },
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (error) => toast.error(friendlyError(error)),
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: ["assistant"] });
      textareaRef.current?.focus();
    },
  });

  const busy = status === "submitted" || status === "streaming";

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void sendMessage({ text: trimmed });
    textareaRef.current?.focus();
  }

  // A starter question picked on the overview page is sent once when the conversation opens.
  const sentInitial = useRef(false);
  useEffect(() => {
    if (!initialQuestion || sentInitial.current || initialMessages.length > 0) return;
    sentInitial.current = true;
    ask(initialQuestion);
    onQuestionSent?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);

  const lastIsUser = messages[messages.length - 1]?.role === "user";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-6 p-4 md:p-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <img src={logo.url} alt="" className="size-16 rounded-full shadow-card" />
              <div>
                <h2 className="font-display text-xl font-bold tracking-wide">Ask about your team's calls</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Uses the last 30 days of SIM and WhatsApp calls from every phone.
                </p>
              </div>
              <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:border-gold hover:bg-secondary"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, mi) => {
            const isLast = mi === messages.length - 1;
            return (
              <Message key={message.id} from={message.role}>
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2">
                    <img src={logo.url} alt="" className="size-6 rounded-full" />
                    <span className="stamp text-muted-foreground">WinLog assistant</span>
                  </div>
                )}
                {message.parts.map((part, i) => {
                  if (part.type === "reasoning") {
                    return (
                      <Reasoning
                        key={`${message.id}-r${i}`}
                        isStreaming={isLast && status === "streaming" && part.state === "streaming"}
                        defaultOpen={false}
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    );
                  }
                  if (part.type === "text") {
                    return (
                      <MessageContent
                        key={`${message.id}-t${i}`}
                        className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                      >
                        {message.role === "assistant" ? (
                          <MessageResponse isAnimating={isLast && status === "streaming"}>
                            {part.text}
                          </MessageResponse>
                        ) : (
                          <p className="whitespace-pre-wrap">{part.text}</p>
                        )}
                      </MessageContent>
                    );
                  }
                  return null;
                })}
              </Message>
            );
          })}

          {status === "submitted" && lastIsUser && (
            <Message from="assistant">
              <div className="flex items-center gap-2">
                <img src={logo.url} alt="" className="size-6 rounded-full" />
                <Shimmer className="text-sm">Reading the call log…</Shimmer>
              </div>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background/60 p-3">
        <PromptInput onSubmit={(m: PromptInputMessage) => ask(m.text)}>
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Ask about calls, missed calls, talk time…"
            autoFocus
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
