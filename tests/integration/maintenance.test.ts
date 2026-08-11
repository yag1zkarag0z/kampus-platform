import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  MAINTENANCE_LOCK_NAME,
  runMaintenance,
} from "@/server/maintenance/service";
import type {
  MediaStorage,
  StoredObjectMetadata,
} from "@/server/media/storage-core";

const DAY = 24 * 60 * 60 * 1_000;
const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});
const testUserIds = new Set<string>();
const testOtpIds = new Set<string>();

function before(now: Date, milliseconds: number) {
  return new Date(now.getTime() - milliseconds);
}

function tokenHash() {
  return randomUUID().replaceAll("-", "").repeat(2);
}

class MemoryStorage implements MediaStorage {
  private readonly objects = new Map<
    string,
    {
      body: Buffer;
      contentType: string;
      lastModified: Date;
    }
  >();

  seed(
    key: string,
    body: Buffer,
    lastModified: Date,
    contentType = key.endsWith(".pdf")
      ? "application/pdf"
      : "image/webp",
  ) {
    this.objects.set(key, { body, contentType, lastModified });
  }

  has(key: string) {
    return this.objects.has(key);
  }

  async put(key: string, body: Buffer, contentType: string) {
    this.seed(key, body, new Date(), contentType);
  }

  async get(key: string) {
    const object = this.objects.get(key);

    return object
      ? { body: object.body, contentType: object.contentType }
      : null;
  }

  async delete(key: string) {
    this.objects.delete(key);
  }

  async *list(): AsyncIterable<StoredObjectMetadata> {
    for (const [key, object] of this.objects) {
      yield {
        key,
        lastModified: object.lastModified,
        sizeBytes: object.body.length,
      };
    }
  }
}

async function insertUser(
  label: string,
  createdAt: Date,
  deletedAt: Date | null = null,
) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentNumber = BigInt(`0x${suffix}`).toString();
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email, username, display_name, department, year_label,
      created_at, deleted_at
    ) values ($1, $2, $3, 'Test Department', '2. sınıf', $4, $5)
    returning id`,
    [
      `${studentNumber}@stu.yasar.edu.tr`,
      `m${suffix}`,
      label,
      createdAt,
      deletedAt,
    ],
  );
  const id = result.rows[0]!.id;

  testUserIds.add(id);
  return id;
}

async function rowExists(table: string, id: string) {
  const allowedTables = new Set([
    "otp_challenges",
    "sessions",
    "rate_limit_hits",
    "notifications",
    "posts",
    "media_assets",
    "document_assets",
    "users",
    "reports",
    "moderation_actions",
    "direct_conversations",
  ]);

  if (!allowedTables.has(table)) throw new Error("Unsafe test table name.");

  const result = await pool.query(
    `select 1 from ${table} where id = $1`,
    [id],
  );

  return result.rowCount === 1;
}

afterEach(async () => {
  if (testOtpIds.size > 0) {
    await pool.query("delete from otp_challenges where id = any($1::uuid[])", [
      [...testOtpIds],
    ]);
    testOtpIds.clear();
  }

  if (testUserIds.size > 0) {
    const userIds = [...testUserIds];

    await pool.query(
      `delete from comments
       where author_id = any($1::uuid[])
          or post_id in (
            select id from posts where author_id = any($1::uuid[])
          )`,
      [userIds],
    );
    await pool.query("delete from posts where author_id = any($1::uuid[])", [
      userIds,
    ]);
    await pool.query("delete from users where id = any($1::uuid[])", [
      userIds,
    ]);
    testUserIds.clear();
  }
});

afterAll(async () => {
  await pool.end();
});

describe("maintenance worker with PostgreSQL", () => {
  it("skips safely when another worker owns the advisory lock", async () => {
    const lockClient = await pool.connect();

    try {
      await lockClient.query(
        "select pg_advisory_lock(hashtextextended($1, 0))",
        [MAINTENANCE_LOCK_NAME],
      );

      const report = await runMaintenance({
        mode: "cleanup",
        pool,
        storage: new MemoryStorage(),
      });

      expect(report.status).toBe("skipped_locked");
      expect(report.cleanup.storageDeleteRequests).toBe(0);
    } finally {
      await lockClient.query(
        "select pg_advisory_unlock(hashtextextended($1, 0))",
        [MAINTENANCE_LOCK_NAME],
      );
      lockClient.release();
    }
  });

  it("applies retention in batches and reconciles both storage directions", async () => {
    const now = new Date("2026-08-08T12:00:00.000Z");
    const ownerId = await insertUser("Maintenance Owner", before(now, 200 * DAY));
    const actorId = await insertUser("Maintenance Actor", before(now, 200 * DAY));
    const deletedUserId = await insertUser(
      "Deleted Maintenance User",
      before(now, 40 * DAY),
      before(now, 31 * DAY),
    );
    const storage = new MemoryStorage();
    const oldEmptyConversationId = randomUUID();
    await pool.query(
      `insert into direct_conversations (
        id, participant_low_id, participant_high_id, created_by_id,
        request_resolved_at, created_at
      ) values (
        $1, least($2::uuid, $3::uuid), greatest($2::uuid, $3::uuid),
        $2, $4, $4
      )`,
      [oldEmptyConversationId, ownerId, actorId, before(now, 8 * DAY)],
    );
    await pool.query(
      `insert into direct_message_request_cooldowns (
        sender_id, recipient_id, rejected_at, cooldown_until
      ) values ($1, $2, $3, $4)`,
      [
        ownerId,
        actorId,
        before(now, 31 * DAY),
        before(now, DAY),
      ],
    );
    const oldOtpId = randomUUID();
    const freshOtpId = randomUUID();
    const oldOtpCreatedAt = before(now, 2 * DAY);
    const freshOtpCreatedAt = before(now, 10 * 60 * 1_000);

    testOtpIds.add(oldOtpId);
    testOtpIds.add(freshOtpId);
    await pool.query(
      `insert into otp_challenges (
        id, email, purpose, code_hash, request_ip_hash,
        expires_at, resend_available_at, created_at
      ) values
        ($1, $2, 'login', $3, $4, $5, $6, $7),
        ($8, $9, 'login', $10, $11, $12, $13, $14)`,
      [
        oldOtpId,
        `${Date.now()}01@stu.yasar.edu.tr`,
        tokenHash(),
        tokenHash(),
        new Date(oldOtpCreatedAt.getTime() + 4 * 60 * 1_000),
        new Date(oldOtpCreatedAt.getTime() + 30 * 1_000),
        oldOtpCreatedAt,
        freshOtpId,
        `${Date.now()}02@stu.yasar.edu.tr`,
        tokenHash(),
        tokenHash(),
        new Date(freshOtpCreatedAt.getTime() + 4 * 60 * 1_000),
        new Date(freshOtpCreatedAt.getTime() + 30 * 1_000),
        freshOtpCreatedAt,
      ],
    );

    const oldSessionId = randomUUID();
    const freshSessionId = randomUUID();
    await pool.query(
      `insert into sessions (
        id, user_id, token_hash, issued_role, expires_at, created_at
      ) values
        ($1, $2, $3, 'member', $4, $5),
        ($6, $2, $7, 'member', $8, $9)`,
      [
        oldSessionId,
        ownerId,
        tokenHash(),
        before(now, 10 * DAY),
        before(now, 40 * DAY),
        freshSessionId,
        tokenHash(),
        new Date(now.getTime() + 29 * DAY),
        before(now, DAY),
      ],
    );

    const oldRateLimitId = randomUUID();
    const freshRateLimitId = randomUUID();
    const oldUsernameRateLimitId = randomUUID();
    const recentUsernameRateLimitId = randomUUID();
    await pool.query(
      `insert into rate_limit_hits (id, user_id, action, created_at)
       values
        ($1, $2, 'interaction', $3),
        ($4, $2, 'interaction', $5),
        ($6, $2, 'username_change', $7),
        ($8, $2, 'username_change', $9)`,
      [
        oldRateLimitId,
        ownerId,
        before(now, 3 * DAY),
        freshRateLimitId,
        now,
        oldUsernameRateLimitId,
        before(now, 32 * DAY),
        recentUsernameRateLimitId,
        before(now, 30 * DAY),
      ],
    );

    const oldNotificationId = randomUUID();
    const freshNotificationId = randomUUID();
    await pool.query(
      `insert into notifications (
        id, recipient_id, actor_id, kind, created_at
      ) values
        ($1, $2, $3, 'follow', $4),
        ($5, $2, $3, 'follow', $6)`,
      [
        oldNotificationId,
        ownerId,
        actorId,
        before(now, 91 * DAY),
        freshNotificationId,
        now,
      ],
    );

    const oldPostId = randomUUID();
    const freshPostId = randomUUID();
    await pool.query(
      `insert into posts (
        id, author_id, category, title, body, created_at, deleted_at
      ) values
        ($1, $2, 'chat', 'Old maintenance post', '', $3, $4),
        ($5, $2, 'chat', 'Fresh maintenance post', '', $6, null)`,
      [
        oldPostId,
        ownerId,
        before(now, 40 * DAY),
        before(now, 31 * DAY),
        freshPostId,
        now,
      ],
    );

    const oldImageId = randomUUID();
    const oldImageKey = `images/${ownerId}/${oldImageId}.webp`;
    const freshImageId = randomUUID();
    const freshImageKey = `images/${ownerId}/${freshImageId}.webp`;
    await pool.query(
      `insert into media_assets (
        id, owner_id, storage_key, mime_type, size_bytes,
        width, height, checksum, created_at
      ) values
        ($1, $2, $3, 'image/webp', 4, 1, 1, $4, $5),
        ($6, $2, $7, 'image/webp', 4, 1, 1, $8, $9)`,
      [
        oldImageId,
        ownerId,
        oldImageKey,
        "0".repeat(64),
        before(now, 40 * DAY),
        freshImageId,
        freshImageKey,
        "1".repeat(64),
        now,
      ],
    );
    await pool.query(
      `insert into post_images (post_id, asset_id, alt)
       values ($1, $2, 'Maintenance image')`,
      [oldPostId, oldImageId],
    );
    storage.seed(oldImageKey, Buffer.alloc(4), before(now, 40 * DAY));
    storage.seed(freshImageKey, Buffer.alloc(4), now);

    const missingDocumentId = randomUUID();
    const missingDocumentKey = `documents/${ownerId}/${missingDocumentId}.pdf`;
    await pool.query(
      `insert into document_assets (
        id, owner_id, storage_key, mime_type, size_bytes,
        file_name, checksum, created_at
      ) values ($1, $2, $3, 'application/pdf', 8, 'missing.pdf', $4, $5)`,
      [
        missingDocumentId,
        ownerId,
        missingDocumentKey,
        "2".repeat(64),
        before(now, 25 * 60 * 60 * 1_000),
      ],
    );
    await pool.query(
      "insert into post_documents (post_id, asset_id) values ($1, $2)",
      [freshPostId, missingDocumentId],
    );

    const missingAvatarKey = `images/${ownerId}/${randomUUID()}.webp`;
    await pool.query(
      "update users set avatar_object_key = $1 where id = $2",
      [missingAvatarKey, ownerId],
    );

    const orphanKey = `images/${randomUUID()}/${randomUUID()}.webp`;
    const freshOrphanKey = `documents/${randomUUID()}/${randomUUID()}.pdf`;
    storage.seed(orphanKey, Buffer.from("orphan"), before(now, 25 * 60 * 60 * 1_000));
    storage.seed(freshOrphanKey, Buffer.from("fresh"), now);

    const dryRun = await runMaintenance({
      now,
      dryRun: true,
      batchSize: 1,
      pool,
      storage,
    });

    expect(dryRun).toMatchObject({
      status: "completed",
      dryRun: true,
      cleanup: {
        otpChallenges: expect.any(Number),
        posts: expect.any(Number),
      },
      reconciliation: {
        orphanObjectsFound: 1,
        orphanObjectsDeleted: 0,
        missingDocumentAssets: 1,
        missingAvatars: 1,
        databaseReferencesRepaired: 0,
      },
    });
    expect(await rowExists("posts", oldPostId)).toBe(true);
    expect(storage.has(orphanKey)).toBe(true);

    const report = await runMaintenance({
      now,
      batchSize: 1,
      pool,
      storage,
    });

    expect(report.status).toBe("completed");
    expect(report.cleanup).toMatchObject({
      otpChallenges: 1,
      sessions: 1,
      rateLimitHits: 2,
      notifications: 1,
      emptyConversations: 1,
      messageRequestCooldowns: 1,
      posts: 1,
      mediaAssets: 1,
      users: 1,
      storageDeleteFailures: 0,
    });
    expect(report.reconciliation).toMatchObject({
      orphanObjectsFound: 1,
      orphanObjectsDeleted: 1,
      orphanDeleteFailures: 0,
      missingDocumentAssets: 1,
      missingAvatars: 1,
      databaseReferencesRepaired: 2,
      sizeMismatches: 0,
    });

    await expect(rowExists("otp_challenges", oldOtpId)).resolves.toBe(false);
    await expect(rowExists("otp_challenges", freshOtpId)).resolves.toBe(true);
    await expect(rowExists("sessions", oldSessionId)).resolves.toBe(false);
    await expect(rowExists("sessions", freshSessionId)).resolves.toBe(true);
    await expect(rowExists("rate_limit_hits", oldRateLimitId)).resolves.toBe(false);
    await expect(rowExists("rate_limit_hits", freshRateLimitId)).resolves.toBe(true);
    await expect(
      rowExists("rate_limit_hits", oldUsernameRateLimitId),
    ).resolves.toBe(false);
    await expect(
      rowExists("rate_limit_hits", recentUsernameRateLimitId),
    ).resolves.toBe(true);
    await expect(rowExists("notifications", oldNotificationId)).resolves.toBe(false);
    await expect(rowExists("notifications", freshNotificationId)).resolves.toBe(true);
    await expect(
      rowExists("direct_conversations", oldEmptyConversationId),
    ).resolves.toBe(false);
    const remainingRequestCooldowns = await pool.query(
      `select 1 from direct_message_request_cooldowns
       where sender_id = $1 and recipient_id = $2`,
      [ownerId, actorId],
    );
    expect(remainingRequestCooldowns.rowCount).toBe(0);
    await expect(rowExists("posts", oldPostId)).resolves.toBe(false);
    await expect(rowExists("posts", freshPostId)).resolves.toBe(true);
    await expect(rowExists("media_assets", oldImageId)).resolves.toBe(false);
    await expect(rowExists("media_assets", freshImageId)).resolves.toBe(true);
    await expect(rowExists("document_assets", missingDocumentId)).resolves.toBe(false);
    await expect(rowExists("users", deletedUserId)).resolves.toBe(false);

    const owner = await pool.query<{ avatar_object_key: string | null }>(
      "select avatar_object_key from users where id = $1",
      [ownerId],
    );
    expect(owner.rows[0]?.avatar_object_key).toBeNull();
    expect(storage.has(oldImageKey)).toBe(false);
    expect(storage.has(orphanKey)).toBe(false);
    expect(storage.has(freshImageKey)).toBe(true);
    expect(storage.has(freshOrphanKey)).toBe(true);

    const secondRun = await runMaintenance({
      now,
      batchSize: 1,
      pool,
      storage,
    });

    expect(secondRun.reconciliation).toMatchObject({
      orphanObjectsFound: 0,
      missingMediaAssets: 0,
      missingDocumentAssets: 0,
      missingAvatars: 0,
      databaseReferencesRepaired: 0,
    });
  });

  it("retains deleted content and accounts until moderation audit expires", async () => {
    const now = new Date("2026-08-08T12:00:00.000Z");
    const ownerId = await insertUser(
      "Audit Target",
      before(now, 600 * DAY),
      before(now, 31 * DAY),
    );
    const reporterId = await insertUser(
      "Audit Reporter",
      before(now, 600 * DAY),
    );
    const moderatorId = await insertUser(
      "Audit Moderator",
      before(now, 600 * DAY),
    );
    const postId = randomUUID();
    const reportId = randomUUID();
    const actionId = randomUUID();

    await pool.query(
      `insert into posts (
        id, author_id, category, title, body, created_at, deleted_at
      ) values ($1, $2, 'chat', 'Audited deleted post', '', $3, $4)`,
      [postId, ownerId, before(now, 500 * DAY), before(now, 31 * DAY)],
    );
    await pool.query(
      `insert into reports (
        id, reporter_id, target_type, target_id, post_id, reason,
        status, resolution, resolution_note, resolved_by,
        resolved_at, created_at
      ) values (
        $1, $2, 'post', $3, $3, 'spam',
        'resolved', 'content_removed', 'Confirmed', $4, $5, $6
      )`,
      [
        reportId,
        reporterId,
        postId,
        moderatorId,
        before(now, 10 * DAY),
        before(now, 20 * DAY),
      ],
    );
    await pool.query(
      `insert into moderation_actions (
        id, actor_id, action, report_id, target_user_id, post_id, created_at
      ) values ($1, $2, 'content_removed', $3, $4, $5, $6)`,
      [
        actionId,
        moderatorId,
        reportId,
        ownerId,
        postId,
        before(now, 10 * DAY),
      ],
    );

    const retained = await runMaintenance({
      now,
      mode: "cleanup",
      batchSize: 1,
      pool,
      storage: new MemoryStorage(),
    });

    expect(retained.cleanup).toMatchObject({
      moderationActions: 0,
      reports: 0,
      posts: 0,
      users: 0,
    });
    await expect(rowExists("posts", postId)).resolves.toBe(true);
    await expect(rowExists("users", ownerId)).resolves.toBe(true);

    const expired = await runMaintenance({
      now: new Date(now.getTime() + 366 * DAY),
      mode: "cleanup",
      batchSize: 1,
      pool,
      storage: new MemoryStorage(),
    });

    expect(expired.cleanup).toMatchObject({
      moderationActions: 1,
      reports: 1,
      posts: 1,
      users: 1,
    });
    await expect(rowExists("moderation_actions", actionId)).resolves.toBe(false);
    await expect(rowExists("reports", reportId)).resolves.toBe(false);
    await expect(rowExists("posts", postId)).resolves.toBe(false);
    await expect(rowExists("users", ownerId)).resolves.toBe(false);
  });
});
