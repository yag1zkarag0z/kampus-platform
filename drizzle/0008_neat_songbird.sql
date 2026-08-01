ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_email_student_domain_check";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_student_domain_check";--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_email_student_domain_check" CHECK ("otp_challenges"."email"::text = btrim("otp_challenges"."email"::text)
        and lower("otp_challenges"."email"::text) ~ '^[0-9]+@stu[.]yasar[.]edu[.]tr$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_student_domain_check" CHECK ("users"."email"::text = btrim("users"."email"::text)
        and lower("users"."email"::text) ~ '^[0-9]+@stu[.]yasar[.]edu[.]tr$');