CREATE TABLE "direct_message_request_cooldowns" (
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"rejected_at" timestamp (3) with time zone NOT NULL,
	"cooldown_until" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "direct_message_request_cooldowns_pk" PRIMARY KEY("sender_id","recipient_id"),
	CONSTRAINT "direct_message_request_cooldowns_not_self_check" CHECK ("direct_message_request_cooldowns"."sender_id" <> "direct_message_request_cooldowns"."recipient_id"),
	CONSTRAINT "direct_message_request_cooldowns_order_check" CHECK ("direct_message_request_cooldowns"."cooldown_until" > "direct_message_request_cooldowns"."rejected_at")
);
--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD COLUMN "request_status" varchar(16) DEFAULT 'accepted' NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD COLUMN "request_resolved_at" timestamp (3) with time zone;--> statement-breakpoint
UPDATE "direct_conversations"
SET "request_resolved_at" = "created_at"
WHERE "request_status" = 'accepted';--> statement-breakpoint
ALTER TABLE "direct_message_request_cooldowns" ADD CONSTRAINT "direct_message_request_cooldowns_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_request_cooldowns" ADD CONSTRAINT "direct_message_request_cooldowns_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "direct_message_request_cooldowns_expiry_idx" ON "direct_message_request_cooldowns" USING btree ("cooldown_until");--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_request_state_check" CHECK ((
          "direct_conversations"."request_status" = 'pending'
          and "direct_conversations"."request_resolved_at" is null
        ) or (
          "direct_conversations"."request_status" = 'accepted'
          and "direct_conversations"."request_resolved_at" is not null
          and "direct_conversations"."request_resolved_at" >= "direct_conversations"."created_at"
        ));
