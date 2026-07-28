import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkDatabaseHealth } from "@/server/db/health";

import { GET } from "./route";

vi.mock("@/server/db/health", () => ({
  checkDatabaseHealth: vi.fn(),
}));

const mockedCheckDatabaseHealth = vi.mocked(checkDatabaseHealth);

describe("GET /v1/health", () => {
  beforeEach(() => {
    mockedCheckDatabaseHealth.mockReset();
  });

  it("returns 200 when PostgreSQL is reachable", async () => {
    mockedCheckDatabaseHealth.mockResolvedValue("up");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      checks: { database: "up" },
    });
  });

  it("returns a safe 503 response when PostgreSQL is unavailable", async () => {
    mockedCheckDatabaseHealth.mockResolvedValue("down");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "degraded",
      checks: { database: "down" },
    });
  });
});
