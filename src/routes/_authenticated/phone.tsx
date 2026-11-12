import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Battery,
  Check,
  ChevronRight,
  MessageCircle,
  Phone,
  RefreshCw,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/winlog/app-shell";
import { useNativeSyncContext } from "@/components/winlog/native-sync-context";
import { Button } from "@/components/ui/button";
import { WinLogNative } from "@/lib/native";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/phone")({
  head: () => ({
    meta: [
      { title: "Phone setup — WinLog" },
      {
        name: "description",
        content: "Allow call history and WhatsApp call capture on this phone.",
      },
      { property: "og:title", content: "Phone setup — WinLog" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Set up WinLog on a company phone." },
    ],
  }),
  component: PhonePage,
});

function PhonePage() {
  const sync = useNativeSyncContext();
  const { native, status, refreshStatus, background, refreshBackground } = sync;

  useEffect(() => {
    if (native) {
      void refreshStatus();
      void refreshBackground();
    }
  }, [native, refreshStatus, refreshBackground]);

  if (!native) {
    return (
      <AppShell title="Phone setup" kicker="Android app">
        <div className="max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
          <p>
            Calls are collected by the <strong>WinLog Android app</strong>. Install it on every
            company phone and sign in with that employee's account.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Open the latest WinLog build on your GitHub repository's Releases page and download
              the APK.
            </li>
            <li>Open the file on the phone and allow "Install unknown apps" if Android asks.</li>
            <li>Sign in, then follow the setup steps the app shows.</li>
          </ol>
          <p className="text-sm text-muted-foreground">
            This page in a normal browser only shows uploaded calls.
          </p>
        </div>
      </AppShell>
    );
  }

  async function allowCallLog() {
    const s = await WinLogNative.requestCallLogPermission();
    await refreshStatus();
    if (s.callLog) {
      toast.success("Call history allowed");
      void sync.syncNow();
    } else {
      toast.error("Call history was not allowed. Open the app's settings to allow it.");
    }
  }

  return (
    <AppShell title="Phone setup" kicker={status?.deviceName ?? "This phone"}>
      <div className="max-w-xl space-y-3">
        <SetupChecklist
          items={[
            { label: "Call history access", done: !!status?.callLog },
            { label: "Notification access (WhatsApp)", done: !!status?.notificationAccess },
            { label: "Battery: unrestricted", done: !!status?.batteryUnrestricted },
          ]}
          onRecheck={() => void refreshStatus()}
        />
        <Link
          to="/sync"
          className="flex items-center gap-4 rounded-2xl border-2 border-foreground bg-accent p-4 text-accent-foreground shadow-card"
        >
          <Activity className="size-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Sync status & help</div>
            <div className="text-sm opacity-80">
              Permissions, last SIM and WhatsApp upload, and fix-it steps
            </div>
          </div>
          <ChevronRight className="size-5" />
        </Link>
        <Step
          done={!!status?.callLog}
          icon={<Phone className="size-5" />}
          title="SIM calls"
          body="Reads this phone's call history: number, name, time and talk time."
          action={
            <Button variant="signal" onClick={allowCallLog}>
              Allow
            </Button>
          }
        />
        <Step
          done={!!status?.notificationAccess}
          icon={<MessageCircle className="size-5" />}
          title="WhatsApp calls"
          body='Turn on "WinLog" in Notification access. WinLog then records incoming, outgoing and missed WhatsApp calls with talk time, from now on.'
          action={
            <Button variant="signal" onClick={() => WinLogNative.openNotificationAccessSettings()}>
              Turn on
            </Button>
          }
        />
        <Step
          done={!!status?.batteryUnrestricted}
          icon={<Battery className="size-5" />}
          title="Keep running"
          body="Stops the phone from closing WinLog in the background, so no WhatsApp call is missed."
          action={
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => WinLogNative.openBatterySettings()}
            >
              Allow
            </Button>
          }
        />

        <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Upload</div>
              <div className="text-sm text-muted-foreground">
                {sync.lastAt
                  ? `Last upload ${new Date(sync.lastAt).toLocaleString()}`
                  : "Not uploaded yet"}
                {sync.lastResult
                  ? ` · ${sync.lastResult.sim} SIM, ${sync.lastResult.whatsapp} WhatsApp checked`
                  : ""}
              </div>
              {sync.error && <div className="mt-1 text-sm text-destructive">{sync.error}</div>}
            </div>
            <Button variant="ink" onClick={() => sync.syncNow()} disabled={sync.syncing}>
              <RefreshCw className={cn(sync.syncing && "animate-spin")} />
              {sync.syncing ? "Uploading" : "Upload now"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            WinLog uploads whenever the app is opened, every 5 minutes while it's open, and in the
            background every 15 minutes (and shortly after each WhatsApp call) while it's closed.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="font-semibold">Background upload</div>
          <div className="text-sm text-muted-foreground">
            {background === null
              ? "Update to the newest WinLog app to upload while the app is closed."
              : background.enabled
                ? background.lastSuccessAt
                  ? `On · last background upload ${new Date(background.lastSuccessAt).toLocaleString()}`
                  : "On · first background upload starts within 15 minutes"
                : "Off · sign in again to turn it on"}
          </div>
          {background?.lastError && (
            <div className="mt-1 text-sm text-destructive">{background.lastError}</div>
          )}
        </div>
        {status?.appVersion && (
          <p className="stamp text-muted-foreground">App version {status.appVersion}</p>
        )}
      </div>
    </AppShell>
  );
}

function Step({
  done,
  icon,
  title,
  body,
  action,
}: {
  done: boolean;
  icon: ReactNode;
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-4 rounded-2xl border bg-card p-4 shadow-card",
        done ? "border-border" : "border-foreground",
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full",
          done ? "bg-incoming/15 text-incoming" : "bg-secondary",
        )}
      >
        {done ? <Check className="size-5" /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {!done && <div className="self-center">{action}</div>}
    </div>
  );
}

function SetupChecklist({
  items,
  onRecheck,
}: {
  items: { label: string; done: boolean }[];
  onRecheck: () => void;
}) {
  const done = items.filter((i) => i.done).length;
  const ready = done === items.length;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Setup checklist</div>
          <div className="text-sm text-muted-foreground">
            {ready ? "Ready to sync" : `${done} of ${items.length} done — finish the steps below`}
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={onRecheck}>
          <RefreshCw /> Check again
        </Button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", ready ? "bg-incoming" : "bg-accent")}
          style={{ width: `${(done / items.length) * 100}%` }}
        />
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full",
                i.done ? "bg-incoming/15 text-incoming" : "border border-border",
              )}
            >
              {i.done && <Check className="size-3.5" />}
            </span>
            <span className={cn(!i.done && "text-muted-foreground")}>{i.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
