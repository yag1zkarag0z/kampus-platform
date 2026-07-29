import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSessionCookie } from "@/server/auth/session";

import { GET } from "./route";

vi.mock("@/server/auth/session", () => ({
  resolveSessionCookie: vi.fn(),
}));

const mockedResolveSessionCookie = vi.mocked(resolveSessionCookie);

describe("GET /v1/session", () => {
  beforeEach(() => {
    mockedResolveSessionCookie.mockReset();
  });

  it("returns a no-store signed-out state and clears an invalid cookie", async () => {
    mockedResolveSessionCookie.mockResolvedValue({
      shouldClearCookie: true,
      state: {
        mode: "signed-out",
        expiresAt: null,
        user: null,
      },
    });
    const request = new NextRequest(
      "http://localhost:3000/v1/session",
      {
        headers: {
          Cookie: "kampus_session=invalid",
        },
      },
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    await expect(response.json()).resolves.toEqual({
      data: {
        mode: "signed-out",
        expiresAt: null,
        user: null,
      },
    });
  });
});
