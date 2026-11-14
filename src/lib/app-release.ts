export const REPOSITORY_URL = "https://github.com/zhemondev-ctrl/winlog-calls";
export const LATEST_RELEASE_URL = `${REPOSITORY_URL}/releases/latest`;
export const WORKFLOW_URL = `${REPOSITORY_URL}/actions/workflows/android-apk.yml`;

export interface AndroidBuild {
  number: number;
  status: string;
  conclusion: string | null;
  branch: string;
  commit: string;
  startedAt: string | null;
  finishedAt: string | null;
  url: string;
}

export function buildState(status: string, conclusion: string | null) {
  if (status === "in_progress") return "Building";
  if (status !== "completed") return "Queued";
  if (conclusion === "success") return "Succeeded";
  if (["failure", "timed_out", "startup_failure", "action_required"].includes(conclusion ?? "")) return "Failed";
  if (conclusion === "cancelled") return "Cancelled";
  return "Completed";
}

export function releaseVersion(tag: string): string | null {
  const match = /^build-(\d+)$/.exec(tag);
  return match ? `1.0.${match[1]}` : null;
}