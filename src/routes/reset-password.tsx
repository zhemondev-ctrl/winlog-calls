import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { BrandPanel } from "@/components/winlog/brand-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — WinLog" },
      { name: "description", content: "Set a new password for your WinLog account." },
      { property: "og:title", content: "Choose a new password — WinLog" },
      { property: "og:description", content: "Set a new password for your WinLog account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <BrandPanel>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">New password.</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 bg-card"
          />
        </div>
        <Button type="submit" variant="signal" size="xl" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </Button>
      </form>
    </BrandPanel>
  );
}
