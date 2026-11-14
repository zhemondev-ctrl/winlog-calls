import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Search, ChevronLeft, ChevronRight, Phone, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inboxQuery, customersQuery } from "@/lib/support/queries";
import { mutateSupport, getSupportCallCandidates } from "@/lib/support/workspace.functions";
import { priorities, statuses, type SupportMutation } from "@/lib/support/rules";
import { SupportShell, useSupportTeam, NoWorkspace, Status, Empty } from "./shell";
export function SupportInbox() {
  const { team } = useSupportTeam();
  return (
    <SupportShell title="Support inbox">
      {team ? <InboxBody teamId={team.id} /> : <NoWorkspace />}
    </SupportShell>
  );
}
function InboxBody({ teamId }: { teamId: string }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [channel, setChannel] = useState("");
  const [assignee, setAssignee] = useState("");
  const [page, setPage] = useState(0);
  const [sla, setSla] = useState(false);
  const [create, setCreate] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [customer, setCustomer] = useState("");
  const [callId, setCallId] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const q = useQuery(
    inboxQuery({
      teamId,
      status: status || undefined,
      search,
      priority: priority || undefined,
      channel: channel || undefined,
      assignee: assignee || undefined,
      page,
      sla,
    }),
  );
  const cq = useQuery({ ...customersQuery(teamId), enabled: create });
  const candidates = useQuery({
    queryKey: ["support", "call-candidates", teamId],
    queryFn: () => getSupportCallCandidates({ data: { teamId } }),
    enabled: create,
  });
  const fn = useServerFn(mutateSupport);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (data: SupportMutation) => fn({ data }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["support"] });
      setCreate(false);
      if (result.id)
        await navigate({ to: "/support-case/$ticketId", params: { ticketId: result.id } });
    },
    onError: (e) => toast.error(e.message),
  });
  function open() {
    setSubject("");
    setDescription("");
    setCallId("");
    setCustomer("");
    setRequestKey(crypto.randomUUID());
    setCreate(true);
  }
  const writable = q.data?.role && q.data.role !== "viewer";
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-3xl font-semibold">{q.data?.count ?? "—"}</span>
          <span className="text-sm text-muted-foreground">matching cases</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/follow-ups">
              <Phone />
              Call follow-ups
              <ArrowUpRight />
            </Link>
          </Button>
          {writable && (
            <Button onClick={open}>
              <Plus />
              New case
            </Button>
          )}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 border-b border-border pb-4">
        {["", ...statuses].map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setStatus(s);
              setPage(0);
            }}
          >
            {s ? s[0]?.toUpperCase() + s.slice(1) : "All cases"}
          </Button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Search cases"
            placeholder="Search cases…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <select
          aria-label="Priority filter"
          className="support-select"
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All priorities</option>
          {priorities.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          aria-label="Channel filter"
          className="support-select"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All channels</option>
          {["manual", "call", "web_chat"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          aria-label="Assignee filter"
          className="support-select"
          value={assignee}
          onChange={(e) => {
            setAssignee(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {q.data?.members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name || m.role}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={sla}
            onChange={(e) => {
              setSla(e.target.checked);
              setPage(0);
            }}
          />
          SLA overdue
        </label>
      </div>
      {q.isPending ? (
        <p role="status">Loading cases…</p>
      ) : q.error ? (
        <p role="alert" className="text-destructive">
          {q.error.message}
        </p>
      ) : !q.data?.tickets.length ? (
        <Empty title="No cases in this queue" detail="No support records have been fabricated." />
      ) : (
        <div className="overflow-x-auto border-y border-border">
          <table className="support-table">
            <thead>
              <tr>
                <th>Case / customer</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Channel</th>
                <th>Assignee</th>
                <th>SLA due / age</th>
              </tr>
            </thead>
            <tbody>
              {q.data.tickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link
                      to="/support-case/$ticketId"
                      params={{ ticketId: t.id }}
                      className="font-semibold hover:underline"
                    >
                      {t.subject}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">
                      #{t.id.slice(0, 8)} ·{" "}
                      {q.data.customers.find((c) => c.id === t.customer_id)?.name ??
                        "No customer linked"}
                    </div>
                  </td>
                  <td>
                    <Status value={t.status} />
                  </td>
                  <td>
                    <Status value={t.priority} />
                  </td>
                  <td className="capitalize">{t.channel.replace("_", " ")}</td>
                  <td>
                    {q.data.members.find((m) => m.user_id === t.assignee_id)?.display_name ||
                      "Unassigned"}
                  </td>
                  <td
                    className={
                      Date.parse(t.sla_due_at) < Date.now() && t.status !== "resolved"
                        ? "text-destructive"
                        : ""
                    }
                  >
                    {new Date(t.sla_due_at).toLocaleString()}
                    <div className="text-xs">
                      {Math.floor((Date.now() - Date.parse(t.created_at)) / 3600000)}h old
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex items-center justify-end gap-3 text-xs">
        <span>
          Page {page + 1} · {q.data?.count ?? 0} cases
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={(page + 1) * 25 >= (q.data?.count ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New support case</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({
                action: "ticket",
                teamId,
                payload: {
                  subject,
                  description,
                  request_key: requestKey,
                  customer_id: customer || null,
                  call_id: callId || null,
                  channel: callId ? "call" : "manual",
                },
              });
            }}
          >
            <label className="support-field">
              Subject
              <Input
                required
                maxLength={200}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <label className="support-field">
              Issue details
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={10000}
              />
            </label>
            <label className="support-field">
              Customer
              <select
                className="support-select"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              >
                <option value="">No linked customer</option>
                {cq.data?.customers.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name} · ••••{c.phone_last4}
                  </option>
                ))}
              </select>
            </label>
            <label className="support-field">
              Existing call / follow-up
              <select
                className="support-select"
                value={callId}
                onChange={(e) => setCallId(e.target.value)}
              >
                <option value="">No linked call</option>
                {candidates.data?.map((c) => (
                  <option value={c.id} key={c.id}>
                    {new Date(c.started_at).toLocaleString()} · {c.source} · {c.direction}
                    {c.followUp ? " · AI follow-up flag" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={mutation.isPending || !subject.trim()}>
              {mutation.isPending ? "Creating…" : "Create case"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
