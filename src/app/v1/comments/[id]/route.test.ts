import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import {
  deleteContentComment,
  updateContentComment,
  type ContentCommentDto,
} from "@/server/content/service";

import { DELETE, PATCH } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/content/service", () => ({
  deleteContentComment: vi.fn(),
  updateContentComment: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const postId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const commentId = "7bf0c452-64b0-4fa6-9604-521732e84ac0";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedDeleteContentComment = vi.mocked(deleteContentComment);
const mockedUpdateContentComment = vi.mocked(updateContentComment);

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
      notifyComments: true,
      notifyFollows: true,
      notifyMentions: true,
      emailNotifications: true,
    },
  },
};

const comment = {
  id: commentId,
  postId,
  parentId: null,
  isAnonymous: false,
  isDeleted: false,
  body: "Düzenlenmiş yorum",
  author: {
    id: memberId,
    username: "viewer",
    displayName: "Viewer",
    avatarUrl: null,
  },
  createdAt: "2026-07-29T10:00:00.000Z",
  editedAt: "2026-07-29T10:05:00.000Z",
  likeCount: 0,
  replyCount: 0,
  viewerState: {
    isAuthor: true,
    canEdit: true,
    canDelete: true,
    liked: false,
  },
} satisfies ContentCommentDto;

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
  method: "PATCH" | "DELETE",
  body?: unknown,
  origin = appOrigin,
) {
  return new NextRequest(`${appOrigin}/v1/comments/${commentId}`, {
    method,
    headers: {
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function context() {
  return {
    params: Promise.resolve({ id: commentId }),
  };
}

describe("/v1/comments/[id]", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberId,
    });
    mockedUpdateContentComment.mockReset().mockResolvedValue(comment);
    mockedDeleteContentComment.mockReset().mockResolvedValue({
      id: commentId,
      deletedAt: "2026-07-29T11:00:00.000Z",
    });
  });

  it("updates and returns a normalized comment", async () => {
    const response = await PATCH(
      createRequest("PATCH", {
        body: "  Düzenlenmiş yorum  ",
      }),
      context(),
    );

    expect(mockedUpdateContentComment).toHaveBeenCalledWith(
      memberId,
      commentId,
      { body: "Düzenlenmiş yorum" },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: comment });
  });

  it("rejects invalid update content", async () => {
    const response = await PATCH(
      createRequest("PATCH", {
        body: "https://example.com",
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(mockedUpdateContentComment).not.toHaveBeenCalled();
  });

  it("requires an active member for updates", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await PATCH(
      createRequest("PATCH", { body: "Yorum" }),
      context(),
    );

    expect(response.status).toBe(401);
    expect(mockedUpdateContentComment).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin update before authorization", async () => {
    const response = await PATCH(
      createRequest(
        "PATCH",
        { body: "Yorum" },
        "https://attacker.example",
      ),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedUpdateContentComment).not.toHaveBeenCalled();
  });

  it("soft-deletes a comment with a 204 response", async () => {
    const response = await DELETE(
      createRequest("DELETE"),
      context(),
    );

    expect(mockedDeleteContentComment).toHaveBeenCalledWith(
      memberId,
      commentId,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("");
  });

  it("rejects a cross-origin delete before authorization", async () => {
    const response = await DELETE(
      createRequest(
        "DELETE",
        undefined,
        "https://attacker.example",
      ),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedDeleteContentComment).not.toHaveBeenCalled();
  });

  it("requires an active member for deletes", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await DELETE(
      createRequest("DELETE"),
      context(),
    );

    expect(response.status).toBe(401);
    expect(mockedDeleteContentComment).not.toHaveBeenCalled();
  });

  it("preserves a forbidden delete status from the service", async () => {
    mockedDeleteContentComment.mockRejectedValueOnce(
      new AuthError(
        "CONTENT_FORBIDDEN",
        "Bu içerik üzerinde işlem yapamazsın.",
        { status: 403 },
      ),
    );

    const response = await DELETE(
      createRequest("DELETE"),
      context(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "CONTENT_FORBIDDEN",
      },
    });
  });
});
