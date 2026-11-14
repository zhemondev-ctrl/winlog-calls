import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BarChart3, BellRing, Info, Inbox, ListOrdered, LogOut, MessagesSquare, Smartphone, Users } from "lucide-react";
import type { ReactNode } from "react";

import logo from "@/assets/winstone-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { stopBackgroundUpload } from "@/lib/background-upload";
import { meQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useNativeSyncContext } from "./native-sync-context";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3, adminOnly: false },
  { to: "/calls", label: "Calls", icon: ListOrdered, adminOnly: false },
  { to: "/follow-ups", label: "Follow-ups", icon: BellRing, adminOnly: true },
  { to: "/team", label: "Team", icon: Users, adminOnly: true },
  { to: "/assistant", label: "Ask AI", icon: MessagesSquare, adminOnly: true },
  { to: "/phone", label: "Phone", icon: Smartphone, adminOnly: false },
] as const;

export function AppShell({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: ReactNode;
  children: ReactNode;
}) {
  const { data: me } = useSuspenseQuery(meQuery);
  const sync = useNativeSyncContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const items = NAV.filter((n) => !n.adminOnly || me?.isAdmin);

  async function signOut() {
    await stopBackgroundUpload();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="ledger-bg min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-20 border-b-2 border-gold bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src={logo.url} alt="Winstone Properties" className="size-9 rounded-full" />
            <span className="font-display text-lg font-bold tracking-wide text-accent">Winlog Calls</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (item.to === "/follow-ups") {
                    window.__lovableEvents?.track?.("lovable.interaction", {
                      action: "view_follow_ups",
                      target: "follow_up_queue",
                    });
                  }
                }}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                activeProps={{
                  className: "bg-accent text-accent-foreground hover:text-accent-foreground",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="shrink-0 text-primary-foreground/70 hover:bg-primary-foreground/10">
              <Link to="/support" aria-label="Support workspace" title="Support workspace"><Inbox className="size-4" /></Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="shrink-0 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/version" aria-label="App version and build status" title="App version and build status"><Info className="size-4" /></Link>
            </Button>
            {sync.native && (
              <Link
                to="/sync"
                className={cn(
                  "stamp rounded-full px-2.5 py-1",
                  sync.error || !sync.online
                    ? "bg-destructive text-destructive-foreground"
                    : "text-primary-foreground/70",
                )}
              >
                {sync.syncing
                  ? "Uploading…"
                  : !sync.online
                    ? "Offline"
                    : sync.error
                      ? "Sync problem"
                      : "Synced"}
              </Link>
            )}
            <span className="hidden text-sm text-primary-foreground/80 sm:inline">
              {me?.displayName}
            </span>
            <Button variant="ghost" size="icon" title="Sign out"
              onClick={signOut}
              className="grid size-9 place-items-center rounded-full text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6">
        <div className="mb-6 animate-rise">
          {kicker && <div className="stamp mb-1 text-muted-foreground">{kicker}</div>}
          <h1 className="font-display text-3xl font-bold tracking-wide md:text-4xl">{title}</h1>
        </div>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => {
                if (item.to === "/follow-ups") {
                  window.__lovableEvents?.track?.("lovable.interaction", {
                    action: "view_follow_ups",
                    target: "follow_up_queue",
                  });
                }
              }}
              className="flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium text-muted-foreground"
              activeProps={{
                className: "text-foreground [&_svg]:bg-accent [&_svg]:border-foreground",
              }}
            >
              <item.icon
                className={cn(
                  "box-content size-5 rounded-full border border-transparent px-3 py-1",
                )}
              />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
