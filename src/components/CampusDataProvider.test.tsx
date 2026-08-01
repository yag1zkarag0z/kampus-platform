import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthClientError } from "@/auth/client";
import {
  CampusDataProvider,
  useCampusData,
} from "@/components/CampusDataProvider";
import type {
  ContentAuthorDto,
  ContentCommentDto,
  ContentPostDetailDto,
  ContentPostDto,
  ContentViewerStateDto,
} from "@/content/types";
import {
  guestCampusPosts,
  LOCAL_ACCOUNT_OWNER_ID,
} from "@/data/campusPosts";

const contentClientMocks = vi.hoisted(() => ({
  listContentPosts: vi.fn(),
  getContentPost: vi.fn(),
  createContentPost: vi.fn(),
  updateContentPost: vi.fn(),
  deleteContentPost: vi.fn(),
  setContentPostLike: vi.fn(),
  setContentPostBookmark: vi.fn(),
  voteInContentPoll: vi.fn(),
  createContentComment: vi.fn(),
  updateContentComment: vi.fn(),
  deleteContentComment: vi.fn(),
}));

const dataState = vi.hoisted(() => ({
  blockedAuthorIds: new Set<string>(),
  managedUsers: [] as Array<{
    authorId: string;
    status: "active" | "suspended";
  }>,
  account: {
    accountId: "member-account-id" as string | null,
    profile: {
      username: "yagizkaragoz",
      department: "Yazilim Muhendisligi",
      year: "2. sinif",
    },
    settings: {
      showDepartment: true,
    },
    isGuest: false,
    sessionMode: "member" as "member" | "guest" | "signed-out",
    role: "member" as "member" | "moderator" | "admin",
    retrySession: vi.fn(async () => undefined),
  },
}));

vi.mock("@/content/client", () => ({
  listContentPosts: contentClientMocks.listContentPosts,
  getContentPost: contentClientMocks.getContentPost,
  createContentPost: contentClientMocks.createContentPost,
  updateContentPost: contentClientMocks.updateContentPost,
  deleteContentPost: contentClientMocks.deleteContentPost,
  setContentPostLike: contentClientMocks.setContentPostLike,
  setContentPostBookmark: contentClientMocks.setContentPostBookmark,
  voteInContentPoll: contentClientMocks.voteInContentPoll,
  createContentComment: contentClientMocks.createContentComment,
  updateContentComment: contentClientMocks.updateContentComment,
  deleteContentComment: contentClientMocks.deleteContentComment,
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => dataState.account,
}));

vi.mock("@/components/CampusModerationProvider", () => ({
  useCampusModeration: () => ({
    blockedAuthorIds: dataState.blockedAuthorIds,
    managedUsers: dataState.managedUsers,
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <CampusDataProvider>{children}</CampusDataProvider>
);

const CREATED_AT = "2026-07-29T09:00:00.000Z";

type PostDtoOverrides = Partial<
  Omit<ContentPostDto, "author" | "viewerState">
> & {
  author?: Partial<ContentAuthorDto>;
  viewerState?: Partial<ContentViewerStateDto>;
};

type CommentDtoOverrides = Partial<
  Omit<ContentCommentDto, "author" | "viewerState">
> & {
  author?: Partial<ContentAuthorDto>;
  viewerState?: Partial<ContentCommentDto["viewerState"]>;
};

function makePostDto(
  overrides: PostDtoOverrides = {},
): ContentPostDto {
  const author: ContentAuthorDto = {
    id: "author-1",
    username: "author_one",
    displayName: "Author One",
    avatarUrl: null,
  };
  const viewerState: ContentViewerStateDto = {
    isAuthor: false,
    canEdit: false,
    canDelete: false,
    liked: false,
    bookmarked: false,
    selectedPollOptionId: null,
  };

  return {
    id: "server-post-1",
    category: "chat",
    isAnonymous: false,
    title: "Server post",
    body: "Loaded from the content API.",
    createdAt: CREATED_AT,
    editedAt: null,
    likeCount: 3,
    commentCount: 0,
    ...overrides,
    author: {
      ...author,
      ...overrides.author,
    },
    viewerState: {
      ...viewerState,
      ...overrides.viewerState,
    },
  };
}

function makeCommentDto(
  overrides: CommentDtoOverrides = {},
): ContentCommentDto {
  const author: ContentAuthorDto = {
    id: "comment-author-1",
    username: "comment_author",
    displayName: "Comment Author",
    avatarUrl: null,
  };
  const viewerState: ContentCommentDto["viewerState"] = {
    isAuthor: false,
    canEdit: false,
    canDelete: false,
  };

  return {
    id: "server-comment-1",
    postId: "server-post-1",
    parentId: null,
    isAnonymous: false,
    isDeleted: false,
    body: "Server comment",
    createdAt: CREATED_AT,
    editedAt: null,
    ...overrides,
    author: {
      ...author,
      ...overrides.author,
    },
    viewerState: {
      ...viewerState,
      ...overrides.viewerState,
    },
  };
}

function makePostDetailDto(
  overrides: PostDtoOverrides & {
    comments?: ContentCommentDto[];
  } = {},
): ContentPostDetailDto {
  const { comments = [], ...postOverrides } = overrides;

  return {
    ...makePostDto(postOverrides),
    comments,
  };
}

function makePostListDto(
  data: ContentPostDto[] = [makePostDto()],
  page: {
    nextCursor: string | null;
    hasMore: boolean;
  } = {
    nextCursor: null,
    hasMore: false,
  },
) {
  return {
    data,
    page,
  };
}

function makeUnauthorizedError() {
  return new AuthClientError(401, {
    code: "UNAUTHORIZED",
    message: "Authentication is required.",
    fieldErrors: {},
  });
}

describe("CampusDataProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    dataState.blockedAuthorIds.clear();
    dataState.managedUsers.length = 0;
    Object.assign(dataState.account, {
      accountId: "member-account-id",
      isGuest: false,
      sessionMode: "member",
      role: "member",
    });
    dataState.account.retrySession.mockReset();
    dataState.account.retrySession.mockResolvedValue(undefined);

    contentClientMocks.listContentPosts.mockReset();
    contentClientMocks.getContentPost.mockReset();
    contentClientMocks.createContentPost.mockReset();
    contentClientMocks.updateContentPost.mockReset();
    contentClientMocks.deleteContentPost.mockReset();
    contentClientMocks.setContentPostLike.mockReset();
    contentClientMocks.setContentPostBookmark.mockReset();
    contentClientMocks.voteInContentPoll.mockReset();
    contentClientMocks.createContentComment.mockReset();
    contentClientMocks.updateContentComment.mockReset();
    contentClientMocks.deleteContentComment.mockReset();
    contentClientMocks.listContentPosts.mockResolvedValue(
      makePostListDto(),
    );
    contentClientMocks.setContentPostLike.mockImplementation(
      async (postId: string, liked: boolean) =>
        makePostDto({
          id: postId,
          likeCount: liked ? 4 : 3,
          viewerState: { liked },
        }),
    );
    contentClientMocks.setContentPostBookmark.mockImplementation(
      async (postId: string, bookmarked: boolean) =>
        makePostDto({
          id: postId,
          viewerState: { bookmarked },
        }),
    );
  });

  it("hydrates member posts from the API and applies moderation visibility", async () => {
    dataState.blockedAuthorIds.add("blocked-author");
    dataState.managedUsers.push({
      authorId: "suspended-author",
      status: "suspended",
    });
    contentClientMocks.listContentPosts.mockResolvedValue(makePostListDto([
      makePostDto({
        id: "visible-post",
        commentCount: 7,
        author: {
          id: "visible-author",
          username: "visible",
        },
      }),
      makePostDto({
        id: "blocked-post",
        author: {
          id: "blocked-author",
          username: "blocked",
        },
      }),
      makePostDto({
        id: "suspended-post",
        author: {
          id: "suspended-author",
          username: "suspended",
        },
      }),
    ]));

    const { result } = renderHook(() => useCampusData(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(contentClientMocks.listContentPosts).toHaveBeenCalledTimes(1);
    expect(result.current.posts.map((post) => post.id)).toEqual([
      "visible-post",
    ]);
    expect(result.current.posts[0]).toMatchObject({
      author: "@visible",
      commentCount: 7,
      comments: [],
    });
  });

  it("loads the next cursor page and appends only new post IDs", async () => {
    contentClientMocks.listContentPosts
      .mockReset()
      .mockResolvedValueOnce(
        makePostListDto(
          [
            makePostDto({
              id: "first-page-post",
            }),
          ],
          {
            nextCursor: "cursor-page-2",
            hasMore: true,
          },
        ),
      )
      .mockResolvedValueOnce(
        makePostListDto([
          makePostDto({
            id: "first-page-post",
            title: "Duplicate copy",
          }),
          makePostDto({
            id: "second-page-post",
          }),
        ]),
      );

    const { result } = renderHook(() => useCampusData(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(contentClientMocks.listContentPosts).toHaveBeenNthCalledWith(
      2,
      {
        cursor: "cursor-page-2",
      },
    );
    expect(result.current.posts.map((post) => post.id)).toEqual([
      "first-page-post",
      "second-page-post",
    ]);
    expect(result.current.posts[0].title).toBe("Server post");
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it("maps anonymous API ownership only from viewerState", async () => {
    contentClientMocks.listContentPosts.mockResolvedValue(makePostListDto([
      makePostDto({
        id: "anonymous-other",
        isAnonymous: true,
        author: {
          id: "leaked-other-id",
          username: "hidden_other",
        },
        viewerState: {
          isAuthor: false,
          canEdit: false,
          canDelete: false,
        },
      }),
      makePostDto({
        id: "anonymous-owner",
        isAnonymous: true,
        author: {
          id: null,
          username: null,
          displayName: "Anonim",
        },
        viewerState: {
          isAuthor: true,
          canEdit: true,
          canDelete: true,
        },
      }),
    ]));
    contentClientMocks.getContentPost.mockResolvedValue(
      makePostDetailDto({
        id: "anonymous-owner",
        isAnonymous: true,
        author: {
          id: null,
          username: null,
          displayName: "Anonim",
        },
        viewerState: {
          isAuthor: true,
          canEdit: true,
          canDelete: true,
        },
        commentCount: 2,
        comments: [
          makeCommentDto({
            id: "anonymous-comment-other",
            postId: "anonymous-owner",
            isAnonymous: true,
            author: {
              id: "leaked-comment-author",
              username: "hidden_commenter",
            },
            viewerState: {
              isAuthor: false,
              canEdit: false,
              canDelete: false,
            },
          }),
          makeCommentDto({
            id: "anonymous-comment-owner",
            postId: "anonymous-owner",
            isAnonymous: true,
            author: {
              id: null,
              username: null,
              displayName: "Anonim",
            },
            viewerState: {
              isAuthor: true,
              canEdit: true,
              canDelete: true,
            },
          }),
        ],
      }),
    );

    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(
      result.current.posts.find((post) => post.id === "anonymous-other"),
    ).toMatchObject({
      author: "Anonim",
      isAnonymous: true,
    });
    expect(
      result.current.posts.find((post) => post.id === "anonymous-other")
        ?.authorId,
    ).toBeUndefined();
    expect(
      result.current.posts.find((post) => post.id === "anonymous-owner")
        ?.authorId,
    ).toBe(LOCAL_ACCOUNT_OWNER_ID);

    let loaded = false;
    await act(async () => {
      loaded = await result.current.loadPostDetail("anonymous-owner");
    });

    expect(loaded).toBe(true);
    expect(contentClientMocks.getContentPost).toHaveBeenCalledWith(
      "anonymous-owner",
    );
    const loadedComments = result.current.posts.find(
      (post) => post.id === "anonymous-owner",
    )?.comments;
    expect(
      loadedComments?.find(
        (comment) => comment.id === "anonymous-comment-other",
      )?.authorId,
    ).toBeUndefined();
    expect(
      loadedComments?.find(
        (comment) => comment.id === "anonymous-comment-owner",
      )?.authorId,
    ).toBe(LOCAL_ACCOUNT_OWNER_ID);
  });

  it("creates, updates and soft-deletes an owned post through the API", async () => {
    contentClientMocks.listContentPosts.mockResolvedValue(
      makePostListDto([]),
    );
    contentClientMocks.createContentPost.mockResolvedValue(
      makePostDetailDto({
        id: "created-post",
        category: "question",
        title: "New title",
        body: "New body",
        author: {
          id: "member-account-id",
          username: "yagizkaragoz",
        },
        viewerState: {
          isAuthor: true,
          canEdit: true,
          canDelete: true,
        },
      }),
    );
    contentClientMocks.updateContentPost.mockResolvedValue(
      makePostDetailDto({
        id: "created-post",
        category: "question",
        title: "Edited title",
        body: "Edited body",
        editedAt: "2026-07-29T10:00:00.000Z",
        author: {
          id: "member-account-id",
          username: "yagizkaragoz",
        },
        viewerState: {
          isAuthor: true,
          canEdit: true,
          canDelete: true,
        },
      }),
    );
    contentClientMocks.deleteContentPost.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    let postId = "";
    await act(async () => {
      postId = await result.current.createPost({
        title: "  New title ",
        body: "  New body ",
        category: "Soru",
        isAnonymous: false,
      });
    });

    expect(postId).toBe("created-post");
    expect(contentClientMocks.createContentPost).toHaveBeenCalledWith({
      category: "question",
      title: "New title",
      body: "New body",
      isAnonymous: false,
    });
    expect(
      result.current.posts.find((post) => post.id === postId),
    ).toMatchObject({
      title: "New title",
      body: "New body",
      category: "Soru",
      authorId: LOCAL_ACCOUNT_OWNER_ID,
    });

    let updated = false;
    await act(async () => {
      updated = await result.current.updatePost(postId, {
        title: "  Edited title ",
        body: " Edited body  ",
      });
    });

    expect(updated).toBe(true);
    expect(contentClientMocks.updateContentPost).toHaveBeenCalledWith(
      postId,
      {
        title: "Edited title",
        body: "Edited body",
      },
    );
    expect(
      result.current.posts.find((post) => post.id === postId),
    ).toMatchObject({
      title: "Edited title",
      body: "Edited body",
      edited: true,
    });

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deletePost(postId);
    });

    expect(deleted).toBe(true);
    expect(contentClientMocks.deleteContentPost).toHaveBeenCalledWith(
      postId,
    );
    expect(
      result.current.posts.find((post) => post.id === postId),
    ).toMatchObject({
      title: "",
      body: "",
      isDeleted: true,
    });
  });

  it("loads a post detail and replaces its comment summary", async () => {
    contentClientMocks.listContentPosts.mockResolvedValue(makePostListDto([
      makePostDto({
        id: "detail-post",
        commentCount: 1,
      }),
    ]));
    contentClientMocks.getContentPost.mockResolvedValue(
      makePostDetailDto({
        id: "detail-post",
        commentCount: 1,
        comments: [
          makeCommentDto({
            id: "detail-comment",
            postId: "detail-post",
            body: "Hydrated detail comment",
          }),
        ],
      }),
    );

    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.posts[0].comments).toEqual([]);

    let loaded = false;
    await act(async () => {
      loaded = await result.current.loadPostDetail("detail-post");
    });

    expect(loaded).toBe(true);
    expect(result.current.posts[0].comments).toHaveLength(1);
    expect(result.current.posts[0].comments[0]).toMatchObject({
      id: "detail-comment",
      body: "Hydrated detail comment",
    });
    expect(result.current.posts[0].commentCount).toBe(1);
  });

  it("creates, updates and deletes an owned comment through the API", async () => {
    contentClientMocks.listContentPosts.mockResolvedValue(makePostListDto([
      makePostDto({
        id: "comment-post",
        commentCount: 0,
      }),
    ]));
    contentClientMocks.createContentComment.mockResolvedValue(
      makeCommentDto({
        id: "created-comment",
        postId: "comment-post",
        body: "New comment",
        author: {
          id: "member-account-id",
          username: "yagizkaragoz",
        },
        viewerState: {
          isAuthor: true,
          canEdit: true,
          canDelete: true,
        },
      }),
    );
    contentClientMocks.updateContentComment.mockResolvedValue(
      makeCommentDto({
        id: "created-comment",
        postId: "comment-post",
        body: "Edited comment",
        editedAt: "2026-07-29T10:00:00.000Z",
        author: {
          id: "member-account-id",
          username: "yagizkaragoz",
        },
        viewerState: {
          isAuthor: true,
          canEdit: true,
          canDelete: true,
        },
      }),
    );
    contentClientMocks.deleteContentComment.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    await act(async () => {
      await result.current.addComment("comment-post", {
        body: "  New comment ",
        isAnonymous: false,
      });
    });

    expect(contentClientMocks.createContentComment).toHaveBeenCalledWith(
      "comment-post",
      {
        body: "New comment",
        isAnonymous: false,
        parentId: undefined,
      },
    );
    expect(result.current.posts[0].comments[0]).toMatchObject({
      id: "created-comment",
      body: "New comment",
      authorId: LOCAL_ACCOUNT_OWNER_ID,
    });
    expect(result.current.posts[0].commentCount).toBe(1);

    let updated = false;
    await act(async () => {
      updated = await result.current.updateComment(
        "comment-post",
        "created-comment",
        "  Edited comment ",
      );
    });

    expect(updated).toBe(true);
    expect(contentClientMocks.updateContentComment).toHaveBeenCalledWith(
      "created-comment",
      "Edited comment",
    );
    expect(result.current.posts[0].comments[0]).toMatchObject({
      body: "Edited comment",
      edited: true,
    });

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteComment(
        "comment-post",
        "created-comment",
      );
    });

    expect(deleted).toBe(true);
    expect(contentClientMocks.deleteContentComment).toHaveBeenCalledWith(
      "created-comment",
    );
    expect(result.current.posts[0].comments[0]).toMatchObject({
      body: "",
      isDeleted: true,
    });
    expect(result.current.posts[0].commentCount).toBe(0);
  });

  it("retries the member session after a 401 feed response", async () => {
    contentClientMocks.listContentPosts.mockRejectedValue(
      makeUnauthorizedError(),
    );

    const { result } = renderHook(() => useCampusData(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await waitFor(() =>
      expect(dataState.account.retrySession).toHaveBeenCalledTimes(1),
    );
    expect(result.current.posts).toEqual([]);
  });

  it("retries the member session after a 401 detail response", async () => {
    contentClientMocks.getContentPost.mockRejectedValue(
      makeUnauthorizedError(),
    );
    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    let loaded = true;
    await act(async () => {
      loaded = await result.current.loadPostDetail("server-post-1");
    });

    expect(loaded).toBe(false);
    expect(dataState.account.retrySession).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid post content before calling the API", async () => {
    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    await expect(
      result.current.createPost({
        body: "   ",
        category: "Sohbet",
        isAnonymous: false,
      }),
    ).rejects.toThrow("Post content is invalid.");

    await expect(
      result.current.createPost({
        body: "Poll",
        category: "Anket",
        isAnonymous: false,
        pollOptions: ["First", ""],
      }),
    ).rejects.toThrow("Poll content is invalid.");
    expect(contentClientMocks.createContentPost).not.toHaveBeenCalled();
  });

  it("creates a poll through the content API", async () => {
    const poll = {
      id: "server-poll-1",
      totalVotes: 0,
      options: [
        { id: "option-1", text: "First", voteCount: 0 },
        { id: "option-2", text: "Second", voteCount: 0 },
      ],
    };
    contentClientMocks.createContentPost.mockResolvedValue(
      makePostDetailDto({
        id: poll.id,
        category: "poll",
        title: "Choose",
        body: "Poll",
        poll,
      }),
    );
    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    await expect(
      result.current.createPost({
        title: "Choose",
        body: "Poll",
        category: "Anket",
        isAnonymous: false,
        pollOptions: [" First ", " Second "],
      }),
    ).resolves.toBe(poll.id);

    expect(contentClientMocks.createContentPost).toHaveBeenCalledWith({
      category: "poll",
      title: "Choose",
      body: "Poll",
      isAnonymous: false,
      pollOptions: ["First", "Second"],
    });
    await waitFor(() =>
      expect(result.current.posts[0].poll?.options).toEqual([
        { id: "option-1", text: "First", votes: 0 },
        { id: "option-2", text: "Second", votes: 0 },
      ]),
    );
  });

  it("optimistically persists likes and bookmarks for members", async () => {
    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    const initialPost = result.current.posts[0];

    act(() => {
      result.current.toggleLike(initialPost.id);
      result.current.toggleBookmark(initialPost.id);
    });

    expect(result.current.posts[0]).toMatchObject({
      liked: true,
      likes: initialPost.likes + 1,
      bookmarked: true,
    });

    await waitFor(() => {
      expect(contentClientMocks.setContentPostLike).toHaveBeenCalledWith(
        initialPost.id,
        true,
      );
      expect(
        contentClientMocks.setContentPostBookmark,
      ).toHaveBeenCalledWith(initialPost.id, true);
    });
  });

  it("uses the static 20-post guest feed without requesting member content", async () => {
    Object.assign(dataState.account, {
      accountId: null,
      isGuest: true,
      sessionMode: "guest",
    });

    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(guestCampusPosts).toHaveLength(20);
    expect(result.current.posts).toHaveLength(20);
    expect(result.current.hasMore).toBe(false);
    expect(contentClientMocks.listContentPosts).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.loadMore();
    });
    expect(contentClientMocks.listContentPosts).not.toHaveBeenCalled();

    await expect(
      result.current.createPost({
        body: "Cannot write",
        category: "Sohbet",
        isAnonymous: false,
      }),
    ).rejects.toThrow("This session is read-only.");

    const firstPost = result.current.posts[0];
    act(() => result.current.toggleLike(firstPost.id));
    expect(result.current.posts[0].liked).toBe(firstPost.liked);

    await expect(result.current.loadPostDetail(firstPost.id)).resolves.toBe(
      false,
    );
    expect(contentClientMocks.getContentPost).not.toHaveBeenCalled();
  });
});
