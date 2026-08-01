import { describe, expect, it } from "vitest";

import {
  formatCampusRelativeTime,
  toCampusComment,
  toCampusPost,
  toContentCategory,
} from "@/content/adapter";
import type {
  ContentCommentDto,
  ContentPostCategory,
  ContentPostDetailDto,
  ContentPostDto,
} from "@/content/types";
import {
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusPostCategory,
} from "@/data/campusPosts";

const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const postId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const commentId = "7bf0c452-64b0-4fa6-9604-521732e84ac0";
const createdAt = "2026-07-29T10:00:00.000Z";

function createPostDto(
  overrides: Partial<ContentPostDto> = {},
): ContentPostDto {
  return {
    id: postId,
    category: "chat",
    isAnonymous: false,
    title: "Kampüs gönderisi",
    body: "Gönderi içeriği",
    author: {
      id: memberId,
      username: "campus.user",
      displayName: "Campus User",
      avatarUrl: null,
    },
    createdAt,
    editedAt: null,
    likeCount: 4,
    commentCount: 8,
    viewerState: {
      isAuthor: false,
      canEdit: false,
      canDelete: false,
      liked: false,
      bookmarked: false,
      selectedPollOptionId: null,
    },
    ...overrides,
  };
}

function createCommentDto(
  overrides: Partial<ContentCommentDto> = {},
): ContentCommentDto {
  return {
    id: commentId,
    postId,
    parentId: null,
    isAnonymous: false,
    isDeleted: false,
    body: "Yorum içeriği",
    author: {
      id: memberId,
      username: "campus.user",
      displayName: "Campus User",
      avatarUrl: null,
    },
    createdAt,
    editedAt: null,
    viewerState: {
      isAuthor: false,
      canEdit: false,
      canDelete: false,
    },
    ...overrides,
  };
}

describe("content DTO adapter", () => {
  it("maps a persisted image into the campus post model", () => {
    const image = {
      id: "d9955ee1-2c9c-49fe-9d45-6a94fe89b880",
      src: "/v1/media/d9955ee1-2c9c-49fe-9d45-6a94fe89b880",
      width: 1280,
      height: 720,
      alt: "Kampüs manzarası",
    };

    expect(toCampusPost(createPostDto({ image })).image).toEqual({
      src: image.src,
      width: 1280,
      height: 720,
      alt: "Kampüs manzarası",
    });
  });

  it("maps persisted listing values to campus labels", () => {
    expect(
      toCampusPost(
        createPostDto({
          category: "listing",
          listing: {
            type: "wanted",
            condition: "lightly_used",
            price: 750,
          },
        }),
      ).listing,
    ).toEqual({
      type: "Aranıyor",
      condition: "Az kullanılmış",
      price: 750,
    });
  });

  it("maps persisted poll options, votes, and viewer selection", () => {
    const optionId = "1f75d83d-5578-45c2-9447-217491362eb8";
    const mapped = toCampusPost(
      createPostDto({
        category: "poll",
        poll: {
          id: postId,
          totalVotes: 3,
          options: [
            { id: optionId, text: "Kütüphane", voteCount: 3 },
          ],
        },
        viewerState: {
          isAuthor: false,
          canEdit: false,
          canDelete: false,
          liked: false,
          bookmarked: false,
          selectedPollOptionId: optionId,
        },
      }),
    );

    expect(mapped.poll).toEqual({
      selectedOptionId: optionId,
      options: [{ id: optionId, text: "Kütüphane", votes: 3 }],
    });
  });

  it.each(
    [
      ["Sohbet", "chat"],
      ["İtiraf", "confession"],
      ["Soru", "question"],
      ["Etkinlik", "event"],
      ["Kayıp Eşya", "lost_found"],
      ["Anket", "poll"],
      ["İlan", "listing"],
    ] satisfies Array<[CampusPostCategory, ContentPostCategory]>,
  )("maps %s and %s categories in both directions", (label, value) => {
    expect(toContentCategory(label)).toBe(value);
    expect(
      toCampusPost(createPostDto({ category: value })).category,
    ).toBe(label);
  });

  it.each([
    {
      expected: "Şimdi",
      timestamp: "2026-07-29T11:59:45.000Z",
    },
    {
      expected: "5 dk",
      timestamp: "2026-07-29T11:55:00.000Z",
    },
    {
      expected: "2 sa",
      timestamp: "2026-07-29T10:00:00.000Z",
    },
    {
      expected: "3 gün",
      timestamp: "2026-07-26T12:00:00.000Z",
    },
  ])("formats relative time as $expected", ({ expected, timestamp }) => {
    expect(
      formatCampusRelativeTime(
        timestamp,
        Date.parse("2026-07-29T12:00:00.000Z"),
      ),
    ).toBe(expected);
  });

  it("maps a named author without changing the server identity", () => {
    const post = toCampusPost(createPostDto());

    expect(post).toMatchObject({
      author: "@campus.user",
      authorId: memberId,
      isAnonymous: false,
      detail: "Öğrenci",
    });
  });

  it("maps owned content to the stable local owner ID", () => {
    const post = toCampusPost(
      createPostDto({
        viewerState: {
          isAuthor: true,
          canEdit: true,
          canDelete: true,
          liked: false,
          bookmarked: false,
          selectedPollOptionId: null,
        },
      }),
    );

    expect(post.author).toBe("@campus.user");
    expect(post.authorId).toBe(LOCAL_ACCOUNT_OWNER_ID);
  });

  it("does not expose an anonymous author's server identity", () => {
    const post = toCampusPost(
      createPostDto({
        isAnonymous: true,
        author: {
          id: memberId,
          username: "should.not.leak",
          displayName: "Gizli Kullanıcı",
          avatarUrl: null,
        },
      }),
    );

    expect(post.author).toBe("Anonim");
    expect(post.authorId).toBeUndefined();
    expect(post.detail).toBeUndefined();
  });

  it("uses the local owner ID for the current viewer's anonymous content", () => {
    const post = toCampusPost(
      createPostDto({
        isAnonymous: true,
        author: {
          id: null,
          username: null,
          displayName: "Anonim",
          avatarUrl: null,
        },
        viewerState: {
          isAuthor: true,
          canEdit: true,
          canDelete: true,
          liked: false,
          bookmarked: false,
          selectedPollOptionId: null,
        },
      }),
    );

    expect(post.author).toBe("Anonim");
    expect(post.authorId).toBe(LOCAL_ACCOUNT_OWNER_ID);
  });

  it("keeps a deleted comment as a privacy-safe tombstone", () => {
    const comment = toCampusComment(
      createCommentDto({
        isDeleted: true,
        body: null,
        author: {
          id: null,
          username: null,
          displayName: "Silinen kullanıcı",
          avatarUrl: null,
        },
      }),
    );

    expect(comment).toMatchObject({
      author: "Silinen kullanıcı",
      body: "",
      isDeleted: true,
    });
    expect(comment.authorId).toBeUndefined();
  });

  it("maps detail comments without replacing the independent comment count", () => {
    const comment = createCommentDto();
    const detail: ContentPostDetailDto = {
      ...createPostDto({ commentCount: 12 }),
      comments: [comment],
    };

    const post = toCampusPost(detail);

    expect(post.commentCount).toBe(12);
    expect(post.comments).toHaveLength(1);
    expect(post.comments[0]).toMatchObject({
      id: commentId,
      author: "@campus.user",
      body: "Yorum içeriği",
    });
  });
});
