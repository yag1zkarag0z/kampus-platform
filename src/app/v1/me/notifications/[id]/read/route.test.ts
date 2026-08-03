import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { markNotificationAsRead } from "@/server/notifications/service";

import { PATCH } from "./route";

vi.mock("@/server/notifications/service", () => ({
  markNotificationAsRead: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const notificationId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedMarkNotificationAsRead = vi.mocked(markNotificationAsRead);

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
  return new NextRequest(
    `${appOrigin}/v1/me/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      headers: {
        Cookie: "kampus_session=m1.raw-token",
        Origin: origin,
      },
    },
  );
}

function context() {
  return { params: Promise.resolve({ id: notificationId }) };
}

describe("PATCH /v1/me/notifications/[id]/read", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedMarkNotificationAsRead.mockReset().mockResolvedValue(undefined);
  });

  it("marks the notification as read", async () => {
    const response = await PATCH(createRequest(), context());

    expect(mockedMarkNotificationAsRead).toHaveBeenCalledWith(
      memberId,
      notificationId,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("propagates a not-found error", async () => {
    mockedMarkNotificationAsRead.mockRejectedValueOnce(
      new AuthError("NOTIFICATION_NOT_FOUND", "Bildirim bulunamadı.", {
        status: 404,
      }),
    );

    const response = await PATCH(createRequest(), context());

    expect(response.status).toBe(404);
  });

  it("rejects a cross-origin request before authorization", async () => {
    const response = await PATCH(
      createRequest("https://attacker.example"),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedMarkNotificationAsRead).not.toHaveBeenCalled();
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await PATCH(createRequest(), context());

    expect(response.status).toBe(401);
    expect(mockedMarkNotificationAsRead).not.toHaveBeenCalled();
  });
});
