import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "./errors";
import { authErrorResponse } from "./request";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

const mockedHeaders = vi.mocked(headers);

describe("auth error response observability", () => {
  beforeEach(() => {
    mockedHeaders.mockReset();
  });

  it("returns the same request id in the header and safe error envelope", async () => {
    const requestId = crypto.randomUUID();

    mockedHeaders.mockResolvedValue(
      new Headers({ "X-Request-ID": requestId }) as Awaited<
        ReturnType<typeof headers>
      >,
    );

    const response = await authErrorResponse(
      new AuthError("INVALID_REQUEST", "Geçersiz istek."),
    );

    expect(response.headers.get("x-request-id")).toBe(requestId);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        requestId,
      },
    });
  });

  it("creates a fallback id outside a Next request context", async () => {
    mockedHeaders.mockRejectedValue(new Error("No request context"));

    const response = await authErrorResponse(new Error("Database failed"));
    const requestId = response.headers.get("x-request-id");

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "AUTH_CONFIGURATION_ERROR",
        requestId,
      },
    });
  });
});
