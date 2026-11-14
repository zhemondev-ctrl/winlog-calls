import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { BrandPanel } from "@/components/winlog/brand-panel";
import { Segmented } from "@/components/winlog/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({ next: oauthReturnPath(s["next"]) }),
  head: () => ({
    meta: [
      { title: "Sign in — WinLog" },
      { name: "description", content: "Sign in to WinLog to log and review company phone calls." },
      { property: "og:title", content: "Sign in — WinLog" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const { next } = Route.useSearch();
  const destination = !next || next === "/" ? "/dashboard" : next;
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ href: destination, replace: true });
    });
  }, [navigate, destination]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ href: destination, replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: new URL(destination, window.location.origin).href, data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) navigate({ href: destination, replace: true });
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

  async function socialSignIn(provider: "google" | "lovable") {
    setBusy(true);
    try {
      const callback = new URL("/auth", window.location.origin);
      callback.searchParams.set("next", destination);
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: callback.href });
      if (result.error) throw result.error;
      if (result.redirected) return;
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) await navigate({ href: destination, replace: true });
      else throw new Error("Sign-in did not complete. Please try again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in could not be completed.");
    } finally { setBusy(false); }
  }

  return (
    <BrandPanel>
      <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-wide">
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

      <Button asChild variant="outline" className="mt-4 w-full"><Link to="/phone-code">Company phone setup</Link></Button>

      {mode !== "forgot" && <div className="mt-4 space-y-3">
        <Button className="google-signin h-11 w-full gap-2.5" variant="outline" disabled={busy} onClick={() => socialSignIn("google")}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          Continue with Google
        </Button>
        <Button className="h-11 w-full" variant="outline" disabled={busy} onClick={() => socialSignIn("lovable")}>Continue with Lovable</Button>
      </div>}

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
