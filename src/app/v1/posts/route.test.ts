import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import {
  createContentPost,
  listContentPosts,
  type ContentPostDetailDto,
} from "@/server/content/service";

import { GET, POST } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/content/service", () => ({
  createContentPost: vi.fn(),
  listContentPosts: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const postId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedCreateContentPost = vi.mocked(createContentPost);
const mockedListContentPosts = vi.mocked(listContentPosts);

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
  category: "chat",
  isAnonymous: false,
  title: "",
  body: "Kütüphanede çalışan var mı?",
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

function createGetRequest(query = "") {
  return new NextRequest(`${appOrigin}/v1/posts${query}`, {
    headers: {
      Cookie: "kampus_session=m1.raw-token",
    },
  });
}

function createPostRequest(
  body: unknown,
  origin = appOrigin,
) {
  return new NextRequest(`${appOrigin}/v1/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

describe("GET /v1/posts", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberId,
    });
    mockedListContentPosts.mockReset().mockResolvedValue({
      data: [post],
      page: {
        nextCursor: null,
        hasMore: false,
      },
    });
  });

  it("applies the default feed query and returns the service envelope", async () => {
    const response = await GET(createGetRequest());

    expect(mockedListContentPosts).toHaveBeenCalledWith(memberId, {
      sort: "newest",
      limit: 20,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: [post],
      page: {
        nextCursor: null,
        hasMore: false,
      },
    });
  });

  it("normalizes and forwards the allowlisted feed query", async () => {
    await GET(
      createGetRequest(
        "?category=lost_found&sort=newest&author=Campus.User&cursor=abc_123&limit=50",
      ),
    );

    expect(mockedListContentPosts).toHaveBeenCalledWith(memberId, {
      category: "lost_found",
      sort: "newest",
      author: "campus.user",
      cursor: "abc_123",
      limit: 50,
    });
  });

  it.each([
    {
      label: "a duplicate query field",
      query: "?category=chat&category=question",
    },
    {
      label: "an unknown query field",
      query: "?unknown=value",
    },
  ])("rejects $label", async ({ query }) => {
    const response = await GET(createGetRequest(query));

    expect(response.status).toBe(400);
    expect(mockedListContentPosts).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        fieldErrors: expect.any(Object),
      },
    });
  });

  it("forwards the popular feed sort", async () => {
    const response = await GET(createGetRequest("?sort=popular"));

    expect(mockedListContentPosts).toHaveBeenCalledWith(memberId, {
      sort: "popular",
      limit: 20,
    });
    expect(response.status).toBe(200);
  });

  it("requires an active member before reading the feed", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await GET(createGetRequest());

    expect(response.status).toBe(401);
    expect(mockedListContentPosts).not.toHaveBeenCalled();
  });
});

describe("POST /v1/posts", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberId,
    });
    mockedCreateContentPost.mockReset().mockResolvedValue(post);
  });

  it("creates a normalized post with a Location header", async () => {
    const response = await POST(
      createPostRequest({
        category: "chat",
        title: "  ",
        body: "  Kütüphanede çalışan var mı?  ",
        isAnonymous: false,
      }),
    );

    expect(mockedCreateContentPost).toHaveBeenCalledWith(memberId, {
      category: "chat",
      title: "",
      body: "Kütüphanede çalışan var mı?",
      isAnonymous: false,
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(
      `/v1/posts/${postId}`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: post });
  });

  it.each([
    {
      body: {
        category: "chat",
        body: "Geçerli içerik",
        role: "admin",
      },
      label: "an unknown field",
    },
    {
      body: {
        category: "chat",
        body: "example.com",
      },
      label: "a URL",
    },
  ])("rejects $label before calling the service", async ({ body }) => {
    const response = await POST(createPostRequest(body));

    expect(response.status).toBe(400);
    expect(mockedCreateContentPost).not.toHaveBeenCalled();
  });

  it("passes valid listing details to the service", async () => {
    const listing = {
      type: "sale" as const,
      condition: "lightly_used" as const,
      price: 180,
    };
    mockedCreateContentPost.mockResolvedValueOnce({
      ...post,
      category: "listing",
      listing,
    });

    const response = await POST(
      createPostRequest({
        category: "listing",
        title: "Tasarım kitabı",
        body: "Temiz durumda.",
        isAnonymous: false,
        listing,
      }),
    );

    expect(response.status).toBe(201);
    expect(mockedCreateContentPost).toHaveBeenCalledWith(memberId, {
      category: "listing",
      title: "Tasarım kitabı",
      body: "Temiz durumda.",
      isAnonymous: false,
      listing,
    });
  });

  it("passes valid poll options to the service", async () => {
    const pollPost = {
      ...post,
      category: "poll" as const,
      poll: {
        id: post.id,
        totalVotes: 0,
        options: [],
      },
    };
    mockedCreateContentPost.mockResolvedValueOnce(pollPost);

    const response = await POST(
      createPostRequest({
        category: "poll",
        title: "Seç",
        pollOptions: ["Bir", "İki"],
      }),
    );

    expect(response.status).toBe(201);
    expect(mockedCreateContentPost).toHaveBeenCalledWith(memberId, {
      category: "poll",
      title: "Seç",
      body: "",
      isAnonymous: false,
      pollOptions: ["Bir", "İki"],
    });
  });

  it("rejects a cross-origin request before authorization", async () => {
    const response = await POST(
      createPostRequest(
        {
          category: "chat",
          body: "İçerik",
        },
        "https://attacker.example",
      ),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedCreateContentPost).not.toHaveBeenCalled();
  });
});
