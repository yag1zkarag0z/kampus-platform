import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  DELETE as deleteFollow,
  POST as postFollow,
} from "@/app/v1/users/[username]/follow/route";
import { GET as getNotifications } from "@/app/v1/me/notifications/route";
import { GET as getUnreadCount } from "@/app/v1/me/notifications/unread-count/route";
import { PATCH as patchNotificationRead } from "@/app/v1/me/notifications/[id]/read/route";
import { POST as postReadAll } from "@/app/v1/me/notifications/read-all/route";
import {
  createContentComment,
  createContentPost,
  setContentPostLike,
} from "@/server/content/service";
import { createMemberSession } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const testEmails = new Set<string>();

function createAccountFixture() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentNumber = BigInt(`0x${suffix}`).toString();

  return {
    email: `${studentNumber}@stu.yasar.edu.tr`,
    username: `n${suffix}`,
  };
}

async function insertAccount() {
  const fixture = createAccountFixture();
  testEmails.add(fixture.email);
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email,
      username,
      display_name,
      department,
      year_label,
      bio
    ) values ($1, $2, $3, $4, $5, $6)
    returning id`,
    [
      fixture.email,
      fixture.username,
      "Bildirim Öğrencisi",
      "Yazılım Mühendisliği",
      "2. sınıf",
      "",
    ],
  );
  const id = result.rows[0]!.id;

  await pool.query("insert into user_settings (user_id) values ($1)", [id]);

  return { ...fixture, id };
}

async function createMemberCookie(userId: string) {
  const session = await createMemberSession(getDatabase(), {
    now: new Date(),
    role: "member",
    userId,
  });

  return session.cookieValue;
}

function jsonRequest(
  url: string,
  method: string,
  {
    cookie,
    origin = appOrigin,
  }: { cookie?: string; origin?: string } = {},
) {
  return new NextRequest(new URL(url, appOrigin), {
    method,
    headers: {
      ...(cookie ? { Cookie: `kampus_session=${cookie}` } : {}),
      Origin: origin,
    },
  });
}

function plainRequest(url: string, { cookie }: { cookie?: string } = {}) {
  return new NextRequest(new URL(url, appOrigin), {
    headers: cookie ? { Cookie: `kampus_session=${cookie}` } : undefined,
  });
}

async function fetchNotificationsFor(userId: string) {
  const rows = await pool.query<{
    id: string;
    kind: string;
    recipient_id: string;
    actor_id: string;
    like_count: number | null;
    read_at: Date | null;
  }>(
    `select id, kind, recipient_id, actor_id, like_count, read_at
     from notifications where recipient_id = $1
     order by created_at desc`,
    [userId],
  );

  return rows.rows;
}

afterEach(async () => {
  if (testEmails.size === 0) {
    return;
  }

  await pool.query(
    `delete from notifications
     where recipient_id in (select id from users where email = any($1))
        or actor_id in (select id from users where email = any($1))`,
    [[...testEmails]],
  );
  await pool.query(
    `delete from comments
     where author_id in (select id from users where email = any($1))
        or post_id in (
          select id from posts
          where author_id in (select id from users where email = any($1))
        )`,
    [[...testEmails]],
  );
  await pool.query(
    `delete from posts where author_id in (
      select id from users where email = any($1)
    )`,
    [[...testEmails]],
  );
  await pool.query("delete from users where email = any($1)", [
    [...testEmails],
  ]);
  testEmails.clear();
});

afterAll(async () => {
  await pool.end();
});

describe("notification routes with PostgreSQL", () => {
  it("does not notify the author about their own comment", async () => {
    const author = await insertAccount();
    const post = await createContentPost(author.id, {
      category: "chat",
      title: "Kendi gönderim",
      body: "",
      isAnonymous: false,
    });

    await createContentComment(author.id, post.id, {
      body: "Kendi gönderime yorum yapıyorum.",
      isAnonymous: false,
    });

    const rows = await fetchNotificationsFor(author.id);
    expect(rows).toHaveLength(0);
  });

  it("aggregates likes from multiple users into a single notification", async () => {
    const author = await insertAccount();
    const firstLiker = await insertAccount();
    const secondLiker = await insertAccount();
    const post = await createContentPost(author.id, {
      category: "chat",
      title: "Beğenilecek gönderi",
      body: "",
      isAnonymous: false,
    });

    await setContentPostLike(firstLiker.id, post.id, true);
    await setContentPostLike(secondLiker.id, post.id, true);

    const rows = await fetchNotificationsFor(author.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "like",
      like_count: 2,
      actor_id: secondLiker.id,
    });

    const authorCookie = await createMemberCookie(author.id);
    const listResponse = await getNotifications(
      plainRequest("/v1/me/notifications", { cookie: authorCookie }),
    );
    expect(listResponse.status).toBe(200);

    const payload = (await listResponse.json()) as {
      data: Array<{
        kind: string;
        likeCount: number | null;
        otherActors: Array<{ id: string }>;
      }>;
    };
    const likeNotification = payload.data.find(
      (notification) => notification.kind === "like",
    );

    expect(likeNotification).toMatchObject({ likeCount: 2 });
    expect(likeNotification?.otherActors).toHaveLength(1);
    expect(likeNotification?.otherActors[0]?.id).toBe(firstLiker.id);
  });

  it("routes reply notifications to the immediate parent's author across nested replies", async () => {
    const postAuthor = await insertAccount();
    const topLevelCommenter = await insertAccount();
    const firstReplier = await insertAccount();
    const secondReplier = await insertAccount();
    const post = await createContentPost(postAuthor.id, {
      category: "chat",
      title: "İç içe yanıt testi",
      body: "",
      isAnonymous: false,
    });

    const topLevelComment = await createContentComment(
      topLevelCommenter.id,
      post.id,
      { body: "İlk yorum.", isAnonymous: false },
    );
    const reply = await createContentComment(firstReplier.id, post.id, {
      body: "İlk yoruma yanıt.",
      isAnonymous: false,
      parentId: topLevelComment.id,
    });
    await createContentComment(secondReplier.id, post.id, {
      body: "İkinci yanıt.",
      isAnonymous: false,
      parentId: reply.id,
    });

    const postAuthorNotifications = await fetchNotificationsFor(
      postAuthor.id,
    );
    expect(postAuthorNotifications).toHaveLength(1);
    expect(postAuthorNotifications[0]).toMatchObject({ kind: "comment" });

    const topLevelCommenterNotifications = await fetchNotificationsFor(
      topLevelCommenter.id,
    );
    expect(topLevelCommenterNotifications).toHaveLength(1);
    expect(topLevelCommenterNotifications[0]).toMatchObject({
      kind: "reply",
      actor_id: firstReplier.id,
    });

    const firstReplierNotifications = await fetchNotificationsFor(
      firstReplier.id,
    );
    expect(firstReplierNotifications).toHaveLength(1);
    expect(firstReplierNotifications[0]).toMatchObject({
      kind: "reply",
      actor_id: secondReplier.id,
    });
  });

  it("resolves mentions, dedupes repeats, and skips self and unknown usernames", async () => {
    const postAuthor = await insertAccount();
    const commenter = await insertAccount();
    const mentioned = await insertAccount();
    const post = await createContentPost(postAuthor.id, {
      category: "chat",
      title: "Mention testi",
      body: "",
      isAnonymous: false,
    });

    await createContentComment(commenter.id, post.id, {
      body: `@${mentioned.username} ve @${mentioned.username} tekrar, @${commenter.username} kendine, @does-not-exist bilinmiyor.`,
      isAnonymous: false,
    });

    const mentionedNotifications = await fetchNotificationsFor(
      mentioned.id,
    );
    expect(
      mentionedNotifications.filter((row) => row.kind === "mention"),
    ).toHaveLength(1);

    const commenterNotifications = await fetchNotificationsFor(
      commenter.id,
    );
    expect(
      commenterNotifications.filter((row) => row.kind === "mention"),
    ).toHaveLength(0);
  });

  it("marks a single notification as read idempotently and lists it via the route", async () => {
    const postAuthor = await insertAccount();
    const follower = await insertAccount();
    await createContentPost(postAuthor.id, {
      category: "chat",
      title: "Takip edilen gönderi",
      body: "",
      isAnonymous: false,
    });
    const followerCookie = await createMemberCookie(follower.id);
    await postFollow(
      jsonRequest(`/v1/users/${postAuthor.username}/follow`, "POST", {
        cookie: followerCookie,
      }),
      { params: Promise.resolve({ username: postAuthor.username }) },
    );

    const authorCookie = await createMemberCookie(postAuthor.id);
    const listResponse = await getNotifications(
      plainRequest("/v1/me/notifications", { cookie: authorCookie }),
    );
    const { data: notifications } = (await listResponse.json()) as {
      data: Array<{ id: string; kind: string; isRead: boolean }>;
    };
    const followNotification = notifications.find(
      (notification) => notification.kind === "follow",
    );
    expect(followNotification).toBeDefined();
    expect(followNotification!.isRead).toBe(false);

    const unreadBefore = await getUnreadCount(
      plainRequest("/v1/me/notifications/unread-count", {
        cookie: authorCookie,
      }),
    );
    await expect(unreadBefore.json()).resolves.toEqual({
      data: { count: 1 },
    });

    const readResponse = await patchNotificationRead(
      jsonRequest(
        `/v1/me/notifications/${followNotification!.id}/read`,
        "PATCH",
        { cookie: authorCookie },
      ),
      { params: Promise.resolve({ id: followNotification!.id }) },
    );
    expect(readResponse.status).toBe(204);

    const repeatReadResponse = await patchNotificationRead(
      jsonRequest(
        `/v1/me/notifications/${followNotification!.id}/read`,
        "PATCH",
        { cookie: authorCookie },
      ),
      { params: Promise.resolve({ id: followNotification!.id }) },
    );
    expect(repeatReadResponse.status).toBe(204);

    const unreadAfter = await getUnreadCount(
      plainRequest("/v1/me/notifications/unread-count", {
        cookie: authorCookie,
      }),
    );
    await expect(unreadAfter.json()).resolves.toEqual({ data: { count: 0 } });
  });

  it("marks all notifications as read and leaves already-read rows untouched", async () => {
    const postAuthor = await insertAccount();
    const firstFollower = await insertAccount();
    const secondFollower = await insertAccount();
    await createContentPost(postAuthor.id, {
      category: "chat",
      title: "Çoklu takip testi",
      body: "",
      isAnonymous: false,
    });
    const authorCookie = await createMemberCookie(postAuthor.id);

    await postFollow(
      jsonRequest(`/v1/users/${postAuthor.username}/follow`, "POST", {
        cookie: await createMemberCookie(firstFollower.id),
      }),
      { params: Promise.resolve({ username: postAuthor.username }) },
    );
    await postFollow(
      jsonRequest(`/v1/users/${postAuthor.username}/follow`, "POST", {
        cookie: await createMemberCookie(secondFollower.id),
      }),
      { params: Promise.resolve({ username: postAuthor.username }) },
    );

    const readAllResponse = await postReadAll(
      jsonRequest("/v1/me/notifications/read-all", "POST", {
        cookie: authorCookie,
      }),
    );
    expect(readAllResponse.status).toBe(200);
    await expect(readAllResponse.json()).resolves.toEqual({
      data: { markedCount: 2 },
    });

    const repeatResponse = await postReadAll(
      jsonRequest("/v1/me/notifications/read-all", "POST", {
        cookie: authorCookie,
      }),
    );
    await expect(repeatResponse.json()).resolves.toEqual({
      data: { markedCount: 0 },
    });
  });

  it("does not create a duplicate follow notification for a repeat follow", async () => {
    const target = await insertAccount();
    const follower = await insertAccount();
    await createContentPost(target.id, {
      category: "chat",
      title: "Tekrar takip testi",
      body: "",
      isAnonymous: false,
    });
    const followerCookie = await createMemberCookie(follower.id);

    await postFollow(
      jsonRequest(`/v1/users/${target.username}/follow`, "POST", {
        cookie: followerCookie,
      }),
      { params: Promise.resolve({ username: target.username }) },
    );
    await postFollow(
      jsonRequest(`/v1/users/${target.username}/follow`, "POST", {
        cookie: followerCookie,
      }),
      { params: Promise.resolve({ username: target.username }) },
    );

    const rows = await fetchNotificationsFor(target.id);
    expect(rows.filter((row) => row.kind === "follow")).toHaveLength(1);

    await deleteFollow(
      jsonRequest(`/v1/users/${target.username}/follow`, "DELETE", {
        cookie: followerCookie,
      }),
      { params: Promise.resolve({ username: target.username }) },
    );
  });

  it("rejects cross-origin mutations and unauthenticated requests", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);

    const crossOriginRead = await patchNotificationRead(
      jsonRequest(
        `/v1/me/notifications/${randomUUID()}/read`,
        "PATCH",
        { cookie, origin: "https://attacker.example" },
      ),
      { params: Promise.resolve({ id: randomUUID() }) },
    );
    expect(crossOriginRead.status).toBe(403);

    const crossOriginReadAll = await postReadAll(
      jsonRequest("/v1/me/notifications/read-all", "POST", {
        cookie,
        origin: "https://attacker.example",
      }),
    );
    expect(crossOriginReadAll.status).toBe(403);

    const unauthenticatedList = await getNotifications(
      plainRequest("/v1/me/notifications"),
    );
    expect(unauthenticatedList.status).toBe(401);
  });
});
