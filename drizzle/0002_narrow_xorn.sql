ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_consumed_at_order_check";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_expiration_order_check";--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD COLUMN "verified_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "issued_role" "user_role" DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "issued_role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_verified_at_order_check" CHECK ("otp_challenges"."verified_at" is null
        or ("otp_challenges"."verified_at" >= "otp_challenges"."created_at"
          and "otp_challenges"."verified_at" <= "otp_challenges"."expires_at"));--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_consumed_at_order_check" CHECK ("otp_challenges"."consumed_at" is null
        or (
          "otp_challenges"."consumed_at" >= "otp_challenges"."created_at"
          and (
            ("otp_challenges"."purpose" = 'login'
              and "otp_challenges"."consumed_at" <= "otp_challenges"."expires_at")
            or (
              "otp_challenges"."purpose" = 'registration'
              and "otp_challenges"."verified_at" is not null
              and "otp_challenges"."consumed_at"
                <= "otp_challenges"."verified_at" + interval '15 minutes'
            )
          )
        ));--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiration_order_check" CHECK ("sessions"."expires_at" > "sessions"."created_at"
        and (
          ("sessions"."issued_role" = 'member'
            and "sessions"."expires_at"
              <= "sessions"."created_at" + interval '30 days')
          or (
            "sessions"."issued_role" in ('moderator', 'admin')
            and "sessions"."expires_at"
              <= "sessions"."created_at" + interval '8 hours'
          )
        ));
