DROP INDEX "direct_conversation_reads_user_idx";--> statement-breakpoint
ALTER TABLE "direct_conversation_reads" ADD COLUMN "last_read_message_id" uuid;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_id_conversation_unique" UNIQUE("id","conversation_id");--> statement-breakpoint
WITH "latest_read_messages" AS (
	SELECT DISTINCT ON ("reads"."conversation_id", "reads"."user_id")
		"reads"."conversation_id",
		"reads"."user_id",
		"messages"."id" AS "message_id",
		"messages"."created_at" AS "message_created_at"
	FROM "direct_conversation_reads" AS "reads"
	INNER JOIN "direct_messages" AS "messages"
		ON "messages"."conversation_id" = "reads"."conversation_id"
		AND "messages"."created_at" <= "reads"."last_read_at"
	ORDER BY
		"reads"."conversation_id",
		"reads"."user_id",
		"messages"."created_at" DESC,
		"messages"."id" DESC
)
UPDATE "direct_conversation_reads" AS "reads"
SET
	"last_read_at" = "latest"."message_created_at",
	"last_read_message_id" = "latest"."message_id"
FROM "latest_read_messages" AS "latest"
WHERE
	"reads"."conversation_id" = "latest"."conversation_id"
	AND "reads"."user_id" = "latest"."user_id";--> statement-breakpoint
ALTER TABLE "direct_conversation_reads" ADD CONSTRAINT "direct_conversation_reads_message_conversation_fk" FOREIGN KEY ("last_read_message_id","conversation_id") REFERENCES "public"."direct_messages"("id","conversation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "direct_conversation_reads_user_idx" ON "direct_conversation_reads" USING btree ("user_id","last_read_at","last_read_message_id");
