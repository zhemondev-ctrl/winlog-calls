import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandPanel } from "@/components/winlog/brand-panel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Connect an assistant — Winlog Calls" },
    { name: "description", content: "Approve private assistant access with your existing Winlog Calls permissions." },
    { property: "og:title", content: "Connect an assistant — Winlog Calls" },
    { property: "og:description", content: "Control assistant access to your Winlog Calls account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (s: Record<string, unknown>) => ({ authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "" }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("This connection request is missing its authorization ID.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error("Could not check your account. Please try again.");
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr + location.hash } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.searchStr).get("authorization_id");
    if (!id) throw new Error("Invalid connection request.");
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
    if (error) throw new Error("This connection request is invalid or expired. Start again from your assistant.");
    if (data && "redirect_url" in data) throw redirect({ href: data.redirect_url });
    const { data: account } = await supabase.auth.getUser();
    return { details: data, email: account.user?.email };
  },
  pendingComponent: () => <BrandPanel><p>Loading connection request…</p></BrandPanel>,
  errorComponent: ({ error }) => <BrandPanel><h1 className="font-display text-2xl">Connection unavailable</h1><p role="alert" className="mt-4">{error instanceof Error ? error.message : "Please restart this connection."}</p></BrandPanel>,
  component: Consent,
});
function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(approve: boolean) {
    setBusy(true); setError("");
    try {
      const result = approve ? await supabase.auth.oauth.approveAuthorization(authorization_id) : await supabase.auth.oauth.denyAuthorization(authorization_id);
      if (result.error) throw new Error(approve ? "Approval failed. Please try again." : "Cancellation failed. Please try again.");
      if (!result.data?.redirect_url) throw new Error("No return address was supplied. Start again from your assistant.");
      window.location.assign(result.data.redirect_url);
    } catch (err) { setError(err instanceof Error ? err.message : "Connection failed."); setBusy(false); }
  }
  if (!details || "redirect_url" in details) return null;
  return <BrandPanel>
    <h1 className="font-display text-3xl">Connect {details.client.name} to Winlog Calls</h1>
    <p className="mt-4 text-muted-foreground">{email}</p>
    <p className="mt-4">This lets {details.client.name} use this app as you.</p>
    <p className="mt-2 break-all text-sm text-muted-foreground">{details.redirect_uri}</p>
    <ul className="my-5 list-disc space-y-2 pl-5">
      {details.scope.split(" ").filter(Boolean).map(scope => <li key={scope}>{scope === "openid" || scope === "profile" ? "Share your basic profile" : scope === "email" ? "Share your email address" : `Additional permission requested: ${scope}`}</li>)}
      <li>Read permitted call metadata and support cases.</li>
    </ul>
    <p className="text-sm text-muted-foreground">Your app permissions still apply. No replies are sent and no records are changed.</p>
    {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
    <div className="mt-6 flex gap-3"><Button disabled={busy} onClick={() => decide(true)}>Approve connection</Button><Button variant="outline" disabled={busy} onClick={() => decide(false)}>Cancel connection</Button></div>
  </BrandPanel>;
}