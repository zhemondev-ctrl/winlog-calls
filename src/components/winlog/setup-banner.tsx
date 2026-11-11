import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { useNativeSyncContext } from "./native-sync-context";

/** Shown inside the Android app until call history and WhatsApp capture are both switched on. */
export function SetupBanner() {
  const { native, status } = useNativeSyncContext();
  if (!native || !status) return null;
  if (status.callLog && status.notificationAccess) return null;
  return (
    <Link
      to="/phone"
      className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-foreground bg-accent p-4 shadow-lift"
    >
      <AlertTriangle className="size-5 shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">Finish phone setup</div>
        <div>
          {!status.callLog
            ? "Allow call history so SIM calls are logged."
            : "Turn on WhatsApp call capture."}
        </div>
      </div>
    </Link>
  );
}
