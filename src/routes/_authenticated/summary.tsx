import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCopy, FileSpreadsheet, Square, Upload, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { MessageResponse } from "@/components/ai-elements/message";
import { AppShell } from "@/components/winlog/app-shell";
import { Segmented } from "@/components/winlog/segmented";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay } from "@/lib/calls";
import { meQuery, profilesQuery } from "@/lib/queries";

/** Same limit as the server: about 60k tokens of records. */
const MAX_CHARS = 240_000;

export const Route = createFileRoute("/_authenticated/summary")({
  head: () => ({
    meta: [
      { title: "Summarize call records — WinLog" },
      {
        name: "description",
        content: "Upload, paste or pick team call records and get an AI summary with follow-ups.",
      },
      { property: "og:title", content: "Summarize call records — WinLog" },
      {
        property: "og:description",
        content: "AI summary of team call activity and the calls that need a callback.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: SummaryPage,
});

type Mode = "winlog" | "upload" | "paste";
type Days = "1" | "7" | "30" | "90";

async function readFileAsText(file: File): Promise<string> {
  if (/\.(xlsx|xlsm|xls|ods)$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    return wb.SheetNames.map((name) => {
      const sheet = wb.Sheets[name];
      return sheet ? `### Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet, { blankrows: false })}` : "";
    }).join("\n\n");
  }
  return file.text();
}

function SummaryPage() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: profiles = [] } = useQuery({ ...profilesQuery, enabled: !!me?.isAdmin });
  const [mode, setMode] = useState<Mode>("winlog");
  const [days, setDays] = useState<Days>("7");
  const [person, setPerson] = useState("all");
  const [paste, setPaste] = useState("");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  if (!me?.isAdmin) {
    return (
      <AppShell title="Summarize records" kicker="Managers only">
        <p className="text-muted-foreground">Only managers can summarize team calls.</p>
      </AppShell>
    );
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const text = (await readFileAsText(f)).trim();
      if (!text) return toast.error("That file looks empty.");
      if (text.length > MAX_CHARS)
        return toast.error("That file is too large. Split it into smaller periods and try again.");
      setFile({ name: f.name, text });
    } catch {
      toast.error("Could not read that file. Use CSV, Excel or a text file.");
    }
  }

  function body() {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (mode === "winlog") {
      const from = startOfDay(new Date());
      from.setDate(from.getDate() - (Number(days) - 1));
      return {
        mode,
        userId: person === "all" ? null : person,
        from: from.toISOString(),
        to: new Date().toISOString(),
        timeZone,
      };
    }
    if (mode === "upload") return file ? { mode, text: file.text, fileName: file.name, timeZone } : null;
    const text = paste.trim();
    return text ? { mode, text, fileName: null, timeZone } : null;
  }

  async function run() {
    const payload = body();
    if (!payload) {
      toast.error(mode === "upload" ? "Choose a file first." : "Paste some call records first.");
      return;
    }
    if ("text" in payload && payload.text.length > MAX_CHARS) {
      toast.error("That is too much text. Split it into smaller periods.");
      return;
    }
    setOutput("");
    setError(null);
    setRunning(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "The summary could not be made. Please try again.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const marker = text.indexOf("[[error]]");
        if (marker >= 0) {
          setError(text.slice(marker + 9).trim());
          text = text.slice(0, marker);
        }
        setOutput(text);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setRunning(false);
      abort.current = null;
    }
  }

  return (
    <AppShell title="Summarize records" kicker="AI call summary">
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="winlog">WinLog</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="paste">Paste</TabsTrigger>
            </TabsList>
            <TabsContent value="winlog" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">Calls already uploaded from team phones.</p>
              <Segmented
                value={days}
                onChange={setDays}
                options={[
                  { value: "1", label: "Today" },
                  { value: "7", label: "7 days" },
                  { value: "30", label: "30 days" },
                  { value: "90", label: "90 days" },
                ]}
              />
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger className="h-10 w-full rounded-full bg-background">
                  <SelectValue placeholder="Everyone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>
            <TabsContent value="upload" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">
                A call list exported from a phone, PBX or spreadsheet (CSV, Excel or text).
              </p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-background px-4 py-6 text-center text-sm transition-colors hover:border-gold">
                {file ? <FileSpreadsheet className="size-6" /> : <Upload className="size-6" />}
                <span className="font-medium">{file ? file.name : "Choose a file"}</span>
                <span className="text-xs text-muted-foreground">
                  {file ? `${file.text.split("\n").length} lines read` : ".csv, .xlsx, .xls, .txt"}
                </span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.ods,text/csv,text/plain"
                  className="sr-only"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
              </label>
            </TabsContent>
            <TabsContent value="paste" className="space-y-2 pt-3">
              <Textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={"Paste call records, e.g.\n11 Nov 10:05, Karim Builders, 01711000003, missed, Rahim\n11 Nov 10:40, Nadia, 01811000004, outgoing, 4m 12s, Sumi"}
                className="min-h-48 bg-background font-mono text-xs"
              />
              <p className="text-right text-xs text-muted-foreground">
                {paste.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
              </p>
            </TabsContent>
          </Tabs>
          {running ? (
            <Button variant="outline" className="w-full rounded-full" onClick={() => abort.current?.abort()}>
              <Square /> Stop
            </Button>
          ) : (
            <Button variant="signal" className="w-full" onClick={() => void run()}>
              <Wand2 /> Summarize
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Each summary uses AI credits. Want to ask follow-up questions?{" "}
            <Link to="/assistant" className="underline underline-offset-4">
              Open Ask AI
            </Link>
            .
          </p>
        </section>

        <section className="min-h-64 rounded-2xl border border-border bg-card p-5 shadow-card" aria-live="polite">
          {error && (
            <p className="mb-3 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {output ? (
            <>
              <MessageResponse isAnimating={running}>{output}</MessageResponse>
              {!running && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(output);
                    toast.success("Summary copied");
                  }}
                >
                  <ClipboardCopy /> Copy
                </Button>
              )}
            </>
          ) : running ? (
            <div className="space-y-2" aria-label="Writing summary">
              <div className="h-4 w-1/3 animate-pulse rounded bg-secondary" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-secondary" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
            </div>
          ) : (
            !error && (
              <div className="grid h-full place-items-center py-10 text-center text-sm text-muted-foreground">
                <p>
                  The summary and the calls that need a callback appear here.
                  <br />
                  Choose records on the left, then tap Summarize.
                </p>
              </div>
            )
          )}
        </section>
      </div>
    </AppShell>
  );
}
