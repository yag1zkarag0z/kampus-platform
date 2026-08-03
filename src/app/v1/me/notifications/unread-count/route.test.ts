import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { getUnreadNotificationCount } from "@/server/notifications/service";

import { GET } from "./route";

vi.mock("@/server/notifications/service", () => ({
  getUnreadNotificationCount: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedGetUnreadNotificationCount = vi.mocked(
  getUnreadNotificationCount,
);

function configureEnvironment() {
  process.env.AUTH_SECRET =
    "kampus-test-secret-that-is-at-least-32-characters";
  process.env.APP_ORIGIN = appOrigin;
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = "1025";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASSWORD = "";
  process.env.EMAIL_FROM = "KAMPUS Test <no-reply@kampus.local>";
}

describe("GET /v1/me/notifications/unread-count", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedGetUnreadNotificationCount.mockReset().mockResolvedValue(3);
  });

  it("returns the caller's unread notification count", async () => {
    const request = new NextRequest(
      `${appOrigin}/v1/me/notifications/unread-count`,
      { headers: { Cookie: "kampus_session=m1.raw-token" } },
    );

    const response = await GET(request);

    expect(mockedGetUnreadNotificationCount).toHaveBeenCalledWith(memberId);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: { count: 3 } });
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );
    const request = new NextRequest(
      `${appOrigin}/v1/me/notifications/unread-count`,
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mockedGetUnreadNotificationCount).not.toHaveBeenCalled();
  });
});
