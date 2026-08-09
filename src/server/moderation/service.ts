import "server-only";

import { alias } from "drizzle-orm/pg-core";
import {
  and,
  countDistinct,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { AuthRole } from "@/auth/types";
import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import {
  buildCursorPage,
  decodeTimelineCursor,
  encodeTimelineCursor,
  sliceCursorPage,
} from "@/server/pagination/cursor";
import { consumeRateLimit } from "@/server/rate-limit/service";
import {
  blocks,
  comments,
  follows,
  moderationActions,
  postImages,
  posts,
  reports,
  sessions,
  users,
} from "@/server/db/schema";

const DEFAULT_LIST_LIMIT = 20;

/**
 * Otomatik gizleme eşiği.
 *
 * Yalnızca görsel/GIF içeren gönderilerde çalışır. Metin gönderileri asla
 * otomatik gizlenmez: birkaç kullanıcının anlaşıp bir fikri susturması
 * riski, çıplak fotoğrafın bir süre açık kalması riskinden daha ağır basar.
 */
const AUTO_HIDE_REPORT_THRESHOLD = 3;

/**
 * Şikâyetleri sürekli reddedilen kullanıcı eşiğe sayılmaz.
 *
 * Hesap yaşı kuralı bilerek yok: kayıt zaten öğrenci e-postası ve OTP
 * istediği için tek kullanımlık hesap üretmek pahalı. Yaş şartı korumayı
 * yalnızca lansman günlerinde, yani en çok gerektiği anda devre dışı
 * bırakıyordu.
 */
const AUTO_HIDE_MAX_DISMISSED_REPORTS = 3;

export type BlockedMemberSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ReportReason =
  | "spam"
  | "harassment"
  | "personal_information"
  | "misleading"
  | "other";
export type ReportTargetType = "post" | "comment";
export type ReportResolution =
  | "dismissed"
  | "content_removed"
  | "user_suspended";

export type ReportSummary = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  postId: string;
  reason: ReportReason;
  detail: string;
  status: "pending" | "resolved";
  resolution: ReportResolution | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: { id: string; username: string; displayName: string };
  target: {
    authorId: string;
    author: { username: string; displayName: string } | null;
    excerpt: string;
    isDeleted: boolean;
  };
};

export type ManagedUserSummary = {
  id: string;
  username: string;
  displayName: string;
  department: string;
  role: AuthRole;
  status: "active" | "suspended";
  suspendedAt: string | null;
  joinedLabel: string;
  avatarUrl: string | null;
};

export type ModerationHistoryEntry = {
  id: string;
  action:
    | "report_dismissed"
    | "content_removed"
    | "content_hidden"
    | "content_restored"
    | "user_suspended"
    | "user_restored"
    | "role_changed";
  createdAt: string;
  reportId: string | null;
  postId: string | null;
  note: string | null;
  // Otomatik gizlemede insan aktör yoktur.
  actor: { username: string; displayName: string } | null;
  target: { id: string; username: string; displayName: string } | null;
};

function userNotFoundError() {
  return new AuthError(
    "USER_NOT_FOUND",
    "Bu kullanıcı adıyla görüntülenebilecek bir profil bulunamadı.",
    { status: 404 },
  );
}

function selfBlockError() {
  return new AuthError(
    "INVALID_REQUEST",
    "Kendini engelleyemezsin.",
    { status: 400 },
  );
}

function postNotFoundError() {
  return new AuthError(
    "POST_NOT_FOUND",
    "Bu gönderi bulunamadı veya artık görüntülenemiyor.",
    { status: 404 },
  );
}

function commentNotFoundError() {
  return new AuthError(
    "COMMENT_NOT_FOUND",
    "Bu yorum bulunamadı veya artık görüntülenemiyor.",
    { status: 404 },
  );
}

function selfReportError() {
  return new AuthError(
    "INVALID_REQUEST",
    "Kendi içeriğini şikâyet edemezsin.",
    { status: 400 },
  );
}

function reportNotFoundError() {
  return new AuthError(
    "USER_NOT_FOUND",
    "Şikâyet bulunamadı veya zaten çözülmüş.",
    { status: 404 },
  );
}

function selfModerationError() {
  return new AuthError(
    "INVALID_REQUEST",
    "Bu işlemi kendi hesabına uygulayamazsın.",
    { status: 400 },
  );
}

function authorizationRequiredError() {
  return new AuthError(
    "AUTHORIZATION_REQUIRED",
    "Bu işlem için yetkin yok.",
    { status: 403 },
  );
}

function requiredModerationNote(note: string | undefined) {
  const trimmedNote = note?.trim().slice(0, 240) ?? "";

  if (trimmedNote.length < 3) {
    throw new AuthError(
      "INVALID_REQUEST",
      "Moderasyon işlemi için en az 3 karakterlik bir gerekçe yazmalısın.",
      { status: 400 },
    );
  }

  return trimmedNote;
}

function formatJoinedLabel(createdAt: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(createdAt);
}

function avatarUrlFor(username: string, avatarObjectKey: string | null) {
  return avatarObjectKey ? `/v1/users/${username}/avatar` : null;
}

async function resolveActiveUserId(username: string) {
  const normalizedUsername = username.trim().toLowerCase();

  const [user] = await getDatabase()
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.username, normalizedUsername),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!user) {
    throw userNotFoundError();
  }

  return user.id;
}

export async function blockUser(
  blockerId: string,
  targetUsername: string,
) {
  const targetId = await resolveActiveUserId(targetUsername);

  if (targetId === blockerId) {
    throw selfBlockError();
  }

  await getDatabase().transaction(async (transaction) => {
    await consumeRateLimit(transaction, blockerId, "block");

    await transaction
      .insert(blocks)
      .values({ blockerId, blockedId: targetId })
      .onConflictDoNothing();

    await transaction
      .delete(follows)
      .where(
        or(
          and(
            eq(follows.followerId, blockerId),
            eq(follows.followingId, targetId),
          ),
          and(
            eq(follows.followerId, targetId),
            eq(follows.followingId, blockerId),
          ),
        ),
      );
  });
}

export async function unblockUser(
  blockerId: string,
  targetUsername: string,
) {
  const targetId = await resolveActiveUserId(targetUsername);

  await getDatabase()
    .delete(blocks)
    .where(
      and(
        eq(blocks.blockerId, blockerId),
        eq(blocks.blockedId, targetId),
      ),
    );
}

export async function listBlockedUsers(
  blockerId: string,
  query: { cursor?: string; limit?: number } = {},
) {
  const limit = query.limit ?? DEFAULT_LIST_LIMIT;
  const scope = "blocked-users";
  const filters = [eq(blocks.blockerId, blockerId)];

  if (query.cursor) {
    const cursor = decodeTimelineCursor(scope, query.cursor);

    filters.push(
      or(
        lt(blocks.createdAt, cursor.createdAt),
        and(eq(blocks.createdAt, cursor.createdAt), lt(users.id, cursor.id)),
      )!,
    );
  }

  const rows = await getDatabase()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarObjectKey: users.avatarObjectKey,
      createdAt: blocks.createdAt,
    })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(and(...filters))
    .orderBy(desc(blocks.createdAt), desc(users.id))
    .limit(limit + 1);

  return buildCursorPage({
    rows,
    limit,
    scope,
    toDto: (row): BlockedMemberSummary => ({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarObjectKey
        ? `/v1/users/${row.username}/avatar`
        : null,
    }),
  });
}

async function resolveReportTarget(
  targetType: ReportTargetType,
  targetId: string,
) {
  if (targetType === "post") {
    const [row] = await getDatabase()
      .select({ authorId: posts.authorId, postId: posts.id })
      .from(posts)
      .where(and(eq(posts.id, targetId), isNull(posts.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  const [row] = await getDatabase()
    .select({ authorId: comments.authorId, postId: comments.postId })
    .from(comments)
    .where(and(eq(comments.id, targetId), isNull(comments.deletedAt)))
    .limit(1);

  return row ?? null;
}

type ModerationDatabase = ReturnType<typeof getDatabase>;
type ModerationTransaction = Parameters<
  Parameters<ModerationDatabase["transaction"]>[0]
>[0];

/**
 * Eşiği aşan görselli gönderiyi gizler. Silme değildir; moderatör şikâyeti
 * reddettiğinde gönderi geri açılır.
 */
async function applyAutoHideThreshold(
  transaction: ModerationTransaction,
  postId: string,
) {
  const [candidate] = await transaction
    .select({
      id: posts.id,
      hasImage: sql<boolean>`exists (
        select 1 from ${postImages}
        where ${postImages.postId} = ${posts.id}
      )`,
      gifId: posts.gifId,
    })
    .from(posts)
    .where(
      and(
        eq(posts.id, postId),
        isNull(posts.deletedAt),
        isNull(posts.hiddenAt),
      ),
    )
    .for("update")
    .limit(1);

  if (!candidate || (!candidate.hasImage && !candidate.gifId)) {
    return;
  }

  const dismissedByReporter = sql<number>`(
    select count(*)
    from ${reports} as dismissed_reports
    where dismissed_reports.reporter_id = ${reports.reporterId}
      and dismissed_reports.resolution = 'dismissed'
  )`;

  const [usage] = await transaction
    .select({ reporters: countDistinct(reports.reporterId) })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, "post"),
        eq(reports.targetId, postId),
        eq(reports.status, "pending"),
        lt(dismissedByReporter, AUTO_HIDE_MAX_DISMISSED_REPORTS),
      ),
    );

  if ((usage?.reporters ?? 0) < AUTO_HIDE_REPORT_THRESHOLD) {
    return;
  }

  await transaction
    .update(posts)
    .set({ hiddenAt: new Date() })
    .where(and(eq(posts.id, postId), isNull(posts.hiddenAt)));

  await transaction.insert(moderationActions).values({
    // Otomatik koruma: insan aktör yok.
    actorId: null,
    action: "content_hidden",
    postId,
    note: `${AUTO_HIDE_REPORT_THRESHOLD} bağımsız şikâyet sonrası otomatik gizlendi.`,
  });
}

export async function submitReport(
  reporterId: string,
  input: {
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    detail?: string;
  },
): Promise<{ created: boolean }> {
  const target = await resolveReportTarget(
    input.targetType,
    input.targetId,
  );

  if (!target) {
    throw input.targetType === "post"
      ? postNotFoundError()
      : commentNotFoundError();
  }

  if (target.authorId === reporterId) {
    throw selfReportError();
  }

  return getDatabase().transaction(async (transaction) => {
    await consumeRateLimit(transaction, reporterId, "report_create");

    const inserted = await transaction
      .insert(reports)
      .values({
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        postId: target.postId,
        reason: input.reason,
        detail: input.detail?.trim().slice(0, 300) ?? "",
      })
      .onConflictDoNothing()
      .returning({ id: reports.id });

    if (inserted.length > 0 && input.targetType === "post") {
      await applyAutoHideThreshold(transaction, input.targetId);
    }

    return { created: inserted.length > 0 };
  });
}

export async function listReports(
  status?: "pending" | "resolved",
  query: { cursor?: string; limit?: number } = {},
) {
  const database = getDatabase();
  const limit = query.limit ?? DEFAULT_LIST_LIMIT;
  // Cursor duruma bağlı: bekleyenler için alınan anahtar çözülmüşlerde
  // kullanılamaz, aksi hâlde sayfa atlanır.
  const scope = `reports:${status ?? "all"}`;
  const filters: SQL[] = status ? [eq(reports.status, status)] : [];

  if (query.cursor) {
    const cursor = decodeTimelineCursor(scope, query.cursor);

    filters.push(
      or(
        lt(reports.createdAt, cursor.createdAt),
        and(
          eq(reports.createdAt, cursor.createdAt),
          lt(reports.id, cursor.id),
        ),
      )!,
    );
  }

  const pagedRows = await database
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      postId: reports.postId,
      reason: reports.reason,
      detail: reports.detail,
      status: reports.status,
      resolution: reports.resolution,
      resolutionNote: reports.resolutionNote,
      resolvedAt: reports.resolvedAt,
      createdAt: reports.createdAt,
      reporterId: users.id,
      reporterUsername: users.username,
      reporterDisplayName: users.displayName,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(reports.createdAt), desc(reports.id))
    .limit(limit + 1);

  // Hedef içerik sorguları yalnızca gösterilecek satırlar için çalışsın.
  const { visibleRows: rows, hasMore } = sliceCursorPage(pagedRows, limit);
  const lastVisibleRow = rows.at(-1);
  const postTargetIds = rows
    .filter((row) => row.targetType === "post")
    .map((row) => row.targetId);
  const commentTargetIds = rows
    .filter((row) => row.targetType === "comment")
    .map((row) => row.targetId);

  type PostTargetRow = {
    id: string;
    authorId: string;
    title: string;
    body: string;
    deletedAt: Date | null;
    username: string;
    displayName: string;
  };
  type CommentTargetRow = {
    id: string;
    authorId: string;
    body: string;
    deletedAt: Date | null;
    username: string;
    displayName: string;
  };

  const postMap = new Map<string, PostTargetRow>();
  const commentMap = new Map<string, CommentTargetRow>();

  if (postTargetIds.length > 0) {
    const postTargets: PostTargetRow[] = await database
      .select({
        id: posts.id,
        authorId: posts.authorId,
        title: posts.title,
        body: posts.body,
        deletedAt: posts.deletedAt,
        username: users.username,
        displayName: users.displayName,
      })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(inArray(posts.id, postTargetIds));

    for (const row of postTargets) {
      postMap.set(row.id, row);
    }
  }

  if (commentTargetIds.length > 0) {
    const commentTargets: CommentTargetRow[] = await database
      .select({
        id: comments.id,
        authorId: comments.authorId,
        body: comments.body,
        deletedAt: comments.deletedAt,
        username: users.username,
        displayName: users.displayName,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(inArray(comments.id, commentTargetIds));

    for (const row of commentTargets) {
      commentMap.set(row.id, row);
    }
  }

  const data = rows.map((row): ReportSummary => {
    const postTarget =
      row.targetType === "post" ? postMap.get(row.targetId) : undefined;
    const commentTarget =
      row.targetType === "comment"
        ? commentMap.get(row.targetId)
        : undefined;
    const target: {
      authorId: string;
      username: string;
      displayName: string;
      deletedAt: Date | null;
    } | undefined = postTarget ?? commentTarget;
    const excerpt: string = postTarget
      ? postTarget.title || postTarget.body
      : (commentTarget?.body ?? "");

    return {
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      postId: row.postId,
      reason: row.reason,
      detail: row.detail,
      status: row.status,
      resolution: row.resolution,
      resolutionNote: row.resolutionNote,
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      reporter: {
        id: row.reporterId,
        username: row.reporterUsername,
        displayName: row.reporterDisplayName,
      },
      target: target
        ? {
            authorId: target.authorId,
            author: {
              username: target.username,
              displayName: target.displayName,
            },
            excerpt: excerpt.slice(0, 140),
            isDeleted: Boolean(target.deletedAt),
          }
        : {
            authorId: "",
            author: null,
            excerpt: "",
            isDeleted: true,
          },
    };
  });

  return {
    data,
    page: {
      nextCursor:
        hasMore && lastVisibleRow
          ? encodeTimelineCursor(scope, lastVisibleRow)
          : null,
      hasMore,
    },
  };
}

async function assertCanModerateTarget(
  transaction: Parameters<
    Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]
  >[0],
  actorId: string,
  targetUserId: string,
) {
  if (actorId === targetUserId) {
    throw selfModerationError();
  }

  const [actor] = await transaction
    .select({
      role: users.role,
      status: users.status,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  if (
    !actor ||
    actor.role === "member" ||
    actor.status !== "active" ||
    actor.deletedAt !== null
  ) {
    throw authorizationRequiredError();
  }

  const [target] = await transaction
    .select({
      role: users.role,
      status: users.status,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, targetUserId))
    .for("update")
    .limit(1);

  if (!target || target.deletedAt !== null) {
    throw userNotFoundError();
  }

  if (target.role !== "member" && actor.role !== "admin") {
    throw authorizationRequiredError();
  }

  return target;
}

async function assertActiveModerator(
  transaction: ModerationTransaction,
  actorId: string,
) {
  const [actor] = await transaction
    .select({
      role: users.role,
      status: users.status,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  if (
    !actor ||
    actor.role === "member" ||
    actor.status !== "active" ||
    actor.deletedAt !== null
  ) {
    throw authorizationRequiredError();
  }

  return actor;
}

async function hasAutoHideThreshold(
  transaction: ModerationTransaction,
  postId: string,
) {
  const dismissedByReporter = sql<number>`(
    select count(*)
    from ${reports} as dismissed_reports
    where dismissed_reports.reporter_id = ${reports.reporterId}
      and dismissed_reports.resolution = 'dismissed'
  )`;

  const [usage] = await transaction
    .select({ reporters: countDistinct(reports.reporterId) })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, "post"),
        eq(reports.targetId, postId),
        eq(reports.status, "pending"),
        lt(dismissedByReporter, AUTO_HIDE_MAX_DISMISSED_REPORTS),
      ),
    );

  return (usage?.reporters ?? 0) >= AUTO_HIDE_REPORT_THRESHOLD;
}

/**
 * `hidden_at` tek başına restore yetkisi vermez. Son otomatik görünürlük
 * işlemi gerçekten `content_hidden` olmalı; aksi hâlde elle veya başka bir
 * politika ile gizlenmiş içerik, ilgisiz bir şikâyet reddedilince açılamaz.
 */
async function hasActiveAutoHideCycle(
  transaction: ModerationTransaction,
  postId: string,
) {
  const [latestVisibilityAction] = await transaction
    .select({ action: moderationActions.action })
    .from(moderationActions)
    .where(
      and(
        eq(moderationActions.postId, postId),
        inArray(moderationActions.action, [
          "content_hidden",
          "content_restored",
        ]),
      ),
    )
    .orderBy(
      desc(moderationActions.createdAt),
      // Milisaniye hassasiyetinde eşitlik olursa güvenli tarafta kal: restore
      // kaydını daha yeni say ve içeriği yanlışlıkla yeniden açma.
      desc(sql<number>`case
        when ${moderationActions.action} = 'content_restored' then 1
        else 0
      end`),
      desc(moderationActions.id),
    )
    .limit(1);

  return latestVisibilityAction?.action === "content_hidden";
}

export async function resolveReport(
  moderatorId: string,
  reportId: string,
  resolution: ReportResolution,
  note?: string,
) {
  const now = new Date();
  const trimmedNote = requiredModerationNote(note);

  await getDatabase().transaction(async (transaction) => {
    await assertActiveModerator(transaction, moderatorId);

    const [report] = await transaction
      .select()
      .from(reports)
      .where(
        and(eq(reports.id, reportId), eq(reports.status, "pending")),
      )
      .for("update")
      .limit(1);

    if (!report) {
      throw reportNotFoundError();
    }

    // Aynı gönderiye ait farklı şikâyetler farklı satırlar olduğu için yalnız
    // report kilidi yeterli değildir. Post kilidi tüm kararları aynı sıraya
    // sokar; son karar güncel eşik üzerinden restore yapabilir.
    await transaction
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, report.postId))
      .for("update")
      .limit(1);

    await transaction
      .update(reports)
      .set({
        status: "resolved",
        resolution,
        resolutionNote: trimmedNote,
        resolvedBy: moderatorId,
        resolvedAt: now,
      })
      .where(eq(reports.id, report.id));

    let targetUserId: string | null = null;

    // Şikâyet haksız bulunduysa otomatik gizleme kalkar; gönderi geri yayına
    // girer ve bu da denetim kaydına yazılır.
    if (
      resolution === "dismissed" &&
      report.targetType === "post" &&
      (await hasActiveAutoHideCycle(transaction, report.targetId)) &&
      !(await hasAutoHideThreshold(transaction, report.targetId))
    ) {
      const restored = await transaction
        .update(posts)
        .set({ hiddenAt: null })
        .where(
          and(
            eq(posts.id, report.targetId),
            isNull(posts.deletedAt),
            // Yalnızca gerçekten gizlenmiş gönderi için kayıt üret.
            isNotNull(posts.hiddenAt),
          ),
        )
        .returning({ id: posts.id });

      if (restored.length > 0) {
        await transaction.insert(moderationActions).values({
          actorId: moderatorId,
          action: "content_restored",
          reportId: report.id,
          postId: report.postId,
          note: trimmedNote,
        });
      }
    }

    if (resolution === "content_removed") {
      if (report.targetType === "post") {
        await transaction
          .update(posts)
          .set({ deletedAt: now })
          .where(
            and(eq(posts.id, report.targetId), isNull(posts.deletedAt)),
          );
      } else {
        await transaction
          .update(comments)
          .set({ deletedAt: now })
          .where(
            and(
              eq(comments.id, report.targetId),
              isNull(comments.deletedAt),
            ),
          );
      }
    }

    if (resolution === "user_suspended") {
      const authorRow =
        report.targetType === "post"
          ? await transaction
              .select({ authorId: posts.authorId })
              .from(posts)
              .where(eq(posts.id, report.targetId))
              .limit(1)
          : await transaction
              .select({ authorId: comments.authorId })
              .from(comments)
              .where(eq(comments.id, report.targetId))
              .limit(1);
      const authorId = authorRow[0]?.authorId;

      if (authorId) {
        await assertCanModerateTarget(transaction, moderatorId, authorId);
        await transaction
          .update(users)
          .set({ status: "suspended", suspendedAt: now })
          .where(
            and(eq(users.id, authorId), eq(users.status, "active")),
          );
        await transaction
          .update(sessions)
          .set({ revokedAt: now })
          .where(
            and(
              eq(sessions.userId, authorId),
              isNull(sessions.revokedAt),
            ),
          );
        targetUserId = authorId;
      }
    }

    const actionType =
      resolution === "dismissed"
        ? ("report_dismissed" as const)
        : resolution === "content_removed"
          ? ("content_removed" as const)
          : ("user_suspended" as const);

    await transaction.insert(moderationActions).values({
      actorId: moderatorId,
      action: actionType,
      reportId: report.id,
      targetUserId,
      postId: report.postId,
      note: trimmedNote,
    });
  });
}

export async function listManagedUsers(
  query: { cursor?: string; limit?: number } = {},
) {
  const limit = query.limit ?? DEFAULT_LIST_LIMIT;
  const scope = "managed-users";
  const filters = [
    isNull(users.deletedAt),
    or(ne(users.role, "member"), eq(users.status, "suspended"))!,
  ];

  if (query.cursor) {
    const cursor = decodeTimelineCursor(scope, query.cursor);

    filters.push(
      or(
        lt(users.createdAt, cursor.createdAt),
        and(eq(users.createdAt, cursor.createdAt), lt(users.id, cursor.id)),
      )!,
    );
  }

  const rows = await getDatabase()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      department: users.department,
      role: users.role,
      status: users.status,
      suspendedAt: users.suspendedAt,
      createdAt: users.createdAt,
      avatarObjectKey: users.avatarObjectKey,
    })
    .from(users)
    .where(and(...filters))
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit + 1);

  return buildCursorPage({
    rows,
    limit,
    scope,
    toDto: (row): ManagedUserSummary => ({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      department: row.department,
      role: row.role,
      status: row.status,
      suspendedAt: row.suspendedAt ? row.suspendedAt.toISOString() : null,
      joinedLabel: formatJoinedLabel(row.createdAt),
      avatarUrl: avatarUrlFor(row.username, row.avatarObjectKey),
    }),
  });
}

export async function setUserRole(
  adminId: string,
  targetUserId: string,
  role: AuthRole,
) {
  if (adminId === targetUserId) {
    throw selfModerationError();
  }

  await getDatabase().transaction(async (transaction) => {
    const actor = await assertActiveModerator(transaction, adminId);

    if (actor.role !== "admin") {
      throw authorizationRequiredError();
    }

    const [target] = await transaction
      .select({ role: users.role, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, targetUserId))
      .for("update")
      .limit(1);

    if (!target || target.deletedAt !== null) {
      throw userNotFoundError();
    }

    if (target.role === role) {
      return;
    }

    await transaction
      .update(users)
      .set({ role })
      .where(eq(users.id, targetUserId));

    await transaction.insert(moderationActions).values({
      actorId: adminId,
      action: "role_changed",
      targetUserId,
      note: `${target.role} → ${role}`,
    });
  });
}

export async function suspendUser(
  moderatorId: string,
  targetUserId: string,
  note?: string,
) {
  const now = new Date();
  const trimmedNote = requiredModerationNote(note);

  await getDatabase().transaction(async (transaction) => {
    const target = await assertCanModerateTarget(
      transaction,
      moderatorId,
      targetUserId,
    );

    if (target.status === "suspended") {
      return;
    }

    await transaction
      .update(users)
      .set({ status: "suspended", suspendedAt: now })
      .where(
        and(eq(users.id, targetUserId), eq(users.status, "active")),
      );

    await transaction
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.userId, targetUserId),
          isNull(sessions.revokedAt),
        ),
      );

    await transaction.insert(moderationActions).values({
      actorId: moderatorId,
      action: "user_suspended",
      targetUserId,
      note: trimmedNote,
    });
  });
}

export async function restoreUser(
  moderatorId: string,
  targetUserId: string,
  note?: string,
) {
  const trimmedNote = requiredModerationNote(note);

  await getDatabase().transaction(async (transaction) => {
    const target = await assertCanModerateTarget(
      transaction,
      moderatorId,
      targetUserId,
    );

    if (target.status === "active") {
      return;
    }

    await transaction
      .update(users)
      .set({ status: "active", suspendedAt: null })
      .where(
        and(eq(users.id, targetUserId), eq(users.status, "suspended")),
      );

    await transaction.insert(moderationActions).values({
      actorId: moderatorId,
      action: "user_restored",
      targetUserId,
      note: trimmedNote,
    });
  });
}

export async function getModerationHistory(
  query: { cursor?: string; limit?: number } = {},
) {
  const database = getDatabase();
  const actor = alias(users, "moderation_history_actor");
  const target = alias(users, "moderation_history_target");
  const limit = query.limit ?? DEFAULT_LIST_LIMIT;
  const scope = "moderation-history";
  const filters: SQL[] = [];

  if (query.cursor) {
    const cursor = decodeTimelineCursor(scope, query.cursor);

    filters.push(
      or(
        lt(moderationActions.createdAt, cursor.createdAt),
        and(
          eq(moderationActions.createdAt, cursor.createdAt),
          lt(moderationActions.id, cursor.id),
        ),
      )!,
    );
  }

  const rows = await database
    .select({
      id: moderationActions.id,
      action: moderationActions.action,
      createdAt: moderationActions.createdAt,
      reportId: moderationActions.reportId,
      postId: moderationActions.postId,
      note: moderationActions.note,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      targetUserId: moderationActions.targetUserId,
      targetUsername: target.username,
      targetDisplayName: target.displayName,
    })
    .from(moderationActions)
    // Otomatik gizlemenin aktörü yok; inner join olsaydı bu kayıtlar
    // geçmişten tamamen düşerdi.
    .leftJoin(actor, eq(actor.id, moderationActions.actorId))
    .leftJoin(target, eq(target.id, moderationActions.targetUserId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(moderationActions.createdAt), desc(moderationActions.id))
    .limit(limit + 1);

  return buildCursorPage({
    rows,
    limit,
    scope,
    toDto: (row): ModerationHistoryEntry => ({
      id: row.id,
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      reportId: row.reportId,
      postId: row.postId,
      note: row.note,
      actor:
        row.actorUsername && row.actorDisplayName
          ? {
              username: row.actorUsername,
              displayName: row.actorDisplayName,
            }
          : null,
      target:
        row.targetUserId && row.targetUsername && row.targetDisplayName
          ? {
              id: row.targetUserId,
              username: row.targetUsername,
              displayName: row.targetDisplayName,
            }
          : null,
    }),
  });
}
