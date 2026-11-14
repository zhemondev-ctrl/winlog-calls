import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ page: vi.fn(), select: vi.fn(), gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: (columns: string) => {
    mocks.select(columns);
    const chain = { ...mocks };
    mocks.gte.mockReturnValue(chain); mocks.lt.mockReturnValue(chain);
    mocks.order.mockReturnValue(chain); mocks.eq.mockReturnValue(chain);
    mocks.range.mockImplementation((...args: unknown[]) => {
      const result = mocks.page(...args);
      return { then: result.then.bind(result), eq: mocks.eq };
    });
    return chain;
  } }) },
}));
import { callsQuery, fetchCalls, fetchUploadReceipts, uploadReceiptsQuery } from "./queries";

beforeEach(() => { vi.clearAllMocks(); mocks.page.mockReset(); mocks.page.mockResolvedValue({ data: [], error: null }); });
it("counts daily uploads by arrival date even when the call was made earlier", async () => {
  const filter = { from: "2026-11-09T00:00:00Z", to: "2026-11-16T00:00:00Z", dateField: "created_at" as const };
  await fetchCalls(filter);
  expect(mocks.gte).toHaveBeenCalledWith("created_at", "2026-11-09T00:00:00Z");
  expect(mocks.lt).toHaveBeenCalledWith("created_at", "2026-11-16T00:00:00Z");
  expect(callsQuery(filter).queryKey).not.toEqual(callsQuery({ ...filter, dateField: "started_at" }).queryKey);
});

const windowFilter = { from: "2026-11-09T00:00:00Z", to: "2026-11-16T00:00:00Z" };
it("downloads only arrival time and source for the uploads chart", async () => {
  await fetchUploadReceipts(windowFilter);
  expect(mocks.select).toHaveBeenCalledWith("created_at,source");
  expect(mocks.gte).toHaveBeenCalledWith("created_at", windowFilter.from);
  expect(mocks.lt).toHaveBeenCalledWith("created_at", windowFilter.to);
});
it("keeps the selected staff filter and separate chart cache", async () => {
  await fetchUploadReceipts({ ...windowFilter, userId: "staff-123" });
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "staff-123");
  expect(uploadReceiptsQuery(windowFilter).queryKey).not.toEqual(callsQuery(windowFilter).queryKey);
});
it("continues past a full page without losing receipts", async () => {
  const row = { created_at: "2026-11-10T12:00:00Z", source: "sim" };
  mocks.page.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => row), error: null })
    .mockResolvedValueOnce({ data: [{ ...row, source: "whatsapp" }], error: null });
  expect(await fetchUploadReceipts(windowFilter)).toHaveLength(1001);
  expect(mocks.range).toHaveBeenNthCalledWith(2, 1000, 1999);
});
it("surfaces failures instead of showing false zero uploads", async () => {
  mocks.page.mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } });
  await expect(fetchUploadReceipts(windowFilter)).rejects.toThrow("Unavailable");
});