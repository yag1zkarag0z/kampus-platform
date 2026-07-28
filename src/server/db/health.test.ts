import { describe, expect, it, vi } from "vitest";

import { checkDatabaseHealth } from "./health";

describe("checkDatabaseHealth", () => {
  it("reports an available database", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ health: 1 }] });

    await expect(checkDatabaseHealth({ query })).resolves.toBe("up");
    expect(query).toHaveBeenCalledOnce();
  });

  it("reports a failed database without exposing the error", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection secret"));

    await expect(checkDatabaseHealth({ query })).resolves.toBe("down");
  });

  it("times out an unresponsive database", async () => {
    const query = vi.fn(
      () => new Promise<never>(() => undefined),
    );

    await expect(
      checkDatabaseHealth({ query, timeoutMs: 1 }),
    ).resolves.toBe("down");
  });
});
