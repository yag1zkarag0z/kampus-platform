import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { listFollowers } from "@/server/social/service";

import { GET } from "./route";

vi.mock("@/server/social/service", () => ({
  listFollowers: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedListFollowers = vi.mocked(listFollowers);

const followers = [
  {
    id: "650e1d64-2b2e-42dd-b9bd-ea268e91588e",
    username: "another.user",
    displayName: "Another User",
    avatarUrl: null,
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

describe("GET /v1/users/[username]/followers", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedListFollowers.mockReset().mockResolvedValue(followers);
  });

  it("returns the follower list for an active member", async () => {
    const request = new NextRequest(
      `${appOrigin}/v1/users/test.user/followers`,
      { headers: { Cookie: "kampus_session=m1.raw-token" } },
    );

    const response = await GET(request, {
      params: Promise.resolve({ username: "test.user" }),
    });

    expect(mockedListFollowers).toHaveBeenCalledWith("test.user");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: followers });
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );
    const request = new NextRequest(
      `${appOrigin}/v1/users/test.user/followers`,
    );

    const response = await GET(request, {
      params: Promise.resolve({ username: "test.user" }),
    });

    expect(response.status).toBe(401);
    expect(mockedListFollowers).not.toHaveBeenCalled();
  });
});
