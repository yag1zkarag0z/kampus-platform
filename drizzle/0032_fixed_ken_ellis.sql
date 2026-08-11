CREATE TYPE "public"."feedback_category" AS ENUM('bug', 'suggestion', 'other');--> statement-breakpoint
CREATE TYPE "public"."feedback_session_mode" AS ENUM('member', 'guest');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('new', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "product_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_mode" "feedback_session_mode" NOT NULL,
	"request_ip_hash" varchar(64),
	"category" "feedback_category" NOT NULL,
	"message" varchar(1000) NOT NULL,
	"page_path" varchar(240) NOT NULL,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_feedback_submitter_check" CHECK ((
          "product_feedback"."session_mode" = 'guest'
          and "product_feedback"."user_id" is null
          and "product_feedback"."request_ip_hash" ~ '^[0-9a-f]{64}$'
        ) or (
          "product_feedback"."session_mode" = 'member'
          and "product_feedback"."request_ip_hash" is null
        )),
	CONSTRAINT "product_feedback_message_length_check" CHECK (char_length(btrim("product_feedback"."message")) between 20 and 1000),
	CONSTRAINT "product_feedback_page_path_check" CHECK (char_length("product_feedback"."page_path") between 1 and 240
        and left("product_feedback"."page_path", 1) = '/'
        and left("product_feedback"."page_path", 2) <> '//'),
	CONSTRAINT "product_feedback_review_state_check" CHECK ((
          "product_feedback"."status" = 'new'
          and "product_feedback"."reviewed_by" is null
          and "product_feedback"."reviewed_at" is null
        ) or (
          "product_feedback"."status" <> 'new'
          and "product_feedback"."reviewed_at" is not null
        )),
	CONSTRAINT "product_feedback_updated_at_order_check" CHECK ("product_feedback"."updated_at" >= "product_feedback"."created_at"
        and ("product_feedback"."reviewed_at" is null or "product_feedback"."reviewed_at" >= "product_feedback"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_feedback_status_created_at_idx" ON "product_feedback" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "product_feedback_category_created_at_idx" ON "product_feedback" USING btree ("category","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "product_feedback_user_created_at_idx" ON "product_feedback" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "product_feedback_guest_ip_created_at_idx" ON "product_feedback" USING btree ("request_ip_hash","created_at" DESC NULLS LAST) WHERE "product_feedback"."request_ip_hash" is not null;--> statement-breakpoint
CREATE INDEX "product_feedback_created_at_idx" ON "product_feedback" USING btree ("created_at");