import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { CheckCircle2, CircleAlert, Clock, Download, ExternalLink, RefreshCw, Smartphone } from "lucide-react";
import { AppShell } from "@/components/winlog/app-shell";
import { useNativeSyncContext } from "@/components/winlog/native-sync-context";
import { Button } from "@/components/ui/button";
import { getAndroidRelease } from "@/lib/app-release.functions";
import { buildState, releaseVersion, LATEST_RELEASE_URL, WORKFLOW_URL } from "@/lib/app-release";
import { cn } from "@/lib/utils";

const releaseQuery = queryOptions({
  queryKey: ["android-release"], queryFn: () => getAndroidRelease(), staleTime: 30000,
  refetchInterval: 30000, refetchIntervalInBackground: false,
});

export const Route = createFileRoute("/_authenticated/version")({
  head: () => ({ meta: [
    { title: "App version & builds — Winlog Calls" },
    { name: "description", content: "Installed Android version, latest signed APK release and Android build status for Winlog Calls." },
    { property: "og:title", content: "App version & builds — Winlog Calls" },
    { property: "og:description", content: "Check your Winlog Calls version and the latest Android release and build." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(releaseQuery),
  component: VersionPage,
});

function time(value: string | null) { return value ? new Date(value).toLocaleString() : "Not started"; }

function VersionPage() {
  const sync = useNativeSyncContext();
  const { data, refetch, isFetching, error } = useSuspenseQuery(releaseQuery);
  useEffect(() => { if (sync.native) void sync.refreshStatus(); }, [sync.native, sync.refreshStatus]);
  const state = data.build ? buildState(data.build.status, data.build.conclusion) : null;
  const StateIcon = state === "Succeeded" ? CheckCircle2 : state === "Failed" ? CircleAlert : Clock;
  const latestVersion = data.release ? releaseVersion(data.release.tag) : null;

  return <AppShell title="App version" kicker="Winlog Calls · Android">
    <div className="max-w-2xl space-y-8">
      <section className="border-y border-border py-5">
        <div className="flex items-center gap-3"><Smartphone className="size-6 text-gold" /><h2 className="text-lg font-semibold">Installed version</h2></div>
        <p className="mt-3 font-mono text-3xl font-semibold">{sync.native ? sync.status?.appVersion ?? "Unavailable" : "Web browser"}</p>
        <p className="mt-2 text-sm text-muted-foreground">{sync.native ? sync.status?.deviceName ?? "This Android phone" : "No Android APK is installed in this browser."}</p>
        {sync.native && latestVersion && sync.status?.appVersion === latestVersion && <p className="mt-2 text-sm text-incoming">Matches the latest release</p>}
      </section>
      <section>
        <h2 className="text-lg font-semibold">Latest signed APK release</h2>
        {data.release ? <><p className="mt-2 font-medium">{data.release.name}{latestVersion ? ` · ${latestVersion}` : ""}</p><p className="mt-1 text-sm text-muted-foreground">Published {time(data.release.publishedAt)}</p></> : <p className="mt-2 text-sm text-muted-foreground">{data.releaseError ?? "No release available"}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          {data.release?.downloadUrl && <Button asChild variant="ink"><a href={data.release.downloadUrl} target="_blank" rel="noopener noreferrer"><Download />Download APK</a></Button>}
          <Button asChild variant="outline"><a href={data.release?.url ?? LATEST_RELEASE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink />Latest release</a></Button>
        </div>
      </section>
      <section className="border-t border-border pt-5" aria-label="Android build status">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Android build status</h2><Button variant="outline" size="icon" title="Refresh build status" aria-label="Refresh build status" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={cn(isFetching && "animate-spin motion-reduce:animate-none")} /></Button></div>
        {data.build ? <>
          <div className={cn("mt-4 flex items-center gap-2 font-semibold", state === "Succeeded" ? "text-incoming" : state === "Failed" ? "text-destructive" : "text-foreground")} role="status"><StateIcon className="size-5" />{state} · Build #{data.build.number}</div>
          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Branch</dt><dd className="break-all">{data.build.branch} · {data.build.commit}</dd>
            <dt className="text-muted-foreground">Started</dt><dd>{time(data.build.startedAt)}</dd>
            <dt className="text-muted-foreground">{state === "Succeeded" ? "Succeeded" : state === "Failed" ? "Failed" : "Finished"}</dt><dd>{data.build.finishedAt ? time(data.build.finishedAt) : "—"}</dd>
          </dl>
        </> : <p className="mt-3 text-sm text-muted-foreground">{data.buildError ?? "No Android builds yet."}</p>}
        {(data.buildError || error) && <p role="alert" className="mt-3 text-sm text-destructive">{data.buildError ?? "Could not refresh build status."}</p>}
        <p className="mt-4 text-xs text-muted-foreground">Last checked {time(data.checkedAt)}</p>
        <Button asChild variant="link" className="mt-2 px-0"><a href={data.build?.url ?? WORKFLOW_URL} target="_blank" rel="noopener noreferrer"><ExternalLink />View build on GitHub</a></Button>
      </section>
    </div>
  </AppShell>;
}