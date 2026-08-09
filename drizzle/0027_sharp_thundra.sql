CREATE TABLE "direct_conversation_reads" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "direct_conversation_reads_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "direct_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_low_id" uuid NOT NULL,
	"participant_high_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"last_message_id" uuid,
	"last_message_sender_id" uuid,
	"last_message_preview" varchar(160),
	"last_message_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "direct_conversations_participant_order_check" CHECK ("direct_conversations"."participant_low_id" < "direct_conversations"."participant_high_id"),
	CONSTRAINT "direct_conversations_creator_is_participant_check" CHECK ("direct_conversations"."created_by_id" in ("direct_conversations"."participant_low_id", "direct_conversations"."participant_high_id")),
	CONSTRAINT "direct_conversations_last_message_shape_check" CHECK ((
          "direct_conversations"."last_message_id" is null
          and "direct_conversations"."last_message_sender_id" is null
          and "direct_conversations"."last_message_preview" is null
          and "direct_conversations"."last_message_at" is null
        ) or (
          "direct_conversations"."last_message_id" is not null
          and "direct_conversations"."last_message_sender_id" is not null
          and "direct_conversations"."last_message_preview" is not null
          and "direct_conversations"."last_message_at" is not null
          and "direct_conversations"."last_message_sender_id" in ("direct_conversations"."participant_low_id", "direct_conversations"."participant_high_id")
        )),
	CONSTRAINT "direct_conversations_last_message_order_check" CHECK ("direct_conversations"."last_message_at" is null or "direct_conversations"."last_message_at" >= "direct_conversations"."created_at")
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" varchar(1000) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "direct_messages_body_state_check" CHECK (("direct_messages"."deleted_at" is null and char_length(btrim("direct_messages"."body")) > 0)
        or ("direct_messages"."deleted_at" is not null and "direct_messages"."body" = '')),
	CONSTRAINT "direct_messages_deleted_at_order_check" CHECK ("direct_messages"."deleted_at" is null or "direct_messages"."deleted_at" >= "direct_messages"."created_at")
);
--> statement-breakpoint
ALTER TABLE "direct_conversation_reads" ADD CONSTRAINT "direct_conversation_reads_conversation_id_direct_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."direct_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_conversation_reads" ADD CONSTRAINT "direct_conversation_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_participant_low_id_users_id_fk" FOREIGN KEY ("participant_low_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_participant_high_id_users_id_fk" FOREIGN KEY ("participant_high_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_last_message_sender_id_users_id_fk" FOREIGN KEY ("last_message_sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_direct_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."direct_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "direct_conversation_reads_user_idx" ON "direct_conversation_reads" USING btree ("user_id","last_read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_conversations_pair_unique" ON "direct_conversations" USING btree ("participant_low_id","participant_high_id");--> statement-breakpoint
CREATE INDEX "direct_conversations_low_last_message_idx" ON "direct_conversations" USING btree ("participant_low_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "direct_conversations_high_last_message_idx" ON "direct_conversations" USING btree ("participant_high_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "direct_messages_conversation_cursor_idx" ON "direct_messages" USING btree ("conversation_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "direct_messages_sender_idx" ON "direct_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "direct_messages_deleted_at_idx" ON "direct_messages" USING btree ("deleted_at") WHERE "direct_messages"."deleted_at" is not null;