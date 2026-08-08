import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import sharp from "sharp";

import {
  createContentComment,
  createContentPost,
  deleteContentComment,
  deleteContentPost,
  getContentPost,
  listContentBookmarks,
  listContentPosts,
  setContentPostBookmark,
  setContentCommentLike,
  setContentPostLike,
  updateContentComment,
  updateContentPost,
  voteInContentPoll,
} from "@/server/content/service";
import {
  getVisibleContentDocument,
  getVisibleContentImage,
  uploadContentDocument,
  uploadContentImage,
} from "@/server/media/service";
import { getMediaStorage } from "@/server/media/storage";
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
    scope: "global",
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
  it("persists a validated image, links it once, and removes it with its post", async () => {
    const owner = await insertUser("Image Owner");
    const source = await sharp({
      create: {
        width: 48,
        height: 32,
        channels: 3,
        background: "#d26f45",
      },
    })
      .png()
      .toBuffer();
    const uploaded = await uploadContentImage(
      owner.id,
      new File([source], "campus.png", { type: "image/png" }),
    );

    const created = await createContentPost(owner.id, {
      category: "chat",
      title: "Kampüsten bir kare",
      body: "Bugünkü kampüs manzarası.",
      isAnonymous: false,
      imageId: uploaded.id,
    });

    expect(created.image).toEqual({
      id: uploaded.id,
      src: `/v1/media/${uploaded.id}`,
      width: 48,
      height: 32,
      alt: "Kampüsten bir kare görseli",
    });
    await expect(
      getVisibleContentImage(owner.id, uploaded.id),
    ).resolves.toMatchObject({
      contentType: "image/webp",
      body: expect.any(Buffer),
    });

    await expectAuthError(
      () =>
        createContentPost(owner.id, {
          category: "chat",
          title: "İkinci gönderi",
          body: "Aynı görsel tekrar kullanılamaz.",
          isAnonymous: false,
          imageId: uploaded.id,
        }),
      "INVALID_REQUEST",
      400,
    );

    await deleteContentPost(owner.id, created.id);
    await expectAuthError(
      () => getVisibleContentImage(owner.id, uploaded.id),
      "MEDIA_NOT_FOUND",
      404,
    );
  });

  it("applies hidden, blocked, and suspended post visibility to direct reads and attachments", async () => {
    const owner = await insertUser("Visibility Owner");
    const viewer = await insertUser("Visibility Viewer");
    const imageSource = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: "#d26f45",
      },
    })
      .png()
      .toBuffer();
    const image = await uploadContentImage(
      owner.id,
      new File([imageSource], "visibility.png", { type: "image/png" }),
    );
    const document = await uploadContentDocument(
      owner.id,
      new File([Buffer.from("%PDF-1.4\n%%EOF", "ascii")], "visibility.pdf", {
        type: "application/pdf",
      }),
    );
    const storage = getMediaStorage();

    try {
      const imagePost = await createContentPost(owner.id, {
        category: "chat",
        title: "Visibility image post",
        body: "",
        isAnonymous: false,
        imageId: image.id,
      });
      await createContentPost(owner.id, {
        category: "chat",
        title: "Visibility document post",
        body: "",
        isAnonymous: false,
        documentId: document.id,
      });
      const comment = await createContentComment(viewer.id, imagePost.id, {
        body: "Visible before moderation",
        isAnonymous: false,
      });

      await expect(
        getVisibleContentImage(viewer.id, image.id),
      ).resolves.toMatchObject({ contentType: "image/webp" });
      await expect(
        getVisibleContentDocument(viewer.id, document.id),
      ).resolves.toMatchObject({ contentType: "application/pdf" });

      await pool.query("update posts set hidden_at = now() where id = $1", [
        imagePost.id,
      ]);

      await expect(
        getVisibleContentImage(owner.id, image.id),
      ).resolves.toMatchObject({ contentType: "image/webp" });
      await expectAuthError(
        () => getVisibleContentImage(viewer.id, image.id),
        "MEDIA_NOT_FOUND",
        404,
      );
      await expectAuthError(
        () => getContentPost(viewer.id, imagePost.id),
        "POST_NOT_FOUND",
        404,
      );
      await expectAuthError(
        () =>
          createContentComment(viewer.id, imagePost.id, {
            body: "Hidden post bypass",
            isAnonymous: false,
          }),
        "POST_NOT_FOUND",
        404,
      );
      await expectAuthError(
        () => setContentCommentLike(viewer.id, comment.id, true),
        "COMMENT_NOT_FOUND",
        404,
      );

      await pool.query("update posts set hidden_at = null where id = $1", [
        imagePost.id,
      ]);
      await pool.query(
        "insert into blocks (blocker_id, blocked_id) values ($1, $2)",
        [owner.id, viewer.id],
      );

      await expectAuthError(
        () => getVisibleContentImage(viewer.id, image.id),
        "MEDIA_NOT_FOUND",
        404,
      );
      await expectAuthError(
        () => getVisibleContentDocument(viewer.id, document.id),
        "MEDIA_NOT_FOUND",
        404,
      );

      await pool.query(
        "delete from blocks where blocker_id = $1 and blocked_id = $2",
        [owner.id, viewer.id],
      );
      await pool.query(
        "update users set status = 'suspended', suspended_at = now() where id = $1",
        [owner.id],
      );

      await expectAuthError(
        () => getContentPost(viewer.id, imagePost.id),
        "POST_NOT_FOUND",
        404,
      );
      await expectAuthError(
        () => getVisibleContentImage(viewer.id, image.id),
        "MEDIA_NOT_FOUND",
        404,
      );
      await expectAuthError(
        () => getVisibleContentDocument(viewer.id, document.id),
        "MEDIA_NOT_FOUND",
        404,
      );
    } finally {
      await Promise.all([
        storage.delete(`images/${owner.id}/${image.id}.webp`),
        storage.delete(`documents/${owner.id}/${document.id}.pdf`),
      ]);
    }
  });

  it("serializes concurrent image and document reservations against the shared unattached quota", async () => {
    const owner = await insertUser("Atomic Upload Owner");
    const existingAssetIds = Array.from({ length: 4 }, () => randomUUID());
    const storage = getMediaStorage();

    for (const [index, assetId] of existingAssetIds.entries()) {
      await pool.query(
        `insert into media_assets (
          id, owner_id, storage_key, mime_type, size_bytes,
          width, height, checksum
        ) values ($1, $2, $3, 'image/webp', 1, 1, 1, $4)`,
        [
          assetId,
          owner.id,
          `images/${owner.id}/${assetId}.webp`,
          index.toString(16).padStart(64, "0"),
        ],
      );
    }

    const imageSource = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: "#d26f45",
      },
    })
      .png()
      .toBuffer();

    try {
      const results = await Promise.allSettled([
        uploadContentImage(
          owner.id,
          new File([imageSource], "atomic.png", { type: "image/png" }),
        ),
        uploadContentDocument(
          owner.id,
          new File([Buffer.from("%PDF-1.4\n%%EOF", "ascii")], "atomic.pdf", {
            type: "application/pdf",
          }),
        ),
      ]);
      const fulfilled = results.filter(
        (result) => result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result) => result.status === "rejected",
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        reason: expect.objectContaining({
          code: "CONTENT_RATE_LIMITED",
          status: 429,
        }),
      });

      const usage = await pool.query<{ total: string }>(
        `select (
          select count(*) from media_assets where owner_id = $1
        ) + (
          select count(*) from document_assets where owner_id = $1
        ) as total`,
        [owner.id],
      );

      expect(Number(usage.rows[0]?.total)).toBe(5);
    } finally {
      const reservedObjects = await pool.query<{ storage_key: string }>(
        `select storage_key from media_assets where owner_id = $1
         union all
         select storage_key from document_assets where owner_id = $1`,
        [owner.id],
      );

      await Promise.all(
        reservedObjects.rows.map(({ storage_key: storageKey }) =>
          storage.delete(storageKey),
        ),
      );
    }
  });

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

  it("ranks the trending feed by weighted engagement within its window", async () => {
    const author = await insertUser("Trending Author");
    const viewer = await insertUser("Trending Viewer");
    const voters = await Promise.all([
      insertUser("Trending Voter 1"),
      insertUser("Trending Voter 2"),
      insertUser("Trending Voter 3"),
    ]);
    const createPost = async (title: string) =>
      createContentPost(author.id, {
        category: "chat",
        title,
        body: "",
        isAnonymous: false,
      });

    const commented = await createPost("Yorumlu gönderi");
    const liked = await createPost("Beğenilen gönderi");
    const quiet = await createPost("Sessiz gönderi");
    const stale = await createPost("Eski ama popüler gönderi");

    // Yorum 2, beğeni 3 puan: iki beğeni bir yorumu geçmeli.
    await createContentComment(voters[0].id, commented.id, {
      body: "Tek yorum",
      isAnonymous: false,
    });

    for (const voter of voters.slice(0, 2)) {
      await setContentPostLike(voter.id, liked.id, true);
    }

    for (const voter of voters) {
      await setContentPostLike(voter.id, stale.id, true);
    }

    await pool.query(
      "update posts set created_at = now() - interval '30 days' where id = $1",
      [stale.id],
    );

    const trending = await listContentPosts(viewer.id, {
      limit: 20,
      sort: "trending",
      scope: "global",
    });
    const ids = trending.data.map((post) => post.id);

    expect(ids.indexOf(liked.id)).toBeLessThan(ids.indexOf(commented.id));
    expect(ids.indexOf(commented.id)).toBeLessThan(ids.indexOf(quiet.id));
    // Pencere dışındaki gönderi puanı yüksek olsa da listede olmamalı.
    expect(ids).not.toContain(stale.id);
  });

  it("paginates the trending feed without repeating posts", async () => {
    const author = await insertUser("Trending Pagination Author");
    const viewer = await insertUser("Trending Pagination Viewer");
    const createdIds: string[] = [];

    for (let index = 0; index < 5; index += 1) {
      const post = await createContentPost(author.id, {
        category: "chat",
        title: `Trend gönderi ${index}`,
        body: "",
        isAnonymous: false,
      });

      createdIds.push(post.id);

      if (index % 2 === 0) {
        await setContentPostLike(viewer.id, post.id, true);
      }
    }

    const query = {
      limit: 2,
      sort: "trending" as const,
      scope: "global" as const,
    };
    const firstPage = await listContentPosts(viewer.id, query);
    const seenIds = firstPage.data.map((post) => post.id);
    const seenCursors = new Set<string>();
    let cursor = firstPage.page.nextCursor;

    while (cursor) {
      expect(seenCursors.has(cursor)).toBe(false);
      seenCursors.add(cursor);

      const page = await listContentPosts(viewer.id, { ...query, cursor });

      seenIds.push(...page.data.map((post) => post.id));
      cursor = page.page.nextCursor;
    }

    expect(new Set(seenIds).size).toBe(seenIds.length);
    expect(seenIds).toEqual(expect.arrayContaining(createdIds));
  });

  it("lists saved posts newest-saved-first and hides unreachable ones", async () => {
    const viewer = await insertUser("Bookmark Viewer");
    const owner = await insertUser("Bookmark Owner");
    const blockedAuthor = await insertUser("Bookmark Blocked Author");
    const suspendedAuthor = await insertUser("Bookmark Suspended Author");
    const savedPost = async (authorId: string, title: string) =>
      createContentPost(authorId, {
        category: "chat",
        title,
        body: "",
        isAnonymous: false,
      });

    const oldest = await savedPost(owner.id, "Kayıt 1");
    const middle = await savedPost(owner.id, "Kayıt 2");
    const newest = await savedPost(owner.id, "Kayıt 3");
    const deletedPost = await savedPost(owner.id, "Silinecek kayıt");
    const blockedPost = await savedPost(
      blockedAuthor.id,
      "Engellenen yazarın kaydı",
    );
    const suspendedPost = await savedPost(
      suspendedAuthor.id,
      "Askıya alınan yazarın kaydı",
    );
    const savedAtBase = Date.now() - 60_000;
    const bookmarkOrder = [
      oldest,
      middle,
      newest,
      deletedPost,
      blockedPost,
      suspendedPost,
    ];

    for (const [index, post] of bookmarkOrder.entries()) {
      await setContentPostBookmark(viewer.id, post.id, true);
      await pool.query(
        `update post_bookmarks
         set created_at = $3
         where user_id = $1 and post_id = $2`,
        [viewer.id, post.id, new Date(savedAtBase + index * 1_000)],
      );
    }

    await deleteContentPost(owner.id, deletedPost.id);
    await pool.query(
      "insert into blocks (blocker_id, blocked_id) values ($1, $2)",
      [viewer.id, blockedAuthor.id],
    );
    await pool.query(
      "update users set status = 'suspended', suspended_at = now() where id = $1",
      [suspendedAuthor.id],
    );

    const firstPage = await listContentBookmarks(viewer.id, { limit: 2 });

    expect(firstPage.data.map((post) => post.id)).toEqual([
      newest.id,
      middle.id,
    ]);
    expect(firstPage.page).toMatchObject({
      hasMore: true,
      nextCursor: expect.any(String),
    });
    expect(
      firstPage.data.every((post) => post.viewerState.bookmarked),
    ).toBe(true);

    const cursor = firstPage.page.nextCursor;

    if (!cursor) {
      throw new Error("Expected a cursor for the first bookmark page.");
    }

    const secondPage = await listContentBookmarks(viewer.id, {
      cursor,
      limit: 2,
    });

    expect(secondPage.data.map((post) => post.id)).toEqual([oldest.id]);
    expect(secondPage.page).toEqual({
      hasMore: false,
      nextCursor: null,
    });

    await expectAuthError(
      () =>
        listContentBookmarks(viewer.id, {
          cursor: "not-a-real-cursor",
          limit: 20,
        }),
      "INVALID_REQUEST",
      400,
    );

    const outsider = await insertUser("Bookmark Outsider");

    await expect(
      listContentBookmarks(outsider.id, { limit: 20 }),
    ).resolves.toEqual({
      data: [],
      page: { hasMore: false, nextCursor: null },
    });
  });

  it("paginates bookmarks saved at the same instant without gaps", async () => {
    const viewer = await insertUser("Bookmark Tie Viewer");
    const owner = await insertUser("Bookmark Tie Owner");
    const savedAt = new Date(Date.now() - 60_000);
    const postIds: string[] = [];

    for (let index = 0; index < 5; index += 1) {
      const post = await createContentPost(owner.id, {
        category: "chat",
        title: `Aynı anda kaydedilen ${index}`,
        body: "",
        isAnonymous: false,
      });

      postIds.push(post.id);
      await setContentPostBookmark(viewer.id, post.id, true);
      await pool.query(
        `update post_bookmarks
         set created_at = $3
         where user_id = $1 and post_id = $2`,
        [viewer.id, post.id, savedAt],
      );
    }

    const expectedResult = await pool.query<{ post_id: string }>(
      `select post_id
       from post_bookmarks
       where user_id = $1 and post_id = any($2::uuid[])
       order by created_at desc, post_id desc`,
      [viewer.id, postIds],
    );
    const expectedIds = expectedResult.rows.map((row) => row.post_id);
    const seenIds: string[] = [];
    let cursor: string | null | undefined;
    let pageCount = 0;

    do {
      const page = await listContentBookmarks(viewer.id, {
        limit: 2,
        ...(cursor ? { cursor } : {}),
      });

      seenIds.push(...page.data.map((post) => post.id));
      cursor = page.page.nextCursor;
      pageCount += 1;

      if (pageCount > 4) {
        throw new Error("Bookmark pagination did not terminate.");
      }
    } while (cursor);

    expect(seenIds).toEqual(expectedIds);
    expect(new Set(seenIds).size).toBe(seenIds.length);
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
      scope: "global",
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

  it("scopes the following feed to the viewer and followed authors, excluding blocked and suspended accounts", async () => {
    const viewer = await insertUser("Following Viewer");
    const followedAuthor = await insertUser("Followed Author");
    const strangerAuthor = await insertUser("Stranger Author");
    const blockedFollowedAuthor = await insertUser(
      "Blocked Followed Author",
    );
    const suspendedFollowedAuthor = await insertUser(
      "Suspended Followed Author",
    );

    await pool.query(
      `insert into follows (follower_id, following_id) values
         ($1, $2), ($1, $3), ($1, $4)`,
      [
        viewer.id,
        followedAuthor.id,
        blockedFollowedAuthor.id,
        suspendedFollowedAuthor.id,
      ],
    );
    await pool.query(
      "insert into blocks (blocker_id, blocked_id) values ($1, $2)",
      [viewer.id, blockedFollowedAuthor.id],
    );

    const ownPost = await createContentPost(viewer.id, {
      category: "chat",
      title: "Kendi gönderim",
      body: "",
      isAnonymous: false,
    });
    const followedPost = await createContentPost(followedAuthor.id, {
      category: "chat",
      title: "Takip ettiğim kişinin gönderisi",
      body: "",
      isAnonymous: false,
    });
    const strangerPost = await createContentPost(strangerAuthor.id, {
      category: "chat",
      title: "Takip etmediğim biri",
      body: "",
      isAnonymous: false,
    });
    const blockedFollowedPost = await createContentPost(
      blockedFollowedAuthor.id,
      {
        category: "chat",
        title: "Takip ettiğim ama engellediğim",
        body: "",
        isAnonymous: false,
      },
    );
    const suspendedFollowedPost = await createContentPost(
      suspendedFollowedAuthor.id,
      {
        category: "chat",
        title: "Takip ettiğim ama askıya alınmış",
        body: "",
        isAnonymous: false,
      },
    );
    await pool.query(
      "update users set status = 'suspended', suspended_at = now() where id = $1",
      [suspendedFollowedAuthor.id],
    );

    const globalFeed = await listContentPosts(viewer.id, newestFeed());
    const globalIds = new Set(globalFeed.data.map((post) => post.id));
    expect(globalIds.has(ownPost.id)).toBe(true);
    expect(globalIds.has(followedPost.id)).toBe(true);
    expect(globalIds.has(strangerPost.id)).toBe(true);
    expect(globalIds.has(blockedFollowedPost.id)).toBe(false);
    expect(globalIds.has(suspendedFollowedPost.id)).toBe(false);

    const followingFeed = await listContentPosts(
      viewer.id,
      newestFeed({ scope: "following" }),
    );

    // Takip akışı yalnızca takip edilenleri gösterir, kendi gönderini değil.
    expect(followingFeed.data.map((post) => post.id)).toEqual([
      followedPost.id,
    ]);
    expect(followingFeed.data.map((post) => post.id)).not.toContain(
      ownPost.id,
    );
  });

  it("paginates the following feed across pages without leaking unfollowed authors", async () => {
    const viewer = await insertUser("Following Pagination Viewer");
    const followedAuthor = await insertUser(
      "Following Pagination Followed",
    );
    const strangerAuthor = await insertUser(
      "Following Pagination Stranger",
    );

    await pool.query(
      "insert into follows (follower_id, following_id) values ($1, $2)",
      [viewer.id, followedAuthor.id],
    );

    const baseTime = Date.now() - 60_000;
    const followedPostIds: string[] = [];

    for (const [index, offset] of [4_000, 3_000, 2_000, 1_000].entries()) {
      const post = await createContentPost(followedAuthor.id, {
        category: "event",
        title: `Takip gönderisi ${index}`,
        body: "",
        isAnonymous: false,
      });

      followedPostIds.push(post.id);
      await pool.query(
        "update posts set created_at = $2 where id = $1",
        [post.id, new Date(baseTime + offset)],
      );
    }

    await createContentPost(strangerAuthor.id, {
      category: "event",
      title: "Takip etmediğim gönderi",
      body: "",
      isAnonymous: false,
    });

    const expectedResult = await pool.query<{ id: string }>(
      `select id from posts
       where id = any($1::uuid[])
       order by created_at desc, id desc`,
      [followedPostIds],
    );
    const expectedIds = expectedResult.rows.map((row) => row.id);
    const feedQuery = newestFeed({ scope: "following", limit: 2 });

    const seenIds: string[] = [];
    let cursor: string | null = null;
    let pageCount = 0;

    do {
      const page = await listContentPosts(viewer.id, {
        ...feedQuery,
        ...(cursor ? { cursor } : {}),
      });

      seenIds.push(...page.data.map((post) => post.id));
      cursor = page.page.nextCursor;
      pageCount += 1;

      if (pageCount > 5) {
        throw new Error("Following feed pagination did not terminate.");
      }
    } while (cursor);

    expect(seenIds).toEqual(expectedIds);
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
      liked: false,
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

    // Sınır ortak hız sayacından okunuyor: yorum satırlarını saymak
    // yeterli değil, çünkü silinen yorumlar sayacı sıfırlayabilirdi.
    await pool.query(
      `insert into rate_limit_hits (user_id, action, created_at)
       select $1, 'comment_create', now()
       from generate_series(1, 20)`,
      [commentOwner.id],
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
