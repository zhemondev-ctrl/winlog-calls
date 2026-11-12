import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  updateResult: vi.fn(),
  manager: true,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/winlog/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/queries", () => ({ meQuery: {}, profilesQuery: { queryKey: ["profiles"] } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: () => ({ in: mocks.updateResult }) }) },
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useSuspenseQuery: () => ({ data: { isAdmin: mocks.manager, userId: "manager" } }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "follow-ups" ? [
      { call_id: "a", user_id: "staff", phone_number: "01711000000", contact_name: "Contact", direction: "missed", started_at: "2026-11-12T02:00:00Z", note: "Callback" },
      { call_id: "b", user_id: "staff", phone_number: "01711000000", contact_name: "Contact", direction: "missed", started_at: "2026-11-11T02:00:00Z", note: "Callback" },
    ] : [],
    isLoading: false,
  }),
}));

import { Route } from "./follow-ups";
const Page = Route.options.component as ComponentType;

function openQueue() {
  render(<QueryClientProvider client={new QueryClient()}><Page /></QueryClientProvider>);
}

describe("follow-up resolution analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager = true;
    window.__lovableEvents = { track: mocks.track };
  });
  afterEach(() => { cleanup(); delete window.__lovableEvents; });

  it("emits one success event with the grouped call count and no personal data", async () => {
    mocks.updateResult.mockResolvedValue({ error: null });
    openQueue();
    expect(mocks.track).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Mark resolved/ }));
    await waitFor(() => expect(mocks.track).toHaveBeenCalledExactlyOnceWith(
      "project.follow_up_resolved", { flagged_call_count: 2 },
    ));
  });

  it("does not count a failed resolution", async () => {
    mocks.updateResult.mockResolvedValue({ error: new Error("Upload failed") });
    openQueue();
    fireEvent.click(screen.getByRole("button", { name: /Mark resolved/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Mark resolved/ })).not.toBeDisabled());
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("does not expose resolution to staff", () => {
    mocks.manager = false;
    openQueue();
    expect(screen.queryByRole("button", { name: /Mark resolved/ })).toBeNull();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("still resolves when the analytics runtime is absent", async () => {
    delete window.__lovableEvents;
    mocks.updateResult.mockResolvedValue({ error: null });
    openQueue();
    fireEvent.click(screen.getByRole("button", { name: /Mark resolved/ }));
    await waitFor(() => expect(mocks.updateResult).toHaveBeenCalledWith("call_id", ["a", "b"]));
  });
});