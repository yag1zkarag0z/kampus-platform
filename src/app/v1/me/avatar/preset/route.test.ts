import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setAccountAvatarPreset } from "@/server/account/service";
import {
  refreshActiveMemberSession,
  requireActiveMember,
} from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";

import { POST } from "./route";

vi.mock("@/server/account/service", () => ({
  setAccountAvatarPreset: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  refreshActiveMemberSession: vi.fn(),
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedRefreshActiveMemberSession = vi.mocked(
  refreshActiveMemberSession,
);
const mockedSetAccountAvatarPreset = vi.mocked(setAccountAvatarPreset);

const memberState = {
  mode: "member" as const,
  expiresAt: "2026-08-28T10:00:00.000Z",
  user: {
    id: memberId,
    role: "member" as const,
    profile: {
      username: "kampuslu35",
      displayName: "Kampüslü",
      department: "Yazılım Mühendisliği",
      year: "2. sınıf",
      bio: "",
      avatarUrl: "/v1/users/kampuslu35/avatar",
      joinedLabel: "Temmuz 2026",
    },
    settings: {
      showDepartment: false,
      notifyReplies: true,
      notifyLikes: true,
      notifyAnnouncements: true,
      notifyComments: true,
      notifyFollows: true,
      notifyMentions: true,
      emailNotifications: true,
    },
  },
};

function createRequest(
  body: unknown,
  origin = appOrigin,
) {
  return new NextRequest(`${appOrigin}/v1/me/avatar/preset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/me/avatar/preset", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET =
      "kampus-test-secret-that-is-at-least-32-characters";
    process.env.APP_ORIGIN = appOrigin;
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_USER = "";
    process.env.SMTP_PASSWORD = "";
    process.env.EMAIL_FROM = "KAMPUS Test <no-reply@kampus.local>";
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberId,
    });
    mockedSetAccountAvatarPreset.mockReset().mockResolvedValue(undefined);
    mockedRefreshActiveMemberSession
      .mockReset()
      .mockResolvedValue(memberState);
  });

  it("stores a valid preset and returns the refreshed session", async () => {
    const response = await POST(createRequest({ presetId: "deniz" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockedSetAccountAvatarPreset).toHaveBeenCalledWith(
      memberId,
      "deniz",
    );
    expect(mockedRefreshActiveMemberSession).toHaveBeenCalledWith(
      "m1.raw-token",
    );
    await expect(response.json()).resolves.toEqual({ data: memberState });
  });

  it("rejects an unknown preset before storage", async () => {
    const response = await POST(
      createRequest({ presetId: "external-avatar" }),
    );

    expect(response.status).toBe(400);
    expect(mockedSetAccountAvatarPreset).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests before authorization", async () => {
    const response = await POST(
      createRequest({ presetId: "deniz" }, "https://attacker.example"),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedSetAccountAvatarPreset).not.toHaveBeenCalled();
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await POST(createRequest({ presetId: "deniz" }));

    expect(response.status).toBe(401);
    expect(mockedSetAccountAvatarPreset).not.toHaveBeenCalled();
  });
});
