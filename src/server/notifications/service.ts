import "server-only";

import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import {
  comments,
  notifications,
  posts,
  userSettings,
  users,
} from "@/server/db/schema";
import {
  buildCursorPage,
  decodeTimelineCursor,
} from "@/server/pagination/cursor";
import { hasBlockBetween, noBlockBetween } from "@/server/social/blocking";

import { extractMentionedUsernames } from "./validation";

type NotificationsDatabase = ReturnType<typeof getDatabase>;
type NotificationsTransaction = Parameters<
  Parameters<NotificationsDatabase["transaction"]>[0]
>[0];

const DEFAULT_LIST_LIMIT = 50;

export type NotificationKind =
  | "like"
  | "comment"
  | "reply"
  | "mention"
  | "follow"
  | "announcement";

export type NotificationSummary = {
  id: string;
  kind: NotificationKind;
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  likeCount: number | null;
  post: { id: string; title: string; isDeleted: boolean } | null;
  comment: { id: string; excerpt: string; isDeleted: boolean } | null;
  isRead: boolean;
  createdAt: string;
};

function notificationNotFoundError() {
  return new AuthError("NOTIFICATION_NOT_FOUND", "Bildirim bulunamadı.", {
    status: 404,
  });
}

function avatarUrlFor(username: string, avatarObjectKey: string | null) {
  return avatarObjectKey ? `/v1/users/${username}/avatar` : null;
}

const NOTIFICATIONS_CURSOR_SCOPE = "notifications";

export async function listNotifications(
  recipientId: string,
  query: { cursor?: string; limit?: number } = {},
) {
  const limit = query.limit ?? DEFAULT_LIST_LIMIT;
  const filters = [
    eq(notifications.recipientId, recipientId),
    // Engel sonrası geçmişte üretilmiş bildirimler de görünmemeli.
    noBlockBetween(recipientId, notifications.actorId),
  ];

  if (query.cursor) {
    const cursor = decodeTimelineCursor(
      NOTIFICATIONS_CURSOR_SCOPE,
      query.cursor,
    );

    filters.push(
      or(
        lt(notifications.createdAt, cursor.createdAt),
        and(
          eq(notifications.createdAt, cursor.createdAt),
          lt(notifications.id, cursor.id),
        ),
      )!,
    );
  }

  const rows = await getDatabase()
    .select({
      id: notifications.id,
      kind: notifications.kind,
      likeCount: notifications.likeCount,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      postId: notifications.postId,
      commentId: notifications.commentId,
      actorId: users.id,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      actorAvatarObjectKey: users.avatarObjectKey,
      postTitle: posts.title,
      postBody: posts.body,
      postDeletedAt: posts.deletedAt,
      commentBody: comments.body,
      commentDeletedAt: comments.deletedAt,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.actorId))
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .leftJoin(comments, eq(comments.id, notifications.commentId))
    .where(and(...filters))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);

  return buildCursorPage({
    rows,
    limit,
    scope: NOTIFICATIONS_CURSOR_SCOPE,
    toDto: (row): NotificationSummary => ({
      id: row.id,
      kind: row.kind,
      actor: {
        id: row.actorId,
        username: row.actorUsername,
        displayName: row.actorDisplayName,
        avatarUrl: avatarUrlFor(row.actorUsername, row.actorAvatarObjectKey),
      },
      likeCount: row.likeCount,
      post: row.postId
        ? {
            id: row.postId,
            title: (row.postTitle || row.postBody || "").slice(0, 140),
            isDeleted: Boolean(row.postDeletedAt),
          }
        : null,
      comment: row.commentId
        ? {
            id: row.commentId,
            excerpt: (row.commentBody ?? "").slice(0, 140),
            isDeleted: Boolean(row.commentDeletedAt),
          }
        : null,
      isRead: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    }),
  });
}

export async function getUnreadNotificationCount(
  recipientId: string,
): Promise<number> {
  const [row] = await getDatabase()
    .select({ total: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        isNull(notifications.readAt),
        noBlockBetween(recipientId, notifications.actorId),
      ),
    );

  return row?.total ?? 0;
}

export async function markNotificationAsRead(
  recipientId: string,
  notificationId: string,
): Promise<void> {
  const rows = await getDatabase()
    .update(notifications)
    .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientId, recipientId),
      ),
    )
    .returning({ id: notifications.id });

  if (rows.length === 0) {
    throw notificationNotFoundError();
  }
}

export async function markAllNotificationsAsRead(
  recipientId: string,
): Promise<{ markedCount: number }> {
  const rows = await getDatabase()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });

  return { markedCount: rows.length };
}

type NotificationPreferenceColumn =
  | "notifyLikes"
  | "notifyComments"
  | "notifyReplies"
  | "notifyMentions"
  | "notifyFollows";

async function isNotificationEnabled(
  transaction: NotificationsTransaction,
  recipientId: string,
  column: NotificationPreferenceColumn,
): Promise<boolean> {
  const [row] = await transaction
    .select({ enabled: userSettings[column] })
    .from(userSettings)
    .where(eq(userSettings.userId, recipientId))
    .limit(1);

  return row?.enabled ?? true;
}

/**
 * Bildirim üretimi, engelin her iki yönünde de durur: engelleyen taraf da
 * engellenen taraftan bildirim almamalı.
 */
async function isNotificationAllowed(
  transaction: NotificationsTransaction,
  params: {
    recipientId: string;
    actorId: string;
    column: NotificationPreferenceColumn;
  },
): Promise<boolean> {
  if (params.recipientId === params.actorId) {
    return false;
  }

  if (
    await hasBlockBetween(transaction, params.recipientId, params.actorId)
  ) {
    return false;
  }

  return isNotificationEnabled(
    transaction,
    params.recipientId,
    params.column,
  );
}

export async function recordLikeNotification(
  transaction: NotificationsTransaction,
  params: { recipientId: string; actorId: string; postId: string },
): Promise<void> {
  if (
    !(await isNotificationAllowed(transaction, {
      recipientId: params.recipientId,
      actorId: params.actorId,
      column: "notifyLikes",
    }))
  ) {
    return;
  }

  await transaction
    .insert(notifications)
    .values({
      recipientId: params.recipientId,
      actorId: params.actorId,
      kind: "like",
      postId: params.postId,
      likeCount: 1,
    })
    .onConflictDoUpdate({
      target: [notifications.recipientId, notifications.postId],
      targetWhere: sql`${notifications.kind} = 'like'`,
      set: {
        actorId: params.actorId,
        likeCount: sql`${notifications.likeCount} + 1`,
        readAt: null,
        createdAt: new Date(),
      },
    });
}

export async function recordCommentNotification(
  transaction: NotificationsTransaction,
  params: {
    recipientId: string;
    actorId: string;
    postId: string;
    commentId: string;
    kind: "comment" | "reply";
  },
): Promise<void> {
  const column: NotificationPreferenceColumn =
    params.kind === "reply" ? "notifyReplies" : "notifyComments";

  if (
    !(await isNotificationAllowed(transaction, {
      recipientId: params.recipientId,
      actorId: params.actorId,
      column,
    }))
  ) {
    return;
  }

  await transaction.insert(notifications).values({
    recipientId: params.recipientId,
    actorId: params.actorId,
    kind: params.kind,
    postId: params.postId,
    commentId: params.commentId,
  });
}

export async function recordMentionNotifications(
  transaction: NotificationsTransaction,
  params: {
    actorId: string;
    postId: string;
    commentId: string;
    commentBody: string;
  },
): Promise<void> {
  const usernames = extractMentionedUsernames(params.commentBody);

  if (usernames.length === 0) {
    return;
  }

  const resolved = await transaction
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.username, usernames),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    );

  const recipientIds = [...new Set(resolved.map((row) => row.id))].filter(
    (id) => id !== params.actorId,
  );

  if (recipientIds.length === 0) {
    return;
  }

  const enabledRecipientIds: string[] = [];

  for (const recipientId of recipientIds) {
    if (
      await isNotificationAllowed(transaction, {
        recipientId,
        actorId: params.actorId,
        column: "notifyMentions",
      })
    ) {
      enabledRecipientIds.push(recipientId);
    }
  }

  if (enabledRecipientIds.length === 0) {
    return;
  }

  await transaction.insert(notifications).values(
    enabledRecipientIds.map((recipientId) => ({
      recipientId,
      actorId: params.actorId,
      kind: "mention" as const,
      postId: params.postId,
      commentId: params.commentId,
    })),
  );
}

export async function recordFollowNotification(
  transaction: NotificationsTransaction,
  params: { recipientId: string; actorId: string },
): Promise<void> {
  if (
    !(await isNotificationAllowed(transaction, {
      recipientId: params.recipientId,
      actorId: params.actorId,
      column: "notifyFollows",
    }))
  ) {
    return;
  }

  await transaction.insert(notifications).values({
    recipientId: params.recipientId,
    actorId: params.actorId,
    kind: "follow",
  });
}
