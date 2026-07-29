CREATE TYPE "public"."post_category" AS ENUM('chat', 'confession', 'question', 'event', 'lost_found', 'poll', 'listing');--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"body" varchar(500) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp (3) with time zone,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "comments_body_not_blank_check" CHECK (char_length(btrim("comments"."body")) > 0),
	CONSTRAINT "comments_edited_at_order_check" CHECK ("comments"."edited_at" is null
        or "comments"."edited_at" >= "comments"."created_at"),
	CONSTRAINT "comments_deleted_at_order_check" CHECK ("comments"."deleted_at" is null
        or "comments"."deleted_at" >= "comments"."created_at")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"category" "post_category" NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"title" varchar(100) DEFAULT '' NOT NULL,
	"body" varchar(500) DEFAULT '' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp (3) with time zone,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "posts_content_not_blank_check" CHECK (char_length(btrim("posts"."title")) > 0
        or char_length(btrim("posts"."body")) > 0),
	CONSTRAINT "posts_edited_at_order_check" CHECK ("posts"."edited_at" is null
        or "posts"."edited_at" >= "posts"."created_at"),
	CONSTRAINT "posts_deleted_at_order_check" CHECK ("posts"."deleted_at" is null
        or "posts"."deleted_at" >= "posts"."created_at")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_active_post_cursor_idx" ON "comments" USING btree ("post_id","created_at","id") WHERE "comments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "comments_parent_id_idx" ON "comments" USING btree ("parent_id") WHERE "comments"."parent_id" is not null;--> statement-breakpoint
CREATE INDEX "comments_author_id_idx" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "posts_active_feed_cursor_idx" ON "posts" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "posts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "posts_active_category_feed_cursor_idx" ON "posts" USING btree ("category","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "posts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "posts_active_author_feed_cursor_idx" ON "posts" USING btree ("author_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "posts"."deleted_at" is null;