import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { getCallNotes, type CallNote } from "@/lib/call-notes.functions";

const BATCH = 20;

/**
 * Loads AI notes for the call cards that scroll into view, in small batches, one request at a time.
 * Stops asking after a credits/permission problem so it never keeps spending.
 */
export function useCallNotes(enabled: boolean) {
  const fetchNotes = useServerFn(getCallNotes);
  const [notes, setNotes] = useState<Record<string, CallNote>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const running = useRef(false);
  const paused = useRef(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const timer = useRef<number | null>(null);

  const pump = useCallback(async () => {
    if (running.current || paused.current) return;
    running.current = true;
    try {
      while (queue.current.length && !paused.current) {
        const ids = queue.current.splice(0, BATCH);
        setLoading((s) => new Set([...s, ...ids]));
        try {
          const res = await fetchNotes({
            data: { callIds: ids, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          });
          setNotes((n) => ({ ...n, ...res.notes }));
          setError(res.error);
          if ("paused" in res && res.paused) paused.current = true;
          if (res.error) {
            // Let unanswered cards be retried on a later visit instead of looping now.
            for (const id of ids) if (!res.notes[id]) requested.current.delete(id);
            break;
          }
        } catch {
          for (const id of ids) requested.current.delete(id);
          setError("AI notes could not load.");
          break;
        } finally {
          setLoading((s) => {
            const next = new Set(s);
            for (const id of ids) next.delete(id);
            return next;
          });
        }
      }
    } finally {
      running.current = false;
    }
  }, [fetchNotes]);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset["callId"];
          if (!e.isIntersecting || !id || requested.current.has(id)) continue;
          requested.current.add(id);
          queue.current.push(id);
        }
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void pump(), 400);
      },
      { rootMargin: "200px 0px" },
    );
    return () => {
      observer.current?.disconnect();
      observer.current = null;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [enabled, pump]);

  /** Ref callback for each call card. */
  const observe = useCallback((el: HTMLElement | null) => {
    if (el && observer.current) observer.current.observe(el);
  }, []);

  return { notes, loading, error, observe: enabled ? observe : undefined };
}
