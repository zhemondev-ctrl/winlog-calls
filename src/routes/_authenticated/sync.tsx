import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Battery,
  CheckCircle2,
  CircleAlert,
  CloudUpload,
  MessageCircle,
  Phone,
  RefreshCw,
  Settings,
  WifiOff,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/winlog/app-shell";
import { useNativeSyncContext } from "@/components/winlog/native-sync-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { WinLogNative } from "@/lib/native";
import {
  diagnose,
  lastSynced,
  type FixAction,
  type Issue,
  type SyncSource,
} from "@/lib/sync-health";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sync")({
  head: () => ({
    meta: [
      { title: "Sync status — WinLog" },
      {
        name: "description",
        content:
          "Check call-history permissions, last SIM and WhatsApp uploads, and fix sync problems.",
      },
      { property: "og:title", content: "Sync status — WinLog" },
      {
        property: "og:description",
        content: "See whether this phone is uploading calls, and how to fix it if not.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SyncStatusPage,
});

function when(ms: number | null | undefined, now: number): string {
  if (!ms) return "Never";
  const diff = Math.max(0, now - ms);
  const min = Math.round(diff / 60_000);
  const ago =
    min < 1
      ? "just now"
      : min < 60
        ? `${min} min ago`
        : min < 1440
          ? `${Math.round(min / 60)} h ago`
          : `${Math.round(min / 1440)} days ago`;
  return `${ago} · ${new Date(ms).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** Newest call per source that the office has actually received (for this phone, or any phone in a browser). */
function useLatestReceived(deviceId: string | null) {
  return useQuery({
    queryKey: ["calls", "latest-received", deviceId ?? "all"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return { sim: null, whatsapp: null };
      const one = async (source: SyncSource) => {
        let q = supabase
          .from("call_logs")
          .select("started_at, created_at, device_name")
          .eq("user_id", userId)
          .eq("source", source);
        if (deviceId) q = q.eq("device_id", deviceId);
        const { data, error } = await q
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data;
      };
      const [sim, whatsapp] = await Promise.all([one("sim"), one("whatsapp")]);
      return { sim, whatsapp };
    },
  });
}

function SyncStatusPage() {
  const sync = useNativeSyncContext();
  const { native, status, background, sources, online, refreshStatus, refreshBackground } = sync;
  const now = useNow();
  const received = useLatestReceived(native ? (status?.deviceId ?? null) : null);

  useEffect(() => {
    if (!native) return;
    void refreshStatus();
    void refreshBackground();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshStatus();
        void refreshBackground();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [native, refreshStatus, refreshBackground]);

  if (!native) {
    return (
      <AppShell title="Sync status" kicker="Android app">
        <div className="max-w-xl space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <p>
              Open this page inside the <strong>WinLog app</strong> on the phone to see its
              permissions, upload times and fix-it steps.
            </p>
          </div>
          <ReceivedCard
            title="Calls received from your phones"
            sim={received.data?.sim ?? null}
            whatsapp={received.data?.whatsapp ?? null}
            loading={received.isLoading}
            now={now}
          />
        </div>
      </AppShell>
    );
  }

  const issues = diagnose({
    now,
    online,
    permissions: status,
    background,
    sim: sources.sim,
    whatsapp: sources.whatsapp,
    uploadError: sync.error,
  });
  const errors = issues.filter((i) => i.severity === "error").length;

  async function allowCallLog() {
    const s = await WinLogNative.requestCallLogPermission();
    await refreshStatus();
    if (s.callLog) {
      toast.success("Call history allowed");
      void sync.syncNow();
    } else {
      toast.error('Not allowed yet. Tap "Open app settings" and allow Call logs.');
    }
  }

  async function openAppSettings() {
    try {
      await WinLogNative.openAppSettings();
    } catch {
      toast.error("Open the phone's Settings → Apps → WinLog. (Update WinLog to get a shortcut.)");
    }
  }

  async function uploadNow() {
    await sync.syncNow();
    await refreshBackground();
    void received.refetch();
  }

  const run: Record<FixAction, (() => void) | null> = {
    callLog: allowCallLog,
    notifications: () => void WinLogNative.openNotificationAccessSettings(),
    battery: () => void WinLogNative.openBatterySettings(),
    appSettings: openAppSettings,
    syncNow: uploadNow,
    signIn: null,
    update: null,
  };

  const simAt = lastSynced(sources.sim, background?.lastSuccessAt);
  const waAt = lastSynced(sources.whatsapp, background?.lastSuccessAt);

  return (
    <AppShell title="Sync status" kicker={status?.deviceName ?? "This phone"}>
      <div className="max-w-xl space-y-4">
        <div
          className={cn(
            "flex items-center gap-4 rounded-2xl border-2 p-4 shadow-card",
            issues.length === 0
              ? "border-incoming/40 bg-incoming/10"
              : errors > 0
                ? "border-destructive/50 bg-destructive/10"
                : "border-accent bg-accent/15",
          )}
        >
          {issues.length === 0 ? (
            <CheckCircle2 className="size-8 shrink-0 text-incoming" />
          ) : (
            <AlertTriangle
              className={cn("size-8 shrink-0", errors > 0 ? "text-destructive" : "text-foreground")}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl font-bold">
              {issues.length === 0
                ? "Calls are uploading"
                : `${issues.length} ${issues.length === 1 ? "thing needs" : "things need"} attention`}
            </div>
            <p className="text-sm text-muted-foreground">
              {issues.length === 0
                ? "Everything is allowed and recent calls reached the office."
                : "Follow the steps below, then tap Upload now."}
            </p>
          </div>
          <Button variant="ink" onClick={uploadNow} disabled={sync.syncing || !online}>
            <RefreshCw className={cn(sync.syncing && "animate-spin")} />
            {sync.syncing ? "Uploading" : "Upload now"}
          </Button>
        </div>

        {issues.length > 0 && (
          <section className="space-y-3" aria-label="Troubleshooting">
            <h2 className="stamp text-muted-foreground">How to fix it</h2>
            {issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} run={run} />
            ))}
          </section>
        )}

        <section className="space-y-2" aria-label="Permissions">
          <h2 className="stamp text-muted-foreground">Permissions</h2>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
            <PermissionRow
              icon={<Phone className="size-5" />}
              title="Call history"
              hint="Needed for SIM calls"
              on={!!status?.callLog}
              action={
                <Button size="sm" variant="signal" onClick={allowCallLog}>
                  Allow
                </Button>
              }
            />
            <PermissionRow
              icon={<MessageCircle className="size-5" />}
              title="Notification access"
              hint="Needed for WhatsApp calls"
              on={!!status?.notificationAccess}
              action={
                <Button
                  size="sm"
                  variant="signal"
                  onClick={() => WinLogNative.openNotificationAccessSettings()}
                >
                  Turn on
                </Button>
              }
            />
            <PermissionRow
              icon={<Battery className="size-5" />}
              title="Background running"
              hint="Keeps uploads going when closed"
              on={!!status?.batteryUnrestricted}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => WinLogNative.openBatterySettings()}
                >
                  Allow
                </Button>
              }
            />
            <PermissionRow
              icon={online ? <CloudUpload className="size-5" /> : <WifiOff className="size-5" />}
              title="Internet"
              hint={online ? "Connected" : "No connection"}
              on={online}
            />
          </div>
          <button
            onClick={openAppSettings}
            className="flex items-center gap-1.5 px-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            <Settings className="size-4" /> Open app settings
          </button>
        </section>

        <section className="space-y-2" aria-label="Last sync">
          <h2 className="stamp text-muted-foreground">Last sync</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <SourceCard
              icon={<Phone className="size-4" />}
              title="SIM calls"
              syncedAt={simAt}
              count={sources.sim.error ? null : sources.sim.count}
              error={sources.sim.error}
              received={received.data?.sim ?? null}
              now={now}
            />
            <SourceCard
              icon={<MessageCircle className="size-4" />}
              title="WhatsApp calls"
              syncedAt={waAt}
              count={sources.whatsapp.error ? null : sources.whatsapp.count}
              error={sources.whatsapp.error}
              received={received.data?.whatsapp ?? null}
              now={now}
            />
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
            <div className="font-semibold">With the app closed</div>
            <div className="text-muted-foreground">
              {background === null
                ? "Not available in this app version."
                : !background.enabled
                  ? "Off"
                  : `On · last run ${when(background.lastRunAt, now)}`}
            </div>
            {background?.enabled && (
              <div className="text-muted-foreground">
                Last success: {when(background.lastSuccessAt, now)}
              </div>
            )}
          </div>
        </section>

        <section aria-label="Common questions">
          <h2 className="stamp mb-2 text-muted-foreground">Common questions</h2>
          <Accordion
            type="single"
            collapsible
            className="rounded-2xl border border-border bg-card px-4 shadow-card"
          >
            <AccordionItem value="wa">
              <AccordionTrigger>A WhatsApp call is missing</AccordionTrigger>
              <AccordionContent className="space-y-1 text-muted-foreground">
                <p>WinLog sees WhatsApp calls through their notifications, so:</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Notification access for WinLog must be on (above).</li>
                  <li>In WhatsApp → Settings → Notifications, keep call notifications on.</li>
                  <li>Calls made before notification access was on can't be recovered.</li>
                  <li>WhatsApp calls never include the phone number, only the contact name.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="sim">
              <AccordionTrigger>A SIM call is missing</AccordionTrigger>
              <AccordionContent className="space-y-1 text-muted-foreground">
                <ol className="list-decimal space-y-1 pl-5">
                  <li>
                    Check the call is in the phone's own Recents list. Deleted calls can't be
                    uploaded.
                  </li>
                  <li>Tap Upload now and wait a few seconds.</li>
                  <li>
                    If it is from a second SIM, both SIMs are read; check the SIM label in Calls.
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="closed" className="border-b-0">
              <AccordionTrigger>Uploads stop when the app is closed</AccordionTrigger>
              <AccordionContent className="space-y-1 text-muted-foreground">
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Allow background running (above).</li>
                  <li>Don't swipe WinLog away with "Force stop" in Settings.</li>
                  <li>
                    Background uploads run about every 15 minutes; Android may delay them when the
                    battery is low.
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <p className="stamp text-muted-foreground">
          {status?.appVersion ? `App ${status.appVersion} · ` : ""}Phone ID{" "}
          {status?.deviceId?.slice(0, 8) ?? "—"}
          {" · "}
          <Link to="/phone" className="underline underline-offset-4">
            Phone setup
          </Link>
        </p>
      </div>
    </AppShell>
  );
}

function IssueCard({ issue, run }: { issue: Issue; run: Record<FixAction, (() => void) | null> }) {
  const labels: Record<FixAction, string> = {
    callLog: "Allow call history",
    notifications: "Turn on notification access",
    battery: "Allow background running",
    appSettings: "Open app settings",
    syncNow: "Upload now",
    signIn: "",
    update: "",
  };
  const buttons = issue.actions.filter((a) => run[a] && labels[a]);
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-card",
        issue.severity === "error" ? "border-destructive/60" : "border-accent",
      )}
    >
      <div className="flex items-start gap-3">
        <CircleAlert
          className={cn(
            "mt-0.5 size-5 shrink-0",
            issue.severity === "error" ? "text-destructive" : "text-foreground",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{issue.title}</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {issue.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {issue.detail && (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-secondary px-3 py-2 font-mono text-xs text-muted-foreground">
              {issue.detail}
            </pre>
          )}
          {buttons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {buttons.map((a, i) => (
                <Button
                  key={a}
                  size="sm"
                  variant={i === 0 ? "signal" : "outline"}
                  className={cn(i > 0 && "rounded-full")}
                  onClick={() => run[a]?.()}
                >
                  {labels[a]}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissionRow({
  icon,
  title,
  hint,
  on,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  on: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          on ? "bg-incoming/15 text-incoming" : "bg-destructive/10 text-destructive",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      {on ? (
        <span className="stamp rounded-full bg-incoming/15 px-2.5 py-1 text-incoming">On</span>
      ) : (
        (action ?? (
          <span className="stamp rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
            Off
          </span>
        ))
      )}
    </div>
  );
}

type Received = { started_at: string; created_at: string; device_name: string | null } | null;

function SourceCard({
  icon,
  title,
  syncedAt,
  count,
  error,
  received,
  now,
}: {
  icon: ReactNode;
  title: string;
  syncedAt: number | null;
  count: number | null;
  error: string | null;
  received: Received;
  now: number;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 text-sm shadow-card",
        error ? "border-destructive/60" : "border-border",
      )}
    >
      <div className="mb-2 flex items-center gap-2 font-semibold">
        {icon} {title}
      </div>
      <div className="stamp text-muted-foreground">Last checked</div>
      <div>{when(syncedAt, now)}</div>
      {count !== null && syncedAt && (
        <div className="text-xs text-muted-foreground">
          {count} calls read on the last open-app check
        </div>
      )}
      {error && <div className="mt-1 text-destructive">Last try failed: {error}</div>}
      <div className="stamp mt-3 text-muted-foreground">Newest call at the office</div>
      <div>{received ? when(new Date(received.started_at).getTime(), now) : "None yet"}</div>
    </div>
  );
}

function ReceivedCard({
  title,
  sim,
  whatsapp,
  loading,
  now,
}: {
  title: string;
  sim: Received;
  whatsapp: Received;
  loading: boolean;
  now: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
      <div className="mb-2 font-semibold">{title}</div>
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">SIM</dt>
          <dd>
            {sim
              ? `${when(new Date(sim.created_at).getTime(), now)}${sim.device_name ? ` · ${sim.device_name}` : ""}`
              : "None yet"}
          </dd>
          <dt className="text-muted-foreground">WhatsApp</dt>
          <dd>
            {whatsapp
              ? `${when(new Date(whatsapp.created_at).getTime(), now)}${whatsapp.device_name ? ` · ${whatsapp.device_name}` : ""}`
              : "None yet"}
          </dd>
        </dl>
      )}
    </div>
  );
}
