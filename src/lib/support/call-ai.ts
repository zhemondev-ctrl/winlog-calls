export function classifyCallAiFailure(status: number | undefined, outcome?: string) {
  if (status === 402 || status === 403)
    return {
      state: "failed" as const,
      pause: true,
      reason:
        status === 402
          ? "AI credits required; administrator action needed"
          : "AI access denied; restore provider access before resuming",
    };
  if (status === 429)
    return {
      state: "pending" as const,
      pause: true,
      reason: "Rate limited; administrator may resume after the provider cooldown",
    };
  return {
    state: "unknown" as const,
    pause: true,
    reason:
      outcome === "unknown"
        ? "AI outcome unknown; review request logs before retrying"
        : "AI generation failed; manual review required before retrying",
  };
}
export function callAiEvidence(call: {
  source: string;
  direction: string;
  duration_seconds: number;
  started_at: string;
  created_at: string;
}) {
  return {
    source: call.source,
    reported_direction: call.direction,
    reported_seconds: call.duration_seconds,
    call_timestamp: call.started_at,
    server_received_at: call.created_at,
    evidence:
      call.source === "sim"
        ? "Server read-back of device CallLog report"
        : "Server read-back of WhatsApp notification inference",
    limitations:
      "No transcript, recording, customer issue, verified answered status, or independently tested device behavior. Metadata cannot summarize spoken content.",
  };
}
