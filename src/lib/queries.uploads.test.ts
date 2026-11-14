import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => {
    const chain = { ...mocks };
    mocks.gte.mockReturnValue(chain); mocks.lt.mockReturnValue(chain);
    mocks.order.mockReturnValue(chain); mocks.eq.mockReturnValue(chain);
    return chain;
  } }) },
}));
import { callsQuery, fetchCalls } from "./queries";

beforeEach(() => { vi.clearAllMocks(); mocks.range.mockResolvedValue({ data: [], error: null }); });
it("counts daily uploads by arrival date even when the call was made earlier", async () => {
  const filter = { from: "2026-11-09T00:00:00Z", to: "2026-11-16T00:00:00Z", dateField: "created_at" as const };
  await fetchCalls(filter);
  expect(mocks.gte).toHaveBeenCalledWith("created_at", "2026-11-09T00:00:00Z");
  expect(mocks.lt).toHaveBeenCalledWith("created_at", "2026-11-16T00:00:00Z");
  expect(callsQuery(filter).queryKey).not.toEqual(callsQuery({ ...filter, dateField: "started_at" }).queryKey);
});