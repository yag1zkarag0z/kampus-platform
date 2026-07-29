import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateAccountSettings } from "@/server/account/service";
import {
  refreshActiveMemberSession,
  requireActiveMember,
} from "@/server/auth/authorization";

import { PATCH } from "./route";

vi.mock("@/server/account/service", () => ({
  updateAccountSettings: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  refreshActiveMemberSession: vi.fn(),
  requireActiveMember: vi.fn(),
}));

const mockedUpdateAccountSettings = vi.mocked(
  updateAccountSettings,
);
const mockedRefreshActiveMemberSession = vi.mocked(
  refreshActiveMemberSession,
);
const mockedRequireActiveMember = vi.mocked(requireActiveMember);

const memberState = {
  mode: "member" as const,
  expiresAt: "2026-08-28T10:00:00.000Z",
  user: {
    id: "721775a4-8f1a-4be5-bdef-0a597c4356ca",
    role: "member" as const,
    profile: {
      username: "test.user",
      displayName: "Test User",
      department: "Yazılım Mühendisliği",
      year: "2. sınıf",
      bio: "",
      joinedLabel: "Temmuz 2026",
    },
    settings: {
      showDepartment: true,
      notifyReplies: false,
      notifyLikes: true,
      notifyAnnouncements: true,
      emailNotifications: true,
    },
  },
};

function createRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/v1/me/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: "kampus_session=m1.raw-token",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

describe("PATCH /v1/me/settings", () => {
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

    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberState.user.id,
    });
    mockedUpdateAccountSettings
      .mockReset()
      .mockResolvedValue(undefined);
    mockedRefreshActiveMemberSession
      .mockReset()
      .mockResolvedValue(memberState);
  });

  it("updates only allowlisted boolean settings", async () => {
    const response = await PATCH(
      createRequest({
        showDepartment: true,
        notifyReplies: false,
      }),
    );

    expect(mockedUpdateAccountSettings).toHaveBeenCalledWith(
      memberState.user.id,
      {
        showDepartment: true,
        notifyReplies: false,
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: memberState,
    });
  });

  it("rejects empty, unknown, and non-boolean settings", async () => {
    const response = await PATCH(
      createRequest({
        showDepartment: "yes",
        role: "admin",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockedUpdateAccountSettings).not.toHaveBeenCalled();
  });
});
