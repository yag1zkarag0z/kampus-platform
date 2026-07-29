ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_expiration_order_check";--> statement-breakpoint
ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_resend_order_check";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_expiration_order_check";--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_expiration_order_check" CHECK ("otp_challenges"."expires_at" > "otp_challenges"."created_at"
        and "otp_challenges"."expires_at" <= "otp_challenges"."created_at" + interval '5 minutes');--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_resend_order_check" CHECK ("otp_challenges"."resend_available_at" >= "otp_challenges"."created_at" + interval '30 seconds'
        and "otp_challenges"."resend_available_at" < "otp_challenges"."expires_at");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiration_order_check" CHECK ("sessions"."expires_at" > "sessions"."created_at"
        and "sessions"."expires_at" <= "sessions"."created_at" + interval '8 hours');