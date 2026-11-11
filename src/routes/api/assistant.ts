import { createFileRoute } from "@tanstack/react-router";

import { handleAssistant } from "@/lib/assistant.server";

// Streaming endpoint for the manager AI assistant (signed-in managers only; checked in the handler).
export const Route = createFileRoute("/api/assistant")({
  server: { handlers: { POST: ({ request }) => handleAssistant(request) } },
});
