CREATE TYPE "public"."notification_kind" AS ENUM('like', 'comment', 'reply', 'mention', 'follow', 'announcement');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"like_count" integer,
	"read_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_not_self_check" CHECK ("notifications"."actor_id" <> "notifications"."recipient_id"),
	CONSTRAINT "notifications_target_shape_check" CHECK ((
          "notifications"."kind" = 'follow'
          and "notifications"."post_id" is null
          and "notifications"."comment_id" is null
          and "notifications"."like_count" is null
        ) or (
          "notifications"."kind" = 'like'
          and "notifications"."post_id" is not null
          and "notifications"."comment_id" is null
          and "notifications"."like_count" >= 1
        ) or (
          "notifications"."kind" in ('comment', 'reply', 'mention')
          and "notifications"."post_id" is not null
          and "notifications"."comment_id" is not null
          and "notifications"."like_count" is null
        ) or (
          "notifications"."kind" = 'announcement'
          and "notifications"."comment_id" is null
          and "notifications"."like_count" is null
        ))
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notify_comments" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notify_follows" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notify_mentions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_like_recipient_post_unique" ON "notifications" USING btree ("recipient_id","post_id") WHERE "notifications"."kind" = 'like';--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_at_idx" ON "notifications" USING btree ("recipient_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_id") WHERE "notifications"."read_at" is null;