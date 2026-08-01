ALTER TABLE "comments" DROP CONSTRAINT "comments_body_not_blank_check";--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_body_not_blank_check" CHECK (char_length(btrim("comments"."body")) > 0
        or "comments"."gif_id" is not null);