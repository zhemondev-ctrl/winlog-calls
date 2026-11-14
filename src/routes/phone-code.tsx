import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { BrandPanel } from "@/components/winlog/brand-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redeemPhoneCode } from "@/lib/phone-code.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/phone-code")({
  head: () => ({ meta: [
    { title: "Company phone setup — Winlog Calls" },
    { name: "description", content: "Activate a team phone with a private company setup code." },
    { property: "og:title", content: "Company phone setup — Winlog Calls" },
    { property: "og:description", content: "Private staff phone activation for Winstone call logs." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: PhoneCodePage,
});

function PhoneCodePage() {
  const redeem = useServerFn(redeemPhoneCode);
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const tokens = await redeem({ data: { code } });
      const { error: sessionError } = await supabase.auth.setSession(tokens);
      if (sessionError) throw sessionError;
      await navigate({ to: "/phone", replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not activate phone"); }
    finally { setBusy(false); }
  }
  return <BrandPanel>
    <h1 className="font-display text-4xl font-bold">Company phone setup</h1>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="space-y-2"><Label htmlFor="company-code">Company code</Label>
        <Input id="company-code" value={code} onChange={e => setCode(e.target.value)} required autoComplete="off" className="h-11 bg-card font-mono" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="signal" className="w-full" disabled={busy}>{busy ? "Activating…" : "Activate phone"}</Button>
    </form>
    <Button asChild variant="link" className="mt-4 self-start"><Link to="/auth">Manager sign in</Link></Button>
  </BrandPanel>;
}