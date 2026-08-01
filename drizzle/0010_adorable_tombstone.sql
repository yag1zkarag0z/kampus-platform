CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"text" varchar(60) NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "poll_options_id_poll_id_unique" UNIQUE("id","poll_id"),
	CONSTRAINT "poll_options_poll_position_unique" UNIQUE("poll_id","position"),
	CONSTRAINT "poll_options_text_not_blank_check" CHECK (char_length(btrim("poll_options"."text")) > 0),
	CONSTRAINT "poll_options_position_check" CHECK ("poll_options"."position" >= 0 and "poll_options"."position" < 4)
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"poll_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_pk" PRIMARY KEY("poll_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"post_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_post_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_post_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_poll_options_id_poll_fk" FOREIGN KEY ("option_id","poll_id") REFERENCES "public"."poll_options"("id","poll_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poll_votes_option_id_idx" ON "poll_votes" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "poll_votes_user_updated_at_idx" ON "poll_votes" USING btree ("user_id","updated_at" DESC NULLS LAST);