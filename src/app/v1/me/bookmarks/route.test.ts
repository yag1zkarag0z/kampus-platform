import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import {
  listContentBookmarks,
  type ContentPostDto,
} from "@/server/content/service";

import { GET } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/content/service", () => ({
  listContentBookmarks: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const postId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedListContentBookmarks = vi.mocked(listContentBookmarks);

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

const bookmarkedPost = {
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
    bookmarked: true,
    selectedPollOptionId: null,
  },
} satisfies ContentPostDto;

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
  return new NextRequest(`${appOrigin}/v1/me/bookmarks${query}`, {
    headers: {
      Cookie: "kampus_session=m1.raw-token",
    },
  });
}

describe("GET /v1/me/bookmarks", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberId,
    });
    mockedListContentBookmarks.mockReset().mockResolvedValue({
      data: [bookmarkedPost],
      page: {
        nextCursor: null,
        hasMore: false,
      },
    });
  });

  it("applies the default page size and returns the service envelope", async () => {
    const response = await GET(createGetRequest());

    expect(mockedListContentBookmarks).toHaveBeenCalledWith(memberId, {
      limit: 20,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: [bookmarkedPost],
      page: {
        nextCursor: null,
        hasMore: false,
      },
    });
  });

  it("forwards the cursor and limit of a follow-up page", async () => {
    mockedListContentBookmarks.mockResolvedValueOnce({
      data: [],
      page: {
        nextCursor: "abc_123",
        hasMore: true,
      },
    });

    const response = await GET(
      createGetRequest("?cursor=abc_123&limit=50"),
    );

    expect(mockedListContentBookmarks).toHaveBeenCalledWith(memberId, {
      cursor: "abc_123",
      limit: 50,
    });
    expect(response.status).toBe(200);
  });

  it.each([
    {
      label: "a duplicate query field",
      query: "?cursor=abc&cursor=def",
    },
    {
      label: "an unknown query field",
      query: "?scope=following",
    },
    {
      label: "a malformed cursor",
      query: "?cursor=not%20a%20cursor",
    },
    {
      label: "a limit above the maximum",
      query: "?limit=51",
    },
  ])("rejects $label", async ({ query }) => {
    const response = await GET(createGetRequest(query));

    expect(response.status).toBe(400);
    expect(mockedListContentBookmarks).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        fieldErrors: expect.any(Object),
      },
    });
  });

  it("requires an active member before reading bookmarks", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await GET(createGetRequest());

    expect(response.status).toBe(401);
    expect(mockedListContentBookmarks).not.toHaveBeenCalled();
  });
});
