ALTER TABLE "direct_messages" ADD COLUMN "client_message_id" uuid;--> statement-breakpoint
UPDATE "direct_messages"
SET "client_message_id" = "id"
WHERE "client_message_id" IS NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ALTER COLUMN "client_message_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_client_id_unique" UNIQUE("sender_id","client_message_id");
