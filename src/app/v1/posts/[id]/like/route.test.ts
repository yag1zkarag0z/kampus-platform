import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { setContentPostLike } from "@/server/content/service";

import { DELETE, PUT } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/content/service", () => ({
  setContentPostLike: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const postId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedSetContentPostLike = vi.mocked(setContentPostLike);
const post = {
  id: postId,
  category: "chat" as const,
  isAnonymous: false,
  title: "Test",
  body: "",
  author: {
    id: memberId,
    username: "viewer",
    displayName: "Viewer",
    avatarUrl: null,
  },
  createdAt: "2026-08-01T10:00:00.000Z",
  editedAt: null,
  likeCount: 1,
  commentCount: 0,
  viewerState: {
    isAuthor: true,
    canEdit: true,
    canDelete: true,
    liked: true,
    bookmarked: false,
    hidden: false,
    selectedPollOptionId: null,
  },
};

function request(method: "PUT" | "DELETE", origin = appOrigin) {
  return new NextRequest(`${appOrigin}/v1/posts/${postId}/like`, {
    method,
    headers: {
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
  });
}

function context() {
  return { params: Promise.resolve({ id: postId }) };
}

describe("/v1/posts/[id]/like", () => {
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
      state: {} as never,
      userId: memberId,
    });
    mockedSetContentPostLike.mockReset().mockResolvedValue(post);
  });

  it("idempotently likes a post", async () => {
    const response = await PUT(request("PUT"), context());

    expect(mockedSetContentPostLike).toHaveBeenCalledWith(
      memberId,
      postId,
      true,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: post });
  });

  it("idempotently removes a like", async () => {
    const response = await DELETE(request("DELETE"), context());

    expect(mockedSetContentPostLike).toHaveBeenCalledWith(
      memberId,
      postId,
      false,
    );
    expect(response.status).toBe(200);
  });

  it("rejects a cross-origin mutation", async () => {
    const response = await PUT(
      request("PUT", "https://example.com"),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mockedSetContentPostLike).not.toHaveBeenCalled();
  });
});
