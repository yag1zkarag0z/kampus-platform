import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./accounts";

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const feedbackCategory = pgEnum("feedback_category", [
  "bug",
  "suggestion",
  "other",
]);

export const feedbackStatus = pgEnum("feedback_status", [
  "new",
  "reviewing",
  "resolved",
  "dismissed",
]);

export const feedbackSessionMode = pgEnum("feedback_session_mode", [
  "member",
  "guest",
]);

export const productFeedback = pgTable(
  "product_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sessionMode: feedbackSessionMode("session_mode").notNull(),
    // Ham IP tutulmaz. Misafir kotası AUTH_SECRET ile HMAC'lenmiş bu özetle
    // uygulanır; üye satırlarında null kalır.
    requestIpHash: varchar("request_ip_hash", { length: 64 }),
    category: feedbackCategory("category").notNull(),
    message: varchar("message", { length: 1000 }).notNull(),
    pagePath: varchar("page_path", { length: 240 }).notNull(),
    status: feedbackStatus("status").default("new").notNull(),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithTimezone("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("product_feedback_status_created_at_idx").on(
      table.status,
      table.createdAt.desc(),
    ),
    index("product_feedback_category_created_at_idx").on(
      table.category,
      table.createdAt.desc(),
    ),
    index("product_feedback_user_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
    index("product_feedback_guest_ip_created_at_idx")
      .on(table.requestIpHash, table.createdAt.desc())
      .where(sql`${table.requestIpHash} is not null`),
    index("product_feedback_created_at_idx").on(table.createdAt),
    check(
      "product_feedback_submitter_check",
      sql`(
          ${table.sessionMode} = 'guest'
          and ${table.userId} is null
          and ${table.requestIpHash} ~ '^[0-9a-f]{64}$'
        ) or (
          ${table.sessionMode} = 'member'
          and ${table.requestIpHash} is null
        )`,
    ),
    check(
      "product_feedback_message_length_check",
      sql`char_length(btrim(${table.message})) between 20 and 1000`,
    ),
    check(
      "product_feedback_page_path_check",
      sql`char_length(${table.pagePath}) between 1 and 240
        and left(${table.pagePath}, 1) = '/'
        and left(${table.pagePath}, 2) <> '//'`,
    ),
    check(
      "product_feedback_review_state_check",
      sql`(
          ${table.status} = 'new'
          and ${table.reviewedBy} is null
          and ${table.reviewedAt} is null
        ) or (
          ${table.status} <> 'new'
          and ${table.reviewedAt} is not null
        )`,
    ),
    check(
      "product_feedback_updated_at_order_check",
      sql`${table.updatedAt} >= ${table.createdAt}
        and (${table.reviewedAt} is null or ${table.reviewedAt} >= ${table.createdAt})`,
    ),
  ],
);

export type ProductFeedback = typeof productFeedback.$inferSelect;
