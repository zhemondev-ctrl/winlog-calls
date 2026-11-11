import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { BrandPanel } from "@/components/winlog/brand-panel";
import { Segmented } from "@/components/winlog/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — WinLog" },
      { name: "description", content: "Sign in to WinLog to log and review company phone calls." },
      { property: "og:title", content: "Sign in — WinLog" },
      {
        property: "og:description",
        content: "Sign in to WinLog, the call log for company phones.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else setNotice("Check your email and tap the confirmation link, then sign in here.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BrandPanel>
      <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight">
        {mode === "signup"
          ? "Add this phone's owner."
          : mode === "forgot"
            ? "Reset password."
            : "Every call, logged."}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {mode === "signup"
          ? "Each employee gets their own account. The first account becomes the manager."
          : mode === "forgot"
            ? "We'll email you a link to choose a new password."
            : "Sign in with your company account."}
      </p>

      {mode !== "forgot" && (
        <div className="mt-6">
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setNotice(null);
            }}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
          />
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 bg-card"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 bg-card"
          />
        </div>
        {mode !== "forgot" && (
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-card"
            />
          </div>
        )}
        {notice && <p className="rounded-xl bg-accent/60 px-3 py-2 text-sm">{notice}</p>}
        <Button type="submit" variant="signal" size="xl" className="w-full" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "forgot" ? "signin" : "forgot");
          setNotice(null);
        }}
        className="mt-4 self-start text-sm font-medium underline underline-offset-4"
      >
        {mode === "forgot" ? "Back to sign in" : "Forgot password?"}
      </button>
    </BrandPanel>
  );
}
