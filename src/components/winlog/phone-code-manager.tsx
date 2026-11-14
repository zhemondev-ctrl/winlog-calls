import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Smartphone, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { enrollmentStaff, issuePhoneCode } from "@/lib/phone-code.functions";

export function PhoneCodeManager() {
  const loadStaff = useServerFn(enrollmentStaff);
  const issue = useServerFn(issuePhoneCode);
  const { data: staff = [], error } = useQuery({ queryKey: ["enrollment-staff"], queryFn: () => loadStaff() });
  const [selected, setSelected] = useState("");
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function generate() {
    setBusy(true); setIssued(null);
    try { setIssued(await issue({ data: { staffId: selected } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not create code"); }
    finally { setBusy(false); }
  }
  return <section className="mb-6 border-y border-border py-4">
    <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Smartphone className="size-5" />Company phone setup</h2>
    <div className="flex flex-wrap gap-3">
      <Select value={selected} onValueChange={v => { setSelected(v); setIssued(null); }}>
        <SelectTrigger className="w-full bg-card sm:w-64" aria-label="Phone staff member"><SelectValue placeholder="Select staff member" /></SelectTrigger>
        <SelectContent>{staff.map(p => <SelectItem value={p.id} key={p.id}>{p.display_name || "Unnamed staff"}</SelectItem>)}</SelectContent>
      </Select>
      <Button variant="signal" disabled={!selected || busy} onClick={generate}><KeyRound />{busy ? "Creating…" : "Create company code"}</Button>
    </div>
    {error && <p className="mt-2 text-sm text-destructive">Could not load staff members.</p>}
    {!error && staff.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No staff accounts yet.</p>}
    {issued && <div className="mt-3 space-y-2">
      <p className="text-sm">Staff: {staff.find(p => p.id === selected)?.display_name}</p>
      <code className="block break-all rounded border border-border bg-card p-3 font-mono">{issued.code.match(/.{1,4}/g)?.join("-")}</code>
      <p className="text-xs text-muted-foreground">Single use · expires {new Date(issued.expiresAt).toLocaleString()}</p>
    </div>}
  </section>;
}