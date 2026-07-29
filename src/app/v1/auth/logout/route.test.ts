import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { revokeMemberSession } from "@/server/auth/session";

import { POST } from "./route";

vi.mock("@/server/auth/session", () => ({
  revokeMemberSession: vi.fn(),
}));

const mockedRevokeMemberSession = vi.mocked(revokeMemberSession);

describe("POST /v1/auth/logout", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET =
      "kampus-test-secret-that-is-at-least-32-characters";
    process.env.APP_ORIGIN = "http://localhost:3000";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_USER = "";
    process.env.SMTP_PASSWORD = "";
    process.env.EMAIL_FROM = "KAMPUS Test <no-reply@kampus.local>";
    mockedRevokeMemberSession.mockReset().mockResolvedValue(undefined);
  });

  it("revokes the database session and expires the cookie", async () => {
    const request = new NextRequest(
      "http://localhost:3000/v1/auth/logout",
      {
        method: "POST",
        headers: {
          Cookie: "kampus_session=m1.raw-token",
          Origin: "http://localhost:3000",
        },
      },
    );
    const response = await POST(request);
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(204);
    expect(mockedRevokeMemberSession).toHaveBeenCalledWith(
      "m1.raw-token",
    );
    expect(cookie).toContain("kampus_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
  });

  it("still expires the browser cookie when database revocation fails", async () => {
    mockedRevokeMemberSession.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const request = new NextRequest(
      "http://localhost:3000/v1/auth/logout",
      {
        method: "POST",
        headers: {
          Cookie: "kampus_session=m1.raw-token",
          Origin: "http://localhost:3000",
        },
      },
    );

    const response = await POST(request);
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(204);
    expect(cookie).toContain("kampus_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
