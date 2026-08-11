ALTER TYPE "public"."report_target_type" ADD VALUE 'message';--> statement-breakpoint
ALTER TABLE "moderation_actions" DROP CONSTRAINT "moderation_actions_content_post_check";--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "post_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD COLUMN "message_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "message_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "target_snapshot" varchar(1000) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_message_id_direct_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."direct_messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_message_id_direct_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."direct_messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_actions_message_id_idx" ON "moderation_actions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "reports_message_id_idx" ON "reports" USING btree ("message_id");--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_content_post_check" CHECK ((
          "moderation_actions"."action" in ('content_hidden', 'content_restored')
          and "moderation_actions"."post_id" is not null
          and "moderation_actions"."message_id" is null
        ) or (
          "moderation_actions"."action" in ('report_dismissed', 'content_removed')
          and (
            ("moderation_actions"."post_id" is not null and "moderation_actions"."message_id" is null)
            or ("moderation_actions"."post_id" is null and "moderation_actions"."message_id" is not null)
          )
        ) or "moderation_actions"."action" not in (
          'report_dismissed',
          'content_removed',
          'content_hidden',
          'content_restored'
        ));--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_snapshot_length_check" CHECK (char_length("reports"."target_snapshot") <= 1000);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_reference_check" CHECK ((
          "reports"."target_type" in ('post', 'comment')
          and "reports"."post_id" is not null
          and "reports"."message_id" is null
        ) or (
          "reports"."target_type"::text = 'message'
          and "reports"."post_id" is null
          and "reports"."message_id" is not null
          and "reports"."target_id" = "reports"."message_id"
        ));
