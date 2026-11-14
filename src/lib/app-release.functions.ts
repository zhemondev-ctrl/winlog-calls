import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AndroidBuild } from "./app-release";

interface WorkflowRun {
  run_number: number; status: string; conclusion: string | null;
  head_branch: string; head_sha: string; run_started_at: string | null;
  updated_at: string; html_url: string;
}
interface Release {
  name: string; tag_name: string; published_at: string; html_url: string;
  assets: { name: string; browser_download_url: string }[];
}

export const getAndroidRelease = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env['GITHUB_API_KEY'];
    const lovableKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey || !lovableKey) throw new Error("GitHub connection is unavailable.");
    const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": apiKey,
      Accept: "application/vnd.github+json" };
    async function read<T>(path: string): Promise<{ data: T | null; error: string | null; status: number }> {
      try {
        const response = await fetch(`https://connector-gateway.lovable.dev/github/repos/zhemondev-ctrl/winlog-calls/${path}`, {
          headers, signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          const body = await response.text();
          console.error(`GitHub read failed [${response.status}]: ${body}`);
          return { data: null, error: `GitHub returned ${response.status}. Open GitHub to check repository access.`, status: response.status };
        }
        return { data: await response.json() as T, error: null, status: response.status };
      } catch {
        return { data: null, error: "GitHub could not be reached. Try again shortly.", status: 0 };
      }
    }
    const [runs, latest] = await Promise.all([
      read<{ workflow_runs: WorkflowRun[] }>("actions/workflows/android-apk.yml/runs?per_page=1"),
      read<Release>("releases/latest"),
    ]);
    const run = runs.data?.workflow_runs[0];
    const build: AndroidBuild | null = run ? {
      number: run.run_number, status: run.status, conclusion: run.conclusion,
      branch: run.head_branch, commit: run.head_sha.slice(0, 7), startedAt: run.run_started_at,
      finishedAt: run.status === "completed" ? run.updated_at : null, url: run.html_url,
    } : null;
    const asset = latest.data?.assets.find((a) => a.name === "WinLog.apk");
    return {
      build, buildError: runs.error,
      release: latest.data ? { name: latest.data.name, tag: latest.data.tag_name,
        publishedAt: latest.data.published_at, url: latest.data.html_url, downloadUrl: asset?.browser_download_url ?? null } : null,
      releaseError: latest.status === 404 ? "No stable APK release is available yet." : latest.error,
      checkedAt: new Date().toISOString(),
    };
  });