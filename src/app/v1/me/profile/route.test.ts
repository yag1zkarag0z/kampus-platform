import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  refreshActiveMemberSession,
  requireActiveMember,
} from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { deleteAccount, updateAccountProfile } from "@/server/account/service";

import { DELETE, PATCH } from "./route";

vi.mock("@/server/account/service", () => ({
  deleteAccount: vi.fn(),
  updateAccountProfile: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  refreshActiveMemberSession: vi.fn(),
  requireActiveMember: vi.fn(),
}));

const mockedUpdateAccountProfile = vi.mocked(
  updateAccountProfile,
);
const mockedDeleteAccount = vi.mocked(deleteAccount);
const mockedRefreshActiveMemberSession = vi.mocked(
  refreshActiveMemberSession,
);
const mockedRequireActiveMember = vi.mocked(requireActiveMember);

const memberState = {
  mode: "member" as const,
  expiresAt: "2026-08-28T10:00:00.000Z",
  user: {
    id: "f0a33fcf-d835-4391-9822-af57b23355cf",
    role: "member" as const,
    profile: {
      username: "new.name",
      displayName: "Yeni İsim",
      department: "Yazılım Mühendisliği",
      year: "3. sınıf",
      bio: "Yeni bio",
      avatarUrl: null,
      joinedLabel: "Temmuz 2026",
    },
    settings: {
      showDepartment: false,
      notifyReplies: true,
      notifyLikes: true,
      notifyAnnouncements: true,
      emailNotifications: true,
    },
  },
};

function createRequest(
  body: unknown,
  origin = "http://localhost:3000",
) {
  return new NextRequest("http://localhost:3000/v1/me/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/v1/me/profile", {
    method: "DELETE",
    headers: {
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
  });
}

describe("PATCH /v1/me/profile", () => {
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
    mockedUpdateAccountProfile
      .mockReset()
      .mockResolvedValue(undefined);
    mockedDeleteAccount.mockReset().mockResolvedValue(undefined);
    mockedRefreshActiveMemberSession
      .mockReset()
      .mockResolvedValue(memberState);
  });

  it("normalizes the allowlisted fields and returns a fresh session", async () => {
    const response = await PATCH(
      createRequest({
        username: "  New.Name ",
        displayName: "  Yeni İsim ",
        year: " 3. sınıf ",
      }),
    );

    expect(mockedUpdateAccountProfile).toHaveBeenCalledWith(
      memberState.user.id,
      {
        username: "new.name",
        displayName: "Yeni İsim",
        year: "3. sınıf",
      },
    );
    expect(mockedRefreshActiveMemberSession).toHaveBeenCalledWith(
      "m1.raw-token",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: memberState,
    });
  });

  it("rejects an empty or sensitive-field update", async () => {
    const response = await PATCH(
      createRequest({ role: "admin" }),
    );

    expect(response.status).toBe(400);
    expect(mockedUpdateAccountProfile).not.toHaveBeenCalled();
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await PATCH(
      createRequest({ displayName: "Yeni İsim" }),
    );

    expect(response.status).toBe(401);
    expect(mockedUpdateAccountProfile).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin update before authorization", async () => {
    const response = await PATCH(
      createRequest(
        { displayName: "Yeni İsim" },
        "https://attacker.example",
      ),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedUpdateAccountProfile).not.toHaveBeenCalled();
  });
});

describe("DELETE /v1/me/profile", () => {
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
    mockedDeleteAccount.mockReset().mockResolvedValue(undefined);
  });

  it("deletes the account and clears the session cookie", async () => {
    const response = await DELETE(createDeleteRequest());

    expect(mockedDeleteAccount).toHaveBeenCalledWith(
      memberState.user.id,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const clearedCookie = response.cookies.get("kampus_session");
    expect(clearedCookie?.value).toBe("");
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await DELETE(createDeleteRequest());

    expect(response.status).toBe(401);
    expect(mockedDeleteAccount).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin delete before authorization", async () => {
    const response = await DELETE(
      createDeleteRequest("https://attacker.example"),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedDeleteAccount).not.toHaveBeenCalled();
  });
});
