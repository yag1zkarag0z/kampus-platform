CREATE TYPE "public"."otp_delivery_status" AS ENUM('pending', 'delivered', 'failed');--> statement-breakpoint
ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_verified_at_order_check";--> statement-breakpoint
ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_consumed_at_order_check";--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD COLUMN "delivery_status" "otp_delivery_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD COLUMN "delivered_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD COLUMN "delivery_failed_at" timestamp (3) with time zone;--> statement-breakpoint
UPDATE "otp_challenges"
SET
  "delivery_status" = 'delivered',
  "delivered_at" = COALESCE("verified_at", "consumed_at", "created_at")
WHERE "verified_at" IS NOT NULL OR "consumed_at" IS NOT NULL;--> statement-breakpoint
UPDATE "otp_challenges"
SET
  "delivery_status" = 'failed',
  "delivery_failed_at" = "created_at"
WHERE "delivery_status" = 'pending';--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_delivery_state_check" CHECK ((
          "otp_challenges"."delivery_status" = 'pending'
          and "otp_challenges"."delivered_at" is null
          and "otp_challenges"."delivery_failed_at" is null
        ) or (
          "otp_challenges"."delivery_status" = 'delivered'
          and "otp_challenges"."delivered_at" is not null
          and "otp_challenges"."delivery_failed_at" is null
        ) or (
          "otp_challenges"."delivery_status" = 'failed'
          and "otp_challenges"."delivered_at" is null
          and "otp_challenges"."delivery_failed_at" is not null
        ));--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_delivered_at_order_check" CHECK ("otp_challenges"."delivered_at" is null
        or "otp_challenges"."delivered_at" >= "otp_challenges"."created_at");--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_delivery_failed_at_order_check" CHECK ("otp_challenges"."delivery_failed_at" is null
        or "otp_challenges"."delivery_failed_at" >= "otp_challenges"."created_at");--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_verified_at_order_check" CHECK ("otp_challenges"."verified_at" is null
        or (
          "otp_challenges"."delivery_status" = 'delivered'
          and "otp_challenges"."verified_at" >= "otp_challenges"."created_at"
          and "otp_challenges"."verified_at" <= "otp_challenges"."expires_at"));--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_consumed_at_order_check" CHECK ("otp_challenges"."consumed_at" is null
        or (
          "otp_challenges"."consumed_at" >= "otp_challenges"."created_at"
          and "otp_challenges"."verified_at" is not null
          and "otp_challenges"."consumed_at" >= "otp_challenges"."verified_at"
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
        ));
