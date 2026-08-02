import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import {
  deleteContentPost,
  getContentPost,
  updateContentPost,
  type ContentPostDetailDto,
} from "@/server/content/service";

import { DELETE, GET, PATCH } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/content/service", () => ({
  deleteContentPost: vi.fn(),
  getContentPost: vi.fn(),
  updateContentPost: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const postId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedDeleteContentPost = vi.mocked(deleteContentPost);
const mockedGetContentPost = vi.mocked(getContentPost);
const mockedUpdateContentPost = vi.mocked(updateContentPost);

const memberState = {
  mode: "member" as const,
  expiresAt: "2026-08-28T10:00:00.000Z",
  user: {
    id: memberId,
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
      emailNotifications: true,
    },
  },
};

const post = {
  id: postId,
  category: "question",
  isAnonymous: false,
  title: "Ders notu",
  body: "Notlarını paylaşabilecek var mı?",
  author: {
    id: memberId,
    username: "viewer",
    displayName: "Viewer",
    avatarUrl: null,
  },
  createdAt: "2026-07-29T10:00:00.000Z",
  editedAt: null,
  likeCount: 0,
  commentCount: 0,
  viewerState: {
    isAuthor: true,
    canEdit: true,
    canDelete: true,
    liked: false,
    bookmarked: false,
    selectedPollOptionId: null,
  },
  comments: [],
} satisfies ContentPostDetailDto;

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

function createRequest(
  method: "GET" | "PATCH" | "DELETE",
  body?: unknown,
  origin = appOrigin,
) {
  return new NextRequest(`${appOrigin}/v1/posts/${postId}`, {
    method,
    headers: {
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      Cookie: "kampus_session=m1.raw-token",
      ...(method === "GET" ? {} : { Origin: origin }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function context(id = postId) {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("/v1/posts/[id]", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberId,
    });
    mockedGetContentPost.mockReset().mockResolvedValue(post);
    mockedUpdateContentPost.mockReset().mockResolvedValue(post);
    mockedDeleteContentPost.mockReset().mockResolvedValue({
      id: postId,
      deletedAt: "2026-07-29T11:00:00.000Z",
    });
  });

  it("awaits the dynamic params and returns post detail", async () => {
    let resolveParams:
      | ((value: { id: string }) => void)
      | undefined;
    const params = new Promise<{ id: string }>((resolve) => {
      resolveParams = resolve;
    });
    const pendingResponse = GET(createRequest("GET"), { params });

    await vi.waitFor(() =>
      expect(mockedRequireActiveMember).toHaveBeenCalled(),
    );
    expect(mockedGetContentPost).not.toHaveBeenCalled();

    resolveParams?.({ id: postId });
    const response = await pendingResponse;

    expect(mockedGetContentPost).toHaveBeenCalledWith(
      memberId,
      postId,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: post });
  });

  it("returns the service not-found status", async () => {
    mockedGetContentPost.mockRejectedValueOnce(
      new AuthError(
        "POST_NOT_FOUND",
        "Gönderi bulunamadı.",
        { status: 404 },
      ),
    );

    const response = await GET(createRequest("GET"), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "POST_NOT_FOUND",
      },
    });
  });

  it("normalizes a partial update and returns the updated post", async () => {
    const response = await PATCH(
      createRequest("PATCH", {
        title: "  Güncel başlık  ",
      }),
      context(),
    );

    expect(mockedUpdateContentPost).toHaveBeenCalledWith(
      memberId,
      postId,
      { title: "Güncel başlık" },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: post });
  });

  it("preserves a forbidden update status from the service", async () => {
    mockedUpdateContentPost.mockRejectedValueOnce(
      new AuthError(
        "CONTENT_FORBIDDEN",
        "Bu içerik üzerinde işlem yapamazsın.",
        { status: 403 },
      ),
    );

    const response = await PATCH(
      createRequest("PATCH", { body: "Yeni metin" }),
      context(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "CONTENT_FORBIDDEN",
      },
    });
  });

  it("rejects an invalid update before resolving params", async () => {
    const response = await PATCH(
      createRequest("PATCH", {
        body: "https://example.com",
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(mockedUpdateContentPost).not.toHaveBeenCalled();
  });

  it("soft-deletes a post with a 204 response", async () => {
    const response = await DELETE(
      createRequest("DELETE"),
      context(),
    );

    expect(mockedDeleteContentPost).toHaveBeenCalledWith(
      memberId,
      postId,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("");
  });

  it("returns the delete service status", async () => {
    mockedDeleteContentPost.mockRejectedValueOnce(
      new AuthError(
        "POST_NOT_FOUND",
        "Gönderi bulunamadı.",
        { status: 404 },
      ),
    );

    const response = await DELETE(
      createRequest("DELETE"),
      context(),
    );

    expect(response.status).toBe(404);
  });
});
