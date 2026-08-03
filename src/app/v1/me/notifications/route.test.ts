import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { listNotifications } from "@/server/notifications/service";

import { GET } from "./route";

vi.mock("@/server/notifications/service", () => ({
  listNotifications: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedListNotifications = vi.mocked(listNotifications);

const notifications = [
  {
    id: "650e1d64-2b2e-42dd-b9bd-ea268e91588e",
    kind: "follow" as const,
    actor: {
      id: "7bf0c452-64b0-4fa6-9604-521732e84ac0",
      username: "actor",
      displayName: "Actor",
      avatarUrl: null,
    },
    likeCount: null,
    post: null,
    comment: null,
    isRead: false,
    createdAt: "2026-08-01T10:00:00.000Z",
  },
];

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

function createRequest(query = "") {
  return new NextRequest(`${appOrigin}/v1/me/notifications${query}`, {
    headers: { Cookie: "kampus_session=m1.raw-token" },
  });
}

describe("GET /v1/me/notifications", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedListNotifications.mockReset().mockResolvedValue(notifications);
  });

  it("returns the caller's notifications", async () => {
    const response = await GET(createRequest());

    expect(mockedListNotifications).toHaveBeenCalledWith(
      memberId,
      undefined,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: notifications });
  });

  it("forwards the limit query parameter", async () => {
    await GET(createRequest("?limit=10"));

    expect(mockedListNotifications).toHaveBeenCalledWith(memberId, 10);
  });

  it("rejects an invalid limit", async () => {
    const response = await GET(createRequest("?limit=0"));

    expect(response.status).toBe(400);
    expect(mockedListNotifications).not.toHaveBeenCalled();
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    expect(mockedListNotifications).not.toHaveBeenCalled();
  });
});
