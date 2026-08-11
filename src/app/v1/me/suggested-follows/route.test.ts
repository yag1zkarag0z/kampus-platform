import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { getSuggestedMembers } from "@/server/social/service";

import { GET } from "./route";

vi.mock("@/server/social/service", () => ({
  getSuggestedMembers: vi.fn(),
  SUGGESTION_MAX_LIMIT: 20,
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedGetSuggestedMembers = vi.mocked(getSuggestedMembers);

const suggestions = [
  {
    id: "650e1d64-2b2e-42dd-b9bd-ea268e91588e",
    username: "suggested",
    displayName: "Suggested User",
    avatarUrl: null,
    department: "Yazılım Mühendisliği",
    bio: "Kampüste kod yazıyorum.",
    followerCount: 12,
    mutualCount: 2,
    mutualNames: ["Ece Arslan", "Kaya Öztürk"],
    isNewMember: false,
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

describe("GET /v1/me/suggested-follows", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedGetSuggestedMembers.mockReset().mockResolvedValue(suggestions);
  });

  it("returns suggested members for the caller", async () => {
    const request = new NextRequest(
      `${appOrigin}/v1/me/suggested-follows`,
      { headers: { Cookie: "kampus_session=m1.raw-token" } },
    );

    const response = await GET(request);

    expect(mockedGetSuggestedMembers).toHaveBeenCalledWith(memberId, 8);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: suggestions });
  });

  it("forwards the requested limit", async () => {
    const request = new NextRequest(
      `${appOrigin}/v1/me/suggested-follows?limit=20`,
      { headers: { Cookie: "kampus_session=m1.raw-token" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockedGetSuggestedMembers).toHaveBeenCalledWith(memberId, 20);
  });

  it("rejects a limit above the ceiling", async () => {
    const request = new NextRequest(
      `${appOrigin}/v1/me/suggested-follows?limit=999`,
      { headers: { Cookie: "kampus_session=m1.raw-token" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(mockedGetSuggestedMembers).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric limit", async () => {
    const request = new NextRequest(
      `${appOrigin}/v1/me/suggested-follows?limit=abc`,
      { headers: { Cookie: "kampus_session=m1.raw-token" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(mockedGetSuggestedMembers).not.toHaveBeenCalled();
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
      `${appOrigin}/v1/me/suggested-follows`,
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mockedGetSuggestedMembers).not.toHaveBeenCalled();
  });
});
