import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicAccountProfile } from "@/server/account/service";
import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { getFollowSummary } from "@/server/social/service";

import { GET } from "./route";

vi.mock("@/server/account/service", () => ({
  getPublicAccountProfile: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/social/service", () => ({
  getFollowSummary: vi.fn(),
}));

const mockedGetPublicAccountProfile = vi.mocked(
  getPublicAccountProfile,
);
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedGetFollowSummary = vi.mocked(getFollowSummary);

const followSummary = {
  followerCount: 3,
  followingCount: 5,
  isFollowing: false,
  blockedByViewer: false,
};

const publicProfile = {
  id: "650e1d64-2b2e-42dd-b9bd-ea268e91588e",
  username: "test.user",
  displayName: "Test User",
  bio: "Kısa bio",
  role: "member" as const,
  avatarUrl: null,
  joinedLabel: "Temmuz 2026",
  department: null,
  year: null,
};

const memberState = {
  mode: "member" as const,
  expiresAt: "2026-08-28T10:00:00.000Z",
  user: {
    id: "0ebc5296-4cc7-494f-91a9-ae1b195b5109",
    role: "member" as const,
    profile: {
      username: "viewer",
      displayName: "Viewer",
      department: "Yazılım Mühendisliği",
      year: "2. sınıf",
      bio: "",
      avatarUrl: null,
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

function createRequest(cookie = "kampus_session=m1.raw-token") {
  return new NextRequest(
    "http://localhost:3000/v1/users/test.user",
    {
      headers: {
        Cookie: cookie,
      },
    },
  );
}

describe("GET /v1/users/[username]", () => {
  beforeEach(() => {
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberState.user.id,
    });
    mockedGetPublicAccountProfile
      .mockReset()
      .mockResolvedValue(publicProfile);
    mockedGetFollowSummary.mockReset().mockResolvedValue(followSummary);
  });

  it("returns the public profile merged with the follow summary to an active member without requiring an Origin header", async () => {
    const request = createRequest();
    const response = await GET(
      request,
      { params: Promise.resolve({ username: "test.user" }) },
    );

    expect(mockedRequireActiveMember).toHaveBeenCalledWith(request);
    expect(mockedGetPublicAccountProfile).toHaveBeenCalledWith(
      "test.user",
    );
    expect(mockedGetFollowSummary).toHaveBeenCalledWith(
      memberState.user.id,
      "test.user",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: { ...publicProfile, ...followSummary },
    });
  });

  it("returns the shared error envelope when the profile is missing", async () => {
    mockedGetPublicAccountProfile.mockRejectedValueOnce(
      new AuthError(
        "USER_NOT_FOUND",
        "Profil bulunamadı.",
        { status: 404 },
      ),
    );

    const response = await GET(
      createRequest(),
      { params: Promise.resolve({ username: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "USER_NOT_FOUND",
        message: "Profil bulunamadı.",
        fieldErrors: {},
        requestId: expect.any(String),
      },
    });
  });

  it.each([
    { cookie: "", label: "signed-out" },
    { cookie: "kampus_session=g1.signed-token", label: "guest" },
  ])(
    "rejects a $label viewer before reading a real member profile",
    async ({ cookie }) => {
      mockedRequireActiveMember.mockRejectedValueOnce(
        new AuthError(
          "AUTHENTICATION_REQUIRED",
          "Devam etmek için öğrenci hesabınla giriş yapmalısın.",
          { status: 401 },
        ),
      );

      const response = await GET(createRequest(cookie), {
        params: Promise.resolve({ username: "test.user" }),
      });

      expect(response.status).toBe(401);
      expect(mockedGetPublicAccountProfile).not.toHaveBeenCalled();
    },
  );
});
