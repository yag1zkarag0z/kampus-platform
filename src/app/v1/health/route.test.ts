import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkDatabaseHealth } from "@/server/db/health";
import { checkRuntimeConfiguration } from "@/server/runtime-configuration";

import { GET } from "./route";

vi.mock("@/server/db/health", () => ({
  checkDatabaseHealth: vi.fn(),
}));
vi.mock("@/server/runtime-configuration", () => ({
  checkRuntimeConfiguration: vi.fn(),
}));

const mockedCheckDatabaseHealth = vi.mocked(checkDatabaseHealth);
const mockedCheckRuntimeConfiguration = vi.mocked(
  checkRuntimeConfiguration,
);

describe("GET /v1/health", () => {
  beforeEach(() => {
    mockedCheckDatabaseHealth.mockReset();
    mockedCheckRuntimeConfiguration.mockReset().mockReturnValue("up");
  });

  it("returns 200 when PostgreSQL is reachable", async () => {
    mockedCheckDatabaseHealth.mockResolvedValue("up");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      checks: { configuration: "up", database: "up" },
    });
  });

  it("returns a safe 503 response when PostgreSQL is unavailable", async () => {
    mockedCheckDatabaseHealth.mockResolvedValue("down");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "degraded",
      checks: { configuration: "up", database: "down" },
    });
  });

  it("returns 503 when the runtime configuration is unsafe", async () => {
    mockedCheckDatabaseHealth.mockResolvedValue("up");
    mockedCheckRuntimeConfiguration.mockReturnValue("down");

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "degraded",
      checks: { configuration: "down", database: "up" },
    });
  });
});
