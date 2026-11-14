import { CloudUpload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNativeSyncContext } from "./native-sync-context";

export function PhoneUploadStatus() {
  const { native, pending, pendingError, syncing, online, error, background, lastAt, syncNow } = useNativeSyncContext();
  if (!native) return null;
  const lastUpload = Math.max(lastAt ?? 0, background?.lastSuccessAt ?? 0);
  return (
    <section aria-label="Phone upload status" aria-live="polite" className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
      <div className="flex min-w-0 items-start gap-3">
        <CloudUpload className="mt-1 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="font-semibold">{pending?.total != null ? `${pending.total} ${pending.total === 1 ? "call" : "calls"} waiting to upload` : "Waiting calls: checking required"}</h2>
          <p className="text-sm text-muted-foreground">{syncing ? "Uploading…" : !online ? "Offline · uploads waiting for internet" : "Phone sync"}{pending ? ` · SIM ${pending.sim ?? "permission needed"} · WhatsApp ${pending.whatsapp}` : ""}</p>
          <p className="mt-1 text-xs text-muted-foreground">Last successful sync: {lastUpload ? new Date(lastUpload).toLocaleString() : "No uploads yet"}</p>
          {(pendingError || error || background?.lastError) && <p className="mt-1 max-w-lg break-words text-sm text-destructive">{pendingError || error || background?.lastError}</p>}
        </div>
      </div>
      <Button variant="outline" onClick={() => void syncNow()} disabled={syncing || !online}><RefreshCw className={syncing ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} />Sync now</Button>
    </section>
  );
}