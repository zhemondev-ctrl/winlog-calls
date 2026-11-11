// Server-only: shared Lovable AI Gateway setup for WinLog's one-shot AI features.
import { createOpenAI } from "@ai-sdk/openai";

import { createLovableAiGatewayRunIdFetch } from "@/lib/ai-run-id.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const AI_MODEL = "openai/gpt-6-astra";

/** Provider + run-ID fetch created per request (never shared between requests). */
export function createGatewayModel(apiKey: string, runId?: string) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(runId);
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return { model: provider.responses(AI_MODEL), runIdFetch };
}

export const LOW_REASONING = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
} as const;

/** Maps gateway failures to a status + message managers can act on. */
export function describeAiError(error: unknown): { status: number; message: string } {
  const e = error as { statusCode?: number; cause?: { statusCode?: number } } | null;
  const status = e?.statusCode ?? e?.cause?.statusCode ?? 500;
  if (status === 429) return { status, message: "The AI is busy right now. Please try again in a minute." };
  if (status === 402)
    return { status, message: "AI credits have run out for this workspace. Add credits to keep using AI summaries." };
  if (status === 403) return { status, message: "The AI service refused this request." };
  return { status: 500, message: "The AI could not answer. Please try again." };
}
