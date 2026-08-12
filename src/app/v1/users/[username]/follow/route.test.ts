import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  requireActiveMember,
} from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import {
  followUser,
  getFollowSummary,
  unfollowUser,
} from "@/server/social/service";

import { DELETE, POST } from "./route";

vi.mock("@/server/social/service", () => ({
  followUser: vi.fn(),
  getFollowSummary: vi.fn(),
  unfollowUser: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedFollowUser = vi.mocked(followUser);
const mockedUnfollowUser = vi.mocked(unfollowUser);
const mockedGetFollowSummary = vi.mocked(getFollowSummary);

const followSummary = {
  followerCount: 4,
  followingCount: 2,
  isFollowing: true,
  blockedByViewer: false,
};

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

function createFollowRequest(
  method: "POST" | "DELETE",
  origin = appOrigin,
) {
  return new NextRequest(
    `${appOrigin}/v1/users/test.user/follow`,
    {
      method,
      headers: {
        Cookie: "kampus_session=m1.raw-token",
        Origin: origin,
      },
    },
  );
}

function routeContext() {
  return { params: Promise.resolve({ username: "test.user" }) };
}

describe("POST /v1/users/[username]/follow", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    // Yeni bir takip kenarı oluştu: ölçüm olayı yalnızca bu durumda yazılır.
    mockedFollowUser.mockReset().mockResolvedValue(true);
    mockedGetFollowSummary.mockReset().mockResolvedValue(followSummary);
  });

  it("follows the target user and returns the refreshed summary", async () => {
    const response = await POST(
      createFollowRequest("POST"),
      routeContext(),
    );

    expect(mockedFollowUser).toHaveBeenCalledWith(memberId, "test.user");
    expect(mockedGetFollowSummary).toHaveBeenCalledWith(
      memberId,
      "test.user",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: followSummary,
    });
  });

  it("returns the shared error envelope for a self-follow attempt", async () => {
    mockedFollowUser.mockRejectedValueOnce(
      new AuthError("INVALID_REQUEST", "Kendini takip edemezsin.", {
        status: 400,
      }),
    );

    const response = await POST(
      createFollowRequest("POST"),
      routeContext(),
    );

    expect(response.status).toBe(400);
    expect(mockedGetFollowSummary).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin follow before authorization", async () => {
    const response = await POST(
      createFollowRequest("POST", "https://attacker.example"),
      routeContext(),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedFollowUser).not.toHaveBeenCalled();
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await POST(
      createFollowRequest("POST"),
      routeContext(),
    );

    expect(response.status).toBe(401);
    expect(mockedFollowUser).not.toHaveBeenCalled();
  });
});

describe("DELETE /v1/users/[username]/follow", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedUnfollowUser.mockReset().mockResolvedValue(undefined);
    mockedGetFollowSummary.mockReset().mockResolvedValue({
      ...followSummary,
      isFollowing: false,
    });
  });

  it("unfollows the target user and returns the refreshed summary", async () => {
    const response = await DELETE(
      createFollowRequest("DELETE"),
      routeContext(),
    );

    expect(mockedUnfollowUser).toHaveBeenCalledWith(memberId, "test.user");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { ...followSummary, isFollowing: false },
    });
  });

  it("rejects a cross-origin unfollow before authorization", async () => {
    const response = await DELETE(
      createFollowRequest("DELETE", "https://attacker.example"),
      routeContext(),
    );

    expect(response.status).toBe(403);
    expect(mockedUnfollowUser).not.toHaveBeenCalled();
  });
});
