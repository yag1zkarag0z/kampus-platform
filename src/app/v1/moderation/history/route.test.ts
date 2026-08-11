import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveModerator } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { getModerationHistory } from "@/server/moderation/service";

import { GET } from "./route";

vi.mock("@/server/moderation/service", () => ({
  getModerationHistory: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveModerator: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const moderatorId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveModerator = vi.mocked(requireActiveModerator);
const mockedGetModerationHistory = vi.mocked(getModerationHistory);

const history = [
  {
    id: "650e1d64-2b2e-42dd-b9bd-ea268e91588e",
    action: "content_removed" as const,
    createdAt: "2026-08-01T10:00:00.000Z",
    reportId: "7bf0c452-64b0-4fa6-9604-521732e84ac0",
    postId: "7bf0c452-64b0-4fa6-9604-521732e84ac0",
    messageId: null,
    note: null,
    actor: { username: "admin.user", displayName: "Admin User" },
    target: null,
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

describe("GET /v1/moderation/history", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveModerator.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: moderatorId,
    });
    mockedGetModerationHistory.mockReset().mockResolvedValue({
      data: history,
      page: { nextCursor: null, hasMore: false },
    });
  });

  it("returns the moderation audit log", async () => {
    const request = new NextRequest(`${appOrigin}/v1/moderation/history`, {
      headers: { Cookie: "kampus_session=m1.raw-token" },
    });

    const response = await GET(request);

    expect(mockedGetModerationHistory).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: history,
      page: { nextCursor: null, hasMore: false },
    });
  });

  it("rejects a non-moderator caller", async () => {
    mockedRequireActiveModerator.mockRejectedValueOnce(
      new AuthError("AUTHORIZATION_REQUIRED", "Bu işlem için yetkin yok.", {
        status: 403,
      }),
    );
    const request = new NextRequest(`${appOrigin}/v1/moderation/history`);

    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(mockedGetModerationHistory).not.toHaveBeenCalled();
  });
});
