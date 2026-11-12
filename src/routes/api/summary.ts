import { createFileRoute } from "@tanstack/react-router";

import { handleSummary } from "@/lib/summary.server";

// Streaming endpoint for "Summarize call records" (signed-in managers only; checked in the handler).
export const Route = createFileRoute("/api/summary")({
  server: { handlers: { POST: ({ request }) => handleSummary(request) } },
});
