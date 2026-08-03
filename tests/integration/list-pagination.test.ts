import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { listNotifications } from "@/server/notifications/service";
import {
  getModerationHistory,
  listBlockedUsers,
  listManagedUsers,
  listReports,
} from "@/server/moderation/service";
import { listFollowers, listFollowing } from "@/server/social/service";
import { AuthError, type AuthErrorCode } from "@/server/auth/errors";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

const testUserIds = new Set<string>();

async function insertUser(
  label = "Pagination User",
  overrides: { role?: "member" | "moderator" | "admin" } = {},
) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentNumber = BigInt(`0x${suffix}`).toString();
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email, username, display_name, department, year_label, role
    ) values ($1, $2, $3, $4, $5, $6)
    returning id`,
    [
      `${studentNumber}@stu.yasar.edu.tr`,
      `p${suffix}`,
      label,
      "Software Engineering",
      "2. sinif",
      overrides.role ?? "member",
    ],
  );
  const id = result.rows[0]!.id;

  testUserIds.add(id);

  return { id, username: `p${suffix}` };
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

/**
 * Cursor'ı sonuna kadar takip eder ve her sayfanın beklenen boyutta
 * olduğunu doğrular; böylece atlanan ya da tekrarlanan kayıt yakalanır.
 */
async function collectAllPages<TItem extends { id: string }>(
  fetchPage: (cursor?: string) => Promise<{
    data: TItem[];
    page: { nextCursor: string | null; hasMore: boolean };
  }>,
  maxPages = 10,
) {
  const seenIds: string[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const page = await fetchPage(cursor);

    seenIds.push(...page.data.map((item) => item.id));
    cursor = page.page.nextCursor ?? undefined;
    pageCount += 1;

    if (pageCount > maxPages) {
      throw new Error("Sayfalama sonlanmadı.");
    }
  } while (cursor);

  return { seenIds, pageCount };
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
  await pool.query(
    "delete from moderation_actions where actor_id = any($1::uuid[])",
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

describe("liste sayfalaması", () => {
  it("bildirimleri cursor ile eksiksiz sayfalar", async () => {
    const recipient = await insertUser("Notification Recipient");
    const actors = await Promise.all(
      Array.from({ length: 5 }, (_unused, index) =>
        insertUser(`Notification Actor ${index}`),
      ),
    );

    for (const [index, actor] of actors.entries()) {
      await pool.query(
        `insert into notifications (recipient_id, actor_id, kind, created_at)
         values ($1, $2, 'follow', now() - ($3 || ' minutes')::interval)`,
        [recipient.id, actor.id, String(index)],
      );
    }

    const { seenIds, pageCount } = await collectAllPages((cursor) =>
      listNotifications(recipient.id, { cursor, limit: 2 }),
    );

    expect(seenIds).toHaveLength(actors.length);
    expect(new Set(seenIds).size).toBe(seenIds.length);
    expect(pageCount).toBe(3);
  });

  it("aynı anda üretilen bildirimlerde de kayıt atlamaz", async () => {
    const recipient = await insertUser("Tie Recipient");
    const actors = await Promise.all(
      Array.from({ length: 4 }, (_unused, index) =>
        insertUser(`Tie Actor ${index}`),
      ),
    );

    for (const actor of actors) {
      await pool.query(
        `insert into notifications (recipient_id, actor_id, kind, created_at)
         values ($1, $2, 'follow', '2026-08-01T10:00:00.000Z')`,
        [recipient.id, actor.id],
      );
    }

    const { seenIds } = await collectAllPages((cursor) =>
      listNotifications(recipient.id, { cursor, limit: 2 }),
    );

    expect(seenIds).toHaveLength(actors.length);
    expect(new Set(seenIds).size).toBe(seenIds.length);
  });

  it("takipçi ve takip listelerini sayfalar", async () => {
    const owner = await insertUser("Follow List Owner");
    const viewer = await insertUser("Follow List Viewer");
    const others = await Promise.all(
      Array.from({ length: 5 }, (_unused, index) =>
        insertUser(`Follow Member ${index}`),
      ),
    );

    for (const other of others) {
      await pool.query(
        `insert into follows (follower_id, following_id) values ($1, $2)`,
        [other.id, owner.id],
      );
      await pool.query(
        `insert into follows (follower_id, following_id) values ($1, $2)`,
        [owner.id, other.id],
      );
    }

    const followers = await collectAllPages((cursor) =>
      listFollowers(viewer.id, owner.username, { cursor, limit: 2 }),
    );
    const following = await collectAllPages((cursor) =>
      listFollowing(viewer.id, owner.username, { cursor, limit: 2 }),
    );

    expect(followers.seenIds).toHaveLength(others.length);
    expect(new Set(followers.seenIds).size).toBe(others.length);
    expect(following.seenIds).toHaveLength(others.length);
    expect(new Set(following.seenIds).size).toBe(others.length);
  });

  it("takipçi cursor'ını başka bir profilde kullandırmaz", async () => {
    const firstOwner = await insertUser("Cursor Owner One");
    const secondOwner = await insertUser("Cursor Owner Two");
    const viewer = await insertUser("Cursor Viewer");
    const members = await Promise.all(
      Array.from({ length: 3 }, (_unused, index) =>
        insertUser(`Cursor Member ${index}`),
      ),
    );

    for (const member of members) {
      await pool.query(
        `insert into follows (follower_id, following_id) values ($1, $2)`,
        [member.id, firstOwner.id],
      );
      await pool.query(
        `insert into follows (follower_id, following_id) values ($1, $2)`,
        [member.id, secondOwner.id],
      );
    }

    const firstPage = await listFollowers(viewer.id, firstOwner.username, {
      limit: 2,
    });
    const cursor = firstPage.page.nextCursor;

    if (!cursor) {
      throw new Error("Cursor bekleniyordu.");
    }

    await expectAuthError(
      () =>
        listFollowers(viewer.id, secondOwner.username, { cursor, limit: 2 }),
      "INVALID_REQUEST",
      400,
    );
  });

  it("engellenen kullanıcı listesini sayfalar", async () => {
    const blocker = await insertUser("Block List Owner");
    const blocked = await Promise.all(
      Array.from({ length: 5 }, (_unused, index) =>
        insertUser(`Blocked Member ${index}`),
      ),
    );

    for (const user of blocked) {
      await pool.query(
        "insert into blocks (blocker_id, blocked_id) values ($1, $2)",
        [blocker.id, user.id],
      );
    }

    const { seenIds } = await collectAllPages((cursor) =>
      listBlockedUsers(blocker.id, { cursor, limit: 2 }),
    );

    expect(seenIds).toHaveLength(blocked.length);
    expect(new Set(seenIds).size).toBe(blocked.length);
  });

  it("şikâyet listesini sayfalar ve cursor'ı duruma bağlar", async () => {
    const author = await insertUser("Report Post Author");
    const reporters = await Promise.all(
      Array.from({ length: 5 }, (_unused, index) =>
        insertUser(`Reporter ${index}`),
      ),
    );
    const post = await pool.query<{ id: string }>(
      `insert into posts (author_id, category, title, body)
       values ($1, 'chat', 'Şikâyet edilen gönderi', '')
       returning id`,
      [author.id],
    );
    const postId = post.rows[0]!.id;

    for (const reporter of reporters) {
      await pool.query(
        `insert into reports (
           reporter_id, target_type, target_id, post_id, reason, detail
         ) values ($1, 'post', $2, $2, 'spam', '')`,
        [reporter.id, postId],
      );
    }

    const firstPage = await listReports("pending", { limit: 2 });

    expect(firstPage.data).toHaveLength(2);
    expect(firstPage.page.hasMore).toBe(true);

    const cursor = firstPage.page.nextCursor;

    if (!cursor) {
      throw new Error("Şikâyet cursor'ı bekleniyordu.");
    }

    // Bekleyen listesinin cursor'ı çözülmüş listesinde geçersiz olmalı.
    await expectAuthError(
      () => listReports("resolved", { cursor, limit: 2 }),
      "INVALID_REQUEST",
      400,
    );

    const secondPage = await listReports("pending", { cursor, limit: 2 });

    expect(secondPage.data).toHaveLength(2);
    expect(
      secondPage.data.every(
        (report) => !firstPage.data.some((first) => first.id === report.id),
      ),
    ).toBe(true);
  });

  it("moderasyon kullanıcı ve geçmiş listelerini sayfalar", async () => {
    const moderator = await insertUser("History Moderator", {
      role: "moderator",
    });
    const targets = await Promise.all(
      Array.from({ length: 4 }, (_unused, index) =>
        insertUser(`Managed User ${index}`, { role: "moderator" }),
      ),
    );

    for (const target of targets) {
      await pool.query(
        `insert into moderation_actions (actor_id, action, target_user_id)
         values ($1, 'user_suspended', $2)`,
        [moderator.id, target.id],
      );
    }

    const users = await collectAllPages((cursor) =>
      listManagedUsers({ cursor, limit: 2 }),
    );
    const history = await collectAllPages((cursor) =>
      getModerationHistory({ cursor, limit: 2 }),
    );

    // Başka testlerden kalan kayıtlar olabilir; kendi eklediklerimizin
    // hepsinin göründüğünü ve tekrarlanmadığını doğrulamak yeterli.
    expect(new Set(users.seenIds).size).toBe(users.seenIds.length);
    expect(new Set(history.seenIds).size).toBe(history.seenIds.length);

    for (const target of [moderator, ...targets]) {
      expect(users.seenIds).toContain(target.id);
    }
  });
});
