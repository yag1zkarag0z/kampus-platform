ALTER TYPE "public"."moderation_action_type" ADD VALUE 'content_hidden' BEFORE 'user_suspended';--> statement-breakpoint
ALTER TYPE "public"."moderation_action_type" ADD VALUE 'content_restored' BEFORE 'user_suspended';--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(40) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_hits_action_not_blank_check" CHECK (char_length(btrim("rate_limit_hits"."action")) > 0)
);
--> statement-breakpoint
ALTER TABLE "moderation_actions" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "hidden_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "rate_limit_hits" ADD CONSTRAINT "rate_limit_hits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_limit_hits_user_action_created_at_idx" ON "rate_limit_hits" USING btree ("user_id","action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "rate_limit_hits_user_created_at_idx" ON "rate_limit_hits" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "rate_limit_hits_created_at_idx" ON "rate_limit_hits" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_hidden_at_order_check" CHECK ("posts"."hidden_at" is null
        or "posts"."hidden_at" >= "posts"."created_at");