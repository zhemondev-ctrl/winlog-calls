import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { customersQuery, customerQuery, adminQuery } from "@/lib/support/queries";
import { mutateSupport } from "@/lib/support/workspace.functions";
import type { SupportMutation } from "@/lib/support/rules";
import { SupportShell, useSupportTeam, NoWorkspace, Empty, Status } from "./shell";
export function SupportCustomers() {
  const { team } = useSupportTeam();
  return (
    <SupportShell title="Customer 360">
      {team ? <CustomersBody teamId={team.id} /> : <NoWorkspace />}
    </SupportShell>
  );
}
function CustomersBody({ teamId }: { teamId: string }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const q = useQuery(customersQuery(teamId, search));
  const fn = useServerFn(mutateSupport);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: SupportMutation) => fn({ data }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["support"] });
      setOpen(false);
      setName("");
      setPhone("");
      setEmail("");
      setConsent(false);
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <>
      <div className="mb-5 flex gap-3">
        <Input
          aria-label="Search customers"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {q.data?.role !== "viewer" && (
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Customer
          </Button>
        )}
      </div>
      {q.isPending ? (
        <p>Loading customers…</p>
      ) : q.error ? (
        <p role="alert">{q.error.message}</p>
      ) : !q.data?.customers.length ? (
        <Empty title="No customer profiles" detail="Create a customer or link an existing case." />
      ) : (
        <div className="overflow-x-auto">
          <table className="support-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Communication</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {q.data.customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      className="font-semibold underline"
                      to="/support-customers/$customerId"
                      params={{ customerId: c.id }}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.phone_last4 ? "•••• " + c.phone_last4 : "Not supplied"}</td>
                  <td>
                    {c.consent ? "Consent recorded" : "No consent"} · {c.communication_preference}
                  </td>
                  <td>{c.user_id ? "Linked account" : "Not linked"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({
                action: "customer",
                teamId,
                payload: { name, phone, email, consent, communication_preference: "in_app" },
              });
            }}
          >
            <label className="support-field">
              Name
              <Input
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </label>
            <label className="support-field">
              Phone
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
            </label>
            <label className="support-field">
              Email
              <Input value={email} type="email" onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              Customer has consented to in-app communication
            </label>
            <Button disabled={mutation.isPending} type="submit">
              Create customer
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function SupportCustomer({ id }: { id: string }) {
  const { team } = useSupportTeam();
  return (
    <SupportShell title="Customer profile">
      {team ? <CustomerBody teamId={team.id} id={id} /> : <NoWorkspace />}
    </SupportShell>
  );
}
function CustomerBody({ teamId, id }: { teamId: string; id: string }) {
  const q = useQuery(customerQuery(teamId, id));
  const [reveal, setReveal] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [user, setUser] = useState("");
  const fn = useServerFn(mutateSupport);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: SupportMutation) => fn({ data }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["support"] });
      toast.success("Customer updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const people = useQuery({ ...adminQuery(teamId), enabled: q.data?.role === "admin" });
  if (q.isPending) return <p>Loading profile…</p>;
  if (q.error || !q.data) return <p role="alert">{q.error?.message}</p>;
  const { customer: c, contact, role, tickets, calls, messages } = q.data;
  return (
    <div className="grid gap-7 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <div className="border-b border-border pb-4">
          <h2 className="text-xl font-bold">{c?.name}</h2>
          <p className="mt-2 text-sm">
            {reveal
              ? contact?.phone || "No phone supplied"
              : c?.phone_last4
                ? "•••• " + c.phone_last4
                : "No phone supplied"}
          </p>
          {reveal && <p className="mt-1 break-all text-sm">{contact?.email}</p>}
          {contact && (
            <Button variant="ghost" size="sm" onClick={() => setReveal(!reveal)}>
              {reveal ? <EyeOff /> : <Eye />}
              {reveal ? "Hide contact" : "Reveal contact"}
            </Button>
          )}
        </div>
        {c && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              mutation.mutate({
                action: "customer",
                teamId,
                payload: {
                  id: c.id,
                  name: c.name,
                  notes: notes ?? c.notes,
                  consent: form.get("consent") === "on",
                  communication_preference: form.get("preference") as "in_app" | "none",
                },
              });
            }}
          >
            <label className="support-field">
              Communication preference
              <select
                name="preference"
                className="support-select"
                defaultValue={c.communication_preference}
                disabled={role === "viewer"}
              >
                <option value="in_app">In-app only</option>
                <option value="none">Do not contact</option>
              </select>
            </label>
            <label className="flex gap-2 text-sm">
              <input
                name="consent"
                type="checkbox"
                defaultChecked={c.consent}
                disabled={role === "viewer"}
              />
              Consent recorded
            </label>
            <label className="support-field">
              Internal customer notes
              <Textarea
                value={notes ?? c.notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={role === "viewer"}
              />
            </label>
            {role !== "viewer" && (
              <Button disabled={mutation.isPending}>
                <Save />
                Save preferences
              </Button>
            )}
          </form>
        )}
        {role === "admin" && (
          <section className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-bold">Customer portal account</h3>
            <p className="text-xs text-muted-foreground">
              Link only the customer’s own existing account.
            </p>
            <select
              aria-label="Customer account"
              className="support-select w-full"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            >
              <option value="">Choose account</option>
              {people.data?.people.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.display_name || "Unnamed account"} · {p.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={!user || mutation.isPending}
              onClick={() =>
                mutation.mutate({ action: "customer_link", teamId, payload: { id, user_id: user } })
              }
            >
              Link account
            </Button>
          </section>
        )}
      </aside>
      <div className="min-w-0 space-y-7">
        <section>
          <h3 className="mb-3 font-semibold">Linked cases</h3>
          {tickets.length ? (
            tickets.map((t) => (
              <div key={t.id} className="flex justify-between gap-3 border-b border-border py-3">
                <Link
                  className="text-sm font-semibold underline"
                  to="/support-case/$ticketId"
                  params={{ ticketId: t.id }}
                >
                  {t.subject}
                </Link>
                <Status value={t.status} />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No linked cases.</p>
          )}
        </section>
        <section>
          <h3 className="mb-3 font-semibold">Call timeline · device reports / server read-back</h3>
          {calls.length ? (
            calls.map((c) => (
              <div className="border-l-2 border-gold py-3 pl-4 text-sm" key={c.id}>
                <strong>
                  {c.source === "sim" ? "Device CallLog report" : "WhatsApp notification inference"}
                </strong>{" "}
                · {c.direction} · {c.duration_seconds}s reported
                <p className="mt-1 text-xs text-muted-foreground">
                  Call timestamp {new Date(c.started_at).toLocaleString()} · server received{" "}
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No readable matching call records. Device verification remains outstanding.
            </p>
          )}
        </section>
        <section>
          <h3 className="mb-3 font-semibold">Interaction history</h3>
          {messages.length ? (
            messages.map((m) => (
              <article className="border-b border-border py-3" key={m.id}>
                <p className="text-xs text-muted-foreground">
                  {m.visibility} · {new Date(m.created_at).toLocaleString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.body}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No interactions recorded.</p>
          )}
        </section>
      </div>
    </div>
  );
}
