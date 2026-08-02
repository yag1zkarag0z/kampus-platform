CREATE TYPE "public"."moderation_action_type" AS ENUM('report_dismissed', 'content_removed', 'user_suspended', 'user_restored', 'role_changed');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'personal_information', 'misleading', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_resolution" AS ENUM('dismissed', 'content_removed', 'user_suspended');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."report_target_type" AS ENUM('post', 'comment');--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "moderation_action_type" NOT NULL,
	"report_id" uuid,
	"target_user_id" uuid,
	"post_id" uuid,
	"note" varchar(240),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"detail" varchar(300) DEFAULT '' NOT NULL,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"resolution" "report_resolution",
	"resolution_note" varchar(240),
	"resolved_by" uuid,
	"resolved_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_reporter_target_unique" UNIQUE("reporter_id","target_type","target_id"),
	CONSTRAINT "reports_detail_length_check" CHECK (char_length("reports"."detail") <= 300),
	CONSTRAINT "reports_resolution_state_check" CHECK ((
          "reports"."status" = 'pending'
          and "reports"."resolution" is null
          and "reports"."resolved_by" is null
          and "reports"."resolved_at" is null
        ) or (
          "reports"."status" = 'resolved'
          and "reports"."resolution" is not null
          and "reports"."resolved_by" is not null
          and "reports"."resolved_at" is not null
        )),
	CONSTRAINT "reports_resolved_at_order_check" CHECK ("reports"."resolved_at" is null
        or "reports"."resolved_at" >= "reports"."created_at")
);
--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_actions_created_at_idx" ON "moderation_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_user_id_idx" ON "moderation_actions" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_post_id_idx" ON "reports" USING btree ("post_id");