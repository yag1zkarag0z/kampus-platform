ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_content_post_check" CHECK (
	"moderation_actions"."action" not in ('report_dismissed', 'content_removed', 'content_hidden', 'content_restored')
	or "moderation_actions"."post_id" is not null
);--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_provenance_check" CHECK (
	"moderation_actions"."action" not in ('report_dismissed', 'content_removed', 'content_restored')
	or "moderation_actions"."report_id" is not null
);--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_scope_check" CHECK (
	"moderation_actions"."report_id" is null
	or "moderation_actions"."action" in ('report_dismissed', 'content_removed', 'content_restored', 'user_suspended')
);
