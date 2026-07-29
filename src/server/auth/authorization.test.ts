import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSessionCookie } from "@/server/auth/session";

import {
  refreshActiveMemberSession,
  requireActiveMember,
} from "./authorization";

vi.mock("@/server/auth/session", () => ({
  resolveSessionCookie: vi.fn(),
}));

const mockedResolveSessionCookie = vi.mocked(resolveSessionCookie);

const memberState = {
  mode: "member" as const,
  expiresAt: "2026-08-28T10:00:00.000Z",
  user: {
    id: "b6b76690-d968-44db-ad71-33d27d423fd7",
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
      showDepartment: false,
      notifyReplies: true,
      notifyLikes: true,
      notifyAnnouncements: true,
      emailNotifications: true,
    },
  },
};

describe("member request authorization", () => {
  beforeEach(() => {
    mockedResolveSessionCookie.mockReset();
  });

  it("reads and resolves the HttpOnly member cookie", async () => {
    mockedResolveSessionCookie.mockResolvedValue({
      shouldClearCookie: false,
      state: memberState,
    });
    const request = new NextRequest(
      "http://localhost:3000/v1/me/profile",
      {
        headers: {
          Cookie: "kampus_session=m1.raw-token",
        },
      },
    );

    await expect(requireActiveMember(request)).resolves.toEqual({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberState.user.id,
    });
    expect(mockedResolveSessionCookie).toHaveBeenCalledWith(
      "m1.raw-token",
    );
  });

  it("rejects guest and signed-out sessions with a 401", async () => {
    mockedResolveSessionCookie.mockResolvedValue({
      shouldClearCookie: false,
      state: {
        mode: "guest",
        expiresAt: "2026-07-28T12:00:00.000Z",
        user: null,
      },
    });
    const request = new NextRequest(
      "http://localhost:3000/v1/me/settings",
      {
        headers: {
          Cookie: "kampus_session=g1.signed-token",
        },
      },
    );

    await expect(requireActiveMember(request)).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
      status: 401,
    });
  });

  it("rejects a request without a session cookie before resolution", async () => {
    const request = new NextRequest(
      "http://localhost:3000/v1/me/profile",
    );

    await expect(requireActiveMember(request)).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
      status: 401,
    });
    expect(mockedResolveSessionCookie).not.toHaveBeenCalled();
  });

  it("revalidates the member session after a mutation", async () => {
    mockedResolveSessionCookie.mockResolvedValue({
      shouldClearCookie: false,
      state: memberState,
    });

    await expect(
      refreshActiveMemberSession("m1.raw-token"),
    ).resolves.toEqual(memberState);
  });
});
