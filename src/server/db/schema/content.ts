import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  unique,
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

export const postCategory = pgEnum("post_category", [
  "chat",
  "confession",
  "question",
  "event",
  "lost_found",
  "poll",
  "listing",
]);

export const listingType = pgEnum("listing_type", [
  "sale",
  "wanted",
  "free",
]);

export const listingCondition = pgEnum("listing_condition", [
  "new",
  "lightly_used",
  "used",
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
    gifId: varchar("gif_id", { length: 80 }),
    gifUrl: varchar("gif_url", { length: 2048 }),
    gifWidth: integer("gif_width"),
    gifHeight: integer("gif_height"),
    gifAlt: varchar("gif_alt", { length: 160 }),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    editedAt: timestampWithTimezone("edited_at"),
    // Şikâyet eşiği aşıldığında otomatik gizleme. Silme değildir: moderatör
    // haksız bulursa geri açılır.
    hiddenAt: timestampWithTimezone("hidden_at"),
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
    index("posts_deleted_at_idx")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check(
      "posts_content_not_blank_check",
      sql`char_length(btrim(${table.title})) > 0
        or char_length(btrim(${table.body})) > 0`,
    ),
    check(
      "posts_gif_metadata_check",
      sql`(${table.gifId} is null
          and ${table.gifUrl} is null
          and ${table.gifWidth} is null
          and ${table.gifHeight} is null
          and ${table.gifAlt} is null)
        or (${table.gifId} is not null
          and ${table.gifUrl} like 'https://%'
          and ${table.gifWidth} between 1 and 4096
          and ${table.gifHeight} between 1 and 4096
          and char_length(btrim(${table.gifAlt})) > 0)`,
    ),
    check(
      "posts_edited_at_order_check",
      sql`${table.editedAt} is null
        or ${table.editedAt} >= ${table.createdAt}`,
    ),
    check(
      "posts_hidden_at_order_check",
      sql`${table.hiddenAt} is null
        or ${table.hiddenAt} >= ${table.createdAt}`,
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
    gifId: varchar("gif_id", { length: 80 }),
    gifUrl: varchar("gif_url", { length: 2048 }),
    gifWidth: integer("gif_width"),
    gifHeight: integer("gif_height"),
    gifAlt: varchar("gif_alt", { length: 160 }),
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
    index("comments_deleted_at_idx")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check(
      "comments_body_not_blank_check",
      sql`char_length(btrim(${table.body})) > 0
        or ${table.gifId} is not null`,
    ),
    check(
      "comments_gif_metadata_check",
      sql`(${table.gifId} is null
          and ${table.gifUrl} is null
          and ${table.gifWidth} is null
          and ${table.gifHeight} is null
          and ${table.gifAlt} is null)
        or (${table.gifId} is not null
          and ${table.gifUrl} like 'https://%'
          and ${table.gifWidth} between 1 and 4096
          and ${table.gifHeight} between 1 and 4096
          and char_length(btrim(${table.gifAlt})) > 0)`,
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

export const postLikes = pgTable(
  "post_likes",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "post_likes_pk",
      columns: [table.postId, table.userId],
    }),
    index("post_likes_user_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);

/** Yorum beğenileri; gönderi beğenileriyle aynı idempotent desen. */
export const commentLikes = pgTable(
  "comment_likes",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "comment_likes_pk",
      columns: [table.commentId, table.userId],
    }),
    index("comment_likes_user_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);

export const postBookmarks = pgTable(
  "post_bookmarks",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "post_bookmarks_pk",
      columns: [table.postId, table.userId],
    }),
    index("post_bookmarks_user_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);

export const listings = pgTable(
  "listings",
  {
    postId: uuid("post_id")
      .primaryKey()
      .references(() => posts.id, { onDelete: "cascade" }),
    type: listingType("type").notNull(),
    condition: listingCondition("condition").notNull(),
    price: integer("price").notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("listings_type_price_idx").on(table.type, table.price),
    check(
      "listings_price_check",
      sql`(
        ${table.type} = 'free' and ${table.price} = 0
      ) or (
        ${table.type} <> 'free'
        and ${table.price} between 1 and 1000000
      )`,
    ),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 255 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 32 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("media_assets_owner_created_at_idx").on(
      table.ownerId,
      table.createdAt.desc(),
    ),
    index("media_assets_created_at_idx").on(table.createdAt),
    check(
      "media_assets_image_metadata_check",
      sql`${table.mimeType} = 'image/webp'
        and ${table.sizeBytes} between 1 and 1048576
        and ${table.width} between 1 and 4096
        and ${table.height} between 1 and 4096
        and ${table.checksum} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const postImages = pgTable(
  "post_images",
  {
    postId: uuid("post_id")
      .primaryKey()
      .references(() => posts.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .unique()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    alt: varchar("alt", { length: 160 }).notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "post_images_alt_not_blank_check",
      sql`char_length(btrim(${table.alt})) > 0`,
    ),
  ],
);

/**
 * `mediaAssets`'ten ayrı: o tablonun check constraint'i mimeType'ı
 * 'image/webp' ve width/height'ı zorunlu kılıyor, PDF'e gevşetmek mevcut
 * görsel kısıtını riske atardı. Aynı desenin PDF'e özel paralel kopyası.
 */
export const documentAssets = pgTable(
  "document_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 255 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 32 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    fileName: varchar("file_name", { length: 160 }).notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_assets_owner_created_at_idx").on(
      table.ownerId,
      table.createdAt.desc(),
    ),
    index("document_assets_created_at_idx").on(table.createdAt),
    check(
      "document_assets_pdf_metadata_check",
      sql`${table.mimeType} = 'application/pdf'
        and ${table.sizeBytes} between 1 and 8388608
        and char_length(btrim(${table.fileName})) > 0
        and ${table.checksum} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const postDocuments = pgTable(
  "post_documents",
  {
    postId: uuid("post_id")
      .primaryKey()
      .references(() => posts.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .unique()
      .references(() => documentAssets.id, { onDelete: "restrict" }),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
);

export const polls = pgTable("polls", {
  postId: uuid("post_id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
});

export const pollOptions = pgTable(
  "poll_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.postId, { onDelete: "cascade" }),
    text: varchar("text", { length: 60 }).notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    unique("poll_options_id_poll_id_unique").on(table.id, table.pollId),
    unique("poll_options_poll_position_unique").on(
      table.pollId,
      table.position,
    ),
    check(
      "poll_options_text_not_blank_check",
      sql`char_length(btrim(${table.text})) > 0`,
    ),
    check(
      "poll_options_position_check",
      sql`${table.position} >= 0 and ${table.position} < 4`,
    ),
  ],
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.postId, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    optionId: uuid("option_id").notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithTimezone("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "poll_votes_pk",
      columns: [table.pollId, table.userId],
    }),
    foreignKey({
      name: "poll_votes_option_poll_options_id_poll_fk",
      columns: [table.optionId, table.pollId],
      foreignColumns: [pollOptions.id, pollOptions.pollId],
    }).onDelete("cascade"),
    index("poll_votes_option_id_idx").on(table.optionId),
    index("poll_votes_user_updated_at_idx").on(
      table.userId,
      table.updatedAt.desc(),
    ),
  ],
);

export const reportReason = pgEnum("report_reason", [
  "spam",
  "harassment",
  "personal_information",
  "misleading",
  "other",
]);

export const reportTargetType = pgEnum("report_target_type", [
  "post",
  "comment",
]);

export const reportStatus = pgEnum("report_status", [
  "pending",
  "resolved",
]);

export const reportResolution = pgEnum("report_resolution", [
  "dismissed",
  "content_removed",
  "user_suspended",
]);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: reportTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    reason: reportReason("reason").notNull(),
    detail: varchar("detail", { length: 300 }).default("").notNull(),
    status: reportStatus("status").default("pending").notNull(),
    resolution: reportResolution("resolution"),
    resolutionNote: varchar("resolution_note", { length: 240 }),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestampWithTimezone("resolved_at"),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("reports_reporter_target_unique").on(
      table.reporterId,
      table.targetType,
      table.targetId,
    ),
    index("reports_status_idx").on(table.status),
    index("reports_post_id_idx").on(table.postId),
    index("reports_resolved_at_idx")
      .on(table.resolvedAt)
      .where(sql`${table.resolvedAt} is not null`),
    check(
      "reports_detail_length_check",
      sql`char_length(${table.detail}) <= 300`,
    ),
    check(
      "reports_resolution_state_check",
      sql`(
          ${table.status} = 'pending'
          and ${table.resolution} is null
          and ${table.resolvedBy} is null
          and ${table.resolvedAt} is null
        ) or (
          ${table.status} = 'resolved'
          and ${table.resolution} is not null
          and ${table.resolvedBy} is not null
          and ${table.resolvedAt} is not null
        )`,
    ),
    check(
      "reports_resolved_at_order_check",
      sql`${table.resolvedAt} is null
        or ${table.resolvedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const moderationActionType = pgEnum("moderation_action_type", [
  "report_dismissed",
  "content_removed",
  "content_hidden",
  "content_restored",
  "user_suspended",
  "user_restored",
  "role_changed",
]);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Otomatik gizlemede insan aktör yok; bu yüzden null olabilir.
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    action: moderationActionType("action").notNull(),
    reportId: uuid("report_id").references(() => reports.id, {
      onDelete: "set null",
    }),
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    postId: uuid("post_id").references(() => posts.id, {
      onDelete: "set null",
    }),
    note: varchar("note", { length: 240 }),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("moderation_actions_created_at_idx").on(table.createdAt),
    index("moderation_actions_target_user_id_idx").on(
      table.targetUserId,
    ),
  ],
);

/**
 * Yazma işlemlerinin hız sınırı sayaçları.
 *
 * Beğeni, kaydetme ve takip gibi işlemler geri alınabildiği için kendi
 * tablolarını sayarak sınır uygulanamaz: kullanıcı satırı silip yeniden
 * ekleyerek sınırı sıfırlar. Bu tablo yalnızca eklenir, hiç silinmez;
 * eski kayıtları temizlik görevi toplar.
 */
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 40 }).notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("rate_limit_hits_user_action_created_at_idx").on(
      table.userId,
      table.action,
      table.createdAt.desc(),
    ),
    index("rate_limit_hits_user_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
    index("rate_limit_hits_created_at_idx").on(table.createdAt),
    check(
      "rate_limit_hits_action_not_blank_check",
      sql`char_length(btrim(${table.action})) > 0`,
    ),
  ],
);

export const notificationKind = pgEnum("notification_kind", [
  "like",
  "comment",
  "reply",
  "mention",
  "follow",
  "announcement",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    postId: uuid("post_id").references(() => posts.id, {
      onDelete: "cascade",
    }),
    commentId: uuid("comment_id").references(() => comments.id, {
      onDelete: "cascade",
    }),
    likeCount: integer("like_count"),
    readAt: timestampWithTimezone("read_at"),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notifications_like_recipient_post_unique")
      .on(table.recipientId, table.postId)
      .where(sql`${table.kind} = 'like'`),
    index("notifications_recipient_created_at_idx").on(
      table.recipientId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("notifications_recipient_unread_idx")
      .on(table.recipientId)
      .where(sql`${table.readAt} is null`),
    index("notifications_created_at_idx").on(table.createdAt),
    check(
      "notifications_not_self_check",
      sql`${table.actorId} <> ${table.recipientId}`,
    ),
    check(
      "notifications_target_shape_check",
      sql`(
          ${table.kind} = 'follow'
          and ${table.postId} is null
          and ${table.commentId} is null
          and ${table.likeCount} is null
        ) or (
          ${table.kind} = 'like'
          and ${table.postId} is not null
          and ${table.commentId} is null
          and ${table.likeCount} >= 1
        ) or (
          ${table.kind} in ('comment', 'reply', 'mention')
          and ${table.postId} is not null
          and ${table.commentId} is not null
          and ${table.likeCount} is null
        ) or (
          ${table.kind} = 'announcement'
          and ${table.commentId} is null
          and ${table.likeCount} is null
        )`,
    ),
  ],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type PostLike = typeof postLikes.$inferSelect;
export type CommentLike = typeof commentLikes.$inferSelect;
export type NewPostLike = typeof postLikes.$inferInsert;
export type PostBookmark = typeof postBookmarks.$inferSelect;
export type NewPostBookmark = typeof postBookmarks.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type PostImage = typeof postImages.$inferSelect;
export type DocumentAsset = typeof documentAssets.$inferSelect;
export type PostDocument = typeof postDocuments.$inferSelect;
export type Poll = typeof polls.$inferSelect;
export type PollOption = typeof pollOptions.$inferSelect;
export type PollVote = typeof pollVotes.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ModerationAction = typeof moderationActions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type RateLimitHit = typeof rateLimitHits.$inferSelect;
