import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ShieldAlert, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminQuery } from "@/lib/support/queries";
import { mutateSupport } from "@/lib/support/workspace.functions";
import { releaseReadiness, roles, type SupportMutation } from "@/lib/support/rules";
import { SupportShell, useSupportTeam, NoWorkspace, Status } from "./shell";
export function SupportAdmin() {
  const { team } = useSupportTeam();
  return (
    <SupportShell title="Administration & readiness">
      {team ? <AdminBody teamId={team.id} /> : <NoWorkspace />}
    </SupportShell>
  );
}
function AdminBody({ teamId }: { teamId: string }) {
  const q = useQuery(adminQuery(teamId));
  const [user, setUser] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "agent" | "viewer">("agent");
  const fn = useServerFn(mutateSupport);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: SupportMutation) => fn({ data }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["support"] });
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(e.message),
  });
  if (q.isPending) return <p>Loading administration…</p>;
  if (q.error || !q.data) return <p role="alert">{q.error?.message}</p>;
  const data = q.data;
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 font-semibold">Team access</h2>
        <div className="overflow-x-auto">
          <table className="support-table">
            <thead>
              <tr>
                <th>Existing user</th>
                <th>Support role</th>
                <th>Team</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.display_name || "Unnamed user"}</td>
                  <td>
                    <Status value={m.role} />
                  </td>
                  <td>Winstone Support</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.role === "admin" && (
          <form
            className="mt-4 flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({ action: "member", teamId, payload: { user_id: user, role } });
            }}
          >
            <select
              aria-label="Staff account"
              required
              className="support-select"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            >
              <option value="">Choose existing account</option>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name || "Unnamed user"} · {p.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <select
              aria-label="Support role"
              className="support-select"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <Button disabled={mutation.isPending || !user}>
              <UserPlus />
              Assign team role
            </Button>
          </form>
        )}
      </section>
      <section className="border-t border-border pt-5">
        <h2 className="mb-4 font-semibold">Categories, SLA & AI settings</h2>
        <form
          key={JSON.stringify(data.settings)}
          className="max-w-2xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            mutation.mutate({
              action: "settings",
              teamId,
              payload: {
                settings: {
                  categories: String(f.get("categories"))
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  sla_hours: {
                    urgent: Number(f.get("urgent")),
                    high: Number(f.get("high")),
                    normal: Number(f.get("normal")),
                    low: Number(f.get("low")),
                  },
                  ai_enabled: f.get("ai") === "on",
                },
              },
            });
          }}
        >
          <label className="support-field">
            Ticket categories
            <Input
              name="categories"
              defaultValue={data.settings.categories.join(", ")}
              disabled={data.role !== "admin"}
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["urgent", "high", "normal", "low"] as const).map((p) => (
              <label className="support-field capitalize" key={p}>
                {p} SLA (hours)
                <Input
                  type="number"
                  min={1}
                  max={720}
                  name={p}
                  defaultValue={data.settings.sla_hours[p]}
                  disabled={data.role !== "admin"}
                />
              </label>
            ))}
          </div>
          <label className="flex gap-2 text-sm">
            <input
              name="ai"
              type="checkbox"
              defaultChecked={data.settings.ai_enabled}
              disabled={data.role !== "admin"}
            />
            Enable AI drafts; human approval remains mandatory
          </label>
          {data.role === "admin" && (
            <Button disabled={mutation.isPending}>
              <Save />
              Save policies
            </Button>
          )}
        </form>
      </section>
      <section className="border-t border-border pt-5">
        <h2 className="mb-3 font-semibold">Integration health</h2>
        <div className="overflow-x-auto">
          <table className="support-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Current state</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>In-app case messages</td>
                <td>Connected</td>
                <td>Private stored messages; customer account & consent required</td>
              </tr>
              <tr>
                <td>Lovable AI</td>
                <td>{data.aiConfigured ? "Configured" : "Demo / mock only"}</td>
                <td>
                  {data.aiConfigured
                    ? "Server credential present; inference verified separately"
                    : "No provider request made"}
                </td>
              </tr>
              {["SMS", "WhatsApp messaging", "Email delivery", "Telephony", "Pulse CRM"].map(
                (s) => (
                  <tr key={s}>
                    <td>{s}</td>
                    <td className="text-destructive">Configuration required</td>
                    <td>No verified provider connection</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="border-t border-border pt-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <ShieldAlert className="size-5 text-gold" />
          Android release-readiness record
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          WinLog-10.apk · supplied audit, not independently repeated. No signing or release
          configuration changed.
        </p>
        <div className="overflow-x-auto">
          <table className="support-table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Finding</th>
                <th>Evidence state</th>
              </tr>
            </thead>
            <tbody>
              {releaseReadiness.map(([name, value, state]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{value}</td>
                  <td className={state === "NOT VERIFIED" ? "text-destructive" : ""}>{state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="border-t border-border pt-5">
        <h2 className="mb-3 font-semibold">Audit log · latest 200 events</h2>
        <div className="overflow-x-auto">
          <table className="support-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Event</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {data.audit.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                  <td>
                    {data.members.find((m) => m.user_id === a.actor_id)?.display_name ||
                      "System / team member"}
                  </td>
                  <td>{a.action}</td>
                  <td>
                    {a.entity_type.replace("support_", "")} · {a.entity_id.slice(0, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.audit.length && (
          <p className="text-sm text-muted-foreground">No audit events yet.</p>
        )}
      </section>
    </div>
  );
}
