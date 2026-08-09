ALTER TABLE "moderation_actions" DROP CONSTRAINT "moderation_actions_actor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "moderation_actions" DROP CONSTRAINT "moderation_actions_report_id_reports_id_fk";
--> statement-breakpoint
ALTER TABLE "moderation_actions" DROP CONSTRAINT "moderation_actions_target_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "moderation_actions" DROP CONSTRAINT "moderation_actions_post_id_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "reports_reporter_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "reports_post_id_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_check" CHECK (("moderation_actions"."action" = 'content_hidden' and "moderation_actions"."actor_id" is null)
        or ("moderation_actions"."action" <> 'content_hidden' and "moderation_actions"."actor_id" is not null));--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_check" CHECK ("moderation_actions"."action" not in ('user_suspended', 'user_restored', 'role_changed')
        or "moderation_actions"."target_user_id" is not null);--> statement-breakpoint
CREATE FUNCTION prevent_moderation_actions_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'moderation_actions rows are immutable'
		USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER moderation_actions_no_update
BEFORE UPDATE ON "moderation_actions"
FOR EACH ROW
EXECUTE FUNCTION prevent_moderation_actions_update();
