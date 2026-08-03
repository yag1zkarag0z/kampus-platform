import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

const timestampWithTimezone = (name: string) =>
  timestamp(name, {
    withTimezone: true,
    mode: "date",
    precision: 3,
  });

export const userRole = pgEnum("user_role", [
  "member",
  "moderator",
  "admin",
]);

export const accountStatus = pgEnum("account_status", [
  "active",
  "suspended",
]);

export const otpDeliveryStatus = pgEnum("otp_delivery_status", [
  "pending",
  "delivered",
  "failed",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: citext("email").notNull().unique("users_email_unique"),
    username: citext("username")
      .notNull()
      .unique("users_username_unique"),
    displayName: varchar("display_name", { length: 40 }).notNull(),
    department: varchar("department", { length: 60 }).notNull(),
    yearLabel: varchar("year_label", { length: 30 }).notNull(),
    bio: varchar("bio", { length: 160 }).default("").notNull(),
    avatarObjectKey: text("avatar_object_key"),
    role: userRole("role").default("member").notNull(),
    status: accountStatus("status").default("active").notNull(),
    suspendedAt: timestampWithTimezone("suspended_at"),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    deletedAt: timestampWithTimezone("deleted_at"),
  },
  (table) => [
    index("users_status_idx").on(table.status),
    index("users_deleted_at_idx")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check(
      "users_email_student_domain_check",
      sql`${table.email}::text = btrim(${table.email}::text)
        and lower(${table.email}::text) ~ '^[0-9]+@stu[.]yasar[.]edu[.]tr$'`,
    ),
    check(
      "users_username_format_check",
      sql`char_length(${table.username}::text) between 3 and 24
        and ${table.username}::text ~ '^[a-z0-9]+([._][a-z0-9]+)*$'`,
    ),
    check(
      "users_username_reserved_check",
      sql`lower(${table.username}::text) not in
        ('anonim', 'sen', 'admin', 'moderator', 'kampus', 'destek')`,
    ),
    check(
      "users_display_name_not_blank_check",
      sql`char_length(btrim(${table.displayName})) > 0`,
    ),
    check(
      "users_department_not_blank_check",
      sql`char_length(btrim(${table.department})) > 0`,
    ),
    check(
      "users_year_label_not_blank_check",
      sql`char_length(btrim(${table.yearLabel})) > 0`,
    ),
    check(
      "users_avatar_object_key_not_blank_check",
      sql`${table.avatarObjectKey} is null
        or char_length(btrim(${table.avatarObjectKey})) > 0`,
    ),
    check(
      "users_suspension_state_check",
      sql`(${table.status} = 'active' and ${table.suspendedAt} is null)
        or (${table.status} = 'suspended' and ${table.suspendedAt} is not null)`,
    ),
    check(
      "users_suspended_at_order_check",
      sql`${table.suspendedAt} is null
        or ${table.suspendedAt} >= ${table.createdAt}`,
    ),
    check(
      "users_deleted_at_order_check",
      sql`${table.deletedAt} is null
        or ${table.deletedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  showDepartment: boolean("show_department").default(false).notNull(),
  notifyReplies: boolean("notify_replies").default(true).notNull(),
  notifyLikes: boolean("notify_likes").default(true).notNull(),
  notifyAnnouncements: boolean("notify_announcements")
    .default(true)
    .notNull(),
  notifyComments: boolean("notify_comments").default(true).notNull(),
  notifyFollows: boolean("notify_follows").default(true).notNull(),
  notifyMentions: boolean("notify_mentions").default(true).notNull(),
  emailNotifications: boolean("email_notifications").default(true).notNull(),
});

export const termsAcceptances = pgTable(
  "terms_acceptances",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    termsVersion: text("terms_version").notNull(),
    acceptedAt: timestampWithTimezone("accepted_at")
      .defaultNow()
      .notNull(),
    ipHash: text("ip_hash").notNull(),
  },
  (table) => [
    primaryKey({
      name: "terms_acceptances_pk",
      columns: [table.userId, table.termsVersion],
    }),
    check(
      "terms_acceptances_version_check",
      sql`char_length(btrim(${table.termsVersion})) between 1 and 64`,
    ),
    check(
      "terms_acceptances_ip_hash_check",
      sql`char_length(${table.ipHash}) between 32 and 256`,
    ),
  ],
);

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: citext("email").notNull(),
    purpose: text("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    requestIpHash: text("request_ip_hash").notNull(),
    deliveryStatus: otpDeliveryStatus("delivery_status")
      .default("pending")
      .notNull(),
    deliveredAt: timestampWithTimezone("delivered_at"),
    deliveryFailedAt: timestampWithTimezone("delivery_failed_at"),
    expiresAt: timestampWithTimezone("expires_at").notNull(),
    attemptCount: smallint("attempt_count").default(0).notNull(),
    resendAvailableAt: timestampWithTimezone(
      "resend_available_at",
    ).notNull(),
    verifiedAt: timestampWithTimezone("verified_at"),
    invalidatedAt: timestampWithTimezone("invalidated_at"),
    consumedAt: timestampWithTimezone("consumed_at"),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("otp_challenges_email_purpose_created_at_idx").on(
      table.email,
      table.purpose,
      table.createdAt,
    ),
    index("otp_challenges_ip_created_at_idx").on(
      table.requestIpHash,
      table.createdAt,
    ),
    index("otp_challenges_expires_at_idx").on(table.expiresAt),
    check(
      "otp_challenges_email_student_domain_check",
      sql`${table.email}::text = btrim(${table.email}::text)
        and lower(${table.email}::text) ~ '^[0-9]+@stu[.]yasar[.]edu[.]tr$'`,
    ),
    check(
      "otp_challenges_purpose_check",
      sql`${table.purpose} in ('registration', 'login')`,
    ),
    check(
      "otp_challenges_code_hash_check",
      sql`char_length(${table.codeHash}) between 32 and 512`,
    ),
    check(
      "otp_challenges_ip_hash_check",
      sql`char_length(${table.requestIpHash}) between 32 and 256`,
    ),
    check(
      "otp_challenges_attempt_count_check",
      sql`${table.attemptCount} between 0 and 3`,
    ),
    check(
      "otp_challenges_delivery_state_check",
      sql`(
          ${table.deliveryStatus} = 'pending'
          and ${table.deliveredAt} is null
          and ${table.deliveryFailedAt} is null
        ) or (
          ${table.deliveryStatus} = 'delivered'
          and ${table.deliveredAt} is not null
          and ${table.deliveryFailedAt} is null
        ) or (
          ${table.deliveryStatus} = 'failed'
          and ${table.deliveredAt} is null
          and ${table.deliveryFailedAt} is not null
        )`,
    ),
    check(
      "otp_challenges_delivered_at_order_check",
      sql`${table.deliveredAt} is null
        or ${table.deliveredAt} >= ${table.createdAt}`,
    ),
    check(
      "otp_challenges_delivery_failed_at_order_check",
      sql`${table.deliveryFailedAt} is null
        or ${table.deliveryFailedAt} >= ${table.createdAt}`,
    ),
    check(
      "otp_challenges_expiration_order_check",
      sql`${table.expiresAt} > ${table.createdAt}
        and ${table.expiresAt} <= ${table.createdAt} + interval '5 minutes'`,
    ),
    check(
      "otp_challenges_resend_order_check",
      sql`${table.resendAvailableAt} >= ${table.createdAt} + interval '30 seconds'
        and ${table.resendAvailableAt} < ${table.expiresAt}`,
    ),
    check(
      "otp_challenges_verified_at_order_check",
      sql`${table.verifiedAt} is null
        or (
          ${table.deliveryStatus} = 'delivered'
          and ${table.verifiedAt} >= ${table.createdAt}
          and ${table.verifiedAt} <= ${table.expiresAt})`,
    ),
    check(
      "otp_challenges_invalidated_at_order_check",
      sql`${table.invalidatedAt} is null
        or ${table.invalidatedAt} >= ${table.createdAt}`,
    ),
    check(
      "otp_challenges_consumed_at_order_check",
      sql`${table.consumedAt} is null
        or (
          ${table.consumedAt} >= ${table.createdAt}
          and ${table.verifiedAt} is not null
          and ${table.consumedAt} >= ${table.verifiedAt}
          and (
            (${table.purpose} = 'login'
              and ${table.consumedAt} <= ${table.expiresAt})
            or (
              ${table.purpose} = 'registration'
              and ${table.verifiedAt} is not null
              and ${table.consumedAt}
                <= ${table.verifiedAt} + interval '15 minutes'
            )
          )
        )`,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash")
      .notNull()
      .unique("sessions_token_hash_unique"),
    issuedRole: userRole("issued_role").notNull(),
    expiresAt: timestampWithTimezone("expires_at").notNull(),
    revokedAt: timestampWithTimezone("revoked_at"),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_active_user_idx")
      .on(table.userId, table.expiresAt)
      .where(sql`${table.revokedAt} is null`),
    index("sessions_expires_at_idx").on(table.expiresAt),
    check(
      "sessions_token_hash_check",
      sql`char_length(${table.tokenHash}) between 32 and 512`,
    ),
    check(
      "sessions_expiration_order_check",
      sql`${table.expiresAt} > ${table.createdAt}
        and (
          (${table.issuedRole} = 'member'
            and ${table.expiresAt}
              <= ${table.createdAt} + interval '30 days')
          or (
            ${table.issuedRole} in ('moderator', 'admin')
            and ${table.expiresAt}
              <= ${table.createdAt} + interval '8 hours'
          )
        )`,
    ),
    check(
      "sessions_revoked_at_order_check",
      sql`${table.revokedAt} is null
        or ${table.revokedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "follows_pk",
      columns: [table.followerId, table.followingId],
    }),
    index("follows_following_id_idx").on(table.followingId),
    check(
      "follows_not_self_check",
      sql`${table.followerId} <> ${table.followingId}`,
    ),
  ],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "blocks_pk",
      columns: [table.blockerId, table.blockedId],
    }),
    index("blocks_blocked_id_idx").on(table.blockedId),
    check(
      "blocks_not_self_check",
      sql`${table.blockerId} <> ${table.blockedId}`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type OtpChallenge = typeof otpChallenges.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Block = typeof blocks.$inferSelect;
