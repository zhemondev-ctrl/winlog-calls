/** Turns the phone's permission and upload state into plain-language problems with fix-it steps. */

export type SyncSource = "sim" | "whatsapp";

export interface SourceSync {
  /** Last time this source was read and uploaded without an error (ms). */
  at: number | null;
  /** Calls read on that run. */
  count: number;
  /** Error from the most recent attempt, if it failed. */
  error: string | null;
}

export interface HealthInput {
  now: number;
  online: boolean;
  permissions: {
    callLog: boolean;
    notificationAccess: boolean;
    batteryUnrestricted: boolean;
  } | null;
  /** null = app version without background uploads. */
  background: { enabled: boolean; lastSuccessAt: number | null; lastError: string | null } | null;
  sim: SourceSync;
  whatsapp: SourceSync;
  uploadError: string | null;
}

export type FixAction = "callLog" | "notifications" | "battery" | "appSettings" | "syncNow" | "signIn" | "update";

export interface Issue {
  id: string;
  severity: "error" | "warn";
  title: string;
  steps: string[];
  actions: FixAction[];
  detail?: string;
}

/** No successful upload for this long counts as "stale". */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

const AUTH_RE = /jwt|auth|sign ?in|session|401|key rejected|not authori[sz]ed|forbidden/i;
const NETWORK_RE = /failed to fetch|network|timeout|timed out|unable to resolve|connection|offline/i;

export function classifyError(message: string): "auth" | "network" | "other" {
  if (AUTH_RE.test(message)) return "auth";
  if (NETWORK_RE.test(message)) return "network";
  return "other";
}

/** Latest time each source was successfully synced, from the app (open) or the background job (closed). */
export function lastSynced(source: SourceSync, backgroundSuccessAt: number | null | undefined): number | null {
  const times = [source.at, backgroundSuccessAt ?? null].filter((t): t is number => typeof t === "number");
  return times.length ? Math.max(...times) : null;
}

export function diagnose(input: HealthInput): Issue[] {
  const issues: Issue[] = [];
  const p = input.permissions;

  if (!input.online) {
    issues.push({
      id: "offline",
      severity: "error",
      title: "This phone is offline",
      steps: [
        "Turn on mobile data or connect to Wi-Fi.",
        "Calls stay saved on the phone and upload by themselves once the internet is back.",
      ],
      actions: [],
    });
  }

  if (p && !p.callLog) {
    issues.push({
      id: "call-log",
      severity: "error",
      title: "Call history access is off",
      steps: [
        'Tap "Allow call history" and choose Allow for both questions.',
        'If Android doesn\'t ask, tap "Open app settings" → Permissions → Call logs → Allow, and Phone → Allow.',
        "Come back to WinLog. SIM calls from the last 30 days upload straight away.",
      ],
      actions: ["callLog", "appSettings"],
    });
  }

  if (p && !p.notificationAccess) {
    issues.push({
      id: "notifications",
      severity: "error",
      title: "WhatsApp call capture is off",
      steps: [
        'Tap "Turn on notification access" and switch on WinLog.',
        'If the switch is greyed out or says "Restricted setting": tap "Open app settings", tap ⋮ (top right) → Allow restricted settings, then try again.',
        "WhatsApp calls made while this was off can't be recovered.",
      ],
      actions: ["notifications", "appSettings"],
    });
  }

  if (p && !p.batteryUnrestricted) {
    issues.push({
      id: "battery",
      severity: "warn",
      title: "The phone may close WinLog in the background",
      steps: [
        'Tap "Allow background running" and choose Allow (or Unrestricted).',
        "Xiaomi, Redmi or POCO: Settings → Apps → WinLog → turn on Autostart.",
        "Samsung: Settings → Battery → Background usage limits → remove WinLog from Sleeping apps.",
      ],
      actions: ["battery"],
    });
  }

  if (input.background === null) {
    issues.push({
      id: "old-app",
      severity: "warn",
      title: "This WinLog app is out of date",
      steps: [
        "Download the newest WinLog APK from your company's Releases page.",
        "Open it and tap Update. Your sign-in and calls are kept.",
        "Until then, calls only upload while WinLog is open.",
      ],
      actions: ["update"],
    });
  } else if (!input.background.enabled) {
    issues.push({
      id: "background-off",
      severity: "error",
      title: "Uploading with the app closed is off",
      steps: ["Sign out (top right) and sign in again to turn it back on."],
      actions: ["signIn"],
    });
  }

  const errors = [
    { where: "SIM calls", message: input.sim.error },
    { where: "WhatsApp calls", message: input.whatsapp.error },
    { where: "Upload", message: input.uploadError },
    { where: "Background upload", message: input.background?.lastError ?? null },
  ].filter((e): e is { where: string; message: string } => !!e.message);

  // Permission problems already explain themselves.
  const relevant = errors.filter((e) => !(p && !p.callLog && /permission/i.test(e.message)));
  const kinds = new Set(relevant.map((e) => classifyError(e.message)));
  const detail = relevant.map((e) => `${e.where}: ${e.message}`).join("\n");

  if (kinds.has("auth")) {
    issues.push({
      id: "signed-out",
      severity: "error",
      title: "Your sign-in has expired",
      steps: ["Tap sign out (top right).", "Sign in again with your company account.", 'Come back here and tap "Upload now".'],
      actions: ["signIn"],
      detail,
    });
  } else if (kinds.has("network") && input.online) {
    issues.push({
      id: "unreachable",
      severity: "error",
      title: "WinLog couldn't reach the office",
      steps: [
        "Check the internet works: open any website.",
        'Tap "Upload now" to try again.',
        "If you use a VPN or office Wi-Fi with a login page, switch to mobile data and try again.",
      ],
      actions: ["syncNow"],
      detail,
    });
  } else if (kinds.has("other")) {
    issues.push({
      id: "upload-failed",
      severity: "error",
      title: "The last upload failed",
      steps: [
        'Tap "Upload now" to try again.',
        "If it fails again, close WinLog completely and open it again.",
        "Still failing? Send a screenshot of this page to your manager.",
      ],
      actions: ["syncNow"],
      detail,
    });
  }

  const latest = Math.max(
    lastSynced(input.sim, input.background?.lastSuccessAt) ?? 0,
    lastSynced(input.whatsapp, input.background?.lastSuccessAt) ?? 0,
  );
  const blocking = issues.some((i) => i.severity === "error");
  if (!blocking && (latest === 0 || input.now - latest > STALE_AFTER_MS)) {
    issues.push({
      id: "stale",
      severity: "warn",
      title: latest === 0 ? "Nothing has been uploaded yet" : "No upload for a while",
      steps: [
        'Tap "Upload now".',
        "Keep WinLog allowed to run in the background (see the battery step).",
        "Make sure the phone has internet at least once an hour.",
      ],
      actions: ["syncNow"],
    });
  }

  return issues;
}
