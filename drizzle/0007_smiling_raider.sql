ALTER TABLE "comments" DROP CONSTRAINT "comments_parent_id_comments_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_id_post_id_unique" UNIQUE("id","post_id");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_post_comments_id_post_fk" FOREIGN KEY ("parent_id","post_id") REFERENCES "public"."comments"("id","post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_not_self_check" CHECK ("comments"."parent_id" is null or "comments"."parent_id" <> "comments"."id");
