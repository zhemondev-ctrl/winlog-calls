import {
  BellRing,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Sparkle,
  Video,
} from "lucide-react";

import { useCallNotes } from "@/hooks/use-call-notes";
import type { CallNote } from "@/lib/call-notes.functions";

import { DIRECTION_LABEL, formatDuration, isUnanswered, type CallRow } from "@/lib/calls";
import { cn } from "@/lib/utils";

const ICONS = {
  incoming: PhoneIncoming,
  outgoing: PhoneOutgoing,
  missed: PhoneMissed,
  rejected: PhoneOff,
  blocked: PhoneOff,
  unknown: PhoneIncoming,
};

export function CallItem({
  call,
  employee,
  note,
  noteLoading,
  observe,
}: {
  call: CallRow;
  employee?: string | undefined;
  note?: CallNote | undefined;
  noteLoading?: boolean;
  observe?: ((el: HTMLElement | null) => void) | undefined;
}) {
  const Icon = call.is_video ? Video : ICONS[call.direction];
  const unanswered = isUnanswered(call.direction);
  const who = call.contact_name || call.phone_number || "Unknown";
  const time = new Date(call.started_at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <li ref={observe} data-call-id={call.id} className="px-4 py-3">
      <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          call.direction === "incoming" && "bg-incoming/12 text-incoming",
          call.direction === "outgoing" && "bg-outgoing/12 text-outgoing",
          unanswered && "bg-missed/12 text-missed",
          call.direction === "unknown" && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate font-semibold", unanswered && "text-missed")}>{who}</span>
          <span
            className={cn(
              "stamp shrink-0 rounded-full px-1.5 py-0.5 !text-[10px]",
              call.source === "whatsapp" ? "bg-whatsapp/15 text-whatsapp" : "bg-sim/10 text-sim",
            )}
          >
            {call.source === "whatsapp" ? "WhatsApp" : "SIM"}
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {DIRECTION_LABEL[call.direction]}
          {call.contact_name && call.phone_number ? ` · ${call.phone_number}` : ""}
          {call.source === "sim" && call.sim_label ? ` · ${call.sim_label}` : ""}
          {employee ? ` · ${employee}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="num text-sm font-medium">
          {unanswered ? "—" : formatDuration(call.duration_seconds)}
        </div>
        <div className="num text-xs text-muted-foreground">{time}</div>
      </div>
      </div>
      {note ? (
        <p
          className={cn(
            "mt-2 ml-[3.25rem] flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs leading-snug",
            note.followUp ? "bg-accent/25 text-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          {note.followUp ? (
            <BellRing className="mt-px size-3.5 shrink-0" aria-label="Follow up" />
          ) : (
            <Sparkle className="mt-px size-3.5 shrink-0" aria-label="AI note" />
          )}
          <span>{note.note}</span>
        </p>
      ) : noteLoading ? (
        <div className="mt-2 ml-[3.25rem] h-6 w-2/3 animate-pulse rounded-lg bg-secondary" aria-label="Writing AI note" />
      ) : null}
    </li>
  );
}

export function CallList({
  calls,
  names,
  aiNotes = false,
}: {
  calls: CallRow[];
  names?: Map<string, string> | undefined;
  /** Managers: show a short AI note on each card as it scrolls into view. */
  aiNotes?: boolean;
}) {
  const notes = useCallNotes(aiNotes);
  if (calls.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
        No calls here yet.
      </div>
    );
  }
  const groups = new Map<string, CallRow[]>();
  for (const c of calls) {
    const key = new Date(c.started_at).toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  return (
    <div className="space-y-5">
      {aiNotes && notes.error && (
        <p className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          AI notes: {notes.error}
        </p>
      )}
      {[...groups.entries()].map(([day, list]) => (
        <section key={day}>
          <h3 className="stamp mb-2 px-1 text-muted-foreground">{day}</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {list.map((c) => (
              <CallItem
                key={c.id}
                call={c}
                employee={names?.get(c.user_id)}
                note={notes.notes[c.id]}
                noteLoading={notes.loading.has(c.id)}
                observe={notes.observe}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
