ALTER TABLE "otp_challenges" ADD COLUMN "invalidated_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_invalidated_at_order_check" CHECK ("otp_challenges"."invalidated_at" is null
        or "otp_challenges"."invalidated_at" >= "otp_challenges"."created_at");