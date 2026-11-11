import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BarChart3, ListOrdered, LogOut, Smartphone, Users } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useNativeSyncContext } from "./native-sync-context";

const NAV = [
  { to: "/dashboard", label: "Today", icon: BarChart3, adminOnly: false },
  { to: "/calls", label: "Calls", icon: ListOrdered, adminOnly: false },
  { to: "/team", label: "Team", icon: Users, adminOnly: true },
  { to: "/phone", label: "Phone", icon: Smartphone, adminOnly: false },
] as const;

export function AppShell({ title, kicker, children }: { title: string; kicker?: ReactNode; children: ReactNode }) {
  const { data: me } = useSuspenseQuery(meQuery);
  const sync = useNativeSyncContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const items = NAV.filter((n) => !n.adminOnly || me?.isAdmin);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="ledger-bg min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full border-2 border-foreground bg-accent font-display text-sm font-extrabold">
              W
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight">WinLog</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "bg-primary text-primary-foreground hover:text-primary-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {sync.native && (
              <span className="stamp hidden text-muted-foreground sm:inline">
                {sync.syncing ? "Uploading…" : "Synced"}
              </span>
            )}
            <span className="hidden text-sm text-muted-foreground sm:inline">{me?.displayName}</span>
            <button
              onClick={signOut}
              className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6">
        <div className="mb-6 animate-rise">
          {kicker && <div className="stamp mb-1 text-muted-foreground">{kicker}</div>}
          <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
        </div>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium text-muted-foreground"
              activeProps={{ className: "text-foreground [&_svg]:bg-accent [&_svg]:border-foreground" }}
            >
              <item.icon className={cn("box-content size-5 rounded-full border border-transparent px-3 py-1")} />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
