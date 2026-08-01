import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  createContentComment,
  createContentPost,
  deleteContentComment,
  deleteContentPost,
  getContentPost,
  listContentPosts,
  setContentPostBookmark,
  setContentPostLike,
  updateContentComment,
  updateContentPost,
  voteInContentPoll,
} from "@/server/content/service";
import type { FeedQueryInput } from "@/server/content/validation";
import {
  AuthError,
  type AuthErrorCode,
} from "@/server/auth/errors";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

const testUserIds = new Set<string>();

function newestFeed(
  overrides: Partial<FeedQueryInput> = {},
): FeedQueryInput {
  return {
    limit: 20,
    sort: "newest",
    ...overrides,
  };
}

async function insertUser(label = "Content User") {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentNumber = BigInt(`0x${suffix}`).toString();
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email,
      username,
      display_name,
      department,
      year_label
    ) values ($1, $2, $3, $4, $5)
    returning id`,
    [
      `${studentNumber}@stu.yasar.edu.tr`,
      `s${suffix}`,
      label,
      "Software Engineering",
      "2. sinif",
    ],
  );
  const id = result.rows[0]!.id;

  testUserIds.add(id);

  return {
    id,
    username: `s${suffix}`,
    displayName: label,
  };
}

async function expectAuthError(
  action: () => Promise<unknown>,
  code: AuthErrorCode,
  status: number,
) {
  let caughtError: unknown;

  try {
    await action();
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toBeInstanceOf(AuthError);
  expect(caughtError).toMatchObject({ code, status });

  return caughtError as AuthError;
}

afterEach(async () => {
  if (testUserIds.size === 0) {
    return;
  }

  const userIds = [...testUserIds];

  await pool.query(
    `delete from comments
     where author_id = any($1::uuid[])
        or post_id in (
          select id
          from posts
          where author_id = any($1::uuid[])
        )`,
    [userIds],
  );
  await pool.query(
    "delete from posts where author_id = any($1::uuid[])",
    [userIds],
  );
  await pool.query(
    "delete from users where id = any($1::uuid[])",
    [userIds],
  );
  testUserIds.clear();
});

afterAll(async () => {
  await pool.end();
});

describe("content service with PostgreSQL", () => {
  it("creates listings and returns their market details in feed and detail", async () => {
    const owner = await insertUser("Listing Owner");
    const viewer = await insertUser("Listing Viewer");
    const created = await createContentPost(owner.id, {
      category: "listing",
      title: "Tasarım kitabı",
      body: "Temiz durumda.",
      isAnonymous: false,
      listing: {
        type: "sale",
        condition: "lightly_used",
        price: 180,
      },
    });

    expect(created.listing).toEqual({
      type: "sale",
      condition: "lightly_used",
      price: 180,
    });
    expect(created.isAnonymous).toBe(false);

    const feed = await listContentPosts(
      viewer.id,
      newestFeed({ category: "listing" }),
    );
    const fromFeed = feed.data.find((post) => post.id === created.id);
    const detail = await getContentPost(viewer.id, created.id);

    expect(fromFeed?.listing).toEqual(created.listing);
    expect(detail.listing).toEqual(created.listing);
  });

  it("creates polls and keeps one movable vote per member", async () => {
    const owner = await insertUser("Poll Owner");
    const voter = await insertUser("Poll Voter");
    const created = await createContentPost(owner.id, {
      category: "poll",
      title: "Nerede çalışalım?",
      body: "",
      isAnonymous: false,
      pollOptions: ["Kütüphane", "Kampüs"],
    });

    expect(created.poll).toMatchObject({
      id: created.id,
      totalVotes: 0,
      options: [
        { text: "Kütüphane", voteCount: 0 },
        { text: "Kampüs", voteCount: 0 },
      ],
    });

    const firstOption = created.poll!.options[0]!;
    const secondOption = created.poll!.options[1]!;
    const firstVote = await voteInContentPoll(
      voter.id,
      created.id,
      firstOption.id,
    );
    const movedVote = await voteInContentPoll(
      voter.id,
      created.id,
      secondOption.id,
    );

    expect(firstVote.poll?.totalVotes).toBe(1);
    expect(firstVote.viewerState.selectedPollOptionId).toBe(firstOption.id);
    expect(movedVote.poll).toMatchObject({
      totalVotes: 1,
      options: [
        { id: firstOption.id, voteCount: 0 },
        { id: secondOption.id, voteCount: 1 },
      ],
    });
    expect(movedVote.viewerState.selectedPollOptionId).toBe(secondOption.id);

    const feed = await listContentPosts(voter.id, newestFeed());
    expect(feed.data.find((post) => post.id === created.id)?.poll).toEqual(
      movedVote.poll,
    );
  });

  it("persists idempotent per-viewer likes and bookmarks", async () => {
    const owner = await insertUser("Engagement Owner");
    const member = await insertUser("Engagement Member");
    const outsider = await insertUser("Engagement Outsider");
    const created = await createContentPost(owner.id, {
      category: "chat",
      title: "Engagement post",
      body: "",
      isAnonymous: false,
    });

    const firstLike = await setContentPostLike(
      member.id,
      created.id,
      true,
    );
    const repeatedLike = await setContentPostLike(
      member.id,
      created.id,
      true,
    );
    const firstBookmark = await setContentPostBookmark(
      member.id,
      created.id,
      true,
    );
    const repeatedBookmark = await setContentPostBookmark(
      member.id,
      created.id,
      true,
    );

    expect(firstLike).toMatchObject({
      likeCount: 1,
      viewerState: { liked: true },
    });
    expect(repeatedLike).toMatchObject({
      likeCount: 1,
      viewerState: { liked: true },
    });
    expect(firstBookmark.viewerState.bookmarked).toBe(true);
    expect(repeatedBookmark.viewerState.bookmarked).toBe(true);

    const outsiderView = await getContentPost(outsider.id, created.id);

    expect(outsiderView).toMatchObject({
      likeCount: 1,
      viewerState: {
        liked: false,
        bookmarked: false,
      },
    });

    const removedLike = await setContentPostLike(
      member.id,
      created.id,
      false,
    );
    const repeatedLikeRemoval = await setContentPostLike(
      member.id,
      created.id,
      false,
    );
    const removedBookmark = await setContentPostBookmark(
      member.id,
      created.id,
      false,
    );

    expect(removedLike).toMatchObject({
      likeCount: 0,
      viewerState: { liked: false },
    });
    expect(repeatedLikeRemoval.likeCount).toBe(0);
    expect(removedBookmark.viewerState.bookmarked).toBe(false);
  });

  it("orders and paginates the popular feed by real like counts", async () => {
    const owner = await insertUser("Popular Owner");
    const viewer = await insertUser("Popular Viewer");
    const firstLiker = await insertUser("Popular Liker One");
    const secondLiker = await insertUser("Popular Liker Two");
    const mostLiked = await createContentPost(owner.id, {
      category: "question",
      title: "Most liked",
      body: "",
      isAnonymous: false,
    });
    const likedOnce = await createContentPost(owner.id, {
      category: "question",
      title: "Liked once",
      body: "",
      isAnonymous: false,
    });
    const notLiked = await createContentPost(owner.id, {
      category: "question",
      title: "Not liked",
      body: "",
      isAnonymous: false,
    });

    await setContentPostLike(firstLiker.id, mostLiked.id, true);
    await setContentPostLike(secondLiker.id, mostLiked.id, true);
    await setContentPostLike(firstLiker.id, likedOnce.id, true);

    const query: FeedQueryInput = {
      author: owner.username,
      category: "question",
      limit: 2,
      sort: "popular",
    };
    const firstPage = await listContentPosts(viewer.id, query);

    expect(firstPage.data.map((post) => [post.id, post.likeCount])).toEqual([
      [mostLiked.id, 2],
      [likedOnce.id, 1],
    ]);
    expect(firstPage.page).toMatchObject({
      hasMore: true,
      nextCursor: expect.any(String),
    });

    const cursor = firstPage.page.nextCursor;

    if (!cursor) {
      throw new Error("Expected a popular feed cursor.");
    }

    const secondPage = await listContentPosts(viewer.id, {
      ...query,
      cursor,
    });

    expect(secondPage.data.map((post) => post.id)).toEqual([notLiked.id]);
    expect(secondPage.page).toEqual({
      hasMore: false,
      nextCursor: null,
    });
    await expectAuthError(
      () =>
        listContentPosts(viewer.id, {
          ...query,
          sort: "newest",
          cursor,
        }),
      "INVALID_REQUEST",
      400,
    );
  });

  it("creates, lists, reads, updates, and soft-deletes a post", async () => {
    const owner = await insertUser("Post Owner");
    const outsider = await insertUser("Post Outsider");
    const created = await createContentPost(owner.id, {
      category: "chat",
      title: "Initial title",
      body: "",
      isAnonymous: false,
    });

    expect(created).toMatchObject({
      category: "chat",
      title: "Initial title",
      body: "",
      author: {
        id: owner.id,
        username: owner.username,
        displayName: owner.displayName,
      },
      comments: [],
      viewerState: {
        isAuthor: true,
        canEdit: true,
        canDelete: true,
      },
    });

    const feed = await listContentPosts(
      outsider.id,
      newestFeed({ author: owner.username }),
    );

    expect(feed.data.map((post) => post.id)).toEqual([created.id]);
    expect(feed.data[0]?.viewerState.isAuthor).toBe(false);

    const detail = await getContentPost(outsider.id, created.id);

    expect(detail.id).toBe(created.id);
    expect(detail.viewerState).toMatchObject({
      isAuthor: false,
      canEdit: false,
      canDelete: false,
    });

    await expectAuthError(
      () =>
        updateContentPost(outsider.id, created.id, {
          title: "Unauthorized edit",
        }),
      "CONTENT_FORBIDDEN",
      403,
    );
    await expectAuthError(
      () => deleteContentPost(outsider.id, created.id),
      "CONTENT_FORBIDDEN",
      403,
    );

    const updated = await updateContentPost(owner.id, created.id, {
      title: "Updated title",
    });

    expect(updated.title).toBe("Updated title");
    expect(updated.editedAt).not.toBeNull();

    const blankPatchError = await expectAuthError(
      () =>
        updateContentPost(owner.id, created.id, {
          title: "   ",
        }),
      "INVALID_REQUEST",
      400,
    );

    expect(blankPatchError.fieldErrors.body).toBeDefined();
    await expect(
      getContentPost(owner.id, created.id),
    ).resolves.toMatchObject({ title: "Updated title", body: "" });

    const deletion = await deleteContentPost(owner.id, created.id);
    const stored = await pool.query<{ deleted_at: Date | null }>(
      "select deleted_at from posts where id = $1",
      [created.id],
    );

    expect(deletion.id).toBe(created.id);
    expect(new Date(deletion.deletedAt).toISOString()).toBe(
      deletion.deletedAt,
    );
    expect(stored.rows[0]?.deleted_at).toBeInstanceOf(Date);

    const afterDeletion = await listContentPosts(
      owner.id,
      newestFeed({ author: owner.username }),
    );

    expect(afterDeletion.data).toEqual([]);
    await expectAuthError(
      () => getContentPost(owner.id, created.id),
      "POST_NOT_FOUND",
      404,
    );
    await expectAuthError(
      () =>
        createContentComment(outsider.id, created.id, {
          body: "A deleted post must not accept comments.",
          isAnonymous: false,
        }),
      "POST_NOT_FOUND",
      404,
    );
  });

  it("never exposes an anonymous author while preserving ownership state", async () => {
    const owner = await insertUser("Anonymous Owner");
    const outsider = await insertUser("Anonymous Outsider");
    const publicPost = await createContentPost(owner.id, {
      category: "confession",
      title: "Public confession",
      body: "",
      isAnonymous: false,
    });
    const anonymousPost = await createContentPost(owner.id, {
      category: "confession",
      title: "Anonymous confession",
      body: "",
      isAnonymous: true,
    });

    expect(anonymousPost.author).toEqual({
      id: null,
      username: null,
      displayName: "Anonim",
      avatarUrl: null,
    });
    expect(anonymousPost.viewerState.isAuthor).toBe(true);
    expect(JSON.stringify(anonymousPost)).not.toContain(owner.id);

    const outsiderView = await getContentPost(
      outsider.id,
      anonymousPost.id,
    );

    expect(outsiderView.author).toEqual({
      id: null,
      username: null,
      displayName: "Anonim",
      avatarUrl: null,
    });
    expect(outsiderView.viewerState).toMatchObject({
      isAuthor: false,
      canEdit: false,
      canDelete: false,
    });
    expect(JSON.stringify(outsiderView)).not.toContain(owner.id);

    const generalFeed = await listContentPosts(
      outsider.id,
      newestFeed({ category: "confession" }),
    );
    const testPostIds = generalFeed.data
      .filter((post) =>
        post.id === publicPost.id || post.id === anonymousPost.id,
      )
      .map((post) => post.id);

    expect(new Set(testPostIds)).toEqual(
      new Set([publicPost.id, anonymousPost.id]),
    );

    const authorFeed = await listContentPosts(
      outsider.id,
      newestFeed({ author: owner.username }),
    );

    expect(authorFeed.data.map((post) => post.id)).toEqual([
      publicPost.id,
    ]);
  });

  it("paginates deterministically and binds cursors to feed filters", async () => {
    const owner = await insertUser("Pagination Owner");
    const otherAuthor = await insertUser("Pagination Other");
    const viewer = await insertUser("Pagination Viewer");
    const postIds: string[] = [];
    const baseTime = Date.now() - 60_000;
    const createdAtOffsets = [4_000, 3_000, 3_000, 2_000, 1_000];

    for (const [index, offset] of createdAtOffsets.entries()) {
      const post = await createContentPost(owner.id, {
        category: "event",
        title: `Cursor post ${index}`,
        body: "",
        isAnonymous: false,
      });

      postIds.push(post.id);
      await pool.query(
        "update posts set created_at = $2 where id = $1",
        [post.id, new Date(baseTime + offset)],
      );
    }

    const expectedResult = await pool.query<{ id: string }>(
      `select id
       from posts
       where id = any($1::uuid[])
       order by created_at desc, id desc`,
      [postIds],
    );
    const expectedIds = expectedResult.rows.map((row) => row.id);
    const feedQuery = newestFeed({
      author: owner.username,
      category: "event",
      limit: 2,
    });
    const firstPage = await listContentPosts(viewer.id, feedQuery);

    expect(firstPage.data.map((post) => post.id)).toEqual(
      expectedIds.slice(0, 2),
    );
    expect(firstPage.page).toMatchObject({
      hasMore: true,
      nextCursor: expect.any(String),
    });

    const headPost = await createContentPost(owner.id, {
      category: "event",
      title: "Inserted after the first page",
      body: "",
      isAnonymous: false,
    });
    await pool.query(
      "update posts set created_at = $2 where id = $1",
      [headPost.id, new Date(baseTime + 10_000)],
    );

    const cursor = firstPage.page.nextCursor;

    if (!cursor) {
      throw new Error("Expected a cursor for the first page.");
    }

    await expectAuthError(
      () =>
        listContentPosts(viewer.id, {
          ...feedQuery,
          category: "chat",
          cursor,
        }),
      "INVALID_REQUEST",
      400,
    );
    await expectAuthError(
      () =>
        listContentPosts(viewer.id, {
          ...feedQuery,
          author: otherAuthor.username,
          cursor,
        }),
      "INVALID_REQUEST",
      400,
    );

    const seenIds = firstPage.data.map((post) => post.id);
    let nextCursor: string | null = cursor;
    let pageCount = 1;

    while (nextCursor) {
      const page = await listContentPosts(viewer.id, {
        ...feedQuery,
        cursor: nextCursor,
      });

      seenIds.push(...page.data.map((post) => post.id));
      nextCursor = page.page.nextCursor;
      pageCount += 1;

      if (pageCount > 4) {
        throw new Error("Cursor pagination did not terminate.");
      }
    }

    expect(seenIds).toEqual(expectedIds);
    expect(new Set(seenIds).size).toBe(seenIds.length);
    expect(seenIds).not.toContain(headPost.id);
  });

  it("creates, updates, and tombstones a comment with owner checks", async () => {
    const postOwner = await insertUser("Comment Post Owner");
    const commentOwner = await insertUser("Comment Owner");
    const outsider = await insertUser("Comment Outsider");
    const post = await createContentPost(postOwner.id, {
      category: "question",
      title: "Comment lifecycle",
      body: "",
      isAnonymous: false,
    });
    const created = await createContentComment(
      commentOwner.id,
      post.id,
      {
        body: "Original comment",
        isAnonymous: false,
      },
    );

    expect(created).toMatchObject({
      postId: post.id,
      parentId: null,
      body: "Original comment",
      isDeleted: false,
      author: {
        id: commentOwner.id,
        username: commentOwner.username,
      },
      viewerState: {
        isAuthor: true,
        canEdit: true,
        canDelete: true,
      },
    });

    await expectAuthError(
      () =>
        updateContentComment(outsider.id, created.id, {
          body: "Unauthorized edit",
        }),
      "CONTENT_FORBIDDEN",
      403,
    );
    await expectAuthError(
      () => deleteContentComment(outsider.id, created.id),
      "CONTENT_FORBIDDEN",
      403,
    );

    const updated = await updateContentComment(
      commentOwner.id,
      created.id,
      { body: "Updated comment" },
    );

    expect(updated.body).toBe("Updated comment");
    expect(updated.editedAt).not.toBeNull();

    await deleteContentComment(commentOwner.id, created.id);

    const ownerDetail = await getContentPost(commentOwner.id, post.id);
    const tombstone = ownerDetail.comments.find(
      (comment) => comment.id === created.id,
    );

    expect(ownerDetail.commentCount).toBe(0);
    expect(tombstone).toMatchObject({
      isDeleted: true,
      body: null,
      author: {
        id: null,
        username: null,
        avatarUrl: null,
      },
      viewerState: {
        isAuthor: true,
        canEdit: false,
        canDelete: false,
      },
    });
    expect(tombstone?.author.displayName).not.toBe(
      commentOwner.displayName,
    );
    expect(JSON.stringify(tombstone)).not.toContain(commentOwner.id);

    const outsiderDetail = await getContentPost(outsider.id, post.id);
    const outsiderTombstone = outsiderDetail.comments.find(
      (comment) => comment.id === created.id,
    );

    expect(outsiderTombstone?.viewerState).toEqual({
      isAuthor: false,
      canEdit: false,
      canDelete: false,
    });
  });

  it("rejects comment updates when the post author is soft-deleted", async () => {
    const postOwner = await insertUser("Deleted Post Author");
    const commentOwner = await insertUser("Update Comment Owner");
    const post = await createContentPost(postOwner.id, {
      category: "question",
      title: "Hidden post update guard",
      body: "",
      isAnonymous: false,
    });
    const comment = await createContentComment(
      commentOwner.id,
      post.id,
      {
        body: "This body must remain unchanged.",
        isAnonymous: false,
      },
    );

    await pool.query(
      "update users set deleted_at = now() where id = $1",
      [postOwner.id],
    );

    await expectAuthError(
      () =>
        updateContentComment(commentOwner.id, comment.id, {
          body: "This update must be rejected.",
        }),
      "COMMENT_NOT_FOUND",
      404,
    );

    const stored = await pool.query<{
      body: string;
      edited_at: Date | null;
    }>(
      "select body, edited_at from comments where id = $1",
      [comment.id],
    );

    expect(stored.rows[0]).toMatchObject({
      body: "This body must remain unchanged.",
      edited_at: null,
    });
  });

  it("rejects comment deletion when the post author is soft-deleted", async () => {
    const postOwner = await insertUser("Deleted Post Author");
    const commentOwner = await insertUser("Delete Comment Owner");
    const post = await createContentPost(postOwner.id, {
      category: "question",
      title: "Hidden post deletion guard",
      body: "",
      isAnonymous: false,
    });
    const comment = await createContentComment(
      commentOwner.id,
      post.id,
      {
        body: "This comment must not be tombstoned.",
        isAnonymous: false,
      },
    );

    await pool.query(
      "update users set deleted_at = now() where id = $1",
      [postOwner.id],
    );

    await expectAuthError(
      () => deleteContentComment(commentOwner.id, comment.id),
      "COMMENT_NOT_FOUND",
      404,
    );

    const stored = await pool.query<{ deleted_at: Date | null }>(
      "select deleted_at from comments where id = $1",
      [comment.id],
    );

    expect(stored.rows[0]?.deleted_at).toBeNull();
  });

  it("rate-limits comment creation per member", async () => {
    const postOwner = await insertUser("Rate Limit Post Owner");
    const commentOwner = await insertUser("Rate Limited Commenter");
    const post = await createContentPost(postOwner.id, {
      category: "chat",
      title: "Bounded comment writes",
      body: "",
      isAnonymous: false,
    });

    await pool.query(
      `insert into comments (
         post_id,
         author_id,
         body,
         created_at
       )
       select $1, $2, 'Recent comment ' || series, now()
       from generate_series(1, 20) as series`,
      [post.id, commentOwner.id],
    );

    const error = await expectAuthError(
      () =>
        createContentComment(commentOwner.id, post.id, {
          body: "One comment too many",
          isAnonymous: false,
        }),
      "CONTENT_RATE_LIMITED",
      429,
    );

    expect(error.retryAfterSeconds).toBe(60);
  });

  it("caps the total number of comments stored for one post", async () => {
    const postOwner = await insertUser("Comment Cap Post Owner");
    const filler = await insertUser("Comment Cap Filler");
    const post = await createContentPost(postOwner.id, {
      category: "chat",
      title: "Bounded comment thread",
      body: "",
      isAnonymous: false,
    });

    await pool.query(
      `insert into comments (
         post_id,
         author_id,
         body,
         created_at
       )
       select $1, $2, 'Thread comment ' || series, now()
       from generate_series(1, 500) as series`,
      [post.id, filler.id],
    );

    await expectAuthError(
      () =>
        createContentComment(postOwner.id, post.id, {
          body: "The thread is already full",
          isAnonymous: false,
        }),
      "CONTENT_LIMIT_REACHED",
      409,
    );
  });

  it("validates reply ownership by post and flattens nested replies", async () => {
    const firstUser = await insertUser("Reply User One");
    const secondUser = await insertUser("Reply User Two");
    const firstPost = await createContentPost(firstUser.id, {
      category: "chat",
      title: "First reply thread",
      body: "",
      isAnonymous: false,
    });
    const secondPost = await createContentPost(secondUser.id, {
      category: "chat",
      title: "Second reply thread",
      body: "",
      isAnonymous: false,
    });
    const root = await createContentComment(
      firstUser.id,
      firstPost.id,
      {
        body: "Root comment",
        isAnonymous: false,
      },
    );
    const child = await createContentComment(
      secondUser.id,
      firstPost.id,
      {
        body: "Child comment",
        isAnonymous: false,
        parentId: root.id,
      },
    );
    const nestedReply = await createContentComment(
      firstUser.id,
      firstPost.id,
      {
        body: "Reply to a child",
        isAnonymous: false,
        parentId: child.id,
      },
    );
    const foreignRoot = await createContentComment(
      secondUser.id,
      secondPost.id,
      {
        body: "Another post root",
        isAnonymous: false,
      },
    );

    expect(child.parentId).toBe(root.id);
    expect(nestedReply.parentId).toBe(root.id);

    const wrongPostError = await expectAuthError(
      () =>
        createContentComment(secondUser.id, firstPost.id, {
          body: "Cross-post reply",
          isAnonymous: false,
          parentId: foreignRoot.id,
        }),
      "INVALID_REQUEST",
      400,
    );

    expect(wrongPostError.fieldErrors.parentId).toBeDefined();
  });
});
