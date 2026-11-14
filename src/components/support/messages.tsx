import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Send, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { customerMessagesQuery } from "@/lib/support/queries";
import {
  mutateSupport,
  createCustomerInquiry,
  markSupportRead,
} from "@/lib/support/workspace.functions";
import { SupportShell, Empty, Status } from "./shell";
export function SupportMessages() {
  const { data } = useSuspenseQuery(customerMessagesQuery);
  const [id, setId] = useState("");
  const [body, setBody] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [newCase, setNewCase] = useState(false);
  const [subject, setSubject] = useState("");
  const [issue, setIssue] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [caseKey, setCaseKey] = useState("");
  const ticket = data.tickets.find((t) => t.id === id) ?? data.tickets[0];
  const fn = useServerFn(mutateSupport);
  const create = useServerFn(createCustomerInquiry);
  const read = useServerFn(markSupportRead);
  const qc = useQueryClient();
  useEffect(() => {
    if (ticket)
      void read({ data: { ticketId: ticket.id } })
        .then(() => qc.invalidateQueries({ queryKey: ["support", "customer-messages"] }))
        .catch(() => {});
  }, [ticket?.id]);
  const mutation = useMutation({
    mutationFn: () => {
      if (!ticket) throw new Error("Select a case");
      return fn({
        data: {
          action: "customer_reply",
          teamId: ticket.team_id,
          payload: { ticket_id: ticket.id, body, request_key: key },
        },
      });
    },
    onSuccess: async () => {
      setBody("");
      setKey(crypto.randomUUID());
      await qc.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const inquiry = useMutation({
    mutationFn: () =>
      create({
        data: {
          customerId: customerId || data.customers[0]?.id || "",
          subject,
          body: issue,
          requestKey: caseKey,
        },
      }),
    onSuccess: async (r) => {
      setNewCase(false);
      setId(r.id ?? "");
      await qc.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <SupportShell
      title="My support messages"
      actions={
        !!data.customers.length && (
          <Button
            onClick={() => {
              setSubject("");
              setIssue("");
              setCaseKey(crypto.randomUUID());
              setNewCase(true);
            }}
          >
            <Plus />
            New inquiry
          </Button>
        )
      }
    >
      {!ticket ? (
        <Empty
          title="No customer cases linked to this account"
          detail="A support administrator can link your own account to your customer profile."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-2">
            {data.tickets.map((t) => (
              <Button
                key={t.id}
                className="h-auto w-full justify-start whitespace-normal text-left"
                variant={ticket.id === t.id ? "secondary" : "ghost"}
                onClick={() => setId(t.id)}
              >
                {t.subject}
              </Button>
            ))}
          </div>
          <section className="min-w-0">
            <div className="mb-4 flex justify-between gap-3">
              <h2 className="font-semibold">{ticket.subject}</h2>
              <Status value={ticket.status} />
            </div>
            <div className="space-y-3">
              {data.messages
                .filter((m) => m.ticket_id === ticket.id)
                .map((m) => (
                  <article key={m.id} className="rounded-md border border-border bg-card p-4">
                    <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString()} ·{" "}
                      {m.delivery_state === "stored" ? "Stored in app" : "Read in app"}
                    </p>
                  </article>
                ))}
            </div>
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              <Textarea
                aria-label="Customer reply"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={10000}
                placeholder="Write a reply…"
              />
              <Button disabled={mutation.isPending || !body.trim()}>
                <Send />
                Send in app
              </Button>
            </form>
          </section>
        </div>
      )}
      <Dialog open={newCase} onOpenChange={setNewCase}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New customer inquiry</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              inquiry.mutate();
            }}
          >
            <label className="support-field">
              Customer profile
              <select
                className="support-select"
                value={customerId || data.customers[0]?.id}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                {data.customers.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="support-field">
              Subject
              <Input
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="support-field">
              Message
              <Textarea
                required
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                maxLength={10000}
              />
            </label>
            <Button disabled={inquiry.isPending}>Submit inquiry</Button>
          </form>
        </DialogContent>
      </Dialog>
    </SupportShell>
  );
}
