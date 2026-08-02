import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import {
  createContentComment,
  type ContentCommentDto,
} from "@/server/content/service";

import { POST } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/content/service", () => ({
  createContentComment: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const postId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const commentId = "7bf0c452-64b0-4fa6-9604-521732e84ac0";
const parentId = "69d1eaf2-2bd9-4f99-82fb-a4480ea782db";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedCreateContentComment = vi.mocked(createContentComment);

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

const comment = {
  id: commentId,
  postId,
  parentId,
  isAnonymous: false,
  isDeleted: false,
  body: "Katılıyorum.",
  author: {
    id: memberId,
    username: "viewer",
    displayName: "Viewer",
    avatarUrl: null,
  },
  createdAt: "2026-07-29T10:00:00.000Z",
  editedAt: null,
  viewerState: {
    isAuthor: true,
    canEdit: true,
    canDelete: true,
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
  body: unknown,
  origin = appOrigin,
) {
  return new NextRequest(
    `${appOrigin}/v1/posts/${postId}/comments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "kampus_session=m1.raw-token",
        Origin: origin,
      },
      body: JSON.stringify(body),
    },
  );
}

function context() {
  return {
    params: Promise.resolve({ id: postId }),
  };
}

describe("POST /v1/posts/[id]/comments", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberId,
    });
    mockedCreateContentComment
      .mockReset()
      .mockResolvedValue(comment);
  });

  it("creates a normalized comment with a Location header", async () => {
    const response = await POST(
      createRequest({
        body: "  Katılıyorum.  ",
        isAnonymous: false,
        parentId,
      }),
      context(),
    );

    expect(mockedCreateContentComment).toHaveBeenCalledWith(
      memberId,
      postId,
      {
        body: "Katılıyorum.",
        isAnonymous: false,
        parentId,
      },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(
      `/v1/comments/${commentId}`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: comment });
  });

  it.each([
    { body: " ", label: "a blank body" },
    { body: "example.com", label: "a URL" },
  ])("rejects $label", async ({ body }) => {
    const response = await POST(
      createRequest({ body, isAnonymous: false }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(mockedCreateContentComment).not.toHaveBeenCalled();
  });

  it("rejects an invalid parent identifier", async () => {
    const response = await POST(
      createRequest({
        body: "Yanıt",
        parentId: "not-a-uuid",
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(mockedCreateContentComment).not.toHaveBeenCalled();
  });

  it("rejects unknown fields", async () => {
    const response = await POST(
      createRequest({
        body: "Yorum",
        role: "admin",
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(mockedCreateContentComment).not.toHaveBeenCalled();
  });

  it("requires an active member", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await POST(
      createRequest({ body: "Yorum" }),
      context(),
    );

    expect(response.status).toBe(401);
    expect(mockedCreateContentComment).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request before authorization", async () => {
    const response = await POST(
      createRequest(
        { body: "Yorum" },
        "https://attacker.example",
      ),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedCreateContentComment).not.toHaveBeenCalled();
  });
});
