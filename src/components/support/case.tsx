import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Sparkles, Send, Paperclip, Check, Save, Merge, Download, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ticketQuery, inboxQuery } from "@/lib/support/queries";
import { mutateSupport, getSupportAttachment } from "@/lib/support/workspace.functions";
import { generateSupportDraft } from "@/lib/support/copilot.functions";
import {
  statuses,
  priorities,
  maySendAi,
  settingsSchema,
  type SupportMutation,
} from "@/lib/support/rules";
import { SupportShell, useSupportTeam, NoWorkspace, Status } from "./shell";
export function SupportCase({ id }: { id: string }) {
  const { team } = useSupportTeam();
  return (
    <SupportShell
      title="Case workspace"
      actions={
        <Button asChild variant="outline">
          <Link to="/support">
            <ArrowLeft />
            Inbox
          </Link>
        </Button>
      }
    >
      {team ? <CaseBody key={id} teamId={team.id} id={id} /> : <NoWorkspace />}
    </SupportShell>
  );
}
function CaseBody({ teamId, id }: { teamId: string; id: string }) {
  const q = useQuery(ticketQuery(teamId, id));
  const { team } = useSupportTeam();
  const settings = settingsSchema.safeParse(team?.settings);
  const [status, setStatus] = useState("new");
  const [priority, setPriority] = useState("normal");
  const [category, setCategory] = useState("General");
  const [assignee, setAssignee] = useState("");
  const [tags, setTags] = useState("");
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "customer">("internal");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [composerAiId, setComposerAiId] = useState<string | null>(null);
  const [kind, setKind] = useState<"summary" | "reply" | "follow_up" | "next_action">("summary");
  const [target, setTarget] = useState("");
  const [messageKey, setMessageKey] = useState(() => crypto.randomUUID());
  const fn = useServerFn(mutateSupport);
  const gen = useServerFn(generateSupportDraft);
  const download = useServerFn(getSupportAttachment);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: SupportMutation) => fn({ data }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["support"] });
      toast.success("Saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const ai = useMutation({
    mutationFn: () => gen({ data: { teamId, ticketId: id, kind } }),
    onSuccess: async (d) => {
      if (d) {
        setDraftId(d.id);
        setDraftText(d.body);
      }
      await qc.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const mergeOptions = useQuery({
    ...inboxQuery({ teamId }),
    enabled: q.data?.role === "admin" || q.data?.role === "manager",
  });
  useEffect(() => {
    if (q.data) {
      const t = q.data.ticket;
      setStatus(t.status);
      setPriority(t.priority);
      setCategory(t.category);
      setAssignee(t.assignee_id ?? "");
      setTags(t.tags.join(", "));
    }
  }, [q.data?.ticket.revision]);
  if (q.isPending) return <p role="status">Loading case…</p>;
  if (q.error || !q.data)
    return (
      <p role="alert" className="text-destructive">
        {q.error?.message ?? "Case unavailable"}
      </p>
    );
  const data = q.data;
  const t = data.ticket;
  const writable = data.role !== "viewer";
  const draft = data.drafts.find((d) => d.id === draftId);
  const approved = draft && maySendAi(draft, draftText);
  const linked =
    data.customer?.user_id &&
    data.customer.consent &&
    data.customer.communication_preference === "in_app";
  async function attach(file: File) {
    if (file.size > 2097152) {
      toast.error("Maximum attachment size is 2 MB");
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let raw = "";
      for (const b of bytes) raw += String.fromCharCode(b);
      await mutation.mutateAsync({
        action: "attachment",
        teamId,
        payload: {
          ticket_id: id,
          name: file.name,
          mime: file.type as "image/png" | "image/jpeg" | "application/pdf",
          size_bytes: file.size,
          content_base64: btoa(raw),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Attachment rejected");
    }
  }
  async function saveFile(fileId: string) {
    try {
      const a = await download({ data: { teamId, id: fileId } });
      if (!a) return;
      const binary = atob(a.content_base64);
      const blob = new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))], { type: a.mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Attachment unavailable");
    }
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div>
          <div className="mb-2 flex gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{t.id.slice(0, 8)}</span>
            <Status value={t.status} />
            <Status value={t.priority} />
          </div>
          <h2 className="text-xl font-semibold">{t.subject}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {t.description || "No issue details supplied."}
          </p>
          {data.customer && (
            <Link
              to="/support-customers/$customerId"
              params={{ customerId: data.customer.id }}
              className="mt-2 inline-block text-sm underline"
            >
              {data.customer.name} · ••••{data.customer.phone_last4}
            </Link>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Created {new Date(t.created_at).toLocaleString()}
          <div
            className={
              t.status !== "resolved" && Date.parse(t.sla_due_at) < Date.now()
                ? "mt-1 text-destructive"
                : "mt-1"
            }
          >
            SLA {new Date(t.sla_due_at).toLocaleString()}
          </div>
        </div>
      </div>
      {t.merged_into && (
        <p className="mb-4 text-sm">
          Merged into{" "}
          <Link
            to="/support-case/$ticketId"
            params={{ ticketId: t.merged_into }}
            className="underline"
          >
            #{t.merged_into.slice(0, 8)}
          </Link>
          . History is retained.
        </p>
      )}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold">Conversation & internal notes</h3>
            {!data.messages.length && (
              <p className="border-y border-border py-6 text-sm text-muted-foreground">
                No messages yet.
              </p>
            )}
            <div className="space-y-3">
              {data.messages.map((m) => (
                <article key={m.id} className="rounded-md border border-border bg-card p-4">
                  <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {data.members.find((a) => a.user_id === m.author_id)?.display_name ||
                        "Customer"}{" "}
                      · {m.visibility === "internal" ? "Internal note" : "Customer-visible"}
                      {m.ai_draft_id ? " · Human-approved AI draft" : ""}
                    </span>
                    <span>
                      {new Date(m.created_at).toLocaleString()} ·{" "}
                      {m.delivery_state === "stored" ? "Stored in app" : "Read"}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                </article>
              ))}
            </div>
            {writable && !t.merged_into && (
              <form
                className="mt-4 space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await mutation.mutateAsync({
                      action: "message",
                      teamId,
                      payload: {
                        ticket_id: id,
                        body: text,
                        visibility,
                        request_key: messageKey,
                        ai_draft_id: composerAiId,
                      },
                    });
                    setText("");
                    setMessageKey(crypto.randomUUID());
                    setComposerAiId(null);
                  } catch {
                    /* Input remains available after a failed send. */
                  }
                }}
              >
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={visibility === "internal" ? "default" : "outline"}
                    onClick={() => setVisibility("internal")}
                  >
                    Internal note
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={visibility === "customer" ? "default" : "outline"}
                    onClick={() => setVisibility("customer")}
                  >
                    In-app reply
                  </Button>
                </div>
                {visibility === "customer" && !linked && (
                  <p className="text-xs text-destructive">
                    Unavailable: link a customer account and confirm communication consent.
                  </p>
                )}
                <Textarea
                  aria-label="Message body"
                  placeholder={
                    visibility === "internal" ? "Add a private note…" : "Write a customer reply…"
                  }
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                  }}
                  maxLength={10000}
                />
                <div className="flex justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Paperclip className="size-4" />
                    Attachment
                    <input
                      aria-label="Upload attachment"
                      className="hidden"
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void attach(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <Button
                    type="submit"
                    disabled={
                      mutation.isPending ||
                      !text.trim() ||
                      t.status === "resolved" ||
                      (visibility === "customer" && !linked)
                    }
                  >
                    <Send /> {visibility === "internal" ? "Save note" : "Send in app"}
                  </Button>
                </div>
              </form>
            )}
          </section>
          <section className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-bold">Call evidence</h3>
            {data.call ? (
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Server receipt / read-back:</strong>{" "}
                  {new Date(data.call.created_at).toLocaleString()}
                </p>
                <p>
                  <strong>
                    {data.call.source === "sim"
                      ? "Device CallLog report"
                      : "WhatsApp notification inference"}
                    :
                  </strong>{" "}
                  {data.call.direction} · {data.call.duration_seconds}s reported ·{" "}
                  {new Date(data.call.started_at).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  No call transcript. Real-device behavior and answered status are not independently
                  verified.
                </p>
                {data.note && (
                  <p className="rounded border border-gold/40 bg-accent/10 p-3">
                    <strong>AI-generated interpretation:</strong> {data.note.note} ·{" "}
                    {data.note.follow_up ? "Follow-up suggested" : "No follow-up flag"}. This is not
                    call-outcome evidence.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No readable linked call evidence. No call outcome can be inferred.
              </p>
            )}
          </section>
          {!!data.attachments.length && (
            <section>
              <h3 className="mb-2 text-sm font-bold">Private attachments · not malware-scanned</h3>
              {data.attachments.map((a) => (
                <Button
                  variant="outline"
                  key={a.id}
                  className="mb-2 mr-2 max-w-full"
                  onClick={() => saveFile(a.id)}
                >
                  <Download />
                  <span className="truncate">{a.name}</span>
                  <span className="text-xs">{Math.ceil(a.size_bytes / 1024)} KB</span>
                </Button>
              ))}
            </section>
          )}
          {!!data.audit.length && (
            <section className="border-t border-border pt-4">
              <h3 className="text-sm font-bold">Case audit trail</h3>
              {data.audit.map((a) => (
                <div key={a.id} className="mt-2 text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()} · {a.action} ·{" "}
                  {data.members.find((m) => m.user_id === a.actor_id)?.display_name ||
                    "Team member"}
                </div>
              ))}
            </section>
          )}
        </div>
        <aside className="min-w-0 space-y-6">
          <section className="border-b border-border pb-5">
            <h3 className="mb-3 text-sm font-bold">Case details</h3>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate({
                  action: "update_ticket",
                  teamId,
                  payload: {
                    id,
                    revision: t.revision,
                    status: status as (typeof statuses)[number],
                    priority: priority as (typeof priorities)[number],
                    category,
                    assignee_id: assignee || null,
                    tags: tags
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                });
              }}
            >
              <label className="support-field">
                Status
                <select
                  aria-label="Status"
                  className="support-select"
                  disabled={!writable || !!t.merged_into}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="support-field">
                Priority
                <select
                  className="support-select"
                  disabled={!writable}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {priorities.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="support-field">
                Assignee
                <select
                  className="support-select"
                  disabled={!writable}
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {data.members
                    .filter((m) => m.role !== "viewer")
                    .map((m) => (
                      <option value={m.user_id} key={m.user_id}>
                        {m.display_name || m.role}
                      </option>
                    ))}
                </select>
              </label>
              <label className="support-field">
                Category
                <select
                  className="support-select"
                  disabled={!writable}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {Array.from(
                    new Set([
                      category,
                      ...(settings.success ? settings.data.categories : ["General"]),
                    ]),
                  ).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="support-field">
                Tags
                <Input
                  disabled={!writable}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </label>
              {writable && (
                <Button type="submit" disabled={mutation.isPending || !!t.merged_into}>
                  <Save />
                  Save changes
                </Button>
              )}
            </form>
          </section>
          {writable && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-gold" />
                <h3 className="text-sm font-bold">AI Copilot</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                AI-generated · human approval required
              </p>
              <select
                aria-label="AI task"
                className="support-select w-full"
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option value="summary">Summarize / classify</option>
                <option value="reply">Suggest reply</option>
                <option value="next_action">Recommend next action</option>
                <option value="follow_up">Draft follow-up</option>
              </select>
              <Button
                variant="outline"
                onClick={() => ai.mutate()}
                disabled={
                  ai.isPending || !!t.merged_into || !settings.success || !settings.data.ai_enabled
                }
              >
                <Sparkles />
                {ai.isPending ? "Generating…" : "Generate draft"}
              </Button>
              {draft && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Status value={draft.status} />
                    <span className="text-xs">
                      {draft.mode === "mock" ? "DEMO / MOCK" : "Live AI output"}
                    </span>
                  </div>
                  <Textarea
                    aria-label="AI draft"
                    rows={10}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    maxLength={10000}
                  />
                  <div className="text-xs text-muted-foreground">
                    Sources:{" "}
                    {Array.isArray(draft.citations) && draft.citations.length
                      ? draft.citations.map((c, i) => {
                          if (!c || typeof c !== "object" || Array.isArray(c)) return null;
                          return (
                            <div key={i}>
                              {String(c["title"])} · v{String(c["version"])}
                              {typeof c["url"] === "string" && c["url"].startsWith("https://") && (
                                <a
                                  className="ml-2 underline"
                                  href={c["url"]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Source
                                </a>
                              )}
                            </div>
                          );
                        })
                      : "No reliable approved article matched."}
                  </div>
                  <Button
                    variant="outline"
                    disabled={mutation.isPending || !draftText.trim() || draft.status === "used"}
                    onClick={() =>
                      mutation.mutate({
                        action: "approve_draft",
                        teamId,
                        payload: { id: draft.id, body: draftText },
                      })
                    }
                  >
                    <Check />
                    Approve edited draft
                  </Button>
                  {["reply", "follow_up"].includes(draft.kind) && (
                    <Button
                      disabled={!approved}
                      onClick={() => {
                        setText(draftText);
                        setComposerAiId(draft.id);
                        setVisibility("customer");
                      }}
                    >
                      Use approved reply
                    </Button>
                  )}
                </>
              )}
              {!!data.drafts.length && (
                <details>
                  <summary className="cursor-pointer text-xs">
                    Draft history ({data.drafts.length})
                  </summary>
                  {data.drafts.map((d) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full justify-start"
                      key={d.id}
                      onClick={() => {
                        setDraftId(d.id);
                        setDraftText(d.body);
                      }}
                    >
                      {d.kind.replace("_", " ")} · {d.status}
                    </Button>
                  ))}
                </details>
              )}
            </section>
          )}
          {["admin", "manager"].includes(data.role) && !t.merged_into && (
            <section className="space-y-2 border-t border-border pt-4">
              <h3 className="text-sm font-bold">Merge duplicate</h3>
              <select
                aria-label="Merge target"
                className="support-select w-full"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Choose active case</option>
                {mergeOptions.data?.tickets
                  .filter((o) => o.id !== id && o.status !== "resolved")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.subject}
                    </option>
                  ))}
              </select>
              <Button
                variant="outline"
                disabled={!target || mutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Merge this case into the selected case? All history is retained.",
                    )
                  )
                    mutation.mutate({ action: "merge", teamId, payload: { id, target } });
                }}
              >
                <Merge />
                Merge case
              </Button>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
