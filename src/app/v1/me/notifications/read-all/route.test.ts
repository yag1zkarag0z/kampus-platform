import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { markAllNotificationsAsRead } from "@/server/notifications/service";

import { POST } from "./route";

vi.mock("@/server/notifications/service", () => ({
  markAllNotificationsAsRead: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedMarkAllNotificationsAsRead = vi.mocked(
  markAllNotificationsAsRead,
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

function createRequest(origin = appOrigin) {
  return new NextRequest(`${appOrigin}/v1/me/notifications/read-all`, {
    method: "POST",
    headers: {
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
  });
}

describe("POST /v1/me/notifications/read-all", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedMarkAllNotificationsAsRead
      .mockReset()
      .mockResolvedValue({ markedCount: 4 });
  });

  it("marks all notifications as read and returns the count", async () => {
    const response = await POST(createRequest());

    expect(mockedMarkAllNotificationsAsRead).toHaveBeenCalledWith(memberId);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: { markedCount: 4 },
    });
  });

  it("rejects a cross-origin request before authorization", async () => {
    const response = await POST(createRequest("https://attacker.example"));

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedMarkAllNotificationsAsRead).not.toHaveBeenCalled();
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
    expect(mockedMarkAllNotificationsAsRead).not.toHaveBeenCalled();
  });
});
