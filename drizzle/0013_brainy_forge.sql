ALTER TABLE "comments" ADD COLUMN "gif_id" varchar(80);--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "gif_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "gif_width" integer;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "gif_height" integer;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "gif_alt" varchar(160);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "gif_id" varchar(80);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "gif_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "gif_width" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "gif_height" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "gif_alt" varchar(160);