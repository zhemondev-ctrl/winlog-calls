import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Clock, Download, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAndroidRelease } from "@/lib/app-release.functions";
import { buildState, releaseVersion, WORKFLOW_URL } from "@/lib/app-release";
import { cn } from "@/lib/utils";

export function DashboardRelease() {
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["android-release"], queryFn: () => getAndroidRelease(),
    staleTime: 30000, refetchInterval: 30000, refetchIntervalInBackground: false,
  });
  const state = data?.build ? buildState(data.build.status, data.build.conclusion) : null;
  const Icon = state === "Succeeded" ? CheckCircle2 : state === "Failed" ? CircleAlert : Clock;
  const version = data?.release ? releaseVersion(data.release.tag) : null;
  const timestamp = data?.build?.finishedAt ?? data?.build?.startedAt;
  return <section aria-label="Android release and build" className="mb-6 border-y border-border py-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold">Android APK</h2>
      <Button variant="outline" size="icon" aria-label="Refresh Android build" title="Refresh Android build" disabled={isFetching} onClick={() => void refetch()}>
        <RefreshCw className={cn(isFetching && "animate-spin motion-reduce:animate-none")} />
      </Button>
    </div>
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Latest build</p>
        <p role="status" className={cn("mt-1 flex items-center gap-2 font-semibold", state === "Failed" ? "text-destructive" : state === "Succeeded" ? "text-incoming" : "text-foreground")}>
          <Icon className="size-4 shrink-0" />{state ? `${state} · #${data?.build?.number}` : error ? "Status unavailable" : data ? "No build available" : "Checking…"}
        </p>
        {timestamp && <p className="mt-1 text-xs text-muted-foreground">{data?.build?.finishedAt ? "Finished" : "Started"} {new Date(timestamp).toLocaleString()}</p>}
        {(error || data?.buildError) && <p className="mt-1 text-sm text-destructive">{error?.message ?? data?.buildError}</p>}
        <Button asChild variant="link" className="mt-1 h-auto px-0"><a href={data?.build?.url ?? WORKFLOW_URL} target="_blank" rel="noopener noreferrer"><ExternalLink />Build details</a></Button>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Latest signed APK</p>
        <p className="mt-1 break-words font-semibold">{data?.release ? version ?? data.release.name : data?.releaseError ?? (error ? "Release unavailable" : "Checking…")}</p>
        {data?.release && <p className="mt-1 text-xs text-muted-foreground">Published {new Date(data.release.publishedAt).toLocaleString()}</p>}
        {data?.release?.downloadUrl && <Button asChild variant="ink" className="mt-3"><a href={data.release.downloadUrl} target="_blank" rel="noopener noreferrer"><Download />Download APK</a></Button>}
      </div>
    </div>
  </section>;
}