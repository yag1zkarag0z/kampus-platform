import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./accounts";

const timestampWithTimezone = (name: string) =>
  timestamp(name, {
    withTimezone: true,
    mode: "date",
    precision: 3,
  });

/**
 * İlk sürüm yalnızca bire bir konuşma taşır. Kullanıcı kimlikleri her zaman
 * küçük/büyük sırasıyla yazılır; böylece aynı çift için iki ayrı konuşma
 * yarış koşulunda dahi açılamaz.
 */
export const directConversations = pgTable(
  "direct_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participantLowId: uuid("participant_low_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    participantHighId: uuid("participant_high_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageId: uuid("last_message_id"),
    lastMessageSenderId: uuid("last_message_sender_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    lastMessagePreview: varchar("last_message_preview", { length: 160 }),
    lastMessageAt: timestampWithTimezone("last_message_at"),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("direct_conversations_pair_unique").on(
      table.participantLowId,
      table.participantHighId,
    ),
    index("direct_conversations_low_last_message_idx").on(
      table.participantLowId,
      table.lastMessageAt.desc(),
    ),
    index("direct_conversations_high_last_message_idx").on(
      table.participantHighId,
      table.lastMessageAt.desc(),
    ),
    check(
      "direct_conversations_participant_order_check",
      sql`${table.participantLowId} < ${table.participantHighId}`,
    ),
    check(
      "direct_conversations_creator_is_participant_check",
      sql`${table.createdById} in (${table.participantLowId}, ${table.participantHighId})`,
    ),
    check(
      "direct_conversations_last_message_shape_check",
      sql`(
          ${table.lastMessageId} is null
          and ${table.lastMessageSenderId} is null
          and ${table.lastMessagePreview} is null
          and ${table.lastMessageAt} is null
        ) or (
          ${table.lastMessageId} is not null
          and ${table.lastMessageSenderId} is not null
          and ${table.lastMessagePreview} is not null
          and ${table.lastMessageAt} is not null
          and ${table.lastMessageSenderId} in (${table.participantLowId}, ${table.participantHighId})
        )`,
    ),
    check(
      "direct_conversations_last_message_order_check",
      sql`${table.lastMessageAt} is null or ${table.lastMessageAt} >= ${table.createdAt}`,
    ),
  ],
);

export const directConversationReads = pgTable(
  "direct_conversation_reads",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => directConversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestampWithTimezone("last_read_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "direct_conversation_reads_pk",
      columns: [table.conversationId, table.userId],
    }),
    index("direct_conversation_reads_user_idx").on(
      table.userId,
      table.lastReadAt,
    ),
  ],
);

export const directMessages = pgTable(
  "direct_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => directConversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 1000 }).notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    deletedAt: timestampWithTimezone("deleted_at"),
  },
  (table) => [
    index("direct_messages_conversation_cursor_idx").on(
      table.conversationId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("direct_messages_sender_idx").on(table.senderId),
    index("direct_messages_deleted_at_idx")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check(
      "direct_messages_body_state_check",
      sql`(${table.deletedAt} is null and char_length(btrim(${table.body})) > 0)
        or (${table.deletedAt} is not null and ${table.body} = '')`,
    ),
    check(
      "direct_messages_deleted_at_order_check",
      sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
    ),
  ],
);

export type DirectConversation = typeof directConversations.$inferSelect;
export type DirectConversationRead = typeof directConversationReads.$inferSelect;
export type DirectMessage = typeof directMessages.$inferSelect;
