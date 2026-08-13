import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCursorList } from "./useCursorList";

describe("useCursorList", () => {
  it("keeps loaded rows and reports an error when loading more fails", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: "first" }],
        page: { hasMore: true, nextCursor: "next-page" },
      })
      .mockRejectedValueOnce(new Error("temporary failure"));
    const { result } = renderHook(() => useCursorList(fetchPage));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([{ id: "first" }]);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items).toEqual([{ id: "first" }]);
    expect(result.current.hasFailed).toBe(true);
    expect(result.current.isLoadingMore).toBe(false);
  });
});
