import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
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
  directMessageRequestCooldowns,
  directMessages,
  follows,
  users,
} from "@/server/db/schema";
import {
  buildCursorPage,
  decodeTimelineCursor,
} from "@/server/pagination/cursor";
import { DATA_RETENTION_POLICY } from "@/server/maintenance/policy";
import { consumeRateLimit } from "@/server/rate-limit/service";
import {
  hasBlockBetween,
  noBlockBetween,
} from "@/server/social/blocking";
import { applyUserBlock } from "@/server/social/block-user";

type MessagingDatabase = ReturnType<typeof getDatabase>;
type MessagingTransaction = Parameters<
  Parameters<MessagingDatabase["transaction"]>[0]
>[0];
type MessagingExecutor = MessagingDatabase | MessagingTransaction;

const DEFAULT_MESSAGE_LIMIT = 50;
const DEFAULT_CONVERSATION_LIMIT = 20;
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
  requestStatus: "pending" | "accepted";
  requestDirection: "incoming" | "outgoing" | null;
  createdAt: string;
};

export type DirectConversationBox = "inbox" | "requests";
export type DirectMessageRequestAction = "accept" | "delete" | "block";

export type DirectMessageSummary = {
  id: string;
  conversationId: string;
  body: string;
  isMine: boolean;
  isDeleted: boolean;
  isSeen: boolean;
  createdAt: string;
};

function normalizeConversationSearch(value?: string) {
  return value?.normalize("NFKC").trim().replace(/\s+/gu, " ") ?? "";
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}

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

function messageIdempotencyConflictError() {
  return new AuthError(
    "INVALID_REQUEST",
    "Bu mesaj kimli\u011fi farkl\u0131 bir g\u00f6nderim i\u00e7in kullan\u0131lm\u0131\u015f.",
    {
      fieldErrors: {
        clientMessageId: ["Mesaj\u0131 yeniden yaz\u0131p tekrar dene."],
      },
      status: 409,
    },
  );
}

function pendingRequestSendError(isSender: boolean) {
  return new AuthError(
    "CONTENT_FORBIDDEN",
    isSender
      ? "Mesaj isteği kabul edilene kadar yalnızca bir mesaj gönderebilirsin."
      : "Yanıtlamak için önce mesaj isteğini kabul et.",
    { status: 403 },
  );
}

function requestCooldownError(cooldownUntil: Date, now: Date) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((cooldownUntil.getTime() - now.getTime()) / 1_000),
  );

  return new AuthError(
    "CONTENT_RATE_LIMITED",
    "Bu kişiye yeni bir mesaj isteği göndermeden önce biraz beklemelisin.",
    { retryAfterSeconds, status: 429 },
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

async function areMutualFollowers(
  executor: MessagingExecutor,
  firstId: string,
  secondId: string,
) {
  const [row] = await executor
    .select({ total: count() })
    .from(follows)
    .where(
      or(
        and(
          eq(follows.followerId, firstId),
          eq(follows.followingId, secondId),
        ),
        and(
          eq(follows.followerId, secondId),
          eq(follows.followingId, firstId),
        ),
      ),
    );

  return Number(row?.total ?? 0) === 2;
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
      createdById: directConversations.createdById,
      requestStatus: directConversations.requestStatus,
      requestResolvedAt: directConversations.requestResolvedAt,
      lastMessageId: directConversations.lastMessageId,
      lastMessageAt: directConversations.lastMessageAt,
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

async function lockConversationPair(
  transaction: MessagingTransaction,
  participantLowId: string,
  participantHighId: string,
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`direct-conversation-pair:${participantLowId}:${participantHighId}`}, 0))`,
  );
}

async function lockMessageAttempt(
  transaction: MessagingTransaction,
  viewerId: string,
  clientMessageId: string,
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`direct-message-client:${viewerId}:${clientMessageId}`}, 0))`,
  );
}

function unreadAfterReadCursor(): SQL {
  return or(
    isNull(directConversationReads.lastReadMessageId),
    gt(directMessages.createdAt, directConversationReads.lastReadAt),
    and(
      eq(directMessages.createdAt, directConversationReads.lastReadAt),
      gt(directMessages.id, directConversationReads.lastReadMessageId),
    ),
  )!;
}

async function advanceReadCursor(
  executor: MessagingExecutor,
  viewerId: string,
  conversationId: string,
  message: { id: string; createdAt: Date },
) {
  await executor
    .insert(directConversationReads)
    .values({
      conversationId,
      userId: viewerId,
      lastReadAt: message.createdAt,
      lastReadMessageId: message.id,
    })
    .onConflictDoUpdate({
      target: [
        directConversationReads.conversationId,
        directConversationReads.userId,
      ],
      set: {
        lastReadAt: message.createdAt,
        lastReadMessageId: message.id,
      },
      setWhere: or(
        lt(directConversationReads.lastReadAt, message.createdAt),
        and(
          eq(directConversationReads.lastReadAt, message.createdAt),
          or(
            isNull(directConversationReads.lastReadMessageId),
            lt(directConversationReads.lastReadMessageId, message.id),
          ),
        ),
      )!,
    });
}

const conversationPeer = alias(users, "direct_conversation_peer");

async function selectConversationSummaries(
  viewerId: string,
  conversationId?: string,
  box: DirectConversationBox = "inbox",
  query: { cursor?: string; limit?: number; search?: string } = {},
) {
  const peerId = otherParticipantId(viewerId);
  const sortAt = sql<Date>`coalesce(
    ${directConversations.lastMessageAt},
    ${directConversations.createdAt}
  )`.mapWith(directConversations.createdAt);
  const normalizedSearch = normalizeConversationSearch(query.search);
  const scope = normalizedSearch
    ? `direct-conversations:${box}:search:${normalizedSearch.toLocaleLowerCase("tr-TR")}`
    : `direct-conversations:${box}`;
  const filters = [
    participantFilter(viewerId),
    eq(conversationPeer.status, "active"),
    isNull(conversationPeer.deletedAt),
    noBlockBetween(viewerId, conversationPeer.id),
  ];

  if (conversationId) {
    filters.push(eq(directConversations.id, conversationId));
  } else if (box === "requests") {
    filters.push(
      eq(directConversations.requestStatus, "pending"),
      ne(directConversations.createdById, viewerId),
      sql`${directConversations.lastMessageAt} is not null`,
    );
  } else {
    // Gönderilmiş istekler gönderenin ana kutusunda kalır. Gelen istekler ise
    // alıcı kabul edene kadar ayrı istekler kutusunda gösterilir.
    filters.push(
      or(
        eq(directConversations.requestStatus, "accepted"),
        and(
          eq(directConversations.requestStatus, "pending"),
          eq(directConversations.createdById, viewerId),
        ),
      )!,
      or(
        sql`${directConversations.lastMessageAt} is not null`,
        eq(directConversations.createdById, viewerId),
      )!,
    );
  }

  if (!conversationId && normalizedSearch) {
    const pattern = `%${escapeLikePattern(normalizedSearch)}%`;
    filters.push(
      or(
        ilike(conversationPeer.displayName, pattern),
        ilike(conversationPeer.username, pattern),
        ilike(directConversations.lastMessagePreview, pattern),
      )!,
    );
  }

  if (!conversationId && query.cursor) {
    const cursor = decodeTimelineCursor(scope, query.cursor);

    filters.push(
      or(
        lt(sortAt, cursor.createdAt),
        and(
          eq(sortAt, cursor.createdAt),
          lt(directConversations.id, cursor.id),
        ),
      )!,
    );
  }

  const unreadCount = sql<number>`(
    select count(*)::int
    from ${directMessages}
    where ${directMessages.conversationId} = ${directConversations.id}
      and ${directMessages.senderId} <> ${viewerId}
      and ${directMessages.deletedAt} is null
      and ${unreadAfterReadCursor()}
  )`;

  return getDatabase()
    .select({
      id: directConversations.id,
      createdAt: sortAt,
      conversationCreatedAt: directConversations.createdAt,
      createdById: directConversations.createdById,
      requestStatus: directConversations.requestStatus,
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
      desc(sortAt),
      desc(directConversations.id),
    )
    .limit(
      conversationId
        ? 1
        : Math.min(
            query.limit ?? DEFAULT_CONVERSATION_LIMIT,
            MAX_CONVERSATION_LIMIT,
          ) + 1,
    );
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
    requestStatus:
      row.requestStatus === "pending" ? "pending" : "accepted",
    requestDirection:
      row.requestStatus === "pending"
        ? row.createdById === viewerId
          ? "outgoing"
          : "incoming"
        : null,
    createdAt: row.conversationCreatedAt.toISOString(),
  };
}

export async function listDirectConversations(
  viewerId: string,
  box: DirectConversationBox = "inbox",
  query: { cursor?: string; limit?: number; search?: string } = {},
) {
  const limit = Math.min(
    query.limit ?? DEFAULT_CONVERSATION_LIMIT,
    MAX_CONVERSATION_LIMIT,
  );
  const normalizedSearch = normalizeConversationSearch(query.search);
  const scope = normalizedSearch
    ? `direct-conversations:${box}:search:${normalizedSearch.toLocaleLowerCase("tr-TR")}`
    : `direct-conversations:${box}`;
  const rows = await selectConversationSummaries(
    viewerId,
    undefined,
    box,
    { ...query, limit },
  );

  return buildCursorPage({
    rows,
    limit,
    scope,
    toDto: (row) => toConversationSummary(row, viewerId),
  });
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
      await lockConversationPair(
        transaction,
        participantLowId,
        participantHighId,
      );

      const mutualFollow = await areMutualFollowers(
        transaction,
        viewerId,
        targetId,
      );
      const [existing] = await transaction
        .select({
          id: directConversations.id,
          createdById: directConversations.createdById,
          requestStatus: directConversations.requestStatus,
        })
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

      if (existing) {
        if (
          existing.requestStatus === "pending" &&
          (mutualFollow || existing.createdById !== viewerId)
        ) {
          await transaction
            .update(directConversations)
            .set({
              requestStatus: "accepted",
              requestResolvedAt: new Date(),
            })
            .where(eq(directConversations.id, existing.id));
        }

        return existing.id;
      }

      const now = new Date();
      if (!mutualFollow) {
        const [cooldown] = await transaction
          .select({
            cooldownUntil: directMessageRequestCooldowns.cooldownUntil,
          })
          .from(directMessageRequestCooldowns)
          .where(
            and(
              eq(directMessageRequestCooldowns.senderId, viewerId),
              eq(directMessageRequestCooldowns.recipientId, targetId),
            ),
          )
          .limit(1);

        if (cooldown && cooldown.cooldownUntil > now) {
          throw requestCooldownError(cooldown.cooldownUntil, now);
        }

        if (cooldown) {
          await transaction
            .delete(directMessageRequestCooldowns)
            .where(
              and(
                eq(directMessageRequestCooldowns.senderId, viewerId),
                eq(directMessageRequestCooldowns.recipientId, targetId),
              ),
            );
        }
      }

      const [inserted] = await transaction
        .insert(directConversations)
        .values({
          participantLowId,
          participantHighId,
          createdById: viewerId,
          requestStatus: mutualFollow ? "accepted" : "pending",
          requestResolvedAt: mutualFollow ? now : null,
          createdAt: now,
        })
        .returning({ id: directConversations.id });

      if (!inserted) {
        throw conversationNotFoundError();
      }

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
    },
  );

  return getDirectConversation(viewerId, conversationId);
}

export async function listDirectMessages(
  viewerId: string,
  conversationId: string,
  query: { cursor?: string; limit?: number } = {},
) {
  const database = getDatabase();
  const conversation = await assertConversationAccess(
    database,
    viewerId,
    conversationId,
  );
  const [peerReadCursor] = await database
    .select({
      lastReadAt: directConversationReads.lastReadAt,
      lastReadMessageId: directConversationReads.lastReadMessageId,
    })
    .from(directConversationReads)
    .where(
      and(
        eq(directConversationReads.conversationId, conversationId),
        eq(directConversationReads.userId, conversation.otherUserId),
      ),
    )
    .limit(1);

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

  const rows = await database
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
      isSeen:
        row.senderId === viewerId &&
        Boolean(
          peerReadCursor &&
            (peerReadCursor.lastReadAt > row.createdAt ||
              (peerReadCursor.lastReadAt.getTime() === row.createdAt.getTime() &&
                peerReadCursor.lastReadMessageId !== null &&
                peerReadCursor.lastReadMessageId >= row.id)),
        ),
      createdAt: row.createdAt.toISOString(),
    }),
  });
}

export async function sendDirectMessage(
  viewerId: string,
  conversationId: string,
  body: string,
  clientMessageId: string,
): Promise<DirectMessageSummary> {
  if (!UUID_PATTERN.test(clientMessageId)) {
    throw messageIdempotencyConflictError();
  }

  return getDatabase().transaction(async (transaction) => {
    await lockMessageAttempt(transaction, viewerId, clientMessageId);
    await lockConversation(transaction, conversationId);
    const conversation = await assertConversationAccess(
      transaction,
      viewerId,
      conversationId,
    );

    const [existingMessage] = await transaction
      .select({
        id: directMessages.id,
        conversationId: directMessages.conversationId,
        body: directMessages.body,
        createdAt: directMessages.createdAt,
        deletedAt: directMessages.deletedAt,
      })
      .from(directMessages)
      .where(
        and(
          eq(directMessages.senderId, viewerId),
          eq(directMessages.clientMessageId, clientMessageId),
        ),
      )
      .limit(1);

    if (existingMessage) {
      if (
        existingMessage.conversationId !== conversationId ||
        (!existingMessage.deletedAt && existingMessage.body !== body)
      ) {
        throw messageIdempotencyConflictError();
      }

      return {
        id: existingMessage.id,
        conversationId: existingMessage.conversationId,
        body: existingMessage.deletedAt ? "" : existingMessage.body,
        isMine: true,
        isDeleted: existingMessage.deletedAt !== null,
        isSeen: false,
        createdAt: existingMessage.createdAt.toISOString(),
      };
    }

    if (conversation.requestStatus === "pending") {
      const isRequestSender = conversation.createdById === viewerId;

      if (!isRequestSender || conversation.lastMessageId) {
        throw pendingRequestSendError(isRequestSender);
      }
    }

    await consumeRateLimit(transaction, viewerId, "message_send");

    // Create the timestamp after acquiring the lock so waiting requests cannot
    // move the conversation clock backwards. Advancing at least 1 ms beyond
    // the previous message also protects ordering if the system clock shifts.
    const now = new Date(
      Math.max(
        Date.now(),
        (conversation.lastMessageAt?.getTime() ?? -1) + 1,
      ),
    );

    const [message] = await transaction
      .insert(directMessages)
      .values({
        conversationId,
        senderId: viewerId,
        clientMessageId,
        body,
        createdAt: now,
      })
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
    await advanceReadCursor(transaction, viewerId, conversationId, message);

    return {
      id: message.id,
      conversationId: message.conversationId,
      body: message.body,
      isMine: true,
      isDeleted: false,
      isSeen: false,
      createdAt: message.createdAt.toISOString(),
    };
  });
}

export async function resolveDirectMessageRequest(
  viewerId: string,
  conversationId: string,
  action: DirectMessageRequestAction,
): Promise<DirectConversationSummary | null> {
  const acceptedConversationId = await getDatabase().transaction(
    async (transaction) => {
      await lockConversation(transaction, conversationId);
      const conversation = await assertConversationAccess(
        transaction,
        viewerId,
        conversationId,
      );

      if (
        conversation.requestStatus !== "pending" ||
        conversation.createdById === viewerId ||
        !conversation.lastMessageId
      ) {
        throw new AuthError(
          "CONTENT_FORBIDDEN",
          "Bu mesaj isteği için bu işlemi yapamazsın.",
          { status: 403 },
        );
      }

      if (action === "accept") {
        await transaction
          .update(directConversations)
          .set({
            requestStatus: "accepted",
            requestResolvedAt: new Date(),
          })
          .where(eq(directConversations.id, conversationId));
        await transaction
          .delete(directMessageRequestCooldowns)
          .where(
            and(
              eq(
                directMessageRequestCooldowns.senderId,
                conversation.createdById,
              ),
              eq(directMessageRequestCooldowns.recipientId, viewerId),
            ),
          );

        return conversationId;
      }

      if (action === "block") {
        await applyUserBlock(
          transaction,
          viewerId,
          conversation.otherUserId,
        );
      } else {
        const rejectedAt = new Date();
        const cooldownUntil = new Date(
          rejectedAt.getTime() +
            DATA_RETENTION_POLICY.messageRequestCooldownMs,
        );
        await transaction
          .insert(directMessageRequestCooldowns)
          .values({
            senderId: conversation.createdById,
            recipientId: viewerId,
            rejectedAt,
            cooldownUntil,
          })
          .onConflictDoUpdate({
            target: [
              directMessageRequestCooldowns.senderId,
              directMessageRequestCooldowns.recipientId,
            ],
            set: { rejectedAt, cooldownUntil },
          });
      }

      await transaction
        .delete(directConversations)
        .where(eq(directConversations.id, conversationId));

      return null;
    },
  );

  return acceptedConversationId
    ? getDirectConversation(viewerId, acceptedConversationId)
    : null;
}

export async function markDirectConversationRead(
  viewerId: string,
  conversationId: string,
  messageId: string,
) {
  if (!UUID_PATTERN.test(messageId)) {
    throw messageNotFoundError();
  }

  await getDatabase().transaction(async (transaction) => {
    await assertConversationAccess(transaction, viewerId, conversationId);
    const [message] = await transaction
      .select({
        id: directMessages.id,
        createdAt: directMessages.createdAt,
      })
      .from(directMessages)
      .where(
        and(
          eq(directMessages.id, messageId),
          eq(directMessages.conversationId, conversationId),
        ),
      )
      .limit(1);

    if (!message) {
      throw messageNotFoundError();
    }

    await advanceReadCursor(
      transaction,
      viewerId,
      conversationId,
      message,
    );
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
    .where(
      and(
        participantFilter(viewerId),
        ne(directMessages.senderId, viewerId),
        isNull(directMessages.deletedAt),
        unreadAfterReadCursor(),
        eq(conversationPeer.status, "active"),
        isNull(conversationPeer.deletedAt),
        noBlockBetween(viewerId, conversationPeer.id),
      ),
    );

  return row?.total ?? 0;
}
