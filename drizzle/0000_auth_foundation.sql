CREATE EXTENSION IF NOT EXISTS "citext";--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'moderator', 'admin');--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"request_ip_hash" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"attempt_count" smallint DEFAULT 0 NOT NULL,
	"resend_available_at" timestamp (3) with time zone NOT NULL,
	"consumed_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_challenges_email_student_domain_check" CHECK ("otp_challenges"."email"::text = btrim("otp_challenges"."email"::text)
        and lower("otp_challenges"."email"::text) ~ '^[^@[:space:]]+@stu[.]yasar[.]edu[.]tr$'),
	CONSTRAINT "otp_challenges_purpose_check" CHECK ("otp_challenges"."purpose" in ('registration', 'login')),
	CONSTRAINT "otp_challenges_code_hash_check" CHECK (char_length("otp_challenges"."code_hash") between 32 and 512),
	CONSTRAINT "otp_challenges_ip_hash_check" CHECK (char_length("otp_challenges"."request_ip_hash") between 32 and 256),
	CONSTRAINT "otp_challenges_attempt_count_check" CHECK ("otp_challenges"."attempt_count" between 0 and 3),
	CONSTRAINT "otp_challenges_expiration_order_check" CHECK ("otp_challenges"."expires_at" > "otp_challenges"."created_at"),
	CONSTRAINT "otp_challenges_resend_order_check" CHECK ("otp_challenges"."resend_available_at" > "otp_challenges"."created_at"
        and "otp_challenges"."resend_available_at" < "otp_challenges"."expires_at"),
	CONSTRAINT "otp_challenges_consumed_at_order_check" CHECK ("otp_challenges"."consumed_at" is null
        or ("otp_challenges"."consumed_at" >= "otp_challenges"."created_at"
          and "otp_challenges"."consumed_at" <= "otp_challenges"."expires_at"))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "sessions_token_hash_check" CHECK (char_length("sessions"."token_hash") between 32 and 512),
	CONSTRAINT "sessions_expiration_order_check" CHECK ("sessions"."expires_at" > "sessions"."created_at"),
	CONSTRAINT "sessions_revoked_at_order_check" CHECK ("sessions"."revoked_at" is null
        or "sessions"."revoked_at" >= "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "terms_acceptances" (
	"user_id" uuid NOT NULL,
	"terms_version" text NOT NULL,
	"accepted_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"ip_hash" text NOT NULL,
	CONSTRAINT "terms_acceptances_pk" PRIMARY KEY("user_id","terms_version"),
	CONSTRAINT "terms_acceptances_version_check" CHECK (char_length(btrim("terms_acceptances"."terms_version")) between 1 and 64),
	CONSTRAINT "terms_acceptances_ip_hash_check" CHECK (char_length("terms_acceptances"."ip_hash") between 32 and 256)
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"show_department" boolean DEFAULT false NOT NULL,
	"notify_replies" boolean DEFAULT true NOT NULL,
	"notify_likes" boolean DEFAULT true NOT NULL,
	"notify_announcements" boolean DEFAULT true NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"username" "citext" NOT NULL,
	"display_name" varchar(40) NOT NULL,
	"department" varchar(60) NOT NULL,
	"year_label" varchar(30) NOT NULL,
	"bio" varchar(160) DEFAULT '' NOT NULL,
	"avatar_object_key" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"suspended_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_student_domain_check" CHECK ("users"."email"::text = btrim("users"."email"::text)
        and lower("users"."email"::text) ~ '^[^@[:space:]]+@stu[.]yasar[.]edu[.]tr$'),
	CONSTRAINT "users_username_format_check" CHECK (char_length("users"."username"::text) between 3 and 24
        and "users"."username"::text ~ '^[a-z0-9]+([._][a-z0-9]+)*$'),
	CONSTRAINT "users_username_reserved_check" CHECK (lower("users"."username"::text) not in
        ('anonim', 'sen', 'admin', 'moderator', 'kampus', 'destek')),
	CONSTRAINT "users_display_name_not_blank_check" CHECK (char_length(btrim("users"."display_name")) > 0),
	CONSTRAINT "users_department_not_blank_check" CHECK (char_length(btrim("users"."department")) > 0),
	CONSTRAINT "users_year_label_not_blank_check" CHECK (char_length(btrim("users"."year_label")) > 0),
	CONSTRAINT "users_avatar_object_key_not_blank_check" CHECK ("users"."avatar_object_key" is null
        or char_length(btrim("users"."avatar_object_key")) > 0),
	CONSTRAINT "users_suspension_state_check" CHECK (("users"."status" = 'active' and "users"."suspended_at" is null)
        or ("users"."status" = 'suspended' and "users"."suspended_at" is not null)),
	CONSTRAINT "users_suspended_at_order_check" CHECK ("users"."suspended_at" is null
        or "users"."suspended_at" >= "users"."created_at"),
	CONSTRAINT "users_deleted_at_order_check" CHECK ("users"."deleted_at" is null
        or "users"."deleted_at" >= "users"."created_at")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "otp_challenges_email_purpose_created_at_idx" ON "otp_challenges" USING btree ("email","purpose","created_at");--> statement-breakpoint
CREATE INDEX "otp_challenges_ip_created_at_idx" ON "otp_challenges" USING btree ("request_ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_active_user_idx" ON "sessions" USING btree ("user_id","expires_at") WHERE "sessions"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at") WHERE "users"."deleted_at" is not null;
