CREATE INDEX "sessions_revoked_at_idx" ON "sessions" USING btree ("revoked_at") WHERE "sessions"."revoked_at" is not null;--> statement-breakpoint
CREATE INDEX "comments_deleted_at_idx" ON "comments" USING btree ("deleted_at") WHERE "comments"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "document_assets_created_at_idx" ON "document_assets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "media_assets_created_at_idx" ON "media_assets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "posts_deleted_at_idx" ON "posts" USING btree ("deleted_at") WHERE "posts"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "reports_resolved_at_idx" ON "reports" USING btree ("resolved_at") WHERE "reports"."resolved_at" is not null;