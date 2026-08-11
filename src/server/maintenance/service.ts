import { Pool, type PoolClient } from "pg";

import { getServerEnvironment } from "@/server/env";
import {
  createMediaStorage,
  type MediaStorage,
} from "@/server/media/storage-core";

import {
  DATA_RETENTION_POLICY,
  retentionCutoff,
  type DataRetentionPolicy,
} from "./policy";

export const MAINTENANCE_LOCK_NAME = "kampus-maintenance-v1";
const BATCH_MARKER = "__BATCH_SIZE__";

export type MaintenanceMode = "all" | "cleanup" | "reconcile";

export type CleanupReport = {
  otpChallenges: number;
  sessions: number;
  rateLimitHits: number;
  notifications: number;
  emptyConversations: number;
  messageRequestCooldowns: number;
  moderationActions: number;
  reports: number;
  posts: number;
  comments: number;
  mediaAssets: number;
  documentAssets: number;
  users: number;
  storageDeleteRequests: number;
  storageDeleteFailures: number;
};

export type ReconciliationReport = {
  storageObjectsScanned: number;
  orphanObjectsFound: number;
  orphanObjectsDeleted: number;
  orphanDeleteFailures: number;
  missingMediaAssets: number;
  missingDocumentAssets: number;
  missingAvatars: number;
  databaseReferencesRepaired: number;
  sizeMismatches: number;
};

export type MaintenanceReport = {
  status: "completed" | "skipped_locked";
  mode: MaintenanceMode;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  cleanup: CleanupReport;
  reconciliation: ReconciliationReport;
};

type RunMaintenanceOptions = {
  now?: Date;
  dryRun?: boolean;
  mode?: MaintenanceMode;
  batchSize?: number;
  pool?: Pool;
  storage?: MediaStorage;
  policy?: DataRetentionPolicy;
};

type AssetRow = {
  id: string;
  storage_key: string;
  size_bytes: number;
  created_at: Date;
  kind: "image" | "document";
};

type AvatarRow = {
  id: string;
  storage_key: string;
};

function emptyCleanupReport(): CleanupReport {
  return {
    otpChallenges: 0,
    sessions: 0,
    rateLimitHits: 0,
    notifications: 0,
    emptyConversations: 0,
    messageRequestCooldowns: 0,
    moderationActions: 0,
    reports: 0,
    posts: 0,
    comments: 0,
    mediaAssets: 0,
    documentAssets: 0,
    users: 0,
    storageDeleteRequests: 0,
    storageDeleteFailures: 0,
  };
}

function emptyReconciliationReport(): ReconciliationReport {
  return {
    storageObjectsScanned: 0,
    orphanObjectsFound: 0,
    orphanObjectsDeleted: 0,
    orphanDeleteFailures: 0,
    missingMediaAssets: 0,
    missingDocumentAssets: 0,
    missingAvatars: 0,
    databaseReferencesRepaired: 0,
    sizeMismatches: 0,
  };
}

function validateBatchSize(batchSize: number) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1_000) {
    throw new Error("Maintenance batch size must be between 1 and 1000.");
  }

  return batchSize;
}

async function countCandidates(
  client: PoolClient,
  query: string,
  values: unknown[],
) {
  const result = await client.query<{ total: string }>(query, values);

  return Number(result.rows[0]?.total ?? 0);
}

async function deleteInBatches(
  client: PoolClient,
  query: string,
  values: unknown[],
  batchSize: number,
) {
  const batchQuery = query.replace(
    BATCH_MARKER,
    `$${values.length + 1}`,
  );
  let deleted = 0;

  while (true) {
    const result = await client.query(batchQuery, [...values, batchSize]);
    const batchDeleted = result.rowCount ?? 0;

    deleted += batchDeleted;
    if (batchDeleted < batchSize) return deleted;
  }
}

async function deleteAssetsInBatches(
  client: PoolClient,
  storage: MediaStorage,
  query: string,
  cutoff: Date,
  batchSize: number,
) {
  const batchQuery = query.replace(BATCH_MARKER, "$2");
  let deleted = 0;
  let storageDeleteRequests = 0;
  let storageDeleteFailures = 0;

  while (true) {
    const result = await client.query<{ storage_key: string }>(batchQuery, [
      cutoff,
      batchSize,
    ]);
    const batchDeleted = result.rowCount ?? 0;

    deleted += batchDeleted;

    for (const row of result.rows) {
      storageDeleteRequests += 1;

      try {
        await storage.delete(row.storage_key);
      } catch {
        // DB is the source of truth. A failed object deletion becomes an
        // orphan and is retried by reconciliation on the next worker pass.
        storageDeleteFailures += 1;
      }
    }

    if (batchDeleted < batchSize) {
      return { deleted, storageDeleteRequests, storageDeleteFailures };
    }
  }
}

async function runCleanup(
  client: PoolClient,
  storage: MediaStorage,
  now: Date,
  policy: DataRetentionPolicy,
  batchSize: number,
  dryRun: boolean,
): Promise<CleanupReport> {
  const report = emptyCleanupReport();
  const otpCutoff = retentionCutoff(
    now,
    policy.otpChallengeAfterExpiryMs,
  );
  const sessionCutoff = retentionCutoff(
    now,
    policy.sessionAfterInactiveMs,
  );
  const rateLimitCutoff = retentionCutoff(now, policy.rateLimitHitMs);
  const notificationCutoff = retentionCutoff(now, policy.notificationMs);
  const emptyConversationCutoff = retentionCutoff(
    now,
    policy.emptyConversationMs,
  );
  const auditCutoff = retentionCutoff(now, policy.moderationAuditMs);
  const contentCutoff = retentionCutoff(
    now,
    policy.softDeletedContentMs,
  );
  const accountCutoff = retentionCutoff(now, policy.deletedAccountMs);
  const uploadCutoff = retentionCutoff(now, policy.unattachedUploadMs);

  const simpleRules: Array<{
    key: keyof Pick<
      CleanupReport,
      | "otpChallenges"
      | "sessions"
      | "rateLimitHits"
      | "notifications"
      | "emptyConversations"
      | "messageRequestCooldowns"
      | "moderationActions"
      | "reports"
    >;
    cutoff: Date;
    count: string;
    remove: string;
  }> = [
    {
      key: "otpChallenges",
      cutoff: otpCutoff,
      count: "select count(*)::text as total from otp_challenges where expires_at <= $1",
      remove: `with candidates as (
        select id from otp_challenges
        where expires_at <= $1
        order by expires_at, id
        limit ${BATCH_MARKER}
        for update skip locked
      )
      delete from otp_challenges
      where id in (select id from candidates)
      returning id`,
    },
    {
      key: "sessions",
      cutoff: sessionCutoff,
      count: `select count(*)::text as total from sessions
        where expires_at <= $1 or (revoked_at is not null and revoked_at <= $1)`,
      remove: `with candidates as (
        select id from sessions
        where expires_at <= $1 or (revoked_at is not null and revoked_at <= $1)
        order by expires_at, id
        limit ${BATCH_MARKER}
        for update skip locked
      )
      delete from sessions where id in (select id from candidates)
      returning id`,
    },
    {
      key: "rateLimitHits",
      cutoff: rateLimitCutoff,
      count: "select count(*)::text as total from rate_limit_hits where created_at <= $1",
      remove: `with candidates as (
        select id from rate_limit_hits
        where created_at <= $1
        order by created_at, id
        limit ${BATCH_MARKER}
        for update skip locked
      )
      delete from rate_limit_hits where id in (select id from candidates)
      returning id`,
    },
    {
      key: "notifications",
      cutoff: notificationCutoff,
      count: "select count(*)::text as total from notifications where created_at <= $1",
      remove: `with candidates as (
        select id from notifications
        where created_at <= $1
        order by created_at, id
        limit ${BATCH_MARKER}
        for update skip locked
      )
      delete from notifications where id in (select id from candidates)
      returning id`,
    },
    {
      key: "emptyConversations",
      cutoff: emptyConversationCutoff,
      count: `select count(*)::text as total from direct_conversations
        where last_message_at is null and created_at <= $1`,
      remove: `with candidates as (
        select id from direct_conversations
        where last_message_at is null and created_at <= $1
        order by created_at, id
        limit ${BATCH_MARKER}
        for update skip locked
      )
      delete from direct_conversations
      where id in (select id from candidates)
      returning id`,
    },
    {
      key: "messageRequestCooldowns",
      cutoff: now,
      count: `select count(*)::text as total
        from direct_message_request_cooldowns
        where cooldown_until <= $1`,
      remove: `with candidates as (
        select sender_id, recipient_id
        from direct_message_request_cooldowns
        where cooldown_until <= $1
        order by cooldown_until, sender_id, recipient_id
        limit ${BATCH_MARKER}
        for update skip locked
      )
      delete from direct_message_request_cooldowns as cooldown
      using candidates
      where cooldown.sender_id = candidates.sender_id
        and cooldown.recipient_id = candidates.recipient_id
      returning cooldown.sender_id`,
    },
    {
      key: "moderationActions",
      cutoff: auditCutoff,
      count: "select count(*)::text as total from moderation_actions where created_at <= $1",
      remove: `with candidates as (
        select id from moderation_actions
        where created_at <= $1
        order by created_at, id
        limit ${BATCH_MARKER}
        for update skip locked
      )
      delete from moderation_actions where id in (select id from candidates)
      returning id`,
    },
    {
      key: "reports",
      cutoff: auditCutoff,
      count: `select count(*)::text as total from reports
        where status = 'resolved' and resolved_at <= $1`,
      remove: `with candidates as (
        select id from reports
        where status = 'resolved' and resolved_at <= $1
        order by resolved_at, id
        limit ${BATCH_MARKER}
        for update skip locked
      )
      delete from reports where id in (select id from candidates)
      returning id`,
    },
  ];

  for (const rule of simpleRules) {
    report[rule.key] = dryRun
      ? await countCandidates(client, rule.count, [rule.cutoff])
      : await deleteInBatches(
          client,
          rule.remove,
          [rule.cutoff],
          batchSize,
        );
  }

  const postFilter = `(
      (p.deleted_at is not null and p.deleted_at <= $1)
      or exists (
        select 1 from users author
        where author.id = p.author_id
          and author.deleted_at is not null
          and author.deleted_at <= $2
      )
    )
    and not exists (select 1 from reports r where r.post_id = p.id)`;
  const postCount = `select count(*)::text as total from posts p where ${postFilter}`;
  const postDelete = `with candidates as (
      select p.id from posts p
      where ${postFilter}
      order by coalesce(p.deleted_at, p.created_at), p.id
      limit ${BATCH_MARKER}
      for update skip locked
    )
    delete from posts where id in (select id from candidates)
    returning id`;

  report.posts = dryRun
    ? await countCandidates(client, postCount, [contentCutoff, accountCutoff])
    : await deleteInBatches(
        client,
        postDelete,
        [contentCutoff, accountCutoff],
        batchSize,
      );

  const commentFilter = `(
      (c.deleted_at is not null and c.deleted_at <= $1)
      or exists (
        select 1 from users author
        where author.id = c.author_id
          and author.deleted_at is not null
          and author.deleted_at <= $2
      )
    )
    and not exists (select 1 from comments child where child.parent_id = c.id)
    and not exists (select 1 from reports r where r.post_id = c.post_id)`;
  const commentCount = `select count(*)::text as total from comments c where ${commentFilter}`;
  const commentDelete = `with candidates as (
      select c.id from comments c
      where ${commentFilter}
      order by coalesce(c.deleted_at, c.created_at), c.id
      limit ${BATCH_MARKER}
      for update skip locked
    )
    delete from comments where id in (select id from candidates)
    returning id`;

  report.comments = dryRun
    ? await countCandidates(client, commentCount, [contentCutoff, accountCutoff])
    : await deleteInBatches(
        client,
        commentDelete,
        [contentCutoff, accountCutoff],
        batchSize,
      );

  const imageCount = `select count(*)::text as total
    from media_assets asset
    where asset.created_at <= $1
      and not exists (
        select 1 from post_images attachment where attachment.asset_id = asset.id
      )`;
  const imageDelete = `with candidates as (
      select asset.id
      from media_assets asset
      where asset.created_at <= $1
        and not exists (
          select 1 from post_images attachment where attachment.asset_id = asset.id
        )
      order by asset.created_at, asset.id
      limit ${BATCH_MARKER}
      for update skip locked
    )
    delete from media_assets asset
    where asset.id in (select id from candidates)
    returning asset.storage_key`;
  const documentCount = `select count(*)::text as total
    from document_assets asset
    where asset.created_at <= $1
      and not exists (
        select 1 from post_documents attachment where attachment.asset_id = asset.id
      )`;
  const documentDelete = `with candidates as (
      select asset.id
      from document_assets asset
      where asset.created_at <= $1
        and not exists (
          select 1 from post_documents attachment where attachment.asset_id = asset.id
        )
      order by asset.created_at, asset.id
      limit ${BATCH_MARKER}
      for update skip locked
    )
    delete from document_assets asset
    where asset.id in (select id from candidates)
    returning asset.storage_key`;

  if (dryRun) {
    report.mediaAssets = await countCandidates(client, imageCount, [
      uploadCutoff,
    ]);
    report.documentAssets = await countCandidates(client, documentCount, [
      uploadCutoff,
    ]);
    report.storageDeleteRequests =
      report.mediaAssets + report.documentAssets;
  } else {
    const images = await deleteAssetsInBatches(
      client,
      storage,
      imageDelete,
      uploadCutoff,
      batchSize,
    );
    const documents = await deleteAssetsInBatches(
      client,
      storage,
      documentDelete,
      uploadCutoff,
      batchSize,
    );

    report.mediaAssets = images.deleted;
    report.documentAssets = documents.deleted;
    report.storageDeleteRequests =
      images.storageDeleteRequests + documents.storageDeleteRequests;
    report.storageDeleteFailures =
      images.storageDeleteFailures + documents.storageDeleteFailures;
  }

  const userFilter = `u.deleted_at is not null
    and u.deleted_at <= $1
    and not exists (select 1 from posts p where p.author_id = u.id)
    and not exists (select 1 from comments c where c.author_id = u.id)
    and not exists (select 1 from media_assets a where a.owner_id = u.id)
    and not exists (select 1 from document_assets a where a.owner_id = u.id)
    and not exists (
      select 1 from reports r
      where r.reporter_id = u.id or r.resolved_by = u.id
    )
    and not exists (
      select 1
      from direct_messages message
      join reports r on r.message_id = message.id
      where message.sender_id = u.id
    )
    and not exists (
      select 1 from moderation_actions action
      where action.actor_id = u.id or action.target_user_id = u.id
    )
    and not exists (
      select 1
      from direct_messages message
      join moderation_actions action on action.message_id = message.id
      where message.sender_id = u.id
    )`;
  const userCount = `select count(*)::text as total from users u where ${userFilter}`;
  const userDelete = `with candidates as (
      select u.id from users u
      where ${userFilter}
      order by u.deleted_at, u.id
      limit ${BATCH_MARKER}
      for update skip locked
    )
    delete from users where id in (select id from candidates)
    returning id`;

  report.users = dryRun
    ? await countCandidates(client, userCount, [accountCutoff])
    : await deleteInBatches(
        client,
        userDelete,
        [accountCutoff],
        batchSize,
      );

  return report;
}

async function repairMissingDatabaseObjects(
  client: PoolClient,
  mediaAssetIds: string[],
  documentAssetIds: string[],
  avatarUserIds: string[],
) {
  if (
    mediaAssetIds.length === 0 &&
    documentAssetIds.length === 0 &&
    avatarUserIds.length === 0
  ) {
    return;
  }

  await client.query("begin");

  try {
    if (mediaAssetIds.length > 0) {
      await client.query(
        "delete from post_images where asset_id = any($1::uuid[])",
        [mediaAssetIds],
      );
      await client.query(
        "delete from media_assets where id = any($1::uuid[])",
        [mediaAssetIds],
      );
    }

    if (documentAssetIds.length > 0) {
      await client.query(
        "delete from post_documents where asset_id = any($1::uuid[])",
        [documentAssetIds],
      );
      await client.query(
        "delete from document_assets where id = any($1::uuid[])",
        [documentAssetIds],
      );
    }

    if (avatarUserIds.length > 0) {
      await client.query(
        "update users set avatar_object_key = null where id = any($1::uuid[])",
        [avatarUserIds],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function storageKeyIsReferenced(client: PoolClient, storageKey: string) {
  const result = await client.query<{ referenced: boolean }>(
    `select exists (
      select 1 from media_assets where storage_key = $1
      union all
      select 1 from document_assets where storage_key = $1
      union all
      select 1 from users where avatar_object_key = $1
    ) as referenced`,
    [storageKey],
  );

  return result.rows[0]?.referenced ?? false;
}

async function runReconciliation(
  client: PoolClient,
  storage: MediaStorage,
  now: Date,
  policy: DataRetentionPolicy,
  dryRun: boolean,
): Promise<ReconciliationReport> {
  const report = emptyReconciliationReport();
  const orphanCutoff = retentionCutoff(
    now,
    policy.orphanStorageObjectMs,
  );
  const missingCutoff = retentionCutoff(
    now,
    policy.missingStorageObjectGraceMs,
  );
  const assetResult = await client.query<AssetRow>(`
    select id, storage_key, size_bytes, created_at, 'image'::text as kind
    from media_assets
    union all
    select id, storage_key, size_bytes, created_at, 'document'::text as kind
    from document_assets
  `);
  const avatarResult = await client.query<AvatarRow>(`
    select id, avatar_object_key as storage_key
    from users
    where avatar_object_key is not null
  `);
  const databaseKeys = new Set<string>([
    ...assetResult.rows.map((row) => row.storage_key),
    ...avatarResult.rows.map((row) => row.storage_key),
  ]);
  const storedObjects = new Map<
    string,
    { lastModified: Date; sizeBytes: number }
  >();

  for await (const object of storage.list()) {
    report.storageObjectsScanned += 1;
    storedObjects.set(object.key, object);

    if (
      !databaseKeys.has(object.key) &&
      object.lastModified.getTime() <= orphanCutoff.getTime()
    ) {
      // Recheck immediately before deletion so an object adopted by a
      // concurrent DB write after the initial snapshot is never removed.
      if (await storageKeyIsReferenced(client, object.key)) continue;

      report.orphanObjectsFound += 1;

      if (!dryRun) {
        try {
          await storage.delete(object.key);
          report.orphanObjectsDeleted += 1;
        } catch {
          report.orphanDeleteFailures += 1;
        }
      }
    }
  }

  const missingMediaAssetIds: string[] = [];
  const missingDocumentAssetIds: string[] = [];

  for (const asset of assetResult.rows) {
    const stored = storedObjects.get(asset.storage_key);

    if (stored) {
      if (stored.sizeBytes !== asset.size_bytes) {
        report.sizeMismatches += 1;
      }
      continue;
    }

    if (new Date(asset.created_at).getTime() > missingCutoff.getTime()) {
      continue;
    }

    if (asset.kind === "image") {
      missingMediaAssetIds.push(asset.id);
    } else {
      missingDocumentAssetIds.push(asset.id);
    }
  }

  const missingAvatarUserIds = avatarResult.rows
    .filter((avatar) => !storedObjects.has(avatar.storage_key))
    .map((avatar) => avatar.id);

  report.missingMediaAssets = missingMediaAssetIds.length;
  report.missingDocumentAssets = missingDocumentAssetIds.length;
  report.missingAvatars = missingAvatarUserIds.length;

  if (!dryRun) {
    await repairMissingDatabaseObjects(
      client,
      missingMediaAssetIds,
      missingDocumentAssetIds,
      missingAvatarUserIds,
    );
    report.databaseReferencesRepaired =
      missingMediaAssetIds.length +
      missingDocumentAssetIds.length +
      missingAvatarUserIds.length;
  }

  return report;
}

export async function runMaintenance({
  now = new Date(),
  dryRun = false,
  mode = "all",
  batchSize = DATA_RETENTION_POLICY.defaultBatchSize,
  pool,
  storage = createMediaStorage(),
  policy = DATA_RETENTION_POLICY,
}: RunMaintenanceOptions = {}): Promise<MaintenanceReport> {
  const normalizedBatchSize = validateBatchSize(batchSize);
  const startedAt = new Date();
  const ownedPool = pool
    ? null
    : new Pool({
        connectionString: getServerEnvironment().DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 10_000,
        allowExitOnIdle: true,
        application_name: "kampus-maintenance",
      });
  const activePool = pool ?? ownedPool!;
  let client: PoolClient | null = null;
  let locked = false;

  try {
    client = await activePool.connect();
    const lockResult = await client.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock(hashtextextended($1, 0)) as acquired",
      [MAINTENANCE_LOCK_NAME],
    );
    locked = lockResult.rows[0]?.acquired ?? false;

    if (!locked) {
      return {
        status: "skipped_locked",
        mode,
        dryRun,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        cleanup: emptyCleanupReport(),
        reconciliation: emptyReconciliationReport(),
      };
    }

    const cleanup =
      mode === "reconcile"
        ? emptyCleanupReport()
        : await runCleanup(
            client,
            storage,
            now,
            policy,
            normalizedBatchSize,
            dryRun,
          );
    const reconciliation =
      mode === "cleanup"
        ? emptyReconciliationReport()
        : await runReconciliation(client, storage, now, policy, dryRun);

    return {
      status: "completed",
      mode,
      dryRun,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      cleanup,
      reconciliation,
    };
  } finally {
    if (locked && client) {
      await client
        .query(
          "select pg_advisory_unlock(hashtextextended($1, 0))",
          [MAINTENANCE_LOCK_NAME],
        )
        .catch(() => undefined);
    }
    client?.release();
    await ownedPool?.end();
  }
}

export function maintenanceHasFailures(report: MaintenanceReport) {
  return (
    report.cleanup.storageDeleteFailures > 0 ||
    report.reconciliation.orphanDeleteFailures > 0 ||
    report.reconciliation.sizeMismatches > 0
  );
}
