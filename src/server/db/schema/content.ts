import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
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

export const postCategory = pgEnum("post_category", [
  "chat",
  "confession",
  "question",
  "event",
  "lost_found",
  "poll",
  "listing",
]);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    category: postCategory("category").notNull(),
    isAnonymous: boolean("is_anonymous").default(false).notNull(),
    title: varchar("title", { length: 100 }).default("").notNull(),
    body: varchar("body", { length: 500 }).default("").notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    editedAt: timestampWithTimezone("edited_at"),
    deletedAt: timestampWithTimezone("deleted_at"),
  },
  (table) => [
    index("posts_active_feed_cursor_idx")
      .on(table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    index("posts_active_category_feed_cursor_idx")
      .on(table.category, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    index("posts_active_author_feed_cursor_idx")
      .on(table.authorId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    check(
      "posts_content_not_blank_check",
      sql`char_length(btrim(${table.title})) > 0
        or char_length(btrim(${table.body})) > 0`,
    ),
    check(
      "posts_edited_at_order_check",
      sql`${table.editedAt} is null
        or ${table.editedAt} >= ${table.createdAt}`,
    ),
    check(
      "posts_deleted_at_order_check",
      sql`${table.deletedAt} is null
        or ${table.deletedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    parentId: uuid("parent_id"),
    isAnonymous: boolean("is_anonymous").default(false).notNull(),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    editedAt: timestampWithTimezone("edited_at"),
    deletedAt: timestampWithTimezone("deleted_at"),
  },
  (table) => [
    unique("comments_id_post_id_unique").on(table.id, table.postId),
    foreignKey({
      name: "comments_parent_post_comments_id_post_fk",
      columns: [table.parentId, table.postId],
      foreignColumns: [table.id, table.postId],
    }).onDelete("cascade"),
    index("comments_active_post_cursor_idx")
      .on(table.postId, table.createdAt, table.id)
      .where(sql`${table.deletedAt} is null`),
    index("comments_post_cursor_idx").on(
      table.postId,
      table.createdAt,
      table.id,
    ),
    index("comments_parent_id_idx")
      .on(table.parentId)
      .where(sql`${table.parentId} is not null`),
    index("comments_author_id_idx").on(table.authorId),
    check(
      "comments_body_not_blank_check",
      sql`char_length(btrim(${table.body})) > 0`,
    ),
    check(
      "comments_parent_not_self_check",
      sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`,
    ),
    check(
      "comments_edited_at_order_check",
      sql`${table.editedAt} is null
        or ${table.editedAt} >= ${table.createdAt}`,
    ),
    check(
      "comments_deleted_at_order_check",
      sql`${table.deletedAt} is null
        or ${table.deletedAt} >= ${table.createdAt}`,
    ),
  ],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
