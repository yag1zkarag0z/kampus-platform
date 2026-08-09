import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  createContentComment,
  createContentPost,
  getContentPost,
  listContentBookmarks,
  listContentPosts,
  setContentPostBookmark,
  setContentPostLike,
  updateContentComment,
} from "@/server/content/service";
import type { FeedQueryInput } from "@/server/content/validation";
import {
  getFollowSummary,
  listFollowers,
  listFollowing,
  searchMembers,
} from "@/server/social/service";
import {
  getUnreadNotificationCount,
  listNotifications,
} from "@/server/notifications/service";
import { AuthError, type AuthErrorCode } from "@/server/auth/errors";

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

async function insertUser(label = "Blocking User") {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentNumber = BigInt(`0x${suffix}`).toString();
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email, username, display_name, department, year_label
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

  return { id, username: `s${suffix}` };
}

async function block(blockerId: string, blockedId: string) {
  await pool.query(
    "insert into blocks (blocker_id, blocked_id) values ($1, $2)",
    [blockerId, blockedId],
  );
}

async function follow(followerId: string, followingId: string) {
  await pool.query(
    `insert into follows (follower_id, following_id) values ($1, $2)
     on conflict do nothing`,
    [followerId, followingId],
  );
}

async function createPost(authorId: string, title: string) {
  return createContentPost(authorId, {
    category: "chat",
    title,
    body: "",
    isAnonymous: false,
  });
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
}

afterEach(async () => {
  if (testUserIds.size === 0) {
    return;
  }

  const userIds = [...testUserIds];

  await pool.query(
    `delete from comments
     where author_id = any($1::uuid[])
        or post_id in (select id from posts where author_id = any($1::uuid[]))`,
    [userIds],
  );
  await pool.query("delete from posts where author_id = any($1::uuid[])", [
    userIds,
  ]);
  await pool.query("delete from users where id = any($1::uuid[])", [userIds]);
  testUserIds.clear();
});

afterAll(async () => {
  await pool.end();
});

describe("engelleme her iki yönde de görünürlüğü kaldırır", () => {
  it("engelleyen ve engellenen birbirinin gönderilerini akışta görmez", async () => {
    const blocker = await insertUser("Blocker");
    const blocked = await insertUser("Blocked");
    const blockerPost = await createPost(blocker.id, "Engelleyenin gönderisi");
    const blockedPost = await createPost(blocked.id, "Engellenenin gönderisi");

    await block(blocker.id, blocked.id);

    const blockerFeed = await listContentPosts(blocker.id, newestFeed());
    const blockedFeed = await listContentPosts(blocked.id, newestFeed());

    expect(blockerFeed.data.map((post) => post.id)).not.toContain(
      blockedPost.id,
    );
    // Asıl regresyon: engellenen taraf da engelleyenin içeriğini görmemeli.
    expect(blockedFeed.data.map((post) => post.id)).not.toContain(
      blockerPost.id,
    );
    expect(blockerFeed.data.map((post) => post.id)).toContain(blockerPost.id);
    expect(blockedFeed.data.map((post) => post.id)).toContain(blockedPost.id);
  });

  it("doğrudan URL ile gönderi detayına erişimi iki yönde de kapatır", async () => {
    const blocker = await insertUser("Detail Blocker");
    const blocked = await insertUser("Detail Blocked");
    const blockerPost = await createPost(blocker.id, "Detay gönderisi");
    const blockedPost = await createPost(blocked.id, "Karşı detay gönderisi");

    await expect(
      getContentPost(blocked.id, blockerPost.id),
    ).resolves.toMatchObject({ id: blockerPost.id });

    await block(blocker.id, blocked.id);

    await expectAuthError(
      () => getContentPost(blocked.id, blockerPost.id),
      "POST_NOT_FOUND",
      404,
    );
    await expectAuthError(
      () => getContentPost(blocker.id, blockedPost.id),
      "POST_NOT_FOUND",
      404,
    );
  });

  it("engellenen gönderiyle etkileşimi reddeder", async () => {
    const blocker = await insertUser("Interaction Blocker");
    const blocked = await insertUser("Interaction Blocked");
    const blockerPost = await createPost(blocker.id, "Etkileşim gönderisi");

    await block(blocker.id, blocked.id);

    await expectAuthError(
      () => setContentPostLike(blocked.id, blockerPost.id, true),
      "POST_NOT_FOUND",
      404,
    );
    await expectAuthError(
      () => setContentPostBookmark(blocked.id, blockerPost.id, true),
      "POST_NOT_FOUND",
      404,
    );
    await expectAuthError(
      () =>
        createContentComment(blocked.id, blockerPost.id, {
          body: "Görünmemeli",
          isAnonymous: false,
        }),
      "POST_NOT_FOUND",
      404,
    );
  });

  it("engellenen kullanıcının yorumlarını detaydan ve sayaçtan düşürür", async () => {
    const author = await insertUser("Comment Post Author");
    const viewer = await insertUser("Comment Viewer");
    const noisy = await insertUser("Comment Noisy");
    const post = await createPost(author.id, "Yorumlu gönderi");

    await createContentComment(viewer.id, post.id, {
      body: "Görünen yorum",
      isAnonymous: false,
    });
    const hiddenComment = await createContentComment(noisy.id, post.id, {
      body: "Engellenen yorum",
      isAnonymous: false,
    });

    const beforeBlock = await getContentPost(viewer.id, post.id);
    expect(beforeBlock.comments).toHaveLength(2);
    expect(beforeBlock.commentCount).toBe(2);

    await block(noisy.id, viewer.id);

    const afterBlock = await getContentPost(viewer.id, post.id);

    expect(afterBlock.comments.map((comment) => comment.id)).not.toContain(
      hiddenComment.id,
    );
    expect(afterBlock.comments).toHaveLength(1);
    expect(afterBlock.commentCount).toBe(1);

    const feed = await listContentPosts(viewer.id, newestFeed());
    const feedPost = feed.data.find((item) => item.id === post.id);

    expect(feedPost?.commentCount).toBe(1);
  });

  it("engellenen kullanıcının yorumuna yanıt verilmesini engeller", async () => {
    const author = await insertUser("Reply Post Author");
    const viewer = await insertUser("Reply Viewer");
    const noisy = await insertUser("Reply Noisy");
    const post = await createPost(author.id, "Yanıt gönderisi");
    const rootComment = await createContentComment(noisy.id, post.id, {
      body: "Kök yorum",
      isAnonymous: false,
    });

    await block(viewer.id, noisy.id);

    await expectAuthError(
      () =>
        createContentComment(viewer.id, post.id, {
          body: "Yanıt denemesi",
          isAnonymous: false,
          parentId: rootComment.id,
        }),
      "INVALID_REQUEST",
      400,
    );
  });

  it("erişilemeyen gönderideki kendi yorumunun düzenlenmesini durdurur", async () => {
    const author = await insertUser("Edit Post Author");
    const commenter = await insertUser("Edit Commenter");
    const post = await createPost(author.id, "Düzenleme gönderisi");
    const comment = await createContentComment(commenter.id, post.id, {
      body: "İlk hâli",
      isAnonymous: false,
    });

    await block(author.id, commenter.id);

    await expectAuthError(
      () =>
        updateContentComment(commenter.id, comment.id, {
          body: "Güncellenmiş hâli",
        }),
      "COMMENT_NOT_FOUND",
      404,
    );
  });

  it("kaydedilenler listesinden engellenen yazarın gönderisini düşürür", async () => {
    const author = await insertUser("Bookmark Author");
    const viewer = await insertUser("Bookmark Viewer");
    const post = await createPost(author.id, "Kaydedilen gönderi");

    await setContentPostBookmark(viewer.id, post.id, true);

    const beforeBlock = await listContentBookmarks(viewer.id, { limit: 20 });
    expect(beforeBlock.data.map((item) => item.id)).toContain(post.id);

    // Yazar görüntüleyeni engelliyor: ters yön de listeyi etkilemeli.
    await block(author.id, viewer.id);

    const afterBlock = await listContentBookmarks(viewer.id, { limit: 20 });
    expect(afterBlock.data.map((item) => item.id)).not.toContain(post.id);
  });

  it("engelleyene profili 'engelledin' durumuyla açar, engellenene hiç açmaz", async () => {
    const blocker = await insertUser("Profile Blocker");
    const blocked = await insertUser("Profile Blocked");
    const blockerPost = await createPost(blocker.id, "Profil gönderisi");

    await follow(blocked.id, blocker.id);
    await block(blocker.id, blocked.id);

    // Engelleyen kendi kararını görebilmeli: profil açılır, sayaçlar sıfırlanır.
    await expect(
      getFollowSummary(blocker.id, blocked.username),
    ).resolves.toEqual({
      followerCount: 0,
      followingCount: 0,
      isFollowing: false,
      blockedByViewer: true,
    });
    await expect(
      listFollowers(blocker.id, blocked.username),
    ).resolves.toMatchObject({ data: [] });

    // Engellenen taraf profilin varlığını bile öğrenmemeli.
    await expectAuthError(
      () => getFollowSummary(blocked.id, blocker.username),
      "USER_NOT_FOUND",
      404,
    );
    await expectAuthError(
      () => listFollowers(blocked.id, blocker.username),
      "USER_NOT_FOUND",
      404,
    );

    // Her iki yönde de içerik gizli kalır.
    const blockedViewerFeed = await listContentPosts(
      blocked.id,
      newestFeed({ author: blocker.username }),
    );
    const blockerFeed = await listContentPosts(
      blocker.id,
      newestFeed({ author: blocked.username }),
    );

    expect(blockedViewerFeed.data.map((post) => post.id)).not.toContain(
      blockerPost.id,
    );
    expect(blockerFeed.data).toHaveLength(0);
  });

  it("takipçi ve takip listelerinden engellenen üyeleri çıkarır", async () => {
    const owner = await insertUser("List Owner");
    const viewer = await insertUser("List Viewer");
    const hidden = await insertUser("List Hidden");
    const visible = await insertUser("List Visible");

    await follow(hidden.id, owner.id);
    await follow(visible.id, owner.id);
    await follow(owner.id, hidden.id);
    await follow(owner.id, visible.id);
    await block(hidden.id, viewer.id);

    const followers = (await listFollowers(viewer.id, owner.username)).data;
    const following = (await listFollowing(viewer.id, owner.username)).data;

    expect(followers.map((member) => member.id)).toContain(visible.id);
    expect(followers.map((member) => member.id)).not.toContain(hidden.id);
    expect(following.map((member) => member.id)).toContain(visible.id);
    expect(following.map((member) => member.id)).not.toContain(hidden.id);
  });

  it("kişi aramasında engelli hesapları ve görüntüleyenin kendisini gizler", async () => {
    const viewer = await insertUser("Ece Viewer");
    const visible = await insertUser("Ece Arslan");
    const hidden = await insertUser("Ece Hidden");

    await block(hidden.id, viewer.id);

    const results = await searchMembers(viewer.id, "Ece");
    const resultIds = results.map((member) => member.id);

    expect(resultIds).toContain(visible.id);
    expect(resultIds).not.toContain(hidden.id);
    expect(resultIds).not.toContain(viewer.id);
  });

  it("engelden önce üretilmiş bildirimleri de listeden düşürür", async () => {
    const author = await insertUser("Notification Author");
    const liker = await insertUser("Notification Liker");
    const post = await createPost(author.id, "Bildirim gönderisi");

    await setContentPostLike(liker.id, post.id, true);

    const beforeBlock = (await listNotifications(author.id)).data;
    expect(beforeBlock.map((row) => row.actor.id)).toContain(liker.id);
    expect(await getUnreadNotificationCount(author.id)).toBeGreaterThan(0);

    await block(liker.id, author.id);

    const afterBlock = (await listNotifications(author.id)).data;
    expect(afterBlock.map((row) => row.actor.id)).not.toContain(liker.id);
    expect(await getUnreadNotificationCount(author.id)).toBe(0);
  });

  it("engelli çift arasında mention bildirimi üretmez", async () => {
    const author = await insertUser("Mention Post Author");
    const mentioned = await insertUser("Mentioned User");
    const commenter = await insertUser("Mentioning User");
    const post = await createPost(author.id, "Mention gönderisi");

    await block(mentioned.id, commenter.id);

    await createContentComment(commenter.id, post.id, {
      body: `@${mentioned.username} bak buraya`,
      isAnonymous: false,
    });

    const notifications = (await listNotifications(mentioned.id)).data;

    expect(
      notifications.filter((row) => row.kind === "mention"),
    ).toHaveLength(0);
  });
});
