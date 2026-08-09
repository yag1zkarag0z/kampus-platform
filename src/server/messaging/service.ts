import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gt,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import {
  directConversationReads,
  directConversations,
  directMessages,
  users,
} from "@/server/db/schema";
import {
  buildCursorPage,
  decodeTimelineCursor,
} from "@/server/pagination/cursor";
import { consumeRateLimit } from "@/server/rate-limit/service";
import {
  hasBlockBetween,
  noBlockBetween,
} from "@/server/social/blocking";

type MessagingDatabase = ReturnType<typeof getDatabase>;
type MessagingTransaction = Parameters<
  Parameters<MessagingDatabase["transaction"]>[0]
>[0];
type MessagingExecutor = MessagingDatabase | MessagingTransaction;

const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_CONVERSATION_LIMIT = 50;
const MESSAGE_CURSOR_SCOPE = "direct-messages";
const DELETED_MESSAGE_PREVIEW = "Bu mesaj silindi.";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type MessageMemberSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type DirectConversationSummary = {
  id: string;
  member: MessageMemberSummary;
  lastMessage: {
    id: string;
    preview: string;
    isMine: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  createdAt: string;
};

export type DirectMessageSummary = {
  id: string;
  conversationId: string;
  body: string;
  isMine: boolean;
  isDeleted: boolean;
  createdAt: string;
};

function conversationNotFoundError() {
  return new AuthError(
    "CONVERSATION_NOT_FOUND",
    "Konuşma bulunamadı.",
    { status: 404 },
  );
}

function messageNotFoundError() {
  return new AuthError("MESSAGE_NOT_FOUND", "Mesaj bulunamadı.", {
    status: 404,
  });
}

function blockedMessagingError() {
  return new AuthError(
    "CONTENT_FORBIDDEN",
    "Bu kullanıcıyla mesajlaşamazsın.",
    { status: 403 },
  );
}

function avatarUrlFor(username: string, avatarObjectKey: string | null) {
  return avatarObjectKey ? `/v1/users/${username}/avatar` : null;
}

function canonicalParticipantIds(firstId: string, secondId: string) {
  // UUID metninde tireler sabit konumda; kod birimi sırası PostgreSQL'in UUID
  // bayt sırasıyla aynıdır.
  return firstId < secondId
    ? [firstId, secondId] as const
    : [secondId, firstId] as const;
}

function participantFilter(viewerId: string): SQL {
  return or(
    eq(directConversations.participantLowId, viewerId),
    eq(directConversations.participantHighId, viewerId),
  )!;
}

function otherParticipantId(viewerId: string) {
  return sql<string>`case
    when ${directConversations.participantLowId} = ${viewerId}
      then ${directConversations.participantHighId}
    else ${directConversations.participantLowId}
  end`;
}

async function resolveMessageTarget(
  executor: MessagingExecutor,
  viewerId: string,
  username: string,
) {
  const [target] = await executor
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.username, username),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!target) {
    throw new AuthError("USER_NOT_FOUND", "Kullanıcı bulunamadı.", {
      status: 404,
    });
  }

  if (target.id === viewerId) {
    throw new AuthError(
      "INVALID_REQUEST",
      "Kendinle konuşma başlatamazsın.",
      { status: 400 },
    );
  }

  if (await hasBlockBetween(executor, viewerId, target.id)) {
    throw blockedMessagingError();
  }

  return target.id;
}

async function assertConversationAccess(
  executor: MessagingExecutor,
  viewerId: string,
  conversationId: string,
) {
  if (!UUID_PATTERN.test(conversationId)) {
    throw conversationNotFoundError();
  }

  const [conversation] = await executor
    .select({
      id: directConversations.id,
      participantLowId: directConversations.participantLowId,
      participantHighId: directConversations.participantHighId,
      lastMessageId: directConversations.lastMessageId,
    })
    .from(directConversations)
    .where(
      and(
        eq(directConversations.id, conversationId),
        participantFilter(viewerId),
      ),
    )
    .limit(1);

  if (!conversation) {
    throw conversationNotFoundError();
  }

  const otherUserId =
    conversation.participantLowId === viewerId
      ? conversation.participantHighId
      : conversation.participantLowId;
  const [otherUser] = await executor
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, otherUserId),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!otherUser) {
    throw conversationNotFoundError();
  }

  if (await hasBlockBetween(executor, viewerId, otherUserId)) {
    throw blockedMessagingError();
  }

  return { ...conversation, otherUserId };
}

async function lockConversation(
  transaction: MessagingTransaction,
  conversationId: string,
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`direct-message:${conversationId}`}, 0))`,
  );
}

const conversationPeer = alias(users, "direct_conversation_peer");

async function selectConversationSummaries(
  viewerId: string,
  conversationId?: string,
) {
  const peerId = otherParticipantId(viewerId);
  const filters = [
    participantFilter(viewerId),
    eq(conversationPeer.status, "active"),
    isNull(conversationPeer.deletedAt),
    noBlockBetween(viewerId, conversationPeer.id),
  ];

  if (conversationId) {
    filters.push(eq(directConversations.id, conversationId));
  } else {
    // Mesaj gönderilmemiş taslak konuşmayı yalnızca başlatan kişi görür.
    filters.push(
      or(
        sql`${directConversations.lastMessageAt} is not null`,
        eq(directConversations.createdById, viewerId),
      )!,
    );
  }

  const unreadCount = sql<number>`(
    select count(*)::int
    from ${directMessages}
    where ${directMessages.conversationId} = ${directConversations.id}
      and ${directMessages.senderId} <> ${viewerId}
      and ${directMessages.deletedAt} is null
      and ${directMessages.createdAt} > coalesce(
        ${directConversationReads.lastReadAt},
        ${directConversations.createdAt}
      )
  )`;

  return getDatabase()
    .select({
      id: directConversations.id,
      createdAt: directConversations.createdAt,
      lastMessageId: directConversations.lastMessageId,
      lastMessageSenderId: directConversations.lastMessageSenderId,
      lastMessagePreview: directConversations.lastMessagePreview,
      lastMessageAt: directConversations.lastMessageAt,
      peerId: conversationPeer.id,
      peerUsername: conversationPeer.username,
      peerDisplayName: conversationPeer.displayName,
      peerAvatarObjectKey: conversationPeer.avatarObjectKey,
      unreadCount,
    })
    .from(directConversations)
    .innerJoin(conversationPeer, eq(conversationPeer.id, peerId))
    .leftJoin(
      directConversationReads,
      and(
        eq(
          directConversationReads.conversationId,
          directConversations.id,
        ),
        eq(directConversationReads.userId, viewerId),
      ),
    )
    .where(and(...filters))
    .orderBy(
      desc(
        sql`coalesce(${directConversations.lastMessageAt}, ${directConversations.createdAt})`,
      ),
      desc(directConversations.id),
    )
    .limit(conversationId ? 1 : MAX_CONVERSATION_LIMIT);
}

function toConversationSummary(
  row: Awaited<ReturnType<typeof selectConversationSummaries>>[number],
  viewerId: string,
): DirectConversationSummary {
  return {
    id: row.id,
    member: {
      id: row.peerId,
      username: row.peerUsername,
      displayName: row.peerDisplayName,
      avatarUrl: avatarUrlFor(
        row.peerUsername,
        row.peerAvatarObjectKey,
      ),
    },
    lastMessage:
      row.lastMessageId &&
      row.lastMessageSenderId &&
      row.lastMessagePreview !== null &&
      row.lastMessageAt
        ? {
            id: row.lastMessageId,
            preview: row.lastMessagePreview,
            isMine: row.lastMessageSenderId === viewerId,
            createdAt: row.lastMessageAt.toISOString(),
          }
        : null,
    unreadCount: Number(row.unreadCount),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listDirectConversations(
  viewerId: string,
): Promise<DirectConversationSummary[]> {
  const rows = await selectConversationSummaries(viewerId);
  return rows.map((row) => toConversationSummary(row, viewerId));
}

export async function getDirectConversation(
  viewerId: string,
  conversationId: string,
): Promise<DirectConversationSummary> {
  await assertConversationAccess(getDatabase(), viewerId, conversationId);
  const [row] = await selectConversationSummaries(viewerId, conversationId);

  if (!row) {
    throw conversationNotFoundError();
  }

  return toConversationSummary(row, viewerId);
}

export async function startDirectConversation(
  viewerId: string,
  username: string,
): Promise<DirectConversationSummary> {
  const conversationId = await getDatabase().transaction(
    async (transaction) => {
      const targetId = await resolveMessageTarget(
        transaction,
        viewerId,
        username,
      );
      const [participantLowId, participantHighId] =
        canonicalParticipantIds(viewerId, targetId);
      const [inserted] = await transaction
        .insert(directConversations)
        .values({
          participantLowId,
          participantHighId,
          createdById: viewerId,
        })
        .onConflictDoNothing({
          target: [
            directConversations.participantLowId,
            directConversations.participantHighId,
          ],
        })
        .returning({ id: directConversations.id });

      if (inserted) {
        await consumeRateLimit(transaction, viewerId, "message_start");
        const unreadBaseline = new Date(0);
        await transaction.insert(directConversationReads).values([
          {
            conversationId: inserted.id,
            userId: participantLowId,
            lastReadAt: unreadBaseline,
          },
          {
            conversationId: inserted.id,
            userId: participantHighId,
            lastReadAt: unreadBaseline,
          },
        ]);
        return inserted.id;
      }

      const [existing] = await transaction
        .select({ id: directConversations.id })
        .from(directConversations)
        .where(
          and(
            eq(
              directConversations.participantLowId,
              participantLowId,
            ),
            eq(
              directConversations.participantHighId,
              participantHighId,
            ),
          ),
        )
        .limit(1);

      if (!existing) {
        throw conversationNotFoundError();
      }

      return existing.id;
    },
  );

  return getDirectConversation(viewerId, conversationId);
}

export async function listDirectMessages(
  viewerId: string,
  conversationId: string,
  query: { cursor?: string; limit?: number } = {},
) {
  await assertConversationAccess(getDatabase(), viewerId, conversationId);

  const limit = query.limit ?? DEFAULT_MESSAGE_LIMIT;
  const filters = [eq(directMessages.conversationId, conversationId)];

  if (query.cursor) {
    const cursor = decodeTimelineCursor(
      `${MESSAGE_CURSOR_SCOPE}:${conversationId}`,
      query.cursor,
    );

    filters.push(
      or(
        lt(directMessages.createdAt, cursor.createdAt),
        and(
          eq(directMessages.createdAt, cursor.createdAt),
          lt(directMessages.id, cursor.id),
        ),
      )!,
    );
  }

  const rows = await getDatabase()
    .select({
      id: directMessages.id,
      conversationId: directMessages.conversationId,
      senderId: directMessages.senderId,
      body: directMessages.body,
      createdAt: directMessages.createdAt,
      deletedAt: directMessages.deletedAt,
    })
    .from(directMessages)
    .where(and(...filters))
    .orderBy(desc(directMessages.createdAt), desc(directMessages.id))
    .limit(limit + 1);

  return buildCursorPage({
    rows,
    limit,
    scope: `${MESSAGE_CURSOR_SCOPE}:${conversationId}`,
    toDto: (row): DirectMessageSummary => ({
      id: row.id,
      conversationId: row.conversationId,
      body: row.deletedAt ? "" : row.body,
      isMine: row.senderId === viewerId,
      isDeleted: row.deletedAt !== null,
      createdAt: row.createdAt.toISOString(),
    }),
  });
}

export async function sendDirectMessage(
  viewerId: string,
  conversationId: string,
  body: string,
): Promise<DirectMessageSummary> {
  const now = new Date();

  return getDatabase().transaction(async (transaction) => {
    await lockConversation(transaction, conversationId);
    await assertConversationAccess(transaction, viewerId, conversationId);
    await consumeRateLimit(transaction, viewerId, "message_send", now);

    const [message] = await transaction
      .insert(directMessages)
      .values({ conversationId, senderId: viewerId, body, createdAt: now })
      .returning({
        id: directMessages.id,
        conversationId: directMessages.conversationId,
        body: directMessages.body,
        createdAt: directMessages.createdAt,
      });

    if (!message) {
      throw new AuthError(
        "AUTH_CONFIGURATION_ERROR",
        "Mesaj gönderilemedi.",
        { status: 500 },
      );
    }

    await transaction
      .update(directConversations)
      .set({
        lastMessageId: message.id,
        lastMessageSenderId: viewerId,
        lastMessagePreview: body.slice(0, 160),
        lastMessageAt: now,
      })
      .where(eq(directConversations.id, conversationId));
    await transaction
      .insert(directConversationReads)
      .values({ conversationId, userId: viewerId, lastReadAt: now })
      .onConflictDoUpdate({
        target: [
          directConversationReads.conversationId,
          directConversationReads.userId,
        ],
        set: { lastReadAt: now },
      });

    return {
      id: message.id,
      conversationId: message.conversationId,
      body: message.body,
      isMine: true,
      isDeleted: false,
      createdAt: message.createdAt.toISOString(),
    };
  });
}

export async function markDirectConversationRead(
  viewerId: string,
  conversationId: string,
) {
  await assertConversationAccess(getDatabase(), viewerId, conversationId);
  const now = new Date();

  await getDatabase()
    .insert(directConversationReads)
    .values({ conversationId, userId: viewerId, lastReadAt: now })
    .onConflictDoUpdate({
      target: [
        directConversationReads.conversationId,
        directConversationReads.userId,
      ],
      set: { lastReadAt: now },
    });
}

export async function deleteDirectMessage(
  viewerId: string,
  messageId: string,
) {
  if (!UUID_PATTERN.test(messageId)) {
    throw messageNotFoundError();
  }

  await getDatabase().transaction(async (transaction) => {
    const [message] = await transaction
      .select({
        id: directMessages.id,
        conversationId: directMessages.conversationId,
        senderId: directMessages.senderId,
        deletedAt: directMessages.deletedAt,
      })
      .from(directMessages)
      .where(eq(directMessages.id, messageId))
      .limit(1);

    if (!message || message.senderId !== viewerId || message.deletedAt) {
      throw messageNotFoundError();
    }

    await lockConversation(transaction, message.conversationId);
    const conversation = await assertConversationAccess(
      transaction,
      viewerId,
      message.conversationId,
    );
    const now = new Date();

    await transaction
      .update(directMessages)
      .set({ body: "", deletedAt: now })
      .where(eq(directMessages.id, messageId));

    if (conversation.lastMessageId === messageId) {
      await transaction
        .update(directConversations)
        .set({ lastMessagePreview: DELETED_MESSAGE_PREVIEW })
        .where(eq(directConversations.id, message.conversationId));
    }
  });
}

export async function getUnreadDirectMessageCount(
  viewerId: string,
): Promise<number> {
  const peerId = otherParticipantId(viewerId);
  const [row] = await getDatabase()
    .select({ total: count() })
    .from(directMessages)
    .innerJoin(
      directConversations,
      eq(directConversations.id, directMessages.conversationId),
    )
    .innerJoin(conversationPeer, eq(conversationPeer.id, peerId))
    .innerJoin(
      directConversationReads,
      and(
        eq(
          directConversationReads.conversationId,
          directConversations.id,
        ),
        eq(directConversationReads.userId, viewerId),
      ),
    )
    .where(
      and(
        participantFilter(viewerId),
        ne(directMessages.senderId, viewerId),
        isNull(directMessages.deletedAt),
        gt(
          directMessages.createdAt,
          directConversationReads.lastReadAt,
        ),
        eq(conversationPeer.status, "active"),
        isNull(conversationPeer.deletedAt),
        noBlockBetween(viewerId, conversationPeer.id),
      ),
    );

  return row?.total ?? 0;
}
